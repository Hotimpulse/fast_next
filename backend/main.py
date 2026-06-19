from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from api import admin, departments, employees, exports, imports, references
from core.config import settings
from db.database import Base, engine

from models import *

Base.metadata.create_all(bind=engine)

FIELD_LABELS = {
    "body": "Тело запроса",
    "query": "Параметр запроса",
    "cutoff": "Дата среза",
    "search": "Поиск",
    "department_id": "Департамент",
    "status": "Статус",
    "offset": "Смещение",
    "limit": "Лимит",
    "full_name": "ФИО сотрудника",
    "department_name": "Департамент",
    "division_name": "Отдел",
    "position_name": "Должность",
    "manager_name": "Руководитель",
    "hire_date": "Дата приема на работу",
    "termination_date": "Дата увольнения",
    "employment_type": "Штат",
    "salary": "Зарплата",
    "tables": "Таблицы",
    "format": "Формат",
}


def _field_label(location: tuple | list) -> str:
    field = next((item for item in reversed(location) if isinstance(item, str)), "")
    return FIELD_LABELS.get(field, field or "Поле")


def _validation_error_message(error: dict) -> str:
    label = _field_label(error.get("loc", ()))
    error_type = str(error.get("type", ""))

    if error_type == "missing":
        return f"Поле «{label}» обязательно."
    if "date" in error_type:
        return f"Поле «{label}» должно быть датой в формате ДД-MM-ГГГГ."
    if error_type in {"string_too_short", "too_short"}:
        return f"Поле «{label}» не должно быть пустым."
    if error_type in {"greater_than_equal", "greater_than"}:
        return f"Поле «{label}» должно быть не меньше допустимого значения."
    if error_type in {"less_than_equal", "less_than"}:
        return f"Поле «{label}» превышает допустимое значение."
    if "decimal" in error_type or "int" in error_type or "float" in error_type:
        return f"Поле «{label}» должно быть числом."
    if error_type == "literal_error":
        return f"Поле «{label}» содержит неподдерживаемое значение."
    if error_type == "value_error":
        message = str(error.get("msg", "Некорректное значение."))
        return message.replace("Value error, ", "")

    return f"Поле «{label}» заполнено некорректно."

app = FastAPI(
    title="Next_Fast_Analyzer",
    description="API to import/export xlsb docs",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError) -> JSONResponse:
    messages = [_validation_error_message(error) for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": " ".join(messages)})

# Routes

app.include_router(imports.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(exports.router)
app.include_router(references.router)
app.include_router(admin.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
