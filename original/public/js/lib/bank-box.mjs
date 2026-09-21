// ─────────────────────────────────────────────────────────────
//  کادر کارت‌به‌کارت / شبا با کپی یک‌کلیکی («کپی شد ✓»)
//  استفاده: صفحهٔ پرداخت (#/pay/:id) و پایان خرید (#/checkout/done/:id)
//  داده از lib/sales.mjs → bankDetails() می‌آید (null = قابلیت خاموش/خالی).
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtMoney, fmtNum, latinDigits } from './dom.mjs';
import { t } from '../i18n.mjs';
import { fmtCard, fmtIban } from './sales.mjs';

/**
 * @param {{cardNumber:string, iban:string, owner:string, bankName:string}} bd
 * @param {{amount?:number, orderCode?:string, compact?:boolean}} opts
 */
export function bankBox(bd, { amount = 0, orderCode = '', compact = false } = {}) {
  if (!bd) return '';
  const row = (key, label, display, copyValue, fa = false) => h`
    <div class="bank-row" data-bank-row="${key}">
      <span class="k">${label}</span>
      <span class="v ${fa ? 'fa' : ''}">${display}</span>
      <button type="button" class="btn btn-ghost bank-copy" data-copy="${copyValue}" data-copy-label="${label}" aria-label="${t('pay.card.copy')} ${label}">${icon('copy')} <span>${t('pay.card.copy')}</span></button>
    </div>`;
  return h`
    <div class="bank-box mt" data-bank-box>
      <div class="bank-box-title">${icon('card')} ${t('pm.card')}${bd.bankName ? h` <span class="muted small">· ${bd.bankName}</span>` : ''}</div>
      ${amount > 0 ? h`<div class="row row-between"><span class="small muted">${t('pay.card.amount')}</span><span class="bank-amount">${fmtMoney(amount)}</span></div>` : ''}
      ${bd.cardNumber ? row('card', t('pay.card.cardNumber'), fmtCard(bd.cardNumber), latinDigits(bd.cardNumber)) : ''}
      ${bd.iban ? row('iban', t('pay.card.iban'), fmtIban(bd.iban), bd.iban) : ''}
      ${bd.owner ? row('owner', t('pay.card.owner'), bd.owner, bd.owner, true) : ''}
      ${!compact && orderCode ? h`<p class="bank-hint">${icon('info')} ${t('pay.card.orderCode')}: <span class="mono b">${orderCode}</span></p>` : ''}
      ${amount > 0 && !compact ? h`<p class="bank-hint">${t('pay.card.amount')}: <span class="mono b">${fmtNum(amount)}</span> ${t('common.toman')}</p>` : ''}
    </div>`;
}

/** فعال‌سازی دکمه‌های کپی داخل ریشهٔ داده‌شده (ایمن در برابر فراخوانی چندباره) */
export function wireBankCopy(root) {
  if (!root || root.__bankCopyWired) return;
  root.__bankCopyWired = true;
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('.bank-copy[data-copy]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    const value = btn.dataset.copy || '';
    try {
      const { copyText } = await import('./dom.mjs');
      await copyText(value);
      const label = btn.querySelector('span');
      const prev = label ? label.textContent : '';
      btn.classList.add('copied');
      if (label) label.textContent = t('pay.card.copied');
      const { toastSuccess } = await import('../ui.mjs');
      toastSuccess(`${btn.dataset.copyLabel || ''} ${t('pay.card.copied')}`.trim(), { timeout: 1800 });
      setTimeout(() => { btn.classList.remove('copied'); if (label) label.textContent = prev; }, 2200);
    } catch {
      const { toastError } = await import('../ui.mjs');
      toastError(t('err.generic'));
    }
  });
}
