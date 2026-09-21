import { fileURLToPath } from 'node:url';
import { ensureDemoAccounts, solveCaptcha } from './lib/demo.mjs';
// اجرای واقعی render() برای همهٔ بخش‌های پنل مدیر با دادهٔ زندهٔ سرور
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const noop = () => {};
class FakeEl {
  constructor(tag = 'div') { this.tagName = String(tag).toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false;
    this.style = { setProperty: noop, width: '' };
    this.classList = { add: noop, remove: noop, contains: () => false, toggle: noop };
    this.scrollTop = 0; this.scrollHeight = 0; this.textContent = ''; }
  appendChild(c) { this.children.push(c); return c; } insertBefore(n) { return n; }
  addEventListener() {} removeEventListener() {} setAttribute(k, v) { this.attributes[k] = v; } getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute() {} remove() {} focus() {} scrollIntoView() {} reset() {} click() {}
  querySelector() { return null; } querySelectorAll() { return []; } closest() { return null; }
  get firstElementChild() { return null; } get parentNode() { return null; }
  get innerHTML() { return this._html || ''; } set innerHTML(v) { this._html = v; }
  getContext() { return { drawImage: noop, getImageData: () => ({ data: new Uint8ClampedArray(4096) }), fillRect: noop, save: noop, restore: noop, translate: noop, clearRect: noop }; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 40, right: 100, bottom: 40 }; }
}
const docEl = new FakeEl('html');
globalThis.window = globalThis;
globalThis.document = {
  createElement: (t) => new FakeEl(t), createElementNS: (ns, t) => new FakeEl(t), createTextNode: (t) => ({ text: t }),
  getElementById: () => new FakeEl('div'), querySelector: () => null, querySelectorAll: () => [],
  documentElement: docEl, body: new FakeEl('body'), head: new FakeEl('head'), cookie: '',
  addEventListener: noop, removeEventListener: noop, title: '', hidden: false, readyState: 'complete',
};
globalThis.location = { hash: '#/admin', href: BASE + '/', origin: BASE, pathname: '/', search: '', host: '127.0.0.1:3000', replace() {}, assign() {} };
globalThis.history = { pushState: noop, replaceState: noop, back: noop };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-harness', language: 'fa-IR', clipboard: { writeText: async () => {} }, serviceWorker: null, onLine: true, geolocation: null }, configurable: true });
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop, key: () => null, length: 0 };
globalThis.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.matchMedia = () => ({ matches: false, media: '', addEventListener: noop, removeEventListener: noop, addListener: noop });
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.cancelAnimationFrame = noop;
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.Image = class { set src(v) { setTimeout(() => this.onerror?.(), 0); } };
globalThis.addEventListener = noop; globalThis.removeEventListener = noop;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.innerWidth = 1360; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.print = noop; globalThis.scrollTo = noop; globalThis.alert = noop;

// ── نشست کاربر نمونه (مریم) روی سرور زنده ─────────────────
// تضمین وجود حساب نمونه پیش از ورود (خودترمیمی دریفت دیتابیس لوکال)
await ensureDemoAccounts(BASE, ['maryam']);
const jar = new Map();
const store = (res) => { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim()); } };
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const solveSvgCap = solveCaptcha; // تک‌نسخه در tests/lib/demo.mjs
const realFetch = globalThis.fetch;
{ const r = await realFetch(BASE + '/api/bootstrap'); store(r); }
{ let __ct; const c = await realFetch(BASE + '/api/captcha'); const cj = await c.json(); store(c);
  if (!cj.disabled) { const v = await realFetch(BASE + '/api/captcha/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': jar.get('ys_csrf') || '', Cookie: cookieHeader() }, body: JSON.stringify({ id: cj.id, answer: solveSvgCap(cj.svg) }) }); store(v); __ct = (await v.json()).token; }
  const r = await realFetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': jar.get('ys_csrf') || '', Cookie: cookieHeader() }, body: JSON.stringify({ identifier: 'maryam', password: 'Demo@1404', captchaToken: __ct }) }); store(r); const j = await r.json(); if (!j.me) { console.log('login failed', JSON.stringify(j).slice(0, 200)); process.exit(1); } console.log('logged in as', j.me.username, 'wallet', j.me.wallet?.balance); }
document.cookie = `ys_csrf=${jar.get('ys_csrf') || ''}`;

globalThis.fetch = async (input, init = {}) => {
  let url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/')) url = BASE + url;
  const headers = new Headers(init.headers || {});
  headers.set('Cookie', cookieHeader());
  if (!['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase())) headers.set('X-CSRF-Token', jar.get('ys_csrf') || '');
  const res = await realFetch(url, { ...init, headers });
  store(res);
  return res;
};

// چند کالا در سبد بگذار تا صفحهٔ سبد/پرداخت معنا دار باشد
{
  const prods = await (await fetch('/api/products?limit=3')).json();
  for (const p of (prods.items || []).slice(0, 2)) {
    await fetch('/api/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, qty: 1 }) });
  }
}

const state = await import(fileURLToPath(new URL('../public/js/state.mjs', import.meta.url)));
await state.boot();
await state.loadCart?.();
console.log('bootstrap ok — user:', state.S.me?.username, '| cart:', state.S.cart?.items?.length, '| categories:', state.S.categories?.length);

const prods = (await (await fetch('/api/products?limit=5')).json()).items || [];
const pid = prods[0]?.id;
const myOrders = (await (await fetch('/api/me/orders')).json()).items || [];
const oid = myOrders[0]?.id;
const myTickets = (await (await fetch('/api/tickets')).json()).items || [];
const tid = myTickets[0]?.id;
const cats = state.S.categories || [];
const cid = cats[0]?.id;

const PAGE_KEYS = ['about', 'guide', 'service', 'faq', 'terms', 'privacy', 'insurance', 'ticketRules', 'bugReport', 'contact'];
const ACC = ['', 'orders', 'wishlist', 'wallet', 'plus', 'addresses', 'notifications', 'tickets', 'support', 'reviews', 'feedback', 'profile', 'security', 'prefs', 'data'];

const CASES = [
  ['home', 'views/home.mjs', {}],
  ['catalog', 'views/catalog.mjs', {}],
  ['catalog?sort', 'views/catalog.mjs', {}, new URLSearchParams('sort=newest&q=کابل')],
  ['category/:id', 'views/catalog.mjs', { id: cid }],
  ['product/:id', 'views/product.mjs', { id: pid }],
  ['search-image', 'views/search-image.mjs', {}],
  ['cart', 'views/cart.mjs', {}],
  ['checkout', 'views/checkout.mjs', {}],
  ['compare', 'views/compare.mjs', {}],
  ['price-check', 'views/price-check.mjs', {}],
  ['careers', 'views/careers.mjs', {}],
  ['catalog?oldPrice', 'views/catalog.mjs', {}, new URLSearchParams('oldPrice=1')],
  ['auth', 'views/auth.mjs', {}],
  ['auth/login', 'views/auth.mjs', { mode: 'login' }],
  ['auth/register', 'views/auth.mjs', { mode: 'register' }],
  ['order-detail', 'views/order-detail.mjs', { id: oid }],
  ['ticket-detail', 'views/ticket-detail.mjs', { id: tid }],
  ['checkout-done', 'views/checkout-done.mjs', { id: oid }],
  ['pay', 'views/pay.mjs', { id: oid }],
  ['not-found', 'views/not-found.mjs', {}],
  ...ACC.map((s) => [`account/${s || 'dashboard'}`, 'views/account.mjs', { section: s }]),
  ...PAGE_KEYS.map((k) => [`pages/${k}`, 'views/page.mjs', { key: k }]),
];

let pass = 0, fail = 0;
const cache = new Map();
for (const [name, mod, params, query] of CASES) {
  if (!params || (params.id === undefined && String(name).match(/order-detail|ticket-detail|product\//))) { console.log('— skip', name, '(no data)'); continue; }
  try {
    if (!cache.has(mod)) cache.set(mod, await import(fileURLToPath(new URL('../public/js/' + mod, import.meta.url))));
    const m = cache.get(mod);
    const out = await m.render({ params, query: query || new URLSearchParams(), path: '/' + name });
    const s = typeof out === 'string' ? out : (out?.html ?? String(out ?? ''));
    const problems = [];
    if (!s || s.length < 30) problems.push('output too short (' + s.length + ')');
    if (s.includes('[object Object]')) problems.push('contains [object Object]');
    const cleaned = s.replace(/data-[a-z-]+="[^"]*"/g, '');
    const u = cleaned.match(/.{0,60}(undefined|NaN).{0,40}/);
    if (u) problems.push('undefined/NaN: …' + u[0].replace(/\s+/g, ' ') + '…');
    if (/\b(err\.generic|common\.loading)</.test(s)) problems.push('untranslated key leaked');
    if (problems.length) { fail++; console.log('✘', name, '→', problems.join(' | ')); }
    else { pass++; console.log('✔', name, `(${s.length} chars)`); }
    if (typeof m.mount === 'function') { try { m.mount(new FakeEl('div'), { params, query: query || new URLSearchParams() }); } catch (e) { console.log('  ⚠ mount failed:', name, e.message.split('\n')[0]); } }
  } catch (err) {
    fail++; console.log('✘', name, '→ EXCEPTION:', err.message.split('\n').slice(0, 3).join(' / '));
  }
}
console.log(`\n═══ storefront harness: ${pass} موفق · ${fail} ناموفق ═══`);
process.exit(fail ? 1 : 0);
