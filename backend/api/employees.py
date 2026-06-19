from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from db.database import get_db
from schemas.schemas import EmployeeCreate, EmployeePatch, EmployeeRead
from services.employees import create_employee, delete_employee, get_employee, list_employees, patch_employee

router = APIRouter(tags=["employees"])


@router.get("/employees", response_model=list[EmployeeRead])
def employees(
    search: str | None = None,
    department_id: str | None = None,
    division_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    cutoff: date | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[EmployeeRead]:
    return list_employees(
        db,
        search=search,
        department_id=department_id,
        division_id=division_id,
        status=status_filter,
        cutoff=cutoff,
        skip=offset,
        limit=limit,
    )


@router.get("/employees/{assignment_id}", response_model=EmployeeRead)
def employee(
    assignment_id: str,
    cutoff: date | None = None,
    db: Session = Depends(get_db),
) -> EmployeeRead:
    return get_employee(db, assignment_id, cutoff=cutoff)


@router.post("/employees", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create(payload: EmployeeCreate, db: Session = Depends(get_db)) -> EmployeeRead:
    return create_employee(db, payload)


@router.patch("/employees/{assignment_id}", response_model=EmployeeRead)
def patch(assignment_id: str, payload: EmployeePatch, db: Session = Depends(get_db)) -> EmployeeRead:
    return patch_employee(db, assignment_id, payload)


@router.delete("/employees/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(assignment_id: str, db: Session = Depends(get_db)) -> Response:
    delete_employee(db, assignment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
