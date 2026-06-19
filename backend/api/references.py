from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from schemas import ReferenceCreateRequest, ReferenceMutationResult, ReferenceRemoveRequest, ReferenceRenameRequest, ReferenceValue
from services.references import create_reference, list_reference_values, remove_reference, rename_reference

router = APIRouter(tags=["references"])


@router.get("/references", response_model=list[ReferenceValue])
def references(field: str, include_inactive: bool = True, db: Session = Depends(get_db)) -> list[ReferenceValue]:
    return list_reference_values(db, field, include_inactive=include_inactive)


@router.post("/references", response_model=ReferenceMutationResult)
def create(payload: ReferenceCreateRequest, db: Session = Depends(get_db)) -> ReferenceMutationResult:
    return create_reference(db, payload.field, payload.value, payload.parent_value)


@router.patch("/references/rename", response_model=ReferenceMutationResult)
def rename(payload: ReferenceRenameRequest, db: Session = Depends(get_db)) -> ReferenceMutationResult:
    return rename_reference(db, payload.field, payload.old_value, payload.new_value)


@router.delete("/references", response_model=ReferenceMutationResult)
def remove(payload: ReferenceRemoveRequest, db: Session = Depends(get_db)) -> ReferenceMutationResult:
    return remove_reference(db, payload.field, payload.value)
