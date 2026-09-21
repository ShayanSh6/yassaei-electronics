// ─────────────────────────────────────────────────────────────
//  دستگاه‌ها: چاپگر برچسب + بارکدخوان (اسکنر) و ایندکس جست‌وجوی تصویری
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { tableHtml, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastError, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';
import { fingerprints } from '../../lib/vision.mjs';

const L = (fa, en) => (isFa() ? fa : en);
let ITEMS = [];
let SIZES = [];
let SEL = new Set();
const F = { q: '', size: '40x25', copies: 1 };

export async function render(ctx) {
  if (ctx.params.section === 'imageSearch') return imageSearch();
  return barcode();
}

// ── بارکد و برچسب ───────────────────────────────────────────
async function barcode() {
  try {
    const r = await api.get(api.url('/api/admin/barcode', { q: F.q }));
    ITEMS = r.items || [];
    SIZES = r.labelSizes || [];
    if (!SIZES.find((s) => s.id === F.size) && SIZES.length) F.size = SIZES[0].id;
  } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const noBarcode = ITEMS.filter((p) => !p.barcode).length;

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('barcode')} ${t('adm.barcode')}</h2>
        <p class="muted small">${fmtNum(ITEMS.length)} ${L('کالا', 'products')} · ${fmtNum(noBarcode)} ${L('بدون بارکد', 'without barcode')}</p>
      </div>
      <a class="btn btn-outline btn-sm" href="#/price-check" target="_blank" rel="noopener">${icon('scan')} ${t('adm.bPriceMode')}</a>
    </div>

    <div class="dev-grid">
      <div class="card">
        <strong>${icon('printer')} ${t('adm.bPrinter')}</strong>
        <p class="muted small mt-s">${t('adm.bPrinterHint')}</p>
        <ol class="dev-steps">
          <li>${L('چاپگر برچسب را به دستگاه وصل کن (USB/شبکه).', 'Connect the label printer (USB/network).')}</li>
          <li>${L('در تنظیمات چاپ سیستم، اندازهٔ کاغذ را هم‌اندازهٔ برچسب بگذار.', 'Set the system paper size to your label size.')}</li>
          <li>${L('کالاها را انتخاب و «پیش‌نمایش و چاپ» را بزن.', 'Pick products and press “Preview & print”.')}</li>
        </ol>
        <div class="row row-wrap mt-s">
          <button class="btn btn-ghost btn-sm" data-act="adm-bc-testprint">${icon('printer')} ${L('چاپ آزمایشی', 'Test print')}</button>
        </div>
      </div>

      <div class="card">
        <strong>${icon('scan')} ${t('adm.bScanner')}</strong>
        <p class="muted small mt-s">${t('adm.bScanHint')}</p>
        <form class="row mt-s" data-act="adm-bc-scan">
          <input class="input grow mono" name="code" placeholder="${L('بارکد را اسکن کن…', 'Scan a barcode…')}" autocomplete="off" data-autofocus>
          <button class="btn btn-primary" type="submit">${icon('search')}</button>
        </form>
        <div class="scan-result mt-s" data-scan-result>
          <p class="muted small">${L('دوربین تلفن هم کار می‌کند: از حالت نمایش قیمت استفاده کن.', 'Phone camera works too — use the price-display mode.')}</p>
        </div>
        <p class="tiny muted mt-s">${detectorNote()}</p>
      </div>
    </div>

    <div class="card mt">
      <div class="row row-between row-wrap mb-s">
        <strong>${icon('printer')} ${t('adm.bLabels')}</strong>
        <form class="row row-wrap" data-act="adm-bc-search">
          <input class="input" name="q" value="${esc(F.q)}" placeholder="${t('adm.pName')} / SKU / ${t('pdp.barcode')}">
          <button class="btn btn-ghost btn-sm" type="submit">${icon('search')}</button>
        </form>
      </div>

      <div class="row row-wrap mb-s">
        <select class="select select-sm" data-size>
          ${SIZES.map((s) => h`<option value="${s.id}" ${F.size === s.id ? 'selected' : ''}>${esc(isFa() ? s.fa : `${s.w}×${s.h} mm`)}</option>`)}
        </select>
        <label class="row tiny">${L('تعداد برچسب هر کالا', 'Copies per product')}
          <input class="input copies-in" type="number" min="1" max="20" value="${fmtNum(F.copies)}" data-copies>
        </label>
        <button class="btn btn-ghost btn-sm" data-act="adm-bc-all">${icon('check')} ${L('انتخاب همه', 'Select all')}</button>
        <button class="btn btn-ghost btn-sm" data-act="adm-bc-none">${icon('close')} ${L('پاک کردن', 'Clear')}</button>
        <button class="btn btn-ghost btn-sm" data-act="adm-bc-nocode">${icon('barcode')} ${L('بدون بارکد', 'Without barcode')}</button>
        <span class="badge-pill bp-accent" data-selcount>${fmtNum(SEL.size)}</span>
      </div>

      ${tableHtml(
        [
          { label: '' }, { label: t('common.product') }, { label: t('pdp.barcode') },
          { label: t('common.price'), cls: 'num' }, { label: t('common.stock'), cls: 'num' }, { label: '', cls: 'num' },
        ],
        ITEMS.slice(0, 100).map((p) => h`
          <tr>
            <td><label class="check"><input type="checkbox" data-pick="${p.id}" ${SEL.has(p.id) ? 'checked' : ''}><span class="box">${icon('check')}</span></label></td>
            <td><span class="b">${esc(p.name)}</span><div class="tiny muted mono">${esc(p.sku || '')}</div></td>
            <td class="mono tiny">${p.barcode ? esc(p.barcode) : h`<span class="badge-pill bp-warn">${L('ندارد', 'none')}</span>`}</td>
            <td class="num">${fmtMoney(p.price)}</td>
            <td class="num">${fmtNum(p.stock)}</td>
            <td>${!p.barcode ? h`<button class="btn btn-ghost btn-xs" data-act="adm-bc-gen" data-id="${p.id}">${icon('barcode')} ${t('adm.bGenerate')}</button>` : ''}</td>
          </tr>`),
        { emptyText: t('common.noResult') },
      )}
    </div>

    <div class="card mt no-print">
      <div class="row row-between row-wrap">
        <strong>${icon('eye')} ${t('adm.bPreview')}</strong>
        <div class="row row-wrap">
          <button class="btn btn-outline btn-sm" data-act="adm-bc-build">${icon('refresh')} ${L('ساخت پیش‌نمایش', 'Build preview')}</button>
          <button class="btn btn-primary btn-sm" data-act="adm-bc-print">${icon('printer')} ${t('common.print')}</button>
        </div>
      </div>
      <div class="print-grid mt" data-print-area data-labels></div>
      <p class="hint mt-s">${L('اندازهٔ برچسب در چاپ از متغیر صفحه تنظیم می‌شود؛ اگر برچسب‌ها جابه‌جا چاپ شدند، حاشیهٔ چاپ را در گفت‌وگوی چاپ صفر کن.', 'If labels shift when printing, set the print margins to zero in the print dialog.')}</p>
    </div>`;
}

function detectorNote() {
  return 'BarcodeDetector' in window
    ? h`${icon('check')} ${L('اسکن با دوربین پشتیبانی می‌شود', 'Camera scanning supported')}`
    : h`${icon('info')} ${L('اسکن با دوربین در این مرورگر پشتیبانی نمی‌شود؛ از بارکدخوان سخت‌افزاری استفاده کن.', 'Camera scanning unsupported in this browser; use a hardware scanner.')}`;
}

async function loadBarcodeLib() {
  if (window.JsBarcode) return window.JsBarcode;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/js/vendor/jsbarcode.all.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.JsBarcode;
}

function labelHtml(p, size) {
  const s = SIZES.find((x) => x.id === size) || { w: 40, h: 25 };
  const fmt = /^\d{13}$/.test(p.barcode || '') ? 'EAN13' : 'CODE128';
  return h`
    <div class="label-preview" data-lw="${s.w}" data-lh="${s.h}">
      <span class="ln">${esc(p.name.slice(0, 40))}</span>
      ${p.barcode ? h`<svg data-bc="${esc(p.barcode)}" data-fmt="${fmt}"></svg>` : h`<span class="ln tiny">${L('بدون بارکد', 'no barcode')}</span>`}
      <span class="row row-between w100">
        <span class="ln mono tiny">${esc(p.barcode || p.sku || '')}</span>
        <span class="lp">${fmtNum(p.price)}</span>
      </span>
    </div>`;
}

async function buildLabels(root) {
  const box = root.querySelector('[data-labels]');
  if (!box) return 0;
  const chosen = ITEMS.filter((p) => SEL.has(p.id));
  if (!chosen.length) { box.innerHTML = ''; return 0; }
  const copies = Math.max(1, Number(root.querySelector('[data-copies]')?.value || 1));
  const size = root.querySelector('[data-size]')?.value || F.size;
  const sz = SIZES.find((x) => x.id === size) || { w: 40, h: 25 };
  let htmlOut = '';
  for (const p of chosen) for (let i = 0; i < copies; i++) htmlOut += labelHtml(p, size);
  box.innerHTML = htmlOut;
  box.style.setProperty('--lw', `${sz.w}mm`);
  box.style.setProperty('--lh', `${sz.h}mm`);
  try {
    const JsBarcode = await loadBarcodeLib();
    box.querySelectorAll('svg[data-bc]').forEach((svg) => {
      try {
        JsBarcode(svg, svg.dataset.bc, {
          format: svg.dataset.fmt || 'CODE128', displayValue: false,
          height: Math.max(18, sz.h - 14), width: 1.3, margin: 0, background: '#ffffff', lineColor: '#000000',
        });
      } catch { svg.remove(); }
    });
  } catch {
    toastError(L('کتابخانهٔ بارکد بارگذاری نشد؛ برچسب‌ها بدون بارکد چاپ می‌شوند.', 'Barcode library failed to load; labels print without barcodes.'));
  }
  return chosen.length * copies;
}

// ── کنش‌های بارکد ──────────────────────────────────────────
act('adm-bc-search', (e, form) => {
  e.preventDefault();
  F.q = String(new FormData(form).get('q') || '').trim();
  refresh(true);
});

act('adm-bc-all', () => { ITEMS.slice(0, 100).forEach((p) => SEL.add(p.id)); syncSel(); });
act('adm-bc-none', () => { SEL.clear(); syncSel(); });
act('adm-bc-nocode', () => { SEL = new Set(ITEMS.filter((p) => !p.barcode).map((p) => p.id)); syncSel(); });

function syncSel() {
  document.querySelectorAll('[data-pick]').forEach((c) => { c.checked = SEL.has(c.dataset.pick); });
  const n = document.querySelector('[data-selcount]');
  if (n) n.textContent = fmtNum(SEL.size);
}

act('adm-bc-gen', async (e, el) => {
  try {
    const r = await api.post('/api/admin/barcode/generate', { productId: el.dataset.id, count: 1 });
    const code = r.codes?.[0]?.barcode || r.codes?.[0] || '';
    if (code) { toastSuccess(`${t('adm.bGenerate')}: ${code}`); refresh(true); }
  } catch (err) { toastApiError(err); }
});

act('adm-bc-build', async (e, el) => {
  const root = el.closest('[data-admbody]') || document;
  const n = await buildLabels(root);
  if (!n) toastError(t('adm.bPickFirst'));
  else toastSuccess(`${fmtNum(n)} ${L('برچسب آماده شد', 'labels ready')}`);
});

act('adm-bc-print', async (e, el) => {
  const root = el.closest('[data-admbody]') || document;
  const n = await buildLabels(root);
  if (!n) { toastError(t('adm.bPickFirst')); return; }
  document.body.classList.add('printing-labels');
  const done = () => document.body.classList.remove('printing-labels');
  window.addEventListener('afterprint', done, { once: true });
  setTimeout(() => { window.print(); setTimeout(done, 1200); }, 120);
});

act('adm-bc-testprint', async (e, el) => {
  const root = el.closest('[data-admbody]') || document;
  const box = root.querySelector('[data-labels]');
  if (!box) return;
  SEL = new Set([ITEMS[0]?.id].filter(Boolean));
  syncSel();
  await buildLabels(root);
  document.body.classList.add('printing-labels');
  const done = () => document.body.classList.remove('printing-labels');
  window.addEventListener('afterprint', done, { once: true });
  setTimeout(() => { window.print(); setTimeout(done, 1200); }, 120);
});

act('adm-bc-scan', async (e, form) => {
  e.preventDefault();
  const code = String(new FormData(form).get('code') || '').trim();
  const box = form.closest('.card').querySelector('[data-scan-result]');
  if (!code) return;
  try {
    const r = await api.post('/api/admin/barcode/scan-log', { code });
    const p = r.product;
    box.innerHTML = h`
      <div class="row row-between">
        <div>
          <strong>${esc(p.name)}</strong>
          <div class="tiny muted mono">${esc(p.sku || '')} · ${esc(p.barcode || '')}</div>
        </div>
        <div class="t-end">
          <div class="price-now">${fmtMoney(p.price)}</div>
          <div class="tiny muted">${t('common.stock')}: ${fmtNum(p.stock)}</div>
        </div>
      </div>
      <div class="row row-wrap mt-s">
        <a class="btn btn-ghost btn-xs" href="#/admin/products/${p.id}">${icon('edit')} ${t('common.edit')}</a>
        <a class="btn btn-ghost btn-xs" href="#/product/${p.id}" target="_blank" rel="noopener">${icon('external')} ${t('adm.view')}</a>
      </div>`;
    toastSuccess(t('adm.bFound'));
  } catch (err) {
    box.innerHTML = h`<p class="muted small">${icon('alert')} ${esc(err?.message || t('adm.bNotFound'))}</p>`;
    if (err?.status !== 404) toastApiError(err);
  } finally {
    form.querySelector('[name=code]').value = '';
    form.querySelector('[name=code]').focus();
  }
});

// ── ایندکس جست‌وجوی تصویری ──────────────────────────────────
async function imageSearch() {
  let r = null;
  try { r = await api.get('/api/admin/image-index'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const products = r.products || [];
  const missing = products.filter((p) => !p.indexed);

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('camera')} ${t('adm.imageSearch')}</h2>
        <p class="muted small">${fmtNum(r.indexed || 0)} / ${fmtNum(products.length)} ${L('ایندکس شده', 'indexed')}</p>
      </div>
      <button class="btn btn-primary btn-sm" data-act="adm-ix-run" data-count="${missing.length}">
        ${icon('refresh')} ${missing.length ? `${t('adm.ixIndex')} (${fmtNum(missing.length)})` : t('adm.ixReindex')}
      </button>
    </div>

    <p class="notice notice-info mb">${icon('info')}<span>${t('adm.ixHint')}</span></p>
    <div class="mt-s" data-ix-progress hidden>
      <div class="progress"><i data-ix-bar data-w="0%"></i></div>
      <p class="tiny muted mt-s" data-ix-status></p>
    </div>

    ${products.length ? h`
      <div class="ix-grid">
        ${products.slice(0, 240).map((p) => h`
          <div class="ix-item ${p.indexed ? 'on' : ''}" data-pid="${p.id}">
            ${p.image ? h`<img src="${esc(p.image)}" alt="" loading="lazy" data-h="54px" data-w="54px">` : h`<span class="ix-ph">${icon('image')}</span>`}
            <span class="grow tiny">${esc(p.name.slice(0, 46))}</span>
            ${p.indexed ? h`<span class="badge-pill bp-success tiny">${icon('check')}</span>` : h`<span class="badge-pill bp-muted tiny">${t('common.no')}</span>`}
          </div>`).join('')}
      </div>` : emptyState({ icon: 'image', title: t('common.noData') })}`;
}

act('adm-ix-run', async (e, el) => {
  const onlyMissing = Number(el.dataset.count || 0) > 0;
  const wrap = document.querySelector('[data-ix-progress]');
  const bar = document.querySelector('[data-ix-bar]');
  const status = document.querySelector('[data-ix-status]');
  const items = [...document.querySelectorAll('.ix-item')];
  if (!items.length) return;
  const targets = onlyMissing ? items.filter((x) => !x.classList.contains('on')) : items;
  if (!targets.length) { toastSuccess(t('adm.ixDone')); return; }
  el.disabled = true;
  if (wrap) wrap.hidden = false;
  let done = 0; let ok = 0;
  const batch = [];
  const flush = async () => {
    if (!batch.length) return;
    try {
      const r = await api.post('/api/admin/image-index', { entries: batch.splice(0, batch.length) });
      ok += r.indexed || 0;
    } catch (err) { toastApiError(err); }
  };
  for (const node of targets) {
    const img = node.querySelector('img');
    if (img?.src) {
      try {
        const src = img.src.startsWith('http') && !img.src.startsWith(location.origin)
          ? api.url('/api/admin/image-thumb', { url: img.src })
          : img.src;
        const fp = await fingerprints(src);
        const id = node.dataset.pid;
        if (id) batch.push({ productId: id, dhash: fp.dhash, hist: fp.hist });
      } catch { /* تصویر بارگذاری نشد */ }
    }
    done++;
    if (bar) bar.style.width = `${Math.round((done / targets.length) * 100)}%`;
    if (status) status.textContent = `${fmtNum(done)} / ${fmtNum(targets.length)}`;
    if (batch.length >= 40) await flush();
  }
  await flush();
  el.disabled = false;
  toastSuccess(`${t('adm.ixDone')} — ${fmtNum(ok)}`);
  refresh(true);
});

export function mount(root, ctx) {
  applyDyn(root);
  // شناسهٔ کالا برای ایندکس تصویری
  root.querySelectorAll('[data-pick]').forEach((c) => {
    c.addEventListener('change', () => {
      if (c.checked) SEL.add(c.dataset.pick); else SEL.delete(c.dataset.pick);
      const n = root.querySelector('[data-selcount]');
      if (n) n.textContent = fmtNum(SEL.size);
    });
  });
  root.querySelector('[data-size]')?.addEventListener('change', (e) => { F.size = e.target.value; });
  root.querySelector('[data-copies]')?.addEventListener('change', (e) => { F.copies = Math.max(1, Number(e.target.value) || 1); });
  return null;
}
