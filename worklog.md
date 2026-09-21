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

---
Task ID: 6
Agent: main agent (Z.ai)
Task: package project into downloadable archive ("get download file")

Work Log:
- Staged clean package in /tmp/yassaei-package: rebuilt project (src/, backend/ incl. seeded db.json, public/, docker/, prisma/, db/, all root configs + Dockerfiles + docker-compose.yml + .dockerignore) + original/ (the /tmp/yassaei-electronics clone, .git and test.zip excluded)
- Wrote archive-root README.md (quick start Docker/local, admin creds, feature list, stack, API overview) and .env.example (PORT/HOST/ADMIN_PASSWORD/BACKEND_URL)
- Created /home/z/my-project/download/yassaei-electronics-nextjs.zip (3.8 MB, `unzip -t` clean, all key files verified present)
- Wrote /home/z/my-project/download/README.md describing the archive contents; removed staging dir

Stage Summary:
- User can now download the full deliverable from the download folder: yassaei-electronics-nextjs.zip
  (Next.js UI + split backend + Docker + original repo reference + docs)

---
Task ID: 7
Agent: main agent (Z.ai) — recurring webDevReview round
Task: QA sweep + wishlist/compare features + styling polish

Work Log:
- Status assessment: backend 4000 healthy, frontend 3000 = 200, dev.log clean, lint 0 errors
- agent-browser regression sweep over /, catalog, product, cart, login, page/about, 404 → 0 page errors
- NEW FEATURE wishlist: useWishlist zustand store (persist yassaei.wishlist, max 50); Heart quick-action on ProductCard (max-sm always visible) + buy-box button on ProductView; header Heart icon w/ red badge + dropdown links; #/wishlist page (grid, bulk add in-stock to cart, per-item remove, clear-all, empty state)
- NEW FEATURE compare: #/compare page reusing existing useCompare store — side-by-side table (price/stock/brand/category/rating/sold/warranty/condition + union of spec keys), remove/clear, add-to-cart, horizontal ScrollArea, skeletons, empty state; header GitCompare icon w/ badge
- BACKEND: /api/products now accepts ids=comma-list whitelist filter (filterProducts in backend/src/routes/catalog.ts) → verified ys-999 dropped, order preserved client-side via api.productsByIds helper (new in api.ts)
- STYLING: DealCountdown component (ticks to midnight, hydration-safe "--:--:--" placeholder) on deals section; RecentlyViewed strip on home (productsByIds, hidden when empty); toasts for wish/compare now carry "مشاهده/مقایسه" action buttons
- Verified in browser: wish toggle → badge ۱ + localStorage persist; wishlist page lists product; compare of ys-005+ys-010 → full table renders (screenshots qa-compare/wishlist/home/home-mobile.png in download/); recently-viewed OK; bulk add → cart line created; mobile 390px OK; hydration clean (skipHydration + rehydrate pattern kept)
- Test artifacts cleaned (localStorage reset); refreshed download/yassaei-electronics-nextjs.zip with updated code + README (3.8 MB, unzip -t clean)

Stage Summary:
- Store now has wishlist + compare + recently-viewed + deal countdown, all verified end-to-end
- Backend API gained ids filter (backward compatible); API contract extended, no breaking changes
- Deliverable zip refreshed — matches deployed code exactly

---
Task ID: 8
Agent: main agent (Z.ai) — recurring webDevReview round
Task: order tracking + admin analytics charts + UX polish

Work Log:
- Status assessment: both services healthy, 7-route regression sweep clean (0 page errors)
- NEW FEATURE guest order tracking:
  - Backend POST /api/orders/track {code, phone} (backend/src/routes/shop.ts trackOrder + index.ts route): finds by code/id, Persian-digit normalization, tolerant last-10-digit phone compare; 404 unknown code, 403 phone mismatch. Verified: correct 200, ۴۰۳ wrong phone, 404 unknown, Persian digits accepted
  - Extracted shared OrderDetails + OrderSteps components (order-details.tsx); OrderView refactored to use them (identical UX, less duplication)
  - New #/track view: code+phone form (Persian digit input auto-normalized), mutation with loading skeleton, success card + full order details, hint card; linked from footer quick links + OrderView 404 fallback
- NEW FEATURE admin analytics: backend adminStats now returns dailyRevenue (14 days, non-canceled, oldest→newest); DashboardTab gained SalesChart (pure-CSS bar chart, hover tooltips, today highlighted) + StatusDistribution (stacked proportion bar + legend) — no chart lib added
- STYLING/UX: global search shortcut (Ctrl+K / Cmd+K and "/") focusing header search with kbd hint chips; BackToTop floating button (glass, appears >500px scroll, AnimatePresence); footer newsletter strip (email/phone validated, stored yassaei.newsletter, toast feedback)
- Verified in browser: track flow (found → order details + steps; wrong phone → 403 toast), admin login → dashboard charts render (qa-admin-chart.png), back-to-top appears, newsletter stored, both shortcuts focus search
- Lint: fixed Button import (footer) + unused directive (order-details) → 0 errors; dev.log clean (only transient HMR window error, resolved)
- Test artifacts cleaned; refreshed download/yassaei-electronics-nextjs.zip

Stage Summary:
- Guests can self-serve order tracking with code+phone; admin gets 14-day revenue chart + status distribution
- New API: POST /api/orders/track; adminStats extended with dailyRevenue (backward compatible)
- Keyboard-first UX (Ctrl+K, /) and footer newsletter added

---
Task ID: 9
Agent: main agent (Z.ai) — recurring webDevReview round
Task: UX polish (zoom/titles/print/CSV) + admin tab bug fix

Work Log:
- Status assessment: services healthy; 9-route regression sweep clean
- STYLING: product gallery zoom-on-hover (transform-origin follows cursor, scale 1.9, hint chip, cursor-zoom-in)
- FEATURE dynamic document.title: usePageTitle hook (router.ts) + central ROUTE_TITLES map in Router + ProductView overrides with product name (verified: "کلید مینیاتوری ۱۶ آمپر | یاسایی الکترونیک", all 7 routes)
- FEATURE order page: copy tracking code button (clipboard API + execCommand fallback + graceful error toast) + چاپ فاکتور print button; print:hidden on header/footer/mobile-nav/back-to-top + @media print CSS (white bg, glass flattening) → clean invoice output
- FEATURE admin CSV export: خروجی CSV button in products tab — fetches all pages, BOM+quoted CSV (12 Persian headers incl. category name), downloads yassaei-products-YYYY-MM-DD.csv; verified ۱۲۱ کالا exported
- META: new public/icon.svg (brand gradient lightning bolt) + OpenGraph metadata + multi-icon setup
- BUG FIXED: /admin?tab= query-only changes didn't remount AdminView (AnimatePresence key = route.path) → dashboard "recent orders" links never switched to orders tab. Fixed via render-time state adjustment on initialTab prop change (react-hooks/set-state-in-effect-safe pattern); verified orders tab activates on row click
- Lint 0 errors; dev.log clean; icon.svg 200; back-to-top verified; qa-admin-products-csv.png captured

Stage Summary:
- Store gained gallery zoom, per-route tab titles, invoice printing + code copy, admin CSV export
- Fixed real navigation bug in admin tabs (query-param deep links now work in-app)
- Deliverable zip refreshed below (Task 9 packaging)

---
Task ID: 10
Agent: main agent (Z.ai) — recurring webDevReview round
Task: light/dark theme system + QA bug fixes (hydration, chart bars, gradient text)

Work Log:
- Status assessment: both services healthy; 10-route agent-browser regression sweep clean (0 page errors); lint clean
- NEW FEATURE theme system:
  - globals.css restructured: light palette on :root (cool-tinted oklch neutrals, darker chart/ring colors for contrast), original dark palette under .dark; color-scheme per theme; ::selection brand tint; theme-aware .brand-text gradient via --brand-grad-a/b vars
  - layout.tsx: removed hardcoded className="dark"; wrapped app in next-themes ThemeProvider (attribute="class", defaultTheme="dark", enableSystem=false, disableTransitionOnChange)
  - New theme-toggle.tsx: mounted-safe via useSyncExternalStore (no setState-in-effect lint error), pre-mount theme-independent label ("تغییر پوسته روشن/تیره") to avoid hydration mismatch; Sun/Moon swap with animate-in
  - Header: toggle in desktop icon strip; mobile Sheet gained "پوسته سایت" row + "پیگیری سفارش" quick link
- NEW FEATURE a11y: ProductCard div-onClick → stretched-link pattern (real <a href="#/product/:id"> overlay, card focus-within ring, buy button z-fixed, views badge pointer-events-none) — keyboard focus, middle-click, new-tab all work
- BUG FIXED #1 (this round): hydration mismatch on ThemeToggle Button aria-label/title — SSR assumed dark fallback while light-theme users resolved light on first client render; fixed with mounted-gated static pre-mount label; verified overlay issue gone with theme=light in localStorage
- BUG FIXED #2 (since Task 8): admin 14-day revenue chart bars rendered 0px tall — % heights resolved against content-sized flex column (items-end, no definite height); fixed with definite-height tracks (flex-1 min-h-0, bg-secondary/35, rounded) + h-full columns; bars now render (today = 128px @100%, zero-days = 2% stubs), hover tooltips no longer clipped
- BUG FIXED #3 (this round, dark mode): "یک‌جا در یاسایی" rendered as solid gradient box — .dark .brand-text background SHORTHAND reset background-clip to border-box; refactored to --brand-grad vars on :root/.dark so clip:text declares once; verified clip:text in both themes
- NOTE: Turbopack ignored `touch` on globals.css — only real content edits trigger CSS rebuild; detected via stale compiled chunk
- Verified in browser: dark↔light round-trip (class + localStorage persist + correct labels), light home/catalog/product/admin screenshots, dark home/admin, mobile sheet toggle + 390px layout, card anchor real-mouse navigation, buy button adds to cart, keyboard focus ring; 0 page errors across 10 routes
- Screenshots: qa-light-{home,catalog,product,admin,mobile-sheet}.png, qa-dark-{home,catalog,admin,admin-chart-fixed,mobile}.png in download/
- Deliverable refreshed: download/yassaei-electronics-nextjs.zip (3.9 MB, unzip -t clean; includes theme-toggle.tsx, updated README v4, worklog)

Stage Summary:
- Store now ships a complete dual-theme system (default dark, toggle-persisted light) with zero hydration warnings
- Fixed 2 real UI bugs this round (admin chart invisible since Task 8; dark-mode gradient-text regression) + 1 self-introduced hydration mismatch caught and resolved before ship
- Product cards are now proper accessible anchors; no API changes this round
- Next-round ideas: quantity-tier discounts on the buy box, product Q&A section, stock-change email hooks, admin orders tab status timeline polish

---
Task ID: 11
Agent: main agent (Z.ai) — recurring webDevReview round
Task: bulk quantity-tier discounts + product Q&A + browser QA

Work Log:
- Status assessment: backend 4000 healthy, frontend 3000 = 200, lint clean; 8-route agent-browser regression sweep → 0 page errors (one transient stale-chunk error traced to an intermediate HMR state of my own edit, resolved by real content edit + fresh browser; final sweep 9 routes 0 errors)
- NEW FEATURE bulk quantity-tier discounts (top suggestion from Task 10):
  - Backend (shop.ts): BULK_TIERS [5→3%, 10→7%, 25→12%] + bulkTierFor/bulkUnitPrice helpers; cartValidate returns per-item unitPrice/bulkPercent + bulkDiscount (subtotal now post-tier); createOrder prices items server-side, persists unitPrice/bulkPercent on OrderItem + bulkDiscount on Order (coupon minSubtotal applies against discounted subtotal); new GET /api/bulk-tiers (single source of truth)
  - Frontend: src/lib/store/bulk.ts (useBulkTiers query + tierForQty/discountedUnit/nextTier, fallback mirror); buy box shows tier chips (active tier glows emerald), live line total + "سود شما X تومان (٪Y)" when tier active, "با N عدد بیشتر، ٪X تخفیف" nudge below first tier; cart lines show "٪۷ عمده" badge + struck-through list price; cart/checkout summary gain "تخفیف خرید عمده −…" row; OrderDetails renders effective per-item price + bulk row (backward-compatible with old orders via unitPrice ?? price)
- NEW FEATURE product Q&A:
  - Backend: types.QAQuestion + questions[] in DBState/db load defaults; new routes module questions.ts — GET/POST /api/products/:id/questions (public ask, name+question validation, length caps, 3-per-10min flood guard, answered-first sort), admin list (embeds productName, pending-first, status filter, pending count), PATCH answer, DELETE, GET /api/admin/questions/count
  - Frontend: product page "پرسش و پاسخ" section (count badge, answered-first list, amber "در انتظار پاسخ" / emerald "پاسخ داده شد" chips, brand-tinted "پاسخ فروشگاه یاسایی" reply block, guest ask form with name field hidden for logged-in users); admin "پرسش‌ها" tab (4th tab, amber pending-count badge polled 60s, filter pending/answered/all, inline answer editor + edit-answer + two-step delete confirm)
- Verified E2E in browser: tier math (qty 10 → unitPrice ۱۳,۹۵۰, سود ۱۰,۵۰۰ ٪۷; qty 5 → ٪۳; order YS-00002 bulkDiscount ۱۲,۶۰۰), guest question ask → appears "در انتظار پاسخ", admin login → answer submit → pending list empties + tab badge clears, product page shows full answer block, cart 11× → badge + −۱۱,۵۵۰ row + total ۲۷۳,۴۵۰ exact, old order o-0001 renders unchanged (no bulk row), mobile 390px cart correct
- DATA: cleaned test order YS-00002 from db.json + restored ys-005 to seed values (stock 220/sold 0); seeded 2 demo questions (ys-005 answered, ys-012 pending → admin badge shows ۱); test localStorage (cart/token) cleared; backend restarted healthy
- STYLING (mandatory): emerald tier chips with glow shadow, emerald savings box in buy box, bulk badges + struck prices in cart, brand-tinted Q&A reply blocks, admin pending badge; screenshots: qa-bulk-tiers.png, qa-product-questions.png, qa-admin-questions.png, qa-cart-bulk-mobile.png (download/)
- Lint 0 errors; dev.log clean (only transient ECONNREFUSED during intentional backend restart)
- Deliverable refreshed: download/yassaei-electronics-nextjs.zip (v5) + download/README.md updated

Stage Summary:
- Store now has wholesale bulk pricing (server-authoritative, tamper-proof) and a full public Q&A loop with admin moderation
- API additions: GET /api/bulk-tiers; GET+POST /api/products/:id/questions; GET /api/admin/questions; PATCH+DELETE /api/admin/questions/:id; GET /api/admin/questions/count — all backward compatible
- Order/cart contract extended: CartValidatedItem/OrderItem + unitPrice/bulkPercent, Order + bulkDiscount, cart/validate + bulkDiscount — old orders render correctly
- Known notes: bulk tiers are a backend constant (exposed via /api/bulk-tiers, frontend mirrors fallback); Q&A flood guard limits 3 unanswered asks per name/product per 10min
- Next-round ideas: per-product bulk-tier overrides in admin product form, Q&A "helpful" votes, admin orders tab status timeline, export Q&A to CSV, show bulk savings in admin revenue analytics

---
Task ID: 12
Agent: main agent (Z.ai) — recurring webDevReview round
Task: Q&A helpful votes + order status timeline + admin Q&A CSV + db durability fix

Work Log:
- Status assessment: both services healthy, lint clean; 9-route sweep 0 errors → stable, proceeded with Task 11's next-round ideas
- NEW FEATURE Q&A helpful votes: POST /api/questions/:id/vote {up|down} (public, answer required, floor at 0); product page answer blocks now have a "مفید بود؟/مفید بود (n)" toggle (ThumbsUp, aria-pressed, optimistic query-cache update, localStorage yassaei.qa-votes guard, revert on API error). Verified E2E: up→۲ persisted server-side, retract→۱, UI label/count flip both ways
- NEW FEATURE order status timeline: Order += statusHistory (OrderStatusEvent[]); createOrder seeds [{pending, createdAt}]; adminPatchOrder appends transitions (dedupes consecutive, seeds origin for legacy orders, caps 20). New shared StatusTimeline strip (colored dot chips + relative time, History icon) rendered in OrderDetails (customer/track/order pages) and each admin OrdersTab card. Verified E2E: test order patched pending→processing→shipped via UI buttons → 3 chips with times, server audit trail exact; legacy o-0001 renders single chip fallback
- NEW FEATURE admin Q&A CSV export: "خروجی CSV" button in questions tab (all pages, BOM+quoted CSV, 8 Persian headers incl. productName + helpful + answeredAt) — verified ۲ پرسش exported with correct content
- BUG/HARDENING fixes this round:
  1. voteQuestion 500 (missing `str` import) — caught by curl smoke test, fixed immediately
  2. db.json durability: writeAtomic now write+fsync+rename (openSync/writeSync/fsyncSync/closeSync) — protects against truncated DB on crash
  3. demo data fix: qa-demo-2 pointed at ys-012 (سیم قلع) while asking about NE555 → repointed to ys-004 (verified via suggest API)
  4. DATA CLEANUP with backend STOPPED: removed timeline test order, restored ys-005 stock 220/sold 0; test browser localStorage cleared
- QA PROCESS LEARNINGS (important for future rounds):
  - agent-browser `open` on a URL that only differs in hash → NO reload (SPA nav) → stale DOM + stale TanStack cache can fake bugs ("deleted order still visible"); always open about:blank first for true reloads
  - Turbopack stale chunk regression (round 3): after rapid successive edits to one big file, browser may cache an intermediate chunk; fix = real content edit + agent-browser close (fresh browser)
  - NEVER edit backend/data/db.json while the backend runs (in-memory state overwrites on next flush + divergent state); stop → edit → start
- Lint 0 errors; 11-route sweep (incl. #/order/o-0001 legacy) 0 page errors; dev.log clean
- Screenshots: qa-admin-order-timeline.png, qa-product-qa-pending.png (download/)

Stage Summary:
- Q&A loop is now community-validated (helpful votes); orders have a real audit trail visible to both admins and customers; admin can export the full Q&A queue
- API additions: POST /api/questions/:id/vote; Order.statusHistory (backward compatible — legacy orders fall back to a derived single-chip timeline)
- DB writes are now fsync-durable; three QA-process pitfalls documented above to avoid repeat confusion
- Next-round ideas: per-product bulk-tier overrides in admin product form, product-image lightbox on order/admin cards, admin dashboard "pending Q&A" widget linking to the tab, i18n prep (extract hardcoded Persian strings), Lighthouse a11y/perf pass

---
Task ID: 13
Agent: main agent (Z.ai) — recurring webDevReview round
Task: per-product bulk-tier overrides + image lightbox + dashboard Q&A widget + share button

Work Log:
- Status assessment: both services healthy, lint clean; 10-route agent-browser sweep → 0 page errors → stable, proceeded with Task 12's next-round ideas
- QA note: a suspected "corrupted CSV line" in admin-view (`eaders.map`) turned out to be a terminal-display artifact — hexdump showed valid `"\ufeff" + [headers.map(...), ...rows].join(...)`; verified with `bunx eslint` on the file (clean). Don't trust `[h`-swallowed grep/sed output for RTL-heavy files.
- NEW FEATURE per-product bulk-tier overrides (top suggestion from Tasks 11/12):
  - Backend: Product += `bulkTiers?: BulkTier[] | null`; `bulkUnitPrice(price, qty, override?)` falls back to global BULK_TIERS when override is absent/invalid (shape-checked); new `sanitizeBulkTiers()` validator (absent→undefined keep, null/[]→clear, ≤4 rows, minQty ≥ 2, percent 1–90, sorted ascending, unique minQty, Persian error messages); wired into cartValidate + createOrder + adminPatchProduct + adminCreateProduct
  - Frontend: Product type += bulkTiers; `useProductTiers(product)` in bulk.ts (override when valid else global query, hook-safe with undefined product); buy box chips/live-total/nudge all use it
  - Admin product edit dialog: "تخفیف عمده اختصاصی" switch + dynamic rows (minQty + percent, add/remove, ≤4, global-rate hint); save sends `bulkTiers: rows` (on) or `null` (off → global rates)
- NEW FEATURE fullscreen image lightbox (src/components/store/lightbox.tsx): gallery click/Enter opens; Esc close, ←/→ navigate (RTL-aware), Persian slide counter, thumbnail strip, click-to-toggle 1.9× zoom, body scroll lock, AnimatePresence fade/zoom, print:hidden; main image hint updated to "برای بزرگ‌نمایی کلیک کنید"; gallery is now a keyboard-accessible role=button
- NEW FEATURE admin dashboard pending-Q&A widget (PendingQuestionsWidget): amber card, count badge from `data.pending`, latest 3 unanswered (product name + snippet + timeAgo, 60s poll), CTA deep-links to questions tab; auto-hides at 0 pending; refreshes when QuestionsTab invalidates `["admin-questions"]` prefix
- NEW FEATURE share button on product page: navigator.share → clipboard → execCommand fallback chain with AbortError handling; toast "نشانی کالا کپی شد"
- STYLING: lightbox glass/dark aesthetics (blur backdrop, hover states, animate-in buttons), amber widget card, tier editor rows in secondary-tinted panel
- Verified E2E: API smoke (set override → cart qty3 = 13500/٪۱۰; percent 95 → 400; duplicate minQty → 400; null → cleared; qty3 → 15000/۰) + admin UI loop (edit ys-005 → 2 rows prefilled 3/10+10/18 → edited to 5/15+10/25 → saved → persisted in GET /api/products/ys-005 → buy box nudge "با ۴ عدد بیشتر، ٪۱۵" → cart qty5 = 12750/٪۱۵) + lightbox (open, counter ۱/۱, overflow hidden, Esc closes + overflow restored, mobile 390px screenshot) + share toast + dashboard widget visible with "۱ پرسش" deep-link (verified tab activation)
- DATA cleaned: ys-005 override cleared (null) after tests, global tier confirmed (qty5 → 14550/٪۳); browser localStorage cleared; admin token file removed
- Lint 0 errors; backend `tsc --noEmit` clean; dev.log only historical Fast-Refresh entries from earlier rounds' fixed bugs, recent entries all 200s
- Deliverable refreshed: download/yassaei-electronics-nextjs.zip (3.96MB, 623 files, unzip -t clean) + README v7; new screenshots: qa-product-custom-tiers.png, qa-lightbox.png, qa-lightbox-mobile.png, qa-admin-qa-widget.png

Stage Summary:
- Wholesale pricing is now fully configurable per product with server-side validation; store-wide rates remain the default and all pricing stays server-authoritative
- Product pages gained a polished fullscreen gallery viewer and share affordance; admins get unanswered-Q&A surfaced directly on the dashboard
- API: PATCH/POST admin products accept `bulkTiers` (null clears); no breaking changes — products without the field behave exactly as before
- QA-process learnings: hexdump-verify suspected corrupted lines in RTL-heavy files before "fixing" them; `agent-browser set viewport W H` works for mobile shots
- Next-round ideas: bulk-tier preview inside the admin dialog (live unit-price table), order-page "reorder" button, admin low-stock restock quick-action, catalog sort by discount %, PWA manifest + offline shell

---
Task ID: 14
Agent: main agent (Z.ai) — recurring webDevReview round
Task: reorder button + restock quick-action + discount sort + admin tier preview + infra diagnosis

Work Log:
- STATUS ASSESSMENT / INFRA INCIDENT (important for future rounds):
  - Found the Next.js dev server DEAD at round start (backend 4000 was fine). Diagnosis journey:
    1. First assumed OOM — dmesg confirmed one OOM kill of next-server (RSS 1.6GB; Chrome renderers + Next compile exceed the 4GB cgroup). Mitigation: `agent-browser close` when not actively QA-ing.
    2. But servers I spawned still died silently at EVERY Bash tool-call boundary — even with setsid/nohup (survived 2min within one call, died the moment the call ended).
    3. WORKING SPAWN RECIPE (verified across many calls): double-fork in a subshell + direct node, no bun wrapper/pipeline:
       `(setsid nohup node ./node_modules/next/dist/bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null &)`
       Backend recipe unchanged: `(setsid nohup bun --hot src/index.ts >> backend.log 2>&1 < /dev/null &)` — both survived the whole round.
  - Lint "2 errors" were pre-existing, in original/public/js/vendor/jsbarcode.all.min.js (reference clone). Fixed eslint.config.mjs ignores to exclude original/, download/, tool-results/, agent-ctx/ → `bun run lint` now exits clean.
- QA: 14-route agent-browser sweep with content verification → 0 page errors (first two sweeps were false-clean: connection-refused pages emit no JS errors — always pair `errors` with a content check, e.g. `document.body.innerText.length > 100`).
- NEW FEATURE reorder (order page): green "سفارش مجدد" button in the success banner next to print. Fetches productsByIds for the order items, re-adds still-available ones at original qty (Map-merged, ≤99), counts skipped items, toast with "مشاهدهٔ سبد" action; error path if nothing available. Verified E2E with guest order YS-00002 (12× ys-005 + 2× ys-001): toast "۲ قلم کالا به سبد خرید اضافه شد", localStorage cart exact, cart page shows bulk tier + تخفیف خرید عمده row.
- NEW FEATURE admin restock quick-action: stock < 5 rows get emerald "شارژ ۱۰" button (aria-label, disabled ≥95) → PATCH stock+10 → toast "موجودی «…» به ۱۳ رسید"; dashboard low-stock banner gained a "شارژ موجودی" CTA deep-linking to ?tab=products. Verified E2E (ys-001 3→13).
- NEW FEATURE catalog discount sort: backend SORTERS.discount via discountFrac (deals by % desc, non-deals sink at -1); frontend option "بیشترین تخفیف". Verified API (13.5%→13.9%… descending, only oldPrice items) + UI (badges ٪۱۳ ٪۱۱ ٪۱۰ …).
- NEW FEATURE admin tier live preview: emerald panel inside the custom-tiers editor showing per-tier unit price using the SAME Math.floor(price×(100−pct)/100) as the backend. Verified E2E: ys-005 @15000, row 5/٪۱۵ → "۱۲,۷۵۰ تومان / عدد"; canceled without saving (bulkTiers stayed null).
- STYLING (mandatory): emerald reorder CTA w/ shadow, emerald restock button + amber dashboard CTA, emerald tier-preview panel with BadgePercent header, discount % corner badges already present on cards; mobile 390px order page verified (no h-overflow).
- DATA cleaned with backend stopped: ys-001 → stock 298/sold 2, ys-005 → 220/0 (seed values), test order o-0002 removed (now 404); browser localStorage cleared; admin token file removed.
- Lint 0 errors; backend `tsc --noEmit` clean; final 6-route sweep 0 errors; both services healthy at handover.
- Deliverable refreshed: download/yassaei-electronics-nextjs.zip (3.8MB, 629 files, unzip -t clean; now INCLUDES backend/data/db.json for out-of-box data, excludes *.log) + README v8; new screenshots: qa-catalog-discount-sort.png, qa-admin-tier-preview.png, qa-order-reorder-mobile.png, qa-cart-after-reorder.png.

Stage Summary:
- Shoppers can reorder any past order in one click (availability-aware); admins can restock scarce items in one click and see wholesale prices while typing tiers; catalog gained deal-ranked sorting.
- API addition: `sort=discount` on GET /api/products (backward compatible). No schema changes — reorder/restock/preview all reuse existing endpoints.
- Infra learnings recorded above (OOM root cause + surviving spawn recipes + false-clean sweep pitfall) — future rounds should reuse them instead of re-diagnosing.
- Next-round ideas: PWA manifest + offline shell, per-order invoice PDF/print stylesheet polish, admin orders tab search by code/phone, wishlist share list, low-stock threshold configurable in settings.

---
Task ID: 15
Agent: main agent (Z.ai) — recurring webDevReview round
Task: admin orders search + configurable low-stock threshold + wishlist share + PWA manifest

Work Log:
- Status assessment: both services survived from last round (spawn recipes held across rounds); lint clean; 6-route agent-browser sweep with content checks → 0 page errors → stable, proceeded with Task 14's next-round ideas.
- NEW FEATURE admin orders search:
  - Backend adminListOrders: `q` param matches tracking code / order id (case-insensitive substring), customer name (normalized), phone digits (digit-stripped both sides so ۰۹۱۲ Persian or 0912 work), and order-item names; composes with the status filter.
  - Frontend OrdersTab: search input with Search icon (aria-label جست‌وجوی سفارش), live result count "N نتیجه", empty state differentiates "no match for «q»" vs "no orders with this status".
  - Verified E2E: "YS-00001" → ۱ نتیجه + card rendered; phone "0912" → ۱ نتیجه.
- NEW FEATURE configurable low-stock threshold:
  - Backend: `lowStockThreshold(store)` reads `settings.inventory.lowStockThreshold` (clamped 1..100, default 5); adminStats uses it and returns `lowStockThreshold`; new GET/PATCH `/api/admin/settings` (admin-only, transaction-persisted, Persian validation errors).
  - Frontend: ProductsTab toolbar gained an "آستانه: N" Popover editor (number input + ذخیره); stock-cell colors and quick-restock visibility now use the threshold; dashboard cards/banner text use it too.
  - Verified E2E: set 8 → toast + trigger label updates + persisted via API; ys-002 stock 6 (invisible at 5) now shows the شارژ button and amber color; validation 200 → 400 with Persian message; reset to 5 afterwards.
- NEW FEATURE wishlist share:
  - "اشتراک‌گذاری" button (violet accent, Share2) builds formatted text list (numbered items + prices + جمع تقریبی) → navigator.share (AbortError = user cancelled = silent) → async clipboard → execCommand legacy → graceful manual-copy Dialog (readonly Textarea auto-selects on focus + copy retry + Ctrl+C hint). 
  - Verified E2E in headless (where share/clipboard/execCommand are ALL blocked): dialog opens with correctly formatted Persian text incl. price; the automatic paths are correct for real browsers by construction (checked raw clipboard → NotAllowedError in headless first).
- NEW FEATURE PWA manifest: public/manifest.json (RTL fa, standalone, theme/background #0d1520, SVG icon any+maskable, shortcuts: فروشگاه / سبد خرید / پیگیری سفارش); layout metadata manifest + applicationName + apple icon; verified served at /manifest.json and `<link rel="manifest">` in SSR HTML.
- STYLING (mandatory): violet share button, Search-icon admin input, threshold popover with hint text, result-count chip; consistent glass/secondary aesthetics.
- QA pitfalls encountered (documented to avoid repeats): (1) `agent-browser open` to a hash-only-different URL does NOT reload — stale DOM made the wishlist look empty; open about:blank first. (2) DOM-order-first selector for "fav button" hit a RELATED-product card heart instead of the buy-box fav — scope selectors tightly. (3) prefers Persian digits in aria-labels — template literals render Latin digits, match accordingly.
- DATA cleaned: threshold reset to 5 (now an explicit setting — default-equivalent), ys-002 → 250/0 seed, browser localStorage cleared, admin token file removed.
- Lint 0 errors; backend tsc clean; final 8-route sweep 0 errors; both services healthy.
- Deliverable refreshed: download/yassaei-electronics-nextjs.zip (3.8MB, 631 files, unzip -t clean) + README v9; new screenshots: qa-admin-threshold.png, qa-wishlist-share.png.

Stage Summary:
- Admins can now find any order instantly (code/name/phone/item) and tune the low-stock threshold shop-wide instead of a hardcoded 5; shoppers can share their wishlist through any channel.
- API additions: GET+PATCH /api/admin/settings; `q` on GET /api/admin/orders; `lowStockThreshold` on admin stats — all backward compatible.
- PWA baseline installed (manifest + shortcuts); no service worker yet (that would be the actual "offline shell" step).
- Next-round ideas: service worker + offline shell (complete the PWA), invoice PDF/print template, per-order admin notes, sales chart by category, i18n string extraction, Lighthouse a11y/perf pass.
