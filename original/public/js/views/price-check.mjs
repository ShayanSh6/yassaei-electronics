// ─────────────────────────────────────────────────────────────
//  نمایش قیمت با بارکد (حالت دستگاه / کیوسک)
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtNum, fmtMoney, applyDyn, esc } from '../lib/dom.mjs';
import { t } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, prodName } from '../state.mjs';
import { toast, toastError } from '../ui.mjs';
import { act } from '../actions.mjs';

let stream = null;
let detector = null;
let raf = 0;
const history = [];

export async function render() {
  return h`
    <div class="section-head">
      <div><h1 class="section-title">${icon('barcode')} ${t('priceCheck.title')}</h1>
      <p class="section-sub">${t('priceCheck.sub')}</p></div>
      <button type="button" class="btn btn-ghost" data-act="pc-fullscreen">${icon('external')} ${t('priceCheck.fullscreen')}</button>
    </div>

    <div class="cart-grid">
      <div class="col">
        <div class="card scan-view">
          <form class="row" data-act="pc-lookup" >
            <input class="input" name="code" placeholder="${t('priceCheck.input')}" data-autofocus autocomplete="off" inputmode="numeric">
            <button class="btn btn-primary" type="submit">${icon('search')} ${t('common.search')}</button>
          </form>
          <div class="row row-wrap center">
            <button type="button" class="btn btn-ghost" data-act="pc-camera">${icon('camera')} ${t('priceCheck.scanCamera')}</button>
            <button type="button" class="btn btn-ghost" hidden data-act="pc-camera-stop">${icon('close')} ${t('priceCheck.stopCamera')}</button>
          </div>
          <div class="scan-frame" data-frame hidden>
            <video playsinline muted></video>
            <span class="scan-line"></span>
            <span class="scan-corner" ></span>
          </div>
          <p class="hint">${t('adm.bScanHint')}</p>
          <input class="pc-wedge" data-wedge autocomplete="off" aria-label="${t('priceCheck.input')}" placeholder="${t('priceCheck.waiting')}">
        </div>
        <div class="card" data-history>
          <strong class="row mb-s">${icon('history')} ${t('priceCheck.lastScan')}</strong>
          <div class="col" data-hlist><p class="muted small">${t('common.noData')}</p></div>
        </div>
      </div>
      <aside class="card price-display" data-result>
        <span class="empty-ic">${icon('barcode')}</span>
        <p class="muted">${t('priceCheck.waiting')}</p>
      </aside>
    </div>`;
}

function showResult(box, p, { error = '' } = {}) {
  if (error) {
    box.innerHTML = h`<span class="empty-ic danger">${icon('alert')}</span><h3>${error}</h3>`;
    return;
  }
  box.innerHTML = h`
    ${p.images?.[0] ? h`<img class="pc-result-img" src="${p.images[0]}" alt="${prodName(p)}" data-glyph="${p.glyph}">` : icon(p.glyph || 'box')}
    <h2 class="mt-s">${prodName(p)}</h2>
    <p class="muted small">${p.brandName || ''} ${p.sku ? `· ${p.sku}` : ''}</p>
    <div class="big">${fmtMoney(p.price, { withUnit: false })}</div>
    <div class="cur">${t('common.toman')}</div>
    ${p.oldPrice > p.price ? h`<p class="pc-old">${fmtMoney(p.oldPrice)}</p>` : ''}
    <div class="mt-s">${p.stock > 0 ? h`<span class="badge-pill bp-success">${t('pdp.stockCount', { n: fmtNum(p.stock) })}</span>` : h`<span class="badge-pill bp-danger">${t('card.outOfStock')}</span>`}</div>
    <a class="btn btn-primary mt" href="#/product/${p.id}">${t('common.details')} ${icon('chevron-left')}</a>`;
}

async function lookup(code, root) {
  const box = root.querySelector('[data-result]');
  try {
    const r = await api.post('/api/scan', { code: String(code).trim() });
    if (r.found && r.product) {
      showResult(box, r.product);
      pushHistory(root, r.product);
      return r.product;
    }
    showResult(box, null, { error: t('priceCheck.notFound') });
  } catch (err) {
    if (err?.status === 404) showResult(box, null, { error: t('priceCheck.notFound') });
    else showResult(box, null, { error: t('err.generic') });
  }
  return null;
}

function pushHistory(root, p) {
  history.unshift({ id: p.id, name: prodName(p), price: p.price, at: new Date().toISOString() });
  if (history.length > 8) history.pop();
  const list = root.querySelector('[data-hlist]');
  if (list) list.innerHTML = history.map((x) => h`<div class="row row-between small"><span class="nowrap">${x.name}</span><span class="b">${fmtNum(x.price)}</span></div>`).join('');
}

export function mount(root) {
  applyDyn(root);
  document.body.classList.add('kiosk-page');

  const wedge = root.querySelector('[data-wedge]');
  let buf = '';
  let lastKey = 0;
  wedge.addEventListener('keydown', (e) => {
    const now = Date.now();
    if (now - lastKey > 120) buf = '';
    lastKey = now;
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = buf.trim();
      buf = '';
      if (code) lookup(code, root);
      return;
    }
    if (e.key.length === 1) buf += e.key;
  });
  wedge.focus();

  act('pc-lookup', (e, form) => {
    e.preventDefault();
    lookup(form.querySelector('[name=code]').value, root);
  });

  act('pc-fullscreen', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => toast(t('misc.printBlocked')));
  });

  act('pc-camera', async (e, el) => {
    const frame = root.querySelector('[data-frame]');
    const video = frame.querySelector('video');
    if (!('BarcodeDetector' in window) && !navigator.mediaDevices?.getUserMedia) { toastError(t('priceCheck.cameraUnsupported')); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();
      frame.hidden = false;
      el.hidden = true;
      root.querySelector('[data-act="pc-camera-stop"]').hidden = false;
      if ('BarcodeDetector' in window) {
        detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
        const tick = async () => {
          if (!stream) return;
          try {
            const codes = await detector.detect(video);
            if (codes?.length) {
              const v = codes[0].rawValue;
              lookup(v, root);
              const input = root.querySelector('[name=code]');
              if (input) input.value = v;
            }
          } catch { /* noop */ }
          raf = setTimeout(tick, 700);
        };
        tick();
      }
    } catch { toastError(t('priceCheck.cameraDenied')); }
  });

  act('pc-camera-stop', (e, el) => {
    stopCamera(root);
    el.hidden = true;
    root.querySelector('[data-act="pc-camera"]').hidden = false;
  });

  return () => { stopCamera(root); document.body.classList.remove('kiosk-page'); };
}

function stopCamera(root) {
  clearTimeout(raf);
  if (stream) { for (const tr of stream.getTracks()) tr.stop(); stream = null; }
  const frame = root?.querySelector('[data-frame]');
  if (frame) frame.hidden = true;
}

export const title = () => t('priceCheck.title');
