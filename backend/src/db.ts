/**
 * Atomic JSON-file store.
 *
 * - Full state is kept in memory and mutated synchronously by route handlers.
 * - Writes are debounced (~200ms): state is serialized to `db.json.tmp` and the
 *   file is then renamed over `db.json`, so readers never see a partial file.
 * - `transaction()` gives all-or-nothing semantics: if the mutator throws, the
 *   in-memory state is rolled back from a snapshot and nothing is saved.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DBState } from './types';
import { ADMIN_PASSWORD, DB_PATH } from './config';
import { hashPassword } from './auth';
import { nowISO } from './util';

const SAVE_DEBOUNCE_MS = 200;

function emptyState(): DBState {
  return {
    version: 1,
    seededAt: nowISO(),
    settings: {},
    categories: [],
    brands: [],
    products: [],
    pages: {},
    coupons: [],
    users: [],
    sessions: [],
    orders: [],
    reviews: [],
    stats: { ordersTotal: 0, revenueTotal: 0 },
  };
}

export class Store {
  private data: DBState;
  private dbPath: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving = false;
  private pendingSave = false;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
    this.data = this.load();
    this.seedOwnerIfNeeded();
  }

  /** Live database state (mutate only inside transaction() or simple in-place edits + touch()). */
  get db(): DBState {
    return this.data;
  }

  private load(): DBState {
    try {
      if (!existsSync(this.dbPath)) {
        console.warn(`[db] ${this.dbPath} not found — starting with an empty state`);
        return emptyState();
      }
      const parsed = JSON.parse(readFileSync(this.dbPath, 'utf8')) as Partial<DBState>;
      const base = emptyState();
      const state: DBState = {
        ...base,
        ...parsed,
        settings: parsed.settings ?? base.settings,
        pages: parsed.pages ?? base.pages,
        stats: parsed.stats ?? base.stats,
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        brands: Array.isArray(parsed.brands) ? parsed.brands : [],
        products: Array.isArray(parsed.products) ? parsed.products : [],
        coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      };
      console.log(
        `[db] loaded ${state.products.length} products, ${state.categories.length} categories, ` +
          `${state.users.length} users, ${state.orders.length} orders from ${path.basename(this.dbPath)}`,
      );
      return state;
    } catch (err) {
      console.error('[db] failed to load database file — using empty state', err);
      return emptyState();
    }
  }

  /** First boot: create the owner account from ADMIN_PASSWORD (or its fallback). */
  private seedOwnerIfNeeded(): void {
    if (this.data.users.length > 0) return;
    const owner = {
      id: 'u-admin',
      username: 'admin',
      name: 'مدیر یاسایی',
      role: 'owner' as const,
      phone: '',
      passwordHash: hashPassword(ADMIN_PASSWORD),
      createdAt: nowISO(),
      lastLoginAt: null,
    };
    this.data.users.push(owner);
    this.flushSync();
    console.log('[db] users[] was empty — seeded owner account "admin"');
  }

  /** Schedule a debounced save (call after any in-place mutation). */
  touch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /** All-or-nothing mutation helper: rollback in-memory state if fn throws. */
  transaction<T>(fn: (db: DBState) => T): T {
    const snapshot = structuredClone(this.data);
    try {
      const result = fn(this.data);
      this.touch();
      return result;
    } catch (err) {
      this.data = snapshot;
      throw err;
    }
  }

  /** Write state to tmp file then atomically rename over the real file. */
  async flush(): Promise<void> {
    if (this.saving) {
      this.pendingSave = true;
      return;
    }
    this.saving = true;
    try {
      this.writeAtomic();
    } catch (err) {
      console.error('[db] async save failed', err);
    } finally {
      this.saving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        void this.flush();
      }
    }
  }

  /** Synchronous flush used on first boot and graceful shutdown. */
  flushSync(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.writeAtomic();
    } catch (err) {
      console.error('[db] sync save failed', err);
    }
  }

  private writeAtomic(): void {
    const dir = path.dirname(this.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.dbPath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 1), 'utf8');
    renameSync(tmp, this.dbPath);
  }

  /** Human-readable db file size, for startup logs. */
  fileSizeKB(): number {
    try {
      return Math.round(statSync(this.dbPath).size / 1024);
    } catch {
      return 0;
    }
  }
}
