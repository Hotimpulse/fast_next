from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from models import OrganizationUnit
from schemas import DepartmentRead

router = APIRouter(tags=["departments"])

@router.get("/departments", response_model=list[DepartmentRead])
def get_departments(unit_type: str | None = None, db: Session = Depends(get_db)) -> list[OrganizationUnit]:
    query = db.query(OrganizationUnit)
    if unit_type:
        query = query.filter(OrganizationUnit.unit_type == unit_type)
    return query.order_by(OrganizationUnit.unit_type, OrganizationUnit.name).all()
