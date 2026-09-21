/** Environment-driven configuration with defaults (resolved relative to the backend dir, not CWD). */
import path from 'node:path';

/** Absolute path of the backend folder (…/backend), derived from this source file. */
export const BACKEND_DIR = path.resolve(import.meta.dir, '..');

export const PORT: number = (() => {
  const n = Number(process.env.PORT);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 4000;
})();

export const HOST = process.env.HOST || '0.0.0.0';

/** JSON database file path. DB_PATH may be absolute or relative to the backend dir. */
export const DB_PATH: string = process.env.DB_PATH
  ? path.resolve(BACKEND_DIR, process.env.DB_PATH)
  : path.join(BACKEND_DIR, 'data', 'db.json');

/** Initial owner password created when users[] is empty on first boot. */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Yassaei@1404';

const DEFAULT_PG_URL = 'postgres://yassaei:yassaei1404@127.0.0.1:5432/yassaei';

/**
 * PostgreSQL connection string. Sources, in order:
 *   1. PG_URL — explicit PostgreSQL override;
 *   2. DATABASE_URL — only when it actually is a PostgreSQL URL (sandbox/CI
 *      environments may export a SQLite `file:` DATABASE_URL for other tooling);
 *   3. built-in default (local PostgreSQL on 127.0.0.1:5432).
 */
export const DATABASE_URL: string = (() => {
  const pg = process.env.PG_URL?.trim();
  if (pg) return pg;
  const generic = process.env.DATABASE_URL?.trim();
  if (generic && /^postgres(ql)?:\/\//.test(generic)) return generic;
  return DEFAULT_PG_URL;
})();

/** A non-PostgreSQL DATABASE_URL found in the environment (surfaced as a boot warning). */
export const DATABASE_URL_IGNORED: string | null = (() => {
  const pg = process.env.PG_URL?.trim() || '';
  const generic = process.env.DATABASE_URL?.trim() || '';
  if (!pg && generic && !/^postgres(ql)?:\/\//.test(generic)) return generic;
  return null;
})();

/** Set PG_DISABLED=1 to force the JSON-file store even when PostgreSQL is reachable. */
export const PG_DISABLED = process.env.PG_DISABLED === '1';

/**
 * Static assets root (used only to check which image files exist so the API can
 * point to real paths). The frontend actually serves these files.
 */
export const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(BACKEND_DIR, process.env.PUBLIC_DIR)
  : path.join(BACKEND_DIR, '..', 'public');
