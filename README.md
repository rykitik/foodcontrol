# Льготное питание колледжа

Веб-приложение для учета льготного питания колледжа: роли пользователей, талоны на питание, кассовая выдача, журнал действий и отчетность.

## Текущее состояние

- Backend: Flask + SQLAlchemy + JWT.
- Frontend: Vue 3 + Vite + PrimeVue.
- Локальная разработка по умолчанию идет через реальный backend.
- Для dev по умолчанию используется SQLite, для production-цели и docker-контура — PostgreSQL.
- Тестовые пользователи и базовые данные создаются backend при первом запуске.

## Роли

- `social` — социальный педагог своего корпуса.
- `head_social` — руководитель социальных педагогов по всем корпусам.
- `cashier` — кассир выдачи питания.
- `accountant` — бухгалтер и отчеты.
- `admin` — администрирование пользователей и настроек.

## Тестовые пользователи

- `admin / password123`
- `social1 / password123`
- `cashier1 / password123`
- `accountant / password123`
- `headsocial / password123`

## Локальный запуск

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux / Mac
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

Backend поднимется на `http://localhost:5000`.

Поддерживаемый startup path для backend один: `python run.py` и `docker compose up` сначала прогоняют `alembic upgrade head`, потом seed, и только после этого поднимают сервер.
`flask bootstrap-dev --legacy` остаётся только как legacy/dev-only bypass для disposable базы и не является supported upgrade path.
Runtime schema patching больше не является нормальным startup-механизмом: изменения схемы должны приезжать через Alembic migration.
Для cashier offline grant вне explicit dev/test режима теперь нужно задать `OFFLINE_GRANT_PRIVATE_KEY` и при необходимости `OFFLINE_GRANT_PUBLIC_KEY`.
Локальный ephemeral fallback допустим только при явном `OFFLINE_GRANT_ALLOW_EPHEMERAL_DEV_KEY=1`.

По умолчанию backend слушает только `127.0.0.1`, что подходит для текущего dev-сценария с Vite proxy на той же машине.
Для явной публикации backend в сеть можно переопределить runtime-параметры через `backend/.env.local`:

```env
APP_HOST=0.0.0.0
APP_PORT=5000
```

По умолчанию backend использует SQLite через `backend/.env.example`:

```env
APP_HOST=127.0.0.1
APP_PORT=5000
DATABASE_URL=sqlite:///foodcontrol.db
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend поднимется на `http://localhost:5173`.

По умолчанию `npm run dev` открывает frontend только локально на этой машине.
Для доступа из локальной сети колледжа используйте отдельный LAN-режим:

```bash
cd frontend
npm run dev:lan
```

Для подготовки кассы к работе через установленное PWA и для оффлайн-сценария используйте отдельную инструкцию:

- [PWA кассы и оффлайн-работа](docs/cashier-pwa-offline.md)

По умолчанию frontend работает в backend-first режиме:

- все запросы идут на `'/api'`
- Vite проксирует `'/api'` на `http://localhost:5000`
- mock не включен, если вы не включили его явно

### 3. Запуск для локальной сети колледжа

Текущий рекомендованный сценарий для показа другому человеку в сети колледжа:

1. На вашем компьютере запустите backend локально:

```bash
cd backend
python run.py
```

2. На вашем компьютере запустите frontend в LAN-режиме:

```bash
cd frontend
npm run dev:lan
```

3. Узнайте адрес, который нужно открыть другому человеку:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\show-lan-url.ps1
```

4. Другой человек в сети колледжа открывает `http://<IP-адрес-вашего-ПК>:5173`.

В этом режиме backend отдельно в сеть открывать не нужно: браузер второго пользователя идет в `/api` через Vite proxy на вашей машине.
Если сайт не открывается с другого ПК, проверьте входящее правило Windows Firewall для TCP-порта `5173`.

## Backend-First Policy

Реальный backend — единственный source of truth.

Правила проекта:

- mock существует только как узкий dev/demo fallback
- в mock нельзя добавлять новую доменную логику
- новые функции реализуются через backend first
- если контракт backend изменился, mock нужно обновить в том же изменении или убрать для этого сценария
- mock не должен скрывать реальные `4xx/5xx` backend-ответы
- если mock и backend расходятся, решение — двигаться к backend-first поведению, а не расширять mock

## Когда использовать mock

Mock допустим только в ограниченных сценариях:

- изолированная UI-разработка без поднятого backend
- короткие демо
- временная недоступность backend в dev-среде

Mock не должен использоваться как подтверждение корректности бизнес-логики, расчетов, отчетов, кассовых правил или правил талонов.

## Frontend env

Создайте `frontend/.env.local` при необходимости на основе `frontend/.env.example`.

Основные переменные:

```env
VITE_DEV_HOST=127.0.0.1
VITE_DEV_PORT=5173
VITE_PROXY_TARGET=http://localhost:5000
VITE_API_URL=/api
VITE_USE_MOCK_API=false
```

`VITE_USE_MOCK_API=true` — это только вторичный fallback-режим для dev/demo, а не основной способ локальной разработки.

## Docker Compose

```bash
docker compose up --build -d
```

Если на первом `docker compose up --build` Docker не может скачать базовые образы с Docker Hub
(`TLS handshake timeout`, `failed to resolve source metadata`), не меняйте Dockerfiles вручную.
Скопируйте корневой `.env.example` в `.env` и переопределите источники образов:

```bash
copy .env.example .env
```

Пример переменных:

- `FOODCONTROL_BACKEND_BASE_IMAGE`
- `FOODCONTROL_FRONTEND_BASE_IMAGE`
- `FOODCONTROL_POSTGRES_BASE_IMAGE`

Туда можно подставить зеркало или приватный registry с теми же образами, например
`mirror.example.local/library/python:3.12-slim`.

Сервисы:

- frontend: `http://localhost:5173`
- backend: `http://localhost:5000`
- postgres: `localhost:5432`

Для доступа из локальной сети колледжа делитесь адресом `http://<IP-адрес-вашего-ПК>:5173`.
Получить актуальный адрес на Windows можно так:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\show-lan-url.ps1
```

Что важно:

- первый запуск с `--build` может занять заметно больше времени, потому что Docker собирает образы и устанавливает зависимости;
- следующие `docker compose up -d` должны стартовать существенно быстрее, потому что `pip install` и `npm install` больше не выполняются на каждый запуск контейнера.

Проверка после старта:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Остановка:

```bash
docker compose down
```

Полный сброс базы:

```bash
docker compose down -v
```

## Тесты и проверки

Backend smoke-тесты:

```bash
cd backend
pytest
```

Frontend build:

```bash
cd frontend
npm run build
```

## PWA кассы

Для кассового PWA важны три шага:

1. открыть приложение онлайн с того же адреса, с которого оно потом будет использоваться;
2. под кассиром открыть `/cashier` и дождаться, пока приложение прогреет кассовые экраны;
3. установить PWA и только после этого проверять оффлайн.

Подробно:

- [PWA кассы и оффлайн-работа](docs/cashier-pwa-offline.md)

## Основные API

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `GET /api/students/search`
- `POST /api/students`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/meals/resolve`
- `POST /api/meals/confirm-selection`
- `GET /api/meals/today-stats`
- `GET /api/meals/report`
- `POST /api/reports/meal-sheet`
- `POST /api/reports/cost-statement`
- `POST /api/imports/users`
- `POST /api/imports/students`
- `POST /api/imports/tickets`

## Ближайшие цели по сокращению mock

Следующие кандидаты на дальнейшее сокращение:

- `frontend/src/services/mock/reports.ts` — mock не должен симулировать бухгалтерские документы и отчетные суммы.
- `frontend/src/services/mock/meals.ts` — здесь дублируются кассовые правила, сервисные дни и выдача питания.
- `frontend/src/services/mock/tickets.ts` — здесь дублируются правила создания и изменения талонов.
- `frontend/src/services/mock/domain.ts` — это общий центр дублированной доменной логики, который приближает mock к “второму backend”.

Эти модули не удаляются в этой фазе, но именно они должны сокращаться следующими.
