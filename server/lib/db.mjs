import { stockSnapshot, lowStockMessages, dispatchLowStockAlerts } from './low-stock.mjs';
// ─────────────────────────────────────────────────────────────
//  لایهٔ داده: ذخیره‌ساز JSON با نوشتن اتمیک و قفل تراکنش
//  • تمام تغییرات حساس (موجودی، سفارش، کیف پول) داخل db.tx() اجرا می‌شوند
//    تا هیچ شرط رقابتی (race condition) رخ ندهد.
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nowISO, uid } from './util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
// پوشهٔ داده: پیش‌فرض data/ — با BM_DATA_DIR می‌توان سرور را روی یک پوشهٔ
// جدا (مثلاً موقت برای تست‌ها) اجرا کرد تا دادهٔ واقعی فروشگاه دست‌نخورده بماند.
export const DATA_DIR = process.env.BM_DATA_DIR ? path.resolve(process.env.BM_DATA_DIR) : path.join(ROOT, 'data');
// پوشهٔ آپلود: پیش‌فرض public/uploads — با BM_UPLOAD_DIR می‌توان آن را هم جدا کرد
export const UPLOAD_DIR = process.env.BM_UPLOAD_DIR ? path.resolve(process.env.BM_UPLOAD_DIR) : path.join(ROOT, 'public', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TMP_FILE = path.join(DATA_DIR, 'db.tmp.json');
const BAK_FILE = path.join(DATA_DIR, 'db.backup.json');
export const CUSTOM_SETTINGS_FILE = path.join(DATA_DIR, 'custom-settings.json');

export const EMPTY = () => ({
  version: 1,
  createdAt: nowISO(),
  settings: {},
  categories: [],
  brands: [],
  products: [],
  users: [],
  sessions: [],
  otps: [],
  carts: [],
  orders: [],
  reviews: [],
  tickets: [],
  notifications: [],
  supportMessages: [],
  feedback: [],
  coupons: [],
  ads: [],
  pages: {},
  audit: [],
  priceAlerts: [],
  visits: {},       // { 'YYYY-MM-DD': count }
  visitSessions: {},// { sessionIdHash: 'YYYY-MM-DD' } برای بازدید یکتا
  stats: { ordersTotal: 0, revenueTotal: 0 },
  imageHashes: {},  // productId -> {dhash, hist}
  bans: [],         // {id,type:'ip'|'phone'|'email'|'username',value,reason,at,by}
  visitors: [],     // رکورد بازدیدکنندگان (جدیدترین اول)
  lotteries: [],    // قرعه‌کشی‌ها
  telegramInbox: [],// پیام‌های بات تلگرام
  telegramSubs: {}, // chatId -> name
  tasks: [],        // وظایف کارکنان و مدیریت
  staffPresence: {},// حضور و غیاب کارکنان { userId: {...} }
});

let state = EMPTY();
let saveTimer = null;
let saving = Promise.resolve();
let dirty = false;
let backupCounter = 0;

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function loadCustomSettings() {
  try {
    if (!fs.existsSync(CUSTOM_SETTINGS_FILE)) return null;
    const raw = fs.readFileSync(CUSTOM_SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.warn('[db] custom-settings.json unreadable:', e.message);
    return null;
  }
}

// Serialize atomic renames: concurrent settings saves must never share an active
// temp-file write or acknowledge a failed disk write as a successful save.
let customSaving = Promise.resolve();
export function saveCustomSettings() {
  const payload = JSON.stringify({ settings: state.settings, pages: state.pages, updatedAt: nowISO() }, null, 2);
  const run = customSaving.then(async () => {
    ensureDirs();
    const tmp = CUSTOM_SETTINGS_FILE + '.tmp';
    await fsp.writeFile(tmp, payload, 'utf8');
    await fsp.rename(tmp, CUSTOM_SETTINGS_FILE);
  });
  customSaving = run.catch(() => {});
  return run;
}

function deepMergeCustom(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target[k];
    if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
    if (k === 'adminNav') { target[k] = structuredClone(sv); continue; }
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!tv || typeof tv !== 'object' || Array.isArray(tv)) {
        target[k] = structuredClone(sv);
      } else {
        deepMergeCustom(tv, sv);
      }
    } else {
      // For arrays (like nav), replace only if source has value and target is undefined or empty? Actually we want custom to win.
      // If custom file has nav, we prioritize it fully.
      target[k] = structuredClone(sv);
    }
  }
}

export async function load(seedFn) {
  ensureDirs();
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const base = EMPTY();
    state = { ...base, ...parsed };
    // اطمینان از وجود کلیدهای جدید پس از ارتقا
    for (const k of Object.keys(base)) {
      if (state[k] === undefined) state[k] = base[k];
      else if (typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null) {
        state[k] = { ...base[k], ...state[k] };
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // فایل خراب → تلاش برای بازیابی از نسخهٔ پشتیبان
      console.error('[db] db.json unreadable:', err.message);
      try {
        const bak = JSON.parse(await fsp.readFile(BAK_FILE, 'utf8'));
        state = { ...EMPTY(), ...bak };
        console.warn('[db] restored from backup');
      } catch {
        // لایهٔ دوم خودترمیمی: تازه‌ترین اسنپ‌شات معتبر در پوشهٔ backups/
        let restored = false;
        try {
          const dir = path.join(DATA_DIR, 'backups');
          const files = fs.readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
          for (const { f } of files.slice(0, 5)) {
            try {
              const bk = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
              if (bk && Array.isArray(bk.products)) { state = { ...EMPTY(), ...bk }; console.warn('[db] restored from snapshot:', f); restored = true; break; }
            } catch { /* اسنپ‌شات بعدی را امتحان کن */ }
          }
        } catch { /* پوشهٔ پشتیبان در دسترس نیست */ }
        if (!restored) { console.warn('[db] starting fresh (no valid backup)'); state = EMPTY(); }
      }
    }
    if (typeof seedFn === 'function') await seedFn(state);
  }
  state.settings = state.settings || {};

  // ── بارگذاری تنظیمات سفارشی پایدار (data/custom-settings.json) ──
  // این فایل در .gitignore است و هرگز با git pull بازنویسی نمی‌شود.
  // اگر وجود داشته باشد، تنظیمات ذخیره‌شدهٔ مدیر بر هر چیزی اولویت دارد.
  const custom = loadCustomSettings();
  if (custom) {
    try {
      if (custom.settings && typeof custom.settings === 'object') {
        // Merge custom settings over current state.settings deeply, custom wins
        const merged = structuredClone(state.settings);
        deepMergeCustom(merged, custom.settings);
        state.settings = merged;
        console.log('[db] loaded persistent custom-settings.json (settings)');
      }
      if (custom.pages && typeof custom.pages === 'object') {
        const mergedPages = structuredClone(state.pages || {});
        deepMergeCustom(mergedPages, custom.pages);
        state.pages = mergedPages;
        console.log('[db] loaded persistent custom-settings.json (pages)');
      }
    } catch (e) {
      console.warn('[db] failed to merge custom-settings:', e.message);
    }
  }

  await flush(true);
  // اگر custom-settings وجود نداشت، آن را بساز تا از این به بعد پایدار بماند
  if (!custom) {
    try { await saveCustomSettings(); console.log('[db] created initial custom-settings.json'); } catch { /* noop */ }
  }
  return state;
}

export const db = {
  get raw() { return state; },
  s: () => state.settings,
  /** صف نوشتن: همهٔ تراکنش‌ها سریال اجرا می‌شوند (بدون race) */
  tx(fn) {
    const run = saving.then(async () => {
      const stocks = stockSnapshot(state);
      const result = await fn(state);
      dirty = true;
      scheduleSave();
      dispatchLowStockAlerts(lowStockMessages(stocks, state));
      return result;
    });
    // زنجیره را حتی در صورت خطا ادامه بده
    saving = run.then(() => {}, () => {});
    return run;
  },
  /** خواندن بدون قفل (برای GETها) */
  read(fn) { return fn(state); },
  markDirty() { dirty = true; scheduleSave(); },
  async flush(force = false) { return flush(force); },
  newId: uid,
};

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush().catch(() => {}); }, 250);
}

let currentWrite = null;
let pendingWrite = false;

async function flush(force = false) {
  if (!force && !dirty) return;
  if (currentWrite) {
    pendingWrite = true;
    await currentWrite;
    if (!pendingWrite && !dirty) return;
  }
  
  currentWrite = (async () => {
    try {
      dirty = false;
      pendingWrite = false;
      const snapshot = JSON.stringify(state);
      if (++backupCounter % 40 === 0) {
        await fsp.copyFile(DB_FILE, BAK_FILE).catch(() => {});
      }
      await fsp.writeFile(TMP_FILE, snapshot, 'utf8');
      await fsp.rename(TMP_FILE, DB_FILE);
    } catch (err) {
      dirty = true;
      console.error('[db] write failed:', err.message);
    } finally {
      currentWrite = null;
      if (pendingWrite || dirty) setTimeout(() => flush().catch(() => {}), 300);
    }
  })();
  return currentWrite;
}

process.on('SIGINT', () => { flush(true).finally(() => process.exit(0)); });
process.on('SIGTERM', () => { flush(true).finally(() => process.exit(0)); });

// ── توابع کمکی جستجو در مجموعه‌ها ───────────────────────────
export const byId = (arr, id) => arr.find((x) => x.id === id) || null;
export const indexById = (arr) => { const m = new Map(); for (const x of arr) m.set(x.id, x); return m; };

export function logAudit(actor, action, target, meta = {}) {
  state.audit.unshift({
    id: uid('log'),
    at: nowISO(),
    actorId: actor?.id || null,
    actorName: actor?.username || actor?.name || 'مهمان',
    actorRole: actor?.role || 'guest',
    action,
    target: target || '',
    meta: sanitizeMeta(meta),
  });
  if (state.audit.length > 500) state.audit.length = 500;
}

function sanitizeMeta(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else {
      try { out[k] = JSON.stringify(v).slice(0, 500); } catch { out[k] = '[unserializable]'; }
    }
  }
  return out;
}
