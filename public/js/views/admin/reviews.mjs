// ─────────────────────────────────────────────────────────────
//  مدیریت نظرات و پرسش‌ها: صف تأیید، انتشار/رد، پاسخ فروشگاه
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate, stars, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { can } from '../../state.mjs';
import { tableHtml, selectField, pagination, emptyState, errorState, spinner } from '../../components.mjs';
import { toastSuccess, toastApiError, modal, confirmDelete, withBusy, promptDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);
const F = { status: 'pending', type: '', page: 1 };
const PER = 12;
let ITEMS = [];
let COUNTS = { pending: 0, approved: 0, rejected: 0 };

export async function render() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/reviews', { status: F.status, type: F.type })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  ITEMS = r.items || [];
  COUNTS = r.counts || COUNTS;
  const pages = Math.max(1, Math.ceil(ITEMS.length / PER));
  if (F.page > pages) F.page = pages;
  const rows = ITEMS.slice((F.page - 1) * PER, F.page * PER);

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('chat')} ${t('adm.reviews')}</h2>
      <div class="row row-wrap">
        <span class="badge-pill bp-warn">${t('adm.revPending')}: ${fmtNum(COUNTS.pending || 0)}</span>
        <span class="badge-pill bp-success">${t('adm.revApproved')}: ${fmtNum(COUNTS.approved || 0)}</span>
        <span class="badge-pill bp-muted">${t('adm.revRejected')}: ${fmtNum(COUNTS.rejected || 0)}</span>
      </div>
    </div>

    <form class="card mb adm-filter" data-act="adm-rev-filter">
      <div class="form-grid">
        ${selectField({
          label: t('common.status'), name: 'status', value: F.status,
          options: [
            { value: 'pending', label: `${t('adm.revPending')} (${fmtNum(COUNTS.pending || 0)})` },
            { value: 'approved', label: t('adm.revApproved') },
            { value: 'rejected', label: t('adm.revRejected') },
            { value: '', label: t('common.all') },
          ],
        })}
        ${selectField({
          label: t('common.type'), name: 'type', value: F.type,
          options: [{ value: '', label: t('common.all') }, { value: 'review', label: t('common.review') }, { value: 'question', label: t('common.question') }],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
      </div>
    </form>

    ${rows.length ? h`
      <div class="rev-list">
        ${rows.map(revCard).join('')}
      </div>
      ${pages > 1 ? pagination(F.page, pages, (p) => `#/admin/reviews?p=${p}`) : ''}
    ` : emptyState({ icon: 'star', title: t('adm.revEmpty'), text: t('adm.revEmptyHint') })}`;
}

function revCard(r) {
  const isQ = r.type === 'question';
  return h`
    <article class="card rev-card" data-id="${r.id}">
      <div class="row row-between row-wrap mb-s">
        <div class="row">
          ${r.productImage ? h`<img class="rev-thumb" src="${esc(r.productImage)}" alt="" loading="lazy" data-h="46px" data-w="46px">` : h`<span class="rev-thumb ph" data-h="46px" data-w="46px">${icon('box')}</span>`}
          <div>
            <a class="b" href="#/product/${r.productId}">${esc(r.productName || r.productId)}</a>
            <div class="tiny muted">${esc(r.userName || '')} · ${r.userBadge === 'buyer' ? t('rev.buyer') : t('rev.visitor')} · ${fmtDate(r.createdAt)}</div>
          </div>
        </div>
        <div class="row row-wrap">
          ${isQ ? h`<span class="badge-pill bp-info">${t('common.question')}</span>` : h`<span class="rate-row">${stars(r.rating || 0)}</span>`}
          ${statusPill(r.status)}
        </div>
      </div>
      ${r.title ? h`<h3 class="rev-title">${esc(r.title)}</h3>` : ''}
      <p class="rev-body">${esc(r.body || '')}</p>
      ${r.reply ? h`
        <div class="rev-reply">
          <span class="tiny muted">${icon('send')} ${t('rev.shopReply')}</span>
          <p>${esc(r.reply)}</p>
        </div>` : ''}
      <div class="row row-wrap mt-s">
        ${r.status !== 'approved' ? h`<button class="btn btn-success btn-xs" data-act="adm-rev-status" data-id="${r.id}" data-status="approved">${icon('check')} ${t('adm.revApprove')}</button>` : ''}
        ${r.status !== 'rejected' ? h`<button class="btn btn-outline btn-xs" data-act="adm-rev-status" data-id="${r.id}" data-status="rejected">${icon('close')} ${t('adm.revReject')}</button>` : ''}
        ${r.status !== 'pending' ? h`<button class="btn btn-ghost btn-xs" data-act="adm-rev-status" data-id="${r.id}" data-status="pending">${icon('refresh')} ${t('adm.revPending')}</button>` : ''}
        ${can('reviews.reply') ? h`<button class="btn btn-ghost btn-xs" data-act="adm-rev-reply" data-id="${r.id}">${icon('send')} ${t('adm.revReply')}</button>` : ''}
        <a class="btn btn-ghost btn-xs" href="#/product/${r.productId}" target="_blank" rel="noopener">${icon('external')}</a>
        <button class="btn btn-ghost btn-xs" data-act="adm-rev-del" data-id="${r.id}" data-name="${esc(r.title || r.body?.slice(0, 30) || '')}">${icon('trash')}</button>
      </div>
    </article>`;
}

function statusPill(s) {
  const map = { pending: ['bp-warn', t('adm.revPending')], approved: ['bp-success', t('adm.revApproved')], rejected: ['bp-danger', t('adm.revRejected')] };
  const [cls, label] = map[s] || ['bp-muted', s];
  return h`<span class="badge-pill ${cls}">${label}</span>`;
}

// ── کنش‌ها ──────────────────────────────────────────────────
act('adm-rev-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  F.status = String(fd.get('status') || '');
  F.type = String(fd.get('type') || '');
  F.page = 1;
  refresh(true);
});

act('adm-rev-status', async (e, el) => {
  try {
    await api.patch(`/api/admin/reviews/${el.dataset.id}`, { status: el.dataset.status });
    toastSuccess(t('misc.saved'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});

act('adm-rev-reply', async (e, el) => {
  const item = ITEMS.find((x) => x.id === el.dataset.id);
  const value = await promptDialog({
    title: t('adm.revReply'),
    text: item?.body?.slice(0, 140) || '',
    label: t('rev.shopReply'),
    value: item?.reply || '',
    rows: 4,
  });
  if (value === null) return;
  try {
    await api.patch(`/api/admin/reviews/${el.dataset.id}`, { reply: String(value) });
    toastSuccess(t('misc.saved'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});

act('adm-rev-del', async (e, el) => {
  if (!(await confirmDelete(el.dataset.name || el.dataset.id))) return;
  try {
    await api.del(`/api/admin/reviews/${el.dataset.id}`);
    toastSuccess(t('misc.deleted'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});

export function mount(root) {
  applyDyn(root);
  return null;
}
