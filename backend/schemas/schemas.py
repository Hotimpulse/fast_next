from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ActionEventRead(ORMModel):
    id: int
    action_type: str
    level: str
    status: str
    message: str | None
    payload: dict[str, Any]
    processed_rows: int | None
    total_rows: int | None
    created_at: datetime


class ImportBatchRead(ORMModel):
    id: str
    original_filename: str
    stored_filename: str | None
    file_sha256: str
    source_sheet_name: str | None
    source_cutoff_date: date | None
    import_mode: str
    status: str
    total_rows: int
    processed_rows: int
    inserted_rows: int
    updated_rows: int
    unchanged_rows: int
    warning_count: int
    error_count: int
    options: dict[str, Any]
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    created_by: str | None


class ImportResult(ImportBatchRead):
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class DepartmentRead(ORMModel):
    id: str
    parent_id: str | None
    unit_type: str
    name: str
    display_name: str | None
    source_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeRead(BaseModel):
    assignment_id: str
    assignment_version_id: str
    person_id: str
    full_name: str
    department_id: str | None
    department_name: str | None
    division_id: str | None
    division_name: str | None
    position_name: str
    manager_person_id: str | None
    manager_name: str | None
    status: str
    employment_type: str
    hire_date: date
    termination_date: date | None
    salary: Decimal | None
    effective_from: date
    effective_to: date | None
    is_current: bool


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=300)
    department_name: str = Field(min_length=1, max_length=300)
    division_name: str | None = Field(default=None, max_length=300)
    position_name: str = Field(min_length=1, max_length=300)
    manager_name: str | None = Field(default=None, max_length=300)
    status: str = Field(default="Работает", min_length=1, max_length=100)
    employment_type: str = Field(default="Штатный сотрудник", min_length=1, max_length=100)
    hire_date: date
    termination_date: date | None = None
    salary: Decimal | None = Field(default=None, ge=0)
    effective_from: date | None = None

    @field_validator("full_name", "department_name", "division_name", "position_name", "manager_name", "status", "employment_type")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        return value or None

    @model_validator(mode="after")
    def validate_dates(self) -> "EmployeeCreate":
        if self.termination_date and self.termination_date < self.hire_date:
            raise ValueError("termination_date cannot be earlier than hire_date")
        return self


class EmployeePatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=300)
    department_name: str | None = Field(default=None, min_length=1, max_length=300)
    division_name: str | None = Field(default=None, max_length=300)
    position_name: str | None = Field(default=None, min_length=1, max_length=300)
    manager_name: str | None = Field(default=None, max_length=300)
    status: str | None = Field(default=None, min_length=1, max_length=100)
    employment_type: str | None = Field(default=None, min_length=1, max_length=100)
    hire_date: date | None = None
    termination_date: date | None = None
    salary: Decimal | None = Field(default=None, ge=0)
    effective_from: date | None = None

    @field_validator("full_name", "department_name", "division_name", "position_name", "manager_name", "status", "employment_type")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return " ".join(value.split()) or None


class ExportRequest(BaseModel):
    tables: list[Literal["employees", "departments", "people", "assignments", "import_rows", "data_quality_issues"]] = [
        "employees",
        "departments",
    ]
    format: Literal["xlsx", "csv"] = "xlsx"
    cutoff: date | None = None


class ExportAction(ORMModel):
    id: str
    requested_by: str | None
    export_type: str
    filters: dict[str, Any]
    status: str
    file_path: str | None
    total_rows: int
    processed_rows: int
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    download_url: str | None = None


class ExportOperationRead(ExportAction):
    pass
