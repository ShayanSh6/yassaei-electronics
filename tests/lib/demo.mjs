// ─────────────────────────────────────────────────────────────
//  حساب‌های نمونهٔ تست — تضمین وجود کاربران دمو پیش از سناریوهای خرید
//
//  چرا لازم است؟ تست‌ها روی دیتابیس لوکال (data/db.json) اجرا می‌شوند و
//  این فایل در طول کار عوض می‌شود؛ اگر کاربران نمونه در آن نباشند، تست‌ها
//  به‌جای «ایراد واقعی»، فقط «دریفت داده» را گزارش می‌کردند (api.mjs حتی
//  وسط اجرا می‌شکست). این ماژول اگر کاربر نمونه نبود، او را از مسیر رسمی
//  ثبت‌نام می‌سازد و آدرس پیش‌فرض لازم برای سفارش پستی را هم تنظیم می‌کند.
//
//  استفاده:  await ensureDemoAccounts(BASE, ['maryam'])
//  هیچ دادهٔ موجودی را پاک نمی‌کند و اجرای دوباره‌اش بی‌خطر است (idempotent).
// ─────────────────────────────────────────────────────────────

export const DEMO_PASSWORD = 'Demo@1404';

export const DEMO_USERS = {
  maryam: { username: 'maryam', name: 'مریم احمدی', phone: '09171234567', email: 'maryam@example.com', city: 'تهران', zone: 'city' },
  reza: { username: 'reza', name: 'رضا دریانورد', phone: '09173456789', email: 'reza@example.com', city: 'گناوه', zone: 'province' },
  sina: { username: 'sina', name: 'سینا مرادی', phone: '09127654321', email: 'sina@example.com', city: 'شیراز', zone: 'province' },
};

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** حل کپچای تصویری SVG سرور (مثل ۷+۳ یا ۴×۲) — همان روش تست‌های دیگر */
export function solveCaptcha(svg) {
  const txt = [...String(svg || '').matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1]).join('').replace(/&#160;/g, ' ');
  const en = txt.replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)));
  const m = en.match(/(\d+)\s*([+×])\s*(\d+)/);
  if (!m) return null;
  return m[2] === '×' ? Number(m[1]) * Number(m[3]) : Number(m[1]) + Number(m[3]);
}

/** یک کلاینت سبک با کوکی‌جار (مستقل از کلاینت‌های داخلی هر تست) */
export function makeClient(base) {
  const jar = new Map();
  const header = () => [...jar.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  const absorb = (res) => {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    for (const c of sc) {
      const [pair] = String(c).split(';'); const i = pair.indexOf('=');
      if (i < 0) continue;
      const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (!v) jar.delete(k); else jar.set(k, decodeURIComponent(v));
    }
  };
  const call = async (method, path, body) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = jar.get('ys_csrf') || '';
    headers.Cookie = header();
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    absorb(res);
    const buf = await res.arrayBuffer();
    const rawBytes = new Uint8Array(buf);
    const hasBom = rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
    const text = new TextDecoder().decode(rawBytes);
    let json = null; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, json, text: () => text, headers: res.headers, rawBytes, hasBom };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b === undefined ? {} : b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b),
    delete: (p, b) => call('DELETE', p, b),
    csrf: () => jar.get('ys_csrf') || '',
  };
}

/** توکن کپچا برای درخواست‌های محافظت‌شده (اگر کپچا خاموش باشد undefined) */
export async function captchaToken(cl) {
  const c = await cl.get('/api/captcha');
  if (!c.json || c.json.disabled || !c.json.id) return undefined;
  const v = await cl.post('/api/captcha/verify', { id: c.json.id, answer: solveCaptcha(c.json.svg) });
  return v.json?.token;
}

/** ورود با نام کاربری و رمز؛ true اگر موفق باشد */
export async function login(cl, username, password = DEMO_PASSWORD) {
  const r = await cl.post('/api/auth/login', { identifier: username, password, captchaToken: await captchaToken(cl) });
  return r.status === 200 && !!r.json?.me;
}

const DEFAULT_ADDRESS = (u) => ({
  title: 'خانه',
  receiver: u.name,
  phone: u.phone,
  province: 'تهران',
  city: u.city,
  zone: u.zone || 'city',
  street: 'خیابان نمونه، کوچه‌ی شماره‌ی ۳، پلاک ۱۲',
  postal: '7512345678',
  isDefault: true,
});

/**
 * تضمین وجود کاربران نمونه: اگر ورود موفق شد کاری نمی‌کند؛ در غیر این‌صورت
 * از مسیر رسمی ثبت‌نام می‌سازد و آدرس پیش‌فرض می‌گذارد.
 * @returns {Promise<{created: string[], existing: string[], failed: string[]}>}
 */
export async function ensureDemoAccounts(base, usernames = Object.keys(DEMO_USERS)) {
  const out = { created: [], existing: [], failed: [] };
  for (const username of usernames) {
    const spec = DEMO_USERS[username] || { username, name: username, phone: '', city: 'تهران', zone: 'city' };
    const cl = makeClient(base);
    await cl.get('/api/bootstrap');
    if (await login(cl, username)) { out.existing.push(username); continue; }

    const reg = await cl.post('/api/auth/register', {
      mode: 'username',
      username,
      name: spec.name,
      password: DEMO_PASSWORD,
      phone: spec.phone || undefined,
      email: spec.email || undefined,
      acceptTerms: true,
      captchaToken: await captchaToken(cl),
    });
    if (reg.status !== 200 || !reg.json?.me) {
      // یا ثبت‌نام بسته است، یا نام کاربری هست ولی رمزش عوض شده — با گزارش روشن
      out.failed.push(`${username} (${reg.status} ${reg.json?.code || reg.json?.message || ''})`.trim());
      continue;
    }
    // آدرس پیش‌فرض: سفارش پستی بدون آدرس رد می‌شود
    const me = await cl.get('/api/me');
    if (!(me.json?.me?.addresses || []).length) await cl.post('/api/me/addresses', DEFAULT_ADDRESS(spec));
    out.created.push(username);
  }
  if (out.created.length) console.log(`  ↻ حساب نمونه ساخته شد: ${out.created.join('، ')}`);
  if (out.failed.length) console.log(`  ✘ ساخت حساب نمونه ناموفق: ${out.failed.join('، ')}`);
  return out;
}

// ─────────────────────────────────────────────────────────────
//  حساب کارمند (staff): ماتریس دسترسی همان ماتریس seed است
//  تست‌های پنل مدیریت به این حساب وابسته‌اند؛ چون ثبت‌نام عمومی فقط
//  کاربر عادی می‌سازد، ارتقا به «کارمند» از مسیر خود پنل (API مدیر)
//  انجام می‌شود تا تست‌ها به دادهٔ از پیش‌موجود وابسته نباشند.
// ─────────────────────────────────────────────────────────────
export const STAFF_PASSWORD = 'Staff@1404';

// همان ماتریس دسترسی seed.mjs برای کارمند (بیت‌به‌بیت هم‌معنا)
export const STAFF_PERMS = {
  'dashboard.view': true, 'products.view': true, 'products.create': true, 'products.edit': true,
  'products.price': true, 'products.stock': true, 'orders.view': true, 'orders.manage': true,
  'reviews.moderate': true, 'reviews.reply': true, 'tickets.manage': true, 'feedback.manage': true,
  'barcode.print': true, 'barcode.scan': true, 'settings.edit': false, 'users.permissions': false,
  'audit.view': false, 'data.export': false, 'wallet.manage': false, 'refunds.manage': true,
};

/**
 * تضمین وجود حساب کارمند با رمز Staff@1404 و نقش/دسترسی‌های صحیح.
 * مراحل: اگر ورود کار می‌کند → تمام. وگرنه ساخت حساب از ثبت‌نام عمومی و
 * سپس ارتقا به «کارمند» با API مدیر (بدون نیاز به دست‌زدن به فایل دیتابیس).
 */
export async function ensureStaffAccount(base, adminIdentifier = 'admin', adminPassword = 'Yassaei@1404') {
  const cl = makeClient(base);
  await cl.get('/api/bootstrap');
  if (await login(cl, 'staff', STAFF_PASSWORD)) return { ok: true, created: false };

  const reg = await cl.post('/api/auth/register', {
    mode: 'username', username: 'staff', name: 'کارمند فروشگاه', password: STAFF_PASSWORD,
    acceptTerms: true, captchaToken: await captchaToken(cl),
  });
  const admin = makeClient(base);
  await admin.get('/api/bootstrap');
  if (!(await login(admin, adminIdentifier, adminPassword))) return { ok: false, reason: 'ورود مدیر ناموفق' };

  const users = await admin.get('/api/admin/users?limit=200');
  const target = (users.json?.items || []).find((u) => u.username === 'staff');
  if (!target) return { ok: false, reason: `حساب staff پیدا/ساخته نشد (${reg.status})` };

  // اگر رمز قبلی عوض شده بود، از مسیر رسمی پنل بازنشانی می‌شود
  if (reg.status !== 200) await admin.patch(`/api/admin/users/${target.id}`, { resetPassword: STAFF_PASSWORD });
  await admin.patch(`/api/admin/users/${target.id}`, { role: 'staff', permissions: STAFF_PERMS });
  console.log('  ↻ حساب کارمند آماده شد: staff');
  return { ok: true, created: true, id: target.id };
}
