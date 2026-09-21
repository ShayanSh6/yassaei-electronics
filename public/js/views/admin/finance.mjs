// ─────────────────────────────────────────────────────────────
//  سود و زیان (مالی): سود خالص امروز / این ماه / امسال بر مبنای
//  فاکتورهای پرداخت‌شده؛ هزینهٔ خرید هر قلم از قیمت فروش نهایی کسر می‌شود.
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, fmtDate } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { kpiCard, barChart, tableHtml, statusBadge, productImage } from '../../components.mjs';
import { errorState, toast } from '../../ui.mjs';
import { act } from '../../actions.mjs';

const L = (fa, en) => (isFa() ? fa : en);

let lastFinanceData = null;

const profitBadge = (v) => {
  const cls = v > 0 ? 'bp-success' : v < 0 ? 'bp-danger' : 'bp-info';
  return h`<span class="badge-pill ${cls}">${fmtMoney(v)}</span>`;
};

export async function render() {
  let d = null;
  try { d = await api.get('/api/admin/finance'); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }

  lastFinanceData = d;
  const cur = d.currency || 'تومان';
  const sub = (a) => h`${L('فروش', 'Sales')}: ${fmtMoney(a?.revenue || 0)} · ${L('هزینه', 'Cost')}: ${fmtMoney(a?.cost || 0)} · ${fmtNum(a?.orders || 0)} ${L('فاکتور', 'invoices')}`;
  const chart = (d.daily || []).map((c) => ({ label: c.label, short: c.short, value: Math.max(0, c.profit || 0) }));

  return h`
    <div class="row row-between row-wrap mb-s">
      <div class="row gap-s">
        <h2 class="section-title">${icon('dollar')} ${L('سود و زیان (مالی)', 'Finance / P&L')}</h2>
        <span class="badge-pill bp-info">${L('فقط فاکتورهای پرداخت‌شده', 'Paid invoices only')}</span>
      </div>
      <div class="row gap-s">
        <button type="button" class="btn btn-ghost btn-sm" data-act="adm-fin-print">${icon('printer')} ${L('چاپ گزارش', 'Print report')}</button>
        <a class="btn btn-outline btn-sm" href="/api/admin/export/finance.csv" download="finance.csv">${icon('download')} ${L('خروجی CSV', 'Export CSV')}</a>
      </div>
    </div>
    <p class="muted small mb">${L(
      'سود خالص = مبلغ نهایی فاکتورهای پرداخت‌شده منهای قیمت خرید (cost) کالاهای همان فاکتور. سفارش‌های لغو/مرجوعی و پرداخت‌نشده محاسبه نمی‌شوند.',
      'Net profit = final amount of paid invoices minus the purchase cost (cost) of their items. Cancelled, refunded and unpaid orders are excluded.',
    )}</p>

    <div class="kpi-grid">
      ${kpiCard({ label: L('سود خالص امروز', 'Net profit today'), value: profitBadge(d.today?.profit || 0), sub: sub(d.today) })}
      ${kpiCard({ label: L('سود خالص این ماه', 'Net profit this month'), value: profitBadge(d.month?.profit || 0), sub: sub(d.month) })}
      ${kpiCard({ label: L('سود خالص امسال', 'Net profit this year'), value: profitBadge(d.year?.profit || 0), sub: sub(d.year) })}
      ${kpiCard({ label: L('کل تاریخ', 'All time'), value: profitBadge(d.all?.profit || 0), sub: sub(d.all) })}
    </div>

    <div class="acc-grid acc-grid-eq mt">
      <div class="card">
        <strong>${icon('chart')} ${L('روند سود ۳۰ روز اخیر', 'Profit trend — last 30 days')}</strong>
        ${chart.some((c) => c.value > 0) ? barChart(chart, { height: 140 }) : h`<p class="muted small">${t('common.noData')}</p>`}
      </div>
      <div class="card">
        <div class="row row-between">
          <strong>${icon('wallet')} ${L('کالاهای پرسود امسال', 'Most profitable items this year')}</strong>
        </div>
        ${tableHtml(
          [{ label: '' }, { label: t('adm.pName') }, { label: L('تعداد', 'Qty'), cls: 'num' }, { label: L('سود', 'Profit'), cls: 'num' }],
          (d.top || []).map((p) => h`
            <tr>
              <td><span class="cl-img" data-h="42px" data-w="42px">${productImage({ images: [], glyph: 'chip', name: p.name })}</span></td>
              <td class="nowrap">${esc(p.name || p.id)}</td>
              <td class="num">${fmtNum(p.qty)}</td>
              <td class="num">${fmtMoney(p.profit)}</td>
            </tr>`),
          { emptyText: t('common.noData') },
        )}
      </div>
    </div>

    <div class="card mt">
      <div class="row row-between">
        <strong>${icon('printer')} ${L('آخرین فاکتورهای پرداخت‌شده', 'Latest paid invoices')}</strong>
        <a class="section-link" href="#/admin/orders">${t('common.showAll')}</a>
      </div>
      ${tableHtml(
        [
          { label: L('کد فاکتور', 'Invoice') },
          { label: L('مشتری', 'Customer') },
          { label: L('تاریخ', 'Date') },
          { label: L('اقلام', 'Items'), cls: 'num' },
          { label: L('فروش', 'Sales'), cls: 'num' },
          { label: L('هزینهٔ خرید', 'Cost'), cls: 'num' },
          { label: L('سود خالص', 'Net profit'), cls: 'num' },
          { label: L('وضعیت', 'Status') },
        ],
        (d.recent || []).map((o) => h`
          <tr>
            <td><a class="b mono" href="#/admin/orders">${esc(o.code)}</a></td>
            <td class="nowrap">${esc(o.userName || '—')}</td>
            <td class="nowrap small">${fmtDate(o.at, { time: false, short: true })}</td>
            <td class="num">${fmtNum(o.items)}</td>
            <td class="num">${fmtMoney(o.total)}</td>
            <td class="num muted">${fmtMoney(o.cost)}</td>
            <td class="num">${profitBadge(o.profit)}</td>
            <td>${statusBadge(o.status)}</td>
          </tr>`),
        { emptyText: L('هنوز فاکتور پرداخت‌شده‌ای ثبت نشده است. پس از پرداخت اولین سفارش، سود اینجا نمایش داده می‌شود.', 'No paid invoices yet. Profit appears here after the first paid order.') },
      )}
      ${(d.pending?.orders || 0) > 0 ? h`<p class="muted small mt-s">${icon('info')} ${fmtNum(d.pending.orders)} ${L('سفارش پرداخت‌نشده به ارزش', 'unpaid order(s) worth')} ${fmtMoney(d.pending.revenue)} ${cur} ${L('در این محاسبه لحاظ نشده است.', 'are excluded from these numbers.')}</p>` : ''}
    </div>`;
}

// پنجرهٔ چاپ اختصاصی برای گزارش مالی
act('adm-fin-print', () => {
  const d = lastFinanceData;
  if (!d) return;

  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) {
    toast(t('misc.printBlocked'));
    return;
  }

  const kpiRow = (lbl, o) => `
    <tr>
      <td style="font-weight:bold;padding:8px;border:1px solid #ddd;">${lbl}</td>
      <td style="text-align:left;direction:ltr;padding:8px;border:1px solid #ddd;font-weight:bold;color:${(o?.profit || 0) >= 0 ? '#16a34a' : '#dc2626'}">${Number(o?.profit || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:left;direction:ltr;padding:8px;border:1px solid #ddd;">${Number(o?.revenue || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:left;direction:ltr;padding:8px;border:1px solid #ddd;">${Number(o?.cost || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:center;padding:8px;border:1px solid #ddd;">${Number(o?.orders || 0).toLocaleString('fa-IR')}</td>
    </tr>
  `;

  const topRows = (d.top || []).map((p, idx) => `
    <tr>
      <td style="text-align:center;padding:6px;border:1px solid #ddd;">${idx + 1}</td>
      <td style="padding:6px;border:1px solid #ddd;">${p.name || p.id}</td>
      <td style="text-align:center;padding:6px;border:1px solid #ddd;">${Number(p.qty || 0).toLocaleString('fa-IR')}</td>
      <td style="text-align:left;direction:ltr;padding:6px;border:1px solid #ddd;">${Number(p.revenue || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:left;direction:ltr;padding:6px;border:1px solid #ddd;font-weight:bold;color:#16a34a;">${Number(p.profit || 0).toLocaleString('fa-IR')} تومان</td>
    </tr>
  `).join('');

  const recentRows = (d.recent || []).map((o) => `
    <tr>
      <td style="font-family:monospace;padding:6px;border:1px solid #ddd;">${o.code}</td>
      <td style="padding:6px;border:1px solid #ddd;">${o.userName || '—'}</td>
      <td style="text-align:center;padding:6px;border:1px solid #ddd;">${fmtDate(o.at, { time: false, short: true })}</td>
      <td style="text-align:center;padding:6px;border:1px solid #ddd;">${Number(o.items || 0).toLocaleString('fa-IR')}</td>
      <td style="text-align:left;direction:ltr;padding:6px;border:1px solid #ddd;">${Number(o.total || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:left;direction:ltr;padding:6px;border:1px solid #ddd;color:#666;">${Number(o.cost || 0).toLocaleString('fa-IR')} تومان</td>
      <td style="text-align:left;direction:ltr;padding:6px;border:1px solid #ddd;font-weight:bold;color:${(o.profit || 0) >= 0 ? '#16a34a' : '#dc2626'}">${Number(o.profit || 0).toLocaleString('fa-IR')} تومان</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>گزارش مالی و سود و زیان — فروشگاه یاسایی</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #111; line-height: 1.5; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 4px 0; }
    h2 { font-size: 14px; margin: 20px 0 8px 0; border-bottom: 2px solid #333; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #f3f4f6; padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px; }
    .meta { font-size: 12px; color: #555; }
    @media print {
      body { margin: 10mm; font-size: 11px; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:15px;display:flex;gap:10px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🖨️ چاپ گزارش</button>
    <button onclick="window.close()" style="padding:8px 16px;background:#e5e7eb;border:none;border-radius:6px;cursor:pointer;">بستن پنجره</button>
  </div>
  <div class="header">
    <div>
      <h1>فروشگاه لوازم الکترونیک و الکتریکی یاسایی</h1>
      <div class="meta">گزارش مالی و سود و زیان (فقط فاکتورهای پرداخت‌شده)</div>
    </div>
    <div style="text-align:left;direction:ltr;" class="meta">
      <div>تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}</div>
      <div>زمان: ${new Date().toLocaleTimeString('fa-IR')}</div>
    </div>
  </div>

  <h2>خلاصهٔ وضعیت عملکرد و سود خالص</h2>
  <table>
    <thead>
      <tr>
        <th>دوره</th>
        <th>سود خالص</th>
        <th>فروش ناخالص</th>
        <th>هزینهٔ خرید (Cost)</th>
        <th style="text-align:center;">تعداد فاکتور</th>
      </tr>
    </thead>
    <tbody>
      ${kpiRow('امروز', d.today)}
      ${kpiRow('این ماه (شمسی)', d.month)}
      ${kpiRow('امسال (شمسی)', d.year)}
      ${kpiRow('کل تاریخ', d.all)}
    </tbody>
  </table>

  ${topRows ? `
  <h2>کالاهای پرسود امسال</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:40px;">ردیف</th>
        <th>نام کالا</th>
        <th style="text-align:center;width:60px;">تعداد</th>
        <th>فروش</th>
        <th>سود خالص</th>
      </tr>
    </thead>
    <tbody>
      ${topRows}
    </tbody>
  </table>` : ''}

  ${recentRows ? `
  <h2>آخرین فاکتورهای پرداخت‌شده</h2>
  <table>
    <thead>
      <tr>
        <th>کد فاکتور</th>
        <th>مشتری</th>
        <th style="text-align:center;">تاریخ</th>
        <th style="text-align:center;">اقلام</th>
        <th>مبلغ فروش</th>
        <th>هزینهٔ خرید</th>
        <th>سود خالص</th>
      </tr>
    </thead>
    <tbody>
      ${recentRows}
    </tbody>
  </table>` : ''}

  <script>
    setTimeout(() => { window.print(); }, 400);
  <\\/script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
});

export const title = () => (isFa() ? 'سود و زیان (مالی)' : 'Finance / P&L');
