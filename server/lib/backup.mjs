// ─────────────────────────────────────────────────────────────
//  پشتیبان‌گیری خودکار: هر ۱۲ ساعت یک نسخهٔ فشرده از پایگاه‌داده
//  + نگه‌داشتن ۱۴ نسخهٔ آخر + امکان دانلود/بازگردانی دستی
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { db, logAudit, DATA_DIR } from './db.mjs';
import { nowISO } from './util.mjs';

const DB_FILE = path.join(DATA_DIR, 'db.json');
const DIR = path.join(DATA_DIR, 'backups');
const EVERY_MS = 12 * 3600 * 1000;   // هر ۱۲ ساعت
const KEEP = 14;                     // نگه‌داشتن ۱۴ نسخه (~۷ روز)

export function backupDir() { return DIR; }

function ensureDir() { fs.mkdirSync(DIR, { recursive: true }); }

/** فهرست نسخه‌های موجود (جدیدترین اول) */
export function listBackups() {
  ensureDir();
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.json.gz'))
    .map((f) => {
      const st = fs.statSync(path.join(DIR, f));
      return { id: f.replace('.json.gz', ''), file: f, at: st.mtime.toISOString(), bytes: st.size };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** ساخت نسخهٔ پشتیبان فشرده از کل پایگاه‌داده */
export function createBackup(actor = null, reason = 'auto') {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `bm-${ts}.json.gz`;
  const json = JSON.stringify(db.raw, null, 0);
  fs.writeFileSync(path.join(DIR, file), zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 6 }));
  // هرس نسخه‌های قدیمی
  const all = listBackups();
  for (const old of all.slice(KEEP)) {
    try { fs.unlinkSync(path.join(DIR, old.file)); } catch { /* noop */ }
  }
  const st0 = db.raw;
  const meta = { at: nowISO(), reason, file, items: { products: st0.products.length, orders: st0.orders.length, users: st0.users.length, audit: st0.audit.length } };
  try { logAudit(actor, 'backup.create', file, { reason }); } catch { /* noop */ }
  return meta;
}

/** خواندن دکمپرس‌شدهٔ یک نسخه (برای دانلود یا بازگردانی) */
export function readBackup(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9-]/g, '');
  const file = `${safe}.json.gz`;
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8'));
}

/** بازگردانی کامل از یک نسخه (فقط مالک) */
export function restoreBackup(id, actor = null) {
  const snap = readBackup(id);
  if (!snap) return null;
  const st = db.raw;
  const prevAudit = st.audit;
  for (const k of Object.keys(snap)) st[k] = snap[k];
  st.audit = prevAudit.slice(0, 2000);
  logAudit(actor, 'backup.restore', String(id), {});
  return { ok: true, at: nowISO() };
}

/** اگر آخرین نسخه قدیمی‌تر از ۱۲ ساعت است، یکی بساز */
export function maybeAutoBackup() {
  const last = listBackups()[0];
  if (last && Date.now() - new Date(last.at).getTime() < EVERY_MS) return null;
  return createBackup(null, 'auto');
}

/** زمان‌بند ۱۲ ساعته (هر ساعت بررسی می‌کند تا دقیق بماند) */
export function startBackupScheduler() {
  maybeAutoBackup();
  const timer = setInterval(() => { maybeAutoBackup(); }, 3600 * 1000);
  timer.unref?.();
  return timer;
}
