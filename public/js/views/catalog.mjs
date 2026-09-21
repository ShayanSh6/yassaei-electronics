// ─────────────────────────────────────────────────────────────
//  کاتالوگ: فهرست محصولات با فیلتر، مرتب‌سازی و صفحه‌بندی
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, fmtNum, esc, applyDyn } from '../lib/dom.mjs';
import { t, lang } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, setPref, catById, catName, brandName, feat } from '../state.mjs';
import { productGrid, breadcrumbs, pagination, emptyState } from '../components.mjs';
import { navigate } from '../router.mjs';
import { sheet } from '../ui.mjs';

const SORTS = ['relevant', 'newest', 'oldest', 'cheapest', 'dearest', 'popular', 'rating', 'discount', 'name'];

function q(ctx) { return ctx.query; }

function withQuery(ctx, patch) {
  const p = new URLSearchParams(ctx.query);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '' || v === undefined) p.delete(k);
    else p.set(k, v);
  }
  if (!('page' in patch)) p.delete('page');
  const path = ctx.params.id ? `/category/${ctx.params.id}` : '/products';
  return `#${path}${p.toString() ? `?${p}` : ''}`;
}

export async function render(ctx) {
  const params = new URLSearchParams(ctx.query);
  if (ctx.params.id) params.set('cat', ctx.params.id);
  const query = params;

  const apiQuery = new URLSearchParams();
  for (const k of ['q', 'cat', 'sort', 'min', 'max', 'rating', 'authenticity', 'page']) {
    if (query.get(k)) apiQuery.set(k, query.get(k));
  }
  if (query.get('brand')) apiQuery.set('brand', query.get('brand'));
  if (query.get('inStock') === '1') apiQuery.set('inStock', '1');
  if (query.get('discount') === '1') apiQuery.set('discount', '1');
  if (query.get('oldPrice') === '1' && feat('oldPrice')) apiQuery.set('oldPrice', '1');
  apiQuery.set('limit', '24');

  let data = { items: [], total: 0, pages: 1, page: 1, facets: {} };
  try { data = await api.get(`/api/products?${apiQuery}`); } catch { /* empty */ }

  const items = data.items || [];
  const facets = data.facets || {};
  const cats = S.categories;
  const brands = S.brands;
  const activeCat = ctx.params.id ? catById(ctx.params.id) : (query.get('cat') ? catById(query.get('cat')) : null);
  const selBrands = (query.get('brand') || '').split(',').filter(Boolean);
  const sort = SORTS.includes(query.get('sort')) ? query.get('sort') : 'relevant';
  const page = Number(query.get('page')) || 1;

  const crumb = [];
  if (activeCat) {
    const chain = [];
    let c = activeCat;
    while (c) { chain.unshift(c); c = c.parentId ? catById(c.parentId) : null; }
    for (const x of chain) crumb.push({ label: catName(x), href: `#/category/${x.id}` });
  } else if (query.get('q')) crumb.push({ label: `${t('search.resultsFor')} «${query.get('q')}»` });
  else if (query.get('discount') === '1') crumb.push({ label: t('nav.deals', { default: 'تخفیف‌ها' }) });
  else if (query.get('oldPrice') === '1' && feat('oldPrice')) crumb.push({ label: t('oldPrice.title') });
  else if (query.get('sort') === 'newest') crumb.push({ label: t('nav.new', { default: 'جدیدترین‌ها' }) });
  else crumb.push({ label: t('catalog.title') });

  const fopt = (type, value, label, count, checked) => h`
    <label class="fopt">
      <input type="checkbox" data-f="${type}" value="${value}" ${checked ? 'checked' : ''}>
      <span class="cb">${icon('check')}</span>
      <span>${label}</span>
      ${count !== undefined ? h`<span class="cnt">${fmtNum(count)}</span>` : ''}
    </label>`;

  return h`
    ${breadcrumbs(crumb)}
    <div class="section-head">
      <div>
        <h1 class="section-title">${activeCat ? catName(activeCat) : query.get('q') ? t('search.resultsFor') + ' «' + query.get('q') + '»' : query.get('discount') === '1' ? t('nav.deals', { default: 'تخفیف‌ها' }) : query.get('oldPrice') === '1' && feat('oldPrice') ? t('oldPrice.title') : query.get('sort') === 'newest' ? t('nav.new', { default: 'جدیدترین‌ها' }) : t('catalog.title')}</h1>
        <p class="section-sub">${fmtNum(data.total || 0)} ${t('catalog.count')}</p>
      </div>
      <button type="button" class="btn btn-ghost only-mobile" data-act="cat-filters">${icon('filter')} ${t('catalog.showFilters')}</button>
    </div>

    ${data.didYouMean ? h`<div class="notice notice-info mb">${icon('sparkles')}<span>${t('search.didYouMean')} <a class="section-link" href="${withQuery(ctx, { q: data.didYouMean })}">${data.didYouMean}</a></span></div>` : ''}

    <div class="catalog">
      <aside class="filters card" id="filtersBox" hidden>
        <div class="row row-between mb-s">
          <strong>${t('catalog.filters')}</strong>
          <button type="button" class="link-btn" data-act="cat-clear">${t('catalog.f.clear')}</button>
        </div>

        <div class="fgroup">
          <button type="button" class="fgroup-h" data-act="acc">${t('catalog.f.category')} ${icon('chevron-down')}</button>
          <div class="acc-b fgroup-b" >
            ${cats.filter((c) => !c.parentId).map((c) => fopt('cat', c.id, catName(c), facets.categories?.[c.id], (query.get('cat') || ctx.params.id) === c.id))}
          </div>
        </div>

        <div class="fgroup">
          <button type="button" class="fgroup-h" data-act="acc">${t('catalog.f.brand')} ${icon('chevron-down')}</button>
          <div class="acc-b fgroup-b">
            ${brands.slice(0, 20).map((b) => fopt('brand', b.id, brandName(b), facets.brands?.[b.id], selBrands.includes(b.id)))}
          </div>
        </div>

        <div class="fgroup">
          <div class="fgroup-h">${t('catalog.f.price')}</div>
          <form class="fgroup-b row" data-price-form>
            <input class="input" type="number" min="0" step="10000" name="min" placeholder="${t('common.from')}" value="${query.get('min') || ''}">
            <input class="input" type="number" min="0" step="10000" name="max" placeholder="${t('common.to')}" value="${query.get('max') || ''}">
            <button class="btn btn-ghost btn-xs" type="submit">${t('common.apply')}</button>
          </form>
        </div>

        <div class="fgroup">
          <div class="fgroup-h">${t('catalog.f.availability')}</div>
          <div class="fgroup-b">
            ${fopt('flag', 'inStock', t('catalog.f.inStock'), undefined, query.get('inStock') === '1')}
            ${fopt('flag', 'discount', t('catalog.f.discountOnly'), undefined, query.get('discount') === '1')}
            ${feat('oldPrice') ? fopt('flag', 'oldPrice', t('catalog.f.oldPriceOnly'), undefined, query.get('oldPrice') === '1') : ''}
          </div>
        </div>

        <div class="fgroup">
          <div class="fgroup-h">${t('catalog.f.rating')}</div>
          <div class="fgroup-b">
            ${[4, 3, 2].map((r) => fopt('rating', r, `${fmtNum(r)}★ ${t('common.and')} ${t('common.more')}`, undefined, query.get('rating') === String(r)))}
          </div>
        </div>

        <div class="fgroup">
          <div class="fgroup-h">${t('catalog.f.authenticity')}</div>
          <div class="fgroup-b">
            ${['original', 'highcopy', 'generic'].map((a) => fopt('authenticity', a, t(`auth.${a}`), facets.authenticity?.[a], query.get('authenticity') === a))}
          </div>
        </div>
      </aside>

      <div>
        <div class="toolbar">
          <span class="muted small">${fmtNum(data.total || 0)} ${t('catalog.count')}</span>
          ${feat('oldPrice') ? h`<button type="button" class="btn btn-sm oldprice-chip ${query.get('oldPrice') === '1' ? 'active' : ''}" data-act="cat-oldtoggle" title="${t('oldPrice.sub')}">🔥 ${t('catalog.f.oldPriceOnly').replace('🔥 ', '')}</button>` : ''}
          <span class="grow"></span>
          <label class="row" style="flex-wrap: nowrap;" >
            <span class="muted small nowrap" style="flex-shrink: 0;">${t('common.sort')}</span>
            <button type="button" class="btn" data-act="choose-sort" style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 11px; padding: 7px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 140px; font-size: 14px; font-weight: 500; color: var(--text); flex-shrink: 0;">
              <span data-txt style="white-space: nowrap;">${t(`catalog.sort.${sort}`)}</span>
              ${icon('chevron-down')}
            </button>
          </label>
          <div class="btn-group">
            <button type="button" class="btn ${S.prefs.view !== 'list' ? 'active' : ''}" data-view="grid" title="${t('catalog.viewGrid')}" aria-label="${t('catalog.viewGrid')}">${icon('grid')}</button>
            <button type="button" class="btn ${S.prefs.view === 'list' ? 'active' : ''}" data-view="list" title="${t('catalog.viewList')}" aria-label="${t('catalog.viewList')}">${icon('list')}</button>
          </div>
        </div>

        <div class="active-filters" data-activef>
          ${activeCat ? h`<span class="chip active" data-unf="cat">${catName(activeCat)} <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${selBrands.map((b) => h`<span class="chip active" data-unf="brand" data-v="${b}">${brandName({ id: b, ...(S.brands.find((x) => x.id === b) || {}) })} <span class="chip-close">${icon('close')}</span></span>`)}
          ${query.get('inStock') === '1' ? h`<span class="chip active" data-unf="flag" data-v="inStock">${t('catalog.f.inStock')} <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${query.get('discount') === '1' ? h`<span class="chip active" data-unf="flag" data-v="discount">${t('catalog.f.discountOnly')} <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${query.get('oldPrice') === '1' && feat('oldPrice') ? h`<span class="chip active" data-unf="flag" data-v="oldPrice">🔥 ${t('catalog.f.oldPriceOnly').replace('🔥 ', '')} <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${query.get('min') || query.get('max') ? h`<span class="chip active" data-unf="price">${t('catalog.f.price')} <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${query.get('rating') ? h`<span class="chip active" data-unf="rating">${query.get('rating')}★ <span class="chip-close">${icon('close')}</span></span>` : ''}
          ${query.get('authenticity') ? h`<span class="chip active" data-unf="authenticity">${t(`auth.${query.get('authenticity')}`)} <span class="chip-close">${icon('close')}</span></span>` : ''}
        </div>

        ${items.length
          ? raw(productGrid(items))
          : emptyState({ icon: 'search', title: t('search.noResultTitle'), text: t('search.noResultText'), action: { href: '#/products', label: t('cart.goShopping') } })}

        ${pagination(page, data.pages || 1, (p) => withQuery(ctx, { page: p > 1 ? p : null }))}
      </div>
    </div>
  `;
}

export function mount(root, ctx) {
  applyDyn(root);
  const box = root.querySelector('#filtersBox');
  if (window.innerWidth >= 980) box.hidden = false;

  // Remove this from here, we will handle it via act() below
  const go = (href) => { location.hash = href.replace(/^#/, ''); };

  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    setPref('view', b.dataset.view, { sync: false });
    document.documentElement.setAttribute('data-cards', b.dataset.view === 'list' ? 'list' : 'grid');
    b.closest('.btn-group').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  }));

  const applyFilters = () => {
    const params = new URLSearchParams(ctx.query);
    if (ctx.params.id) params.delete('cat');
    const cats = [...root.querySelectorAll('[data-f="cat"]:checked')].map((n) => n.value);
    const brs = [...root.querySelectorAll('[data-f="brand"]:checked')].map((n) => n.value);
    const rating = root.querySelector('[data-f="rating"]:checked')?.value || '';
    const auth = root.querySelector('[data-f="authenticity"]:checked')?.value || '';
    const inStock = root.querySelector('[data-f="flag"][value="inStock"]:checked') ? '1' : '';
    const discount = root.querySelector('[data-f="flag"][value="discount"]:checked') ? '1' : '';
    const oldPrice = root.querySelector('[data-f="flag"][value="oldPrice"]:checked') ? '1' : '';
    const next = new URLSearchParams();
    for (const [k, v] of params.entries()) if (!['cat', 'brand', 'rating', 'authenticity', 'inStock', 'discount', 'oldPrice', 'page'].includes(k)) next.set(k, v);
    if (cats.length) next.set('cat', cats[cats.length - 1]);
    if (brs.length) next.set('brand', brs.join(','));
    if (rating) next.set('rating', rating);
    if (auth) next.set('authenticity', auth);
    if (inStock) next.set('inStock', '1');
    if (discount) next.set('discount', '1');
    if (oldPrice) next.set('oldPrice', '1');
    const path = ctx.params.id && !cats.length ? `/category/${ctx.params.id}` : '/products';
    go(`#${path}${next.toString() ? `?${next}` : ''}`);
  };
  root.querySelectorAll('[data-f]').forEach((n) => n.addEventListener('change', applyFilters));

  root.querySelector('[data-price-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    go(withQuery(ctx, { min: fd.get('min') || null, max: fd.get('max') || null }));
  });

  root.querySelectorAll('[data-unf]').forEach((chip) => chip.addEventListener('click', () => {
    const kind = chip.dataset.unf;
    const patch = {};
    if (kind === 'cat') { patch.cat = null; if (ctx.params.id) { location.hash = `#/products${ctx.query.toString() ? `?${new URLSearchParams([...ctx.query.entries()].filter(([k]) => k !== 'cat'))}` : ''}`; return; } }
    if (kind === 'brand') {
      const list = (ctx.query.get('brand') || '').split(',').filter((x) => x && x !== chip.dataset.v);
      patch.brand = list.length ? list.join(',') : null;
    }
    if (kind === 'flag') patch[chip.dataset.v] = null;
    if (kind === 'price') { patch.min = null; patch.max = null; }
    if (kind === 'rating') patch.rating = null;
    if (kind === 'authenticity') patch.authenticity = null;
    go(withQuery(ctx, patch));
  }));

  return null;
}

import { act } from '../actions.mjs';
act('cat-filters', (e, el) => {
  const box = document.getElementById('filtersBox');
  if (!box) return;
  box.hidden = !box.hidden;
  el.textContent = box.hidden ? t('catalog.showFilters') : t('catalog.hideFilters');
  if (!box.hidden) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

act('choose-sort', (e, el) => {
  const currentSort = new URLSearchParams(location.hash.split('?')[1] || '').get('sort') || 'relevant';
  const s = sheet({
    title: t('common.sort'),
    body: h`<div class="col" style="gap:4px; padding-bottom: 20px;">
      ${SORTS.map((st) => h`<button class="btn ${st === currentSort ? 'active' : ''}" style="justify-content: flex-start; padding: 14px 16px; background: var(--surface-2); border-radius: 12px; font-size: 15px;" data-v="${st}">${t(`catalog.sort.${st}`)}</button>`).join('')}
    </div>`
  });
  s.panel.querySelectorAll('button[data-v]').forEach(b => {
    b.addEventListener('click', () => {
      const val = b.dataset.v;
      s.close();
      const p = new URLSearchParams(location.hash.split('?')[1] || '');
      if (val === 'relevant') p.delete('sort'); else p.set('sort', val);
      p.delete('page');
      location.hash = `${location.hash.split('?')[0]}${p.toString() ? '?' + p.toString() : ''}`;
    });
  });
});

act('cat-clear', () => {
  const path = location.hash.includes('/category/') ? '#/products' : location.hash.split('?')[0];
  location.hash = path;
});

// سوییچ سریع «کالاهای به قیمت قبل» در نوار ابزار کاتالوگ
act('cat-oldtoggle', () => {
  const p = new URLSearchParams(location.hash.split('?')[1] || '');
  if (p.get('oldPrice') === '1') p.delete('oldPrice'); else p.set('oldPrice', '1');
  p.delete('page');
  location.hash = `${location.hash.split('?')[0]}${p.toString() ? '?' + p.toString() : ''}`;
});
