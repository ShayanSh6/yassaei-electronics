/**
 * Yassaei Electronics — split backend service.
 * Standalone Bun HTTP server on port 4000 (env PORT), JSON-file storage.
 */
import type { Route, RouteCtx } from './types';
import { HOST, PORT } from './config';
import { Store } from './db';
import { HttpError, json } from './util';

import {
  getBrands,
  getCategories,
  getHome,
  getPage,
  getProduct,
  getProductReviews,
  getSettings,
  listProducts,
  suggest,
} from './routes/catalog';
import { login, me, register } from './routes/auth';
import {
  cartValidate,
  couponValidate,
  createOrder,
  createReview,
  getOrder,
  listMyOrders,
} from './routes/shop';
import {
  adminCreateProduct,
  adminDeleteProduct,
  adminListOrders,
  adminListProducts,
  adminListUsers,
  adminPatchOrder,
  adminPatchProduct,
  adminStats,
} from './routes/admin';

const store = new Store();

/** Robust HttpError detection (survives --hot module-generation mismatches). */
function isHttpError(err: unknown): err is HttpError {
  if (err instanceof HttpError) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'HttpError' &&
    typeof (err as { status?: unknown }).status === 'number'
  );
}

/* ---------- route table ---------- */

const routes: Route[] = [
  // public
  { method: 'GET', pattern: /^\/healthz$/, handler: () => json({ ok: true }) },
  { method: 'GET', pattern: /^\/api\/settings$/, handler: () => getSettings(store) },
  { method: 'GET', pattern: /^\/api\/home$/, handler: () => getHome(store) },
  { method: 'GET', pattern: /^\/api\/categories$/, handler: () => getCategories(store) },
  { method: 'GET', pattern: /^\/api\/brands$/, handler: () => getBrands(store) },
  {
    method: 'GET',
    pattern: /^\/api\/products$/,
    handler: (c: RouteCtx) => listProducts(store, c.url),
  },
  {
    method: 'GET',
    pattern: /^\/api\/search\/suggest$/,
    handler: (c: RouteCtx) => suggest(store, c.url),
  },
  {
    method: 'GET',
    pattern: /^\/api\/products\/(?<id>[^/]+)\/reviews$/,
    handler: (c: RouteCtx) => getProductReviews(store, c.params.id ?? ''),
  },
  {
    method: 'GET',
    pattern: /^\/api\/products\/(?<id>[^/]+)$/,
    handler: (c: RouteCtx) => getProduct(store, c.params.id ?? ''),
  },
  {
    method: 'GET',
    pattern: /^\/api\/pages\/(?<slug>[^/]+)$/,
    handler: (c: RouteCtx) => getPage(store, c.params.slug ?? ''),
  },

  // auth
  { method: 'POST', pattern: /^\/api\/auth\/register$/, handler: (c) => register(store, c.req) },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: (c) => login(store, c.req) },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, handler: (c) => me(store, c.req) },

  // shop
  { method: 'POST', pattern: /^\/api\/cart\/validate$/, handler: (c) => cartValidate(store, c.req) },
  { method: 'POST', pattern: /^\/api\/coupon\/validate$/, handler: (c) => couponValidate(store, c.req) },
  { method: 'POST', pattern: /^\/api\/orders$/, handler: (c) => createOrder(store, c.req) },
  { method: 'GET', pattern: /^\/api\/orders$/, handler: (c) => listMyOrders(store, c.req) },
  {
    method: 'GET',
    pattern: /^\/api\/orders\/(?<id>[^/]+)$/,
    handler: (c) => getOrder(store, c.req, c.params.id ?? ''),
  },
  { method: 'POST', pattern: /^\/api\/reviews$/, handler: (c) => createReview(store, c.req) },

  // admin
  { method: 'GET', pattern: /^\/api\/admin\/stats$/, handler: (c) => adminStats(store, c.req) },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/products$/,
    handler: (c) => adminListProducts(store, c.req, c.url),
  },
  {
    method: 'POST',
    pattern: /^\/api\/admin\/products$/,
    handler: (c) => adminCreateProduct(store, c.req),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/admin\/products\/(?<id>[^/]+)$/,
    handler: (c) => adminPatchProduct(store, c.req, c.params.id ?? ''),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/admin\/products\/(?<id>[^/]+)$/,
    handler: (c) => adminDeleteProduct(store, c.req, c.params.id ?? ''),
  },
  {
    method: 'GET',
    pattern: /^\/api\/admin\/orders$/,
    handler: (c) => adminListOrders(store, c.req, c.url),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/admin\/orders\/(?<id>[^/]+)$/,
    handler: (c) => adminPatchOrder(store, c.req, c.params.id ?? ''),
  },
  { method: 'GET', pattern: /^\/api\/admin\/users$/, handler: (c) => adminListUsers(store, c.req) },
];

/* ---------- CORS ---------- */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/* ---------- dispatcher ---------- */

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '') || '/';
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = route.pattern.exec(pathname);
    if (match) {
      const ctx: RouteCtx = {
        req,
        url,
        params: (match.groups ?? {}) as Record<string, string>,
      };
      return route.handler(ctx);
    }
  }
  throw new HttpError(404, 'یافت نشد');
}

/* ---------- server ---------- */

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    try {
      return withCors(await handle(req));
    } catch (err) {
      if (isHttpError(err)) {
        return withCors(json({ error: err.message }, err.status));
      }
      console.error('[unhandled]', err);
      return withCors(json({ error: 'خطای سرور' }, 500));
    }
  },
});

function shutdown(): void {
  console.log('[yassaei-backend] shutting down — flushing db…');
  try {
    store.flushSync();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(
  `[yassaei-backend] listening on http://${HOST}:${server.port} — db: ${store.db.products.length} products, ${store.db.users.length} users`,
);
