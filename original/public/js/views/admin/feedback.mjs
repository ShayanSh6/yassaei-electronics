// ─────────────────────────────────────────────────────────────
//  پیشنهادها، شکایت‌ها و گزارش‌های خطا
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { selectField, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy, lightbox } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);
const F = { type: '', status: '' };
const TYPE_META = {
  suggestion: { icon: 'sparkles', cls: 'bp-info' },
  complaint: { icon: 'flag', cls: 'bp-warn' },
  bug: { icon: 'bug', cls: 'bp-danger' },
};
const STATUS_META = {
  new: ['bp-info', () => t('fb.new')],
  seen: ['bp-muted', () => t('fb.seen')],
  in_progress: ['bp-warn', () => t('fb.inProgress')],
  done: ['bp-success', () => t('fb.done')],
  rejected: ['bp-danger', () => t('fb.rejected')],
};

export async function render() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/feedback', { type: F.type })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  let items = r.items || [];
  if (F.status) items = items.filter((x) => x.status === F.status);

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('mail')} ${t('adm.feedback')}</h2>
        <p class="muted small">${fmtNum(r.counts?.total || items.length)} ${L('مورد', 'items')} · ${fmtNum(r.counts?.new || 0)} ${L('جدید', 'new')}</p>
      </div>
    </div>

    <form class="card mb adm-filter" data-act="adm-fb-filter">
      <div class="form-grid">
        ${selectField({
          label: t('common.type'), name: 'type', value: F.type,
          options: [{ value: '', label: t('common.all') }, { value: 'suggestion', label: t('feedback.suggestion') }, { value: 'complaint', label: t('feedback.complaint') }, { value: 'bug', label: t('feedback.bug') }],
        })}
        ${selectField({
          label: t('common.status'), name: 'status', value: F.status,
          options: [{ value: '', label: t('common.all') }, ...Object.entries(STATUS_META).map(([v, [, l]]) => ({ value: v, label: l() }))],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
      </div>
    </form>

    ${items.length ? h`<div class="rev-list">${items.map(fbCard).join('')}</div>`
      : emptyState({ icon: 'mail', title: t('common.noData'), text: t('adm.fbEmptyHint') })}`;
}

function fbCard(f) {
  const meta = TYPE_META[f.type] || { icon: 'mail', cls: 'bp-muted' };
  const [sCls, sLabel] = STATUS_META[f.status] || ['bp-muted', () => f.status];
  return h`
    <article class="card rev-card">
      <div class="row row-between row-wrap mb-s">
        <div class="row">
          <span class="fb-ic ${meta.cls}">${icon(meta.icon)}</span>
          <div>
            <strong>${esc(f.title || '')}</strong>
            <div class="tiny muted">
              ${t(`feedback.${f.type}`)} · ${esc(f.userName || L('مهمان', 'Guest'))} · ${timeAgo(f.createdAt)}
              ${f.contact ? ` · ${esc(f.contact)}` : ''}${f.page ? ` · ${esc(f.page)}` : ''}
            </div>
          </div>
        </div>
        <span class="badge-pill ${sCls}">${sLabel()}</span>
      </div>
      <p class="rev-body">${esc(f.body || '')}</p>
      ${(f.attachments || []).length ? h`
        <div class="row row-wrap mt-s">
          ${f.attachments.map((a) => h`<img class="tk-att" src="${esc(a)}" alt="" loading="lazy" data-act="adm-att-open" data-url="${esc(a)}">`)}
        </div>` : ''}
      ${f.device?.ua ? h`<p class="tiny muted mono mt-s clip-wide">${esc(f.device.ua)}${f.device.screen ? ` · ${esc(f.device.screen)}` : ''}</p>` : ''}
      ${f.answer ? h`
        <div class="rev-reply">
          <span class="tiny muted">${icon('send')} ${L('پاسخ ما', 'Our answer')}</span>
          <p>${esc(f.answer)}</p>
        </div>` : ''}
      <form class="mt-s" data-act="adm-fb-save" data-id="${f.id}">
        <div class="row row-wrap">
          <select class="select select-sm" name="status">
            ${Object.entries(STATUS_META).map(([v, [, l]]) => h`<option value="${v}" ${f.status === v ? 'selected' : ''}>${l()}</option>`)}
          </select>
          <input class="input grow" name="answer" value="${esc(f.answer || '')}" placeholder="${L('پاسخ…', 'Answer…')}">
          <button class="btn btn-outline btn-sm" type="submit">${icon('save')} ${t('common.save')}</button>
        </div>
      </form>
      <div class="tiny muted mt-s">${L('ثبت', 'Created')}: ${fmtDate(f.createdAt)}</div>
    </article>`;
}

act('adm-fb-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  F.type = String(fd.get('type') || '');
  F.status = String(fd.get('status') || '');
  refresh(true);
});

act('adm-fb-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/feedback/${form.dataset.id}`, { status: fd.get('status'), answer: String(fd.get('answer') || '') });
      toastSuccess(t('misc.saved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}
