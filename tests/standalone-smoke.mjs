// دود تست نسخهٔ تک‌فایلی در node با DOM جعلی
import { readFileSync } from 'node:fs';
import { OFFLINE_DEMO_PASSWORD } from '../tools/offline-seed.mjs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
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
const LS = new Map();
globalThis.window = globalThis;
globalThis.document = {
  createElement: (t) => new FakeEl(t), createElementNS: (ns, t) => new FakeEl(t), createTextNode: (t) => ({ text: t }),
  getElementById: () => new FakeEl('div'), querySelector: () => null, querySelectorAll: () => [],
  documentElement: docEl, body: new FakeEl('body'), head: new FakeEl('head'), cookie: '',
  addEventListener: noop, removeEventListener: noop, title: '', hidden: false, readyState: 'complete',
};
globalThis.location = { hash: '#/', href: 'file:///x/index.html', origin: 'null', pathname: '/', search: '', host: '', replace() {}, assign() {} };
globalThis.history = { pushState: noop, replaceState: noop, back: noop };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', language: 'fa-IR', clipboard: { writeText: async () => {} }, serviceWorker: null, onLine: true, geolocation: null }, configurable: true });
globalThis.localStorage = { getItem: (k) => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => LS.set(k, String(v)), removeItem: (k) => LS.delete(k), key: () => null, length: 0 };
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

// باندل داخل HTML را بیرون بکش
const html = readFileSync(fileURLToPath(new URL('../yassaei-offline.html', import.meta.url)), 'utf-8');
const m = html.match(/<script>\n\(function\(\)\{\n'use strict';\nconst __REG[\s\S]*?<\/script>/);
if (!m) { console.log('✘ باندل پیدا نشد'); process.exit(1); }
const bundle = m[0].replace(/^<script>\n/, '').replace(/\n<\/script>$/, '');
// seed و assets را هم از HTML بخوان
for (const key of ['__SEED', '__ASSETS']) {
  const mm = html.match(new RegExp(`<script>window\\.${key} = (\\{[\\s\\S]*?\\});</script>`));
  if (mm) globalThis[key] = JSON.parse(mm[1]);
}
let failed = 0;
try {
  vm.runInThisContext(bundle, { filename: 'bundle.js' });
  console.log('✔ باندل بدون خطا اجرا شد (init)');
} catch (e) { console.log('✘ خطای اجرای باندل:', e.message); failed++; }
await new Promise((r) => setTimeout(r, 300));
const A = globalThis.__STANDALONE_API;
if (!A) { console.log('✘ API در دسترس نیست'); process.exit(1); }
// شناسهٔ دو کالای نمونه از دانهٔ داخل خود باندل (به‌جای شناسهٔ هاردکد قدیمی)
let PID1 = 'p001', PID2 = 'p002';
try { const lst = await A.api.get('/api/products?limit=2'); PID1 = lst.items[0]?.id || PID1; PID2 = lst.items[1]?.id || PID2; } catch { /* fallback به p001 */ }
const t = async (name, fn) => {
  try { const v = await fn(); console.log('✔', name, v ?? ''); }
  catch (e) { console.log('✘', name, '→', e.message || e.code); failed++; }
};
await t('bootstrap', async () => { const r = await A.api.get('/api/bootstrap'); if (!r.settings) throw new Error('no settings'); return `${r.categories.length} دسته` });
await t('لیست محصولات', async () => { const r = await A.api.get('/api/products?limit=5'); return `${r.items.length} کالا از ${r.total}` });
await t('جست‌وجو', async () => { const r = await A.api.get('/api/search?q=کابل'); return `${r.items.length} نتیجه` });
await t('جزئیات محصول', async () => { const r = await A.api.get(`/api/products/${PID1}`); return r.product.name.slice(0, 20) });
await t('ورود مدیر', async () => { const r = await A.api.post('/api/auth/login', { identifier: 'admin', password: OFFLINE_DEMO_PASSWORD }); return r.me.role });
await t('افزودن به سبد', async () => { const r = await A.api.post('/api/cart/add', { productId: PID1, qty: 2 }); return `${r.cart.count} قلم` });
await t('نقل قول checkout', async () => { const r = await A.api.post('/api/checkout/quote', { delivery: 'courier', zone: 'city' }); return `جمع ${r.quote.total}` });
await t('ثبت سفارش', async () => { const r = await A.api.post('/api/checkout', { delivery: 'pickup', paymentMethod: 'cod', acceptTerms: true }); return r.order.code });
await t('سفارش‌های من', async () => { const r = await A.api.get('/api/me/orders'); return `${r.items.length} سفارش` });
await t('پنل: overview', async () => { const r = await A.api.get('/api/admin/overview'); return `kpi orders=${r.kpi.orders}` });
await t('پنل: ویرایش محصول', async () => { const r = await A.api.patch(`/api/admin/products/${PID2}`, { stock: 9 }); return `stock=${r.product.stock}` });
await t('پنل: تنظیمات', async () => { const r = await A.api.patch('/api/admin/settings/store', { tagline: 'تست محلی' }); return r.section });
await t('خواب/روشن', async () => { await A.api.post('/api/system/sleep', {}); const s1 = await A.api.get('/api/system/status'); await A.api.post('/api/system/wake', {}); const s2 = await A.api.get('/api/system/status'); return `${s1.sleeping} → ${s2.sleeping}` });
await t('اسکن بارکد', async () => { const r = await A.api.post('/api/scan', { code: 'BM-1000' }); return r.found });
console.log(failed ? `\n✘ ${failed} مورد ناموفق` : '\n✔ همهٔ بررسی‌های نسخهٔ محلی موفق بود');
process.exitCode = failed ? 1 : 0;
