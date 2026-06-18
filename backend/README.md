# Backend

FastAPI API для импорта Excel-файла, хранения сотрудников, редактирования данных, экспорта и отображения прогресса операций.

## Запуск

Из папки `backend`:

```powershell
uvicorn main:app --reload
```

API будет доступен по адресу:

```text
http://localhost:8000
```

Документация Swagger:

```text
http://localhost:8000/docs
```

## Переменные окружения

Создайте `backend/.env` на основе `.env.example`.

Основные переменные:

```text
DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/your_db_name
ALLOWED_ORIGINS=http://localhost:3000
```

## Основные таблицы

- `people` - ФИО сотрудников и руководителей.
- `organization_units` - департаменты и отделы.
- `employee_assignments` - стабильные записи сотрудников.
- `assignment_versions` - версии данных сотрудника.
- `import_batches` - история импортов.
- `export_operations` - история экспортов.
- `operation_events` - события прогресса для WebSocket.

## Импорт

Endpoint:

```text
POST /imports?async_mode=true
```

Файл отправляется как multipart field `file`. Поддерживаются `.xlsb`, `.xlsx`, `.xlsm`.

Парсер читает заголовки из строки 2 и данные со строки 4. Некорректные строки не останавливают импорт: они записываются в список ошибок результата.

## Сотрудники

```text
GET    /employees?search=&department_id=&status=&cutoff=&limit=&offset=
GET    /employees/{assignment_id}?cutoff=
POST   /employees
PATCH  /employees/{assignment_id}
DELETE /employees/{assignment_id}
GET    /departments
```

Параметр `cutoff` используется для просмотра данных, актуальных на выбранную дату.

## Экспорт

```text
POST /exports
GET  /exports/history
GET  /exports/{operation_id}
GET  /exports/{operation_id}/download
```

Пример тела запроса:

```json
{
  "tables": ["employees", "departments"],
  "format": "xlsx",
  "cutoff": null
}
```

`xlsx` экспортирует секции на отдельные листы. `csv` создает ZIP-архив с отдельным CSV-файлом для каждой секции.

## WebSocket

Прогресс операций доступен по адресам:

```text
ws://localhost:8000/imports/{batch_id}/ws
ws://localhost:8000/exports/{operation_id}/ws
```

События также сохраняются в таблице `operation_events`, поэтому история доступна после обновления страницы.
