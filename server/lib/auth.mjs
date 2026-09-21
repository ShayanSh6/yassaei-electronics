// ─────────────────────────────────────────────────────────────
//  احراز هویت و امنیت
//  • رمز عبور: scrypt + salt اختصاصی + مقایسهٔ زمان‌ثابت
//  • نشست: توکن تصادفی ۲۵۶ بیتی در کوکی HttpOnly
//  • ورود دومرحله‌ای: TOTP (اپ احراز هویت) / کد ایمیل / کد پیامک
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, db } from './db.mjs';
import { badRequest, forbidden, nowISO, randomToken, safeEqual, sha256, uid, unauthorized, V } from './util.mjs';

// ── کلید محرمانهٔ سرور (برای امضای توکن‌ها) ─────────────────
const KEY_FILE = path.join(DATA_DIR, 'secret.key');
let SERVER_KEY = null;
export function serverKey() {
  if (SERVER_KEY) return SERVER_KEY;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    SERVER_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (!SERVER_KEY || SERVER_KEY.length < 32) throw new Error('weak key');
  } catch {
    SERVER_KEY = crypto.randomBytes(48).toString('base64url');
    fs.writeFileSync(KEY_FILE, SERVER_KEY, { mode: 0o600 });
    try { fs.chmodSync(KEY_FILE, 0o600); } catch { /* noop */ }
  }
  return SERVER_KEY;
}
export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', serverKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function verify(token, maxAgeMs = 15 * 60 * 1000) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', serverKey()).update(body).digest('base64url');
  if (!safeEqual(mac || '', expect)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || Date.now() > payload.exp || (payload.iat && Date.now() - payload.iat > maxAgeMs)) return null;
    return payload;
  } catch { return null; }
}

// ── هش رمز عبور ────────────────────────────────────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored || '').split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024,
    });
    return safeEqual(actual, expected);
  } catch { return false; }
}
export function passwordNeedsRehash(stored) {
  return !String(stored || '').startsWith('scrypt$16384$');
}

// ── TOTP (RFC 6238) ────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function generateTotpSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = ''; let out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function base32Decode(s) {
  const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of clean) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
export function totpCode(secret, timeStep = 30, when = Date.now()) {
  const counter = Math.floor(when / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  if (!key.length) return '';
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}
export function verifyTotp(secret, code, windowSteps = 1) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  const t = Date.now();
  for (let i = -windowSteps; i <= windowSteps; i++) {
    if (safeEqual(totpCode(secret, 30, t + i * 30_000), c)) return true;
  }
  return false;
}
export function otpauthUrl(secret, accountName, issuer = 'Yassaei Electronics') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── رمز یک‌بارمصرف (ایمیل/موبایل) ─────────────────────────
export function makeOtp(state, { userId, channel, target, purpose = 'login', ttlMs = 5 * 60 * 1000, length = 6 }) {
  const code = String(crypto.randomInt(0, 10 ** length)).padStart(length, '0');
  const rec = {
    id: uid('otp'),
    userId: userId || null,
    channel,                 // email | sms | phone
    target,
    purpose,
    codeHash: sha256(code + serverKey()),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    createdAt: nowISO(),
    consumed: false,
  };
  state.otps = state.otps.filter((o) => !(o.target === target && o.purpose === purpose && !o.consumed));
  state.otps.push(rec);
  if (state.otps.length > 1000) state.otps = state.otps.slice(-1000);
  return { record: rec, code };
}
export function consumeOtp(state, { target, purpose, code }) {
  const rec = state.otps.find((o) => o.target === target && o.purpose === purpose && !o.consumed);
  if (!rec) return { ok: false, reason: 'not_found' };
  if (new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (rec.attempts >= rec.maxAttempts) return { ok: false, reason: 'locked' };
  rec.attempts++;
  if (!safeEqual(sha256(String(code || '').trim() + serverKey()), rec.codeHash)) {
    return { ok: false, reason: 'mismatch', attemptsLeft: rec.maxAttempts - rec.attempts };
  }
  rec.consumed = true;
  return { ok: true, record: rec };
}

// ── دسترسی‌های مدیریتی (ماتریس ۲۶ تایی) ───────────────────
export const PERMISSIONS = [
  { key: 'dashboard.view', fa: 'مشاهده داشبورد', en: 'View dashboard' },
  { key: 'products.view', fa: 'مشاهده محصولات (پنل)', en: 'View products (panel)' },
  { key: 'products.create', fa: 'افزودن محصول', en: 'Create product' },
  { key: 'products.edit', fa: 'ویرایش محصول', en: 'Edit product' },
  { key: 'products.delete', fa: 'حذف محصول', en: 'Delete product' },
  { key: 'products.price', fa: 'تغییر قیمت و تخفیف', en: 'Change price & discount' },
  { key: 'products.stock', fa: 'تغییر موجودی', en: 'Change stock' },
  { key: 'categories.manage', fa: 'مدیریت دسته‌ها و برندها', en: 'Manage categories & brands' },
  { key: 'orders.view', fa: 'مشاهده سفارش‌ها', en: 'View orders' },
  { key: 'orders.manage', fa: 'تغییر وضعیت سفارش', en: 'Manage orders' },
  { key: 'refunds.manage', fa: 'بازگشت وجه و لغو', en: 'Refunds & cancellation' },
  { key: 'reviews.moderate', fa: 'تأیید/رد نظرات و سؤالات', en: 'Moderate reviews' },
  { key: 'reviews.reply', fa: 'پاسخ به نظرات و سؤالات', en: 'Reply to reviews' },
  { key: 'tickets.manage', fa: 'مدیریت تیکت‌ها', en: 'Manage tickets' },
  { key: 'feedback.manage', fa: 'پیشنهاد/شکایت/گزارش خطا', en: 'Feedback & bug reports' },
  { key: 'users.view', fa: 'مشاهده کاربران', en: 'View users' },
  { key: 'users.manage', fa: 'ویرایش و مسدودسازی کاربر', en: 'Manage users' },
  { key: 'users.permissions', fa: 'تعیین سطح دسترسی مدیران', en: 'Assign permissions' },
  { key: 'wallet.manage', fa: 'مدیریت کیف پول و تراکنش‌ها', en: 'Wallet management' },
  { key: 'plus.manage', fa: 'مدیریت اشتراک پلاس', en: 'Plus membership' },
  { key: 'coupons.manage', fa: 'کدهای تخفیف', en: 'Coupons' },
  { key: 'ads.manage', fa: 'مدیریت تبلیغات', en: 'Manage ads' },
  { key: 'notifications.send', fa: 'ارسال اعلان', en: 'Send notifications' },
  { key: 'settings.edit', fa: 'تنظیمات فروشگاه', en: 'Store settings' },
  { key: 'theme.edit', fa: 'پوسته و چیدمان رابط کاربری', en: 'Theme & UI layout' },
  { key: 'pages.edit', fa: 'ویرایش متن صفحه‌ها', en: 'Edit page content' },
  { key: 'barcode.print', fa: 'چاپ برچسب و بارکد', en: 'Barcode & label printing' },
  { key: 'barcode.scan', fa: 'اسکن بارکد / نمایش قیمت', en: 'Barcode scan / price display' },
  { key: 'imagesearch.index', fa: 'ایندکس تصاویر (جستجوی تصویری)', en: 'Image search index' },
  { key: 'audit.view', fa: 'مشاهده گزارش رویدادها', en: 'View audit log' },
  { key: 'stats.view', fa: 'آمار و گزارش‌گیری', en: 'Stats & reports' },
  { key: 'data.export', fa: 'خروجی گرفتن از داده‌ها', en: 'Export data' },
];
export const PERM_KEYS = PERMISSIONS.map((p) => p.key);

export function hasPerm(user, key) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (user.role === 'user') return false;
  const p = user.permissions || {};
  return p[key] === true;
}
export function requirePerm(user, key) {
  if (!hasPerm(user, key)) throw forbidden('forbidden', 'شما دسترسی لازم برای این بخش را ندارید.');
  return true;
}

// ── نشست‌ها ────────────────────────────────────────────────
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;      // ۱۴ روز
export const SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 3;       // ۳ روز بی‌فعالیتی

export function createSession(state, user, { ip = '', ua = '', remember = true } = {}) {
  const token = randomToken(32);
  const rec = {
    id: sha256(token),
    userId: user.id,
    createdAt: nowISO(),
    lastSeenAt: nowISO(),
    expiresAt: new Date(Date.now() + (remember ? SESSION_TTL_MS : 1000 * 60 * 60 * 8)).toISOString(),
    ip, ua: String(ua || '').slice(0, 200),
    pending2fa: false,
  };
  state.sessions.push(rec);
  if (state.sessions.filter((s) => s.userId === user.id).length > 10) {
    const userSessions = state.sessions.filter((s) => s.userId === user.id).sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    const toKeep = new Set(userSessions.slice(0, 10).map((s) => s.id));
    state.sessions = state.sessions.filter((s) => s.userId !== user.id || toKeep.has(s.id));
  }
  pruneSessions(state);
  db.markDirty(); return { ...rec, token };
}
export function findSession(state, token) {
  if (!token) return null;
  const id = sha256(token);
  const rec = state.sessions.find((s) => s.id === id);
  if (!rec) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  if (Date.now() - new Date(rec.lastSeenAt).getTime() > SESSION_IDLE_MS) return null;
  return rec;
}
export function touchSession(state, rec) {
  rec.lastSeenAt = nowISO(); db.markDirty();
  const exp = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  if (new Date(rec.expiresAt).getTime() < Date.now() + SESSION_TTL_MS) rec.expiresAt = exp;
}
export function destroySession(state, token) {
  if (!token) return;
  const id = sha256(token);
  state.sessions = state.sessions.filter((s) => s.id !== id);
}
export function destroyUserSessions(state, userId, exceptId) {
  state.sessions = state.sessions.filter((s) => s.userId !== userId || (exceptId && s.id === exceptId));
}
function pruneSessions(state) {
  const t = Date.now();
  if (state.sessions.length > 800) {
    state.sessions = state.sessions.filter((s) => new Date(s.expiresAt).getTime() > t && t - new Date(s.lastSeenAt).getTime() < SESSION_IDLE_MS);
  }
}

// ── CSRF (Double Submit) ───────────────────────────────────
export function issueCsrf() { return randomToken(24); }
export function checkCsrf(req, cookies, method) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const cookieToken = cookies['ys_csrf'] || '';
  const headerToken = req.headers['x-csrf-token'] || '';
  if (!cookieToken || !headerToken) return false;
  return safeEqual(cookieToken, headerToken);
}

export { V, badRequest, unauthorized };
