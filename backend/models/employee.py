import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base

def uuid_str() -> str:
    return str(uuid.uuid4())

class OrganizationUnit(Base):
    __tablename__ = "organization_units"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("organization_units.id"), nullable=True)
    unit_type: Mapped[str] = mapped_column(String(100)) # department | division
    name: Mapped[str] = mapped_column(String(300), index=True)
    display_name: Mapped[str | None] = mapped_column(String(300))
    source_name: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Person(Base):
    __tablename__ = "people"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    full_name: Mapped[str] = mapped_column(String(300), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmployeeAssignment(Base):
    __tablename__ = "employee_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    person_id: Mapped[str] = mapped_column(ForeignKey("people.id"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    person = relationship("Person")
    versions = relationship("AssignmentVersion", cascade="all, delete-orphan")


class AssignmentVersion(Base):
    __tablename__ = "assignment_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    assignment_id: Mapped[str] = mapped_column(ForeignKey("employee_assignments.id"))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("organization_units.id"))
    division_id: Mapped[str | None] = mapped_column(ForeignKey("organization_units.id"))
    manager_person_id: Mapped[str | None] = mapped_column(ForeignKey("people.id"))

    position_name: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(100))
    employment_type: Mapped[str] = mapped_column(String(100))
    hire_date: Mapped[date] = mapped_column(Date)
    termination_date: Mapped[date | None] = mapped_column(Date)
    salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    department = relationship("OrganizationUnit", foreign_keys=[department_id])
    division = relationship("OrganizationUnit", foreign_keys=[division_id])
    manager = relationship("Person", foreign_keys=[manager_person_id])


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    original_filename: Mapped[str] = mapped_column(String(500))
    stored_filename: Mapped[str] = mapped_column(String(500))
    file_sha256: Mapped[str] = mapped_column(String(64))
    source_sheet_name: Mapped[str] = mapped_column(String(200))
    source_cutoff_date: Mapped[date | None] = mapped_column(Date)
    import_mode: Mapped[str] = mapped_column(String(50), default="upsert_current")
    status: Mapped[str] = mapped_column(String(50), default="pending")
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, default=0)
    inserted_rows: Mapped[int] = mapped_column(Integer, default=0)
    updated_rows: Mapped[int] = mapped_column(Integer, default=0)
    unchanged_rows: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    options: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str | None] = mapped_column(String(200))

class ExportOperation(Base):
    __tablename__ = "export_operations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    requested_by: Mapped[str | None] = mapped_column(String(200))
    export_type: Mapped[str] = mapped_column(String(50), default="manual")
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    file_path: Mapped[str | None] = mapped_column(String(1000))
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OperationEvent(Base):
    __tablename__ = "operation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_type: Mapped[str] = mapped_column(String(20)) # import | export
    operation_id: Mapped[str] = mapped_column(String, index=True)
    level: Mapped[str] = mapped_column(String(20), default="info")
    status: Mapped[str] = mapped_column(String(50))
    message: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    processed_rows: Mapped[int | None] = mapped_column(Integer)
    total_rows: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
