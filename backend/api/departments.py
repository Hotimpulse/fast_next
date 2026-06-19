from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from models import AssignmentVersion, EmployeeAssignment, OrganizationUnit
from schemas import DepartmentRead

router = APIRouter(tags=["departments"])

def _used_unit_ids(db: Session) -> set[str]:
    rows = (
        db.query(AssignmentVersion.department_id, AssignmentVersion.division_id)
        .join(EmployeeAssignment, EmployeeAssignment.id == AssignmentVersion.assignment_id)
        .filter(EmployeeAssignment.is_deleted.is_(False), AssignmentVersion.is_current.is_(True))
        .all()
    )
    return {unit_id for row in rows for unit_id in row if unit_id}


@router.get("/departments", response_model=list[DepartmentRead])
def get_departments(
    unit_type: str | None = None,
    include_unused: bool = False,
    db: Session = Depends(get_db),
) -> list[OrganizationUnit]:
    query = db.query(OrganizationUnit).filter(OrganizationUnit.is_active.is_(True))
    if unit_type:
        query = query.filter(OrganizationUnit.unit_type == unit_type)
    if not include_unused:
        used_ids = _used_unit_ids(db)
        if not used_ids:
            return []
        query = query.filter(OrganizationUnit.id.in_(used_ids))
    return query.order_by(OrganizationUnit.unit_type, OrganizationUnit.name).all()
