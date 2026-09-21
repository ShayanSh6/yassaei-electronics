// ─────────────────────────────────────────────────────────────
//  مقایسهٔ کالاها (جدول مشخصات، جستجوی زنده و افزودن تا پنج کالا)
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, fmtNum, fmtMoney, stars, applyDyn, esc } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, prodName, MAX_COMPARE_ITEMS } from '../state.mjs';

function renderProductCardMini(p, inList = false) {
  const img = p.images?.[0] || '';
  return h`
    <div class="cmp-item-mini" data-id="${p.id}">
      ${img ? h`<img class="cmp-item-thumb" src="${img}" alt="${prodName(p)}" loading="lazy">` : h`<div class="cmp-item-thumb grid place-center">${icon(p.glyph || 'package')}</div>`}
      <div class="cmp-item-title" title="${prodName(p)}">${prodName(p)}</div>
      <div class="cmp-item-price">${raw(fmtMoney(p.price))}</div>
      ${inList
        ? h`<button type="button" class="btn btn-ghost btn-sm" disabled>${icon('check')} در لیست مقایسه</button>`
        : h`<button type="button" class="btn btn-primary btn-sm" data-act="cmp-add" data-id="${p.id}">${icon('plus')} افزودن به مقایسه</button>`}
    </div>`;
}

export async function render() {
  const ids = (S.compare || []).slice(0, MAX_COMPARE_ITEMS);
  const items = ids.length
    ? (await Promise.all(ids.map((id) => api.get(`/api/products/${encodeURIComponent(id)}`).catch(() => null))))
        .filter(Boolean)
        .map((r) => r.product)
    : [];

  // دریافت کالاهای پیشنهادی برای پر کردن سریع مقایسه
  let popular = [];
  try {
    const popRes = await api.get('/api/products?limit=6');
    popular = (popRes.items || []).filter((p) => !ids.includes(p.id)).slice(0, MAX_COMPARE_ITEMS);
  } catch {
    popular = [];
  }

  const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specs || {})))];
  const canAddMore = items.length < MAX_COMPARE_ITEMS;
  const row = (label, cells, extraCell = '') => h`
    <tr>
      <th class="t-start">${label}</th>
      ${cells.map((c) => h`<td>${c}</td>`)}
      ${canAddMore && extraCell !== undefined ? h`<td class="muted t-center">${extraCell}</td>` : ''}
    </tr>`;

  return h`
    <div class="section-head">
      <div>
        <h1 class="section-title">${icon('scale')} ${t('compare.title') || 'مقایسه محصولات'}</h1>
        <p class="section-sub">${fmtNum(items.length)} از ۵ محصول انتخاب شده</p>
      </div>
      <div class="row gap-s">
        ${items.length > 0 ? h`<button type="button" class="btn btn-ghost btn-sm text-danger" data-act="cmp-clear">${icon('trash')} پاک کردن همه</button>` : ''}
        <a href="#/products" class="btn btn-outline btn-sm">${icon('grid')} مشاهده همه محصولات</a>
      </div>
    </div>

    ${items.length > 0
      ? h`
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="t-start">${t('common.product')}</th>
                ${items.map((p) => h`
                  <th>
                    <div class="col center gap-xs">
                      <a href="#/product/${p.id}">
                        ${p.images?.[0] ? h`<img class="table-img" src="${p.images[0]}" alt="${prodName(p)}" data-glyph="${p.glyph}">` : icon(p.glyph || 'package')}
                      </a>
                      <a href="#/product/${p.id}" class="small b link-color t-center" style="max-width:180px">${prodName(p)}</a>
                      <button type="button" class="link-btn text-danger mt-xs" data-act="compare-toggle" data-id="${p.id}">
                        ${icon('trash')} ${t('compare.remove')}
                      </button>
                    </div>
                  </th>`)}
                ${canAddMore
                  ? h`
                    <th style="vertical-align:middle">
                      <div class="cmp-add-placeholder" id="btnFocusSearch">
                        ${icon('plus')}
                        <span class="small b">+ افزودن محصول دیگر</span>
                        <span class="tiny muted">(حداکثر ۵ محصول)</span>
                      </div>
                    </th>`
                  : ''}
              </tr>
            </thead>
            <tbody>
              ${row(t('common.price'), items.map((p) => raw(fmtMoney(p.price))), '—')}
              ${row(t('common.brand'), items.map((p) => isFa() ? p.brandName : (p.brandNameEn || p.brandName) || '—'), '—')}
              ${row(t('common.stock'), items.map((p) => p.stock > 0 ? h`<span class="badge-pill bp-success">${fmtNum(p.stock)} عدد</span>` : h`<span class="badge-pill bp-danger">${t('card.outOfStock')}</span>`), '—')}
              ${row(t('common.rating'), items.map((p) => p.ratingCount ? h`${stars(p.ratingAvg)} ${fmtNum(p.ratingAvg)} (${fmtNum(p.ratingCount)})` : '—'), '—')}
              ${row(t('adm.pAuth'), items.map((p) => t(`auth.${p.authenticity || 'generic'}`)), '—')}
              ${row(t('pdp.warranty'), items.map((p) => p.warrantyMonths ? t('pdp.warrantyMonths', { n: fmtNum(p.warrantyMonths) }) : t('pdp.noWarranty')), '—')}
              ${row(t('pdp.weight'), items.map((p) => p.weight ? `${fmtNum(p.weight)} ${t('pdp.gram')}` : '—'), '—')}
              ${specKeys.map((k) => row(k, items.map((p) => p.specs?.[k] || '—'), '—'))}
              ${row('', items.map((p) => h`<button type="button" class="btn btn-primary btn-sm" data-act="add-cart" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${icon('cart')} ${t('card.addToCart')}</button>`), '')}
            </tbody>
          </table>
        </div>`
      : h`
        <div class="card p-l t-center mb-l">
          <div class="grid place-center mb-m" style="width:54px;height:54px;border-radius:50%;background:var(--accent-soft);color:var(--accent);margin:0 auto">
            ${icon('scale')}
          </div>
          <h2 class="b mb-s">هنوز محصولی را به لیست مقایسه اضافه نکرده‌اید</h2>
          <p class="muted small mb-m">می‌توانید محصول مورد نظر خود را در کادر زیر جستجو کرده یا از گزینه‌های پیشنهادی انتخاب کنید تا در کنار هم مقایسه شوند:</p>
        </div>`}

    ${canAddMore
      ? h`
        <div class="cmp-search-card" id="cmpSearchCard">
          <div class="row row-wrap between center mb-m">
            <div>
              <h3 class="b mb-xs">${icon('search')} ${items.length === 0 ? 'انتخاب و جستجوی محصول برای مقایسه' : 'افزودن محصول دیگر به مقایسه'}</h3>
              <p class="tiny muted">نام یا مدل کالای مورد نظرتان را جستجو کنید تا به جدول مقایسه اضافه شود.</p>
            </div>
            <span class="badge-pill bp-accent">${fmtNum(MAX_COMPARE_ITEMS - items.length)} جای خالی باقی‌مانده</span>
          </div>

          <div class="search-input-wrap relative">
            <input type="search" class="input input-lg" id="cmpSearchInput" placeholder="جستجوی نام یا مدل کالا (مثلاً: هویه، کابل، شارژر، باتری...)" autocomplete="off">
          </div>

          <div id="cmpSearchResults" class="cmp-results-grid" style="display:none"></div>

          ${popular.length > 0
            ? h`
              <div id="cmpPopularSection" class="mt-l">
                <div class="tiny muted b mb-s">کالاهای پیشنهادی برای مقایسه:</div>
                <div class="cmp-results-grid">
                  ${popular.map((p) => renderProductCardMini(p, ids.includes(p.id)))}
                </div>
              </div>`
            : ''}
        </div>`
      : h`
        <div class="card p-m t-center mt-m bg-surface-2 border">
          <span class="badge-pill bp-accent mb-xs">ظرفیت مقایسه تکمیل است</span>
          <p class="tiny muted">شما حداکثر ۵ کالا را در جدول قرار داده‌اید. برای افزودن کالای جدید، یکی از کالاهای موجود را حذف کنید.</p>
        </div>`}
  `;
}

export function mount(root) {
  applyDyn(root);

  const searchInput = root.querySelector('#cmpSearchInput');
  const resultsBox = root.querySelector('#cmpSearchResults');
  const popularSec = root.querySelector('#cmpPopularSection');
  const focusBtn = root.querySelector('#btnFocusSearch');

  if (focusBtn && searchInput) {
    focusBtn.addEventListener('click', () => {
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchInput.focus();
    });
  }

  if (searchInput && resultsBox) {
    let timer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      const q = searchInput.value.trim();
      if (!q) {
        resultsBox.style.display = 'none';
        resultsBox.innerHTML = '';
        if (popularSec) popularSec.style.display = 'block';
        return;
      }

      timer = setTimeout(async () => {
        try {
          const res = await api.get(`/api/products?q=${encodeURIComponent(q)}&limit=8`);
          const items = res.items || [];
          if (!items.length) {
            resultsBox.style.display = 'block';
            resultsBox.innerHTML = `<div class="t-center p-m muted small" style="grid-column: 1/-1">کالایی با عبارت «${esc(q)}» یافت نشد.</div>`;
            if (popularSec) popularSec.style.display = 'none';
            return;
          }

          resultsBox.style.display = 'grid';
          if (popularSec) popularSec.style.display = 'none';
          resultsBox.innerHTML = items.map((p) => {
            const inList = (S.compare || []).includes(p.id);
            const img = p.images?.[0] || '';
            return `
              <div class="cmp-item-mini" data-id="${esc(p.id)}">
                ${img ? `<img class="cmp-item-thumb" src="${esc(img)}" alt="${esc(prodName(p))}" loading="lazy">` : `<div class="cmp-item-thumb grid place-center">${icon(p.glyph || 'package')}</div>`}
                <div class="cmp-item-title" title="${esc(prodName(p))}">${esc(prodName(p))}</div>
                <div class="cmp-item-price">${fmtMoney(p.price)}</div>
                ${inList
                  ? `<button type="button" class="btn btn-ghost btn-sm" disabled>${icon('check')} در لیست مقایسه</button>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-act="cmp-add" data-id="${esc(p.id)}">${icon('plus')} افزودن به مقایسه</button>`}
              </div>`;
          }).join('');
          applyDyn(resultsBox);
        } catch (err) {
          console.error(err);
        }
      }, 220);
    });
  }

  return null;
}

export const title = () => t('compare.title') || 'مقایسه محصولات';
