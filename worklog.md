# Worklog — Yassaei Electronics Rebuild

Original repo: https://github.com/ShayanSh6/yassaei-electronics (cloned to /tmp/yassaei-electronics)
It is a Persian RTL electronics e-commerce store (vanilla-JS SPA + zero-dep Node server + JSON file DB: 121 products, 19 categories, 14 brands, Toman prices, dark theme, accent #3dabff).

## Target architecture (user requirements: add Docker, split backend & frontend, rebuild UI with Next.js)

```
/home/z/my-project/
├── src/app/                 # Next.js 16 frontend — SPA on the single "/" route (hash routing)
├── src/components/store/    # Store UI (shadcn/ui + Tailwind 4, RTL, Vazirmatn)
├── src/lib/store/           # api client, hash router, zustand stores (cart/auth), types
├── backend/                 # SPLIT backend — standalone Bun service, fixed port 4000
│   ├── package.json         # scripts: dev = bun --hot src/index.ts
│   ├── src/index.ts         # Bun.serve, CORS, routes
│   ├── src/db.ts            # atomic JSON-file DB (backend/data/db.json)
│   ├── src/auth.ts          # scrypt hash + bearer session tokens
│   ├── src/routes/          # catalog / auth / shop / admin route modules
│   └── data/db.json         # seeded from original repo (DONE: 121 products, 19 cats, 14 brands, coupons, pages, settings)
├── public/assets|uploads    # copied original product/category/brand images + Vazirmatn fonts (DONE)
├── Dockerfile.frontend      # multi-stage Next build (standalone)
├── Dockerfile.backend       # bun runtime, volume for backend/data
├── docker-compose.yml       # frontend:3000 + backend:4000, NEXT rewrites proxy /api → backend
└── docker/README.md
```

Notes:
- Preview panel only exposes `/` → whole store is a client-side hash-routed SPA (`#/catalog?...`, `#/product/ys-001`, `#/admin`, ...), mirroring the original SPA's hash routing.
- Frontend calls same-origin `/api/*`; `next.config.ts` rewrites `/api/:path*` → `${BACKEND_URL || http://127.0.0.1:4000}/api/:path*`. Never use absolute URLs or explicit ports in client fetches.
- Seed admin account: username `admin`, password `Yassaei@1404` (backend creates owner on first boot if users[] empty, from env ADMIN_PASSWORD fallback).
- Product images referenced by original paths: `/uploads/cat-*.svg` (categories), `/assets/img/products/p0XX.svg` (products), `/assets/img/brands/*.svg` (brands).

---

## API CONTRACT (backend MUST implement exactly this; frontend is built against it)

All responses JSON. Errors: `{ "error": "message" }` with proper HTTP status (400/401/403/404). Auth: `Authorization: Bearer <token>`. Token = random string persisted in db.sessions.

### Public
- `GET /healthz` → `{ ok: true }`
- `GET /api/settings` → `{ store, ui, features }` (public slice of settings; includes `store.name`, `store.tagline`, `store.phone`, `store.address`, `store.workingHours[]`, `store.socials`, `ui.tickerItems[]`)
- `GET /api/home` → `{ categories: [{id,name,nameEn,glyph,image,count}], brands: [{id,name,nameEn,image}], featured: Product[8], deals: Product[8] (oldPrice>price sorted by discount), newest: Product[8], bestSellers: Product[8] (by sold), stats: {products, orders, users}, ticker: string[] }`
- `GET /api/categories` → `[{id,name,nameEn,glyph,image,count}]` (image = category SVG path or first product image)
- `GET /api/brands` → `[{id,name,nameEn,image,country}]`
- `GET /api/products?cat=&brand=&q=&sort=&page=&perPage=&min=&max=&inStock=1&featured=1` → `{ items: Product[], total, page, pages, perPage }`
  - sort: `newest|cheap|expensive|popular|rating` (default newest)
  - only `active !== false` products returned; `q` searches name/nameEn/tags/sku (case-insensitive, Persian/Latin digits normalized)
- `GET /api/products/:id` → `{ product, category, brand, related: Product[4] }` (404 if missing; increments views)
- `GET /api/search/suggest?q=` → `{ suggestions: [{id,name,price,image,brand}] }` (max 8)
- `GET /api/pages/:slug` → page content dict (about/guide/service/faq/terms/privacy/insurance/ticketRules/bugReport/contact)
- `GET /api/products/:id/reviews` → `[{id,userName,rating,comment,createdAt}]`

### Auth
- `POST /api/auth/register` `{name, username, phone, password}` → `{ token, user }` (validates: name≥2, username≥3 unique, password≥4)
- `POST /api/auth/login` `{username, password}` → `{ token, user }` (user: `{id,username,name,role,phone}`; 401 wrong creds)
- `GET /api/auth/me` (Bearer) → `{ user }` or 401

### Shop
- `POST /api/cart/validate` `{ items: [{id, qty}] }` → `{ items: [{id,name,price,stock,qty,image,active}], subtotal }` (clamps qty to stock; drops inactive)
- `POST /api/coupon/validate` `{ code, subtotal }` → `{ ok:true, code, type, value, discount }` or 400
- `POST /api/orders` `{ items:[{id,qty}], customer:{name,phone,address,note?}, shipping: "post|peyk|pickup", payment:"online|cod", couponCode? }` (Bearer optional → guest order; userId when token) → `{ order }` (order: `{id, code, items[{id,name,price,qty,image}], subtotal, discount, shippingCost, total, status:"pending", customer, shipping, payment, createdAt, userId}`); decrements stock; shippingCost: pickup=0, Tehran-ish peyk=80k, post=120k free if subtotal≥2,000,000
- `GET /api/orders` (Bearer) → `[order]` newest first
- `GET /api/orders/:id` (Bearer owner or admin) → `{ order }`
- `POST /api/reviews` (Bearer) `{ productId, rating:1..5, comment }` → `{ review }` (updates product ratingAvg/ratingCount)

### Admin (Bearer, role owner|staff; else 403)
- `GET /api/admin/stats` → `{ products, lowStock (stock<5), orders, ordersTotal, revenueTotal, users, ordersByStatus: {pending,processing,shipped,done,canceled}, recentOrders: order[8], topProducts: [{id,name,sold,price}][8] }`
- `GET /api/admin/products?page=&perPage=&q=&cat=` → `{ items, total, page, pages }` (includes inactive)
- `POST /api/admin/products` `{ name, categoryId, brandId, price, stock, ... }` → `{ product }` (auto id `ys-XXX` / sku `YS-XXX`, image default by category)
- `PATCH /api/admin/products/:id` any subset `{price,stock,active,featured,name,oldPrice,...}` → `{ product }`
- `DELETE /api/admin/products/:id` → `{ ok:true }`
- `GET /api/admin/orders?page=&status=` → `{ items, total, page, pages }`
- `PATCH /api/admin/orders/:id` `{ status: pending|processing|shipped|done|canceled }` → `{ order }` (canceled restocks)
- `GET /api/admin/users` → `[{id,username,name,role,phone,createdAt,lastLoginAt}]`

Product shape (see db.json): `{ id, sku, name, nameEn, categoryId, brandId, brandName, brandNameEn, glyph, price, oldPrice, stock, reserved, images[], specs{}, description, tags[], featured, active, sold, views, ratingAvg, ratingCount, warrantyMonths, authenticity, condition, createdAt, updatedAt }`

---
---

Task ID: 2-a
Agent: full-stack-developer
Task: build split backend service

Work Log:
- Scaffolded standalone Bun service in /home/z/my-project/backend/ (zero external deps, only bun/node built-ins): package.json (`dev` = `bun --hot src/index.ts`, `start` = `bun src/index.ts`, type: module) + tsconfig.json (strict, bun-types; `bunx tsc --noEmit` passes with 0 errors).
- src/types.ts: full TS interfaces for DBState/Product/Category/Brand/Coupon/User/PublicUser/Session/Order(+Item,Customer,Status)/Review/Settings/RouteCtx.
- src/config.ts: env config with defaults resolved from the backend source dir (not CWD): PORT=4000, HOST=0.0.0.0, DB_PATH=backend/data/db.json, ADMIN_PASSWORD (fallback "Yassaei@1404"), PUBLIC_DIR=../public (only used to test which image paths exist).
- src/db.ts: atomic JSON store — full state in memory, debounced (~200ms) save via writeFileSync to `db.json.<pid>.tmp` then renameSync; `transaction(fn)` = snapshot via structuredClone + rollback on throw + schedule save; flushSync on first boot and SIGINT/SIGTERM; on boot with empty users[] seeds owner {id:"u-admin", username:"admin", role:"owner", name:"مدیر یاسایی"} hashed from ADMIN_PASSWORD.
- src/auth.ts: scryptSync hashing `scrypt$<saltHex>$<hashHex>` (random 16-byte salt, timingSafeEqual verify); sessions = random 32-byte hex tokens persisted in db.sessions [{token,userId,role,createdAt}]; guards: optionalUser (bad bearer → 401), requireUser (401), requireAdmin (403 for non owner|staff).
- src/util.ts: HttpError (name-tagged for robust detection), json(), readJson (any parse failure → 400 "بدنهٔ درخواست نامعتبر است"), Persian/Arabic digit + glyph normalization, paginate(), validators (no zod).
- src/routes/catalog.ts: GET settings (public {store,ui,features} slice), home (categories w/ count+image, brands, featured/deals(discount% desc)/newest/bestSellers ×8, stats, ticker), categories, brands (image fallback /assets/img/brands/no_name.svg; categories fallback first product image), products list (filters cat/brand/q/min/max/inStock/featured; sorts newest/cheap/expensive/popular/rating; default perPage 12; active-only), product detail (404 if missing/inactive, increments+persists views, related = same cat active ≠ self max 4), search/suggest (max 8), pages/:slug (all 10 slugs), product reviews GET.
- src/routes/auth.ts: register (name≥2, username≥3 unique case-insensitive, password≥4, phone required → 201 {token,user}), login (401 "نام کاربری یا رمز عبور اشتباه است", updates lastLoginAt), me.
- src/routes/shop.ts: cart/validate (clamps qty to stock, drops inactive/unknown, returns subtotal), coupon/validate (percent floor/fixed capped, minSubtotal check → 400 with Persian msg), orders POST (guest or bearer; validates customer/shipping/payment/items; 400 on insufficient stock with live remaining count; coupon applied inside same transaction; stock-=qty & sold+=qty per item; id o-000N / code YS-0000N; shippingCost pickup=0, peyk=80000, post=120000 free ≥2,000,000), orders list (own, newest first), order detail (owner or admin; matches id or code), reviews POST (rating 1..5 int, comment required; recomputes product ratingAvg 1-decimal + ratingCount).
- src/routes/admin.ts: stats (products, lowStock<5, orders, ordersTotal Σ all, revenueTotal Σ non-canceled, users, ordersByStatus, recentOrders×8, topProducts×8 by sold), products list (includes inactive, q/cat filter), create (auto id/sk u ys-XXX / YS-XXX, default image /uploads/cat-{categoryId}.svg, brandName sync), patch (typed whitelist: strings/numbers/booleans/images/tags/specs/oldPrice nullable; keeps brandName in sync; updatedAt), delete → {ok:true}, orders list (status filter validated), order patch (status enum validated; canceled→restock incl. sold decrement; leaving canceled re-deducts after stock re-check), users list (no passwordHash).
- src/index.ts: Bun.serve on 0.0.0.0:4000, regex route table (27 routes), CORS `*` with GET/POST/PATCH/DELETE/OPTIONS + Content-Type/Authorization (204 preflight), unknown routes → 404 {"error":"یافت نشد"}, global handler → HttpError status or 500 {"error":"خطای سرور"}, graceful shutdown flush.

Stage Summary:
- Files created (all inside backend/): package.json, tsconfig.json, src/{index,config,types,db,auth,util}.ts, src/routes/{catalog,auth,shop,admin}.ts. Seeded backend/data/db.json left intact (was backed up to /tmp/db.json.pristine during verification and restored byte-identical; owner re-seeds automatically on next boot). backend.log clean (no errors).
- Verification (curl against 127.0.0.1:4000, all pass): healthz {ok:true}; /api/home correct shape incl. 19 cats/14 brands/ticker; /api/products?cat=parts&sort=cheap&page=1&perPage=10 → sorted prices [5000..2850000]; Persian-digit query "۷۸۰۵" finds ys-006 (digit normalization works); detail ys-001 → {product,category,brand,related[4]} + views persisted; login admin/Yassaei@1404 → 64-hex token, /api/auth/me OK, wrong creds 401; /api/admin/stats with bearer OK (customer token → 403, no token → 401); guest order 2×ys-001 post → subtotal 24000 + shipping 120000 = total 144000, stock 298→296 + sold 2→4 persisted to disk; authed order 2×ys-011 peyk + YASSEI10 → 900000−90000+80000=890000, userId set; post free at 2,850,000 subtotal (ship 0); pickup 0; coupon validate {percent 10% → 100000 discount @1,000,000, fixed WELCOME 200000, below-min 400, unknown 400}; cancel o-0002 → stock restocked 58→60, uncancel re-deducts; reviews → ratingAvg 5/1 & 4.5/2 aggregation; admin product create ys-122/YS-122 → patch → inactive hidden from public list but visible in admin search → delete {ok:true}; all 10 /api/pages slugs 200; suggest max 8; unknown route 404; malformed JSON 400; CORS preflight 204 + headers on all responses; atomic writes verified (no .tmp leftovers, sessions/orders persisted to disk).
- Admin credentials note: username `admin`, password `Yassaei@1404` (override via env ADMIN_PASSWORD before first boot). After verification the DB was restored to pristine seed state (0 users/0 orders) — the owner account is recreated automatically on service boot.
---
Task ID: 2-b
Agent: main agent (Z.ai)
Task: rebuild UI with Next.js (SPA on single "/" route)

Work Log:
- Created src/lib/store/: types.ts, api.ts (fetch wrapper + Bearer token), router.ts (hash router + Persian digit/format helpers), cart-store.ts (Zustand persist: cart/compare/recently-viewed), auth-store.ts (Zustand persist + token verify on boot)
- Rebuilt layout.tsx: lang=fa dir=rtl, Vazirmatn via @font-face (copied woff2), dark store theme; globals.css: brand accent #3dabff (original repo theme), glass cards, ticker marquee keyframes, custom scrollbars
- Components: site-header (search + live suggestions, category nav, cart badge, user menu, mobile sheet), site-footer (trust bar + store info + sticky), product-card (discount badge, stock badge, quick add/compare)
- Views (hash routes): home (hero+ticker+categories+deals carousel+featured+bestsellers+newest+brands+stats), catalog (filters sidebar/sheet, price range, brands checkbox, sort, pagination, chips), product (gallery, specs, buy box, reviews+submit, related), cart (server-validated lines, coupon, free-shipping progress), checkout (customer info, 3 shipping methods, 2 payment methods, order placement), auth (login/register tabs), account (profile + order list), order (tracking steps + invoice), page (10 static pages from API), 404, admin (dashboard stats + low-stock warning + recent orders + top products; products table w/ create/edit/delete/active/featured switches + pagination; orders status workflow)
- page.tsx: QueryClientProvider + StoreShell, hash router switch, AnimatePresence transitions, mobile bottom nav w/ cart badge
- next.config.ts: rewrites /api/:path* → ${BACKEND_URL||http://127.0.0.1:4000}/api/:path*
- Fixed lint errors (set-state-in-effect ×2 via derive-on-change + key-based reset); lint = 0 errors
- Fixed "No QueryClient set" crash by splitting StoreApp(provider)/StoreShell(consumer)

Stage Summary:
- Full RTL Persian store UI on single "/" route with hash routing; all data from split backend via /api proxy (verified: /api/home + /api/products through Next.js = 200)
- 17 new source files; no other routes created (preview constraint respected)

---
Task ID: 3
Agent: main agent (Z.ai)
Task: add Docker

Work Log:
- Dockerfile.frontend: 3-stage (deps/build/runner) oven/bun, standalone output, non-root user, BACKEND_URL=http://backend:4000
- Dockerfile.backend: oven/bun-slim, zero-dep source copy, VOLUME /app/data for persistence
- docker-compose.yml: backend (4000, healthcheck /healthz, ADMIN_PASSWORD env) + frontend (3000, depends_on backend), yassaei-data named volume
- .dockerignore + docker/README.md (architecture diagram, quick start, dev instructions)

Stage Summary:
- `docker compose up -d --build` delivers the full split stack; data persists across restarts
---
Task ID: 4
Agent: main agent (Z.ai)
Task: QA via agent-browser + dev.log

Work Log:
- agent-browser walkthrough: home (hero/ticker/categories/deals carousel/featured/brands) → catalog ?cat=parts (filters, sort, chips, counts) → product ys-071 (gallery, specs, buy box) → add-to-cart (toast + badge=۱) → cart (coupon YASSEI10 correctly rejected below min with Persian msg; free-shipping hint) → checkout (filled form, placed order) → order page (tracking steps YS-00001) → admin login (admin/Yassaei@1404) → dashboard (stats ۱۲۱ کالا / ۱ سفارش / ۳۰۵,۰۰۰ تومان) → products tab (table + switches + search)
- BUG FOUND & FIXED #1 (backend): GET /api/orders/:id required auth even for guest orders (userId:null) → guests saw "not found" on their own order confirmation. Fixed in backend/src/routes/shop.ts getOrder(): guest orders viewable by id; customer orders still require owner/admin. Verified 200.
- BUG FOUND & FIXED #2 (frontend hydration): SSR rendered "/" (Home) but client first render read real hash → hydration mismatch. Root fix: useHashRoute rewritten with useSyncExternalStore (getServerSnapshot=EMPTY_ROUTE, cached getSnapshot); Zustand persist stores got skipHydration:true + explicit rehydrate() in StoreShell mount effect. Also stale Turbopack cache was serving old modules → killed dev server, rm -rf .next, restarted.
- Mobile viewport 390×844: compact header, 2-col grid, bottom nav with cart badge — OK
- Footer rule: root wrapper min-h-screen flex flex-col + footer mt-auto; verified footer sits flush at content end (no floating gap) on long page and pushes naturally on short 404 page
- Final sweep: page errors=0, dev.log errors=0, lint 0 errors

Stage Summary:
- All golden paths verified in real browser: browse → search/suggest → filters → cart → coupon → checkout → guest order → tracking → admin login → dashboard → product management
- Dev server: port 3000 clean (200s), backend: port 4000 healthy, data persists in backend/data/db.json

---
Task ID: 5
Agent: main agent (Z.ai)
Task: recurring webDevReview cron job

Work Log:
- Created cron job "yassaei-webdev-review" kind=webDevReview every 15 minutes (fixed_rate 900s) per task description requirements

Stage Summary:
- Autonomous review loop active; future rounds should read this worklog first and continue improving styling/features per the mandated instructions
