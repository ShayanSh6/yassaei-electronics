// ─────────────────────────────────────────────────────────────
//  قاعدهٔ احراز هویت (KYC) هنگام ثبت سفارش — سمت کلاینت
//
//  فقط برای «راهنمایی کاربر» است (نمایش هشدار، غیرفعال‌کردن روش پرداخت
//  اقساطی). تصمیم نهایی و اجرایی با سرور است: server/lib/kyc.mjs
//  ⚠️ هر تغییری در منطق، باید هم‌زمان در هر دو فایل اعمال شود.
// ─────────────────────────────────────────────────────────────

export const KYC_CONDITIONS = ['disabled', 'all', 'amount', 'installments', 'first_order'];
export const KYC_INSTALLMENT_METHODS = ['snapppay', 'azki', 'digipay'];
export const KYC_DEFAULT_MIN_AMOUNT = 50000000;

/** نرمال‌سازی تنظیمات KYC (هم شکل تودرتو orders.kyc و هم کلیدهای تخت) */
export function kycConfig(orders = {}) {
  const o = orders || {};
  const nested = o.kyc && typeof o.kyc === 'object' ? o.kyc : {};
  const rawCondition = nested.condition ?? o.kycCondition ?? 'disabled';
  const condition = KYC_CONDITIONS.includes(String(rawCondition)) ? String(rawCondition) : 'disabled';
  const rawRequired = nested.required ?? o.kycRequired;
  const required = rawRequired === undefined ? false : !!rawRequired;
  const minAmount = Number(nested.minAmount ?? o.kycMinAmount ?? KYC_DEFAULT_MIN_AMOUNT);
  // کلید اصلی سیستم (kycEnabled) — پیش‌فرض خاموش
  // خاموش یعنی هیچ اجباری نیست و دکمهٔ احراز هویت هم در پنل کاربری مخفی است.
  const rawEnabled = nested.enabled ?? o.kycEnabled;
  const enabled = rawEnabled === undefined ? false : !!rawEnabled;
  // نمایش دکمهٔ احراز هویت در منوی کاربر (kycShowInNav) — پیش‌فرض مخفی
  const rawShow = nested.showInNav ?? o.kycShowInNav;
  const showInNav = rawShow === undefined ? false : !!rawShow;
  return {
    enabled,
    showInNav,
    required,
    condition,
    minAmount: Number.isFinite(minAmount) && minAmount >= 0 ? Math.floor(minAmount) : KYC_DEFAULT_MIN_AMOUNT,
    message: String(nested.message ?? o.kycMessage ?? ''),
    active: enabled && (required || condition !== 'disabled'),
  };
}

/**
 * آیا کاربر با این وضعیت، برای این سفارش به احراز هویت نیاز دارد؟
 * @returns {{ required: boolean, reason: string }}
 */
export function kycRequirement(cfg, { kycStatus = 'none', total = 0, paymentMethod = '', isFirstOrder = false } = {}) {
  if (!cfg || !cfg.active) return { required: false, reason: '' };
  if (kycStatus === 'approved') return { required: false, reason: '' };
  const isInstallment = KYC_INSTALLMENT_METHODS.includes(String(paymentMethod || ''));
  let reason = '';
  if (cfg.condition === 'all') reason = 'all';
  else if (cfg.condition === 'amount' && Number(total) >= cfg.minAmount) reason = 'amount';
  else if (cfg.condition === 'installments' && isInstallment) reason = 'installments';
  else if (cfg.condition === 'first_order' && isFirstOrder) reason = 'first_order';
  else if (cfg.required && cfg.condition === 'disabled') reason = 'all';
  return reason ? { required: true, reason } : { required: false, reason: '' };
}

/** آیا این روش پرداخت به دلیل قاعدهٔ KYC باید قفل شود؟ */
export function kycBlocksMethod(cfg, { kycStatus = 'none', paymentMethod = '', total = 0 } = {}) {
  if (!cfg || !cfg.active) return false;
  if (kycStatus === 'approved') return false;
  // روش‌های اقساطی فقط وقتی قفل می‌شوند که قاعده به آن‌ها مربوط باشد
  if (!KYC_INSTALLMENT_METHODS.includes(String(paymentMethod || ''))) return false;
  if (cfg.condition === 'installments' || cfg.condition === 'all') return true;
  if (cfg.condition === 'amount' && Number(total) >= cfg.minAmount) return true;
  if (cfg.required && cfg.condition === 'disabled') return true;
  return false;
}

/** توضیح کوتاه فارسی/انگلیسی قاعدهٔ فعال (برای نمایش در رابط) */
export function kycRuleText(cfg, { fa = true, minAmountLabel = '' } = {}) {
  const amount = minAmountLabel || Number(cfg?.minAmount || KYC_DEFAULT_MIN_AMOUNT).toLocaleString(fa ? 'fa-IR' : 'en-US');
  if (!cfg?.active) return fa ? 'احراز هویت برای ثبت سفارش اجباری نیست.' : 'KYC is not required to place an order.';
  switch (cfg.condition) {
    case 'all': return fa ? 'احراز هویت برای ثبت همهٔ سفارش‌ها اجباری است.' : 'KYC is required for every order.';
    case 'amount': return fa ? `برای سفارش‌های بالای ${amount} تومان، احراز هویت اجباری است.` : `KYC is required for orders above ${amount} Toman.`;
    case 'installments': return fa ? 'احراز هویت فقط برای خرید اقساطی (اسنپ‌پی، ازکی‌وام، دیجی‌پی) اجباری است.' : 'KYC is required only for installment payments (SnappPay, Azki, DigiPay).';
    case 'first_order': return fa ? 'احراز هویت فقط برای اولین خرید شما اجباری است.' : 'KYC is required only for your first order.';
    default: return fa ? 'احراز هویت برای ثبت همهٔ سفارش‌ها اجباری است.' : 'KYC is required for every order.';
  }
}
