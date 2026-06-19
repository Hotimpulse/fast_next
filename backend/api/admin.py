from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from schemas import ClearDatabaseResult
from services.admin import clear_database

router = APIRouter(tags=["admin"])


@router.post("/admin/clear-db", response_model=ClearDatabaseResult)
def clear_db(db: Session = Depends(get_db)) -> ClearDatabaseResult:
    deleted = clear_database(db)
    return ClearDatabaseResult(deleted=deleted, total_deleted=sum(deleted.values()))
