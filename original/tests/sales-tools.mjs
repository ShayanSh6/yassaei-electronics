// ─────────────────────────────────────────────────────────────
//  sales-tools: ابزارهای فروش (settings.salesTools)
//   • ذخیره/پاک‌سازی از پنل مدیریت (PATCH /api/admin/settings/salesTools)
//   • انعکاس فوری در /api/bootstrap (خاموش = حذف از سایت مشتری)
//   • روش پرداخت «کارت به کارت» فقط وقتی روشن + اطلاعات بانکی ثبت شده باشد
//   • ثبت سفارش کارت‌به‌کارت → در انتظار بررسی / پرداخت در انتظار
//   • کمکی‌های کلاینت (lib/sales.mjs) و HTML پیش‌فاکتور/کادر بانکی بدون نشتی
//  اجرا: BASE=http://127.0.0.1:3000 node tests/sales-tools.mjs
// ─────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { makeClient, login, ensureDemoAccounts, DEMO_PASSWORD } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}

console.log(`\n═══ sales-tools: ابزارهای فروش · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam']);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
if (!(await login(admin, 'admin', 'Yassaei@1404'))) await login(admin, 'admin', 'Demo@1404');
await admin.patch('/api/admin/settings/features', { captcha: false });

const user = makeClient(BASE);
await user.get('/api/bootstrap');
await login(user, 'maryam', DEMO_PASSWORD);

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');

/** سبد کاربر را با یک کالای موجود و قیمت‌دار آماده می‌کند */
async function prepareCart(cl) {
  const prods = (await anon.get('/api/products?limit=6')).json.items || [];
  const prod = prods.find((p) => (p.stock || 0) > 0 && p.price > 0) || prods[0];
  await cl.post('/api/cart/clear');
  await cl.post('/api/cart/add', { productId: prod.id, qty: 1 });
  return prod;
}

const BANK = { bankName: 'ملت', cardNumber: '6104 3378 1234 5678', iban: 'ir12 0120 0000 0000 1234 5678 90', owner: 'فروشگاه الکتریکی یاسایی' };
const ORIGINAL = (await admin.get('/api/admin/settings')).json?.settings?.salesTools || null;

// همهٔ مراحل داخل try/finally تا حتی با خطای میانی، تنظیمات فروشگاه به حالت قبل برگردد
let cardOrder = null;
try {
// ── ۱) پیش‌فرض‌ها در bootstrap ────────────────────────────────
{
  const b = (await anon.get('/api/bootstrap')).json;
  const st = b?.settings?.salesTools;
  ok('bootstrap شامل بخش salesTools است', !!st && typeof st === 'object');
  ok('کلیدهای اصلی روشن/خاموش وجود دارند', st && ['stickyBuyBarEnabled', 'whatsappConsultEnabled', 'proformaInvoiceEnabled', 'freeShippingBarEnabled', 'bankDetailsEnabled'].every((k) => typeof st[k] === 'boolean'));
}

// ── ۲) اعتبارسنجی ورودی‌های پنل ───────────────────────────────
{
  const badIban = await admin.patch('/api/admin/settings/salesTools', { value: { bankDetails: { iban: 'IR12' } } });
  ok('شبای نامعتبر → ۴۰۰', badIban.status === 400, String(badIban.status));
  const badCard = await admin.patch('/api/admin/settings/salesTools', { value: { bankDetails: { cardNumber: '1234' } } });
  ok('شمارهٔ کارت ناقص → ۴۰۰', badCard.status === 400, String(badCard.status));
  const badWa = await admin.patch('/api/admin/settings/salesTools', { value: { whatsappPhone: 'abc' } });
  ok('شمارهٔ واتساپ نامعتبر → ۴۰۰', badWa.status === 400, String(badWa.status));
  const badThr = await admin.patch('/api/admin/settings/salesTools', { value: { freeShippingThreshold: -5 } });
  ok('آستانهٔ منفی → ۴۰۰', badThr.status === 400, String(badThr.status));
  const noPerm = await user.patch('/api/admin/settings/salesTools', { value: { bankDetailsEnabled: false } });
  ok('کاربر عادی اجازهٔ تغییر ندارد', noPerm.status === 401 || noPerm.status === 403, String(noPerm.status));
}

// ── ۳) ذخیرهٔ معتبر و انعکاس در bootstrap ─────────────────────
{
  const r = await admin.patch('/api/admin/settings/salesTools', { value: {
    stickyBuyBarEnabled: true, whatsappConsultEnabled: true, whatsappPhone: '0912 123 4567',
    proformaInvoiceEnabled: true, freeShippingBarEnabled: true, freeShippingThreshold: 3500000,
    bankDetailsEnabled: true, bankDetails: BANK,
  } });
  ok('ذخیرهٔ تنظیمات معتبر → ۲۰۰', r.status === 200, JSON.stringify(r.json).slice(0, 160));
  const v = r.json?.value || {};
  ok('شمارهٔ کارت بدون فاصله ذخیره شد (۱۶ رقم)', v.bankDetails?.cardNumber === '6104337812345678', v.bankDetails?.cardNumber);
  ok('شبا نرمال شد (IR بزرگ + ۲۴ رقم)', v.bankDetails?.iban === 'IR120120000000001234567890', v.bankDetails?.iban);
  ok('شمارهٔ واتساپ فقط رقم', v.whatsappPhone === '09121234567', v.whatsappPhone);
  ok('آستانهٔ ارسال رایگان ذخیره شد', v.freeShippingThreshold === 3500000, String(v.freeShippingThreshold));

  const b = (await anon.get('/api/bootstrap')).json?.settings?.salesTools;
  ok('bootstrap مهمان اطلاعات بانکی را دارد', b?.bankDetails?.cardNumber === '6104337812345678' && b?.bankDetails?.owner === BANK.owner);
  ok('bootstrap آستانهٔ اختصاصی را دارد', b?.freeShippingThreshold === 3500000);

  await prepareCart(user);
  const q = await user.post('/api/checkout/quote', { delivery: 'pickup' });
  const list = q.json?.paymentMethods || [];
  const ids = list.map((m) => m.id);
  ok('روش پرداخت «کارت به کارت» در فهرست روش‌ها هست', q.status === 200 && ids.includes('card'), `${q.status} ${ids.join(',')}`);
  ok('برچسب فارسی/انگلیسی روش کارت‌به‌کارت', list.find((m) => m.id === 'card')?.fa?.includes('کارت') && !!list.find((m) => m.id === 'card')?.en);
}

// ── ۴) ثبت سفارش کارت‌به‌کارت ─────────────────────────────────
{
  await prepareCart(user);
  const r = await user.post('/api/checkout', { delivery: 'pickup', paymentMethod: 'card', acceptTerms: true });
  ok('ثبت سفارش کارت‌به‌کارت → ۲۰۰', r.status === 200, JSON.stringify(r.json).slice(0, 200));
  cardOrder = r.json?.order || null;
  ok('وضعیت سفارش: در انتظار بررسی', cardOrder?.status === 'pending_review', cardOrder?.status);
  ok('وضعیت پرداخت: در انتظار (نه پرداخت‌شده)', cardOrder?.payment?.status === 'pending' && cardOrder?.payment?.method === 'card', JSON.stringify(cardOrder?.payment));
  ok('needsPayment برای کارت‌به‌کارت true است', r.json?.needsPayment === true);
  const mine = await user.get(`/api/me/orders/${cardOrder?.id}`);
  ok('سفارش در فهرست کاربر با روش card', mine.status === 200 && mine.json?.order?.payment?.method === 'card');
}

// ── ۵) خاموش‌کردن از پنل → حذف فوری از سایت ────────────────────
{
  const r = await admin.patch('/api/admin/settings/salesTools', { value: { bankDetailsEnabled: false, stickyBuyBarEnabled: false, whatsappConsultEnabled: false, proformaInvoiceEnabled: false, freeShippingBarEnabled: false } });
  ok('خاموش‌کردن همهٔ قابلیت‌ها → ۲۰۰', r.status === 200);
  const b = (await anon.get('/api/bootstrap')).json?.settings?.salesTools;
  ok('bootstrap: کلیدها خاموش شدند', b && b.bankDetailsEnabled === false && b.stickyBuyBarEnabled === false && b.whatsappConsultEnabled === false && b.proformaInvoiceEnabled === false && b.freeShippingBarEnabled === false, JSON.stringify(b));
  ok('bootstrap: با خاموش‌بودن، اطلاعات بانکی به مشتری ارسال نمی‌شود', b && !b.bankDetails?.cardNumber && !b.bankDetails?.iban);
  const adm = (await admin.get('/api/admin/settings')).json?.settings?.salesTools;
  ok('پنل مدیریت هنوز اطلاعات بانکی را نگه داشته (فقط مخفی شده)', adm?.bankDetails?.cardNumber === '6104337812345678');

  await prepareCart(user);
  const q = await user.post('/api/checkout/quote', { delivery: 'pickup' });
  const ids = (q.json?.paymentMethods || []).map((m) => m.id);
  ok('روش «کارت به کارت» از فهرست حذف شد', q.status === 200 && ids.length > 0 && !ids.includes('card'), `${q.status} ${ids.join(',')}`);

  const r2 = await user.post('/api/checkout', { delivery: 'pickup', paymentMethod: 'card', acceptTerms: true });
  ok('ثبت سفارش کارت‌به‌کارت با قابلیت خاموش → ۴۰۰ card_disabled', r2.status === 400 && r2.json?.code === 'card_disabled', `${r2.status} ${r2.json?.code}`);
  await user.post('/api/cart/clear');
}

// ── ۶) کمکی‌های کلاینت و HTML (بدون مرورگر) ────────────────────
{
  const noop = () => {};
  class FakeEl { constructor(t) { this.tagName = String(t).toUpperCase(); this.children = []; this.dataset = {}; this.style = {}; this.classList = { add: noop, remove: noop, contains: () => false, toggle: noop }; }
    appendChild(c) { this.children.push(c); return c; } setAttribute() {} getAttribute() { return null; } addEventListener() {} removeEventListener() {} querySelector() { return null; } querySelectorAll() { return []; } remove() {} }
  globalThis.window = globalThis;
  globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => ({ text: t }), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: new FakeEl('html'), body: new FakeEl('body'), head: new FakeEl('head'), cookie: '', addEventListener: noop, removeEventListener: noop, title: '' };
  globalThis.location = { hash: '#/', href: BASE + '/', origin: BASE, pathname: '/', search: '', hostname: '127.0.0.1' };
  globalThis.history = { pushState: noop, replaceState: noop, back: noop };
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  globalThis.addEventListener = noop; globalThis.removeEventListener = noop;
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0); globalThis.cancelAnimationFrame = noop;
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.Image = class { set src(v) { setTimeout(() => this.onerror?.(), 0); } };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.innerWidth = 1360; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
  globalThis.print = noop; globalThis.scrollTo = noop; globalThis.alert = noop;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', language: 'fa-IR', onLine: true, clipboard: { writeText: async () => {} } }, configurable: true });

  const state = await import(fileURLToPath(new URL('../public/js/state.mjs', import.meta.url)));
  const sales = await import(fileURLToPath(new URL('../public/js/lib/sales.mjs', import.meta.url)));
  const bank = await import(fileURLToPath(new URL('../public/js/lib/bank-box.mjs', import.meta.url)));
  const cartView = await import(fileURLToPath(new URL('../public/js/views/cart.mjs', import.meta.url)));
  const comps = await import(fileURLToPath(new URL('../public/js/components.mjs', import.meta.url)));

  state.S.settings = {
    store: { name: 'الکتریکی یاسایی', phone: '02177906667', whatsapp: '09121234567', address: 'تهران، نارمک' },
    shipping: { freeOver: 2000000, zones: [] },
    salesTools: { stickyBuyBarEnabled: true, whatsappConsultEnabled: true, whatsappPhone: '', proformaInvoiceEnabled: true, freeShippingBarEnabled: true, freeShippingThreshold: 0, bankDetailsEnabled: true, bankDetails: { bankName: 'ملت', cardNumber: '6104337812345678', iban: 'IR120120000000001234567890', owner: 'یاسایی' } },
  };
  state.S.me = null;

  ok('whatsappNumber: 09… → 989…', sales.whatsappNumber() === '989121234567', sales.whatsappNumber());
  state.S.settings.salesTools.whatsappPhone = '00989351112233';
  ok('whatsappNumber: شمارهٔ اختصاصی اولویت دارد و 0098 نرمال می‌شود', sales.whatsappNumber() === '989351112233', sales.whatsappNumber());
  const link = sales.whatsappLink('سلام «تست»');
  ok('whatsappLink: wa.me + متن encode شده', link.startsWith('https://wa.me/989351112233?text=') && link.includes(encodeURIComponent('«تست»')), link);
  ok('freeShipThreshold: ۰ → مقدار بخش ارسال', sales.freeShipThreshold() === 2000000);
  state.S.settings.salesTools.freeShippingThreshold = 5000000;
  ok('freeShipThreshold: مقدار اختصاصی اولویت دارد', sales.freeShipThreshold() === 5000000);
  ok('fmtIban: گروه‌بندی ۴تایی', sales.fmtIban('IR120120000000001234567890') === 'IR12 0120 0000 0000 1234 5678 90', sales.fmtIban('IR120120000000001234567890'));
  const j = sales.toJalali(new Date('2026-09-19T12:00:00Z'));
  ok('toJalali: ۲۰۲۶/۰۹/۱۹ → ۱۴۰۵/۰۶/۲۸', j.jy === 1405 && j.jm === 6 && j.jd === 28, JSON.stringify(j));
  ok('proformaNumber: قالب PF-14050628-…', /^PF-14050628-[A-Z0-9]{3,6}$/.test(sales.proformaNumber(new Date('2026-09-19T12:00:00Z'))), sales.proformaNumber(new Date('2026-09-19T12:00:00Z')));

  const bd = sales.bankDetails();
  ok('bankDetails: وقتی روشن است برمی‌گردد', !!bd && bd.cardNumber === '6104337812345678');
  const boxHtml = String(bank.bankBox(bd, { amount: 1250000, orderCode: 'YS-TEST' }));
  ok('bankBox: شامل کارت، شبا و صاحب حساب با دکمهٔ کپی', boxHtml.includes('data-copy="6104337812345678"') && boxHtml.includes('data-copy="IR120120000000001234567890"') && boxHtml.includes('یاسایی') && !boxHtml.includes('undefined') && !boxHtml.includes('[object Object]'));

  const bar1 = String(comps.freeShipBar(1000000));
  ok('freeShipBar: باقی‌مانده تا ارسال رایگان', bar1.includes('ارسال رایگان') && bar1.includes('data-w="20%"'), bar1.slice(0, 200));
  const bar2 = String(comps.freeShipBar(6000000));
  ok('freeShipBar: پیام تبریک وقتی آستانه رد شد', bar2.includes('تبریک') && bar2.includes('data-w="100%"'));

  const cart = { items: [{ qty: 2, lineTotal: 500000, product: { id: 'p1', name: 'کلید مینیاتوری ۲۵ آمپر', price: 250000, sku: 'MCB-25' } }, { qty: 1, lineTotal: 90000, product: { id: 'p2', name: 'رلهٔ ۲۴ ولت', price: 90000 } }], subtotal: 590000, couponDiscount: 40000, coupon: { code: 'OFF40' }, count: 3 };
  const pf = String(cartView.proformaHtml(cart));
  ok('proformaHtml: عنوان، شماره، تاریخ شمسی و جدول اقلام', pf.includes('پیش‌فاکتور') && /PF-\d{8}-/.test(pf) && pf.includes('کلید مینیاتوری ۲۵ آمپر') && pf.includes('MCB-25') && pf.includes('inv-table'));
  ok('proformaHtml: جمع و تخفیف و مبلغ قابل پرداخت', pf.includes('OFF40') && pf.includes('۵۵۰٬۰۰۰'), pf.match(/۵۵۰[^<]{0,6}/)?.[0]);
  ok('proformaHtml: نشان رسمی + محل مهر + اطلاعات واریز', pf.includes('yassaei-poster-badge.svg') && pf.includes('stamp-fake') && pf.includes('IR12 0120'));
  ok('proformaHtml: بدون نشتی undefined/NaN/[object Object]', !/undefined|NaN|\[object Object\]/.test(pf.replace(/data-[a-z-]+="[^"]*"/g, '')));

  // خاموش‌کردن از سمت کلاینت → همهٔ خروجی‌ها خالی
  state.S.settings.salesTools.bankDetailsEnabled = false;
  state.S.settings.salesTools.freeShippingBarEnabled = false;
  ok('bankDetails: با خاموش‌بودن null', sales.bankDetails() === null);
  ok('freeShipBar: با خاموش‌بودن خالی', String(comps.freeShipBar(1000000)) === '');
  const pfOff = String(cartView.proformaHtml(cart));
  ok('proformaHtml: با خاموش‌بودن اطلاعات بانکی، کادر واریز حذف می‌شود', !pfOff.includes('IR12 0120'));
}

} catch (err) {
  fail++;
  console.error('  ✘ EXCEPTION:', err?.stack || err);
} finally {
  // ── بازگرداندن تنظیمات به حالت قبل ───────────────────────────
  const restore = ORIGINAL ? {
    stickyBuyBarEnabled: ORIGINAL.stickyBuyBarEnabled !== false, whatsappConsultEnabled: ORIGINAL.whatsappConsultEnabled !== false,
    whatsappPhone: ORIGINAL.whatsappPhone || '', proformaInvoiceEnabled: ORIGINAL.proformaInvoiceEnabled !== false,
    freeShippingBarEnabled: ORIGINAL.freeShippingBarEnabled !== false, freeShippingThreshold: Number(ORIGINAL.freeShippingThreshold) || 0,
    bankDetailsEnabled: ORIGINAL.bankDetailsEnabled !== false,
    bankDetails: { bankName: ORIGINAL.bankDetails?.bankName || '', cardNumber: ORIGINAL.bankDetails?.cardNumber || '', iban: ORIGINAL.bankDetails?.iban || '', owner: ORIGINAL.bankDetails?.owner || '' },
  } : { stickyBuyBarEnabled: true, whatsappConsultEnabled: true, whatsappPhone: '', proformaInvoiceEnabled: true, freeShippingBarEnabled: true, freeShippingThreshold: 0, bankDetailsEnabled: true, bankDetails: { bankName: '', cardNumber: '', iban: '', owner: '' } };
  const r = await admin.patch('/api/admin/settings/salesTools', { value: restore });
  ok('بازگرداندن تنظیمات ابزارهای فروش', r.status === 200);
  if (cardOrder?.id) await admin.patch(`/api/admin/orders/${cardOrder.id}`, { status: 'cancelled', note: 'تست خودکار' }).catch(() => {});
}

console.log(`\n  نتیجه: ${pass} موفق · ${fail} ناموفق\n`);
process.exit(fail ? 1 : 0);
