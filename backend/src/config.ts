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

/**
 * Static assets root (used only to check which image files exist so the API can
 * point to real paths). The frontend actually serves these files.
 */
export const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(BACKEND_DIR, process.env.PUBLIC_DIR)
  : path.join(BACKEND_DIR, '..', 'public');
