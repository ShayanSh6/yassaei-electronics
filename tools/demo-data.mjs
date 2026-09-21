// ─────────────────────────────────────────────────────────────
//  ساخت دادهٔ نمونهٔ زنده برای بررسی دستی مدیر
//  همه‌چیز از راه APIهای واقعی سایت انجام می‌شود (مثل کاربر واقعی)
//  اجرا: node tools/demo-data.mjs
// ─────────────────────────────────────────────────────────────
const BASE = process.env.BASE || 'http://127.0.0.1:3001';

function makeClient() {
  const jar = new Map();
  const store = (res) => { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); } };
  const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json', Cookie: ck() };
    if (!['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = jar.get('ys_csrf') || '';
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    store(res);
    const txt = await res.text();
    let json = null; try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 200) }; }
    return { status: res.status, json };
  }
  return {
    call,
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b ?? {}),
    patch: (p, b) => call('PATCH', p, b ?? {}),
    del: (p) => call('DELETE', p),
  };
}

const log = [];
const step = (name, r, expect = 200) => {
  const ok = r.status === expect || (Array.isArray(expect) && expect.includes(r.status));
  log.push(`${ok ? '✔' : '✘'} ${name}${ok ? '' : ` → ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`}`);
  if (!ok) process.exitCode = 1;
  return r.json;
};
const pick = (arr, n) => arr.slice(0, n);

const solveSvgCap = (svg) => { const fa = '۰۱۲۳۴۵۶۷۸۹'; const txt = [...String(svg).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join('').replace(/&#160;/g, ' '); const en = txt.replace(/[۰-۹]/g, (c) => String(fa.indexOf(c))); const m = en.match(/(\d+)\s*([+×])\s*(\d+)/); if (!m) return null; return m[2] === '×' ? Number(m[1]) * Number(m[3]) : Number(m[1]) + Number(m[3]); };
const capFor = async (cl) => { const c = await cl.get('/api/captcha'); if (!c.json || c.json.disabled) return undefined; const v = await cl.post('/api/captcha/verify', { id: c.json.id, answer: solveSvgCap(c.json.svg) }); return v.json?.token; };
async function login(c, identifier, password) {
  await c.get('/api/bootstrap');
  const r = await c.post('/api/auth/login', { identifier, password, captchaToken: await capFor(c) });
  if (r.status !== 200 || !r.json.me) throw new Error(`login failed for ${identifier}: ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  return r.json.me;
}

async function addAddress(c, cfg) {
  return step(`آدرس (${cfg.city})`, await c.post('/api/me/addresses', {
    title: cfg.title, receiver: cfg.receiver, phone: cfg.phone,
    province: cfg.province, city: cfg.city, zone: cfg.zone || 'province',
    street: cfg.street, postal: cfg.postal || '', isDefault: true, note: cfg.note || '',
  }));
}

async function fillCart(c, items) {
  for (const it of items) step(`افزودن به سبد: ${it.name.slice(0, 30)}`, await c.post('/api/cart/add', { productId: it.id, qty: it.qty || 1 }));
}

// ── شروع ────────────────────────────────────────────────────
const products = (await (await fetch(BASE + '/api/products?limit=100&sort=newest')).json()).items || [];
const inStock = products.filter((p) => p.stock > 2);
console.log(`کالاهای موجود: ${inStock.length} از ${products.length}`);

const admin = makeClient();
await login(admin, 'admin', 'Yassaei@1404');
log.push('✔ ورود مدیر');

const maryam = makeClient(); await login(maryam, 'maryam', 'Demo@1404'); log.push('✔ ورود مریم');
const reza = makeClient(); await login(reza, 'reza', 'Demo@1404'); log.push('✔ ورود رضا');
const sina = makeClient(); await login(sina, 'sina', 'Demo@1404'); log.push('✔ ورود سینا');
const guest = makeClient(); await guest.get('/api/bootstrap'); log.push('✔ نشست مهمان');

// ── ۱) مریم: کیف پول + پلاس + آدرس + سفارش پستی بیمه‌دار ────
step('شارژ کیف پول مریم', await maryam.post('/api/me/wallet/deposit', { amount: 900000 }));
step('اشتراک پلاس مریم', await maryam.post('/api/me/plus/subscribe', { method: 'wallet' }), [200, 400]);
await addAddress(maryam, {
  title: 'منزل', receiver: 'مریم احمدی', phone: '09123456789',
  province: 'تهران', city: 'تهران گناوه', zone: 'province',
  street: 'خیابان ساحلی، پاساژ مروارید خلیج، طبقهٔ دوم، پلاک ۲۴', postal: '7513749113',
  note: 'زنگ در طبقهٔ دوم',
});
const mItems = pick(inStock, 3).map((p) => ({ id: p.id, name: p.name, qty: 1 }));
await fillCart(maryam, mItems);
step('کد تخفیف مریم', await maryam.post('/api/cart/coupon', { code: 'WELCOME10' }), [200, 400]);
const mOrder = step('ثبت سفارش پستی مریم (بیمه + درگاه)', await maryam.post('/api/checkout', {
  delivery: 'courier', zone: 'province', express: false, insurance: true,
  paymentMethod: 'gateway', useWallet: true, acceptTerms: true,
  note: 'لطفاً قبل از ارسال تماس بگیرید.',
}));
if (mOrder?.order?.id) {
  step('پرداخت سفارش مریم', await maryam.post(`/api/payments/simulate/${mOrder.order.id}`, { success: true }));
}
step('علاقه‌مندی مریم', await maryam.post(`/api/me/wishlist/${inStock[4]?.id}`));
step('مقایسه مریم', await maryam.post(`/api/me/compare/${inStock[5]?.id}`));
step('خبرم کن مریم', await maryam.post(`/api/me/alerts/${inStock[6]?.id}`));
const maryReviewTarget = inStock.find((p) => !mItems.some((m) => m.id === p.id) && p.ratingCount === 0) || inStock[20];
step('نظر مریم (۵ ستاره)', await maryam.post('/api/reviews', {
  productId: maryReviewTarget?.id, type: 'review', rating: 5,
  title: 'کیفیت عالی، ارسال سریع',
  body: 'کالا اصل و پلمپ بود. بسته‌بندی خیلی خوب بود و دو روزه به تهران گناوه رسید. حتماً دوباره خرید می‌کنم.',
}));
step('پرسش مریم', await maryam.post('/api/reviews', {
  productId: mItems[1]?.id, type: 'question',
  title: 'سازگاری با آیفون ۱۳',
  body: 'سلام، این کابل با آیفون ۱۳ معمولی هم کار می‌کند؟ فست شارژ ۲۰ وات پشتیبانی می‌شود؟',
}));
step('تیکت مریم', await maryam.post('/api/tickets', {
  subject: 'درخواست تغییر آدرس ارسال', category: 'order', priority: 'high', rulesAccepted: true,
  body: 'سلام، سفارشم را ثبت کرده‌ام ولی ممکن است در خانه نباشم. می‌شود آدرس را به مغازه‌ام در پاساژ تغییر دهید؟ کد سفارش را هم در پیامک دیده‌ام.',
}));
step('پیام چت مریم ۱', await maryam.post('/api/support/messages', { body: 'سلام، وقت بخیر. موجودی اسپیکر بلوتوثی ضدآب کی شارژ می‌شود؟' }));
step('پیام چت مریم ۲', await maryam.post('/api/support/messages', { body: 'اگر تا پنج‌شنبه برسد، حتماً خرید می‌کنم. ممنون.' }));
step('پیشنهاد مریم', await maryam.post('/api/feedback', {
  type: 'suggestion', title: 'افزودن امکان پرداخت با کارت به کارت',
  body: 'خیلی از مشتری‌های تهران کارت به کارت را ترجیح می‌دهند. اگر شمارهٔ کارت و نام دارنده را در صفحهٔ پرداخت بگذارید عالی می‌شود.',
  contact: '09123456789', page: '#/checkout',
}));

// ── ۲) رضا: تحویل حضوری + پرداخت در محل + تیکت مرجوعی ──────
await addAddress(reza, {
  title: 'مغازه', receiver: 'رضا دریانورد', phone: '09171234567',
  province: 'تهران', city: 'تهران', zone: 'city',
  street: 'بلوار ساحلی، بازار لنج‌سازان، روبروی اسکله، پلاک ۱۲', postal: '7716813445',
});
const rItems = pick(inStock.slice(3, 6), 2).map((p) => ({ id: p.id, name: p.name, qty: 2 }));
await fillCart(reza, rItems);
const rOrder = step('ثبت سفارش رضا (پستی + پرداخت در محل)', await reza.post('/api/checkout', {
  delivery: 'courier', zone: 'city', express: false, insurance: false,
  paymentMethod: 'cod', acceptTerms: true, note: 'قبل از ارسال تماس بگیرید.',
}));
step('نظر رضا (۴ ستاره)', await reza.post('/api/reviews', {
  productId: rItems[0]?.id, type: 'review', rating: 4,
  title: 'راضی‌ام، ولی بسته‌بندی بهتر شود',
  body: 'خود کالا سالم و اصل است. فقط کاش داخل جعبه یک دستمال هم بود. قیمتش هم از بازار گناوه مناسب‌تر بود.',
}));
step('تیکت مرجوعی رضا', await reza.post('/api/tickets', {
  subject: 'درخواست مرجوعی گلس شکسته', category: 'return', priority: 'normal', rulesAccepted: true,
  body: 'سلام. گلسی که در سفارش قبلی خریدم هنگام نصب ترک خورد. طبق مادهٔ ۳۷ قانون تجارت الکترونیکی می‌خواهم مرجوع کنم. عکس را پیوست می‌گذارم.',
}));
step('شکایت رضا', await reza.post('/api/feedback', {
  type: 'complaint', title: 'تأخیر در پاسخ پشتیبانی چت',
  body: 'دیشب ساعت ۹ پیام دادم و تا ۱۱ جواب نگرفتم. اگر ساعت کاری پشتیبانی را در سایت مشخص کنید بهتر است.',
  contact: '09171234567', page: '#/account/support',
}));
step('شارژ کیف پول رضا', await reza.post('/api/me/wallet/deposit', { amount: 300000 }));

// ── ۳) سینا: سفارش پرداخت‌نشده + سفارش لغوشده + گزارش خطا ──
await addAddress(sina, {
  title: 'خانه', receiver: 'سینا مرادی', phone: '09361112233',
  province: 'تهران', city: 'خورموج', zone: 'province',
  street: 'خیابان امام، کوچهٔ ۵، پلاک ۹، واحد ۲', postal: '',
});
const sItems = pick(inStock.slice(6, 9), 2).map((p) => ({ id: p.id, name: p.name, qty: 1 }));
await fillCart(sina, sItems);
const sOrder = step('ثبت سفارش سینا (پرداخت نشده)', await sina.post('/api/checkout', {
  delivery: 'courier', zone: 'province', express: true, insurance: false,
  paymentMethod: 'gateway', acceptTerms: true, note: 'ارسال فوری لطفاً.',
}));
// سفارش دوم: پرداخت و سپس لغو (برگشت وجه به کیف پول)
await fillCart(sina, pick(inStock.slice(10, 12), 1).map((p) => ({ id: p.id, name: p.name, qty: 1 })));
const sOrder2 = step('ثبت سفارش دوم سینا', await sina.post('/api/checkout', {
  delivery: 'courier', zone: 'province', express: false, insurance: true,
  paymentMethod: 'gateway', acceptTerms: true,
}));
if (sOrder2?.order?.id) {
  step('پرداخت سفارش دوم سینا', await sina.post(`/api/payments/simulate/${sOrder2.order.id}`, { success: true }));
  step('لغو سفارش دوم سینا (برگشت وجه)', await sina.post(`/api/me/orders/${sOrder2.order.id}/cancel`, { reason: 'اشتباهی سفارش دادم' }));
}
step('گزارش خطای سینا', await sina.post('/api/feedback', {
  type: 'bug', title: 'عکس محصول در حالت روشن باز نمی‌شود',
  body: 'در حالت روشن (Light) وقتی روی عکس بزرگ‌نمای محصول می‌زنم، صفحه سفید می‌شود. در حالت تاریک مشکلی نیست. گوشی من شیائومی ردمی نوت ۱۲ است.',
  contact: 'sina@example.com', page: '#/product', screen: '393x873',
}));
step('پیام چت سینا', await sina.post('/api/support/messages', { body: 'سلام، ساعت کاری مغازه در روزهای پنج‌شنبه چطور است؟' }));

// ── ۴) مهمان: سفارش بدون حساب کاربری ───────────────────────
const gItems = pick(inStock.slice(12, 14), 1).map((p) => ({ id: p.id, name: p.name, qty: 1 }));
await fillCart(guest, gItems);
const gOrder = step('ثبت سفارش مهمان (حضوری + پرداخت آنلاین)', await guest.post('/api/checkout', {
  delivery: 'pickup', zone: 'city', paymentMethod: 'gateway', acceptTerms: true,
  guestName: 'مهمان تهران گناوه', guestPhone: '09011234567',
}));
if (gOrder?.order?.id) {
  step('پرداخت آنلاین مهمان', await guest.post(`/api/payments/simulate/${gOrder.order.id}`, { success: true }));
}

// ── ۵) کارهای مدیر ─────────────────────────────────────────
const pendReviews = (await admin.get('/api/admin/reviews?status=pending')).json.items || [];
for (const r of pendReviews.slice(0, 2)) {
  step(`تأیید نظر ${r.id}`, await admin.patch(`/api/admin/reviews/${r.id}`, { status: 'approved', reply: 'ممنون از وقتی که گذاشتی. نظرت برای ما خیلی ارزشمند است.' }));
}
const pendingQuestions = ((await admin.get('/api/admin/reviews?type=question')).json.items || []).filter((x) => x.status === 'pending');
for (const q of pendingQuestions.slice(0, 1)) {
  step(`پاسخ به پرسش ${q.id}`, await admin.patch(`/api/admin/reviews/${q.id}`, { status: 'approved', reply: 'سلام، بله کاملاً سازگار است و از فست‌شارژ ۲۰ وات پشتیبانی می‌کند.' }));
}
const tks = (await admin.get('/api/admin/tickets')).json.items || [];
for (const tk of tks.slice(0, 2)) {
  step(`پاسخ به تیکت ${tk.code}`, await admin.patch(`/api/admin/tickets/${tk.id}`, {
    body: 'سلام، پیام شما دیده شد. سفارش را بررسی می‌کنیم و نتیجه را همین‌جا اعلام می‌کنیم. اگر عکس یا فاکتور دارید پیوست کنید.',
    status: 'answered', priority: tk.priority || 'normal',
  }));
}
const sup = (await admin.get('/api/admin/support')).json.items || [];
for (const th of sup.slice(0, 3)) {
  step(`پاسخ چت ${th.userName}`, await admin.post(`/api/admin/support/${th.userId}`, { body: 'سلام، در خدمتیم. موجودی تا آخر هفته شارژ می‌شود؛ به محض رسیدن پیامک می‌زنم.' }));
}
const fbs = (await admin.get('/api/admin/feedback')).json.items || [];
for (const f of fbs.slice(0, 3)) {
  step(`پاسخ بازخورد ${f.id}`, await admin.patch(`/api/admin/feedback/${f.id}`, {
    status: f.type === 'bug' ? 'in_progress' : 'done',
    answer: f.type === 'bug' ? 'گزارش شما ثبت شد و در حال بررسی است؛ اصلاحش در به‌روزرسانی بعدی منتشر می‌شود.' : 'ممنون از پیشنهادت. این مورد را در برنامهٔ کاری گذاشتیم.',
  }));
}
const cp = step('ساخت کد تخفیف جدید', await admin.post('/api/admin/coupons', {
  code: 'GENAVEH15', type: 'percent', value: 15, maxDiscount: 400000, minOrder: 500000,
  usageLimit: 50, perUser: 1, active: true, note: 'تخفیف ویژهٔ مشتریان تهران گناوه',
}));
const ad = step('ساخت بنر تبلیغاتی', await admin.post('/api/admin/ads', {
  slot: 'home_strip', title: 'کابل و شارژر اصل با گارانتی تعویض', titleEn: 'Original cables & chargers with warranty',
  text: 'یک‌سال گارانتی تعویض روی همهٔ کابل‌ها و آداپتورهای فروشگاه — تست سلامت قبل از ارسال',
  textEn: 'One-year replacement warranty on all cables and adapters', link: '#/products?cat=cables',
  cta: 'دیدن کابل‌ها', ctaEn: 'See cables', active: true,
}));
step('ارسال اعلان سراسری', await admin.post('/api/admin/notifications', {
  title: 'ارسال رایگان بالای ۲٬۵۰۰٬۰۰۰ تومان', titleEn: 'Free shipping over 2,500,000',
  body: 'این هفته ارسال سفارش‌های بالای ۲٬۵۰۰٬۰۰۰ تومان به کل استان تهران رایگان است. کد تخفیف GENAVEH15 هم فعال شد.',
  bodyEn: 'Free shipping across Bushehr province this week. Coupon GENAVEH15 is live too.',
  level: 'success', type: 'offer', link: '#/products',
}));
if (rOrder?.order?.id) {
  step('تأیید و آماده‌سازی سفارش رضا', await admin.patch(`/api/admin/orders/${rOrder.order.id}`, { status: 'preparing', note: 'پرداخت در محل — قبل از ارسال تماس گرفته شود.' }));
}
if (mOrder?.order?.id) {
  step('ارسال سفارش مریم با کد رهگیری', await admin.patch(`/api/admin/orders/${mOrder.order.id}`, { status: 'shipped', tracking: 'GNV-884213705', note: 'تحویل پست گناوه شد.' }));
}
const users = (await admin.get('/api/admin/users')).json.items || [];
const sinaU = users.find((u) => u.username === 'sina');
if (sinaU) step('تنظیم کیف پول سینا', await admin.patch(`/api/admin/users/${sinaU.id}`, { walletAdjust: 75000, walletReason: 'جبران تأخیر ارسال' }));
step('پشتیبان‌گیری', await admin.post('/api/admin/backup', {}));

console.log('\n' + log.join('\n'));
const fails = log.filter((l) => l.startsWith('✘')).length;
console.log(`\n═══ دادهٔ نمونه: ${log.length - fails} موفق · ${fails} ناموفق ═══`);

// خلاصهٔ قابل بررسی
const sum = await admin.get('/api/admin/overview');
const o = sum.json || {};
console.log('\nخلاصهٔ پنل مدیر:');
console.log('  سفارش‌ها:', JSON.stringify(o.kpi?.orders || o.orders || {}));
console.log('  در انتظار بررسی:', JSON.stringify(o.awaiting || {}));
console.log('  کد سفارش‌های تازه:', [mOrder?.order?.code, rOrder?.order?.code, sOrder?.order?.code, sOrder2?.order?.code, gOrder?.order?.code].filter(Boolean).join(' · '));
