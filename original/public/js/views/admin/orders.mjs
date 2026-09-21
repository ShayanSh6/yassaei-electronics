// ─────────────────────────────────────────────────────────────
//  مدیریت سفارش‌ها: فهرست با فیلتر، جزئیات، تغییر وضعیت، کد رهگیری
// ─────────────────────────────────────────────────────────────
import { fmtTel, html as h, icon, esc, fmtNum, fmtMoney, fmtDate, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { can } from '../../state.mjs';
import {
  tableHtml, pagination, selectField, field, textareaField, statusBadge, payBadge,
  timelineHtml, emptyState, productImage,
} from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy, errorState } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const F = { q: '', status: '', delivery: '', page: 1, limit: 25 };
const L = (fa, en) => (isFa() ? fa : en);
let STATUSES = [];

export async function render(ctx) {
  if (ctx.params.id) return detail(ctx.params.id);
  return list();
}

async function list() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/orders', { q: F.q, status: F.status, delivery: F.delivery, page: F.page, limit: F.limit })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  STATUSES = r.statuses || [];
  const items = r.items || [];

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('package-check')} ${t('adm.orders')}</h2>
        <p class="muted small">${fmtNum(r.total || 0)} ${t('common.orders')}</p>
      </div>
      <div>
        <a class="btn btn-outline btn-sm" href="/api/admin/export/orders.csv" download="orders.csv">${icon('download')} ${L('خروجی CSV', 'Export CSV')}</a>
      </div>
    </div>

    <form class="card mb adm-filter" data-act="adm-o-filter">
      <div class="form-grid">
        <label class="field"><span class="label">${t('common.search')}</span>
          <input class="input" name="q" value="${esc(F.q)}" placeholder="${t('acc.orderCode')} / ${t('common.phone')} / ${t('common.name')}">
        </label>
        ${selectField({ label: t('common.status'), name: 'status', value: F.status, options: [{ value: '', label: t('common.all') }, ...STATUSES.map((s) => ({ value: s.id, label: t(`st.${s.id}`) }))] })}
        ${selectField({
          label: t('adm.oDelivery'), name: 'delivery', value: F.delivery,
          options: [{ value: '', label: t('common.all') }, { value: 'pickup', label: t('dl.pickup') }, { value: 'courier', label: t('dl.courier') }],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-o-clear">${icon('close')} ${t('catalog.f.clear')}</button>
      </div>
    </form>

    ${items.length ? tableHtml(
      [
        { label: t('acc.orderCode') }, { label: t('adm.oCustomer') }, { label: t('common.date') },
        { label: t('adm.oDelivery') }, { label: t('common.total'), cls: 'num' }, { label: t('adm.oPayment') },
        { label: t('common.status') }, { label: '', cls: 'num' },
      ],
      items.map((o) => h`
        <tr>
          <td class="mono b nowrap">${o.code}</td>
          <td class="nowrap">${esc(o.userName || '')}<div class="tiny muted mono">${fmtTel(o.userPhone || '')}</div></td>
          <td class="nowrap tiny">${fmtDate(o.createdAt)}</td>
          <td class="tiny">${t(o.delivery === 'pickup' ? 'dl.pickup' : 'dl.courier')}${o.express ? h` <span class="badge-pill bp-accent">${t('checkout.express')}</span>` : ''}</td>
          <td class="num b">${fmtMoney(o.total)}</td>
          <td>${payBadge(o.payment)}<div class="tiny muted">${t(`pm.${o.payment?.method || 'cod'}`)}</div></td>
          <td>${statusBadge(o.status)}</td>
          <td><a class="btn btn-ghost btn-xs" href="#/admin/orders/${o.id}">${t('common.view')}</a></td>
        </tr>`),
    ) : emptyState({ icon: 'package-check', title: t('common.noResult') })}

    <div class="mt">${pagination(r.page || 1, r.pages || 1, (p) => `#/admin/orders?page=${p}`)}</div>`;
}

async function detail(id) {
  let r = null;
  try { r = await api.get(api.url('/api/admin/orders', { q: '', page: 1, limit: 200 })); } catch { /* noop */ }
  const o = (r?.items || []).find((x) => x.id === id || x.code === id);
  if (!o) {
    // جست‌وجوی مستقیم با کد سفارش
    try {
      const byCode = await api.get(api.url('/api/admin/orders', { q: id, page: 1, limit: 50 }));
      const found = (byCode?.items || []).find((x) => x.id === id || x.code === id);
      if (found) return detailHtml(found, byCode.statuses || []);
    } catch { /* noop */ }
    return emptyState({ icon: 'package-check', title: t('acc.noOrders'), action: { href: '#/admin/orders', label: t('adm.orders') } });
  }
  return detailHtml(o, r.statuses || []);
}

function detailHtml(o, statuses) {
  const canManage = can('orders.manage');
  return h`
    <div class="breadcrumb mb-s">
      <a href="#/admin/orders">${t('adm.orders')}</a> <span>/</span> <span class="mono">${o.code}</span>
    </div>

    <div class="cart-grid">
      <div class="col">
        <div class="card">
          <div class="row row-between row-wrap">
            <div>
              <h2 class="buy-title">${icon('package-check')} ${o.code}</h2>
              <p class="muted small">${fmtDate(o.createdAt)} · ${esc(o.userName || '')} · <span class="mono">${fmtTel(o.userPhone || '')}</span></p>
            </div>
            <div class="row row-wrap">
              ${statusBadge(o.status)}${payBadge(o.payment)}
              <a class="btn btn-ghost btn-sm" href="#/admin/invoice?orderId=${o.id}">${icon('printer')} صدور فاکتور</a>
            </div>
          </div>
          ${canManage ? h`
            <form class="form-grid mt" data-act="adm-o-save" data-id="${o.id}">
              ${selectField({ label: t('adm.oStatus'), name: 'status', value: o.status, options: (statuses.length ? statuses : []).map((s) => ({ value: s.id, label: t(`st.${s.id}`) })) })}
              ${field({ label: t('adm.oTracking'), name: 'tracking', value: o.tracking || o.payment?.tracking || '' })}
              <div class="span-2">${textareaField({ label: t('adm.oNote'), name: 'note', value: o.adminNote || '', rows: 3 })}</div>
              <div class="span-2"><button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button></div>
            </form>` : ''}
        </div>

        <div class="card mt">
          <strong>${icon('box')} ${t('acc.orderItems')}</strong>
          ${tableHtml(
            [{ label: '' }, { label: t('common.product') }, { label: t('common.price'), cls: 'num' }, { label: t('common.count'), cls: 'num' }, { label: t('common.total'), cls: 'num' }],
            (o.items || []).map((it) => h`
              <tr>
                <td><span class="cl-img" data-h="46px" data-w="46px">${productImage({ id: it.productId, name: it.name, images: it.image ? [it.image] : [] })}</span></td>
                <td><a class="b" href="#/admin/products/${it.productId}">${esc(isFa() ? it.name : (it.nameEn || it.name))}</a><div class="tiny muted mono">${esc(it.sku || '')}</div></td>
                <td class="num">${fmtMoney(it.price)}</td>
                <td class="num">${fmtNum(it.qty)}</td>
                <td class="num b">${fmtMoney(it.price * it.qty)}</td>
              </tr>`),
          )}
        </div>

        <div class="card mt">
          <strong>${icon('history')} ${t('acc.timeline')}</strong>
          ${timelineHtml(o)}
        </div>
      </div>

      <aside class="col">
        <div class="card summary">
          <strong>${t('cart.summary')}</strong>
          <div class="sum-row"><span>${t('common.subtotal')}</span><span class="v">${fmtMoney(o.subtotal)}</span></div>
          ${o.plusDiscount > 0 ? h`<div class="sum-row discount"><span>${t('acc.plus')}</span><span class="v">−${fmtMoney(o.plusDiscount)}</span></div>` : ''}
          ${o.couponDiscount > 0 ? h`<div class="sum-row discount"><span>${o.couponCode}</span><span class="v">−${fmtMoney(o.couponDiscount)}</span></div>` : ''}
          <div class="sum-row"><span>${t('common.shipping')}${o.shippingLabel ? h` <span class="muted tiny">(${esc(o.shippingLabel)})</span>` : ''}</span><span class="v">${fmtMoney(o.shipping)}</span></div>
          ${o.insured ? h`<div class="sum-row"><span>${t('common.insurance')}</span><span class="v">${fmtMoney(o.insuranceFee)}</span></div>` : ''}
          <div class="sum-row"><span>${t('common.total')}</span><span class="v">${fmtMoney(o.total)}</span></div>
          ${o.walletUsed > 0 ? h`<div class="sum-row discount"><span>${t('common.wallet')}</span><span class="v">−${fmtMoney(o.walletUsed)}</span></div>` : ''}
          <div class="sum-row total"><span>${t('common.payable')}</span><span class="v">${fmtMoney(o.payable)}</span></div>
          <p class="hint mt-s">${t('adm.oPayment')}: ${t(`pm.${o.payment?.method || 'cod'}`)}${o.payment?.ref ? ` · ${esc(o.payment.ref)}` : ''}</p>
          ${o.refund ? h`<p class="notice notice-success mt-s">${icon('wallet')}<span>${fmtMoney(o.refund.amount)} — ${fmtDate(o.refund.at)}</span></p>` : ''}
        </div>

        <div class="card mt">
          <strong>${icon('truck')} ${t(o.delivery === 'pickup' ? 'dl.pickup' : 'dl.courier')}</strong>
          ${o.address ? h`
            <p class="small mt-s"><strong>${esc(o.address.receiver || '')}</strong> · <span class="mono">${fmtTel(o.address.phone || '')}</span></p>
            <p class="muted small">${esc(o.address.street || '')}${o.address.city ? `، ${esc(o.address.city)}` : ''}</p>
            ${o.address.postal ? h`<p class="muted small">${t('common.postal')}: ${esc(o.address.postal)}</p>` : ''}
            ${o.address.note ? h`<p class="hint">${esc(o.address.note)}</p>` : ''}` : h`<p class="muted small mt-s">${t('checkout.pickupDesc')}</p>`}
          ${o.zone ? h`<p class="small mt-s">${t('checkout.zone')}: ${esc(o.zone)}</p>` : ''}
          ${o.note ? h`<p class="hint mt-s">${icon('edit')} ${esc(o.note)}</p>` : ''}
        </div>
      </aside>
    </div>`;
}

act('adm-o-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  F.q = String(fd.get('q') || '').trim();
  F.status = String(fd.get('status') || '');
  F.delivery = String(fd.get('delivery') || '');
  F.page = 1;
  refresh(true);
});
act('adm-o-clear', () => { Object.assign(F, { q: '', status: '', delivery: '', page: 1 }); refresh(true); });

act('adm-o-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/orders/${form.dataset.id}`, {
        status: fd.get('status'), tracking: fd.get('tracking') || '', note: fd.get('note') || '',
      });
      toastSuccess(t('adm.oSaved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  root.querySelectorAll('.pagination .pg').forEach((a) => {
    a.addEventListener('click', (e) => {
      const m = /page=(\d+)/.exec(a.getAttribute('href') || '');
      if (!m) return;
      e.preventDefault();
      F.page = Number(m[1]);
      refresh(true);
    });
  });
  return null;
}
