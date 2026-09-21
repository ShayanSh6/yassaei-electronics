/**
 * PostgreSQL persistence driver — Bun's built-in SQL client (zero npm deps).
 *
 * Layout: one table per collection. Every row keeps the exact API object in a
 * `data jsonb` column (single source of truth for the API surface) plus a few
 * mirrored hot columns (price/stock/status/…) so the data stays queryable with
 * plain SQL and indexed for future reports. Scalar documents (meta/settings/
 * pages/stats) live in `kv_state`.
 *
 * Write path: the Store keeps live state in memory and calls save() on each
 * debounced flush; save() rewrites every collection inside ONE transaction
 * (DELETE + ordered re-INSERT). ~160 tiny rows → a few ms on localhost, and
 * deletions can never drift between memory and disk.
 */
import { SQL } from 'bun';
import type { DBState } from './types';

/** jsonb values may arrive as parsed objects or raw strings depending on driver — normalize. */
function j<T = unknown>(v: unknown): T {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return undefined as T;
    }
  }
  return (v ?? undefined) as T;
}

export class PgDriver {
  readonly name = 'postgres' as const;
  private sql: SQL;

  constructor(url: string) {
    this.sql = new SQL(url);
  }

  /** Fail fast when the server is unreachable (3s budget). */
  async probe(): Promise<void> {
    await Promise.race([
      this.sql`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('postgres connect timeout (3s)')), 3000),
      ),
    ]);
  }

  async ensureSchema(): Promise<void> {
    await this.sql`CREATE TABLE IF NOT EXISTS kv_state (
      key   text PRIMARY KEY,
      value jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS categories (
      id        text PRIMARY KEY,
      ord       int NOT NULL,
      parent_id text,
      active    boolean,
      data      jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS brands (
      id     text PRIMARY KEY,
      ord    int NOT NULL,
      active boolean,
      data   jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS products (
      id          text PRIMARY KEY,
      ord         int NOT NULL,
      sku         text,
      price       numeric NOT NULL,
      old_price   numeric,
      stock       int NOT NULL DEFAULT 0,
      sold        int NOT NULL DEFAULT 0,
      category_id text,
      brand_id    text,
      featured    boolean,
      active      boolean,
      rating_avg  numeric,
      views       int,
      created_at  timestamptz,
      updated_at  timestamptz,
      data        jsonb NOT NULL
    )`;
    await this.sql`CREATE INDEX IF NOT EXISTS products_price_idx    ON products (price)`;
    await this.sql`CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS products_stock_idx    ON products (stock)`;
    await this.sql`CREATE TABLE IF NOT EXISTS coupons (
      code   text PRIMARY KEY,
      ord    int NOT NULL,
      active boolean,
      data   jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS users (
      id       text PRIMARY KEY,
      ord      int NOT NULL,
      username text,
      role     text,
      data     jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS sessions (
      token      text PRIMARY KEY,
      ord        int NOT NULL,
      user_id    text,
      created_at timestamptz,
      data       jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS orders (
      id         text PRIMARY KEY,
      ord        int NOT NULL,
      code       text,
      phone      text,
      status     text,
      total      numeric,
      created_at timestamptz,
      data       jsonb NOT NULL
    )`;
    await this.sql`CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at)`;
    await this.sql`CREATE INDEX IF NOT EXISTS orders_status_idx  ON orders (status)`;
    await this.sql`CREATE TABLE IF NOT EXISTS reviews (
      id         text PRIMARY KEY,
      ord        int NOT NULL,
      product_id text,
      rating     int,
      created_at timestamptz,
      data       jsonb NOT NULL
    )`;
    await this.sql`CREATE TABLE IF NOT EXISTS questions (
      id         text PRIMARY KEY,
      ord        int NOT NULL,
      product_id text,
      answered   boolean,
      created_at timestamptz,
      data       jsonb NOT NULL
    )`;
  }

  async load(): Promise<DBState | null> {
    const kvRows = await this.sql`SELECT key, value FROM kv_state`;
    const kv = new Map<string, unknown>();
    for (const r of kvRows) kv.set(String(r.key), j(r.value));
    const meta = j<{ version?: number; seededAt?: string }>(kv.get('meta'));

    const categories = await this.sql`SELECT data FROM categories ORDER BY ord`;
    const brands = await this.sql`SELECT data FROM brands ORDER BY ord`;
    const products = await this.sql`SELECT data FROM products ORDER BY ord`;
    const coupons = await this.sql`SELECT data FROM coupons ORDER BY ord`;
    const users = await this.sql`SELECT data FROM users ORDER BY ord`;
    const sessions = await this.sql`SELECT data FROM sessions ORDER BY ord`;
    const orders = await this.sql`SELECT data FROM orders ORDER BY ord`;
    const reviews = await this.sql`SELECT data FROM reviews ORDER BY ord`;
    const questions = await this.sql`SELECT data FROM questions ORDER BY ord`;

    // Fresh cluster → tell the Store to migrate its JSON seed instead.
    if (!meta && products.length === 0) return null;

    return {
      version: meta?.version ?? 1,
      seededAt: meta?.seededAt ?? new Date().toISOString(),
      settings: j<DBState['settings']>(kv.get('settings')) ?? {},
      pages: j<DBState['pages']>(kv.get('pages')) ?? {},
      stats: j<DBState['stats']>(kv.get('stats')) ?? { ordersTotal: 0, revenueTotal: 0 },
      categories: categories.map((r: { data: unknown }) => j(r.data)),
      brands: brands.map((r: { data: unknown }) => j(r.data)),
      products: products.map((r: { data: unknown }) => j(r.data)),
      coupons: coupons.map((r: { data: unknown }) => j(r.data)),
      users: users.map((r: { data: unknown }) => j(r.data)),
      sessions: sessions.map((r: { data: unknown }) => j(r.data)),
      orders: orders.map((r: { data: unknown }) => j(r.data)),
      reviews: reviews.map((r: { data: unknown }) => j(r.data)),
      questions: questions.map((r: { data: unknown }) => j(r.data)),
    };
  }

  async save(state: DBState): Promise<void> {
    await this.sql.begin(async (tx) => {
      // ── scalar documents ──
      const kvUpsert = (key: string, value: unknown) =>
        tx`INSERT INTO kv_state (key, value) VALUES (${key}, ${value})
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await kvUpsert('meta', { version: state.version, seededAt: state.seededAt });
      await kvUpsert('settings', state.settings);
      await kvUpsert('pages', state.pages);
      await kvUpsert('stats', state.stats);

      // ── collections: ordered full sync (DELETE + re-INSERT inside the tx) ──
      await tx`DELETE FROM categories`;
      for (const [i, c] of state.categories.entries()) {
        await tx`INSERT INTO categories (id, ord, parent_id, active, data)
                 VALUES (${c.id}, ${i}, ${c.parentId}, ${c.active}, ${c})`;
      }

      await tx`DELETE FROM brands`;
      for (const [i, b] of state.brands.entries()) {
        await tx`INSERT INTO brands (id, ord, active, data)
                 VALUES (${b.id}, ${i}, ${b.active}, ${b})`;
      }

      await tx`DELETE FROM products`;
      for (const [i, p] of state.products.entries()) {
        await tx`INSERT INTO products (id, ord, sku, price, old_price, stock, sold, category_id,
                                       brand_id, featured, active, rating_avg, views,
                                       created_at, updated_at, data)
                 VALUES (${p.id}, ${i}, ${p.sku}, ${p.price}, ${p.oldPrice}, ${p.stock}, ${p.sold},
                         ${p.categoryId}, ${p.brandId}, ${p.featured}, ${p.active}, ${p.ratingAvg},
                         ${p.views}, ${p.createdAt}, ${p.updatedAt}, ${p})`;
      }

      await tx`DELETE FROM coupons`;
      for (const [i, c] of state.coupons.entries()) {
        await tx`INSERT INTO coupons (code, ord, active, data)
                 VALUES (${c.code}, ${i}, ${c.active}, ${c})`;
      }

      await tx`DELETE FROM users`;
      for (const [i, u] of state.users.entries()) {
        await tx`INSERT INTO users (id, ord, username, role, data)
                 VALUES (${u.id}, ${i}, ${u.username}, ${u.role}, ${u})`;
      }

      await tx`DELETE FROM sessions`;
      for (const [i, s] of state.sessions.entries()) {
        await tx`INSERT INTO sessions (token, ord, user_id, created_at, data)
                 VALUES (${s.token}, ${i}, ${s.userId}, ${s.createdAt}, ${s})`;
      }

      await tx`DELETE FROM orders`;
      for (const [i, o] of state.orders.entries()) {
        await tx`INSERT INTO orders (id, ord, code, phone, status, total, created_at, data)
                 VALUES (${o.id}, ${i}, ${o.code}, ${o.customer?.phone ?? null}, ${o.status},
                         ${o.total}, ${o.createdAt}, ${o})`;
      }

      await tx`DELETE FROM reviews`;
      for (const [i, r] of state.reviews.entries()) {
        await tx`INSERT INTO reviews (id, ord, product_id, rating, created_at, data)
                 VALUES (${r.id}, ${i}, ${r.productId}, ${r.rating}, ${r.createdAt},
                         ${r})`;
      }

      await tx`DELETE FROM questions`;
      for (const [i, q] of state.questions.entries()) {
        await tx`INSERT INTO questions (id, ord, product_id, answered, created_at, data)
                 VALUES (${q.id}, ${i}, ${q.productId}, ${Boolean(q.answer)}, ${q.createdAt},
                         ${q})`;
      }
    });
  }

  async describe(): Promise<Record<string, unknown>> {
    const t0 = performance.now();
    const rows = await this.sql`
      SELECT (SELECT count(*) FROM products)  AS products,
             (SELECT count(*) FROM orders)    AS orders,
             (SELECT count(*) FROM users)     AS users,
             (SELECT count(*) FROM reviews)   AS reviews,
             (SELECT count(*) FROM questions) AS questions,
             current_database()               AS database,
             version()                        AS version`;
    const latencyMs = Math.round((performance.now() - t0) * 10) / 10;
    const r = rows[0] as Record<string, unknown>;
    return {
      store: 'postgres',
      database: r.database,
      server: String(r.version).split(' ').slice(0, 2).join(' '),
      products: Number(r.products),
      orders: Number(r.orders),
      users: Number(r.users),
      reviews: Number(r.reviews),
      questions: Number(r.questions),
      latencyMs,
    };
  }

  async close(): Promise<void> {
    await this.sql.close();
  }
}
