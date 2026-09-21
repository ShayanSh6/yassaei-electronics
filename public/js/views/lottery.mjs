// ─────────────────────────────────────────────────────────────
//  قرعه‌کشی: برای کاربران «به‌زودی» تا وقتی مدیر فعال نکند
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { toastSuccess, toastError, toastApiError, withBusy, errorState, fireConfetti } from '../ui.mjs';
import { act } from '../actions.mjs';
import { S } from '../state.mjs';

export async function render() {
  let r = null;
  try { r = await api.get('/api/lotteries'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const active = (r.items || []).filter((x) => x.status === 'active');
  const done = (r.items || []).filter((x) => x.status !== 'active');
  if (!active.length) {
    return h`
      <div class="card lot-soon">
        <span class="lot-ic">${icon('gift2')}</span>
        <h1 class="buy-title">${t('lot.title')}</h1>
        <p class="muted mt-s">${t('lot.soon')}</p>
        ${done.length ? h`<div class="mt">
          <h2 class="section-title small">${icon('history')} ${t('lot.done')}</h2>
          ${done.slice(0, 5).map((l) => h`
            <div class="notif-item lv-success mt-s">
              <strong class="tiny">${esc(l.title)}</strong>
              <p class="tiny muted mt-s">${t('lot.winners')}: ${(l.winners || []).map((w) => esc(w)).join('، ') || '—'}</p>
            </div>`)}
        </div>` : ''}
      </div>`;
  }
  return h`
    <h1 class="section-title mb">${icon('gift2')} ${t('lot.title')}</h1>
    <div class="cart-grid">
      ${active.map((l) => h`
        <div class="card">
          <div class="row row-between"><strong>${icon('sparkles')} ${esc(l.title)}</strong><span class="badge-pill bp-accent">${t('lot.active')}</span></div>
          <p class="mt-s">${t('lot.prize')}: <b>${esc(l.prize)}</b></p>
          <p class="muted small">${t('lot.ends')}: ${fmtDate(l.endsAt)} · ${t('lot.entries')}: ${fmtNum(l.entries || 0)}</p>
          ${l.myEntry ? h`<div class="notice notice-success mt-s">${icon('check')} ${t('lot.joined')}</div>`
            : l.entryMode === 'manual' ? h`<button class="btn btn-primary mt-s" data-act="lot-join" data-id="${l.id}">${icon('gift2')} ${t('lot.join')}</button>`
            : h`<p class="hint mt-s">${t('lot.autoEntry')}</p>`}
        </div>`)}
      ${done.slice(0, 6).map((l) => h`
        <div class="card">
          <div class="row row-between"><strong>${esc(l.title)}</strong><span class="badge-pill bp-success">${t('lot.done')}</span></div>
          <p class="tiny muted mt-s">${t('lot.winners')}: ${(l.winners || []).map((w) => esc(w)).join('، ') || '—'}</p>
        </div>`)}
    </div>`;
}

act('lot-join', async (e, el) => {
  if (!S.me) { toastError(t('nav.login')); return; }
  await withBusy(el, async () => {
    try { await api.post(`/api/lotteries/${el.dataset.id}/join`, {}); toastSuccess(t('lot.joinDone')); fireConfetti(); import('../router.mjs').then((m) => m.refresh(true)); }
    catch (err) { toastApiError(err); }
  });
});

export const title = () => (isFa() ? 'قرعه‌کشی' : 'Lottery');
