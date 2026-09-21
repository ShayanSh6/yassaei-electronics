// ─────────────────────────────────────────────────────────────
//  order-ceiling: سقف خرید غلتان ۴۸ ساعته (فقط خریدهای موفق) + قفل رگرسیون
//  رفع باگ‌های تسویه‌حساب (Part 2):
//   • checkout.mjs: defZone امن، انتخابگر آدرس + دکمهٔ «افزودن آدرس جدید»،
//     KYC فقط از تنظیمات (بدون بلوک هاردکد)
//   • pay.mjs: ایمپورت fireConfetti از ../ui.mjs
//  رفتار سقف (Part 1):
//   • فقط سفارش‌های موفق (payment.status === 'paid') در بازهٔ غلتان شمرده می‌شوند
//   • پرداخت‌نشده/در انتظار/لغوشده هرگز شمرده نمی‌شود
//   • با رسیدن سبد به زیر سهمیه، مسدودی فوراً رفع می‌شود (هیچ‌کس محروم نمی‌شود)
//   • کلید اصلی + مبلغ + بازهٔ ساعت از پنل مدیریت کاملاً قابل تنظیم است
//  اجرا: BASE=http://127.0.0.1:3000 node tests/order-ceiling.mjs
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClient, login, captchaToken } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PASSWORDS = ['Yassaei@1404', 'Demo@1404'];
let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}
function section(t) { console.log(`\n▌ ${t}`); }

console.log(`\n═══ order-ceiling: سقف خرید غلتان · ${BASE} ═══\n`);

// ── بخش ۱: قفل رگرسیون رفع باگ‌های تسویه‌حساب/پرداخت ───────────
section('رفع باگ‌های تسویه‌حساب و پرداخت (قفل رگرسیون)');
{
  const src = readFileSync(join(ROOT, 'public/js/views/checkout.mjs'), 'utf8');
  const defZoneIdx = src.indexOf("const defZone = zones[0]?.id || 'country';");
  ok('checkout: defZone به‌صورت امن تعریف شده است', defZoneIdx >= 0);
  ok('checkout: defZone قبل از هر استفاده‌ای آمده است', defZoneIdx >= 0 && !src.slice(0, defZoneIdx).includes('defZone'));
  ok('checkout: گروه انتخاب آدرس (radio) از S.me?.addresses رندر می‌شود', src.includes('S.me?.addresses || []') && src.includes('name="addressId"') && src.includes('data-addresses'));
  ok('checkout: دکمهٔ «افزودن آدرس جدید» با data-act="addr-add" هست', src.includes('data-act="addr-add"'));
  ok('checkout: مودال آدرس و ذخیرهٔ آن سر جایش است', src.includes("act('addr-save'") && src.includes('openAddressModal()'));
  ok('checkout: KYC فقط از تنظیمات فروشگاه خوانده می‌شود (بدون بلوک هاردکد)', src.includes("from '../lib/kyc.mjs'") && !/kycRequired\s*=\s*true/.test(src) && !/throw[^;]*kyc/i.test(src));
  ok('checkout: هشدار سقف خرید غلتان پیاده‌سازی شده است', src.includes('ceilingNotice') && src.includes('data-ceiling'));
}
{
  const src = readFileSync(join(ROOT, 'public/js/views/pay.mjs'), 'utf8');
  ok('pay: fireConfetti از ../ui.mjs ایمپورت شده است', /import\s*\{[^}]*fireConfetti[^}]*\}\s*from\s*'\.\.\/ui\.mjs'/.test(src));
}

// ── بخش ۲: رفتار سرور سقف غلتان ───────────────────────────────
/** ورود مدیر با هر یک از رمزهای شناخته‌شده */
async function adminClient() {
  const cl = makeClient(BASE);
  await cl.get('/api/bootstrap');
  for (const pw of ADMIN_PASSWORDS) {
    if (await login(cl, 'admin', pw)) return cl;
  }
  return null;
}

const anonBoot = (await makeClient(BASE).get('/api/bootstrap')).json;
const ORDER_ORIGINAL = { ...(anonBoot.settings?.orders || {}) };
const CAPTCHA_ORIGINAL = anonBoot.settings?.features?.captcha;

let amount = 0;
let product = null;

try {
  // ── ورود مدیر و آماده‌سازی ──────────────────────────────────
  const admin = await adminClient();
  ok('ورود مدیر', !!admin);
  if (admin) await admin.patch('/api/admin/settings/features', { captcha: false });

  // محصول با موجودی کافی
  const list = await makeClient(BASE).get('/api/products?limit=96');
  product = (list.json.items || []).find((p) => (p.stock || 0) >= 5 && p.price >= 50000) || (list.json.items || []).find((p) => (p.stock || 0) >= 5);
  ok('یافتن محصول مناسب برای آزمون', !!product);
  amount = product.price * 2; // سقف = دو برابر قیمت → بعد از یک خرید موفق، فقط یک خرید دیگر جا می‌شود

  await admin.patch('/api/admin/settings/orders', { value: { orderCeilingEnabled: true, orderCeilingAmount: amount, orderCeilingHours: 48 } });
  const saved = (await admin.get('/api/admin/settings')).json?.settings?.orders || {};
  ok('کلیدهای سقف در تنظیمات ذخیره شد', saved.orderCeilingEnabled === true && Number(saved.orderCeilingAmount) === amount && Number(saved.orderCeilingHours) === 48, JSON.stringify({ e: saved.orderCeilingEnabled, a: saved.orderCeilingAmount, h: saved.orderCeilingHours }));

  // ── کاربر تازه (بدون هیچ تاریخچه‌ای) ────────────────────────
  const uname = 'ceil' + Math.floor(Math.random() * 1e6);
  const user = makeClient(BASE);
  await user.get('/api/bootstrap');
  const reg = await user.post('/api/auth/register', {
    mode: 'username', username: uname, name: 'کاربر سقف', password: 'Test@12345',
    acceptTerms: true, captchaToken: await captchaToken(user),
  });
  ok('ثبت‌نام کاربر آزمون', reg.status === 200 && !!reg.json?.me, JSON.stringify(reg.json).slice(0, 140));

  const checkoutBody = (paymentMethod = 'gateway') => ({ delivery: 'pickup', zone: 'country', express: false, insurance: false, paymentMethod, acceptTerms: true });
  const quote = () => user.post('/api/checkout/quote', { delivery: 'pickup', zone: 'country' });

  // خرید ۱: ثبت → پرداخت‌نشده
  await user.post('/api/cart/clear');
  await user.post('/api/cart/add', { productId: product.id, qty: 1 });
  let q = await quote();
  ok('quote پاسخ شامل وضعیت سقف است', !!q.json?.ceiling && typeof q.json.ceiling === 'object');
  ok('کاربر تازه: pastSpent صفر است', q.json.ceiling.pastSpent === 0, String(q.json.ceiling.pastSpent));
  ok('کاربر تازه: سهمیهٔ کامل آزاد است', q.json.ceiling.remaining === amount, `${q.json.ceiling.remaining} vs ${amount}`);
  ok('بازهٔ غلتان ۴۸ ساعته اعمال شد', q.json.ceiling.hours === 48, String(q.json.ceiling.hours));
  const o1 = await user.post('/api/checkout', checkoutBody());
  ok('سفارش اول ثبت شد', o1.status === 200, JSON.stringify(o1.json).slice(0, 160));

  // سفارش پرداخت‌نشده هرگز شمرده نمی‌شود (سبد پس از ثبت سفارش دوباره پر می‌شود)
  await user.post('/api/cart/add', { productId: product.id, qty: 1 });
  q = await quote();
  ok('سفارش پرداخت‌نشده در سقف شمرده نمی‌شود', q.json.ceiling.pastSpent === 0, String(q.json.ceiling.pastSpent));

  // پرداخت موفق سفارش اول
  const sim = await user.post(`/api/payments/simulate/${o1.json.order.id}`, { success: true });
  ok('پرداخت شبیه‌سازی‌شده موفق شد', sim.status === 200 && sim.json.order?.payment?.status === 'paid', JSON.stringify(sim.json).slice(0, 140));

  // حالا pastSpent = مبلغ سفارش اول (تحویل حضوری → بدون هزینهٔ ارسال)
  q = await quote();
  ok('سفارش موفق در سقف شمرده شد', q.json.ceiling.pastSpent === o1.json.order.total, `${q.json.ceiling.pastSpent} vs ${o1.json.order.total}`);
  ok('سهمیهٔ باقی‌مانده درست محاسبه شد', q.json.ceiling.remaining === amount - o1.json.order.total, String(q.json.ceiling.remaining));

  // سبد بزرگ‌تر از سهمیه → ثبت سفارش رد می‌شود با پیام محترمانه
  await user.patch('/api/cart/item', { productId: product.id, qty: 2 });
  const blocked = await user.post('/api/checkout', checkoutBody());
  ok('سبد بالاتر از سهمیه → رد می‌شود', blocked.status === 400 && blocked.json.code === 'order_ceiling', JSON.stringify(blocked.json).slice(0, 160));
  ok('پیام رد شدن، پیام محترمانهٔ سقف است', typeof blocked.json.message === 'string' && blocked.json.message.includes('سقف مجاز خرید'), String(blocked.json.message || '').slice(0, 80));

  // کاهش سبد به هم‌سطح/زیر سهمیه → مسدودی فوراً رفع می‌شود
  await user.patch('/api/cart/item', { productId: product.id, qty: 1 });
  q = await quote();
  ok('با کاهش سبد، سهمیه به‌روز شد', q.json.ceiling.remaining === amount - o1.json.order.total, String(q.json.ceiling.remaining));
  const o2 = await user.post('/api/checkout', checkoutBody());
  ok('با رسیدن سبد به زیر سهمیه، خرید بلافاصله ممکن شد', o2.status === 200, JSON.stringify(o2.json).slice(0, 160));

  // سفارش دومِ پرداخت‌نشده باز هم شمرده نمی‌شود
  await user.post('/api/cart/add', { productId: product.id, qty: 1 });
  q = await quote();
  ok('سفارش دومِ در انتظار هم شمرده نمی‌شود', q.json.ceiling.pastSpent === o1.json.order.total, String(q.json.ceiling.pastSpent));

  // ── کلید اصلی: خاموش کردن سقف → هیچ محدودیتی نیست ──────────
  await admin.patch('/api/admin/settings/orders', { value: { orderCeilingEnabled: false } });
  await user.post('/api/cart/add', { productId: product.id, qty: 2 });
  await user.patch('/api/cart/item', { productId: product.id, qty: 2 });
  q = await quote();
  ok('با خاموشی کلید اصلی، سقف غیرفعال می‌شود', q.json.ceiling?.enabled === false);
  const o3 = await user.post('/api/checkout', checkoutBody());
  ok('با خاموشی سقف، سفارش بزرگ هم ثبت می‌شود', o3.status === 200, JSON.stringify(o3.json).slice(0, 160));

  // ── بازهٔ ساعت قابل تنظیم است ──────────────────────────────
  await admin.patch('/api/admin/settings/orders', { value: { orderCeilingEnabled: true, orderCeilingHours: 24 } });
  await user.post('/api/cart/add', { productId: product.id, qty: 1 });
  q = await quote();
  ok('بازهٔ ساعت سفارشی اعمال می‌شود (۲۴ ساعت)', q.json.ceiling.hours === 24, String(q.json.ceiling.hours));

  // اعتبارسنجی ورودی پنل: مقادیر نامعتبر رد می‌شوند
  const badAmount = await admin.patch('/api/admin/settings/orders', { value: { orderCeilingAmount: -5 } });
  ok('مبلغ سقف منفی → ۴۰۰', badAmount.status === 400, String(badAmount.status));
  const badHours = await admin.patch('/api/admin/settings/orders', { value: { orderCeilingHours: 0 } });
  ok('بازهٔ صفر ساعتی → ۴۰۰', badHours.status === 400, String(badHours.status));
} catch (e) {
  fail++;
  console.error('  ✘ خطای غیرمنتظره در سناریو:', e?.message || e);
} finally {
  // ── بازگرداندن تنظیمات به حالت قبل ─────────────────────────
  try {
    const admin2 = await adminClient();
    if (admin2) {
      const restore = { ...ORDER_ORIGINAL };
      delete restore.kyc; // بخش KYC از مسیر خودش محافظت می‌شود
      await admin2.patch('/api/admin/settings/orders', { value: restore });
      if (CAPTCHA_ORIGINAL !== undefined) await admin2.patch('/api/admin/settings/features', { captcha: CAPTCHA_ORIGINAL });
    }
  } catch { /* noop */ }
}

// ── بخش ۳: جست‌وجوی سریع پارت‌نامبر (SKU) ─────────────────────
section('جست‌وجوی سریع پارت‌نامبر / SKU / بارکد');
try {
  const boot = (await makeClient(BASE).get('/api/bootstrap')).json;
  ok('کلید skuFastSearchEnabled در bootstrap هست', typeof boot.settings?.salesTools?.skuFastSearchEnabled === 'boolean');
  ok('کلید wholesaleInquiryEnabled در bootstrap هست', typeof boot.settings?.salesTools?.wholesaleInquiryEnabled === 'boolean');
  ok('کلید productWarrantyBadgeEnabled در bootstrap هست', typeof boot.settings?.salesTools?.productWarrantyBadgeEnabled === 'boolean');
  ok('مدت گارانتی نشان در bootstrap هست', typeof boot.settings?.salesTools?.productWarrantyMonths === 'number');

  // پیدا کردن کالایی با SKU؛ تطابق دقیق SKU باید اولین نتیجه باشد
  const list = await makeClient(BASE).get('/api/products?limit=96');
  const withSku = (list.json.items || []).find((p) => p.sku && String(p.sku).trim().length >= 3);
  if (withSku) {
    const r = await makeClient(BASE).get(`/api/products?q=${encodeURIComponent(withSku.sku)}`);
    const first = (r.json.items || [])[0];
    ok(`تطابق دقیق SKU («${withSku.sku}») اولین نتیجه است`, !!first && first.id === withSku.id, first ? first.id : 'هیچ');
  } else {
    ok('کالایی با SKU برای آزمون نبود (رد نمی‌شود)', true);
  }
} catch (e) {
  fail++;
  console.error('  ✘ خطای غیرمنتظره در جست‌وجوی SKU:', e?.message || e);
}

console.log(fail ? `\n═══ ${fail} خطا ═══` : '\n═══ همه سبز ═══');
process.exit(fail ? 1 : 0);
