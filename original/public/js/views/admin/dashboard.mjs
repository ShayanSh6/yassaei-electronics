// ─────────────────────────────────────────────────────────────
//  داشبورد مدیریت: شاخص‌ها، کارهای در انتظار، نمودار، پرفروش‌ها،
//  موجودی کم، آخرین رویدادها و حجم داده
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, fmtDate, timeAgo } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { act } from '../../actions.mjs';
import { can } from '../../state.mjs';
import { kpiCard, barChart, tableHtml, productImage, statusBadge, field, switchField } from '../../components.mjs';
import { errorState, confirmDialog, toastSuccess, toastApiError, withBusy } from '../../ui.mjs';

export async function render() {
  let d = null;
  try { d = await api.get('/api/admin/overview'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const s = d.stats || {};
  const chart = (d.chart || []).map((c) => ({ label: c.date, short: c.date.slice(8), value: c.visits || 0 }));
  if (can('users.view')) startSecPoll();

  return h`
    <div class="kpi-grid">
      ${kpiCard({ label: t('adm.kpi.ordersToday'), value: fmtNum(d.today?.orders || 0), sub: fmtMoney(d.today?.revenue || 0) })}
      ${kpiCard({ label: t('adm.kpi.visits'), value: fmtNum(d.today?.visits || 0), sub: `${t('stats.visitsTotal')}: ${fmtNum(s.visitsTotal || 0)}` })}
      ${kpiCard({ label: t('adm.kpi.revenueTotal'), value: fmtMoney(d.totals?.revenue || 0), sub: `${fmtNum(d.totals?.orders || 0)} ${t('common.orders')}` })}
      ${kpiCard({ label: t('adm.kpi.pending'), value: fmtNum(s.pendingOrders || 0), sub: t('adm.awaiting.orders') })}
      ${kpiCard({ label: t('adm.kpi.products'), value: fmtNum(s.products || 0), sub: `${fmtNum(s.outOfStock || 0)} ${t('stats.outOfStock')}` })}
      ${kpiCard({ label: t('adm.kpi.users'), value: fmtNum(s.customers || 0), sub: `${fmtNum(s.plusMembers || 0)} ${t('stats.plusMembers')}` })}
      ${kpiCard({ label: t('adm.kpi.lowStock'), value: fmtNum((d.lowStock || []).length), sub: t('adm.lowStockList') })}
      ${kpiCard({ label: t('adm.storage'), value: `${fmtNum(d.storage?.sizeKb || 0)} KB`, sub: 'db.json' })}
    </div>

    <div class="section-head mt"><div><h2 class="section-title">${icon('alert')} ${t('adm.awaiting')}</h2></div></div>
    <div class="kpi-grid">
      ${can('reviews.moderate') ? awaitCard('star', t('adm.awaiting.reviews'), d.awaiting?.reviews, '#/admin/reviews') : ''}
      ${can('tickets.manage') ? awaitCard('ticket', t('adm.awaiting.tickets'), d.awaiting?.tickets, '#/admin/tickets') : ''}
      ${can('orders.view') ? awaitCard('package-check', t('adm.awaiting.orders'), d.awaiting?.orders, '#/admin/orders') : ''}
      ${can('feedback.manage') ? awaitCard('flag', t('adm.awaiting.feedback'), d.awaiting?.feedback, '#/admin/feedback') : ''}
      ${can('tickets.manage') ? awaitCard('headset', t('adm.awaiting.chat'), d.awaiting?.support, '#/admin/support') : ''}
    </div>

    <div class="card mt">
      <strong>${icon('chart')} ${t('adm.chart')}</strong>
      ${chart.length ? barChart(chart, { height: 140 }) : h`<p class="muted small">${t('common.noData')}</p>`}
    </div>

    <div class="acc-grid acc-grid-eq mt">
      <div class="card">
        <strong>${icon('star')} ${t('adm.topSelling')}</strong>
        ${tableHtml(
          [{ label: '' }, { label: t('adm.pName') }, { label: t('pdp.sold'), cls: 'num' }, { label: t('common.stock'), cls: 'num' }, { label: t('common.price'), cls: 'num' }],
          (d.topSelling || []).map((p) => h`
            <tr>
              <td><span class="cl-img" data-h="42px" data-w="42px">${productImage({ ...p, images: p.image ? [p.image] : [] })}</span></td>
              <td><a class="b" href="#/admin/products/${p.id}">${esc(isFa() ? p.name : p.name)}</a></td>
              <td class="num">${fmtNum(p.sold)}</td>
              <td class="num">${fmtNum(p.stock)}</td>
              <td class="num">${fmtMoney(p.price)}</td>
            </tr>`),
          { emptyText: t('common.noData') },
        )}
      </div>
      <div class="card">
        <strong>${icon('box')} ${t('adm.lowStockList')}</strong>
        ${tableHtml(
          [{ label: t('adm.pName') }, { label: t('common.available'), cls: 'num' }, { label: '' }],
          (d.lowStock || []).map((p) => h`
            <tr>
              <td class="nowrap">${esc(p.name)}</td>
              <td class="num"><span class="badge-pill ${p.inStock ? 'bp-warn' : 'bp-danger'}">${fmtNum(Math.max(0, (p.stock || 0) - (p.reserved || 0)))}</span></td>
              <td><a class="btn btn-ghost btn-xs" href="#/admin/products/${p.id}">${t('common.edit')}</a></td>
            </tr>`),
          { emptyText: t('common.noData') },
        )}
      </div>
    </div>

    ${can('users.view') || can('settings.edit') ? h`
    <div class="acc-grid acc-grid-eq mt">
      ${can('users.view') ? h`
      <div class="card" id="secLiveCard">
        <div class="row row-between">
          <strong>${icon('shield')} ${t('adm.secTitle')}</strong>
          <span class="badge-pill bp-success tiny" id="secState">…</span>
        </div>
        <div class="kpi-grid mt-s" id="secKpis"></div>
        <div class="mt-s" id="secTop"></div>
        ${can('settings.edit') ? h`
        <p class="mt-s"><a class="btn btn-ghost btn-sm" href="#/admin/settings/security">${icon('shield')} ${isFa() ? 'تنظیمات امنیت و محافظت از کد' : 'Security & code protection settings'}</a></p>
        <form class="form-grid mt" id="secForm" data-act="adm-sec-save">
          ${switchField({ label: t('adm.secQueueEnabled'), desc: t('adm.secQueueDesc'), name: 'queueEnabled', checked: true })}
          ${field({ label: t('adm.secMaxConc'), name: 'maxConcurrent', type: 'number', value: '80', attrs: 'min="5" max="5000" inputmode="numeric"' })}
          ${field({ label: t('adm.secTriggerRps'), name: 'triggerRps', type: 'number', value: '40', attrs: 'min="5" max="2000" inputmode="numeric"' })}
          ${field({ label: t('adm.secPassTtl'), name: 'passTtlMin', type: 'number', value: '30', attrs: 'min="5" max="240" inputmode="numeric"' })}
          ${field({ label: t('adm.secPoll'), name: 'pollSec', type: 'number', value: '4', attrs: 'min="2" max="20" inputmode="numeric"' })}
          ${field({ label: t('adm.secFloodBan'), name: 'floodBanPerMin', type: 'number', value: '2500', attrs: 'min="500" max="100000" inputmode="numeric"' })}
          ${field({ label: t('adm.secFloodMin'), name: 'floodBanMin', type: 'number', value: '15', attrs: 'min="1" max="1440" inputmode="numeric"' })}
          <button class="btn btn-primary btn-sm span-2" type="submit">${icon('save')} ${t('common.save')}</button>
        </form>` : ''}
      </div>` : ''}
      ${can('settings.edit') ? h`
      <div class="card">
        <strong>${icon('terminal')} ${t('adm.console')}</strong>
        <p class="muted small mt-s">${t('adm.consoleHint')}</p>
        <button class="btn btn-danger btn-sm mt-s" data-act="adm-sys-restart">${icon('zap')} ${t('adm.sysRestart')}</button>
        <p class="muted small mt">${t('adm.sysResetLabel')}</p>
        <div class="row row-wrap mt-s">
          <button class="btn btn-ghost btn-xs" data-act="adm-sys-reset" data-what="audit">${t('adm.sysReset.audit')}</button>
          <button class="btn btn-ghost btn-xs" data-act="adm-sys-reset" data-what="carts">${t('adm.sysReset.carts')}</button>
          <button class="btn btn-ghost btn-xs" data-act="adm-sys-reset" data-what="visits">${t('adm.sysReset.visits')}</button>
          <button class="btn btn-ghost btn-xs" data-act="adm-sys-reset" data-what="visitors">${t('adm.sysReset.visitors')}</button>
        </div>
      </div>` : ''}
    </div>` : ''}

    ${can('audit.view') ? h`
    <div class="card mt">
      <div class="row row-between">
        <strong>${icon('history')} ${t('adm.recentAudit')}</strong>
        <a class="section-link" href="#/admin/audit">${t('common.showAll')}</a>
      </div>
      ${tableHtml(
        [{ label: t('common.date') }, { label: t('adm.auditActor') }, { label: t('adm.auditAction') }, { label: t('adm.auditTarget') }],
        (d.recentAudit || []).map((a) => h`
          <tr>
            <td class="nowrap tiny">${timeAgo(a.at)}</td>
            <td class="tiny">${esc(a.actorName || '')} <span class="muted">(${esc(a.actorRole || '')})</span></td>
            <td class="mono tiny">${esc(a.action || '')}</td>
            <td class="tiny muted">${esc(String(a.target || '').slice(0, 40))}</td>
          </tr>`),
        { emptyText: t('common.noData') },
      )}
    </div>` : ''}`;
}

function awaitCard(ic, label, count, href) {
  return h`
    <a class="kpi await-card ${count > 0 ? 'hot' : ''}" href="${href}">
      <div class="l">${icon(ic)} ${label}</div>
      <div class="v">${fmtNum(count || 0)}</div>
    </a>`;
}

// ── پدافند و صف: نظرسنجی زنده ───────────────────────────────
let secTimer = 0;
let secMisses = 0;
async function refreshSec() {
  const card = document.getElementById('secLiveCard');
  if (!card) { if (++secMisses >= 3 && secTimer) { clearInterval(secTimer); secTimer = 0; } return; }
  secMisses = 0;
  let d;
  try { d = await api.get('/api/admin/system/load'); } catch { return; }
  const kpis = document.getElementById('secKpis');
  if (kpis) kpis.innerHTML = [
    `<div class="kpi"><div class="l">${t('adm.secInflight')}</div><div class="v">${fmtNum(d.inflight)}</div></div>`,
    `<div class="kpi"><div class="l">${t('adm.secRps')}</div><div class="v">${fmtNum(d.rps)}</div></div>`,
    `<div class="kpi"><div class="l">${t('adm.secQueued')}</div><div class="v ${d.queued > 0 ? 'hot' : ''}">${fmtNum(d.queued)}</div></div>`,
    `<div class="kpi"><div class="l">${t('adm.secAutoBans')}</div><div class="v">${fmtNum((d.autoBans || []).length)}</div></div>`,
  ].join('');
  const top = document.getElementById('secTop');
  if (top) {
    top.innerHTML = (d.top || []).length
      ? `<div class="muted tiny">${t('adm.secTop')}</div><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th class="num">${t('adm.secPerMin')}</th></tr></thead><tbody>${d.top.map((x) => `<tr><td class="mono tiny">${esc(x.ip)}</td><td class="num tiny">${fmtNum(x.perMin)}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted tiny">${t('adm.secTopEmpty')}</p>`;
  }
  const st = document.getElementById('secState');
  if (st) {
    const busy = d.queued > 0 || d.inflight > (d.sec?.maxConcurrent || 80) || d.rps > (d.sec?.triggerRps || 40);
    st.textContent = busy ? t('adm.secBusy') : t('adm.secNormal');
    st.className = `badge-pill tiny ${busy ? 'bp-warn' : 'bp-success'}`;
  }
  const form = document.getElementById('secForm');
  if (form && !form.dataset.filled) {
    form.dataset.filled = '1';
    // form.elements ممکن است در محیط‌های بدون DOM کامل (هارنس تست/آفلاین) وجود نداشته باشد
    for (const k of ['maxConcurrent', 'triggerRps', 'passTtlMin', 'pollSec', 'floodBanPerMin', 'floodBanMin']) {
      const inp = form.elements?.[k];
      if (inp && d.sec?.[k] != null) inp.value = d.sec[k];
    }
    const sw = form.elements?.['queueEnabled'];
    if (sw) sw.checked = !!d.sec?.queueEnabled;
  }
}
function startSecPoll() {
  if (secTimer) clearInterval(secTimer);
  secMisses = 0;
  setTimeout(refreshSec, 400);
  secTimer = setInterval(refreshSec, 5000);
}

act('adm-sec-save', async (e, form) => {
  e.preventDefault();
  const value = {
    queueEnabled: form.elements['queueEnabled']?.checked ?? true,
    maxConcurrent: Number(form.elements['maxConcurrent']?.value) || 80,
    triggerRps: Number(form.elements['triggerRps']?.value) || 40,
    passTtlMin: Number(form.elements['passTtlMin']?.value) || 30,
    pollSec: Number(form.elements['pollSec']?.value) || 4,
    floodBanPerMin: Number(form.elements['floodBanPerMin']?.value) || 2500,
    floodBanMin: Number(form.elements['floodBanMin']?.value) || 15,
  };
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch('/api/admin/settings/security', { value });
      toastSuccess(t('adm.secSaved'));
      const f = document.getElementById('secForm'); if (f) delete f.dataset.filled;
      refreshSec();
    } catch (err) { toastApiError(err); }
  });
});

export function mount() {
  return () => { if (secTimer) { clearInterval(secTimer); secTimer = null; } };
}

act('adm-sys-restart', async (e, el) => {
  const ok = await confirmDialog({ text: t('adm.sysRestartWarn'), danger: true });
  if (!ok) return;
  await withBusy(el, async () => {
    try { await api.post('/api/admin/system/restart', {}); toastSuccess(t('adm.sysRestarting')); setTimeout(() => location.reload(), 6000); }
    catch (err) { toastApiError(err); }
  });
});
act('adm-sys-reset', async (e, el) => {
  const what = el.dataset.what;
  const ok = await confirmDialog({ text: t(`adm.resetWarn.${what}`), danger: true });
  if (!ok) return;
  await withBusy(el, async () => {
    try { await api.post('/api/admin/system/reset', { what }); toastSuccess(t('adm.resetDone')); }
    catch (err) { toastApiError(err); }
  });
});
