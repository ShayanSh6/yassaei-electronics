// ─────────────────────────────────────────────────────────────
//  ابزارهای DOM: قالب امن (auto-escape)، آیکون، فرمت اعداد و تاریخ
// ─────────────────────────────────────────────────────────────
const RAW = Symbol('raw');
// نشانگرهای «رشتهٔ مطمئن»: از join و الحاق رشته هم زنده بیرون می‌آیند
const S1 = '\u0001', S2 = '\u0002';
const stripMarks = (s) => s.replace(/[\u0001\u0002]/g, '');

function trusted(str) { return S1 + stripMarks(String(str ?? '')) + S2; }

// ── سد سراسری: نشانگرهای کنترلی هرگز به DOM نرسند ─────────────
// هر انتساب innerHTML / insertAdjacentHTML از این پس پاک‌سازی می‌شود؛
// این همان باگ «جعبه‌های عجیب/لبهٔ بریده» بود که در همهٔ نسخه‌ها می‌دیدیم.
try {
  if (typeof Element !== 'undefined') {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (d && d.set && d.configurable !== false) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: d.enumerable,
        get() { return d.get.call(this); },
        set(v) { d.set.call(this, typeof v === 'string' && (v.includes(S1) || v.includes(S2)) ? stripMarks(v) : v); },
      });
    }
    const ia = Element.prototype.insertAdjacentHTML;
    if (ia) Element.prototype.insertAdjacentHTML = function (pos, v) {
      return ia.call(this, pos, typeof v === 'string' && (v.includes(S1) || v.includes(S2)) ? stripMarks(v) : v);
    };
  }
} catch { /* محیط‌های بدون DOM واقعی */ }

/** خروجی خام (بدون escape) — فقط برای قطعات مطمئن و داخلی */
export const raw = (s) => trusted(s);

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export function esc(v) {
  if (v === null || v === undefined || v === false) return trusted('');
  if (typeof v === 'object' && v !== null && v[RAW] !== undefined) return v[RAW];
  const s = String(v);
  // خروجی قالب‌های h (یا الحاق آن‌ها): قبلاً امن شده، دوباره escape نمی‌کنیم
  if (s.includes(S1) || s.includes(S2)) return stripMarks(s);
  return trusted(s.replace(/[&<>"'`]/g, (c) => ESC_MAP[c]));
}

/** قالب HTML با escape خودکار همهٔ مقادیر درج‌شده */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (Array.isArray(v)) out += v.map((x) => esc(x)).join('');
    else out += esc(v);
    out += strings[i + 1];
  }
  return trusted(out);
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const byId = (id) => document.getElementById(id);

/** ساخت المان با ویژگی‌ها */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function icon(name, cls = '') {
  return raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`);
}

/** آیکون دسته‌بندی بر اساس glyph */
const GLYPH_ICON = {
  cable: 'cable', adapter: 'plug', case: 'shield', glass: 'layers', powerbank: 'battery',
  battery: 'battery', dongle: 'plug', speaker: 'speaker', audio: 'headset', wearable: 'watch',
  content: 'camera', gaming: 'zap', car: 'truck', light: 'light', mics: 'mic', misc: 'box',
  watch: 'watch', phone: 'phone',
  chip: 'chip', solder: 'solder', tools: 'wrench', fan: 'fan', tv: 'tv', keyboard: 'keyboard',
  measure: 'chart', network: 'globe', parts: 'chip',
};
export const catIcon = (glyph) => GLYPH_ICON[glyph] || 'box';

// ── فرمت اعداد و تاریخ ─────────────────────────────────────
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export function faDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
}
export function latinDigits(s) {
  return String(s).replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

let LOCALE = 'fa';
export function setLocale(l) { LOCALE = l === 'en' ? 'en' : 'fa'; }
export const locale = () => LOCALE;

export function fmtNum(n) {
  const v = Number(n) || 0;
  const s = new Intl.NumberFormat(LOCALE === 'fa' ? 'fa-IR' : 'en-US').format(v);
  return s;
}
/** شمارهٔ تلفن: بدون گروه‌بندی هزارگان و با حفظ صفر اول */
// فقط http/https مجاز: جلوگیری از javascript:/data: در لینک‌های تنظیم‌شده توسط ادمین
export function safeHref(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}
export function fmtTel(v) {
  const s0 = String(v ?? '').trim();
  if (!s0) return '';
  // شمارهٔ ثابت: ۰۲۱-۷۷۹۰۶۶۶۷ ؛ موبایل: ۰۹۱۲ … (گروه‌بندی خوانا)
  const s = /^(0\d{2})(\d{4})(\d{4})$/.test(s0) ? s0.replace(/^(0\d{2})(\d{4})(\d{4})$/, '$1-$2-$3')
        : /^(09\d{2})(\d{3})(\d{4})$/.test(s0) ? s0.replace(/^(09\d{2})(\d{3})(\d{4})$/, '$1 $2 $3') : s0;
  if (LOCALE === 'fa') return s.replace(/\d/g, (x) => FA_DIGITS[+x]);
  return s;
}
export function fmtMoney(n, { withUnit = true } = {}) {
  const v = Math.round(Number(n) || 0);
  const s = new Intl.NumberFormat(LOCALE === 'fa' ? 'fa-IR' : 'en-US').format(v);
  if (!withUnit) return s;
  return raw(`${s} <span class="pc-cur">${LOCALE === 'fa' ? 'تومان' : 'Toman'}</span>`);
}
export function fmtMoneyPlain(n) {
  return new Intl.NumberFormat(LOCALE === 'fa' ? 'fa-IR' : 'en-US').format(Math.round(Number(n) || 0));
}
export function fmtDate(iso, { time = true, short = false } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    const opt = { calendar: LOCALE === 'fa' ? 'persian' : 'gregory' };
    if (short) return d.toLocaleDateString(LOCALE === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', ...opt });
    const date = d.toLocaleDateString(LOCALE === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', ...opt });
    if (!time) return date;
    const t = d.toLocaleTimeString(LOCALE === 'fa' ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${t}`;
  } catch { return d.toISOString().slice(0, 16).replace('T', ' '); }
}
export function fmtDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(LOCALE === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', calendar: LOCALE === 'fa' ? 'persian' : 'gregory' });
  } catch { return iso.slice(0, 10); }
}
export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  const f = (n, unit) => {
    try {
      return new Intl.RelativeTimeFormat(LOCALE === 'fa' ? 'fa' : 'en', { numeric: 'auto' }).format(-n, unit);
    } catch { return `${n} ${unit}`; }
  };
  if (s < 60) return f(s, 'second');
  if (s < 3600) return f(Math.floor(s / 60), 'minute');
  if (s < 86400) return f(Math.floor(s / 3600), 'hour');
  if (s < 2592000) return f(Math.floor(s / 86400), 'day');
  if (s < 31536000) return f(Math.floor(s / 2592000), 'month');
  return f(Math.floor(s / 31536000), 'year');
}

/** فاصلهٔ زمانی تا یک تاریخ (برای شمارش معکوس) */
export function countdown(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return LOCALE === 'fa' ? 'پایان یافت' : 'Expired';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return LOCALE === 'fa' ? `${faDigits(d)} روز و ${faDigits(h)} ساعت` : `${d}d ${h}h`;
  const pad = (x) => String(x).padStart(2, '0');
  const t = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return LOCALE === 'fa' ? faDigits(t) : t;
}

export function stars(rating, size = '') {
  const r = Math.round(Number(rating) || 0);
  let out = '<span class="pc-stars">';
  for (let i = 1; i <= 5; i++) out += `<svg class="ic ${i <= r ? '' : 'off'} ${size}" aria-hidden="true"><use href="#i-star"/></svg>`;
  return raw(out + '</span>');
}

export function pct(n) { return `${fmtNum(Math.round(Number(n) || 0))}٪`; }

/** تبدیل متن به لینک‌های قابل کلیک (ایمن) */
export function linkify(text) {
  const safe = esc(text);
  return raw(safe.replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer nofollow">${m}</a>`));
}

export function debounce(fn, ms = 260) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function throttle(fn, ms = 200) {
  let last = 0; let timer = null;
  return (...a) => {
    const now = Date.now();
    const left = ms - (now - last);
    if (left <= 0) { last = now; fn(...a); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...a); }, left); }
  };
}

/** خواندن فایل به‌صورت DataURL (برای آپلود) */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      // Auto-compress and convert images to webp to save bandwidth and storage
      if (file.type && file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const img = new Image();
        img.onload = () => {
          // Max dimension 1600px
          let w = img.width;
          let h = img.height;
          const maxDim = 1600;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else { w = Math.round((w * maxDim) / h); h = maxDim; }
          }
          const cvs = document.createElement('canvas');
          cvs.width = w; cvs.height = h;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(cvs.toDataURL('image/webp', 0.85));
        };
        img.onerror = () => resolve(String(r.result)); // fallback
        img.src = String(r.result);
      } else {
        resolve(String(r.result)); // fallback for PDF/SVG etc
      }
    };
    r.onerror = () => reject(new Error('read-failed'));
    r.readAsDataURL(file);
  });
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) { reject(e); }
  });
}

/** اعمال اندازه‌های پویا از data-w/data-h (جایگزین style="" به‌خاطر CSP) */
export function applyDyn(root = document) {
  root.querySelectorAll('[data-w]').forEach((n) => { n.style.width = n.dataset.w; });
  root.querySelectorAll('[data-h]').forEach((n) => { n.style.height = n.dataset.h; });
  root.querySelectorAll('[data-maxw]').forEach((n) => { n.style.maxWidth = n.dataset.maxw; });
  // جایگزینی‌های آزاد مدیر: فقط text-node و برچسب‌های قابل‌مشاهده،
  // نه مقدار فرم‌ها/کدها؛ بنابراین متن سفارشی هم XSS-safe و هم پایدار است.
  const replacements = globalThis.__textReplacements?.[document.documentElement.lang === 'en' ? 'en' : 'fa'] || {};
  const pairs = Object.entries(replacements).filter(([from, to]) => from && typeof to === 'string').sort((a, b) => b[0].length - a[0].length);
  if (!pairs.length) return;
  const replaceText = (value) => pairs.reduce((out, [from, to]) => out.split(from).join(to), value);
  const walker = document.createTreeWalker(root, globalThis.NodeFilter?.SHOW_TEXT || 4);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const n of nodes) {
    const tag = n.parentElement?.tagName;
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE'].includes(tag)) continue;
    const next = replaceText(n.nodeValue || '');
    if (next !== n.nodeValue) n.nodeValue = next;
  }
  root.querySelectorAll('[placeholder], [title], [aria-label]').forEach((n) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(n.tagName)) {
      for (const attr of ['placeholder', 'title', 'aria-label']) if (n.hasAttribute(attr)) n.setAttribute(attr, replaceText(n.getAttribute(attr)));
    }
  });
}

/** اسکرول نرم به بالا */
export function scrollTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}
