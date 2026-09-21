// ─────────────────────────────────────────────────────────────
//  «مدیریت منوها و بخش‌ها» — فهرست پیش‌فرض همهٔ دکمه‌های سایت
//
//  مدیر فروشگاه از پنل مدیریت (تنظیمات ← مدیریت منوها و بخش‌ها)
//  می‌تواند برای هر دکمهٔ پنل کاربری، ناوبری بالای سایت و نوار پایین
//  موبایل این پنج مورد را بدون کدنویسی تغییر دهد:
//    ۱) نمایش/مخفی کردن دکمه          (show)
//    ۲) فعال/غیرفعال کردن کل بخش       (on)  → «این بخش موقتاً غیرفعال است»
//    ۳) عنوان دلخواه فارسی و انگلیسی   (fa / en)
//    ۴) آیکون SVG یا ایموجی دلخواه     (icon / emoji)
//    ۵) ترتیب قرارگیری دکمه‌ها          (ترتیب آرایه)
//
//  محل ذخیره‌سازی: settings.nav = { account: [...], header: [...], mobile: [...] }
//  سازگاری عقب‌رو: اگر settings.accountNav (شکل قدیمی) وجود داشته باشد،
//  همان مبنای پنل کاربری قرار می‌گیرد. اگر هیچ تنظیمی نباشد، پیش‌فرض‌های
//  همین فایل استفاده می‌شوند (هیچ‌چیز مخفی یا غیرفعال نمی‌شود).
// ─────────────────────────────────────────────────────────────
import { icon, raw, esc } from './dom.mjs';
import { t, lang, defaultFa, defaultEn } from '../i18n.mjs';

/** نام آیکون‌های SVG موجود در سایت (فهرست انتخابگر آیکون در پنل مدیر) */
/** نام آیکون‌های SVG موجود در سایت (فهرست انتخابگر آیکون در پنل مدیر) */
/** نام آیکون‌های SVG موجود در سایت (فهرست انتخابگر آیکون در پنل مدیر) */
import { NAV_ICON_NAMES } from './nav-icons.mjs';
export { NAV_ICON_NAMES };

const ICON_SET = new Set(NAV_ICON_NAMES);

/**
 * گروه‌های مدیریت‌شده:
 *  • account → دکمه‌های پنل کاربری (#/account)
 *  • header  → ناوبری بالای سایت
 *  • mobile  → نوار پایین موبایل
 * هر آیتم: { id, key/fixed, icon, feat, path, href, fa, en }
 */
export const NAV_GROUPS = {
  account: {
    fa: 'پنل کاربری (حساب من)',
    en: 'User panel (My account)',
    hintFa: 'دکمه‌های کنار صفحهٔ «حساب کاربری»؛ ترتیب همین‌جا تعیین می‌شود.',
    hintEn: 'Buttons in the “My account” panel; the order here is exactly what users see.',
    defaults: [
      { id: 'dashboard', icon: 'home', key: 'acc.dashboard', path: '' },
      { id: 'orders', icon: 'package-check', key: 'acc.orders', path: 'orders' },
      { id: 'wishlist', icon: 'heart', key: 'acc.wishlist', path: 'wishlist', feat: 'wishlist' },
      { id: 'wallet', icon: 'wallet', key: 'acc.wallet', path: 'wallet', feat: 'wallet' },
      { id: 'plus', icon: 'sparkles', key: 'acc.plus', path: 'plus', feat: 'plus' },
      { id: 'addresses', icon: 'pin', key: 'acc.addresses', path: 'addresses' },
      { id: 'notifications', icon: 'bell', key: 'acc.notifications', path: 'notifications' },
      { id: 'tickets', icon: 'ticket', key: 'acc.tickets', path: 'tickets', feat: 'tickets' },
      { id: 'support', icon: 'headset', key: 'acc.support', path: 'support', feat: 'liveSupport' },
      { id: 'reviews', icon: 'star', key: 'acc.reviews', path: 'reviews' },
      { id: 'feedback', icon: 'flag', key: 'acc.feedback', path: 'feedback' },
      { id: 'referrals', icon: 'users', key: 'acc.referrals', path: 'referrals' },
      { id: 'profile', icon: 'user', key: 'acc.profile', path: 'profile' },
      { id: 'kyc', icon: 'shield-check', key: 'acc.kyc', path: 'kyc', kyc: true },
      { id: 'lottery', icon: 'gift2', key: 'lot.nav', path: 'lottery', feat: 'lottery' },
      { id: 'installments', icon: 'card', key: 'nav.installments', path: 'installments', feat: 'installments' },
      { id: 'security', icon: 'shield', key: 'acc.security', path: 'security' },
      { id: 'prefs', icon: 'settings', key: 'acc.prefs', path: 'prefs' },
      { id: 'data', icon: 'download', key: 'acc.data', path: 'data' },
    ],
  },
  header: {
    fa: 'ناوبری بالای سایت',
    en: 'Site top navigation',
    hintFa: 'دکمه‌های نوار بالای سایت (زیر سربرگ).',
    hintEn: 'Links shown in the site’s top navigation bar.',
    defaults: [
      { id: 'home', icon: 'home', key: 'nav.home', path: '/', href: '#/' },
      { id: 'products', icon: 'grid', key: 'nav.products', path: '/products', href: '#/products' },
      { id: 'deals', icon: 'percent', key: 'nav.deals', path: '/deals', href: '#/products?discount=1', feat: 'coupons' },
      { id: 'careers', icon: 'users', key: 'nav.careers', path: '/careers', href: '#/careers', feat: 'careers', careers: true },
      { id: 'new', icon: 'sparkles', key: 'nav.new', path: '/new', href: '#/products?sort=newest' },
      { id: 'stats', icon: 'chart', key: 'nav.stats', path: '/stats', href: '#/stats', feat: 'publicStats' },
      { id: 'priceCheck', icon: 'barcode', key: 'priceCheck.title', path: '/price-check', href: '#/price-check', feat: 'priceCheckDevice' },
      { id: 'lottery', icon: 'gift2', key: 'lot.nav', path: '/lottery', href: '#/lottery', feat: 'lottery' },
      { id: 'installments', icon: 'card', key: 'nav.installments', path: '/pages/installments', href: '#/pages/installments', feat: 'installments' },
      { id: 'about', icon: 'store', key: 'nav.about', path: '/pages/about', href: '#/pages/about' },
      { id: 'contact', icon: 'map', key: 'nav.contact', path: '/pages/contact', href: '#/pages/contact' },
    ],
  },
  mobile: {
    fa: 'نوار پایین موبایل',
    en: 'Mobile bottom bar',
    hintFa: 'پنج دکمهٔ نوار پایین در گوشی‌های موبایل.',
    hintEn: 'The five buttons of the mobile bottom bar.',
    defaults: [
      { id: 'mHome', icon: 'home', key: 'mnav.home', path: '/', href: '#/' },
      { id: 'mProducts', icon: 'grid', key: 'mnav.products', path: '/products', href: '#/products' },
      { id: 'mSearch', icon: 'search', key: 'mnav.search', path: '/search', href: '#/search' },
      { id: 'mCart', icon: 'cart', key: 'mnav.cart', path: '/cart', href: '#/cart' },
      { id: 'mAccount', icon: 'user', key: 'mnav.me', path: '/account', href: '#/account' },
    ],
  },
};

export const NAV_GROUP_IDS = Object.keys(NAV_GROUPS);

/** آیکون امن: فقط نام‌های شناخته‌شدهٔ SVG پذیرفته می‌شود */
export function safeIconName(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return ICON_SET.has(s) ? s : '';
}

/** ایموجی/متن کوتاه دلخواه — حداکثر ۶ نویسه، بدون تگ */
export function safeEmoji(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  // فقط نویسه‌های نمایشی (بی‌خطر برای درج در HTML؛ هنگام نمایش هم esc می‌شود)
  return [...s.replace(/[\u0000-\u001f\u007f<>"'`&\\]/g, '')].slice(0, 6).join('').trim();
}

/** تنظیمات ذخیره‌شدهٔ یک گروه (پشتیبانی از شکل قدیمی accountNav) */
function storedGroup(settings, group) {
  const nav = settings && typeof settings.nav === 'object' && settings.nav ? settings.nav : {};
  let list = Array.isArray(nav[group]) ? nav[group] : null;
  if (!list && group === 'account' && settings?.accountNav) {
    const legacy = settings.accountNav;
    if (Array.isArray(legacy)) list = legacy;
    else if (typeof legacy === 'object') list = Object.entries(legacy).map(([id, v]) => ({ id, ...(v && typeof v === 'object' ? v : {}) }));
  }
  return Array.isArray(list) ? list : [];
}

function mergeItem(def, saved) {
  const fa = String(saved?.fa ?? '').trim().slice(0, 60);
  const en = String(saved?.en ?? '').trim().slice(0, 60);
  const icon = safeIconName(saved?.icon) || def.icon;
  const emoji = safeEmoji(saved?.emoji);
  return {
    id: def.id,
    group: def.group,
    icon,
    emoji,
    feat: def.feat || null,
    careers: !!def.careers,
    path: def.path ?? '',
    // کلید فعال‌شدن در نوار بالا؛ برای «تخفیف‌ها» و «جدیدترین‌ها» با query تشخیص داده می‌شود
    key: def.key === 'nav.deals' ? '/deals' : def.key === 'nav.new' ? '/new' : (def.path ?? ''),
    href: def.href || (def.path === '' ? '#/account' : `#/account/${def.path}`),
    kyc: !!def.kyc,
    show: saved?.show === undefined ? true : saved.show !== false,
    on: saved?.on === undefined ? true : saved.on !== false,
    fa, en,
    /** عنوان پیش‌فرض ترجمه‌شده (اگر مدیر عنوان دلخواه نداده باشد) */
    defaultLabel: () => (def.key ? t(def.key) : (lang() === 'fa' ? (def.fa || '') : (def.en || def.fa || ''))),
    /** عنوان نهایی بر پایهٔ زبان جاری */
    label: () => {
      const custom = lang() === 'fa' ? (fa || en) : (en || fa);
      return custom || (def.key ? t(def.key) : (lang() === 'fa' ? (def.fa || '') : (def.en || def.fa || '')));
    },
  };
}

/**
 * فهرست نهایی یک گروه: ترتیب مدیر + پیش‌فرض‌های جاافتاده
 * @returns {Array} آیتم‌های آمادهٔ نمایش
 */
export function navGroup(group, settings) {
  const cfg = NAV_GROUPS[group];
  if (!cfg) return [];
  const saved = storedGroup(settings, group);
  const out = [];
  const seen = new Set();
  for (const s of saved) {
    const def = cfg.defaults.find((d) => d.id === String(s?.id || '').trim());
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    out.push(mergeItem({ ...def, group }, s));
  }
  for (const def of cfg.defaults) {
    if (seen.has(def.id)) continue;
    out.push(mergeItem({ ...def, group }, null));
  }
  return out;
}

/** فقط آیتم‌هایی که باید دیده شوند (نمایش + امکانات فروشگاه + KYC + کلید منوی استخدام) */
export function visibleNav(group, settings, { feat = () => true, kycVisible = () => true, careersNavVisible = () => true } = {}) {
  return navGroup(group, settings).filter((it) => {
    if (it.show !== true) return false;
    if (it.feat && feat(it.feat) === false) return false;
    if (it.kyc && kycVisible() === false) return false;
    // دکمهٔ «فرصت‌های شغلی» کلید جداگانهٔ نمایش در منو دارد (settings.careers.navShowInNav)
    if (it.careers && careersNavVisible() === false) return false;
    return true;
  });
}

/** یک آیتم مشخص از یک گروه (برای سنجش «فعال/غیرفعال») */
export function navItem(group, id, settings) {
  return navGroup(group, settings).find((x) => x.id === id) || null;
}

/** آیا مسیر جاری مربوط به دکمه‌ای است که مدیر آن را غیرفعال کرده؟ */
export function disabledNavForPath(path, settings, group = 'header') {
  const clean = String(path || '/').replace(/\/+$/, '') || '/';
  return navGroup(group, settings).find((it) => {
    if (it.on !== false) return false;
    if (it.id === 'deals' || it.id === 'new') return false; // با ?discount / ?sort تشخیص داده می‌شوند
    const p = String(it.path || '').replace(/\/+$/, '') || '/';
    return p === clean;
  }) || null;
}

/**
 * دکمهٔ غیرفعالِ متناظر با یک مسیر (شامل حالت‌های ?discount=1 و ?sort=newest)
 * @returns {object|null} آیتم غیرفعال یا null
 */
export function disabledNavItem(path, query, settings, group = 'header') {
  const items = navGroup(group, settings);
  const clean = String(path || '/').replace(/\/+$/, '') || '/';
  const q = query instanceof URLSearchParams ? query : new URLSearchParams(query || '');
  if (clean === '/products') {
    if (q.get('discount') === '1') return items.find((x) => x.id === 'deals' && x.on === false) || null;
    if (q.get('sort') === 'newest') return items.find((x) => x.id === 'new' && x.on === false) || null;
    if (!q.toString()) return items.find((x) => x.id === 'products' && x.on === false) || null;
    return null;
  }
  return items.find((x) => x.on === false && String(x.path || '').replace(/\/+$/, '') === clean) || null;
}

/** آیکون نهایی یک آیتم: ایموجی دلخواه، وگرنه SVG */
export function navIconHtml(item, cls = '') {
  if (item?.emoji) return raw(`<span class="em nav-em" aria-hidden="true">${esc(item.emoji)}</span>`);
  return icon(safeIconName(item?.icon) || 'box', cls);
}

/** پیام محترمانهٔ «این بخش موقتاً غیرفعال است» */
export function navDisabledText() {
  return lang() === 'fa' ? 'این بخش موقتاً غیرفعال است.' : 'This section is temporarily disabled.';
}

export function navDisabledHint() {
  return lang() === 'fa'
    ? 'مدیر فروشگاه این بخش را موقتاً از دسترس خارج کرده است. کمی بعد دوباره سر بزن یا با پشتیبانی تماس بگیر.'
    : 'The store owner has temporarily turned this section off. Please check back later or contact support.';
}

/** کارت آمادهٔ «بخش غیرفعال» برای نمایش در پنل کاربری و مسیرها */
export function navDisabledHtml({ icon: ic = 'lock', title = '' } = {}) {
  return `<div class="card nav-disabled-card" data-nav-disabled>`
    + `<span class="nav-disabled-ic">${icon('lock')}</span>`
    + `<h3 class="section-title">${esc(title || navDisabledText())}</h3>`
    + `<p class="muted mt-s">${esc(navDisabledHint())}</p>`
    + `<div class="row row-wrap mt">`
    + `<a class="btn btn-primary" href="#/">${icon('arrow-right')} ${esc(lang() === 'fa' ? 'بازگشت به فروشگاه' : 'Back to the store')}</a>`
    + `<a class="btn btn-ghost" href="#/pages/contact">${icon(ic === 'lock' ? 'headset' : ic)} ${esc(lang() === 'fa' ? 'تماس با پشتیبانی' : 'Contact support')}</a>`
    + `</div></div>`;
}

/** عنوان پیش‌فرض یک آیتم به زبان دلخواه (برای placeholder فرم مدیر) */
export function navDefaultLabel(group, id, locale = 'fa') {
  const def = NAV_GROUPS[group]?.defaults.find((d) => d.id === id);
  if (!def) return '';
  if (def.key) {
    const dict = locale === 'en' ? defaultEn : defaultFa;
    return dict[def.key] || defaultFa[def.key] || def[locale] || '';
  }
  return def[locale] || def.fa || '';
}

/** دفاین گروه‌ها + ردیف‌های قابل ویرایش برای پنل مدیریت */
export function navAdminRows(group, settings) {
  return navGroup(group, settings).map((it) => ({
    id: it.id,
    icon: it.icon,
    emoji: it.emoji,
    show: it.show,
    on: it.on,
    fa: it.fa,
    en: it.en,
    defaultFa: navDefaultLabel(group, it.id, 'fa'),
    defaultEn: navDefaultLabel(group, it.id, 'en'),
    defIcon: NAV_GROUPS[group]?.defaults.find((d) => d.id === it.id)?.icon || 'box',
    kyc: it.kyc,
    feat: it.feat,
  }));
}
