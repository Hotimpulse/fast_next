# Frontend

Next.js приложение для загрузки Excel-файла, просмотра сотрудников, редактирования записей, запуска экспорта и отображения истории операций.

## Запуск

Из папки `frontend` установите зависимости:

```powershell
pnpm install
```

Запустите dev-сервер:

```powershell
pnpm dev
```

Приложение будет доступно по адресу:

```text
http://localhost:3000
```

## Переменные окружения

Фронтенд обращается к FastAPI через `NEXT_PUBLIC_API_URL`.

Пример:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Если переменная не задана, используется `http://localhost:8000`.

## Страницы

- `/import` - загрузка Excel-файла, прогресс импорта и история импортов.
- `/employees` - таблица сотрудников, поиск, фильтры, добавление, редактирование и удаление.
- `/export` - выбор секций для экспорта, формат файла, прогресс и история экспортов.

## Связь с backend

Основные HTTP endpoints:

```text
GET  /imports
POST /imports?async_mode=true
GET  /employees
POST /employees
PATCH /employees/{id}
DELETE /employees/{id}
GET  /departments
POST /exports
GET  /exports/history
GET  /exports/{id}/download
```

Прогресс импорта и экспорта приходит через WebSocket:

```text
ws://localhost:8000/imports/{id}/ws
ws://localhost:8000/exports/{id}/ws
```

## Сборка

Проверка production-сборки:

```powershell
pnpm build
```

Запуск собранного приложения:

```powershell
pnpm start
```
