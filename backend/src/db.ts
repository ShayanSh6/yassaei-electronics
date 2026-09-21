/**
 * In-memory store with pluggable persistence (PostgreSQL driver or JSON file).
 *
 * - Full state is kept in memory and mutated synchronously by route handlers.
 * - Persistence is debounced (~200ms). With the PostgreSQL driver attached the
 *   whole state is written in a single transaction (see db-pg.ts); otherwise it
 *   is serialized to `db.json.tmp` which is atomically renamed over `db.json`.
 * - `transaction()` gives all-or-nothing semantics: if the mutator throws, the
 *   in-memory state is rolled back from a snapshot and nothing is saved.
 * - If PostgreSQL is attached but a save fails, a JSON snapshot is written as
 *   a safety net so no data can be lost.
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import type { DBState, DbDriver } from './types';
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
    questions: [],
    stats: { ordersTotal: 0, revenueTotal: 0 },
  };
}

export class Store {
  private data: DBState;
  private dbPath: string;
  private driver: DbDriver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving = false;
  private pendingSave = false;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
    this.data = this.loadJson();
    this.seedOwnerIfNeeded();
  }

  /** Live database state (mutate only inside transaction() or simple in-place edits + touch()). */
  get db(): DBState {
    return this.data;
  }

  /** Which persistence backend is currently attached. */
  get driverName(): 'postgres' | 'json' {
    return this.driver?.name ?? 'json';
  }

  /** Fill every collection from a partial snapshot (JSON file or remote driver). */
  private normalize(parsed: Partial<DBState>): DBState {
    const base = emptyState();
    return {
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
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  }

  private loadJson(): DBState {
    try {
      if (!existsSync(this.dbPath)) {
        console.warn(`[db] ${this.dbPath} not found — starting with an empty state`);
        return emptyState();
      }
      const parsed = JSON.parse(readFileSync(this.dbPath, 'utf8')) as Partial<DBState>;
      const state = this.normalize(parsed);
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

  /**
   * Attach a persistence driver (PostgreSQL). Loads the remote state into
   * memory, or — when the remote store is fresh — migrates the current
   * in-memory seed (normally loaded from db.json) into it.
   */
  async attachDriver(driver: DbDriver): Promise<void> {
    const remote = await driver.load();
    if (remote) {
      this.data = this.normalize(remote);
      console.log(
        `[db] loaded ${this.data.products.length} products, ${this.data.categories.length} categories, ` +
          `${this.data.users.length} users, ${this.data.orders.length} orders from ${driver.name}`,
      );
    } else {
      await driver.save(this.data);
      console.log(
        `[db] migrated JSON seed → ${driver.name}: ${this.data.products.length} products, ` +
          `${this.data.users.length} users, ${this.data.orders.length} orders`,
      );
    }
    this.driver = driver;
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
    void this.flush();
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

  /** Debounced persistence: driver save (with JSON fallback) or atomic file write. */
  async flush(): Promise<void> {
    if (this.saving) {
      this.pendingSave = true;
      return;
    }
    this.saving = true;
    try {
      if (this.driver) {
        try {
          await this.driver.save(this.data);
        } catch (err) {
          console.error('[db] driver save failed — JSON snapshot written as fallback', err);
          this.writeAtomic();
        }
      } else {
        this.writeAtomic();
      }
    } finally {
      this.saving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        void this.flush();
      }
    }
  }

  /** Persist everything, release the driver, and never hang (graceful shutdown). */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      if (this.driver) {
        try {
          await this.driver.save(this.data);
        } catch (err) {
          console.error('[db] driver save on shutdown failed — JSON snapshot written', err);
          this.writeAtomic();
        }
        await this.driver.close();
      } else {
        this.writeAtomic();
      }
    } catch (err) {
      console.error('[db] shutdown save failed', err);
    }
  }

  /** Write state to tmp file then atomically rename over the real file. */
  private writeAtomic(): void {
    const dir = path.dirname(this.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.dbPath}.${process.pid}.tmp`;
    // write + fsync before rename: guarantees the tmp file is fully on disk,
    // so a crash right after rename can never leave a truncated/partial DB.
    const fd = openSync(tmp, 'w');
    try {
      writeSync(fd, JSON.stringify(this.data, null, 1));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.dbPath);
  }

  /** Human-readable info for /api/health. */
  async describe(): Promise<Record<string, unknown>> {
    if (this.driver) {
      try {
        return await this.driver.describe();
      } catch (err) {
        return { store: this.driver.name, error: 'describe failed', detail: String(err) };
      }
    }
    return {
      store: 'json',
      file: path.basename(this.dbPath),
      sizeKB: this.fileSizeKB(),
      products: this.data.products.length,
      orders: this.data.orders.length,
      users: this.data.users.length,
    };
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
