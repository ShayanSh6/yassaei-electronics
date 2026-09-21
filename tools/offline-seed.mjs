// ─────────────────────────────────────────────────────────────
//  بذر امن «نسخهٔ تک‌فایلی آفلاین»
//
//  این فایل عمومی پخش می‌شود (دانلود/ارسال برای مشتری)، پس هرگز نباید
//  رمز واقعی، هش رمز، کد دومرحله‌ای، توکن ربات، نشست‌ها و دادهٔ شخصی
//  مشتریان را در خود داشته باشد.
//
//  • ورود نمایشی آفلاین با یک رمز نمایشی مشترک کار می‌کند (پیش‌فرض Demo@1404)
//  • کلیدهای حساس تنظیمات (مثل telegram.token) با رشتهٔ خالی جایگزین می‌شوند
//  • مجموعه‌های دادهٔ شخصی/عملیاتی (سفارش، تیکت، ممیزی، بازدید، نشست…) حذف می‌شوند
// ─────────────────────────────────────────────────────────────

export const OFFLINE_DEMO_PASSWORD = 'Demo@1404';

/** الگوی توکن ربات/سرویس (۸ تا ۱۲ رقم + دونقطه + رشتهٔ تصادفی) */
export const BOT_TOKEN_RE = /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/;

/** کلیدهایی که مقدارشان هرگز نباید در فایل عمومی برود (پسوند-محور تا مثبت کاذب ندهد) */
const SECRET_KEY_RE = /(^|[._-])(token|secret|password|pass|apikey|api_key|privatekey|private_key|webhooksecret)$/i;

/** مجموعه‌هایی که دادهٔ شخصی یا عملیاتی دارند و از نسخهٔ عمومی حذف می‌شوند */
export const PII_COLLECTIONS = [
  'sessions', 'otps', 'audit', 'visitors', 'visits', 'clientErrors', 'bans',
  'telegramInbox', 'telegramSubs', 'payments', 'orders', 'tickets', 'feedback',
  'supportMessages', 'carts', 'barcodeLog', 'outbox',
];

/** پاک‌سازی بازگشتی تنظیمات: کلیدهای حساس و هر رشتهٔ شبیه‌توکن خالی می‌شوند */
export function redactSettings(settings) {
  const redacted = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((x, i) => walk(x, `${path}[${i}]`));
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (SECRET_KEY_RE.test(k) && v) { out[k] = ''; redacted.push(p); continue; }
      if (typeof v === 'string' && BOT_TOKEN_RE.test(v)) { out[k] = ''; redacted.push(p); continue; }
      out[k] = walk(v, p);
    }
    return out;
  };
  return { value: walk(settings || {}, ''), redacted };
}

/** کاربرِ امن برای نسخهٔ عمومی: بدون هش رمز، بدون راز دومرحله‌ای، با رمز نمایشی */
export function sanitizeUser(u, password = OFFLINE_DEMO_PASSWORD) {
  const { passwordHash, twoFA, resetToken, resetCode, ...rest } = u || {};
  return {
    ...rest,
    password,                       // ورود نمایشی آفلاین (شبیه‌ساز مرورگری همین را چک می‌کند)
    twoFA: { enabled: false, method: null, methods: [], secret: '', backupCodes: [] },
    mustChangePassword: false,
  };
}

/**
 * ساخت بذر امن نسخهٔ آفلاین از دیتابیس واقعی.
 * @returns {{seed: object, report: {removed: string[], redacted: string[], users: number}}}
 */
export function sanitizeOfflineSeed(db, { password = OFFLINE_DEMO_PASSWORD, keepOrders = false, keepAudit = false } = {}) {
  const { value: settings, redacted } = redactSettings(db.settings);
  const seed = {
    products: db.products || [],
    categories: db.categories || [],
    brands: db.brands || [],
    pages: db.pages || {},
    settings,
    coupons: db.coupons || [],
    ads: db.ads || [],
    notifications: db.notifications || [],
    reviews: db.reviews || [],
    lotteries: db.lotteries || [],
    users: (db.users || []).map((u) => sanitizeUser(u, password)),
    meta: {},
    visits: {},
  };
  const removed = [];
  for (const c of PII_COLLECTIONS) {
    if (!(c in (db || {}))) continue;
    if (keepOrders && (c === 'orders' || c === 'payments')) { seed[c] = db[c]; continue; }
    if (keepAudit && c === 'audit') { seed[c] = (db[c] || []).slice(0, 200); continue; }
    // کلید حذف نمی‌شود، فقط خالی می‌ماند تا نسخهٔ آفلاین بدون دادهٔ شخصی هم کار کند
    seed[c] = Array.isArray(db[c]) ? [] : {};
    removed.push(c);
  }
  return { seed, report: { removed, redacted, users: seed.users.length } };
}
