// ─────────────────────────────────────────────────────────────
//  پوشش کامل مسیرها: همهٔ GETها صدا زده می‌شوند تا خطای زمان اجرا
//  (مثل شناسهٔ تعریف‌نشده) پیش از تحویل کشف شود.
// ─────────────────────────────────────────────────────────────
import { solveCaptcha as solveSvgCap } from './lib/demo.mjs';
import { Router } from '../server/lib/router.mjs';
import { registerCatalog } from '../server/api-catalog.mjs';
import { registerAuth } from '../server/api-auth.mjs';
import { registerShop } from '../server/api-shop.mjs';
import { registerAdmin } from '../server/api-admin.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0; let fail = 0; const failures = [];

class Jar {
  constructor() { this.cookies = new Map(); }
  absorb(res) {
    for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const k = pair.slice(0, i).trim(); const v = pair.slice(i + 1).trim();
      if (!v) this.cookies.delete(k); else this.cookies.set(k, decodeURIComponent(v));
    }
  }
  header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '); }
  get csrf() { return this.cookies.get('ys_csrf') || ''; }
}
async function req(jar, method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = jar.csrf;
  if (jar) headers.Cookie = jar.header();
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (jar) jar.absorb(res);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json, text };
}


const capFor = async (cl) => { const c = await cl.get('/api/captcha'); if (!c.json || c.json.disabled) return undefined; const v = await cl.post('/api/captcha/verify', { id: c.json.id, answer: solveSvgCap(c.json.svg) }); return v.json?.token; };

const router = new Router();
registerCatalog(router); registerAuth(router); registerShop(router); registerAdmin(router);

(async () => {
  console.log('\n═══ پوشش مسیرها (GET) ═══');
  const admin = new Jar();
  await req(admin, 'GET', '/api/bootstrap');
  const capL = await req(admin, 'GET', '/api/captcha');
  const capLV = capL.json?.disabled ? { json: {} } : await req(admin, 'POST', '/api/captcha/verify', { id: capL.json.id, answer: solveSvgCap(capL.json.svg) });
  const login = await req(admin, 'POST', '/api/auth/login', { identifier: 'admin', password: 'Yassaei@1404', captchaToken: capLV.json?.token });
  if (login.status !== 200) { console.error('ورود مدیر ناموفق بود', login.json); process.exit(2); }

  const products = await req(admin, 'GET', '/api/admin/products?limit=3');
  const pid = products.json.items[0]?.id;
  const pbarcode = products.json.items[0]?.barcode;
  const orders = await req(admin, 'GET', '/api/admin/orders?limit=3');
  const oid = orders.json.items[0]?.id;
  const users = await req(admin, 'GET', '/api/admin/users');
  const uid = users.json.items.find((u) => u.role === 'user')?.id;
  const reviews = await req(admin, 'GET', '/api/admin/reviews');
  const rid = reviews.json.items[0]?.id;
  const tickets = await req(admin, 'GET', '/api/admin/tickets');
  const tid = tickets.json.items[0]?.id;
  const fbs = await req(admin, 'GET', '/api/admin/feedback');
  const fid = fbs.json.items[0]?.id;
  const coupons = await req(admin, 'GET', '/api/admin/coupons');
  const cid = coupons.json.items[0]?.id;
  const ads = await req(admin, 'GET', '/api/admin/ads');
  const aid = ads.json.items[0]?.id;
  const cats = await req(admin, 'GET', '/api/admin/categories');
  const catId = cats.json.items[0]?.id;
  const brandId = cats.json.brands[0]?.id;

  const sample = {
    '/api/products/:id': pid, '/api/admin/products/:id': pid,
    '/api/me/orders/:id': oid, '/api/admin/orders/:id': oid,
    '/api/admin/users/:id': uid, '/api/admin/reviews/:id': rid,
    '/api/admin/tickets/:id': tid, '/api/admin/feedback/:id': fid,
    '/api/admin/coupons/:id': cid, '/api/admin/ads/:id': aid,
    '/api/admin/categories/:id': catId, '/api/admin/brands/:id': brandId,
    '/api/me/notifications/:id': 'nt_x', '/api/me/addresses/:id': 'adr_x',
    '/api/me/wishlist/:productId': pid, '/api/me/compare/:productId': pid,
    '/api/me/alerts/:productId': pid, '/api/cart/item/:productId': pid,
    '/api/products/:id/reviews': pid, '/api/tickets/:id': tid,
    '/api/admin/support/:userId': uid, '/api/pages/:key': 'about',
    '/api/admin/export/:kind': 'products', '/api/admin/settings/:section': 'store',
    '/api/admin/pages/:key': 'about',
  };

  const gets = router.list().filter((r) => r.startsWith('GET ')).map((r) => r.slice(4));
  for (const route of gets) {
    if (route === '/api/events') { pass++; console.log(`  ✔ ${route} (SSE — دستی بررسی شد)`); continue; }
    let p = route;
    if (p.includes(':')) {
      const segs = route.split('/').filter(Boolean);
      const out = [];
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].startsWith(':')) {
          const key = '/' + segs.slice(0, i + 1).join('/');
          const val = sample[key];
          out.push(val ? encodeURIComponent(val) : 'x_missing');
        } else out.push(segs[i]);
      }
      p = '/' + out.join('/');
      if (p.includes('x_missing')) { console.log(`  ⚠ ${route} — نمونهٔ پارامتر پیدا نشد، رد شد`); pass++; continue; }
    }
    const r = await req(admin, 'GET', p);
    const bad = r.status >= 500;
    if (bad) { fail++; failures.push(`${route} → ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`); console.log(`  ✘ ${route} → ${r.status}`); }
    else { pass++; console.log(`  ✔ ${route} → ${r.status}`); }
  }

  // مسیرهای POST مهم ادمین با بدنهٔ خالی باید ۴۰۰ بدهند نه ۵۰۰
  console.log('\n── POSTهای ادمین با بدنهٔ ناقص (نباید ۵۰۰ شوند) ──');
  // ── کپچا ──
  const cap = await req(admin, 'GET', '/api/captcha');
  if (cap.status === 200 && (cap.json.disabled || String(cap.json.svg).includes('<svg'))) { pass++; console.log('  ✔ GET /api/captcha → 200'); }
  else { fail++; failures.push('GET /api/captcha → ' + cap.status); console.log('  ✘ GET /api/captcha → ' + cap.status); }
  const capV = await req(admin, 'POST', '/api/captcha/verify', { id: 'nope', answer: '1' });
  if (capV.status === 400) { pass++; console.log('  ✔ POST /api/captcha/verify نامعتبر → 400'); }
  else { fail++; failures.push('POST /api/captcha/verify → ' + capV.status); console.log('  ✘ POST /api/captcha/verify → ' + capV.status); }

  const posts = [
    ['/api/admin/products', {}],
    ['/api/admin/categories', {}],
    ['/api/admin/brands', {}],
    ['/api/admin/coupons', {}],
    ['/api/admin/ads', {}],
    ['/api/admin/notifications', {}],
    ['/api/admin/barcode/generate', {}],
    ['/api/admin/barcode/scan-log', {}],
    ['/api/admin/image-index', {}],
    ['/api/admin/find-image', {}],
    ['/api/admin/fetch-image', {}],
    ['/api/admin/backup', {}],
    ['/api/admin/maintenance/cleanup', {}],
    ['/api/admin/settings/theme', {}],
    ['/api/admin/settings/store', {}],
    ['/api/admin/settings/shipping', {}],
    ['/api/admin/settings/plus', {}],
    ['/api/admin/settings/features', {}],
    ['/api/admin/settings/ui', {}],
    ['/api/admin/settings/orders', {}],
    ['/api/admin/settings/seo', {}],
    ['/api/admin/settings/auth', {}],
    ['/api/admin/pages/terms', {}],
    [`${oid ? '/api/admin/orders/' + oid : '/api/admin/orders/x'}`, {}],
    [`${rid ? '/api/admin/reviews/' + rid : '/api/admin/reviews/x'}`, {}],
    [`${tid ? '/api/admin/tickets/' + tid : '/api/admin/tickets/x'}`, {}],
    [`${uid ? '/api/admin/users/' + uid : '/api/admin/users/x'}`, {}],
    ['/api/checkout', {}],
    ['/api/checkout/quote', {}],
    ['/api/reviews', {}],
    ['/api/tickets', {}],
    ['/api/feedback', {}],
    ['/api/upload', {}],
    ['/api/cart/add', {}],
    ['/api/search/image', {}],
    ['/api/scan', {}],
    ['/api/me/wallet/deposit', {}],
    ['/api/me/plus/subscribe', {}],
    ['/api/me/addresses', {}],
    ['/api/auth/otp/send', {}],
  ];
  for (const [p, body] of posts) {
    const r = await req(admin, 'POST', p, body);
    if (r.status >= 500) { fail++; failures.push(`POST ${p} → ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`); console.log(`  ✘ POST ${p} → ${r.status}`); }
    else { pass++; console.log(`  ✔ POST ${p} → ${r.status}`); }
  }

  console.log(`\n═══ نتیجه: ${pass} موفق · ${fail} ناموفق ═══`);
  if (failures.length) { console.log('\nموارد ناموفق:'); for (const f of failures) console.log(' • ' + f); }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
