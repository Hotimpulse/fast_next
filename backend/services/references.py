from sqlalchemy import func
from sqlalchemy.orm import Session

from fastapi import HTTPException

from models import AssignmentVersion, EmployeeAssignment, OrganizationUnit, Person, ReferenceCatalog
from schemas import ReferenceMutationResult, ReferenceValue
from services.employees import normalize

ReferenceField = str


def _active_versions(db: Session):
    return (
        db.query(AssignmentVersion)
        .join(EmployeeAssignment, EmployeeAssignment.id == AssignmentVersion.assignment_id)
        .filter(EmployeeAssignment.is_deleted.is_(False), AssignmentVersion.is_current.is_(True))
    )


def _unit_type(field: ReferenceField) -> str:
    if field == "department_name":
        return "department"
    if field == "division_name":
        return "division"
    raise HTTPException(status_code=422, detail="Поле не является справочником подразделений.")


def _count_units(db: Session, field: ReferenceField, value: str, active_only: bool) -> int:
    unit_id = AssignmentVersion.department_id if field == "department_name" else AssignmentVersion.division_id
    query = db.query(func.count(AssignmentVersion.id)).join(OrganizationUnit, unit_id == OrganizationUnit.id)
    if active_only:
        query = query.join(EmployeeAssignment, EmployeeAssignment.id == AssignmentVersion.assignment_id).filter(
            EmployeeAssignment.is_deleted.is_(False),
            AssignmentVersion.is_current.is_(True),
        )
    return int(query.filter(OrganizationUnit.unit_type == _unit_type(field), OrganizationUnit.name == value).scalar() or 0)


def _count_positions(db: Session, value: str, active_only: bool) -> int:
    query = db.query(func.count(AssignmentVersion.id))
    if active_only:
        query = query.join(EmployeeAssignment, EmployeeAssignment.id == AssignmentVersion.assignment_id).filter(
            EmployeeAssignment.is_deleted.is_(False),
            AssignmentVersion.is_current.is_(True),
        )
    return int(query.filter(AssignmentVersion.position_name == value).scalar() or 0)


def _count_managers(db: Session, value: str, active_only: bool) -> int:
    query = db.query(func.count(AssignmentVersion.id)).join(Person, AssignmentVersion.manager_person_id == Person.id)
    if active_only:
        query = query.join(EmployeeAssignment, EmployeeAssignment.id == AssignmentVersion.assignment_id).filter(
            EmployeeAssignment.is_deleted.is_(False),
            AssignmentVersion.is_current.is_(True),
        )
    return int(query.filter(Person.full_name == value).scalar() or 0)


def _catalog_values(db: Session, field: ReferenceField) -> list[str]:
    return [
        row[0]
        for row in (
            db.query(ReferenceCatalog.value)
            .filter(ReferenceCatalog.field == field, ReferenceCatalog.is_active.is_(True))
            .distinct()
            .order_by(ReferenceCatalog.value)
            .all()
        )
    ]


def _activate_catalog_value(db: Session, field: ReferenceField, value: str) -> ReferenceCatalog:
    catalog = (
        db.query(ReferenceCatalog)
        .filter(ReferenceCatalog.field == field, ReferenceCatalog.value == value)
        .first()
    )
    if catalog:
        catalog.is_active = True
        return catalog
    catalog = ReferenceCatalog(field=field, value=value, is_active=True)
    db.add(catalog)
    db.flush()
    return catalog


def _deactivate_catalog_value(db: Session, field: ReferenceField, value: str) -> int:
    rows = (
        db.query(ReferenceCatalog)
        .filter(ReferenceCatalog.field == field, ReferenceCatalog.value == value, ReferenceCatalog.is_active.is_(True))
        .update({ReferenceCatalog.is_active: False}, synchronize_session=False)
    )
    return int(rows or 0)


def _ordered_values(values: set[str]) -> list[str]:
    return sorted(values, key=lambda item: item.casefold())


def list_reference_values(db: Session, field: ReferenceField, include_inactive: bool = True) -> list[ReferenceValue]:
    if field in {"department_name", "division_name"}:
        values = {
            row[0]
            for row in (
                db.query(OrganizationUnit.name)
                .filter(OrganizationUnit.unit_type == _unit_type(field), OrganizationUnit.is_active.is_(True))
                .distinct()
                .order_by(OrganizationUnit.name)
                .all()
            )
        }
        rows = [
            ReferenceValue(
                field=field,
                value=value,
                total_count=_count_units(db, field, value, active_only=False),
                active_count=_count_units(db, field, value, active_only=True),
            )
            for value in _ordered_values(values)
        ]
    elif field == "position_name":
        historical_values = {
            row[0]
            for row in db.query(AssignmentVersion.position_name).distinct().order_by(AssignmentVersion.position_name).all()
        }
        values = set(_catalog_values(db, field))
        values.update(value for value in historical_values if _count_positions(db, value, active_only=True) > 0)
        rows = [
            ReferenceValue(
                field=field,
                value=value,
                total_count=_count_positions(db, value, active_only=False),
                active_count=_count_positions(db, value, active_only=True),
            )
            for value in _ordered_values(values)
        ]
    elif field == "manager_name":
        historical_values = {
            row[0]
            for row in (
                db.query(Person.full_name)
                .join(AssignmentVersion, AssignmentVersion.manager_person_id == Person.id)
                .distinct()
                .order_by(Person.full_name)
                .all()
            )
        }
        values = set(_catalog_values(db, field))
        values.update(value for value in historical_values if _count_managers(db, value, active_only=True) > 0)
        rows = [
            ReferenceValue(
                field=field,
                value=value,
                total_count=_count_managers(db, value, active_only=False),
                active_count=_count_managers(db, value, active_only=True),
            )
            for value in _ordered_values(values)
        ]
    else:
        raise HTTPException(status_code=422, detail="Неподдерживаемое поле справочника.")

    return rows


def create_reference(
    db: Session,
    field: ReferenceField,
    value: str,
    parent_value: str | None = None,
) -> ReferenceMutationResult:
    value = normalize(value)
    parent_value = normalize(parent_value) if parent_value else None

    if field == "department_name":
        unit = (
            db.query(OrganizationUnit)
            .filter(OrganizationUnit.unit_type == "department", OrganizationUnit.name == value)
            .first()
        )
        if unit:
            unit.is_active = True
        else:
            db.add(
                OrganizationUnit(
                    unit_type="department",
                    name=value,
                    parent_id=None,
                )
            )
    elif field == "division_name":
        parent_id = None
        if parent_value:
            parent = (
                db.query(OrganizationUnit)
                .filter(OrganizationUnit.unit_type == "department", OrganizationUnit.name == parent_value)
                .first()
            )
            if not parent:
                parent = OrganizationUnit(
                    unit_type="department",
                    name=parent_value,
                    parent_id=None,
                )
                db.add(parent)
                db.flush()
            parent.is_active = True
            parent_id = parent.id
        unit = (
            db.query(OrganizationUnit)
            .filter(OrganizationUnit.unit_type == "division", OrganizationUnit.name == value, OrganizationUnit.parent_id == parent_id)
            .first()
        )
        if unit:
            unit.is_active = True
        else:
            db.add(
                OrganizationUnit(
                    unit_type="division",
                    name=value,
                    parent_id=parent_id,
                )
            )
    elif field == "position_name":
        _activate_catalog_value(db, field, value)
    elif field == "manager_name":
        _activate_catalog_value(db, field, value)
        if not db.query(Person).filter(Person.full_name == value).first():
            db.add(Person(full_name=value))
    else:
        raise HTTPException(status_code=422, detail="Неподдерживаемое поле справочника.")

    db.commit()
    return ReferenceMutationResult(field=field, old_value="", new_value=value, updated_rows=0, removed_items=0)


def _delete_unit_if_unused(db: Session, unit: OrganizationUnit) -> int:
    refs = (
        db.query(func.count(AssignmentVersion.id))
        .filter((AssignmentVersion.department_id == unit.id) | (AssignmentVersion.division_id == unit.id))
        .scalar()
        or 0
    )
    children = db.query(func.count(OrganizationUnit.id)).filter(OrganizationUnit.parent_id == unit.id).scalar() or 0
    if refs or children:
        unit.is_active = False
        return 0
    db.delete(unit)
    return 1


def _merge_child_divisions(db: Session, old_parent_id: str, new_parent_id: str) -> int:
    removed = 0
    children = db.query(OrganizationUnit).filter(OrganizationUnit.parent_id == old_parent_id).all()
    for child in children:
        target = (
            db.query(OrganizationUnit)
            .filter(
                OrganizationUnit.unit_type == "division",
                OrganizationUnit.parent_id == new_parent_id,
                OrganizationUnit.name == child.name,
            )
            .first()
        )
        if target and target.id != child.id:
            updated = (
                db.query(AssignmentVersion)
                .filter(AssignmentVersion.division_id == child.id)
                .update({AssignmentVersion.division_id: target.id}, synchronize_session=False)
            )
            removed += _delete_unit_if_unused(db, child)
            if updated == 0:
                child.is_active = False
        else:
            child.parent_id = new_parent_id
            child.is_active = True
    return removed


def rename_reference(db: Session, field: ReferenceField, old_value: str, new_value: str) -> ReferenceMutationResult:
    old_value = normalize(old_value)
    new_value = normalize(new_value)
    if old_value == new_value:
        raise HTTPException(status_code=422, detail="Старое и новое значения совпадают.")

    updated_rows = 0
    removed_items = 0

    if field in {"department_name", "division_name"}:
        id_column = AssignmentVersion.department_id if field == "department_name" else AssignmentVersion.division_id
        units = (
            db.query(OrganizationUnit)
            .filter(OrganizationUnit.unit_type == _unit_type(field), OrganizationUnit.name == old_value)
            .all()
        )
        if not units:
            raise HTTPException(status_code=404, detail="Значение справочника не найдено.")

        for unit in units:
            target = (
                db.query(OrganizationUnit)
                .filter(
                    OrganizationUnit.unit_type == unit.unit_type,
                    OrganizationUnit.parent_id == unit.parent_id,
                    OrganizationUnit.name == new_value,
                )
                .first()
            )
            if target and target.id != unit.id:
                if unit.unit_type == "department":
                    removed_items += _merge_child_divisions(db, unit.id, target.id)
                updated_rows += (
                    db.query(AssignmentVersion)
                    .filter(id_column == unit.id)
                    .update({id_column: target.id}, synchronize_session=False)
                )
                target.is_active = True
                removed_items += _delete_unit_if_unused(db, unit)
            else:
                updated_rows += db.query(AssignmentVersion).filter(id_column == unit.id).count()
                unit.name = new_value
                unit.is_active = True
    elif field == "position_name":
        updated_rows = (
            db.query(AssignmentVersion)
            .filter(AssignmentVersion.position_name == old_value)
            .update({AssignmentVersion.position_name: new_value}, synchronize_session=False)
        )
        catalog_rows = (
            db.query(ReferenceCatalog)
            .filter(ReferenceCatalog.field == field, ReferenceCatalog.value == old_value)
            .update({ReferenceCatalog.value: new_value, ReferenceCatalog.is_active: True}, synchronize_session=False)
        )
        if updated_rows == 0 and catalog_rows == 0:
            raise HTTPException(status_code=404, detail="Значение справочника не найдено.")
        _activate_catalog_value(db, field, new_value)
    elif field == "manager_name":
        people = db.query(Person).filter(Person.full_name == old_value).all()
        catalog_rows = (
            db.query(ReferenceCatalog)
            .filter(ReferenceCatalog.field == field, ReferenceCatalog.value == old_value)
            .update({ReferenceCatalog.value: new_value, ReferenceCatalog.is_active: True}, synchronize_session=False)
        )
        if not people and catalog_rows == 0:
            raise HTTPException(status_code=404, detail="Значение справочника не найдено.")
        target = db.query(Person).filter(Person.full_name == new_value).first()
        if not target:
            target = Person(full_name=new_value)
            db.add(target)
            db.flush()
        for person in people:
            updated_rows += (
                db.query(AssignmentVersion)
                .filter(AssignmentVersion.manager_person_id == person.id)
                .update({AssignmentVersion.manager_person_id: target.id}, synchronize_session=False)
            )
        _activate_catalog_value(db, field, new_value)
    else:
        raise HTTPException(status_code=422, detail="Неподдерживаемое поле справочника.")

    db.commit()
    return ReferenceMutationResult(
        field=field,
        old_value=old_value,
        new_value=new_value,
        updated_rows=updated_rows,
        removed_items=removed_items,
    )


def remove_reference(db: Session, field: ReferenceField, value: str) -> ReferenceMutationResult:
    value = normalize(value)

    active_count = list_reference_values(db, field, include_inactive=True)
    row = next((item for item in active_count if item.value == value), None)
    if not row:
        raise HTTPException(status_code=404, detail="Значение справочника не найдено.")
    if row.active_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Нельзя удалить значение, которое используется активными сотрудниками. Сначала переименуйте его.",
        )

    removed_items = 0
    if field in {"department_name", "division_name"}:
        units = (
            db.query(OrganizationUnit)
            .filter(OrganizationUnit.unit_type == _unit_type(field), OrganizationUnit.name == value)
            .all()
        )
        for unit in units:
            removed_items += _delete_unit_if_unused(db, unit)
    elif field == "manager_name":
        removed_items += _deactivate_catalog_value(db, field, value)
        people = db.query(Person).filter(Person.full_name == value).all()
        for person in people:
            employee_refs = db.query(func.count(EmployeeAssignment.id)).filter(EmployeeAssignment.person_id == person.id).scalar() or 0
            manager_refs = db.query(func.count(AssignmentVersion.id)).filter(AssignmentVersion.manager_person_id == person.id).scalar() or 0
            if not employee_refs and not manager_refs:
                db.delete(person)
                removed_items += 1
    elif field == "position_name":
        removed_items += _deactivate_catalog_value(db, field, value)
    elif field != "position_name":
        raise HTTPException(status_code=422, detail="Неподдерживаемое поле справочника.")

    db.commit()
    return ReferenceMutationResult(field=field, old_value=value, updated_rows=0, removed_items=removed_items)
