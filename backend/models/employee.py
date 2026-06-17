from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.database import Base

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column()