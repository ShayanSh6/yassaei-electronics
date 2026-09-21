# Yassaei Electronics — Docker & Architecture

Split architecture rebuilt from https://github.com/ShayanSh6/yassaei-electronics :

```
┌──────────────────────┐        /api/* (Next.js rewrites)      ┌──────────────────────┐
│  Frontend (Next.js)  │ ────────────────────────────────────▶ │  Backend (Bun API)   │
│  port 3000           │        BACKEND_URL=http://backend:4000│  port 4000           │
│  SPA on "/" + hash   │                                       │  PostgreSQL (db)     │
│  routing, RTL        │                                       │  or JSON fallback    │
└──────────────────────┘                                       └──────────┬───────────┘
                                                                           │
                                                                ┌──────────▼───────────┐
                                                                │  PostgreSQL 16 (db)  │
                                                                │  yassaei-pgdata vol. │
                                                                └──────────────────────┘
```

## Quick start (Docker)

```bash
docker compose up -d --build
# Storefront:  http://localhost:3000
# API direct:  http://localhost:4000/healthz
# DB health:   http://localhost:4000/api/health   → { "store": "postgres", … }
```

- **PostgreSQL** runs as the `db` service (`postgres:16-alpine`, healthchecked). The
  backend waits for it, auto-creates its schema and migrates the bundled JSON seed
  (`backend/data/db.json`) on first boot. Data persists in the `yassaei-pgdata`
  named volume.
- The JSON file (`yassaei-data` volume) remains the seed source and automatic
  fallback whenever PostgreSQL is unreachable.
- Admin panel: `#/admin` — login `admin` / `Yassaei@1404` (override with `ADMIN_PASSWORD` env).
- Change admin password: `ADMIN_PASSWORD=NewPass docker compose up -d --build backend` (env is read on first boot only).
- Change the DB password: `POSTGRES_PASSWORD=NewPass docker compose up -d --build` (read by both `db` and `backend`).

## Services

| Service  | File                 | Port | Notes                                        |
|----------|----------------------|------|----------------------------------------------|
| frontend | `Dockerfile.frontend`| 3000 | Next.js 16 standalone build, serves SPA + proxies `/api/*` |
| backend  | `Dockerfile.backend` | 4000 | Zero-dependency Bun HTTP service, PostgreSQL storage (Bun SQL) |
| db       | `postgres:16-alpine` | 5432 | PostgreSQL 16, healthcheck, `yassaei-pgdata` volume |

## Storage (PostgreSQL)

- Connection: `DATABASE_URL` (or `PG_URL`) env — compose sets
  `postgres://yassaei:<pw>@db:5432/yassaei`; local dev defaults to
  `postgres://yassaei:yassaei1404@127.0.0.1:5432/yassaei`.
- `PG_DISABLED=1` forces the JSON-file store even when PostgreSQL is reachable.
- Schema: one table per collection (`products`, `orders`, `users`, `sessions`,
  `reviews`, `questions`, `coupons`, `categories`, `brands`) — the exact API object
  in a `data jsonb` column plus mirrored hot columns (price/stock/status/…) and
  indexes; scalar documents (settings/pages/stats/meta) in `kv_state`.
- Every debounced flush rewrites all collections inside a single transaction.
- Inspect with psql: `docker compose exec db psql -U yassaei -d yassaei`.

## Local development (without Docker)

```bash
# 0) PostgreSQL (any 14+ instance) — local default expects:
#    postgres://yassaei:yassaei1404@127.0.0.1:5432/yassaei
#    (schema is auto-created; the JSON seed is auto-migrated on first boot)

# 1) backend
cd backend && bun run dev          # port 4000 (auto-reload)

# 2) frontend
bun run dev                        # port 3000, rewrites /api/* → 127.0.0.1:4000
```

`BACKEND_URL` env overrides the rewrite target in `next.config.ts`.
