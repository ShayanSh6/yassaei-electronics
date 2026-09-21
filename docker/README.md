# Yassaei Electronics — Docker & Architecture

Split architecture rebuilt from https://github.com/ShayanSh6/yassaei-electronics :

```
┌──────────────────────┐        /api/* (Next.js rewrites)      ┌──────────────────────┐
│  Frontend (Next.js)  │ ────────────────────────────────────▶ │  Backend (Bun API)   │
│  port 3000           │        BACKEND_URL=http://backend:4000│  port 4000           │
│  SPA on "/" + hash   │                                       │  JSON-file DB        │
│  routing, RTL        │                                       │  data/db.json        │
└──────────────────────┘                                       └──────────────────────┘
```

## Quick start (Docker)

```bash
docker compose up -d --build
# Storefront:  http://localhost:3000
# API direct:  http://localhost:4000/healthz
```

- Product data persists in the `yassaei-data` named volume (survives `docker compose down`).
- Admin panel: `#/admin` — login `admin` / `Yassaei@1404` (override with `ADMIN_PASSWORD` env).
- Change admin password: `ADMIN_PASSWORD=NewPass docker compose up -d --build backend` (env is read on first boot only).

## Services

| Service  | File                 | Port | Notes                                        |
|----------|----------------------|------|----------------------------------------------|
| frontend | `Dockerfile.frontend`| 3000 | Next.js 16 standalone build, serves SPA + proxies `/api/*` |
| backend  | `Dockerfile.backend` | 4000 | Zero-dependency Bun HTTP service, atomic JSON store |

## Local development (without Docker)

```bash
# 1) backend
cd backend && bun run dev          # port 4000 (auto-reload)

# 2) frontend
bun run dev                        # port 3000, rewrites /api/* → 127.0.0.1:4000
```

`BACKEND_URL` env overrides the rewrite target in `next.config.ts`.
