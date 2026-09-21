// ── آمار عمومی فروشگاه ─────────────────────────────────────
import { html as h, icon, fmtNum, faDigits } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { S } from '../state.mjs';
import { api } from '../lib/api.mjs';
import { statCard, sectionHead } from '../components.mjs';

export async function render() {
  let data = null;
  try { data = await api.get('/api/stats/public'); } catch { /* noop */ }
  if (!data) return h`<div class="empty"><h4>${t('err.network')}</h4></div>`;
  const stats = data.stats || {};
  const chart = data.chart || [];
  const topProducts = data.topProducts || [];

  const max = Math.max(1, ...chart.map((c) => c.visits));
  const bars = chart.map((c) => {
    const step = Math.min(12, Math.max(1, Math.round((c.visits / max) * 12)));
    return h`<div class="ch-col" title="${c.date}: ${faDigits(c.visits)}">
      <i class="hb-${step}"></i>
      <span>${faDigits(Number(c.date.slice(8, 10)))}</span>
    </div>`;
  }).join('');

  return h`
    <div class="page-head">
      <h1 class="page-h1">${icon('chart')} ${t('stats.title')}</h1>
      <p class="muted small">${t('stats.subtitle')}</p>
    </div>

    <section class="section">
      <div class="stats-grid">
        ${statCard({ icon: 'box', label: t('stats.products'), value: fmtNum(stats.products) })}
        ${statCard({ icon: 'grid', label: t('stats.categories'), value: fmtNum(stats.categories) })}
        ${statCard({ icon: 'cart', label: t('stats.ordersTotal'), value: fmtNum(stats.ordersTotal) })}
        ${statCard({ icon: 'package-check', label: t('stats.delivered'), value: fmtNum(stats.deliveredOrders) })}
        ${statCard({ icon: 'users', label: t('stats.customers'), value: fmtNum(stats.customers) })}
        ${statCard({ icon: 'eye', label: t('stats.visitsTotal'), value: fmtNum(stats.visitsTotal) })}
        ${statCard({ icon: 'chart', label: t('stats.visitsToday'), value: fmtNum(stats.visitsToday) })}
        ${statCard({ icon: 'sparkles', label: t('stats.plusMembers'), value: fmtNum(stats.plusMembers) })}
      </div>
    </section>

    <section class="section">
      ${sectionHead({ titleIcon: 'chart', title: t('stats.chartTitle') })}
      <div class="card chart-card">
        <div class="chart">${bars}</div>
        <p class="hint mt-s">${t('stats.chartHint')}</p>
      </div>
    </section>

    ${topProducts?.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'star', title: t('stats.topTitle') })}
      <div class="list">
        ${topProducts.map((p, i) => h`
          <a class="list-row" href="#/product/${p.id}">
            <span class="rank">${faDigits(i + 1)}</span>
            <span class="grow">
              <span class="b">${isFa() ? p.name : (p.nameEn || p.name)}</span>
              <span class="muted tiny">${isFa() ? p.categoryName : (p.categoryNameEn || p.categoryName)}</span>
            </span>
            <span class="muted small">${icon('eye')} ${faDigits(p.sold || 0)}</span>
          </a>`)}
      </div>
    </section>` : ''}
  `;
}
