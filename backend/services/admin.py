from sqlalchemy.orm import Session

from models import (
    AssignmentVersion,
    EmployeeAssignment,
    ExportOperation,
    ImportBatch,
    OperationEvent,
    OrganizationUnit,
    Person,
    ReferenceCatalog,
)


def clear_database(db: Session) -> dict[str, int]:
    deleted: dict[str, int] = {}

    deleted["operation_events"] = db.query(OperationEvent).delete(synchronize_session=False)
    deleted["reference_catalog"] = db.query(ReferenceCatalog).delete(synchronize_session=False)
    deleted["assignment_versions"] = db.query(AssignmentVersion).delete(synchronize_session=False)
    deleted["employee_assignments"] = db.query(EmployeeAssignment).delete(synchronize_session=False)
    deleted["organization_units"] = db.query(OrganizationUnit).delete(synchronize_session=False)
    deleted["people"] = db.query(Person).delete(synchronize_session=False)
    deleted["import_batches"] = db.query(ImportBatch).delete(synchronize_session=False)
    deleted["export_operations"] = db.query(ExportOperation).delete(synchronize_session=False)

    db.commit()
    return deleted
