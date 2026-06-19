import asyncio
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, WebSocket
from sqlalchemy.orm import Session

from db.database import SessionLocal, get_db
from models import ImportBatch, OperationEvent
from schemas import ActionEventRead, ImportBatchRead, ImportResult
from services.importer import create_batch, run_import, save_upload

router = APIRouter(tags=["imports"])


async def _run_import_background(batch_id: str) -> None:
    with SessionLocal() as db:
        await run_import(db, batch_id)


def _result_from_batch(batch: ImportBatch) -> ImportResult:
    options = batch.options or {}
    return ImportResult.model_validate(batch).model_copy(
        update={
            "warnings": options.get("warnings", []),
            "errors": options.get("errors", []),
        }
    )


def _event_json(event: OperationEvent) -> dict:
    return ActionEventRead.model_validate(event).model_dump(mode="json")


@router.post("/imports", response_model=ImportResult, status_code=201)
async def import_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    import_mode: Literal["upsert_current"] = "upsert_current",
    async_mode: bool = False,
    db: Session = Depends(get_db),
) -> ImportResult:
    if not file.filename:
        raise HTTPException(status_code=400, detail="У файла должно быть название.")
    if not file.filename.lower().endswith((".xlsb", ".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Поддерживаются только файлы .xlsb, .xlsx и .xlsm.")

    stored_path, digest = save_upload(file)
    batch = create_batch(
        db,
        original_filename=file.filename,
        stored_filename=str(stored_path),
        file_sha256=digest,
        import_mode=import_mode,
    )

    if async_mode:
        background_tasks.add_task(_run_import_background, batch.id)
        return _result_from_batch(batch)

    batch = await run_import(db, batch.id)
    return _result_from_batch(batch)


@router.get("/imports", response_model=list[ImportBatchRead])
def list_imports(db: Session = Depends(get_db)) -> list[ImportBatch]:
    return db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).all()


@router.get("/imports/{batch_id}", response_model=ImportResult)
def get_import(batch_id: str, db: Session = Depends(get_db)) -> ImportResult:
    batch = db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Операция импорта не действует.")
    return _result_from_batch(batch)


@router.get("/imports/{batch_id}/events", response_model=list[ActionEventRead])
def get_import_events(batch_id: str, db: Session = Depends(get_db)) -> list[OperationEvent]:
    return (
        db.query(OperationEvent)
        .filter(OperationEvent.action_type == "import", OperationEvent.operation_id == batch_id)
        .order_by(OperationEvent.created_at)
        .all()
    )


@router.websocket("/imports/{batch_id}/ws")
async def import_websocket(batch_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    last_id = 0
    while True:
        with SessionLocal() as db:
            events = (
                db.query(OperationEvent)
                .filter(
                    OperationEvent.action_type == "import",
                    OperationEvent.operation_id == batch_id,
                    OperationEvent.id > last_id,
                )
                .order_by(OperationEvent.id)
                .all()
            )
            for event in events:
                await websocket.send_json(_event_json(event))
                last_id = event.id
                if event.status in {"completed", "completed_with_warnings", "failed"}:
                    return
        await asyncio.sleep(0.5)
