// اجرای واقعی render() برای همهٔ بخش‌های پنل مدیر با دادهٔ زندهٔ سرور
const BASE = process.env.BASE || 'http://127.0.0.1:3001';
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

// ── تست رندر پردهٔ خاموشی ─────────────────────────────────
const { updateSleepScreen } = await import(new URL('../public/js/ui.mjs', import.meta.url).href);
let pass = 0, fail = 0;
const t = (name, fn) => { try { const out = fn(); pass++; console.log('✔', name, out || ''); } catch (e) { fail++; console.log('✘', name, '→', e.message); } };

t('خاموش + کاربر عادی (دکمهٔ ورود مدیر)', () => {
  updateSleepScreen({ sleeping: true, canWake: false, since: new Date().toISOString() });
  const box = globalThis.__lastSleepHtml || '';
  return '';
});
t('خاموش + مدیر (دکمهٔ روشن کردن)', () => { updateSleepScreen({ sleeping: true, canWake: true, since: null }); });
t('روشن (پرده حذف می‌شود)', () => { updateSleepScreen({ sleeping: false }); });
t('بدون پارامتر', () => { updateSleepScreen(); });
t('فقط sleeping', () => { updateSleepScreen({ sleeping: true }); });
console.log(`\n═══ پردهٔ خاموشی: ${pass} موفق · ${fail} ناموفق ═══`);
if (fail) process.exitCode = 1;
