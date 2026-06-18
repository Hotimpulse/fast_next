import csv
import zipfile
from datetime import date, datetime
from io import StringIO
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from sqlalchemy.orm import Session

from models import AssignmentVersion, EmployeeAssignment, ExportOperation, OperationEvent, OrganizationUnit, Person
from services.employees import list_employees

STORAGE_DIR = Path("storage/exports")
ALLOWED_TABLES = {"employees", "departments", "people", "assignments", "import_rows", "data_quality_issues"}


def _now() -> datetime:
    return datetime.utcnow()


def _json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _record_event(
    db: Session,
    *,
    operation: ExportOperation,
    status: str,
    message: str | None,
    level: str = "info",
) -> OperationEvent:
    event = OperationEvent(
        action_type="export",
        operation_id=operation.id,
        level=level,
        status=status,
        message=message,
        payload={},
        processed_rows=operation.processed_rows,
        total_rows=operation.total_rows,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def create_export_operation(
    db: Session,
    *,
    tables: list[str],
    fmt: str,
    cutoff: date | None = None,
) -> ExportOperation:
    selected = [table for table in tables if table]
    invalid = sorted(set(selected) - ALLOWED_TABLES)
    if invalid:
        raise ValueError(f"Unknown export table(s): {', '.join(invalid)}")
    if fmt not in {"xlsx", "csv"}:
        raise ValueError("Export format must be xlsx or csv.")

    operation = ExportOperation(
        export_type="manual",
        filters={"tables": selected or ["employees", "departments"], "format": fmt, "cutoff": cutoff.isoformat() if cutoff else None},
        status="pending",
    )
    db.add(operation)
    db.commit()
    db.refresh(operation)
    _record_event(db, operation=operation, status="pending", message="Export queued.")
    return operation


def _employee_rows(db: Session, cutoff: date | None) -> list[dict[str, Any]]:
    employees = list_employees(db, cutoff=cutoff, limit=10000)
    return [employee.model_dump(mode="json") for employee in employees]


def _department_rows(db: Session) -> list[dict[str, Any]]:
    rows = db.query(OrganizationUnit).order_by(OrganizationUnit.unit_type, OrganizationUnit.name).all()
    return [
        {
            "id": row.id,
            "parent_id": row.parent_id,
            "unit_type": row.unit_type,
            "name": row.name,
            "is_active": row.is_active,
        }
        for row in rows
    ]


def _people_rows(db: Session) -> list[dict[str, Any]]:
    rows = db.query(Person).order_by(Person.full_name).all()
    return [{"id": row.id, "full_name": row.full_name, "created_at": row.created_at.isoformat()} for row in rows]


def _assignment_rows(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.query(EmployeeAssignment, AssignmentVersion)
        .join(AssignmentVersion, AssignmentVersion.assignment_id == EmployeeAssignment.id)
        .order_by(EmployeeAssignment.created_at)
        .all()
    )
    return [
        {
            "assignment_id": assignment.id,
            "person_id": assignment.person_id,
            "is_deleted": assignment.is_deleted,
            "version_id": version.id,
            "position_name": version.position_name,
            "status": version.status,
            "employment_type": version.employment_type,
            "hire_date": version.hire_date.isoformat(),
            "termination_date": version.termination_date.isoformat() if version.termination_date else None,
            "salary": str(version.salary) if version.salary is not None else None,
            "effective_from": version.effective_from.isoformat(),
            "effective_to": version.effective_to.isoformat() if version.effective_to else None,
            "is_current": version.is_current,
        }
        for assignment, version in rows
    ]


def _table_rows(db: Session, table: str, cutoff: date | None) -> list[dict[str, Any]]:
    if table == "employees":
        return _employee_rows(db, cutoff)
    if table == "departments":
        return _department_rows(db)
    if table == "people":
        return _people_rows(db)
    if table == "assignments":
        return _assignment_rows(db)
    return [{"note": "This section is reserved for a later detailed import quality log."}]


def _write_xlsx(path: Path, tables: dict[str, list[dict[str, Any]]]) -> None:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for table, rows in tables.items():
        sheet = workbook.create_sheet(title=table[:31])
        headers = list(rows[0].keys()) if rows else ["note"]
        sheet.append(headers)
        for row in rows:
            sheet.append([_json_value(row.get(header)) for header in headers])
    workbook.save(path)


def _write_csv_zip(path: Path, tables: dict[str, list[dict[str, Any]]]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for table, rows in tables.items():
            headers = list(rows[0].keys()) if rows else ["note"]
            buffer = StringIO()
            writer = csv.DictWriter(buffer, fieldnames=headers, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
            archive.writestr(f"{table}.csv", buffer.getvalue())


async def run_export(db: Session, operation_id: str) -> ExportOperation:
    operation = db.get(ExportOperation, operation_id)
    if not operation:
        raise RuntimeError("Export operation not found.")

    try:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        operation.status = "running"
        operation.started_at = _now()
        db.commit()
        _record_event(db, operation=operation, status="running", message="Preparing export.")

        fmt = operation.filters.get("format", "xlsx")
        cutoff_value = operation.filters.get("cutoff")
        cutoff = date.fromisoformat(cutoff_value) if cutoff_value else None
        selected_tables = operation.filters.get("tables") or ["employees", "departments"]

        tables: dict[str, list[dict[str, Any]]] = {}
        for table in selected_tables:
            rows = _table_rows(db, table, cutoff)
            tables[table] = rows
            operation.total_rows += len(rows)

        db.commit()
        for table, rows in tables.items():
            operation.processed_rows += len(rows)
            db.commit()
            _record_event(db, operation=operation, status="running", message=f"Prepared {table}.")

        suffix = "xlsx" if fmt == "xlsx" else "zip"
        path = STORAGE_DIR / f"export_{operation.id}.{suffix}"
        if fmt == "xlsx":
            _write_xlsx(path, tables)
        else:
            _write_csv_zip(path, tables)

        operation.file_path = str(path)
        operation.status = "completed"
        operation.completed_at = _now()
        db.commit()
        _record_event(db, operation=operation, status="completed", message="Export finished.")
        db.refresh(operation)
        return operation
    except Exception as exc:
        operation.status = "failed"
        operation.completed_at = _now()
        db.commit()
        _record_event(db, operation=operation, status="failed", message=str(exc), level="error")
        db.refresh(operation)
        return operation
