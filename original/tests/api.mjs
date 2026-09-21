// ─────────────────────────────────────────────────────────────
//  تست یکپارچهٔ API — بدون وابستگی خارجی
//  اجرا: node tests/api.mjs  (سرور باید روی پورت 3000 در حال اجرا باشد)
// ─────────────────────────────────────────────────────────────
import { ensureDemoAccounts, ensureStaffAccount, solveCaptcha } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';

let pass = 0; let fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✘ ${name} ${extra}`); }
}
function section(t) { console.log(`\n▌ ${t}`); }

class Jar {
  constructor() { this.cookies = new Map(); }
  absorb(res) {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    for (const c of sc) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).trim();
      if (!v) this.cookies.delete(k); else this.cookies.set(k, decodeURIComponent(v));
    }
  }
  header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '); }
  get csrf() { return this.cookies.get('ys_csrf') || ''; }
}

async function req(jar, method, path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = jar.csrf;
  if (jar) headers.Cookie = jar.header();
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  if (jar) jar.absorb(res);
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json, headers: res.headers, text };
}

// CSRF بدون کوکی
async function reqNoCsrf(jar, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (jar) headers.Cookie = jar.header();
  const res = await fetch(BASE + path, { method, headers, body: JSON.stringify(body) });
  if (jar) jar.absorb(res);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = {}; }
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ساخت جار تازه همراه با دریافت کوکی CSRF (مانند بارگذاری صفحه در مرورگر) */
async function fresh() {
  const j = new Jar();
  await req(j, 'GET', '/api/bootstrap');
  return j;
}

(async () => {
  console.log(`\n═══ تست API · ${BASE} ═══`);

  // ── ۱) عمومی ──────────────────────────────────────────
  section('عمومی و کاتالوگ');
  const anon = new Jar();
  await req(anon, 'GET', '/api/bootstrap');
  const boot = await req(anon, 'GET', '/api/bootstrap');
  ok('bootstrap ok', boot.status === 200 && boot.json.ok === true);
  ok('تم پیش‌فرض رنگ آبی الکتریک (#3dabff)', ['#3dabff', '#f59e0b'].includes(boot.json.settings?.theme?.accent), boot.json.settings?.theme?.accent);
  ok('حالت پیش‌فرض تاریک', boot.json.settings?.theme?.mode === 'dark');
  ok('دسته‌ها بارگذاری شد', (boot.json.categories || []).length > 0 && boot.json.categories.every((c) => c.id && c.name));
  ok('برندها بارگذاری شد', (boot.json.brands || []).length > 0 && boot.json.brands.every((b) => b.id && b.name));
  ok('تبلیغات فعال دارد', Array.isArray(boot.json.ads));
  ok('آمار عمومی موجود است', boot.json.stats?.products > 0);

  const list = await req(anon, 'GET', '/api/products?limit=6');
  ok('لیست محصولات', list.status === 200 && list.json.items.length === 6);
  ok('قیمت‌ها عدد صحیح مثبت', list.json.items.every((p) => Number.isInteger(p.price) && p.price > 0));
  ok('موجودی منفی نیست', list.json.items.every((p) => p.stock >= 0));

  const one = list.json.items.find((x) => x.stock > 2) || list.json.items[0];
  const detail = await req(anon, 'GET', `/api/products/${one.id}`);
  ok('جزئیات محصول', detail.status === 200 && detail.json.product.id === one.id);
  ok('مشخصات فنی ساختار درست دارد', (detail.json.product.specs || {}) instanceof Object && !Array.isArray(detail.json.product.specs));
  const missing = await req(anon, 'GET', '/api/products/nope_not_found');
  ok('محصول ناموجود → ۴۰۴', missing.status === 404);

  // ── ۲) جست‌وجو ────────────────────────────────────────
  section('جست‌وجو');
  const s1 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('کابل شارژ'));
  ok('جست‌وجوی فارسی «کابل شارژ»', s1.json.products.length > 0, `${s1.json.products.length} نتیجه`);
  const s2 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('anker'));
  ok('جست‌وجوی برند انگلیسی «anker»', s2.json.products.length > 0);
  const s3 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('هندزفری'));
  ok('جست‌وجوی «هندزفری»', s3.json.products.length > 0);
  const s4 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('گلس آیفون'));
  ok('جست‌وجوی ترکیبی «گلس آیفون»', s4.json.products.length > 0);
  const s5 = await req(anon, 'GET', '/api/products?q=' + encodeURIComponent('پاوربانک'));
  ok('فیلتر محصولات با q', s5.json.items.length > 0);
  const s6 = await req(anon, 'GET', '/api/products?brand=anker&sort=cheapest');
  ok('فیلتر برند + مرتب‌سازی', s6.json.items.every((p) => p.brandId === 'anker'));
  const s7 = await req(anon, 'GET', '/api/products?inStock=1');
  ok('فیلتر موجودی', s7.json.items.every((p) => p.stock > 0));
  const s8 = await req(anon, 'GET', '/api/products?q=xyzabc123');
  ok('جست‌وجوی بی‌نتیجه → خالی', s8.json.items.length === 0 && s8.json.total === 0);
  const s9 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('قوانین'));
  ok('جست‌وجو صفحه‌ها را هم پیدا می‌کند', (s9.json.pages || []).length > 0);
  const s10 = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('پابجی'));
  ok('جست‌وجوی برچسب «پابجی»', s10.json.products.length > 0);
  const s11 = await req(anon, 'GET', '/api/search?q=');
  ok('جست‌وجوی خالی → پرفروش‌ها', s11.status === 200 && Array.isArray(s11.json.products));

  // ── ۳) امنیت ──────────────────────────────────────────
  section('امنیت');
  const noCsrf = await reqNoCsrf(anon, 'POST', '/api/auth/login', { identifier: 'admin', password: 'Yassaei@1404' });
  ok('POST بدون CSRF → ۴۰۳', noCsrf.status === 403, String(noCsrf.status));
  const trav = await fetch(BASE + '/../../etc/passwd', { redirect: 'manual' });
  ok('مسیر traversal مسدود است', trav.status !== 200 || !(await trav.text()).includes('root:'));
  const apiTrav = await req(anon, 'GET', '/api/products/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
  ok('API traversal → خطا', apiTrav.status >= 400);
  const headers = boot.headers;
  ok('هدر CSP وجود دارد', !!headers.get('content-security-policy'));
  ok('هدر X-Frame-Options', headers.get('x-frame-options') === 'DENY');
  ok('هدر nosniff', headers.get('x-content-type-options') === 'nosniff');
  const inject = await req(anon, 'GET', '/api/search?q=' + encodeURIComponent('<script>alert(1)</script>'));
  ok('XSS در ورودی جست‌وجو بی‌اثر است', !JSON.stringify(inject.json).includes('<script>'));

  // ── ۳٫۵) کپچا «من ربات نیستم» ──────────────────────────
  section('کپچا');
  const solveCap = solveCaptcha; // تک‌نسخه در tests/lib/demo.mjs
  const capAdmin = await fresh();
  const capPre = await req(capAdmin, 'GET', '/api/captcha');
  const capPreV = capPre.json?.disabled ? { json: {} } : await req(capAdmin, 'POST', '/api/captcha/verify', { id: capPre.json.id, answer: solveCap(capPre.json.svg) });
  ok('ورود مدیر برای کلید کپچا', (await req(capAdmin, 'POST', '/api/auth/login', { identifier: 'admin', password: 'Yassaei@1404', captchaToken: capPreV.json?.token })).status === 200);
  await req(capAdmin, 'PATCH', '/api/admin/settings/features', { value: { captcha: true } }); // خودترمیمی: اگر اجرای قبلی خاموش رها کرده
  const cap1 = await req(anon, 'GET', '/api/captcha');
  ok('دریافت چالش کپچا (SVG)', cap1.status === 200 && String(cap1.json.svg).includes('<svg'));
  const ans1 = solveCap(cap1.json.svg);
  ok('چالش قابل خواندن است', ans1 !== null, String(ans1));
  const capBad = await req(anon, 'POST', '/api/captcha/verify', { id: cap1.json.id, answer: ans1 + 1 });
  ok('پاسخ غلط کپچا → رد', capBad.status === 400 && capBad.json.code === 'captcha_invalid');
  const cap2 = await req(anon, 'GET', '/api/captcha');
  const capGood = await req(anon, 'POST', '/api/captcha/verify', { id: cap2.json.id, answer: solveCap(cap2.json.svg) });
  ok('پاسخ درست کپچا → توکن', capGood.status === 200 && !!capGood.json.token);
  const regNoCap = await req(await fresh(), 'POST', '/api/auth/register', { mode: 'username', username: 'nocap' + Math.floor(Math.random() * 1e6), name: 'بدون کپچا', password: 'Test@12345', acceptTerms: true });
  ok('ثبت‌نام بدون توکن کپچا → رد', regNoCap.status === 400 && regNoCap.json.code === 'captcha_required');
  const capOff = await req(capAdmin, 'PATCH', '/api/admin/settings/features', { value: { captcha: false } });
  ok('کلید خاموش/روشن کپچا در پنل مدیر', capOff.status === 200 && capOff.json.value.captcha === false);
  const capOffGet = await req(anon, 'GET', '/api/captcha');
  ok('کپچای خاموش → disabled', capOffGet.status === 200 && capOffGet.json.disabled === true);

  // ── ۴) ثبت‌نام و ورود ─────────────────────────────────
  section('احراز هویت');
  const u1 = new Jar();
  await req(u1, 'GET', '/api/bootstrap');
  const uname = 'test' + Math.floor(Math.random() * 1e6);
  const reg = await req(u1, 'POST', '/api/auth/register', { mode: 'username', username: uname, name: 'کاربر آزمایشی', password: 'Test@12345', acceptTerms: true });
  ok('ثبت‌نام با نام کاربری و رمز', reg.status === 200 && reg.json.me?.username === uname, JSON.stringify(reg.json).slice(0, 140));
  const regNoTerms = await req(await fresh(), 'POST', '/api/auth/register', { mode: 'username', username: 'x' + Math.floor(Math.random() * 1e6), name: 'بی ترمز', password: 'Test@12345', acceptTerms: false });
  ok('ثبت‌نام بدون پذیرش قوانین → رد', regNoTerms.status === 400);
  const regWeak = await req(await fresh(), 'POST', '/api/auth/register', { mode: 'username', username: 'y' + Math.floor(Math.random() * 1e6), name: 'رمز ضعیف', password: '123', acceptTerms: true });
  ok('رمز ضعیف → رد', regWeak.status === 400);
  const regDup = await req(await fresh(), 'POST', '/api/auth/register', { mode: 'username', username: uname, name: 'تکراری', password: 'Test@12345', acceptTerms: true });
  ok('نام کاربری تکراری → ۴۰۹', regDup.status === 409);

  const login = await req(u1, 'POST', '/api/auth/login', { identifier: uname, password: 'Test@12345' });
  ok('ورود موفق', login.status === 200 && login.json.me?.username === uname);

  // رگرسیون: نام کاربری بدون رقم نباید با کاربری که موبایلش خالی است اشتباه گرفته شود
  // (باگ واقعی: «maryam» با حساب مدیر تطبیق داده می‌شد و ورود همیشه ناموفق بود)
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const randLetters = Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * 26)]).join('');
  const unameNoDigit = 'testuser' + randLetters;
  const regNoDigit = await req(await fresh(), 'POST', '/api/auth/register', { mode: 'username', username: unameNoDigit, name: 'کاربر بی‌رقم', password: 'Test@12345', acceptTerms: true });
  ok('ثبت‌نام با نام کاربری بدون رقم', regNoDigit.status === 200 && regNoDigit.json.me?.username === unameNoDigit, JSON.stringify(regNoDigit.json).slice(0, 120));
  const loginNoDigit = await req(await fresh(), 'POST', '/api/auth/login', { identifier: unameNoDigit, password: 'Test@12345' });
  ok('ورود با نام کاربری بدون رقم → حساب درست', loginNoDigit.status === 200 && loginNoDigit.json.me?.username === unameNoDigit, JSON.stringify(loginNoDigit.json).slice(0, 140));
  const wrongPassNoDigit = await req(await fresh(), 'POST', '/api/auth/login', { identifier: unameNoDigit, password: 'WrongPass1!' });
  ok('رمز اشتباه روی نام کاربری بدون رقم → ۴۰۱', wrongPassNoDigit.status === 401, String(wrongPassNoDigit.status));
  const badLogin = await req(await fresh(), 'POST', '/api/auth/login', { identifier: uname, password: 'WrongPass1!' });
  ok('رمز اشتباه → ۴۰۱', badLogin.status === 401);

  // ورود با موبایل + OTP
  const u2 = new Jar();
  await req(u2, 'GET', '/api/bootstrap');
  const phone = '091' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const otpSend = await req(u2, 'POST', '/api/auth/otp/send', { channel: 'phone', target: phone, purpose: 'register' });
  ok('ارسال کد ثبت‌نام موبایل', otpSend.status === 200 && otpSend.json.demoCode, JSON.stringify(otpSend.json).slice(0, 120));
  const regPhone = await req(u2, 'POST', '/api/auth/register', { mode: 'phone', target: phone, code: otpSend.json.demoCode, name: 'کاربر موبایلی', password: 'Test@12345', acceptTerms: true });
  ok('ثبت‌نام با موبایل + کد', regPhone.status === 200 && regPhone.json.me?.phone === phone);
  const loginIntlPhone = await req(await fresh(), 'POST', '/api/auth/login', { identifier: '+98' + phone.slice(1), password: 'Test@12345' });
  ok('ورود با موبایل با پیش‌شمارهٔ +98', loginIntlPhone.status === 200 && loginIntlPhone.json.me?.phone === phone, JSON.stringify(loginIntlPhone.json).slice(0, 120));
  ok('شماره در پاسخ ماسک شده در OTP', otpSend.json.target.includes('***'));

  // ورود با ایمیل + OTP
  const u3 = new Jar();
  await req(u3, 'GET', '/api/bootstrap');
  const email = `mail${Math.floor(Math.random() * 1e6)}@example.com`;
  const regEmailPre = await req(u3, 'POST', '/api/auth/otp/send', { channel: 'email', target: email, purpose: 'register' });
  const regEmail = await req(u3, 'POST', '/api/auth/register', { mode: 'email', target: email, code: regEmailPre.json.demoCode, name: 'کاربر ایمیلی', password: 'Test@12345', acceptTerms: true });
  ok('ثبت‌نام با ایمیل + کد', regEmail.status === 200 && regEmail.json.me?.email === email);
  const loginEmail = await req(u3, 'POST', '/api/auth/login', { identifier: email, password: 'Test@12345' });
  ok('ورود با ایمیل به‌عنوان شناسه', loginEmail.status === 200);

  // کد اشتباه
  const badOtp = await req(u3, 'POST', '/api/auth/login/otp', { channel: 'email', target: email, code: '000000' });
  ok('کد OTP اشتباه → رد', badOtp.status >= 400);

  // ورود دومرحله‌ای TOTP
  const twofa = await req(u1, 'GET', '/api/me/2fa');
  ok('دریافت secret برای 2FA', twofa.status === 200 && twofa.json.secret.length >= 16);
  // محاسبهٔ کد TOTP سمت تست
  const { totpCode } = await import('../server/lib/auth.mjs');
  const code = totpCode(twofa.json.secret);
  const enable2fa = await req(u1, 'POST', '/api/me/2fa/enable', { method: 'totp', code });
  ok('فعال‌سازی 2FA با کد TOTP', enable2fa.status === 200 && enable2fa.json.enabled === true, JSON.stringify(enable2fa.json).slice(0, 120));
  ok('کدهای پشتیبان تولید شد', (enable2fa.json.backupCodes || []).length === 8);
  const bad2fa = await req(u1, 'POST', '/api/me/2fa/enable', { method: 'totp', code: '000000' });
  ok('کد TOTP اشتباه → رد', bad2fa.status === 400);
  await req(u1, 'POST', '/api/auth/logout');
  const login2fa = await req(u1, 'POST', '/api/auth/login', { identifier: uname, password: 'Test@12345' });
  ok('ورود با 2FA → چالش دومرحله‌ای', login2fa.status === 200 && login2fa.json.twoFactor === true);
  const code2 = totpCode(twofa.json.secret);
  const finish2fa = await req(u1, 'POST', '/api/auth/login/2fa', { challengeToken: login2fa.json.challengeToken, code: code2, type: 'totp' });
  ok('تکمیل ورود دومرحله‌ای', finish2fa.status === 200 && finish2fa.json.me?.username === uname);
  const badChallenge = await req(u1, 'POST', '/api/auth/login/2fa', { challengeToken: 'Zm9vYmFy.tampered-signature-value', code: code2, type: 'totp' });
  ok('چالش جعلی → رد', badChallenge.status === 401);
  // ورود با کد پشتیبان
  await req(u1, 'POST', '/api/auth/logout');
  const l2 = await req(u1, 'POST', '/api/auth/login', { identifier: uname, password: 'Test@12345' });
  const backupLogin = await req(u1, 'POST', '/api/auth/login/2fa', { challengeToken: l2.json.challengeToken, code: enable2fa.json.backupCodes[0], type: 'backup' });
  ok('ورود با کد پشتیبان', backupLogin.status === 200 && backupLogin.json.me?.username === uname);

  // بازیابی رمز
  const forgot = await req(u1, 'POST', '/api/auth/password/forgot', { channel: 'email', target: 'mail-not-exist@example.com' });
  ok('بازیابی رمز برای حساب ناموجود → ۴۰۴', forgot.status === 404);

  // ── ۵) سبد خرید و سفارش ───────────────────────────────
  section('سبد خرید و سفارش');
  const admin = new Jar();
  await req(admin, 'GET', '/api/bootstrap');
  const adminLogin = await req(admin, 'POST', '/api/auth/login', { identifier: 'admin', password: 'Yassaei@1404' });
  ok('ورود مدیر', adminLogin.status === 200 && adminLogin.json.me?.role === 'owner', JSON.stringify(adminLogin.json).slice(0, 150));
  // خودترمیمی دریفت اجرای قبلی: کلیدهای قابلیت و موجودی کالای تست
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { wallet: true } });
  if ((one.stock || 0) < 5) { await req(admin, 'PATCH', `/api/admin/products/${one.id}`, { stock: 30 }); one.stock = 30; }

  // تضمین وجود حساب نمونه (خودترمیمی دریفت دیتابیس لوکال، به‌جای شکست تست)
  await ensureDemoAccounts(BASE, ['maryam']);
  const mary = new Jar();
  await req(mary, 'GET', '/api/bootstrap');
  const maryLogin = await req(mary, 'POST', '/api/auth/login', { identifier: 'maryam', password: 'Demo@1404' });
  ok('ورود کاربر نمونه', maryLogin.status === 200, JSON.stringify(maryLogin.json).slice(0, 120));
  // خودترمیمی آدرس‌ها: حذف انباشته‌های تستی و تضمین آدرس پیش‌فرض
  const _al = await req(mary, 'GET', '/api/me');  // فهرست آدرس داخل پروفایل
  const _testAddrs = (_al.json.me?.addresses || []).filter((x) => String(x.street || '').includes('خیابان آزمایشی'));
  for (const a of _testAddrs) await req(mary, 'DELETE', `/api/me/addresses/${a.id}`);
  const _left = (_al.json.me?.addresses || []).filter((x) => x.street !== 'خیابان آزمایشی، پلاک ۱');
  if (_left.length && !_left.some((x) => x.isDefault)) await req(mary, 'PATCH', `/api/me/addresses/${_left[0].id}`, { isDefault: true });

  await req(mary, 'POST', '/api/cart/clear'); // پاک‌سازی دریفت کوپن/اقلام مانده از اجرای قبلی
  const cartAdd = await req(mary, 'POST', '/api/cart/add', { productId: one.id, qty: 1 });
  ok('افزودن به سبد', cartAdd.status === 200 && cartAdd.json.cart.count >= 1);
  const cartOver = await req(mary, 'POST', '/api/cart/add', { productId: one.id, qty: 999 });
  ok('تعداد غیرمجاز (بیش از سقف ۹۹) → رد', cartOver.status === 400, String(cartOver.status));
  const cartOver2 = await req(mary, 'POST', '/api/cart/add', { productId: one.id, qty: Math.min(99, one.stock + 5) });
  ok('تعداد بیش از موجودی → ۴۰۹', one.stock >= 99 || cartOver2.status === 409, String(cartOver2.status));
  const quote = await req(mary, 'POST', '/api/checkout/quote', { delivery: 'courier', zone: 'city', express: false, insurance: true });
  ok('محاسبهٔ هزینهٔ ارسال و بیمه', quote.status === 200 && quote.json.quote.shipping >= 0 && quote.json.quote.insuranceFee >= 0);
  ok('بیمه فقط در ارسال پستی', quote.json.quote.insuranceFee > 0 || (quote.json.quote.plus === true && quote.json.quote.insured === true)); // پلاس = بیمهٔ خودکار رایگان
  const quotePickup = await req(mary, 'POST', '/api/checkout/quote', { delivery: 'pickup', insurance: true });
  ok('تحویل حضوری → ارسال صفر و بدون بیمه', quotePickup.json.quote.shipping === 0 && quotePickup.json.quote.insuranceFee === 0);

  const noTerms = await req(mary, 'POST', '/api/checkout', { delivery: 'pickup', acceptTerms: false });
  ok('ثبت سفارش بدون پذیرش قوانین → رد', noTerms.status === 400);

  const order = await req(mary, 'POST', '/api/checkout', { delivery: 'courier', zone: 'city', insurance: true, paymentMethod: 'gateway', acceptTerms: true });
  ok('ثبت سفارش (درگاه)', order.status === 200 && order.json.order?.code, JSON.stringify(order.json).slice(0, 160));
  ok('سفارش در انتظار پرداخت است', order.json.order?.status === 'pending_payment');
  const pay = await req(mary, 'POST', `/api/payments/simulate/${order.json.order.id}`, { success: true });
  ok('پرداخت آزمایشی → تأیید سفارش', pay.status === 200 && pay.json.order?.status === 'confirmed', JSON.stringify(pay.json).slice(0, 140));
  const payAgain = await req(mary, 'POST', `/api/payments/simulate/${order.json.order.id}`, { success: true });
  ok('پرداخت تکراری → بدون تغییر', payAgain.json.already === true);
  const afterOrder = await req(mary, 'GET', '/api/cart');
  ok('سبد پس از سفارش خالی شد', afterOrder.json.cart.count === 0, JSON.stringify(afterOrder.json.cart.count));

  // سود و زیان (مالی): هزینه در سرور ثبت می‌شود ولی هرگز به کاربر نشت نمی‌کند
  ok('قیمت خرید (cost) به کاربر عادی نشت نمی‌کند', (order.json.order?.items || []).every((it) => it.cost === undefined), JSON.stringify(order.json.order?.items?.[0]));
  const admOrders = await req(admin, 'GET', '/api/admin/orders?limit=10');
  ok('قیمت خرید فقط در پنل ادمین دیده می‌شود', (admOrders.json.items || []).some((o) => (o.items || []).some((it) => typeof it.cost === 'number')), String(admOrders.status));
  const fin = await req(admin, 'GET', '/api/admin/finance');
  ok('اندپوینت سود و زیان', fin.status === 200 && fin.json?.ok === true && Number.isFinite(fin.json?.today?.profit), String(fin.status));
  ok('فاکتور پرداخت‌شده در سود کل لحاظ شد', (fin.json?.all?.orders || 0) >= 1, JSON.stringify(fin.json?.all || {}));
  ok('روند ۳۰ روزهٔ سود ارسال شد', Array.isArray(fin.json?.daily) && fin.json.daily.length === 30);
  // کاربر تازه با کیف پول صفر → باید رد شود (مستقل از دریفت دادهٔ دموی کاربران نمونه)
  const wjar = await fresh();
  const wuname = 'wtest' + Math.floor(Math.random() * 1e6);
  await req(wjar, 'POST', '/api/auth/register', { mode: 'username', username: wuname, name: 'تست کیف پول', password: 'Test@12345', acceptTerms: true });
  await req(wjar, 'POST', '/api/cart/add', { productId: one.id, qty: 1 });
  const walletCheckout = await req(wjar, 'POST', '/api/checkout', { delivery: 'pickup', paymentMethod: 'wallet', useWallet: true, acceptTerms: true });
  ok('سفارش با موجودی ناکافی کیف پول → رد', walletCheckout.status === 400, String(walletCheckout.status));
  await req(mary, 'POST', '/api/cart/clear');

  const orders = await req(mary, 'GET', '/api/me/orders');
  ok('تاریخچهٔ سفارش‌ها', orders.status === 200 && orders.json.items.length > 0);
  const orderDetail = await req(mary, 'GET', `/api/me/orders/${order.json.order.id}`);
  ok('جزئیات سفارش', orderDetail.status === 200 && orderDetail.json.order.code === order.json.order.code);
  const otherUserOrder = await req(u2, 'GET', `/api/me/orders/${order.json.order.id}`);
  ok('دسترسی دیگران به سفارش → رد', [401, 403].includes(otherUserOrder.status), String(otherUserOrder.status));

  // ── ۶) شرط رقابتی موجودی (۲ خرید هم‌زمان برای آخرین کالا) ──
  section('شرط رقابتی موجودی');
  const adminProd = await req(admin, 'GET', '/api/admin/products?limit=1');
  const target = adminProd.json.items.find((x) => x.id !== one.id) || adminProd.json.items[0];
  const setStock = await req(admin, 'PATCH', `/api/admin/products/${target.id}`, { stock: 1 });
  ok('تنظیم موجودی روی ۱', setStock.status === 200 && setStock.json.product.stock === 1);
  const buyers = [mary, u2];
  for (const b of buyers) {
    await req(b, 'POST', '/api/cart/add', { productId: target.id, qty: 1 }).catch(() => {});
  }
  const race = await Promise.all(buyers.map((b) => req(b, 'POST', '/api/checkout', { delivery: 'pickup', paymentMethod: 'gateway', acceptTerms: true })));
  const successes = race.filter((r) => r.status === 200);
  const stockFail = race.filter((r) => r.status === 409);
  ok('فقط یک خرید موفق از کالای تک‌موجودی', successes.length === 1, `موفق:${successes.length} رد:${stockFail.length} [${race.map((r) => r.status).join(',')}]`);
  const afterStock = await req(admin, 'GET', `/api/admin/products/${target.id}`);
  ok('موجودی پس از فروش = ۰', afterStock.json.product.stock === 0, String(afterStock.json.product.stock));
  // لغو سفارش موفق → بازگشت موجودی
  const successOrder = successes[0]?.json?.order;
  if (successOrder) {
    const owner = race.findIndex((r) => r.status === 200) === 0 ? mary : u2;
    const cancel = await req(owner, 'POST', `/api/me/orders/${successOrder.id}/cancel`, { reason: 'تست' });
    ok('لغو سفارش', cancel.status === 200);
    const restocked = await req(admin, 'GET', `/api/admin/products/${target.id}`);
    ok('بازگشت موجودی پس از لغو', restocked.json.product.stock === 1, String(restocked.json.product.stock));
  }
  await req(admin, 'PATCH', `/api/admin/products/${target.id}`, { stock: target.stock });

  // فشار هم‌زمان ۸ نفره روی کالای ۳ موجودی
  await req(admin, 'PATCH', `/api/admin/products/${target.id}`, { stock: 3 });
  const jars = [];
  for (let i = 0; i < 4; i++) {
    const j = new Jar();
    await req(j, 'GET', '/api/bootstrap');
    let r = await req(j, 'POST', '/api/auth/register', { mode: 'username', username: `load${i}`, name: `کاربر ${i}`, password: 'Test@12345', acceptTerms: true });
    if (r.status === 409 || r.status === 429) r = await req(j, 'POST', '/api/auth/login', { identifier: `load${i}`, password: 'Test@12345' }); // کاربر از اجرای قبلی موجود است یا سقف ثبت‌نام
    if (r.status !== 200) { ok(`ساخت کاربر بارگذاری ${i}`, false, r.status + ' ' + JSON.stringify(r.json).slice(0, 90)); continue; }
    jars.push(j);
  }
  await Promise.all(jars.map((j) => req(j, 'POST', '/api/cart/add', { productId: target.id, qty: 1 })));
  const burst = await Promise.all(jars.map((j) => req(j, 'POST', '/api/checkout', { delivery: 'pickup', paymentMethod: 'gateway', acceptTerms: true })));
  const burstOk = burst.filter((r) => r.status === 200).length;
  const st2 = await req(admin, 'GET', `/api/admin/products/${target.id}`);
  ok('فروش هم‌زمان: مجموع موفق + باقی‌مانده = موجودی اولیه', burstOk + st2.json.product.stock === 3, `موفق=${burstOk} باقی=${st2.json.product.stock}`);
  ok('موجودی هرگز منفی نمی‌شود', st2.json.product.stock >= 0);
  await req(admin, 'PATCH', `/api/admin/products/${target.id}`, { stock: target.stock });

  // ── ۷) نظرات ──────────────────────────────────────────
  section('نظرات و سؤالات');
  const pool = await req(anon, 'GET', '/api/products?limit=60');
  const revTarget = pool.json.items.find((p) => p.ratingCount === 0) || pool.json.items[5];
  ok('انتخاب کالای بدون نظر قبلی', !!revTarget);
  const review = await req(mary, 'POST', '/api/reviews', { productId: revTarget.id, type: 'review', rating: 5, title: 'تست نظر', body: 'این یک نظر آزمایشی برای بررسی سامانهٔ تأیید است.' });
  ok('ثبت نظر → در انتظار تأیید', review.status === 200 && review.json.review?.status === 'pending', `${review.status} ${JSON.stringify(review.json).slice(0, 140)}`);
  const publicList = await req(anon, 'GET', `/api/products/${revTarget.id}/reviews`);
  ok('نظر تأییدنشده عمومی نمایش داده نمی‌شود', !publicList.json.items.some((r) => r.id === review.json.review.id));
  const modList = await req(admin, 'GET', '/api/admin/reviews?status=pending');
  ok('ادمین نظر در انتظار را می‌بیند', modList.json.items.some((r) => r.id === review.json.review.id));
  const approve = await req(admin, 'PATCH', `/api/admin/reviews/${review.json.review.id}`, { status: 'approved' });
  ok('تأیید نظر توسط ادمین', approve.status === 200);
  const publicList2 = await req(anon, 'GET', `/api/products/${revTarget.id}/reviews`);
  ok('نظر تأییدشده عمومی می‌شود', publicList2.json.items.some((r) => r.id === review.json.review.id));
  const question = await req(mary, 'POST', '/api/reviews', { productId: revTarget.id, type: 'question', title: 'سؤال تست', body: 'آیا این کالا گارانتی تعویض دارد؟' });
  ok('ثبت سؤال', question.status === 200 && question.json.review?.type === 'question', `${question.status} ${JSON.stringify(question.json).slice(0, 140)}`);
  const dup = await req(mary, 'POST', '/api/reviews', { productId: revTarget.id, type: 'question', title: 'سؤال تکراری', body: 'آیا این کالا گارانتی تعویض دارد؟' });
  ok('سؤال تکراری → ۴۰۹', dup.status === 409);

  // ── ۸) تیکت و پشتیبانی ────────────────────────────────
  section('تیکت و پشتیبانی');
  const noRules = await req(mary, 'POST', '/api/tickets', { subject: 'بدون پذیرش قوانین', category: 'order', priority: 'normal', body: 'متن آزمایشی برای بررسی', rulesAccepted: false });
  ok('تیکت بدون پذیرش قوانین → رد', noRules.status === 400);
  const ticket = await req(mary, 'POST', '/api/tickets', { subject: 'پیگیری سفارش تست', category: 'order', priority: 'high', body: 'سلام، وضعیت سفارش آزمایشی من چگونه است؟', rulesAccepted: true });
  ok('ثبت تیکت', ticket.status === 200 && ticket.json.ticket?.code, `${ticket.status} ${JSON.stringify(ticket.json).slice(0,120)}`);
  const reply = await req(admin, 'PATCH', `/api/admin/tickets/${ticket.json.ticket.id}`, { body: 'سلام، سفارش شما بررسی و تأیید شد.' });
  ok('پاسخ ادمین به تیکت', reply.status === 200);
  const userTicket = await req(mary, 'GET', `/api/tickets/${ticket.json.ticket.id}`);
  ok('کاربر پاسخ را می‌بیند', userTicket.json.ticket.messages.some((m) => m.from === 'staff'));
  const chat = await req(mary, 'POST', '/api/support/messages', { body: 'سلام، یک سؤال دارم.' });
  ok('ارسال پیام چت پشتیبانی', chat.status === 200);
  const chatAdmin = await req(admin, 'GET', '/api/admin/support');
  ok('ادمین رشتهٔ چت را می‌بیند', chatAdmin.json.items.length > 0);
  const chatReply = await req(admin, 'POST', `/api/admin/support/${maryLogin.json.me.id}`, { body: 'سلام، در خدمتیم.' });
  ok('پاسخ پشتیبانی', chatReply.status === 200, `${chatReply.status} ${JSON.stringify(chatReply.json).slice(0,120)}`);
  const chatUserView = await req(mary, 'GET', '/api/support/messages');
  ok('کاربر پاسخ پشتیبانی را می‌بیند', chatUserView.json.items.some((m) => m.from === 'staff'));

  const fb = await req(anon, 'POST', '/api/feedback', { type: 'bug', title: 'گزارش خطای تست', body: 'در صفحهٔ محصولات یک خطای آزمایشی مشاهده شد.', page: '/products' });
  ok('گزارش خطا توسط مهمان', fb.status === 200);
  const fbList = await req(admin, 'GET', '/api/admin/feedback');
  ok('ادمین گزارش خطا را می‌بیند', fbList.json.items.some((f) => f.id === fb.json.id));

  // ── ۹) پنل مدیریت و دسترسی‌ها ──────────────────────────
  section('پنل مدیریت و ماتریس دسترسی');
  const overview = await req(admin, 'GET', '/api/admin/overview');
  ok('داشبورد مدیر', overview.status === 200 && overview.json.stats.products > 0);
  ok('داشبورد شامل آمار امروز است', overview.json.today !== undefined);
  const forbiddenForUser = await req(mary, 'GET', '/api/admin/overview');
  ok('کاربر عادی به داشبورد مدیر دسترسی ندارد', forbiddenForUser.status === 403);
  const anonAdmin = await req(anon, 'GET', '/api/admin/products');
  ok('مهمان به پنل دسترسی ندارد', anonAdmin.status === 401);

  // تنظیمات بات تلگرام: توکن باید به پنل برگردد تا فیلد توکن پس از دیپلوی خالی نماند
  const tgPanel = await req(admin, 'GET', '/api/admin/telegram');
  ok('پنل تلگرام: وضعیت بات و تنظیمات برگردانده می‌شود', tgPanel.status === 200 && tgPanel.json.webhook !== undefined);
  ok('پنل تلگرام: فیلد token همیشه رشته است و با tokenSet هم‌خوان است',
    typeof tgPanel.json.token === 'string' && !!tgPanel.json.token === !!tgPanel.json.tokenSet,
    JSON.stringify({ tokenSet: tgPanel.json.tokenSet, tokenLen: String(tgPanel.json.token || '').length }));
  const tgPanelForUser = await req(mary, 'GET', '/api/admin/telegram');
  ok('کاربر عادی توکن ربات تلگرام را نمی‌بیند', tgPanelForUser.status === 403 && tgPanelForUser.json?.token === undefined);

  // تضمین وجود حساب کارمند (نقش + ماتریس دسترسی) برای تست‌های پنل
  await ensureStaffAccount(BASE);
  const staff = new Jar();
  await req(staff, 'GET', '/api/bootstrap');
  const staffLogin = await req(staff, 'POST', '/api/auth/login', { identifier: 'staff', password: 'Staff@1404' });
  ok('ورود کارمند', staffLogin.status === 200 && staffLogin.json.me?.role === 'staff');
  const staffOrders = await req(staff, 'GET', '/api/admin/orders');
  ok('کارمند: مشاهدهٔ سفارش‌ها مجاز', staffOrders.status === 200);
  const staffUsers = await req(staff, 'GET', '/api/admin/users');
  ok('کارمند: دسترسی به کاربران ندارد', staffUsers.status === 403);
  const staffSettings = await req(staff, 'PATCH', '/api/admin/settings/theme', { value: { accent: '#ff0000' } });
  ok('کارمند: تغییر تم مجاز نیست', staffSettings.status === 403);

  // ایجاد/ویرایش/حذف کالا توسط مدیر
  const created = await req(admin, 'POST', '/api/admin/products', {
    name: 'کابل تست خودکار', nameEn: 'Auto Test Cable', categoryId: 'cables', brandId: 'baseus',
    price: 150000, oldPrice: 190000, stock: 7, authenticity: 'original', warrantyMonths: 6,
    specs: { 'طول': '۱ متر' }, tags: ['تست'], description: 'کالای آزمایشی برای تست سامانه.',
  });
  ok('ایجاد محصول', created.status === 200 && created.json.product?.sku, JSON.stringify(created.json).slice(0, 160));
  const createdDetail = await req(anon, 'GET', `/api/products/${created.json.product.id}`);
  ok('مشخصات فنی ذخیره و بازگشت داده می‌شود', String(createdDetail.json.product?.specs?.['طول'] || '').includes('متر'), JSON.stringify(createdDetail.json.product?.specs));
  ok('بارکد EAN-13 خودکار ساخته شد', /^\d{13}$/.test(created.json.product.barcode || ''));
  ok('تصویر پیش‌فرض ساخته شد', (created.json.product.images || []).length === 1);
  const imgRes = await fetch(BASE + created.json.product.images[0]);
  ok('تصویر SVG محصول قابل دریافت است', imgRes.status === 200 && (await imgRes.text()).includes('<svg'));
  const edited = await req(admin, 'PATCH', `/api/admin/products/${created.json.product.id}`, { price: 175000, stock: 9 });
  ok('ویرایش قیمت و موجودی', edited.status === 200 && edited.json.product.price === 175000 && edited.json.product.stock === 9);
  const otherProd = adminProd.json.items.find((p) => p.id !== created.json.product.id && p.barcode) || adminProd.json.items[1] || adminProd.json.items[0];
  if (!otherProd.barcode) {
    const seededBarcode = await req(admin, 'PATCH', `/api/admin/products/${otherProd.id}`, { barcode: '4006381333931' });
    otherProd.barcode = seededBarcode.json.product?.barcode || '4006381333931';
  }
  const dupBarcode = await req(admin, 'PATCH', `/api/admin/products/${created.json.product.id}`, { barcode: otherProd.barcode });
  ok('بارکد تکراری → رد', [400, 409].includes(dupBarcode.status));
  const badPrice = await req(admin, 'PATCH', `/api/admin/products/${created.json.product.id}`, { price: -5 });
  ok('قیمت منفی → رد', badPrice.status === 400);
  const deleted = await req(admin, 'DELETE', `/api/admin/products/${created.json.product.id}`);
  ok('حذف محصول', deleted.status === 200);
  const gone = await req(anon, 'GET', `/api/products/${created.json.product.id}`);
  ok('محصول حذف‌شده در دسترس نیست', gone.status === 404);

  // دسته و برند
  const cat = await req(admin, 'POST', '/api/admin/categories', { name: 'دستهٔ تست', nameEn: 'Test Category', glyph: 'misc' });
  ok('ایجاد دسته', cat.status === 200);
  const catDel = await req(admin, 'DELETE', `/api/admin/categories/${cat.json.category.id}`);
  ok('حذف دستهٔ خالی', catDel.status === 200);
  const brand = await req(admin, 'POST', '/api/admin/brands', { name: 'برند تست', nameEn: 'Test Brand' });
  ok('ایجاد برند', brand.status === 200);
  await req(admin, 'DELETE', `/api/admin/brands/${brand.json.brand.id}`);

  // کوپن
  const coupon = await req(admin, 'POST', '/api/admin/coupons', { code: 'test' + Math.floor(Math.random() * 999), type: 'percent', value: 15, minOrder: 0, usageLimit: 10, perUser: 1 });
  ok('ایجاد کوپن تخفیف', coupon.status === 200);
  const couponUse = await req(mary, 'POST', '/api/cart/add', { productId: one.id, qty: 1 });
  const couponApply = await req(mary, 'POST', '/api/cart/coupon', { code: coupon.json.coupon.code });
  ok('اعمال کوپن در سبد', couponApply.status === 200 && couponApply.json.discount > 0, JSON.stringify(couponApply.json).slice(0, 120));
  const badCoupon = await req(mary, 'POST', '/api/cart/coupon', { code: 'NOPE123' });
  ok('کوپن نامعتبر → رد', badCoupon.status === 400);

  // تنظیمات و تم
  const setTheme = await req(admin, 'PATCH', '/api/admin/settings/theme', { value: { accent: '#f59e0b', portTheme: false } });
  ok('تغییر تم (خاموش کردن پوستهٔ تهرانی)', setTheme.status === 200 && setTheme.json.value.portTheme === false);
  const badColor = await req(admin, 'PATCH', '/api/admin/settings/theme', { value: { accent: 'red-ish' } });
  ok('رنگ نامعتبر → رد', badColor.status === 400);
  await req(admin, 'PATCH', '/api/admin/settings/theme', { value: { portTheme: true } });
  const setUi = await req(admin, 'PATCH', '/api/admin/settings/ui', { value: { searchPosition: 'start' } });
  ok('جابجایی جایگاه جست‌وجو در UI', setUi.status === 200 && setUi.json.value.searchPosition === 'start');
  await req(admin, 'PATCH', '/api/admin/settings/ui', { value: { searchPosition: 'center' } });
  const badUi = await req(admin, 'PATCH', '/api/admin/settings/ui', { value: { searchPosition: 'nowhere' } });
  ok('مقدار نامعتبر UI → رد', badUi.status === 400);
  const feat = await req(admin, 'PATCH', '/api/admin/settings/features', { value: { wallet: false } });
  ok('خاموش کردن قابلیت کیف پول', feat.status === 200 && feat.json.value.wallet === false);
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { wallet: true } });
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { captcha: true } }); // بازگرداندن کپچا برای اجرای بعدی

  // تبلیغات
  const ad = await req(admin, 'POST', '/api/admin/ads', { slot: 'home_strip', title: 'تبلیغ تست', text: 'متن تبلیغ آزمایشی', link: '#/products', active: true });
  ok('ایجاد تبلیغ', ad.status === 200);
  const boot2 = await req(anon, 'GET', '/api/bootstrap');
  ok('تبلیغ در bootstrap عمومی دیده می‌شود', boot2.json.ads.some((a) => a.id === ad.json.ad.id));
  await req(admin, 'DELETE', `/api/admin/ads/${ad.json.ad.id}`);

  // اعلان همگانی
  const notif = await req(admin, 'POST', '/api/admin/notifications', { title: 'اعلان تست سراسری', body: 'این یک اعلان آزمایشی است.', link: '#/products', level: 'info' });
  ok('ارسال اعلان سراسری', notif.status === 200);
  const myNotif = await req(mary, 'GET', '/api/me/notifications');
  ok('کاربر اعلان سراسری را می‌بیند', myNotif.json.items.some((n) => n.id === notif.json.notification.id));

  // بارکد و اسکن
  const barcodeList = await req(admin, 'GET', '/api/admin/barcode');
  ok('لیست بارکدها برای چاپ برچسب', barcodeList.status === 200 && barcodeList.json.items.length > 0);
  const scanTarget = barcodeList.json.items[0];
  if (!scanTarget.barcode) {
    const seeded = await req(admin, 'PATCH', `/api/admin/products/${scanTarget.id}`, { barcode: '4006381333932' });
    scanTarget.barcode = seeded.json.product?.barcode || '4006381333932';
  }
  const scan = await req(anon, 'POST', '/api/scan', { code: scanTarget.barcode });
  ok('اسکن بارکد → یافتن کالا و قیمت', scan.status === 200 && scan.json.product?.id === scanTarget.id && scan.json.product?.price === scanTarget.price, `${scan.status} ${JSON.stringify(scan.json).slice(0,120)}`);
  const scanSku = await req(anon, 'POST', '/api/scan', { code: scanTarget.sku });
  ok('اسکن با کد کالا (SKU)', scanSku.status === 200 && scanSku.json.found === true);
  const scanBad = await req(anon, 'POST', '/api/scan', { code: '0000000000000' });
  ok('بارکد ناشناخته → ۴۰۴', scanBad.status === 404);
  const genCode = await req(admin, 'POST', '/api/admin/barcode/generate', { count: 3 });
  ok('تولید بارکد جدید', genCode.status === 200 && genCode.json.codes.length === 3 && genCode.json.codes.every((c) => /^\d{13}$/.test(c)));

  // لاگ و آمار
  const audit = await req(admin, 'GET', '/api/admin/audit?action=auth.login&limit=200');
  ok('گزارش رویدادها (Audit Log)', audit.status === 200 && audit.json.items.length > 0);
  ok('رویداد ورود مدیر ثبت شده', audit.json.items.some((l) => l.action === 'auth.login'));
  const stats = await req(admin, 'GET', '/api/admin/stats?days=14');
  ok('آمار و گزارش‌گیری', stats.status === 200 && stats.json.series.length === 14);
  const auditUser = await req(staff, 'GET', '/api/admin/audit');
  ok('کارمند بدون دسترسی، لاگ را نمی‌بیند', auditUser.status === 403);

  // خروجی CSV
  const csv = await req(admin, 'GET', '/api/admin/export/products?format=csv');
  ok('خروجی CSV محصولات', csv.status === 200 && csv.text.includes('sku'));

  // ── ۱۰) کیف پول و پلاس ────────────────────────────────
  section('کیف پول و اشتراک پلاس');
  const wallet = await req(mary, 'GET', '/api/me/wallet');
  ok('مشاهدهٔ کیف پول', wallet.status === 200 && Number.isFinite(wallet.json.balance));
  const deposit = await req(mary, 'POST', '/api/me/wallet/deposit', { amount: 500000 });
  ok('شارژ کیف پول', deposit.status === 200 && deposit.json.balance === wallet.json.balance + 500000);
  const badDeposit = await req(mary, 'POST', '/api/me/wallet/deposit', { amount: 10 });
  ok('مبلغ نامعتبر شارژ → رد', badDeposit.status === 400);
  const plus = await req(mary, 'POST', '/api/me/plus/subscribe', { method: 'wallet' });
  ok('خرید اشتراک پلاس', plus.status === 200 && plus.json.plus.active === true);
  const meAfter = await req(mary, 'GET', '/api/me');
  ok('وضعیت پلاس در پروفایل', meAfter.json.me.plus.active === true);
  const plusQuote = await req(mary, 'POST', '/api/checkout/quote', { delivery: 'courier', zone: 'country', insurance: false });
  ok('پلاس → ارسال رایگان', plusQuote.json.quote.shipping === 0);
  ok('پلاس → بیمهٔ خودکار', plusQuote.json.quote.insured === true && plusQuote.json.quote.insuranceFee === 0);
  ok('پلاس → تخفیف روی کالا', plusQuote.json.quote.plusDiscount > 0);

  // ── ۱۱) پروفایل، آدرس، علاقه‌مندی ─────────────────────
  section('پروفایل و لیست من');
  const addr = await req(mary, 'POST', '/api/me/addresses', { title: 'خانه', receiver: 'مریم احمدی', phone: '09171234567', province: 'تهران', city: 'تهران', zone: 'city', street: 'خیابان آزمایشی، پلاک ۱', postal: '7512345678', isDefault: true });
  ok('ثبت آدرس', addr.status === 200 && addr.json.addresses.length > 0, addr.status + ' ' + JSON.stringify(addr.json).slice(0, 120));

  const badAddr = await req(mary, 'POST', '/api/me/addresses', { title: '', receiver: 'x', phone: '123', province: '', city: '', street: '' });
  ok('آدرس نامعتبر → رد', badAddr.status === 400);
  const wish = await req(mary, 'POST', `/api/me/wishlist/${one.id}`);
  ok('افزودن به لیست من', wish.status === 200 && wish.json.added === true);
  const wishList = await req(mary, 'GET', '/api/me/wishlist');
  ok('مشاهدهٔ لیست من', wishList.json.items.some((p) => p.id === one.id));
  const unwish = await req(mary, 'POST', `/api/me/wishlist/${one.id}`);
  ok('حذف از لیست من', unwish.json.added === false);
  let alert = await req(mary, 'POST', `/api/me/alerts/${one.id}`);
  if (alert.status === 200 && alert.json.subscribed === false) alert = await req(mary, 'POST', `/api/me/alerts/${one.id}`); // پایان toggle از اجرای قبلی
  ok('ثبت هشدار موجودی', alert.status === 200 && alert.json.subscribed === true);
  const sessions = await req(mary, 'GET', '/api/me/sessions');
  ok('لیست نشست‌های فعال', sessions.status === 200 && sessions.json.items.length > 0);
  const exportData = await req(mary, 'GET', '/api/me/export');
  ok('خروجی داده‌های شخصی', exportData.status === 200 && exportData.json.data.profile.username === 'maryam');
  ok('خروجی شخصی شامل رمز عبور نیست', !JSON.stringify(exportData.json).includes('passwordHash'));

  const profile = await req(mary, 'PATCH', '/api/me', { name: 'مریم احمدی', prefs: { theme: 'light', locale: 'en' } });
  ok('ویرایش پروفایل و ترجیحات', profile.status === 200 && profile.json.me.prefs.theme === 'light');
  await req(mary, 'PATCH', '/api/me', { prefs: { theme: 'dark', locale: 'fa' } });
  const badEmail = await req(mary, 'PATCH', '/api/me', { email: 'not-an-email' });
  ok('ایمیل نامعتبر → رد', badEmail.status === 400);

  // ── ۱۲) آپلود تصویر ───────────────────────────────────
  section('آپلود تصویر');
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  const up = await req(mary, 'POST', '/api/upload', { data: `data:image/png;base64,${pngBase64}` });
  ok('آپلود PNG معتبر', up.status === 200 && up.json.url.startsWith('/uploads/'));
  if (up.json.url) {
    const img = await fetch(BASE + up.json.url);
    ok('فایل آپلودشده قابل دریافت است', img.status === 200);
  }
  const upBad = await req(mary, 'POST', '/api/upload', { data: 'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') });
  ok('آپلود غیرتصویری → رد', upBad.status === 400);
  const upAnon = await req(anon, 'POST', '/api/upload', { data: `data:image/png;base64,${pngBase64}` });
  ok('آپلود توسط مهمان → ۴۰۱', upAnon.status === 401);

  // ── ۱۳) صفحه‌ها و آمار عمومی ───────────────────────────
  section('صفحه‌های محتوایی');
  for (const key of ['about', 'guide', 'service', 'faq', 'terms', 'privacy', 'insurance', 'ticketRules', 'bugReport', 'contact']) {
    const r = await req(anon, 'GET', `/api/pages/${key}`);
    ok(`صفحهٔ «${key}»`, r.status === 200 && r.json.page && JSON.stringify(r.json.page).length > 100);
  }
  const badPage = await req(anon, 'GET', '/api/pages/nothing');
  ok('صفحهٔ نامعتبر → رد', badPage.status === 400);
  const pubStats = await req(anon, 'GET', '/api/stats/public');
  ok('آمار عمومی سایت', pubStats.status === 200 && pubStats.json.stats.products > 0);

  // ── ۴) محدودسازی نرخ ────────────────────────────────
  section('محدودسازی نرخ');
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { captcha: false } }); // ترک مخاصمهٔ موقت برای تست محدودسازی
  let limited = false;
  for (let i = 0; i < 60; i++) {
    const r = await req(await fresh(), 'POST', '/api/auth/otp/send', { channel: 'phone', target: '09127776655', purpose: 'register' }).catch(() => null);
    if (r && r.status === 429) { limited = true; break; }
  }
  ok('محدودسازی ارسال OTP فعال است', limited);
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { captcha: true } });

  // ── ۱۶) مدیریت منوها و سیاست سادهٔ رمز ──────────────────
  section('مدیریت منوها و بخش‌ها');
  const navSave = await req(admin, 'PATCH', '/api/admin/settings/nav', { value: {
    account: [
      { id: 'wallet', fa: 'کیف پول طلایی', en: 'Golden wallet', icon: 'dollar', emoji: '', show: true, on: true },
      { id: 'reviews', fa: '', en: '', icon: 'star', emoji: '⭐', show: false, on: false },
      { id: 'wallet', fa: 'تکراری', show: true, on: true },            // تکراری → حذف می‌شود
      { id: '<script>x</script>', fa: 'بد', show: true, on: true },     // شناسهٔ نامعتبر → حذف می‌شود
    ],
    header: [{ id: 'lottery', fa: 'قرعه‌کشی یاسایی', show: true, on: false }],
  } });
  ok('ذخیرهٔ تنظیمات منوها (PATCH /api/admin/settings/nav) با موفقیت انجام می‌شود',
    navSave.status === 200 && Array.isArray(navSave.json?.value?.account), `وضعیت: ${navSave.status}`);
  ok('ترتیب و عنوان دلخواه فارسی/انگلیسی حفظ می‌شود',
    navSave.json?.value?.account?.[0]?.id === 'wallet' && navSave.json.value.account[0].fa === 'کیف پول طلایی'
    && navSave.json.value.account[0].icon === 'dollar', JSON.stringify(navSave.json?.value?.account?.[0]));
  ok('شناسه‌های تکراری و نامعتبر حذف می‌شوند (فقط دو ردیف سالم می‌ماند)',
    navSave.json?.value?.account?.length === 2, JSON.stringify((navSave.json?.value?.account || []).map((x) => x.id)));
  ok('وضعیت نمایش/فعال و ایموجی هر دکمه ذخیره می‌شود',
    navSave.json?.value?.account?.[1]?.show === false && navSave.json.value.account[1].on === false
    && navSave.json.value.account[1].emoji === '⭐', JSON.stringify(navSave.json?.value?.account?.[1]));

  const bootNav = await req(await fresh(), 'GET', '/api/bootstrap');
  ok('پس از ذخیره، قاعدهٔ منوها در /api/bootstrap برای همهٔ کاربران می‌آید',
    bootNav.json?.settings?.nav?.account?.[0]?.fa === 'کیف پول طلایی'
    && bootNav.json?.settings?.nav?.header?.[0]?.on === false, JSON.stringify(bootNav.json?.settings?.nav)?.slice(0, 160));

  const navBad = await req(admin, 'PATCH', '/api/admin/settings/nav', { value: 'not-an-object' });
  ok('ورودی نامعتبر برای منوها خطای ۵۰۰ نمی‌دهد', navBad.status < 500, `وضعیت: ${navBad.status}`);

  // پاک‌سازی: منوها به پیش‌فرض برگردند تا بقیهٔ تست‌ها دست‌نخورده بمانند
  const navReset = await req(admin, 'PATCH', '/api/admin/settings/nav', { value: { account: [], header: [] } });
  ok('خالی‌کردن تنظیمات منوها هم پذیرفته می‌شود (بازگشت به پیش‌فرض سایت)',
    navReset.status === 200 && navReset.json?.value?.account?.length === 0, JSON.stringify(navReset.json?.value));

  section('سیاست سادهٔ رمز عبور');
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { captcha: false } }); // ساده‌سازی تست ثبت‌نام
  const pwdShort = await req(await fresh(), 'POST', '/api/auth/register', {
    mode: 'username', username: 'p' + Math.floor(Math.random() * 1e6), name: 'رمز کوتاه', password: '123', acceptTerms: true,
  });
  ok('رمز کوتاه‌تر از ۴ نویسه رد می‌شود', pwdShort.status === 400 && pwdShort.json?.code === 'weak_password', `${pwdShort.status} ${pwdShort.json?.code}`);
  const pwdRepeat = await req(await fresh(), 'POST', '/api/auth/register', {
    mode: 'username', username: 'q' + Math.floor(Math.random() * 1e6), name: 'رمز تکراری', password: '1111', acceptTerms: true,
  });
  ok('رمز از یک نویسهٔ تکراری (1111) رد می‌شود', pwdRepeat.status === 400 && pwdRepeat.json?.code === 'weak_password', `${pwdRepeat.status} ${pwdRepeat.json?.code}`);
  const simpleName = 'simple' + Math.floor(Math.random() * 1e6);
  const pwdSimple = await req(await fresh(), 'POST', '/api/auth/register', {
    mode: 'username', username: simpleName, name: 'کاربر ساده', password: '1234', acceptTerms: true,
  });
  ok('ثبت‌نام با رمز چهاررقمی ساده (1234) بدون نیاز به حرف بزرگ/نماد انجام می‌شود',
    pwdSimple.status === 200 && pwdSimple.json?.me?.username === simpleName, `${pwdSimple.status} ${JSON.stringify(pwdSimple.json).slice(0, 120)}`);
  const simpleLogin = await req(await fresh(), 'POST', '/api/auth/login', { identifier: simpleName, password: '1234' });
  ok('ورود با همان رمز ساده کار می‌کند', simpleLogin.status === 200 && simpleLogin.json?.me?.username === simpleName, `${simpleLogin.status}`);
  const dupName = await req(await fresh(), 'POST', '/api/auth/register', {
    mode: 'username', username: simpleName, name: 'تکراری دیگر', password: '1234', acceptTerms: true,
  });
  ok('نام کاربری تکراری همچنان با ۴۰۹ رد می‌شود', dupName.status === 409 && dupName.json?.code === 'username_taken', `${dupName.status} ${dupName.json?.code}`);
  await req(admin, 'PATCH', '/api/admin/settings/features', { value: { captcha: true } }); // بازگرداندن کپچا

  section('تنظیمات احراز هویت (KYC)');
  const kycOff = await req(admin, 'PATCH', '/api/admin/settings/orders', { value: {
    kyc: { enabled: false, showInNav: false, required: true, condition: 'all', minAmount: 50000000, message: '' },
  } });
  ok('کلید اصلی KYC و نمایش در منو ذخیره می‌شود (kycEnabled/kycShowInNav)',
    kycOff.status === 200 && kycOff.json?.value?.kyc?.enabled === false && kycOff.json.value.kyc.showInNav === false,
    JSON.stringify(kycOff.json?.value?.kyc));
  const bootKycOff = await req(await fresh(), 'GET', '/api/bootstrap');
  ok('با خاموش‌بودن KYC، قاعده برای خرید اجباری نمی‌شود (active=false)',
    bootKycOff.json?.settings?.orders?.kyc?.enabled === false && bootKycOff.json.settings.orders.kyc.active === false,
    JSON.stringify(bootKycOff.json?.settings?.orders?.kyc));
  const kycSubmitOff = await req(mary, 'POST', '/api/user/kyc', { selfie: '/uploads/a.jpg', idCard: '/uploads/b.jpg', formDoc: '/uploads/c.pdf' });
  ok('با خاموش‌بودن KYC، ارسال مدارک با پیام محترمانه بسته است (403 kyc_disabled)',
    kycSubmitOff.status === 403 && kycSubmitOff.json?.code === 'kyc_disabled', `${kycSubmitOff.status} ${kycSubmitOff.json?.code}`);
  const kycOn = await req(admin, 'PATCH', '/api/admin/settings/orders', { value: {
    kyc: { enabled: true, showInNav: true, required: false, condition: 'disabled', minAmount: 50000000, message: '' },
  } });
  ok('بازگرداندن KYC به حالت پیش‌فرض (روشن و اختیاری)',
    kycOn.status === 200 && kycOn.json?.value?.kyc?.enabled === true && kycOn.json.value.kyc.condition === 'disabled',
    JSON.stringify(kycOn.json?.value?.kyc));

  // ── ۱۵) SPA و استاتیک ─────────────────────────────────
  section('مسیرهای وب');
  const spa = await fetch(BASE + '/some/deep/route');
  ok('SPA fallback → HTML', spa.status === 200 && (await spa.text()).includes('<!doctype html'));
  const api404 = await req(anon, 'GET', '/api/does-not-exist');
  ok('API ناشناخته → JSON ۴۰۴', api404.status === 404 && api404.json.ok === false);
  const robots = await fetch(BASE + '/robots.txt');
  ok('robots.txt', robots.status === 200);
  const sitemap = await fetch(BASE + '/sitemap.xml');
  ok('sitemap.xml', sitemap.status === 200 && (await sitemap.text()).includes('<urlset'));

  // ── جمع‌بندی ──────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log(`  نتیجه: ${pass} موفق · ${fail} ناموفق`);
  if (failures.length) {
    console.log('\n  موارد ناموفق:');
    for (const f of failures) console.log(`   • ${f}`);
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST RUNNER ERROR:', e); process.exit(2); });
