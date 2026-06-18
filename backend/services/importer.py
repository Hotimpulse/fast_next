import hashlib
import shutil
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from pydantic import ValidationError
from python_calamine import load_workbook
from sqlalchemy.orm import Session

from models import AssignmentVersion, EmployeeAssignment, ImportBatch, OperationEvent, Person
from schemas import EmployeeCreate, EmployeePatch
from services.employees import create_employee, patch_employee

STORAGE_DIR = Path("storage/imports")
HEADER_ROW_INDEX = 1
DATA_START_INDEX = 3

HEADER_MAP = {
    "Департамент": "department_name",
    "Отдел": "division_name",
    "Должность": "position_name",
    "Руководитель": "manager_name",
    "ФИО сотрудника": "full_name",
    "Дата приема на работу": "hire_date",
    "Дата увольнения": "termination_date",
    "Статус": "status",
    "Штат": "employment_type",
    "заработная плата": "salary",
}


def _now() -> datetime:
    return datetime.utcnow()


def _clean(value: Any) -> Any:
    if value == "":
        return None
    if isinstance(value, str):
        value = " ".join(value.split()).strip()
        return value or None
    return value


def _date(value: Any) -> date | None:
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Invalid date value: {value}")
    return None


def _decimal(value: Any) -> Decimal | None:
    value = _clean(value)
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Invalid salary value.") from exc


def _record_event(
    db: Session,
    *,
    batch: ImportBatch,
    status: str,
    message: str | None,
    level: str = "info",
    payload: dict[str, Any] | None = None,
) -> OperationEvent:
    event = OperationEvent(
        action_type="import",
        operation_id=batch.id,
        level=level,
        status=status,
        message=message,
        payload=payload or {},
        processed_rows=batch.processed_rows,
        total_rows=batch.total_rows,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def save_upload(file: UploadFile) -> tuple[Path, str]:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload.xlsb").suffix
    stored_path = STORAGE_DIR / f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{suffix}"

    digest = hashlib.sha256()
    file.file.seek(0)
    with stored_path.open("wb") as output:
        while chunk := file.file.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)
    file.file.seek(0)
    return stored_path, digest.hexdigest()


def create_batch(
    db: Session,
    *,
    original_filename: str,
    stored_filename: str,
    file_sha256: str,
    import_mode: str,
) -> ImportBatch:
    batch = ImportBatch(
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_sha256=file_sha256,
        source_sheet_name="",
        import_mode=import_mode,
        status="pending",
        options={"warnings": [], "errors": []},
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    _record_event(db, batch=batch, status="pending", message="Import queued.")
    return batch


def _append_issue(batch: ImportBatch, kind: str, message: str) -> None:
    options = dict(batch.options or {})
    key = "warnings" if kind == "warning" else "errors"
    options[key] = [*options.get(key, []), message]
    batch.options = options
    if kind == "warning":
        batch.warning_count += 1
    else:
        batch.error_count += 1


def _row_payload(headers: list[Any], row: list[Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for index, header in enumerate(headers):
        field = HEADER_MAP.get(str(header).strip())
        if not field:
            continue
        payload[field] = _clean(row[index] if index < len(row) else None)
    payload["hire_date"] = _date(payload.get("hire_date"))
    payload["termination_date"] = _date(payload.get("termination_date"))
    payload["salary"] = _decimal(payload.get("salary"))
    return payload


def _find_current_assignment(db: Session, payload: EmployeeCreate) -> str | None:
    row = (
        db.query(EmployeeAssignment)
        .join(Person, Person.id == EmployeeAssignment.person_id)
        .join(AssignmentVersion, AssignmentVersion.assignment_id == EmployeeAssignment.id)
        .filter(EmployeeAssignment.is_deleted.is_(False))
        .filter(AssignmentVersion.is_current.is_(True))
        .filter(Person.full_name == payload.full_name)
        .filter(AssignmentVersion.position_name == payload.position_name)
        .first()
    )
    return row.id if row else None


def _is_unchanged(db: Session, assignment_id: str, payload: EmployeeCreate) -> bool:
    version = (
        db.query(AssignmentVersion)
        .filter(AssignmentVersion.assignment_id == assignment_id, AssignmentVersion.is_current.is_(True))
        .first()
    )
    if not version:
        return False
    department_name = version.department.name if version.department else None
    division_name = version.division.name if version.division else None
    manager_name = version.manager.full_name if version.manager else None
    return (
        department_name == payload.department_name
        and division_name == payload.division_name
        and manager_name == payload.manager_name
        and version.status == payload.status
        and version.employment_type == payload.employment_type
        and version.hire_date == payload.hire_date
        and version.termination_date == payload.termination_date
        and version.salary == payload.salary
    )


async def run_import(db: Session, batch_id: str) -> ImportBatch:
    batch = db.get(ImportBatch, batch_id)
    if not batch:
        raise RuntimeError("Import batch not found.")

    try:
        batch.status = "running"
        batch.started_at = _now()
        db.commit()
        _record_event(db, batch=batch, status="running", message="Reading workbook.")

        workbook = load_workbook(batch.stored_filename)
        sheet_name = workbook.sheet_names[0]
        sheet = workbook.get_sheet_by_name(sheet_name)
        rows = list(sheet.iter_rows())
        if len(rows) <= DATA_START_INDEX:
            raise RuntimeError("Workbook does not contain data rows.")

        headers = rows[HEADER_ROW_INDEX]
        batch.source_sheet_name = sheet_name
        batch.source_cutoff_date = _date(rows[0][-1] if rows and rows[0] else None)
        data_rows = [row for row in rows[DATA_START_INDEX:] if any(_clean(cell) is not None for cell in row)]
        batch.total_rows = len(data_rows)
        db.commit()

        for index, row in enumerate(data_rows, start=DATA_START_INDEX + 1):
            try:
                data = _row_payload(headers, row)
                data["effective_from"] = batch.source_cutoff_date or data.get("hire_date")
                payload = EmployeeCreate(**data)
                existing_id = _find_current_assignment(db, payload)
                if existing_id and _is_unchanged(db, existing_id, payload):
                    batch.unchanged_rows += 1
                elif existing_id:
                    patch_data = payload.model_dump(exclude={"effective_from"})
                    patch = EmployeePatch(**patch_data, effective_from=batch.source_cutoff_date or payload.hire_date)
                    patch_employee(db, existing_id, patch)
                    batch.updated_rows += 1
                else:
                    create_employee(db, payload)
                    batch.inserted_rows += 1
            except (ValidationError, ValueError) as exc:
                _append_issue(batch, "error", f"Row {index}: {exc}")
            except Exception as exc:
                _append_issue(batch, "error", f"Row {index}: {exc}")

            batch.processed_rows += 1
            db.commit()
            _record_event(
                db,
                batch=batch,
                status="running",
                message=f"Processed row {batch.processed_rows} of {batch.total_rows}.",
                payload={
                    "inserted_rows": batch.inserted_rows,
                    "updated_rows": batch.updated_rows,
                    "unchanged_rows": batch.unchanged_rows,
                    "warning_count": batch.warning_count,
                    "error_count": batch.error_count,
                },
            )

        batch.status = "completed_with_warnings" if batch.error_count or batch.warning_count else "completed"
        batch.completed_at = _now()
        db.commit()
        _record_event(db, batch=batch, status=batch.status, message="Import finished.")
        db.refresh(batch)
        return batch
    except Exception as exc:
        batch.status = "failed"
        batch.completed_at = _now()
        _append_issue(batch, "error", str(exc))
        db.commit()
        _record_event(db, batch=batch, status="failed", message=str(exc), level="error")
        db.refresh(batch)
        return batch
