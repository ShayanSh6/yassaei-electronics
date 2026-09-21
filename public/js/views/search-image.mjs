// ─────────────────────────────────────────────────────────────
//  جست‌وجوی تصویری (مشابه Google Lens) — هش در مرورگر محاسبه می‌شود
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtNum, fileToDataURL, applyDyn } from '../lib/dom.mjs';
import { t } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { fingerprints } from '../lib/vision.mjs';
import { toastApiError, withBusy } from '../ui.mjs';
import { productGrid, emptyState } from '../components.mjs';

export async function render() {
  return h`
    <div class="section-head"><div>
      <h1 class="section-title">${icon('camera')} ${t('search.imageTitle')}</h1>
      <p class="section-sub">${t('search.imageText')}</p>
    </div></div>

    <div class="card t-center" data-drop>
      <span class="empty-ic">${icon('image')}</span>
      <p class="muted">${t('search.imageHint')}</p>
      <div class="row center row-wrap mt">
        <label class="btn btn-primary">${icon('upload')} ${t('search.pickFile')}
          <input type="file" accept="image/jpeg,image/png,image/webp" data-file hidden>
        </label>
        <label class="btn btn-ghost">${icon('camera')} ${t('search.takePhoto')}
          <input type="file" accept="image/*" capture="environment" data-file hidden>
        </label>
      </div>
      <div class="mt" data-preview hidden>
        <img class="si-preview" data-pimg alt="">
      </div>
    </div>

    <section class="section" data-results hidden></section>`;
}

export function mount(root) {
  applyDyn(root);
  const drop = root.querySelector('[data-drop]');
  const results = root.querySelector('[data-results]');

  const handleFile = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toastApiError({ code: 'invalid_type', message: t('err.generic') }); return; }
    if (file.size > 4 * 1024 * 1024) { toastApiError({ code: 'payload_too_large', message: t('err.generic') }); return; }
    const dataUrl = await fileToDataURL(file);
    const prev = root.querySelector('[data-preview]');
    prev.hidden = false;
    root.querySelector('[data-pimg]').src = dataUrl;
    results.hidden = false;
    results.innerHTML = h`<div class="row center">${icon('refresh')} ${t('search.imageIndexing')}</div>`;
    await withBusy(null, async () => {
      try {
        const fp = await fingerprints(dataUrl);
        const r = await api.post('/api/search/image', fp);
        if (!r.indexed) {
          results.innerHTML = emptyState({ icon: 'image', title: t('search.imageNoIndex'), text: t('adm.isHint') });
          return;
        }
        if (!r.items?.length) {
          results.innerHTML = emptyState({ icon: 'search', title: t('search.imageNoMatch'), action: { href: '#/products', label: t('cart.goShopping') } });
          return;
        }
        results.innerHTML = h`
          <div class="section-head"><div><h2 class="section-title">${icon('sparkles')} ${fmtNum(r.items.length)} ${t('common.results')}</h2></div></div>
          ${productGrid(r.items.map((p) => ({ ...p, match: p.matchScore })))}
          <div class="row row-wrap mt-s">${r.items.map((p) => h`<span class="chip">${p.name?.slice(0, 24)}… ${fmtNum(p.matchScore)}٪</span>`)}</div>`;
      } catch (err) {
        results.innerHTML = emptyState({ icon: 'alert', title: t('err.generic') });
        toastApiError(err);
      }
    });
  };

  root.querySelectorAll('[data-file]').forEach((inp) => inp.addEventListener('change', () => handleFile(inp.files?.[0])));

  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));

  return null;
}

export const title = () => t('search.imageTitle');
