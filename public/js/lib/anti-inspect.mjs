// ─────────────────────────────────────────────────────────────
//  محافظت سمت کاربر در برابر Inspect و برداشت کد
//  «الکتریکی و قطعات الکترونیک یاسایی تهران» — شهریور ۱۴۰۵ هجری شمسی
//
//  چه چیزهایی محافظت می‌شود؟
//   ۱) منوی کلیک راست روی عناصر عادی صفحه بسته است — اما داخل
//      input / textarea / select / contenteditable کاملاً آزاد است
//      (تایپ، انتخاب متن، کپی و چسباندن دست‌نخورده).
//   ۲) میان‌برهای DevTools: F12 · Ctrl+Shift+I (و Cmd+Opt+I در مک)
//      · Ctrl+Shift+J · Ctrl+Shift+C · Ctrl+U (نمایش سورس).
//   ۳) هشدار امنیتی برجسته (قرمز و توپر) در کنسول مرورگر.
//   ۴) کشیدن تصاویر کالا غیرفعال است (draggable="false").
//
//  این لایه «بازدارنده» است (deterrent)، نه رمزنگاری؛ هیچ تعامل سالمی
//  را نمی‌شکند: جست‌وجو، سبد خرید، فرم‌ها، چت، نقشه و لمس موبایل
//  بدون هیچ تغییری کار می‌کنند. کشیدن‌ورهاکردن پنل مدیریت (چیدمان و
//  منوها) هم دست‌نخورده است، چون عناصر draggable="true" آزاد می‌مانند.
//
//  روشن/خاموش از پنل مدیر:  #/admin/settings/security → antiInspectEnabled
//  پیش‌فرض: روشن (true) — و اگر مدیر خاموشش کند، همان لحظه برداشته می‌شود.
// ─────────────────────────────────────────────────────────────

/** هشدار امنیتی فارسی — متن رسمی و ثابت فروشگاه */
export const SECURITY_WARNING_FA = 'هشدار امنیتی فروشگاه یاسایی: هرگونه تلاش برای دستکاری، بازرسی یا کپی‌برداری غیرمجاز ثبت و پیگرد قانونی دارد.';
/** همان هشدار برای بازدیدکنندهٔ انگلیسی‌زبان */
export const SECURITY_WARNING_EN = 'Yassaei Electronics security notice: any attempt to tamper, inspect or copy this site is logged and may be prosecuted.';

/** فیلدهای ورودی و ویرایشگرها همیشه آزاد می‌مانند */
const EDITABLE_SEL = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

let enabled = true;      // وضعیت فعلی محافظت (از تنظیمات فروشگاه)
let wired = false;       // شنونده‌ها فقط یک‌بار نصب می‌شوند
let warned = false;      // هشدار کنسول یک‌بار در هر بازدید چاپ می‌شود
let getEnabled = () => true;

/** آیا هدف رویداد یک فیلد ورودی/ویرایشگر است؟ (تایپ و کپی باید آزاد بماند) */
function isEditable(node) {
  if (!node || typeof node !== 'object') return false;
  const tag = String(node.tagName || node.nodeName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable === true) return true;
  try {
    if (typeof node.closest === 'function' && node.closest(EDITABLE_SEL)) return true;
  } catch { /* درخت DOM ناقص — مهم نیست */ }
  return false;
}

/** حرفِ فشرده‌شده (با e.key یا e.code، برای پشتیبانی همهٔ مرورگرها) */
function letterOf(e) {
  const k = String(e.key || '').toLowerCase();
  if (k.length === 1) return k;
  const code = String(e.code || '');
  return code.startsWith('Key') ? code.slice(3).toLowerCase() : '';
}

/**
 * آیا این رویداد کلید یکی از میان‌برهای توسعه‌دهنده است؟
 * فقط همین ترکیب‌های مشخص؛ هیچ کلید سالمی (تایپ، Ctrl+C/V، ناوبری) بسته نمی‌شود.
 */
export function isDevToolsShortcut(e) {
  const key = String(e.key || '');
  if (key === 'F12' || String(e.code || '') === 'F12') return true;
  if (!(e.ctrlKey || e.metaKey)) return false;       // بدون Ctrl/Cmd → هیچ‌چیز
  const l = letterOf(e);
  if (!l) return false;
  if (e.shiftKey && (l === 'i' || l === 'j' || l === 'c')) return true; // Ctrl+Shift+I/J/C و Cmd+Shift+I/J/C
  if (e.altKey && (l === 'i' || l === 'j' || l === 'c')) return true;   // مک: Cmd+Opt+I/J/C
  if (!e.shiftKey && !e.altKey && l === 'u') return true;              // Ctrl+U / Cmd+U → نمایش سورس
  return false;
}

/** نشان «هشدار امنیتی» در کنسول — قرمز، توپر و خوانا */
export function printSecurityWarning() {
  try {
    console.log(
      `%c${SECURITY_WARNING_FA}`,
      'color:#ff2f2f;font-weight:900;font-size:15px;line-height:1.9;text-shadow:0 0 8px rgba(255,47,47,.45)',
    );
    console.log(`%c${SECURITY_WARNING_EN}`, 'color:#ff9a9a;font-weight:700;font-size:12px');
  } catch { /* کنسول در دسترس نیست */ }
}

/** کشیدن تصاویر کالا را غیرفعال می‌کند (روی تصاویر تازه‌رندرشده هم اعمال می‌شود) */
function markImages() {
  if (!enabled || typeof document === 'undefined') return;
  let imgs = [];
  try { imgs = [...(document.querySelectorAll ? document.querySelectorAll('img') : [])]; } catch { imgs = []; }
  for (const img of imgs) {
    try {
      if (String(img.getAttribute?.('draggable') || '') === 'true') continue; // کشیدن‌ورهاکردن پنل مدیر آزاد است
      if (typeof img.closest === 'function' && img.closest('[draggable="true"]')) continue;
      img.setAttribute('draggable', 'false');
      img.setAttribute('data-nodrag', '1');
    } catch { /* عنصر ناقص */ }
  }
}

/** برداشتن نشانه‌های خودمان وقتی مدیر محافظت را خاموش می‌کند */
function unmarkImages() {
  if (typeof document === 'undefined') return;
  let imgs = [];
  try { imgs = [...(document.querySelectorAll ? document.querySelectorAll('img[data-nodrag]') : [])]; } catch { imgs = []; }
  for (const img of imgs) {
    try { img.removeAttribute('draggable'); img.removeAttribute('data-nodrag'); } catch { /* noop */ }
  }
}

// ── شنونده‌های سراسری (فقط یک‌بار نصب می‌شوند و همیشه وضعیت را چک می‌کنند) ──
function wireOnce() {
  if (wired || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  wired = true;

  // ۱) منوی کلیک راست — بیرون از فیلدهای ورودی بسته است
  document.addEventListener('contextmenu', (e) => {
    if (!enabled || isEditable(e?.target)) return;
    try { e.preventDefault(); e.returnValue = false; } catch { /* noop */ }
  }, true);

  // ۲) میان‌برهای DevTools و نمایش سورس
  document.addEventListener('keydown', (e) => {
    if (!enabled || e?.defaultPrevented) return;
    if (isEditable(e?.target)) return;                 // در فیلدهای متنی هیچ میان‌بری بسته نمی‌شود
    if (!isDevToolsShortcut(e)) return;
    try { e.preventDefault(); e.returnValue = false; } catch { /* noop */ }
  }, true);

  // ۳) کشیدن تصاویر (کشیدن‌ورهاکردن پنل مدیر با draggable="true" آزاد می‌ماند)
  document.addEventListener('dragstart', (e) => {
    if (!enabled) return;
    const el = e?.target;
    if (String(el?.tagName || '').toUpperCase() !== 'IMG') return;
    try { if (typeof el.closest === 'function' && el.closest('[draggable="true"]')) return; } catch { /* noop */ }
    try { e.preventDefault(); } catch { /* noop */ }
  }, true);

  // ۴) تصاویری که بعداً (کاتالوگ/گالری/چت) رندر می‌شوند
  try {
    if (typeof MutationObserver === 'function' && typeof document.body !== 'undefined' && document.body) {
      const ob = new MutationObserver(() => {
        clearTimeout(ob._ysT);
        ob._ysT = setTimeout(() => markImages(), 250);
      });
      ob.observe(document.body, { childList: true, subtree: true });
    }
  } catch { /* noop */ }

  // ۵) تصاویر اولیه — همین حالا و بعد از کامل‌شدن DOM
  markImages();
  if (typeof document.readyState === 'string' && document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', () => markImages(), { once: true });
  }
}

/**
 * وضعیت محافظت را از تنظیمات فروشگاه می‌خواند و اعمال/برداشته می‌کند.
 * خروجی: true اگر محافظت فعال باشد.
 */
export function refreshAntiInspect() {
  let next = true;
  try { next = getEnabled() !== false; } catch { next = true; }   // پیش‌فرض: روشن
  enabled = next;
  if (enabled) {
    if (!warned) { warned = true; printSecurityWarning(); }
    markImages();
  } else {
    unmarkImages();
  }
  return enabled;
}

/**
 * راه‌اندازی محافظت.
 * @param {() => boolean} enabledGetter خواندن کلید `settings.security.antiInspectEnabled`
 */
export function initAntiInspect(enabledGetter) {
  if (typeof enabledGetter === 'function') getEnabled = enabledGetter;
  wireOnce();
  return refreshAntiInspect();
}

/** فقط برای تست: وضعیت فعلی */
export const antiInspectActive = () => enabled;
