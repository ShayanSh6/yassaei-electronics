// ─────────────────────────────────────────────────────────────
//  گزارش‌ها: رویدادنامه (audit)، آمار فروش و بازدید، خروجی و پشتیبان
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S } from '../../state.mjs';
import { tableHtml, selectField, kpiCard, barChart, pagination, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastError, toastApiError, withBusy, confirmDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);
const AF = { q: '', action: '', page: 1, limit: 50 };
const SF = { days: 30, metric: 'orders' };
let ACTIONS = [];

export async function render(ctx) {
  const sec = ctx.params.section;
  if (sec === 'stats') return stats();
  if (sec === 'visitors') return visitors();
  if (sec === 'data') return data();
  return audit();
}

// ── رویدادنامه ──────────────────────────────────────────────
async function audit() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/audit', { q: AF.q, action: AF.action, page: AF.page, limit: AF.limit })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const items = r.items || [];
  for (const it of items) {
    const pre = String(it.action || '').split('.')[0];
    if (pre && !ACTIONS.includes(pre)) ACTIONS.push(pre);
  }

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('history')} ${t('adm.audit')}</h2>
        <p class="muted small">${fmtNum(r.total || 0)} ${L('رویداد', 'events')}</p>
      </div>
    </div>

    <form class="card mb adm-filter" data-act="adm-aud-filter">
      <div class="form-grid">
        <label class="field"><span class="label">${t('common.search')}</span>
          <input class="input" name="q" value="${esc(AF.q)}" placeholder="${L('کاربر، رویداد، هدف…', 'actor, action, target…')}">
        </label>
        ${selectField({
          label: t('adm.audAction'), name: 'action', value: AF.action,
          options: [{ value: '', label: t('common.all') }, ...ACTIONS.sort().map((a) => ({ value: a, label: a }))],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-aud-clear">${icon('close')} ${t('catalog.f.clear')}</button>
      </div>
    </form>

    ${tableHtml(
      [
        { label: t('common.date') }, { label: t('adm.audActor') }, { label: t('adm.audAction') },
        { label: t('adm.audTarget') }, { label: t('adm.audMeta') },
      ],
      items.map((l) => h`
        <tr>
          <td class="tiny nowrap" title="${fmtDate(l.at)}">${timeAgo(l.at)}</td>
          <td class="tiny"><span class="b">${esc(l.actorName || '')}</span><div class="tiny muted">${esc(l.actorRole || '')}</div></td>
          <td><code class="tag mono">${esc(l.action || '')}</code></td>
          <td class="tiny mono">${esc(l.target || '')}</td>
          <td class="tiny muted clip-wide">${esc(metaText(l.meta))}</td>
        </tr>`),
      { emptyText: t('common.noData') },
    )}
    ${r.pages > 1 ? pagination(r.page, r.pages, (p) => `#/admin/audit?p=${p}`) : ''}`;
}

function metaText(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return Object.entries(meta).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 160);
}

act('adm-aud-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  AF.q = String(fd.get('q') || '').trim();
  AF.action = String(fd.get('action') || '');
  AF.page = 1;
  refresh(true);
});
act('adm-aud-clear', () => { AF.q = ''; AF.action = ''; AF.page = 1; refresh(true); });

// ── آمار ────────────────────────────────────────────────────
async function stats() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/stats', { days: SF.days })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const series = r.series || [];
  const summary = r.summary || {};
  const byCat = Object.entries(r.byCat || {}).sort((a, b) => b[1].sold - a[1].sold);
  const byBrand = Object.entries(r.byBrand || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const missedSearches = r.missedSearches || [];
  const metric = SF.metric;
  const points = series.map((d) => ({
    label: d.date,
    short: d.date.slice(5),
    value: metric === 'revenue' ? d.revenue : (metric === 'visits' ? d.visits : d.orders),
  }));
  const totals = series.reduce((a, d) => ({
    orders: a.orders + d.orders, revenue: a.revenue + d.revenue, visits: a.visits + d.visits, unique: a.unique + d.unique,
  }), { orders: 0, revenue: 0, visits: 0, unique: 0 });

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('chart')} ${t('adm.stats')}</h2>
      <form class="row row-wrap" data-act="adm-st-filter" data-live>
        <select class="select select-sm" name="days">
          ${[7, 30, 90].map((d) => h`<option value="${d}" ${SF.days === d ? 'selected' : ''}>${fmtNum(d)} ${L('روز', 'days')}</option>`)}
        </select>
        <select class="select select-sm" name="metric">
          <option value="orders" ${metric === 'orders' ? 'selected' : ''}>${t('adm.stOrders')}</option>
          <option value="revenue" ${metric === 'revenue' ? 'selected' : ''}>${t('adm.stRevenue')}</option>
          <option value="visits" ${metric === 'visits' ? 'selected' : ''}>${t('adm.stVisits')}</option>
        </select>
      </form>
    </div>

    <div class="kpi-grid mb">
      ${kpiCard({ icon: 'package-check', label: t('adm.stOrders'), value: fmtNum(summary.orders || 0), sub: `${L('در این بازه', 'in range')}: ${fmtNum(totals.orders)}` })}
      ${kpiCard({ icon: 'wallet', label: t('adm.stRevenue'), value: fmtMoney(summary.revenue || 0), sub: `${L('در این بازه', 'in range')}: ${fmtMoney(totals.revenue)}` })}
      ${kpiCard({ icon: 'users', label: t('adm.stUsers'), value: fmtNum(summary.users || 0), sub: `${L('بازدید یکتا', 'unique visits')}: ${fmtNum(totals.unique)}` })}
      ${kpiCard({ icon: 'box', label: t('adm.stProducts'), value: fmtNum(summary.products || 0), sub: `${L('ارزش موجودی', 'stock value')}: ${fmtMoney(summary.stockValue || 0)}` })}
      ${kpiCard({ icon: 'scale', label: t('adm.stAvg'), value: fmtMoney(summary.avgOrder || 0), sub: `${L('میانگین سبد', 'average basket')}` })}
      ${kpiCard({ icon: 'eye', label: t('adm.stVisits'), value: fmtNum(totals.visits), sub: `${L('در این بازه', 'in range')}` })}
    </div>

    <div class="card">
      <strong>${icon('chart')} ${metric === 'revenue' ? t('adm.stRevenue') : (metric === 'visits' ? t('adm.stVisits') : t('adm.stOrders'))} — ${fmtNum(SF.days)} ${L('روز', 'days')}</strong>
      <div class="mt-s">${barChart(points, { height: 150 })}</div>
    </div>

    <div class="cart-grid mt">
      <div class="col card">
        <strong>${icon('layers')} ${t('adm.stByCat')}</strong>
        ${tableHtml(
          [
            { label: t('common.category') }, { label: t('common.products'), cls: 'num' },
            { label: t('pdp.sold'), cls: 'num' }, { label: t('common.stock'), cls: 'num' }, { label: t('adm.stRevenue'), cls: 'num' },
          ],
          byCat.map(([name, v]) => h`
            <tr>
              <td class="b">${esc(name)}</td>
              <td class="num">${fmtNum(v.products)}</td>
              <td class="num">${fmtNum(v.sold)}</td>
              <td class="num">${fmtNum(v.stock)}</td>
              <td class="num">${fmtMoney(v.revenue)}</td>
            </tr>`),
          { emptyText: t('common.noData') },
        )}
      </div>
      <aside class="col card">
        <strong>${icon('tag')} ${t('adm.stByBrand')}</strong>
        <div class="mt-s">
          ${byBrand.length ? byBrand.map(([name, sold]) => {
            const max = byBrand[0][1] || 1;
            return h`
            <div class="brand-row">
              <span class="tiny">${esc(name)}</span>
              <span class="progress"><i data-w="${Math.max(4, Math.round((sold / max) * 100))}%"></i></span>
              <span class="tiny b">${fmtNum(sold)}</span>
            </div>`;
          }).join('') : h`<p class="muted small">${t('common.noData')}</p>`}
        </div>
      </aside>
    </div>
    
    <div class="card mt">
      <strong>${icon('search')} ${isFa() ? 'جستجوهای بدون نتیجه (کالاهای ناموجود)' : 'Missed Searches (Not in stock)'}</strong>
      ${!missedSearches.length ? h`<p class="muted small mt-s">${t('common.empty')}</p>` :
        tableHtml(
          [
            { label: isFa() ? 'عبارت جستجو شده' : 'Query' },
            { label: isFa() ? 'دفعات جستجو' : 'Count', cls: 'num' }
          ],
          missedSearches.map(m => h`
            <tr>
              <td>${esc(m.q)}</td>
              <td class="num"><span class="badge-pill bp-warn">${fmtNum(m.count)}</span></td>
            </tr>`)
        )
      }
    </div>`;
}

act('adm-st-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  SF.days = Number(fd.get('days') || 30);
  SF.metric = String(fd.get('metric') || 'orders');
  refresh(true);
});

// ── خروجی و پشتیبان ─────────────────────────────────────────
const KINDS = [
  { id: 'products', icon: 'box', label: () => t('common.products') },
  { id: 'orders', icon: 'package-check', label: () => t('common.orders') },
  { id: 'users', icon: 'users', label: () => t('common.users') },
  { id: 'reviews', icon: 'star', label: () => t('adm.reviews') },
  { id: 'tickets', icon: 'ticket', label: () => t('adm.tickets') },
  { id: 'audit', icon: 'history', label: () => t('adm.audit') },
  { id: 'all', icon: 'download', label: () => L('همهٔ داده‌ها', 'Everything') },
];

function data() {
  const isOwner = S.me?.role === 'owner';
  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('download')} ${t('adm.data')}</h2>
        <p class="muted small">${t('adm.dataHint')}</p>
      </div>
    </div>

    <div class="card">
      <strong>${icon('file')} ${t('adm.dExport')}</strong>
      <div class="exp-grid mt-s">
        ${KINDS.map((k) => h`
          <div class="exp-item">
            <span class="exp-ic">${icon(k.icon)}</span>
            <span class="grow b small">${k.label()}</span>
            <span class="act">
              <a class="btn btn-ghost btn-xs" href="${api.url(`/api/admin/export/${k.id}`, { format: 'csv' })}" download>${L('CSV', 'CSV')}</a>
              <a class="btn btn-ghost btn-xs" href="/api/admin/export/${k.id}" download>JSON</a>
            </span>
          </div>`).join('')}
      </div>
    </div>

    <div class="dev-grid mt">
      <div class="card">
        <strong>${icon('save')} ${t('adm.dBackup')}</strong>
        <p class="muted small mt-s">${t('adm.dBackupHint')}</p>
        ${isOwner
          ? h`<button class="btn btn-primary btn-sm mt-s" data-act="adm-d-backup">${icon('save')} ${t('adm.dBackup')}</button>`
          : h`<p class="notice notice-warn mt-s">${icon('lock')}<span>${L('فقط مالک می‌تواند پشتیبان بگیرد.', 'Only the owner can create backups.')}</span></p>`}
      </div>
      <div class="card">
        <strong>${icon('refresh')} ${t('adm.dCleanup')}</strong>
        <p class="muted small mt-s">${t('adm.dCleanupHint')}</p>
        <button class="btn btn-outline btn-sm mt-s" data-act="adm-d-cleanup">${icon('trash')} ${t('adm.dCleanup')}</button>
      </div>
    </div>`;
}

act('adm-d-backup', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const r = await api.post('/api/admin/backup', {});
      toastSuccess(`${t('adm.dBackup')}: ${r.file} (${fmtNum(r.sizeKb || 0)} KB)`);
    } catch (err) { toastApiError(err); }
  });
});

act('adm-d-cleanup', async (e, el) => {
  const ok = await confirmDialog({ text: L('رویدادهای قدیمی‌تر از ۹۰ روز و نشست‌های منقضی پاک شوند؟', 'Remove audit entries older than 90 days and expired sessions?'), danger: true });
  if (!ok) return;
  await withBusy(el, async () => {
    try {
      const r = await api.post('/api/admin/maintenance/cleanup', {});
      toastSuccess(`${L('رویداد', 'audit')}: ${fmtNum(r.auditRemoved || 0)} · ${L('نشست', 'sessions')}: ${fmtNum(r.sessionsRemoved || 0)}`);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root, ctx) {
  applyDyn(root);
  if (ctx?.params?.section === 'audit') {
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    const pg = Number(p.get('p') || 0);
    if (pg && pg !== AF.page) { AF.page = pg; refresh(true); }
  }
  return null;
}

const VF = { q: '' };
async function visitors() {
  let r = { items: [], total: 0 };
  try { r = await api.get(api.url('/api/admin/visitors', { q: VF.q || '' })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('users')} ${t('adm.visitors')} <span class="muted small">(${fmtNum(r.total || 0)})</span></h2>
      <form class="row" data-act="adm-vis-filter">
        <input class="input" name="q" value="${esc(VF.q || '')}" placeholder="${t('common.search')}">
        <button class="btn btn-ghost" type="submit">${icon('search')}</button>
      </form>
    </div>
    <div class="card">
      ${r.items?.length ? h`<div class="table-wrap"><table class="table">
        <thead><tr><th>${t('common.date')}</th><th>IP</th><th>${t('adm.uDevice')}</th><th>${t('adm.uBrowser')}</th><th>${t('adm.uRegion')}</th><th>${t('adm.uPath')}</th><th>${t('common.user')}</th></tr></thead>
        <tbody>${r.items.map((v) => h`<tr>
          <td class="tiny nowrap">${fmtDate(v.at)}</td>
          <td class="mono tiny">${esc(v.ip || '')}</td>
          <td class="tiny">${esc(v.os || '')} · ${esc(v.device || '')}${v.screen ? h`<div class="muted tiny">${esc(v.screen)}</div>` : ''}</div></td>
          <td class="tiny">${esc(v.browser || '')}</td>
          <td class="tiny">${esc(v.tz || '')}<div class="muted tiny">${esc(v.lang || '')}</div></td>
          <td class="mono tiny">${esc(v.path || '/')}</td>
          <td class="tiny">${v.userId ? h`<a href="#/admin/users/${v.userId}">${icon('user')}</a>` : h`<span class="muted">${t('adm.guest')}</span>`}</td>
        </tr>`)}</tbody></table></div>` : emptyState({ icon: 'users', title: t('common.noResult') })}
    </div>`;
}
act('adm-vis-filter', (e, form) => { e.preventDefault(); VF.q = form.q.value; refresh(true); });
