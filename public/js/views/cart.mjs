// ─────────────────────────────────────────────────────────────
//  سبد خرید
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtNum, fmtMoney, fmtTel, applyDyn } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { S, store, loadCart, setQty, removeFromCart, clearCart, applyCoupon, adInSlot, prodName } from '../state.mjs';
import { emptyState, bannerSlot, freeShipBar, qtyWidget } from '../components.mjs';
import { toast, toastSuccess, toastApiError, confirmDialog, withBusy, modal } from '../ui.mjs';
import { act } from '../actions.mjs';
import { toolOn, bankDetails, fmtCard, fmtIban, jalaliDate, proformaNumber } from '../lib/sales.mjs';

const BADGE_SRC = '/assets/img/yassaei-poster-badge.svg';

export async function render() {
  await loadCart().catch(() => {});
  const cart = S.cart;
  if (!cart.items?.length) {
    return h`
      <div class="section-head"><div><h1 class="section-title">${icon('cart')} ${t('cart.title')}</h1></div></div>
      ${emptyState({ icon: 'cart', title: t('cart.empty'), text: t('cart.emptyText'), action: { href: '#/products', label: t('cart.goShopping') } })}`;
  }
  return h`
    <div class="section-head">
      <div><h1 class="section-title">${icon('cart')} ${t('cart.title')}</h1>
      <p class="section-sub">${fmtNum(cart.count)} ${t('common.items')}</p></div>
      <button type="button" class="link-btn" data-act="cart-clear">${icon('trash')} ${t('cart.clear')}</button>
    </div>
    ${bannerSlot('cart', adInSlot('cart'))}
    <div class="cart-grid">
      <div class="card" data-lines>
        ${cart.items.map(lineHtml).join('')}
      </div>
      <aside class="summary card">
        <strong>${t('cart.summary')}</strong>
        ${(() => {
          const c = cart.ceiling;
          const payable = Math.max(0, (cart.subtotal || 0) - (cart.couponDiscount || 0));
          if (!c?.enabled || !(payable > c.remaining)) return '';
          const msg = isFa()
            ? h`سقف مجاز خرید در هر ${fmtNum(c.hours)} ساعت ${fmtMoney(c.amount)} است. مجموع خریدهای موفق شما در این بازه: ${fmtMoney(c.pastSpent)}. شما می‌توانید تا سقف ${fmtMoney(c.remaining)} سفارش ثبت کنید یا پس از پایان بازه مجدداً اقدام فرمایید.`
            : h`The fair purchase ceiling for every ${fmtNum(c.hours)} hours is ${fmtMoney(c.amount)}. Your successful purchases in this window: ${fmtMoney(c.pastSpent)}. You can place orders up to ${fmtMoney(c.remaining)}, or try again after the window ends.`;
          return h`
            <div class="notice notice-warn ceiling-notice mt-s" role="alert">
              ${icon('shield')}
              <div>
                <strong>${t('checkout.ceilingTitle')}</strong>
                <p class="small mt-s">${msg}</p>
                <p class="hint tiny muted mt-s">${icon('info')} ${t('checkout.ceilingHint')}</p>
              </div>
            </div>`;
        })()}
        <div class="sum-row"><span>${t('common.subtotal')}</span><span class="v">${fmtMoney(cart.subtotal)}</span></div>
        <div data-coupon-row>
          ${cart.coupon ? h`<div class="sum-row discount"><span>${t('common.discountCode')}: ${cart.coupon.code}</span><span class="v"><button type="button" class="link-btn" data-act="coupon-remove">${t('cart.removeCoupon')}</button></span></div>` : ''}
        </div>
        <div data-shipbar>${freeShipBar(cart.subtotal)}</div>
        ${!cart.coupon ? h`
          <form class="row mt-s" data-act="coupon-apply">
            <input class="input" name="code" placeholder="${t('cart.couponPlaceholder')}" maxlength="32">
            <button class="btn btn-ghost" type="submit">${t('cart.applyCoupon')}</button>
          </form>` : ''}
        <div class="sum-row total"><span>${t('common.payable')}</span><span class="v" data-total>${fmtMoney(cart.subtotal - (cart.couponDiscount || 0))}</span></div>
        <p class="hint">${t('checkout.concurrencyNote')}</p>
        <a class="btn btn-primary btn-block btn-lg mt" href="#/checkout">${t('cart.continue')} ${icon('chevron-left')}</a>
        ${toolOn('proformaInvoiceEnabled') ? h`
        <button type="button" class="btn btn-outline btn-block mt-s" data-act="cart-proforma" title="${t('cart.proformaHint')}">${t('cart.proforma')}</button>` : ''}
      </aside>
    </div>`;
}

/**
 * پیش‌فاکتور رسمی (A4) — از روی سبد فعلی، بدون ثبت سفارش.
 * نشان رسمی یاسایی، مشخصات فروشگاه، تاریخ شمسی، شمارهٔ خودکار، جدول اقلام و محل مهر.
 */
export function proformaHtml(cart) {
  const st = store();
  const shopName = st.name || 'الکتریکی یاسایی';
  const now = new Date();
  const number = proformaNumber(now);
  const items = cart.items || [];
  const subtotal = Number(cart.subtotal) || 0;
  const discount = Number(cart.couponDiscount) || 0;
  const payable = Math.max(0, subtotal - discount);
  const buyer = S.me?.name || S.me?.username || t('proforma.guest');
  const bd = bankDetails();
  return h`
    <div class="inv-paper proforma-paper" data-proforma>
      <div class="pf-head">
        <div class="pf-brand">
          <img class="pf-badge" src="${BADGE_SRC}" alt="${shopName}" width="64" height="64" decoding="async">
          <div>
            <div class="pf-shop">${shopName}</div>
            ${st.tagline ? h`<div class="small muted">${isFa() ? st.tagline : (st.taglineEn || st.tagline)}</div>` : ''}
          </div>
        </div>
        <div class="pf-title">
          <h2>${t('proforma.title')}</h2>
          <span class="pf-official">${t('proforma.official')}</span>
        </div>
        <div class="pf-meta">
          <p>${t('proforma.number')}: <span class="mono" dir="ltr">${number}</span></p>
          <p>${t('proforma.date')}: <span class="mono">${jalaliDate(now)}</span></p>
        </div>
      </div>

      <div class="pf-parties">
        <div>
          <strong>${isFa() ? 'فروشنده' : 'Seller'}:</strong> ${shopName}
          ${st.phone ? h`<br><strong>${isFa() ? 'تلفن' : 'Phone'}:</strong> <bdi class="mono">${fmtTel(st.phone)}</bdi>` : ''}
          ${st.whatsapp || st.phone2 ? h`<br><strong>${isFa() ? 'همراه / واتساپ' : 'Mobile / WhatsApp'}:</strong> <bdi class="mono">${fmtTel(st.whatsapp || st.phone2)}</bdi>` : ''}
          ${st.email ? h`<br><strong>${isFa() ? 'ایمیل' : 'Email'}:</strong> <bdi class="mono">${st.email}</bdi>` : ''}
          ${st.address ? h`<br><strong>${isFa() ? 'نشانی' : 'Address'}:</strong> ${isFa() ? st.address : (st.addressEn || st.address)}` : ''}
        </div>
        <div>
          <strong>${t('proforma.buyer')}:</strong> ${buyer}
          ${S.me?.phone ? h`<br><strong>${isFa() ? 'تماس' : 'Phone'}:</strong> <bdi class="mono">${fmtTel(S.me.phone)}</bdi>` : ''}
        </div>
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th class="inv-w-row">${t('proforma.row')}</th>
            <th>${t('proforma.item')}</th>
            <th class="inv-w-qty">${t('proforma.qty')}</th>
            <th class="inv-w-unit">${t('proforma.unit')}</th>
            <th class="inv-w-total">${t('proforma.total')}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => {
            const p = it.product || {};
            const unit = Number(p.price) || 0;
            const qty = Number(it.qty) || 0;
            return h`
              <tr>
                <td class="t-center mono">${fmtNum(i + 1)}</td>
                <td>${prodName(p)}${p.sku ? h` <span class="small muted mono">(${p.sku})</span>` : ''}</td>
                <td class="t-center mono">${fmtNum(qty)}</td>
                <td class="t-center mono">${fmtNum(unit)}</td>
                <td class="t-center mono">${fmtNum(it.lineTotal ?? unit * qty)}</td>
              </tr>`;
          })}
        </tbody>
      </table>

      <div class="inv-totals-grid">
        <div class="it-note">
          ${t('proforma.validity')}
          ${bd ? h`
            <div class="inv-bank">
              <strong>${t('proforma.bank')}:</strong>
              ${bd.bankName ? h`<span>${t('pay.card.bank')}: ${bd.bankName}</span>` : ''}
              ${bd.cardNumber ? h`<span>${t('pay.card.cardNumber')}: <span class="mono" dir="ltr">${fmtCard(bd.cardNumber)}</span></span>` : ''}
              ${bd.iban ? h`<span>${t('pay.card.iban')}: <span class="mono" dir="ltr">${fmtIban(bd.iban)}</span></span>` : ''}
              ${bd.owner ? h`<span>${t('pay.card.owner')}: ${bd.owner}</span>` : ''}
            </div>` : ''}
        </div>
        <div class="it-nums">
          <div class="it-row"><span>${t('proforma.subtotal')}:</span> <span class="mono">${fmtNum(subtotal)}</span></div>
          <div class="it-row"><span>${t('proforma.discount')}${cart.coupon?.code ? h` (${cart.coupon.code})` : ''}:</span> <span class="mono">${fmtNum(discount)}</span></div>
          <div class="it-row total-final"><span>${t('proforma.payable')}:</span> <span class="mono">${fmtNum(payable)} ${isFa() ? 'تومان' : 'Toman'}</span></div>
        </div>
      </div>

      <div class="inv-signatures">
        <div class="sign-box">
          <strong>${t('proforma.stamp')}</strong>
          <div class="sign-space"><span class="stamp-fake">${shopName}</span></div>
          <div class="small mt-s inv-sign-hint">${t('proforma.stampHint')}</div>
        </div>
      </div>
    </div>`;
}

async function openProforma() {
  await loadCart().catch(() => {});
  const cart = S.cart;
  if (!cart?.items?.length) { toast(t('cart.empty')); return; }
  const { printPaper } = await import('./invoice-print.mjs');
  modal({
    title: t('proforma.title'),
    size: 'lg',
    body: h`<div class="proforma-wrap">${proformaHtml(cart)}</div>`,
    footer: h`
      <button type="button" class="btn btn-ghost" data-lx>${t('common.close')}</button>
      <button type="button" class="btn btn-primary" data-pf-print>${t('proforma.print')}</button>`,
    onMount(panel) {
      panel.querySelector('[data-pf-print]')?.addEventListener('click', () => printPaper(panel.querySelector('[data-proforma]')));
    },
  });
}

function lineHtml(it) {
  const p = it.product;
  return h`
    <div class="cart-line" data-line="${p.id}">
      <a class="cl-img" href="#/product/${p.id}">${p.images?.[0] ? h`<img src="${p.images[0]}" alt="${prodName(p)}" loading="lazy" data-glyph="${p.glyph}">` : icon(p.glyph || 'box')}</a>
      <div class="cl-body">
        <a class="cl-name" href="#/product/${p.id}">${prodName(p)}</a>
        <div class="cl-meta">${p.brandName ? `${p.brandName} · ` : ''}${fmtMoney(p.price)} / ${t('common.unit')}</div>
        ${it.available < it.requestedQty ? h`<div class="err mt-s">${icon('alert')} ${t('common.lowStock')} (${fmtNum(it.available)})</div>` : ''}
        <div class="cl-foot">
          <span data-qtybox>${qtyWidget({ value: it.qty, max: Math.max(1, it.available), name: 'qty' })}</span>
          <button type="button" class="link-btn" data-act="cart-remove" data-id="${p.id}">${icon('trash')} ${t('cart.remove')}</button>
          <span class="cl-price">${fmtMoney(it.lineTotal)}</span>
        </div>
      </div>
    </div>`;
}

export function mount(root) {
  applyDyn(root);

  root.querySelectorAll('.qty input').forEach((input) => {
    input.addEventListener('change', async () => {
      const line = input.closest('[data-line]');
      const id = line.dataset.line;
      const qty = Math.max(1, Number(input.value) || 1);
      try {
        await setQty(id, qty);
        toast(t('cart.updated'), { timeout: 1500 });
        import('../router.mjs').then((m) => m.refresh(true));
      } catch (err) { toastApiError(err); import('../router.mjs').then((m) => m.refresh(true)); }
    });
  });

  act('cart-remove', async (e, el) => {
    try {
      await removeFromCart(el.dataset.id);
      import('../router.mjs').then((m) => m.refresh(true));
    } catch (err) { toastApiError(err); }
  });

  act('cart-clear', async () => {
    const ok = await confirmDialog({ text: t('cart.clearConfirm'), danger: true, okText: t('cart.clear') });
    if (!ok) return;
    try { await clearCart(); import('../router.mjs').then((m) => m.refresh(true)); }
    catch (err) { toastApiError(err); }
  });

  act('coupon-apply', async (e, form) => {
    e.preventDefault();
    const code = form.querySelector('[name=code]').value.trim();
    if (!code) return;
    await withBusy(form.querySelector('button'), async () => {
      try {
        await applyCoupon(code);
        toastSuccess(t('cart.couponApplied'));
        import('../router.mjs').then((m) => m.refresh(true));
      } catch (err) { toastApiError(err); }
    });
  });

  act('coupon-remove', async () => {
    try {
      await applyCoupon('');
      import('../router.mjs').then((m) => m.refresh(true));
    } catch (err) { toastApiError(err); }
  });

  act('cart-proforma', (e, el) => withBusy(el, openProforma));
  return null;
}

export const title = () => t('cart.title');
