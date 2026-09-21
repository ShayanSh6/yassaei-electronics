// ─────────────────────────────────────────────────────────────
//  ابزارهای فروش (settings.salesTools) — سمت کلاینت
//
//  نوار خرید چسبان، مشاورهٔ واتساپ، پیش‌فاکتور، نوار ارسال رایگان و
//  اطلاعات کارت‌به‌کارت. هر قابلیت با یک کلید در پنل مدیریت
//  (تنظیمات → ابزارهای فروش) روشن/خاموش می‌شود و با خاموش‌شدن،
//  بلافاصله از سایت مشتری حذف می‌شود.
//
//  قاعدهٔ «پیش‌فرض روشن»: اگر تنظیمات (مثلاً در seed آفلاین قدیمی) کلید را
//  نداشته باشد، قابلیت روشن فرض می‌شود (`!== false`) تا هیچ رگرسیونی رخ ندهد.
// ─────────────────────────────────────────────────────────────
import { S, store, ship } from '../state.mjs';
import { raw, latinDigits, faDigits, locale } from './dom.mjs';

/** تنظیمات خام بخش ابزارهای فروش */
export const salesCfg = () => (S.settings?.salesTools && typeof S.settings.salesTools === 'object' ? S.settings.salesTools : {});

/** آیا قابلیت روشن است؟ (کلیدهای *Enabled — پیش‌فرض روشن) */
export const toolOn = (key) => salesCfg()[key] !== false;

/** پاک‌سازی شمارهٔ تلفن به رقم لاتین (بدون فاصله/خط تیره/+) */
const digitsOnly = (v) => latinDigits(String(v ?? '')).replace(/\D+/g, '');

/**
 * شمارهٔ واتساپ به فرمت بین‌المللی wa.me (بدون + و صفر اول)
 * اولویت: شمارهٔ اختصاصی ابزارهای فروش → واتساپ فروشگاه → شبکه‌های اجتماعی →
 * موبایل دوم فروشگاه → تلفن فروشگاه.
 */
export function whatsappNumber() {
  const st = store();
  const cands = [salesCfg().whatsappPhone, st.whatsapp, st.socials?.whatsapp, st.phone2, st.phone];
  for (const c of cands) {
    const n = normalizeIntl(c);
    if (n) return n;
  }
  return '';
}

/** 0098912… / 09xx… / 9xx… / +98… → 98912… */
export function normalizeIntl(v) {
  let s = digitsOnly(v);
  if (!s) return '';
  if (s.startsWith('0098')) s = s.slice(2);
  else if (s.startsWith('0')) s = '98' + s.slice(1);
  else if (s.length === 10 && s.startsWith('9')) s = '98' + s;
  return s.length >= 7 && s.length <= 15 ? s : '';
}

/** لینک گفت‌وگوی واتساپ با متن آماده؛ در نبود شماره، رشتهٔ خالی */
export function whatsappLink(text = '') {
  const n = whatsappNumber();
  if (!n) return '';
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${n}${q}`;
}

/** آیکون واتساپ (در اسپرایت اصلی وجود ندارد؛ inline و امن) */
export const whatsappIcon = (cls = '') => raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15.03L2 22l5.1-1.5A9.93 9.93 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.02.9.93-2.95-.2-.31a8.2 8.2 0 1 1 6.79 3.69Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.35-2.93c-.25-.44.25-.4.72-1.33.08-.16.04-.3-.02-.43l-.76-1.82c-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.66.3-.23.25-.86.85-.86 2.06s.88 2.4 1 2.56c.13.16 1.74 2.66 4.22 3.73 1.56.68 2.17.74 2.95.62.48-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.11-.22-.17-.47-.29Z"/></svg>`);

/** اطلاعات بانکی برای نمایش؛ null یعنی قابلیت خاموش یا اطلاعاتی ثبت نشده */
export function bankDetails() {
  if (!toolOn('bankDetailsEnabled')) return null;
  const bd = salesCfg().bankDetails;
  if (!bd || typeof bd !== 'object') return null;
  const cardNumber = digitsOnly(bd.cardNumber);
  const iban = String(bd.iban || '').replace(/\s+/g, '').toUpperCase();
  const owner = String(bd.owner || '').trim();
  const bankName = String(bd.bankName || '').trim();
  if (!cardNumber && !iban) return null;
  return { cardNumber, iban, owner, bankName };
}

/** آستانهٔ ارسال رایگان برای نوار سبد: مقدار اختصاصی ابزارهای فروش یا «ارسال رایگان از» بخش ارسال */
export function freeShipThreshold() {
  const own = Number(salesCfg().freeShippingThreshold) || 0;
  if (own > 0) return own;
  return Number(ship().freeOver) || 0;
}

/** ۶۰۳۷۹۹۱۲۳۴۵۶۷۸۹۰ → ۶۰۳۷-۹۹۱۲-۳۴۵۶-۷۸۹۰ (ارقام بر اساس زبان) */
export function fmtCard(card) {
  const d = digitsOnly(card);
  const grouped = d.replace(/(\d{4})(?=\d)/g, '$1-');
  return locale() === 'fa' ? faDigits(grouped) : grouped;
}

/** IR + ۲۴ رقم → IR12 0170 0000 … (همیشه ارقام لاتین؛ برای کپی/واریز) */
export function fmtIban(iban) {
  const s = latinDigits(String(iban || '')).replace(/\s+/g, '').toUpperCase();
  return s.replace(/(.{4})(?=.)/g, '$1 ');
}

/** تبدیل میلادی → شمسی (الگوریتم استاندارد؛ بدون وابستگی به Intl) */
export function toJalali(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  let gy = d.getFullYear(); const gm = d.getMonth() + 1; const gd = d.getDate();
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

const JMONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** تاریخ شمسی خوانا: «۲۸ شهریور ۱۴۰۵» یا عددی «۱۴۰۵/۰۶/۲۸» */
export function jalaliDate(date = new Date(), { numeric = false } = {}) {
  const { jy, jm, jd } = toJalali(date);
  const two = (n) => String(n).padStart(2, '0');
  const s = numeric ? `${jy}/${two(jm)}/${two(jd)}` : `${jd} ${JMONTHS[jm - 1]} ${jy}`;
  return locale() === 'fa' ? faDigits(s) : s;
}

/** شمارهٔ پیش‌فاکتور خودکار: PF-14050628-K3X9Z (تاریخ شمسی + دنبالهٔ یکتا) */
export function proformaNumber(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const { jy, jm, jd } = toJalali(d);
  const two = (n) => String(n).padStart(2, '0');
  const seq = d.getTime().toString(36).toUpperCase().slice(-5);
  return `PF-${jy}${two(jm)}${two(jd)}-${seq}`;
}
