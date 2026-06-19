# Backend

FastAPI API для Excel Analyzer: импорт Excel, хранение версий сотрудников, справочники, экспорт, история операций и WebSocket-прогресс.

## Запуск

Из папки `backend`:

```powershell
uv sync
uvicorn main:app --reload
```

API: `http://localhost:8000`

Swagger: `http://localhost:8000/docs`

## Переменные окружения

Создайте `.env` на основе `.env.example`.

```text
DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/your_db_name
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Таблицы

- `people` - конкретные люди; ФИО не считается уникальным параметром и может повторяться у разных записей.
- `organization_units` - департаменты и отделы.
- `employee_assignments` - стабильные назначения сотрудников.
- `assignment_versions` - версии данных сотрудника.
- `reference_catalog` - значения справочников, добавленные вручную.
- `import_batches` - история импортов.
- `export_operations` - история экспортов.
- `operation_events` - события прогресса для WebSocket и истории.

## Импорт

```text
GET  /imports
POST /imports?async_mode=true
GET  /imports/{batch_id}
GET  /imports/{batch_id}/events
WS   /imports/{batch_id}/ws
```

Файл отправляется multipart-полем `file`. Поддерживаются `.xlsb`, `.xlsx`, `.xlsm`.

Парсер читает первый лист, заголовки из строки 2 и данные со строки 4. Ошибки отдельных строк сохраняются в результате импорта и не останавливают обработку всего файла.

Повторный импорт ищет существующую историю сотрудника по нормализованному ФИО и дате приема на работу. Если совпавшая строка изменила руководителя, должность, статус, штат, зарплату или подразделение, создается новая текущая версия назначения. Если ФИО совпадает, но дата приема отличается, создается отдельная запись `people`, потому что в исходном файле нет стабильного уникального ID.

## Архитектурный подход к людям и сотрудникам

- `Person` - это конкретный человек, а не уникальная строка ФИО.
- Одинаковые ФИО допускаются. Для различения при импорте используется доступный в файле признак `ФИО сотрудника + Дата приема на работу`.
- `employee_assignments` связывает конкретного человека с его рабочей историей.
- `assignment_versions` хранит изменения этой истории во времени: отдел, руководитель, должность, статус, штат, зарплату, даты приема и увольнения.
- Строки с одинаковыми ФИО и датой приема трактуются как один человек с обновляемой историей.
- Строки с одинаковыми ФИО, но разной датой приема трактуются как разные люди или независимые трудовые случаи.
- В API список `/employees` показывает текущие неудаленные назначения, а экспортная секция `employees` ограничена активными штатными сотрудниками.
- Экспортная секция `people` показывает записи людей вместе с контекстом текущего назначения, чтобы одинаковые ФИО были различимы.

## Сотрудники

```text
GET    /employees?search=&department_id=&status=&cutoff=&limit=&offset=
GET    /employees/{assignment_id}?cutoff=
POST   /employees
PATCH  /employees/{assignment_id}
DELETE /employees/{assignment_id}
```

`cutoff` используется для просмотра версии сотрудника на выбранную дату.

## Департаменты и справочники

```text
GET    /departments?unit_type=&include_unused=
GET    /references?field=&include_inactive=
POST   /references
PATCH  /references/rename
DELETE /references
```

Поддерживаемые поля справочников:

- `department_name`
- `division_name`
- `position_name`
- `manager_name`

Для должностей и руководителей список активных значений включает как записи из `reference_catalog`, так и значения, используемые активными текущими назначениями.

## Экспорт

```text
GET  /exports?tables=employees,departments&format=xlsx&cutoff=2025-02-01
POST /exports
GET  /exports/history
GET  /exports/{operation_id}
GET  /exports/{operation_id}/events
GET  /exports/{operation_id}/download
WS   /exports/{operation_id}/ws
```

`POST /exports` запускает фоновую операцию. `GET /exports` сразу возвращает готовый файл.

Тело для фонового экспорта:

```json
{
  "tables": ["employees", "departments"],
  "format": "xlsx",
  "cutoff": null
}
```

Основные наполненные секции:

- `employees` - активные штатные сотрудники (`Работает` и `Штатный сотрудник`).
- `departments` - департаменты и отделы.
- `people` - записи людей, включая одинаковые ФИО как отдельные записи с контекстом назначения.
- `assignments` - версии назначений и исторические изменения.

`xlsx` создает один файл с листами. `csv` создает ZIP-архив с CSV-файлами.

## Администрирование

```text
POST /admin/clear-db
```

Очищает прикладные таблицы. Используется кнопкой на главной странице frontend.
