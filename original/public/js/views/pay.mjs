// ─────────────────────────────────────────────────────────────
//  صفحهٔ پرداخت — #/pay/:id
//  • درگاه/اقساطی: شبیه‌ساز درگاه در حالت آزمایشی
//  • کارت‌به‌کارت / واریز بانکی: کادر شمارهٔ کارت، شبا و نام صاحب حساب با کپی یک‌کلیکی
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtNum, fmtMoney, fmtDate, applyDyn } from '../lib/dom.mjs';
import { t } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, store, refreshMe, loadCart } from '../state.mjs';
import { emptyState } from '../components.mjs';
import { toastSuccess, toastApiError, withBusy, fireConfetti } from '../ui.mjs';
import { navigate } from '../router.mjs';
import { act } from '../actions.mjs';
import { bankDetails, whatsappLink, whatsappIcon } from '../lib/sales.mjs';
import { bankBox, wireBankCopy } from '../lib/bank-box.mjs';

const PROVIDER_NAMES = { snapppay: 'اسنپ‌پی', azki: 'ازکی‌وام', digipay: 'دیجی‌پی' };

export async function render(ctx) {
  const id = ctx.params.id;
  let order = null;
  try {
    const r = await api.get(`/api/me/orders/${encodeURIComponent(id)}`);
    order = r.order;
  } catch { /* noop */ }
  if (!order) return emptyState({ icon: 'alert', title: t('err.notFound'), action: { href: '#/account/orders', label: t('acc.orders') } });
  if (order.payment?.status === 'paid') {
    return h`<div class="card t-center">
      <span class="empty-ic">${icon('check-circle')}</span>
      <h2 class="mt-s">${t('checkout.paymentSuccess')}</h2>
      <a class="btn btn-primary mt" href="#/checkout/done/${order.id}">${t('acc.trackOrder')}</a>
    </div>`;
  }
  const payable = order.payable ?? order.total;
  const method = order.payment?.method || 'gateway';
  const isInstallment = Object.prototype.hasOwnProperty.call(PROVIDER_NAMES, method);
  const providerName = PROVIDER_NAMES[method] || '';
  const bd = bankDetails();

  // ── کارت‌به‌کارت / واریز بانکی ─────────────────────────────
  if (method === 'card') {
    const shop = store();
    const waText = `سلام، رسید واریز سفارش ${order.code} به مبلغ ${fmtNum(payable)} تومان را ارسال می‌کنم.`;
    const wa = whatsappLink(waText);
    return h`
      <div class="card">
        <div class="t-center">
          <span class="pwa-ic center" data-h="64px" data-w="64px">${icon('card')}</span>
          <h1 class="mt-s">${t('pay.card.title')}</h1>
          <p class="muted">${t('acc.orderCode')}: <span class="mono b">${order.code}</span></p>
          <div class="buy-price center"><span class="buy-now">${fmtMoney(payable)}</span></div>
          <p class="notice notice-info">${icon('info')}<span>${t('pay.card.hint')}</span></p>
        </div>
        ${bd ? bankBox(bd, { amount: payable, orderCode: order.code }) : h`
          <div class="notice notice-warn mt">${icon('alert')}<span>${t('pay.card.pending')} ${shop.phone ? h`— ${t('pdp.callStore')}: <bdi class="mono">${shop.phone}</bdi>` : ''}</span></div>`}
        <div class="row center row-wrap mt">
          ${wa ? h`<a class="btn btn-whatsapp btn-lg" href="${wa}" target="_blank" rel="noopener noreferrer">${whatsappIcon()} ${t('pay.card.sendReceipt')}</a>` : ''}
          <a class="btn btn-primary btn-lg" href="#/checkout/done/${order.id}">${icon('check')} ${t('acc.trackOrder')}</a>
        </div>
        <div class="divider"></div>
        <div class="row row-between small muted">
          <span>${t('acc.orderDate')}: ${fmtDate(order.createdAt)}</span>
          <span>${t('common.items')}: ${fmtNum(order.items?.length || 0)}</span>
        </div>
      </div>`;
  }

  // ── درگاه بانکی / اقساطی (شبیه‌ساز) ──────────────────────
  return h`
    <div class="card">
      <div class="t-center">
        <span class="pwa-ic center" data-h="64px" data-w="64px">${icon('card')}</span>
        <h1 class="mt-s">${isInstallment ? 'پرداخت اقساطی از طریق ' + providerName : t('common.payment')}</h1>
        <p class="muted">${t('acc.orderCode')}: <span class="mono b">${order.code}</span></p>
        <div class="buy-price center"><span class="buy-now">${fmtMoney(payable)}</span></div>

        ${isInstallment ? h`
          <div class="notice notice-info">
            ${icon('info')}
            <div><strong>شبیه‌ساز درگاه اقساطی (${providerName})</strong>
            <p class="small mt-s">در محیط واقعی، کاربر به درگاه ${providerName} منتقل شده و پس از اعتبارسنجی و کسر قسط اول (یا تأیید اعتبار)، به سایت بازمی‌گردد.</p></div>
          </div>` : h`
          <p class="notice notice-warn">${icon('info')}<span>${t('checkout.gatewayDemo')}</span></p>`}

        <div class="row center mt">
          <button type="button" class="btn btn-success btn-lg" data-act="pay-sim" data-id="${order.id}" data-ok="1">${icon('check')} ${t('checkout.simulateSuccess')}</button>
          <button type="button" class="btn btn-danger btn-lg" data-act="pay-sim" data-id="${order.id}" data-ok="0">${icon('close')} ${t('checkout.simulateFail')}</button>
        </div>
      </div>
      ${bd && !isInstallment ? h`
        <div class="divider"></div>
        <p class="small muted t-center">${t('pay.card.alsoGateway')}</p>
        ${bankBox(bd, { amount: payable, orderCode: order.code })}` : ''}
      <div class="divider"></div>
      <div class="row row-between small muted">
        <span>${t('acc.orderDate')}: ${fmtDate(order.createdAt)}</span>
        <span>${t('common.items')}: ${fmtNum(order.items?.length || 0)}</span>
      </div>
    </div>`;
}

export function mount(root) {
  applyDyn(root);
  wireBankCopy(root);
  return null;
}

act('pay-sim', async (e, el) => {
  const ok = el.dataset.ok === '1';
  await withBusy(el, async () => {
    try {
      await api.post(`/api/payments/simulate/${el.dataset.id}`, { success: ok });
      await refreshMe();
      await loadCart();
      if (ok) { toastSuccess(t('checkout.paymentSuccess')); fireConfetti(); navigate(`#/checkout/done/${el.dataset.id}`); }
      else { toastApiError({ code: 'payment_failed', message: t('checkout.paymentFailed'), details: 'Payment failed' }); navigate('#/account/orders'); }
    } catch (err) { toastApiError(err); }
  });
});

export const title = () => t('common.payment');
