# Frontend

Next.js приложение для Excel Analyzer: импорт Excel, просмотр и редактирование сотрудников, справочники, экспорт и история операций.

## Запуск

Из папки `frontend` в dev режиме:

```powershell
pnpm install
pnpm dev
```

или через сборку:
 
```powershell
pnpm install
pnpm build
pnpm start
```

Приложение будет доступно на `http://localhost:3000`.

## Переменные окружения

Фронтенд обращается к FastAPI через `NEXT_PUBLIC_API_URL`.

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Если переменная не задана, используется `http://localhost:8000`.

## Скрипты

```powershell
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Основные страницы

- `/` - главная страница Excel Analyzer с импортом и кнопкой очистки базы.
- `/import` - загрузка `.xlsb`, `.xlsx`, `.xlsm`, прогресс импорта и история импортов.
- `/employees` - форма добавления сотрудника, справочники, таблица сотрудников, фильтры, сортировка и пагинация. Обязательные поля и недопустимые символы показываются через `ErrorBox`; дата увольнения необязательна, зарплата обязательна.
- `/employees/{assignment_id}` - карточка сотрудника;
- `/export` - выбор секций, формат `xlsx` или `csv`, прогресс и история экспортов.

## Архитектурные допущения в UI

- ФИО не считается уникальным идентификатором. В таблицах и экспорте могут быть разные люди с одинаковым ФИО.
- Backend различает людей при импорте по `ФИО сотрудника + Дата приема на работу`, потому что в исходном Excel нет стабильного внешнего ID.
- `/employees` работает с назначениями сотрудников, а не с уникальными ФИО.
- Экспорт `people` содержит записи людей с контекстом назначения, чтобы одинаковые ФИО можно было различить.
- Экспорт `employees` содержит текущие неудаленные назначения из `/employees`, включая штатных и внештатных сотрудников.

## Backend API

Основные HTTP-запросы:

```text
GET  /imports
POST /imports?async_mode=true
GET  /employees
GET  /employees/{assignment_id}
POST /employees
PATCH /employees/{assignment_id}
DELETE /employees/{assignment_id}
GET  /departments
GET  /references
POST /references
PATCH /references/rename
DELETE /references
POST /exports
GET  /exports/history
GET  /exports/{operation_id}/download
POST /admin/clear-db
```

Прогресс импорта и экспорта приходит через WebSocket:

```text
ws://localhost:8000/imports/{id}/ws
ws://localhost:8000/exports/{id}/ws
```

## Дополнительная информация

Проект использует SCSS modules и `lucide-react` для SVG-иконок, а также FSD подход к структуре.
