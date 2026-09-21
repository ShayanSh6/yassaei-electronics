// تست چرخهٔ خواب/بیداری سایت
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
    let json = null; try { json = await res.json(); } catch { json = {}; }
    return { status: res.status, json };
  }
  return { call, get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), patch: (p, b) => call('PATCH', p, b ?? {}) };
}
const out = [];
const chk = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); out.push(`${ok ? '✔' : '✘'} ${name} → ${JSON.stringify(got)}${ok ? '' : ` (انتظار: ${JSON.stringify(want)})`}`); if (!ok) process.exitCode = 1; };


const capFor = async (cl) => { const c = await cl.get('/api/captcha'); if (!c.json || c.json.disabled) return undefined; const v = await cl.post('/api/captcha/verify', { id: c.json.id, answer: solveSvgCap(c.json.svg) }); return v.json?.token; };
const admin = makeClient();
await admin.get('/api/bootstrap');
const lg = await admin.post('/api/auth/login', { identifier: 'admin', password: 'Yassaei@1404', captchaToken: await capFor(admin) });
chk('ورود مدیر', !!lg.json.me, true);

const mary = makeClient();
await mary.get('/api/bootstrap');
await mary.post('/api/auth/login', { identifier: 'maryam', password: 'Demo@1404', captchaToken: await capFor(mary) });

const st0 = await admin.get('/api/system/status');
chk('وضعیت اولیه sleeping', st0.json.sleeping, false);
chk('وضعیت عمومی قابل خواندن بدون لاگین', (await (await fetch(BASE + '/api/system/status')).json()).sleeping, false);

// افزودن به سبد قبل از خواب → باید موفق باشد
const prods = (await (await fetch(BASE + '/api/products?limit=5')).json()).items || [];
const pid = prods[0]?.id;
const before = await mary.post('/api/cart/add', { productId: pid, qty: 1 });
chk('سبد قبل از خواب', before.status, 200);
await mary.post('/api/cart/clear', {});

// خواب
const sl = await admin.post('/api/system/sleep', { minutes: 5 });
chk('خواب موفق', sl.json.sleeping, true);
chk('autoWakeAt تنظیم شده', typeof sl.json.autoWakeAt, 'string');

// درخواست نوشتنی کاربر در حالت خواب → 503
const add1 = await mary.post('/api/cart/add', { productId: pid, qty: 1 });
chk('مسدود شدن سبد در خواب', add1.status, 503);
chk('کد خطای خواب', add1.json.code, 'store_asleep');
// چک‌اوت هم مسدود
const co = await mary.post('/api/checkout', { delivery: 'pickup', paymentMethod: 'gateway', acceptTerms: true });
chk('مسدود شدن چک‌اوت در خواب', co.status, 503);
// GETها باز
chk('خواندن محصولات در خواب', (await mary.get('/api/products?limit=1')).status, 200);
chk('خواندن bootstrap در خواب', (await mary.get('/api/bootstrap')).status, 200);
// لاگین در خواب مجاز
const reza2 = makeClient(); await reza2.get('/api/bootstrap');
const relogin = await reza2.post('/api/auth/login', { identifier: 'reza', password: 'Demo@1404', captchaToken: await capFor(reza2) });
chk('لاگین در خواب مجاز', relogin.status, 200);
// ادمین در خواب کار می‌کند
chk('پنل مدیر در خواب', (await admin.get('/api/admin/overview')).status, 200);
chk('ویرایش محصول توسط مدیر در خواب', (await admin.patch(`/api/admin/products/${pid}`, { stock: 5 })).status, 200);
const origStock = (await (await fetch(BASE + `/api/products/${pid}`)).json())?.product?.stock;

// بیداری
const wk = await admin.post('/api/system/wake', {});
chk('بیداری موفق', wk.json.sleeping, false);
const add2 = await mary.post('/api/cart/add', { productId: pid, qty: 1 });
chk('سبد بعد از بیداری', add2.status, 200);
await mary.post('/api/cart/clear', {});
// بیداری توسط کاربر عادی → ممنوع
const wk2 = await mary.post('/api/system/wake', {});
chk('بیداری توسط کاربر عادی ممنوع', wk2.status, 403);
await admin.patch(`/api/admin/products/${pid}`, { stock: origStock ?? 12 });
await admin.post('/api/cart/clear', {});

console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('✘')).length;
console.log(`\n═══ تست خواب/بیداری: ${out.length - fails} موفق · ${fails} ناموفق ═══`);
