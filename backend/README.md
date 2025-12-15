# Backend (spykit-backend)

## Components

- API (`/api/...`) implemented in `internal/api`.
- ClickHouse: data source for metrics (read-only).
- Bolt DB `data/reports.db`: stores reports/widgets metadata, users, and settings.

## Endpoints

- `GET /api/reports` — list reports (metadata).
- `GET /api/reports/{id}` — report with resolved widgets (metadata only).
- `GET /api/widgets/{id}` — executes widget SQL, supports optional `from`/`to` (RFC3339). Returns `{id,type,title,value,from,to}`. Time filter insertion:
  - If query contains `{time_filter}` placeholder — it is replaced with `timestamp BETWEEN ? AND ?`.
  - Else, backend appends `WHERE`/`AND timestamp BETWEEN ? AND ?` automatically.
  - Defaults: last 24h (`from=now()-24h`, `to=now()`).
- CRUD (Protected):
  - `GET /api/widgets` — list widgets.
  - `POST /api/widgets` — create widget `{id,type,title,description?,query}`.
  - `PUT /api/widgets/{id}` — update widget.
  - `DELETE /api/widgets/{id}` — delete widget.
  - `POST /api/reports` — create report `{id,title,widgets[]}`.
  - `PUT /api/reports/{id}` — update report (including widgets list).
  - `DELETE /api/reports/{id}` — delete report.
- `GET /health` — liveness.
- Views Management (Admin only):
  - `GET /api/schema/views` — list ClickHouse views.
  - `POST /api/schema/views` — create a new view (normal or materialized).

## Configuration

- Env:
  - `BACKEND_PORT` (default `3000`)
  - `CLICKHOUSE_HOST` (required, e.g. `http://clickhouse:8123`)
  - `CLICKHOUSE_USER` (default `default`)
  - `CLICKHOUSE_PASSWORD` (default empty)
  - `REPORT_DB_PATH` (default `./config/reports.db`)
  - `INITIAL_ADMIN_USER` (for first run)
  - `INITIAL_ADMIN_PASSWORD` (for first run)
  - `JWT_SECRET` (required for auth)

## Layers

- `main.go` — boot/env/wiring.
  - API/handlers: `internal/api`.
  - Metadata (Bolt): `internal/meta`.
  - ClickHouse connection — in `main.go`.
