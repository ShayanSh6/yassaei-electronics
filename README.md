# Yassaei Electronics — Rebuilt (Next.js + Split Backend + Docker)

A full rebuild of [ShayanSh6/yassaei-electronics](https://github.com/ShayanSh6/yassaei-electronics):
a Persian RTL electronics e-commerce store. The original vanilla-JS SPA + zero-dependency
Node server has been split into a **standalone backend service** and a **Next.js 16 frontend**,
fully containerized with Docker.

## What's inside

```
.
├── src/                  # Next.js 16 frontend (App Router, single "/" route, hash-routed SPA)
│   ├── app/              #   layout (RTL, Vazirmatn font) + page.tsx shell
│   ├── components/store/ #   header, footer, product cards, all 17 views (home, catalog,
│   │                     #   product, cart, checkout, auth, account, orders, admin, pages…)
│   └── lib/store/        #   api client, hash router, zustand cart/auth stores, types
├── backend/              # SPLIT backend — standalone Bun service (zero npm deps), port 4000
│   ├── src/              #   Bun.serve + routes/{catalog,auth,shop,admin}.ts + scrypt auth
│   └── data/db.json      #   JSON-file DB, seeded: 121 products, 19 categories, 14 brands
├── public/               # product/category/brand images + Vazirmatn fonts (from original repo)
├── Dockerfile.frontend   # multi-stage Next.js build (standalone output, non-root)
├── Dockerfile.backend    # bun runtime, /app/data volume for persistence
├── docker-compose.yml    # frontend:3000 + backend:4000, healthcheck, named volume
├── docker/README.md      # architecture notes
├── original/             # the original cloned repo (for reference)
└── worklog.md            # full development/verification log
```

## Quick start (Docker)

```bash
docker compose up -d --build
# frontend → http://localhost:3000
# backend  → http://localhost:4000 (health: /healthz)
```

Data persists in the `yassaei-data` named volume across restarts.

## Quick start (local dev, no Docker)

Requires [Bun](https://bun.sh).

```bash
# 1) backend (terminal 1)
cd backend
bun install          # no deps, instant
bun run dev          # http://localhost:4000

# 2) frontend (terminal 2) — from repo root
bun install
bun run dev          # http://localhost:3000  (proxies /api/* → backend:4000)
```

> The frontend calls same-origin `/api/*`; `next.config.ts` rewrites it to
> `${BACKEND_URL || http://127.0.0.1:4000}`. Override with `BACKEND_URL` env.

## Admin account

On first backend boot (empty users list) an owner account is created automatically:

- username: `admin`
- password: `Yassaei@1404` (override with `ADMIN_PASSWORD` env **before first boot**)

Admin panel: `http://localhost:3000/#/admin` — dashboard, product management
(create/edit/delete/featured), and order status workflow.

## Feature highlights

- 🛍 Catalog: categories, brands, filters (price/brand/stock), sorting, pagination, live search suggestions
- 🛒 Cart with server-side validation, coupon codes (`YASSEI10`, `WELCOME`), free-shipping progress
- 📦 Checkout: 3 shipping methods (post/peyk/pickup), online/COD payment, guest or logged-in orders
- 👤 Auth: register/login (scrypt-hashed, bearer sessions), account page, order tracking
- ⭐ Product reviews with rating aggregation
- 🛠 Admin: stats dashboard, low-stock alerts, product CRUD, order status pipeline
- 🌍 Full RTL Persian UI, dark theme, Toman prices, Persian digit formatting
- 🐳 Complete Docker setup (compose, healthchecks, volumes, non-root containers)

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Framer Motion, Lucide |
| Backend  | Bun.serve, zero-dependency TypeScript, JSON-file DB with atomic writes, scrypt auth |
| Docker   | docker-compose (2 services), multi-stage builds, healthchecks, named volumes |

## API overview

All endpoints under `/api/*` (see `backend/src/routes/` for details):

- **Public**: `settings`, `home`, `categories`, `brands`, `products` (filter/sort/paginate),
  `products/:id`, `search/suggest`, `pages/:slug`, `products/:id/reviews`
- **Auth**: `auth/register`, `auth/login`, `auth/me`
- **Shop**: `cart/validate`, `coupon/validate`, `orders` (create/list/detail), `reviews`
- **Admin** (bearer, owner/staff): `admin/stats`, `admin/products` CRUD, `admin/orders`, `admin/users`
