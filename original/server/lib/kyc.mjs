// ─────────────────────────────────────────────────────────────
//  قاعدهٔ احراز هویت (KYC) هنگام ثبت سفارش — سمت سرور
//
//  پیش‌فرض «غیرفعال» است: هیچ اجباری برای احراز هویت جهت ثبت سفارش
//  وجود ندارد. مدیر فروشگاه از پنل مدیریت قاعده را انتخاب می‌کند و این
//  ماژول همان قاعده را روی هر سفارش اعمال می‌کند.
//
//  ⚠️ نسخهٔ کلاینتی همین منطق در public/js/lib/kyc.mjs است (برای
//  راهنمایی کاربر پیش از ثبت سفارش). هر دو را هم‌زمان تغییر بده.
// ─────────────────────────────────────────────────────────────
import { KYC_CONDITIONS } from '../defaults.mjs';

export const KYC_CONDITION_IDS = KYC_CONDITIONS.map((c) => c.id);

/** روش‌های پرداخت اقساطی که بدون احراز هویت پذیرفته نمی‌شوند */
export const KYC_INSTALLMENT_METHODS = ['snapppay', 'azki', 'digipay'];

export const KYC_DEFAULT_MIN_AMOUNT = 50000000;

/**
 * خواندن تنظیمات KYC از settings.orders.kyc
 * (کلیدهای تخت kycRequired/kycCondition/kycMinAmount هم پذیرفته می‌شوند
 *  تا هیچ شکلی از ذخیره‌سازی نادیده گرفته نشود)
 */
export function kycConfig(orders = {}) {
  const o = orders || {};
  const nested = o.kyc && typeof o.kyc === 'object' ? o.kyc : {};
  const rawCondition = nested.condition ?? o.kycCondition ?? 'disabled';
  const condition = KYC_CONDITION_IDS.includes(String(rawCondition)) ? String(rawCondition) : 'disabled';
  const rawRequired = nested.required ?? o.kycRequired;
  const required = rawRequired === undefined ? false : !!rawRequired;
  const minAmount = Number(nested.minAmount ?? o.kycMinAmount ?? KYC_DEFAULT_MIN_AMOUNT);
  const message = String(nested.message ?? o.kycMessage ?? '').slice(0, 200);
  // کلید اصلی سیستم احراز هویت (kycEnabled) — پیش‌فرض خاموش
  const rawEnabled = nested.enabled ?? o.kycEnabled;
  const enabled = rawEnabled === undefined ? false : !!rawEnabled;
  // نمایش دکمهٔ احراز هویت در پنل کاربری (kycShowInNav) — پیش‌فرض مخفی
  const rawShow = nested.showInNav ?? o.kycShowInNav;
  const showInNav = rawShow === undefined ? false : !!rawShow;
  return {
    enabled,
    showInNav,
    required,
    condition,
    minAmount: Number.isFinite(minAmount) && minAmount >= 0 ? Math.floor(minAmount) : KYC_DEFAULT_MIN_AMOUNT,
    message,
    // «فعال» یعنی سیستم روشن است و قاعده‌ای انتخاب شده یا کلید اجبار روشن است
    active: enabled && (required || condition !== 'disabled'),
  };
}

/** نسخهٔ عمومی (بدون دادهٔ حساس) برای ارسال به کلاینت در /api/bootstrap */
export function publicKyc(orders = {}) {
  const c = kycConfig(orders);
  return {
    enabled: c.enabled, showInNav: c.showInNav,
    required: c.required, condition: c.condition, minAmount: c.minAmount, message: c.message, active: c.active,
  };
}

/**
 * آیا این سفارش به احراز هویت تأییدشده نیاز دارد؟
 * @param {object} cfg       خروجی kycConfig()
 * @param {object} ctx       { user, total, paymentMethod, isFirstOrder }
 * @returns {{ required: boolean, reason: string, message: string }}
 */
export function kycRequirement(cfg, { user = null, total = 0, paymentMethod = '', isFirstOrder = false } = {}) {
  const none = { required: false, reason: '', message: '' };
  if (!cfg || !cfg.active) return none;
  if (user && user.kycStatus === 'approved') return none;

  const isInstallment = KYC_INSTALLMENT_METHODS.includes(String(paymentMethod || ''));
  let reason = '';
  if (cfg.condition === 'all') reason = 'all';
  else if (cfg.condition === 'amount' && Number(total) >= cfg.minAmount) reason = 'amount';
  else if (cfg.condition === 'installments' && isInstallment) reason = 'installments';
  else if (cfg.condition === 'first_order' && isFirstOrder) reason = 'first_order';
  // کلید «اجباری» بدون انتخاب قاعده = اجبار برای همهٔ سفارش‌ها
  else if (cfg.required && cfg.condition === 'disabled') reason = 'all';

  if (!reason) return none;
  return { required: true, reason, message: cfg.message || defaultMessage(reason, cfg) };
}

function defaultMessage(reason, cfg) {
  const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
  const base = 'ثبت این سفارش نیازمند تأیید احراز هویت است.';
  const hint = ' از «حساب کاربری ← احراز هویت (KYC)» مدارک خود را ارسال کنید.';
  if (reason === 'installments') return `خرید اقساطی (اسنپ‌پی، ازکی‌وام و دیجی‌پی) نیازمند تکمیل و تأیید احراز هویت است.${hint}`;
  if (reason === 'amount') return `${base} مبلغ این سفارش از ${fa(cfg.minAmount)} تومان بیشتر است.${hint}`;
  if (reason === 'first_order') return `${base} برای اولین خرید، هویت شما باید تأیید شود.${hint}`;
  return `${base}${hint}`;
}

/** برچسب فارسی قاعده (برای لاگ و پیام‌ها) */
export function kycConditionLabel(id) {
  return KYC_CONDITIONS.find((c) => c.id === id)?.fa || 'غیرفعال (بدون اجبار)';
}
