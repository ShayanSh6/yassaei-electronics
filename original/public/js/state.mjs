// ─────────────────────────────────────────────────────────────
//  وضعیت سراسری برنامه: تنظیمات، کاربر، سبد، لیست، اعلان‌ها، SSE
// ─────────────────────────────────────────────────────────────
import { api } from './lib/api.mjs';
import { setLang, lang } from './i18n.mjs';
import { setLocale } from './lib/dom.mjs';
import { kycConfig } from './lib/kyc.mjs';
import { visibleNav, navItem } from './lib/nav.mjs';

export const MAX_COMPARE_ITEMS = 5;

const LS = {
  prefs: 'ys_prefs_v1',
  cart: 'ys_cart_local_v1',
  wish: 'ys_wish_v1',
  cmp: 'ys_cmp_v1',
  recent: 'ys_recent_v1',
  search: 'ys_search_v1',
  consent: 'ys_consent_v1',
  imgIdx: 'ys_img_index_v1',
};

export const S = {
  ready: false,
  serverTime: null,
  sleeping: false,
  sleepSince: null,
  settings: null,
  categories: [],
  brands: [],
  me: null,
  stats: null,
  ads: [],
  ticker: [],
  orderStatuses: [],
  ticketCategories: [],
  ticketPriorities: [],
  cart: { items: [], count: 0, subtotal: 0, weight: 0, coupon: null },
  wishlist: [],
  compare: [],
  alerts: [],
  notifications: [],
  unread: 0,
  recent: [],
  searches: [],
  prefs: { theme: 'dark', locale: 'fa', density: 'normal', reduceMotion: false, view: 'grid' },
  consent: null,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  installPrompt: null,
  installed: false,
};

// ── رویدادها ────────────────────────────────────────────────
const handlers = new Map();
export function on(ev, fn) {
  if (!handlers.has(ev)) handlers.set(ev, new Set());
  handlers.get(ev).add(fn);
  return () => handlers.get(ev)?.delete(fn);
}
export function emit(ev, data) {
  for (const fn of handlers.get(ev) || []) { try { fn(data); } catch (e) { console.error('[state]', ev, e); } }
}

// ── دسترسی به تنظیمات ────────────────────────────────────────
// برچسب نسخهٔ کلاینت؛ با هر انتشار باید همراه sw.js و BUILD سرور بالا برود
export const BUILD = 'ys-v138';
export const settings = () => S.settings || {};
export const store = () => S.settings?.store || {};
export const ui = () => S.settings?.ui || {};
export const themeCfg = () => S.settings?.theme || {};
export const feat = (k) => S.settings?.features?.[k] !== false;
/** متن دلخواه نشان «به قیمت خرید قبل» (از تنظیمات مدیر) */
export const oldPriceBadgeText = () => {
  const o = S.settings?.oldPrice || {};
  if (lang() === 'fa') return o.badgeText || '🔥 به قیمت خرید قبل';
  return o.badgeTextEn || o.badgeText || '🔥 At previous purchase price';
};
export const ship = () => S.settings?.shipping || {};
export const plusCfg = () => S.settings?.plus || {};
export const ordersCfg = () => S.settings?.orders || {};
// قاعدهٔ احراز هویت هنگام ثبت سفارش (پیش‌فرض: غیرفعال)
export const kycCfg = () => kycConfig(S.settings?.orders || {});
// ── مدیریت منوها: تنظیمات مدیر (settings.nav) با پیش‌فرض‌های داخلی ──
// سازگاری: اگر settings.accountNav (شکل قدیمی) وجود داشته باشد، همان
// مبنای پنل کاربری قرار می‌گیرد (nav.mjs این کار را انجام می‌دهد).
export const navSettings = () => S.settings || {};
/** آیا دکمهٔ احراز هویت باید در منوها دیده شود؟ (سیستم روشن + نمایش در منو) */
export const kycVisible = () => {
  const c = kycCfg();
  return c.enabled !== false && c.showInNav !== false;
};
/** دکمه‌های نهایی یک گروه منو: پنل کاربری، ناوبری بالای سایت یا نوار موبایل */
export const navItems = (group) => visibleNav(group, navSettings(), {
  feat, kycVisible,
  // کلید جداگانهٔ دکمهٔ «فرصت‌های شغلی» در منو (settings.careers.navShowInNav)
  careersNavVisible: () => (S.settings?.careers?.navShowInNav !== false),
});
export const accountNav = () => navItems('account');
export const headerNav = () => navItems('header');
export const mobileNav = () => navItems('mobile');
/** وضعیت فعال/غیرفعال یک دکمهٔ مشخص (برای صفحاتی که خودشان بخش را می‌سازند) */
export const navEntry = (group, id) => navItem(group, id, navSettings());
export const catById = (id) => S.categories.find((c) => c.id === id) || null;
export const brandById = (id) => S.brands.find((b) => b.id === id) || null;
export const isPlus = () => !!(S.me?.plus?.active && S.me?.plus?.until && new Date(S.me.plus.until) > new Date());
export const isAdmin = () => !!(S.me?.isAdmin);
/** فقط مدیر (مالک) و کارمندان — برای بخش‌های داخلی تیم مثل چت و استخدام */
export const isStaff = () => { const r = S.me?.role; return r === 'owner' || r === 'staff'; };
export const can = (perm) => {
  if (!S.me) return false;
  if (S.me.role === 'owner') return true;
  return S.me.permissions?.[perm] === true;
};
export const catName = (c) => (lang() === 'fa' ? (c?.name || '') : (c?.nameEn || c?.name || ''));
export const brandName = (b) => (lang() === 'fa' ? (b?.name || '') : (b?.nameEn || b?.name || ''));
export const prodName = (p) => (lang() === 'fa' ? (p?.name || '') : (p?.nameEn || p?.name || ''));
export const adInSlot = (slot) => (feat('ads') ? S.ads.filter((a) => a.slot === slot && a.active !== false) : []);

// ── ترجیحات محلی ────────────────────────────────────────────
function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* حافظه پر یا مسدود */ }
}

export function loadPrefs() {
  const saved = readLS(LS.prefs, {});
  S.prefs = { ...S.prefs, ...saved };
  // ترجیح کاربر لاگین‌شده بر تنظیمات محلی اولویت دارد
  if (S.me?.prefs) {
    const p = S.me.prefs;
    if (p.theme) S.prefs.theme = p.theme;
    if (p.locale) S.prefs.locale = p.locale;
    if (p.density && p.density !== 'normal') S.prefs.density = p.density;
    if (p.reduceMotion !== undefined) S.prefs.reduceMotion = !!p.reduceMotion;
    if (p.uiSound !== undefined) S.prefs.uiSound = !!p.uiSound;
  }
  return S.prefs;
}

export function setPref(key, value, { sync = true } = {}) {
  S.prefs[key] = value;
  writeLS(LS.prefs, S.prefs);
  applyPrefs();
  emit('prefs', { key, value });
  if (sync && S.me && ['theme', 'locale', 'density', 'reduceMotion', 'uiSound'].includes(key)) {
    const prefs = { theme: S.prefs.theme, locale: S.prefs.locale, density: S.prefs.density, reduceMotion: S.prefs.reduceMotion, uiSound: !!S.prefs.uiSound };
    api.patch('/api/me', { prefs }).then((r) => { if (r?.me) { S.me = r.me; emit('me', S.me); } }).catch(() => { /* بی‌صدا */ });
  }
}

// ── چرخش خودکار دیزاین: با هر بارگذاری صفحه یک قالب از استخر تصادفی ──
// انتخاب در طول عمر صفحه ثابت می‌ماند (فقط رفرش/ورود جدید قالب عوض می‌کند)
// و سعی می‌شود همان قالب قبلی دوباره انتخاب نشود.
let rotatedDesign = null;
const DESIGN_LS = 'ys_design_last';
function pickDesign(th) {
  const fixed = th.theme || 'logo'; // قالب پیش‌فرض سایت: لوگوی یاسایی
  const pool = Array.isArray(th.designPool) ? th.designPool.filter((x) => typeof x === 'string' && x).slice(0, 5) : [];
  if (th.rotateDesigns !== true || !pool.length) return fixed;
  if (rotatedDesign) return rotatedDesign;
  let last = '';
  try { last = JSON.parse(localStorage.getItem(DESIGN_LS) || '""'); } catch { /* noop */ }
  const cands = pool.length > 1 ? pool.filter((t) => t !== last) : pool;
  rotatedDesign = cands[Math.floor(Math.random() * cands.length)] || pool[0];
  try { localStorage.setItem(DESIGN_LS, JSON.stringify(rotatedDesign)); } catch { /* noop */ }
  return rotatedDesign;
}

/** اعمال تنظیمات پوسته (سرور) + ترجیحات کاربر روی <html> */
export function applyPrefs() {
  const root = document.documentElement;
  const th = themeCfg();
  const p = S.prefs;

  // زبان
  const loc = p.locale || 'fa';
  setLang(loc);
  setLocale(loc);
  root.setAttribute('data-lang', loc);

  // پوسته
  let mode = p.theme || th.mode || 'dark';
  if (mode === 'auto') mode = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.setAttribute('data-mode', mode);
  const design = pickDesign(th);
  root.setAttribute('data-theme', design);
  root.setAttribute('color-scheme', mode);

  // پوستهٔ تهرانی و سبک پس‌زمینه
  root.setAttribute('data-port', th.portTheme === false ? 'off' : 'on');
  root.setAttribute('data-bg', th.bgStyle || 'waves');
  // پوستهٔ تازه/کلاسیک (کلید برگشت در پنل مدیر)
  root.setAttribute('data-variant', th.variant === 'classic' ? 'classic' : 'fresh');

  // گردی و تراکم و کنتراست
  const r = Math.max(0, Math.min(28, Number(th.radius ?? 16)));
  root.style.setProperty('--radius', `${r}px`);
  root.style.setProperty('--radius-sm', `${Math.max(4, Math.round(r * 0.68))}px`);
  root.style.setProperty('--radius-lg', `${Math.round(r * 1.5)}px`);
  const density = p.density === 'compact' || p.density === 'comfy' ? p.density : (th.density || 'normal');
  root.setAttribute('data-density', density);
  root.setAttribute('data-contrast', th.contrast === 'high' ? 'high' : 'normal');

  // انیمیشن
  const motionOff = p.reduceMotion === true || th.animations === false;
  root.setAttribute('data-motion', motionOff ? 'off' : 'on');

  // رنگ اصلی — پیش‌فرض آبی الکتریک یاسایی؛ توکن‌ها برای همهٔ قالب‌ها (از جمله logo)
  // به‌صورت درون‌خطی اعمال می‌شوند تا دکمه‌ها و لوگو همگام با رنگ اصلی تغییر کنند.
  const accent = /^#[0-9a-f]{6}$/i.test(String(th.accent || '').trim()) ? th.accent.trim() : '#3dabff';
  for (const [k, v] of Object.entries(deriveAccentTokens(accent))) root.style.setProperty(k, v);
  // رنگ دوم و رنگ پس‌زمینهٔ سفارشی مدیر — همگام با متغیرهای CSS؛
  // اگر ست نشده باشند، مقدار مشتق‌شده از رنگ اصلی (برای accent-2) و رنگ خودِ قالب (برای bg) معتبر می‌ماند.
  const accent2 = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(th.accent2 || '').trim()) ? th.accent2.trim().toLowerCase() : '';
  if (accent2) root.style.setProperty('--accent-2', accent2);
  const bgColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(th.bgColor || '').trim()) ? th.bgColor.trim().toLowerCase() : '';
  // در حالت روشن هرگز پس‌زمینهٔ تیرهٔ سفارشی اعمال نشود تا خوانایی حفظ بماند
  if (bgColor && mode !== 'light') root.style.setProperty('--bg', bgColor);
  else root.style.removeProperty?.('--bg');

  // چیدمان رابط
  const u = ui();
  root.setAttribute('data-nav', u.navStyle === 'underline' ? 'underline' : 'pills');
  root.setAttribute('data-cards', u.cardStyle === 'list' ? 'list' : 'grid');
  root.style.setProperty('--cols-m', String(clampInt(u.columns?.mobile, 2, 1, 3)));
  root.style.setProperty('--cols-t', String(clampInt(u.columns?.tablet, 3, 2, 4)));
  root.style.setProperty('--cols-d', String(clampInt(u.columns?.desktop, 4, 3, 6)));
  root.style.setProperty('--cols-w', String(clampInt(u.columns?.wide, 5, 3, 7)));
  root.style.setProperty('--ticker-dur', `${Math.max(8, Number(u.tickerSpeed) || 30)}s`);

  // سربرگ
  const hg = document.getElementById('headerGrid');
  if (hg) {
    hg.setAttribute('data-search-position', ['start', 'center', 'end'].includes(u.searchPosition) ? u.searchPosition : 'center');
    hg.setAttribute('data-header-layout', ['logoStart', 'split', 'centered'].includes(u.headerLayout) ? u.headerLayout : 'split');
  }
  const hd = document.getElementById('siteHeader');
  if (hd) hd.setAttribute('data-sticky', u.stickyHeader === false ? 'off' : 'on');
  const tb = document.getElementById('topbar');
  if (tb) tb.hidden = u.showTicker === false && !S.ticker.length;

  emit('theme', { mode, loc });

  setTimeout(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  }, 50);
}

// ── پیش‌نمایش زندهٔ رنگ اصلی (پنل مدیر) ─────────────────────
// انتخابگر رنگِ تب «پوسته» پیش از ذخیره، رنگ را روی کل سایت اعمال می‌کند
// تا مدیر نتیجه را همان لحظه ببیند. derive() دقیقاً همان توکن‌هایی است که
// applyPrefs از رنگ ذخیره‌شده می‌سازد؛ clear() آن‌ها را می‌کند تا رنگ
// ذخیره‌شده (یا پیش‌فرض) برگردد.
function deriveAccentTokens(acc) {
  const [rr, gg, bb] = hexToRgb(acc).split(',').map((x) => parseInt(x, 10));
  // رنگ متن روی سطح‌های رنگی: بر اساس روشناییِ رنگ اصلی به‌صورت خودکار تیره/روشن می‌شود
  const brightness = 0.299 * rr + 0.587 * gg + 0.114 * bb;
  return {
    '--accent': acc,
    '--accent-rgb': `${rr}, ${gg}, ${bb}`,
    '--accent-2': shade(acc, -34),
    '--accent-3': shade(acc, 52),
    '--accent-soft': `rgba(${rr}, ${gg}, ${bb}, .14)`,
    '--accent-ink': brightness > 150 ? '#0b1220' : '#ffffff',
  };
}
const ACCENT_TOKENS = ['--accent', '--accent-rgb', '--accent-2', '--accent-3', '--accent-soft', '--accent-ink'];
export function previewAccent(hex) {
  const acc = /^#[0-9a-f]{6}$/i.test(String(hex || '').trim()) ? String(hex).trim() : null;
  if (!acc) return false;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(deriveAccentTokens(acc))) root.style.setProperty(k, v);
  return true;
}
export function clearAccentPreview() {
  const root = document.documentElement;
  for (const key of ACCENT_TOKENS) root.style.removeProperty?.(key);
}

function clampInt(v, dflt, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : dflt;
}

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return '61, 171, 255';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}
export function shade(hex, amt) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const f = (v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${f(parseInt(m[1], 16))}${f(parseInt(m[2], 16))}${f(parseInt(m[3], 16))}`;
}

// ── بارگذاری اولیه ──────────────────────────────────────────
export async function boot() {
  S.recent = readLS(LS.recent, []);
  S.searches = readLS(LS.search, []);
  S.consent = readLS(LS.consent, null);
  S.wishlist = readLS(LS.wish, []);
  S.compare = readLS(LS.cmp, []).slice(0, MAX_COMPARE_ITEMS);
  S.installed = window.matchMedia?.('(display-mode: standalone)').matches || (typeof navigator !== 'undefined' && navigator.standalone === true);

  let data = null;
  const t0 = Date.now();
  for (let attempt = 0; attempt < 10 && !data; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 5000));
    try { data = await api.get('/api/bootstrap'); } catch (e) { console.warn('[state] bootstrap failed', e); }
    if (!data && Date.now() - t0 > 6000) emit('boot-slow');
  }
  if (data) {
    S.serverTime = data.serverTime;
    S.sleeping = !!data.sleeping;
    S.sleepSince = data.sleepSince || null;
    S.settings = data.settings || {};
    window._translationsOverride = S.settings.translations || {};
    window.__textReplacements = S.settings.translations?.replacements || {};
    S.categories = data.categories || [];
    S.brands = data.brands || [];
    S.me = data.me || null;
    S.stats = data.stats || null;
    S.ads = data.ads || [];
    S.ticker = data.ticker || [];
    S.orderStatuses = data.orderStatuses || [];
    S.ticketCategories = data.ticketCategories || [];
    S.ticketPriorities = data.ticketPriorities || [];
  }
  if (!data) emit('boot-failed');
  loadPrefs();
  applyPrefs();

  if (S.me) {
    S.wishlist = S.me.wishlist || [];
    S.compare = (S.me.compare || []).slice(0, MAX_COMPARE_ITEMS);
    S.alerts = S.me.alerts || [];
    S.unread = S.me.unreadNotifications || 0;
  }

  await Promise.all([loadCart().catch(() => {}), S.me ? loadNotifications(true).catch(() => {}) : Promise.resolve()]);
  S.ready = true;
  connectEvents();
  emit('ready', S);
  return S;
}

export async function refreshBootstrap({ silent = false } = {}) {
  try {
    const data = await api.get('/api/bootstrap');
    S.settings = data.settings || S.settings;
    window._translationsOverride = S.settings.translations || {};
    window.__textReplacements = S.settings.translations?.replacements || {};
    S.sleeping = !!data.sleeping;
    S.sleepSince = data.sleepSince || null;
    S.categories = data.categories || S.categories;
    S.brands = data.brands || S.brands;
    S.stats = data.stats || null;
    S.ads = data.ads || [];
    S.ticker = data.ticker || [];
    if (data.me !== undefined) { S.me = data.me || null; emit('me', S.me); }
    applyPrefs();
    emit('settings', S.settings);
    return S;
  } catch (e) { if (!silent) throw e; return S; }
}

export async function refreshMe() {
  if (!S.me) return null;
  try {
    const r = await api.get('/api/me');
    S.me = r.me || null;
    if (S.me) {
      S.wishlist = S.me.wishlist || [];
      S.compare = (S.me.compare || []).slice(0, MAX_COMPARE_ITEMS);
      S.alerts = S.me.alerts || [];
      S.unread = S.me.unreadNotifications || 0;
    }
    emit('me', S.me);
    return S.me;
  } catch { return S.me; }
}

// ── سبد خرید ────────────────────────────────────────────────
export async function loadCart() {
  try {
    const r = await api.get('/api/cart');
    S.cart = r.cart || S.cart;
    if (r.quote?.freeOver !== undefined) S.freeOver = r.quote.freeOver;
    if (r.quote?.plus !== undefined) S.cartPlus = r.quote.plus;
  } catch {
    S.cart = { items: [], count: 0, subtotal: 0, weight: 0, coupon: null };
  }
  emit('cart', S.cart);
  return S.cart;
}
export async function addToCart(productId, qty = 1) {
  const r = await api.post('/api/cart/add', { productId, qty });
  S.cart = r.cart;
  emit('cart', S.cart);
  return r;
}
export async function setQty(productId, qty) {
  const r = await api.patch('/api/cart/item', { productId, qty });
  S.cart = r.cart;
  emit('cart', S.cart);
  return r;
}
export async function removeFromCart(productId) {
  const r = await api.del(`/api/cart/item/${encodeURIComponent(productId)}`);
  S.cart = r.cart;
  emit('cart', S.cart);
  return r;
}
export async function clearCart() {
  const r = await api.post('/api/cart/clear');
  S.cart = r.cart || { items: [], count: 0, subtotal: 0, weight: 0, coupon: null };
  emit('cart', S.cart);
  return r;
}
export async function applyCoupon(code) {
  const r = await api.post('/api/cart/coupon', { code });
  S.cart = r.cart;
  emit('cart', S.cart);
  return r;
}
export const cartCount = () => S.cart?.count || 0;

// ── لیست من / مقایسه / هشدار موجودی ─────────────────────────
async function toggleServer(kind, productId) {
  const r = await api.post(`/api/me/${kind}/${encodeURIComponent(productId)}`);
  if (kind === 'wishlist') S.wishlist = r.list || r.wishlist || S.wishlist;
  if (kind === 'compare') S.compare = r.list || r.compare || S.compare;
  if (kind === 'alerts') S.alerts = r.list || r.alerts || S.alerts;
  return r;
}
export async function toggleWishlist(productId) {
  if (!S.me) {
    const i = S.wishlist.indexOf(productId);
    if (i >= 0) S.wishlist.splice(i, 1); else S.wishlist.push(productId);
    writeLS(LS.wish, S.wishlist);
    const added = S.wishlist.includes(productId);
    emit('wishlist', S.wishlist);
    return { added, in: added };
  }
  const r = await toggleServer('wishlist', productId);
  const isAdded = r.added !== undefined ? !!r.added : S.wishlist.includes(productId);
  emit('wishlist', S.wishlist);
  return { ...r, added: isAdded, in: isAdded };
}
export async function toggleCompare(productId) {
  if (!S.me) {
    const i = S.compare.indexOf(productId);
    if (i >= 0) S.compare.splice(i, 1);
    else { if (S.compare.length >= MAX_COMPARE_ITEMS) S.compare.shift(); S.compare.push(productId); }
    writeLS(LS.cmp, S.compare);
    emit('compare', S.compare);
    return { in: S.compare.includes(productId) };
  }
  const r = await toggleServer('compare', productId);
  const inList = r.in !== undefined ? !!r.in : r.added !== undefined ? !!r.added : S.compare.includes(productId);
  emit('compare', S.compare);
  return { ...r, in: inList };
}
export async function toggleAlert(productId) {
  if (!S.me) throw new Error('login_required');
  const r = await toggleServer('alerts', productId);
  emit('alerts', S.alerts);
  return r;
}
export const inWishlist = (id) => S.wishlist.includes(id);
export const inCompare = (id) => S.compare.includes(id);
export const hasAlert = (id) => S.alerts.includes(id);

/** ادغام لیست مهمان با حساب کاربری پس از ورود */
export async function mergeGuestData() {
  if (!S.me) return;
  const localWish = readLS(LS.wish, []);
  const localCmp = readLS(LS.cmp, []);
  const todo = [];
  for (const id of localWish) if (!S.wishlist.includes(id)) todo.push(toggleServer('wishlist', id).catch(() => {}));
  for (const id of localCmp) if (!S.compare.includes(id) && S.compare.length < MAX_COMPARE_ITEMS) todo.push(toggleServer('compare', id).catch(() => {}));
  await Promise.all(todo);
  emit('wishlist', S.wishlist);
  emit('compare', S.compare);
}

// ── اعلان‌ها ────────────────────────────────────────────────
export async function loadNotifications(silent = false) {
  if (!S.me) { S.notifications = []; S.unread = 0; return []; }
  try {
    const r = await api.get('/api/me/notifications');
    S.notifications = r.items || [];
    S.unread = S.notifications.filter((n) => !n.read).length;
    if (S.me) S.me.unreadNotifications = S.unread;
    emit('notifications', S.notifications);
  } catch (e) { if (!silent) throw e; }
  return S.notifications;
}
export async function markNotificationsRead(ids, all = false) {
  const r = await api.post('/api/me/notifications/read', { ids: ids || [], all });
  await loadNotifications(true);
  return r;
}
export async function deleteNotification(id) {
  await api.del(`/api/me/notifications/${encodeURIComponent(id)}`);
  await loadNotifications(true);
}

// ── کالاهای اخیراً دیده‌شده ─────────────────────────────────
export function pushRecent(productId) {
  if (!feat('recentlyViewed')) return;
  S.recent = [productId, ...S.recent.filter((x) => x !== productId)].slice(0, 12);
  writeLS(LS.recent, S.recent);
  emit('recent', S.recent);
}
export function addSearch(q) {
  const s = String(q || '').trim();
  if (!s) return;
  S.searches = [s, ...S.searches.filter((x) => x !== s)].slice(0, 8);
  writeLS(LS.search, S.searches);
}
export function clearSearches() { S.searches = []; writeLS(LS.search, []); }

// ── توافق‌نامه ──────────────────────────────────────────────
export const CONSENT_VERSION = 2;
export const CONSENT_TTL_DAYS = 180;
export const hasConsent = () => {
  const c = S.consent;
  if (!c || !c.at) return false;
  // If version doesn't match, we ignore it and ask again
  if ((c.v || 1) !== CONSENT_VERSION) return false;
  // Let's use Date.parse and ensure it's not NaN
  const parsedAt = Date.parse(c.at);
  if (Number.isNaN(parsedAt)) return false;
  const age = Date.now() - parsedAt;
  return age >= 0 && age < CONSENT_TTL_DAYS * 86400000;
};
export function setConsent(data) {
  S.consent = { ...data, v: CONSENT_VERSION, at: new Date().toISOString() };
  writeLS(LS.consent, S.consent);
  if (S.me) api.patch('/api/me', { consent: true }).catch(() => {});
  emit('consent', S.consent);
}

// ── رویدادهای زنده (SSE) ────────────────────────────────────
let es = null;
let sseTimer = null;
export function connectEvents() {
  if (es) { try { es.close(); } catch { /* noop */ } }
  if (typeof EventSource === 'undefined') return;
  try { es = new EventSource('/api/events', { withCredentials: true }); } catch { return; }
  es.addEventListener('ready', () => { S.online = true; });
  es.addEventListener('support', (e) => { emit('sse:support', safeParse(e.data)); });
  es.addEventListener('ticket', (e) => { emit('sse:ticket', safeParse(e.data)); emit('notif', safeParse(e.data)); });
  es.addEventListener('notif', (e) => { emit('sse:notif', safeParse(e.data)); loadNotifications(true); });
  es.addEventListener('settings', () => refreshBootstrap({ silent: true }));
  es.addEventListener('admin-chat', (e) => { emit('sse:chat', safeParse(e.data)); });
  es.onerror = () => {
    try { es.close(); } catch { /* noop */ }
    clearTimeout(sseTimer);
    sseTimer = setTimeout(connectEvents, 8000);
  };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ── اتصال/قطع اینترنت ───────────────────────────────────────
export function watchNetwork() {
  window.addEventListener('online', () => { S.online = true; emit('online', true); loadCart().catch(() => {}); });
  window.addEventListener('offline', () => { S.online = false; emit('online', false); });
}

// ── نصب PWA ─────────────────────────────────────────────────
export function watchInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installPrompt = e; emit('install', e); });
  window.addEventListener('appinstalled', () => { S.installed = true; S.installPrompt = null; emit('installed'); });
}
export async function promptInstall() {
  if (!S.installPrompt) return false;
  S.installPrompt.prompt();
  const res = await S.installPrompt.userChoice;
  S.installPrompt = null;
  return res?.outcome === 'accepted';
}

// ── ایندکس تصویری (سمت کلاینت) ──────────────────────────────
export function getImgIndex() { return readLS(LS.imgIdx, null); }
export function setImgIndex(v) { writeLS(LS.imgIdx, v); }
