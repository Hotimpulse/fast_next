from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from models.employee import AssignmentVersion, EmployeeAssignment, OrganizationUnit, Person, ReferenceCatalog
from schemas.schemas import EmployeeCreate, EmployeePatch, EmployeeRead


def _today() -> date:
    return date.today()


def normalize(value: str) -> str:
    return " ".join(value.split()).strip()


def _activate_reference_catalog(db: Session, field: str, value: str | None) -> None:
    if not value:
        return
    value = normalize(value)
    catalog = (
        db.query(ReferenceCatalog)
        .filter(ReferenceCatalog.field == field, ReferenceCatalog.value == value)
        .first()
    )
    if catalog:
        catalog.is_active = True
        return
    db.add(ReferenceCatalog(field=field, value=value, is_active=True))
    db.flush()


def _get_or_create_person(db: Session, full_name: str | None) -> Person | None:
    if not full_name:
        return None

    full_name = normalize(full_name)
    person = db.query(Person).filter(Person.full_name == full_name).first()
    if person:
        return person

    person = Person(full_name=full_name)
    db.add(person)
    db.flush()
    return person


def _get_unassigned_person(db: Session, full_name: str | None) -> Person | None:
    if not full_name:
        return None

    full_name = normalize(full_name)
    return (
        db.query(Person)
        .outerjoin(EmployeeAssignment, EmployeeAssignment.person_id == Person.id)
        .filter(Person.full_name == full_name, EmployeeAssignment.id.is_(None))
        .first()
    )


def _create_employee_person(db: Session, full_name: str) -> Person:
    person = _get_unassigned_person(db, full_name)
    if person:
        return person

    person = Person(full_name=normalize(full_name))
    db.add(person)
    db.flush()
    return person


def _get_or_create_unit(
    db: Session,
    name: str | None,
    unit_type: str,
    parent_id: str | None = None,
) -> OrganizationUnit | None:
    if not name:
        return None

    name = normalize(name)
    unit = (
        db.query(OrganizationUnit)
        .filter(
            OrganizationUnit.name == name,
            OrganizationUnit.unit_type == unit_type,
            OrganizationUnit.parent_id == parent_id,
        )
        .first()
    )
    if unit:
        unit.is_active = True
        return unit

    unit = OrganizationUnit(
        name=name,
        unit_type=unit_type,
        parent_id=parent_id,
    )
    db.add(unit)
    db.flush()
    return unit


def _employee_read(assignment: EmployeeAssignment, version: AssignmentVersion) -> EmployeeRead:
    return EmployeeRead(
        assignment_id=assignment.id,
        assignment_version_id=version.id,
        person_id=assignment.person_id,
        full_name=assignment.person.full_name,
        department_id=version.department_id,
        department_name=version.department.name if version.department else None,
        division_id=version.division_id,
        division_name=version.division.name if version.division else None,
        position_name=version.position_name,
        manager_person_id=version.manager_person_id,
        manager_name=version.manager.full_name if version.manager else None,
        status=version.status,
        employment_type=version.employment_type,
        hire_date=version.hire_date,
        termination_date=version.termination_date,
        salary=version.salary,
        effective_from=version.effective_from,
        effective_to=version.effective_to,
        is_current=version.is_current,
    )


def _base_employee_query(db: Session, cutoff: date | None):
    query = (
        db.query(EmployeeAssignment, AssignmentVersion)
        .join(AssignmentVersion, AssignmentVersion.assignment_id == EmployeeAssignment.id)
        .join(Person, Person.id == EmployeeAssignment.person_id)
        .options(
            joinedload(EmployeeAssignment.person),
            joinedload(AssignmentVersion.department),
            joinedload(AssignmentVersion.division),
            joinedload(AssignmentVersion.manager),
        )
        .filter(EmployeeAssignment.is_deleted.is_(False))
    )

    if cutoff is None:
        return query.filter(AssignmentVersion.is_current.is_(True))

    return (
        query.filter(AssignmentVersion.effective_from <= cutoff)
        .filter(or_(AssignmentVersion.effective_to.is_(None), AssignmentVersion.effective_to > cutoff))
        .filter(AssignmentVersion.hire_date <= cutoff)
        .filter(or_(AssignmentVersion.termination_date.is_(None), AssignmentVersion.termination_date >= cutoff))
    )


def list_employees(
    db: Session,
    *,
    search: str | None = None,
    department_id: str | None = None,
    division_id: str | None = None,
    status: str | None = None,
    cutoff: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[EmployeeRead]:
    query = _base_employee_query(db, cutoff)

    if search:
        query = query.filter(Person.full_name.ilike(f"%{normalize(search)}%"))
    if department_id:
        query = query.filter(AssignmentVersion.department_id == department_id)
    if division_id:
        query = query.filter(AssignmentVersion.division_id == division_id)
    if status:
        query = query.filter(AssignmentVersion.status == normalize(status))

    rows = query.order_by(Person.full_name).offset(skip).limit(limit).all()
    return [_employee_read(assignment, version) for assignment, version in rows]


def get_employee(db: Session, assignment_id: str, *, cutoff: date | None = None) -> EmployeeRead:
    row = (
        _base_employee_query(db, cutoff)
        .filter(EmployeeAssignment.id == assignment_id)
        .order_by(AssignmentVersion.effective_from.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Запись сотрудника не найдена.")

    assignment, version = row
    return _employee_read(assignment, version)


def create_employee(db: Session, payload: EmployeeCreate) -> EmployeeRead:
    department = _get_or_create_unit(db, payload.department_name, "department")
    division = _get_or_create_unit(
        db,
        payload.division_name,
        "division",
        parent_id=department.id if department else None,
    )
    person = _create_employee_person(db, payload.full_name)
    manager = _get_or_create_person(db, payload.manager_name)
    _activate_reference_catalog(db, "position_name", payload.position_name)
    _activate_reference_catalog(db, "manager_name", payload.manager_name)
    effective_from = payload.effective_from or payload.hire_date

    assignment = EmployeeAssignment(person_id=person.id)
    db.add(assignment)
    db.flush()

    version = AssignmentVersion(
        assignment_id=assignment.id,
        department_id=department.id if department else None,
        division_id=division.id if division else None,
        manager_person_id=manager.id if manager else None,
        position_name=payload.position_name,
        status=payload.status,
        employment_type=payload.employment_type,
        hire_date=payload.hire_date,
        termination_date=payload.termination_date,
        salary=Decimal(str(payload.salary)),
        effective_from=effective_from,
        effective_to=None,
        is_current=True,
    )
    db.add(version)
    db.commit()
    db.refresh(assignment)
    db.refresh(version)
    return _employee_read(assignment, version)


def patch_employee(db: Session, assignment_id: str, payload: EmployeePatch) -> EmployeeRead:
    assignment = (
        db.query(EmployeeAssignment)
        .options(joinedload(EmployeeAssignment.person))
        .filter(EmployeeAssignment.id == assignment_id, EmployeeAssignment.is_deleted.is_(False))
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Запись сотрудника не найдена.")

    current = (
        db.query(AssignmentVersion)
        .options(
            joinedload(AssignmentVersion.department),
            joinedload(AssignmentVersion.division),
            joinedload(AssignmentVersion.manager),
        )
        .filter(AssignmentVersion.assignment_id == assignment_id, AssignmentVersion.is_current.is_(True))
        .first()
    )
    if not current:
        raise HTTPException(status_code=404, detail="Текущая версия записи сотрудника не найдена.")

    fields = payload.model_fields_set
    effective_from = payload.effective_from or _today()
    hire_date = payload.hire_date or current.hire_date
    termination_date = payload.termination_date if "termination_date" in fields else current.termination_date

    if termination_date and termination_date < hire_date:
        raise HTTPException(status_code=422, detail="Дата увольнения не может быть раньше даты приема на работу.")

    if "full_name" in fields and payload.full_name:
        assignment.person.full_name = payload.full_name

    department_name = payload.department_name if "department_name" in fields else (
        current.department.name if current.department else None
    )
    division_name = payload.division_name if "division_name" in fields else (
        current.division.name if current.division else None
    )
    manager_name = payload.manager_name if "manager_name" in fields else (
        current.manager.full_name if current.manager else None
    )

    department = _get_or_create_unit(db, department_name, "department")
    division = _get_or_create_unit(
        db,
        division_name,
        "division",
        parent_id=department.id if department else None,
    )
    manager = _get_or_create_person(db, manager_name)
    _activate_reference_catalog(db, "position_name", payload.position_name or current.position_name)
    _activate_reference_catalog(db, "manager_name", manager_name)

    current.is_current = False
    current.effective_to = effective_from

    version = AssignmentVersion(
        assignment_id=assignment.id,
        department_id=department.id if department else None,
        division_id=division.id if division else None,
        manager_person_id=manager.id if manager else None,
        position_name=payload.position_name or current.position_name,
        status=payload.status or current.status,
        employment_type=payload.employment_type or current.employment_type,
        hire_date=hire_date,
        termination_date=termination_date,
        salary=(
            Decimal(str(payload.salary))
            if "salary" in fields
            else current.salary
        ),
        effective_from=effective_from,
        effective_to=None,
        is_current=True,
    )
    db.add(version)
    db.commit()
    db.refresh(assignment)
    db.refresh(version)
    return _employee_read(assignment, version)


def delete_employee(db: Session, assignment_id: str) -> None:
    assignment = (
        db.query(EmployeeAssignment)
        .filter(EmployeeAssignment.id == assignment_id, EmployeeAssignment.is_deleted.is_(False))
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Запись сотрудника не найдена.")

    assignment.is_deleted = True
    current = (
        db.query(AssignmentVersion)
        .filter(AssignmentVersion.assignment_id == assignment_id, AssignmentVersion.is_current.is_(True))
        .first()
    )
    if current:
        current.is_current = False
        current.effective_to = _today()
    db.commit()
