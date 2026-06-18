import asyncio
from datetime import date
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, WebSocket
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.database import SessionLocal, get_db
from models import ExportOperation, OperationEvent
from schemas import ActionEventRead, ExportOperationRead, ExportRequest
from services.exporter import create_export_operation, run_export

router = APIRouter(tags=["exports"])


async def _run_export_background(operation_id: str) -> None:
    with SessionLocal() as db:
        await run_export(db, operation_id)


def _download_url(operation: ExportOperation) -> str | None:
    return f"/exports/{operation.id}/download" if operation.file_path else None


def _operation_read(operation: ExportOperation) -> ExportOperationRead:
    return ExportOperationRead.model_validate(operation).model_copy(update={"download_url": _download_url(operation)})


def _event_json(event: OperationEvent) -> dict:
    return ActionEventRead.model_validate(event).model_dump(mode="json")


@router.get("/exports")
async def export_now(
    tables: str = Query(default="employees,departments"),
    format: str = Query(default="xlsx", pattern="^(xlsx|csv)$"),
    cutoff: date | None = None,
    db: Session = Depends(get_db),
) -> FileResponse:
    selected = [table.strip() for table in tables.split(",") if table.strip()]
    try:
        operation = create_export_operation(db, tables=selected, fmt=format, cutoff=cutoff)
        operation = await run_export(db, operation.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not operation.file_path:
        raise HTTPException(status_code=500, detail="Export did not produce a file.")
    return FileResponse(path=operation.file_path, filename=Path(operation.file_path).name)


@router.post("/exports", response_model=ExportOperationRead, status_code=202)
async def export_async(
    payload: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ExportOperationRead:
    try:
        operation = create_export_operation(db, tables=payload.tables, fmt=payload.format, cutoff=payload.cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    background_tasks.add_task(_run_export_background, operation.id)
    return _operation_read(operation)


@router.get("/exports/history", response_model=list[ExportOperationRead])
def export_history(db: Session = Depends(get_db)) -> list[ExportOperationRead]:
    operations = db.query(ExportOperation).order_by(ExportOperation.created_at.desc()).all()
    return [_operation_read(operation) for operation in operations]


@router.get("/exports/{operation_id}", response_model=ExportOperationRead)
def get_export(operation_id: str, db: Session = Depends(get_db)) -> ExportOperationRead:
    operation = db.get(ExportOperation, operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="Export operation not found.")
    return _operation_read(operation)


@router.get("/exports/{operation_id}/events", response_model=list[ActionEventRead])
def get_export_events(operation_id: str, db: Session = Depends(get_db)) -> list[OperationEvent]:
    return (
        db.query(OperationEvent)
        .filter(OperationEvent.action_type == "export", OperationEvent.operation_id == operation_id)
        .order_by(OperationEvent.created_at)
        .all()
    )


@router.get("/exports/{operation_id}/download")
def download_export(operation_id: str, db: Session = Depends(get_db)) -> FileResponse:
    operation = db.get(ExportOperation, operation_id)
    if not operation or not operation.file_path:
        raise HTTPException(status_code=404, detail="Export file not found.")
    return FileResponse(path=operation.file_path, filename=Path(operation.file_path).name)


@router.websocket("/exports/{operation_id}/ws")
async def export_websocket(operation_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    last_id = 0
    while True:
        with SessionLocal() as db:
            events = (
                db.query(OperationEvent)
                .filter(
                    OperationEvent.action_type == "export",
                    OperationEvent.operation_id == operation_id,
                    OperationEvent.id > last_id,
                )
                .order_by(OperationEvent.id)
                .all()
            )
            for event in events:
                await websocket.send_json(_event_json(event))
                last_id = event.id
                if event.status in {"completed", "failed"}:
                    return
        await asyncio.sleep(0.5)
