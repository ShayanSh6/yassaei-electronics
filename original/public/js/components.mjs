// ─────────────────────────────────────────────────────────────
//  بلوک‌های سازندهٔ مشترک بین نماها
// ─────────────────────────────────────────────────────────────
import { html as h, esc, icon, raw, fmtMoney, fmtNum, stars, catIcon } from './lib/dom.mjs';
import { t, lang, isFa } from './i18n.mjs';
import { feat, catName, brandName, prodName, ui, inWishlist, oldPriceBadgeText } from './state.mjs';
import { toolOn, freeShipThreshold } from './lib/sales.mjs';

// ── تصویر محصول با جای‌گزین امن ──────────────────────────────
export function productImage(p, cls = '') {
  const src = (p.images && p.images[0]) || '';
  const alt = prodName(p) || t('img.alt');
  if (src) return h`<img class="${cls}" src="${src}" alt="${alt}" loading="lazy" decoding="async" data-glyph="${p.glyph || 'misc'}">`;
  return raw(`<svg class="ic ph-img ${cls}" data-glyph="${esc(p.glyph || 'misc')}" role="img" aria-label="${esc(alt)}"><use href="#i-${catIcon(p.glyph || 'misc')}"/></svg>`);
}

// ── کارت محصول ──────────────────────────────────────────────
export function productCard(p, { quick = null } = {}) {
  const showBrand = (ui().productCardInfo || []).includes('brand');
  const showStock = (ui().productCardInfo || []).includes('stock');
  const showRating = (ui().productCardInfo || []).includes('rating');
  const showQuick = quick !== null ? quick : feat('compare') || ui().quickView !== false;
  const stock = p.stock ?? 0;
  const stockCls = stock <= 0 ? 'out' : stock <= 3 ? 'low' : '';
  const wished = inWishlist(p.id);
  return h`
  <article class="pcard" data-pid="${p.id}">
    <div class="pc-media">
      <a href="#/product/${p.id}" aria-label="${prodName(p)}">${productImage(p)}</a>
      <div class="ribbon">
        ${p.oldPriceTag && feat('oldPrice') ? h`<span class="badge-pill bp-fire oldprice-badge">${esc(oldPriceBadgeText())}</span>` : ''}
        ${p.discountPct > 0 ? h`<span class="badge-pill bp-danger">${fmtNum(p.discountPct)}٪ ${t('pdp.off')}</span>` : ''}
        ${stock <= 0 ? h`<span class="badge-pill bp-muted">${t('card.outOfStock')}</span>` : ''}
        ${p.featured ? h`<span class="badge-pill bp-accent">${icon('star')} ${t('home.featured')}</span>` : ''}
      </div>
      <div class="pc-quick">
        ${ui().quickView !== false ? h`<button type="button" class="pc-qbtn" data-act="quick-view" data-id="${p.id}" title="${t('card.quickView')}" aria-label="${t('card.quickView')}">${icon('eye')}</button>` : ''}
        ${feat('wishlist') ? h`<button type="button" class="pc-qbtn ${wished ? 'active is-wishlisted btn-wish-active' : ''}" data-act="wish-toggle" data-id="${p.id}" title="${wished ? t('card.wishlistRemove') : t('card.wishlistAdd')}" aria-label="${wished ? t('card.wishlistRemove') : t('card.wishlistAdd')}" aria-pressed="${wished}">${icon('heart')}</button>` : ''}
        ${feat('compare') ? h`<button type="button" class="pc-qbtn" data-act="compare-toggle" data-id="${p.id}" title="${t('card.compareAdd')}" aria-label="${t('card.compareAdd')}">${icon('compare')}</button>` : ''}
      </div>
    </div>
    <div class="pc-body">
      ${showBrand && p.brandName ? h`<span class="pc-brand">${lang() === 'fa' ? p.brandName : (p.brandNameEn || p.brandName)}</span>` : ''}
      <h3 class="pc-name"><a href="#/product/${p.id}">${prodName(p)}</a></h3>
      ${showRating && p.ratingCount > 0 ? h`<div class="pc-rate">${stars(p.ratingAvg)} <span>${fmtNum(p.ratingAvg)} (${fmtNum(p.ratingCount)})</span></div>` : ''}
      ${showStock ? h`<div class="pc-stock ${stockCls}"><span class="dot"></span>${stock <= 0 ? t('card.outOfStock') : stock <= 3 ? t('common.lowStock') : t('common.inStock')}</div>` : ''}
      <div class="pc-price">
        ${p.oldPrice > p.price ? h`<span class="pc-old">${fmtMoney(p.oldPrice)}</span>` : ''}
        ${p.price ? h`<span class="pc-now">${fmtMoney(p.price)}</span>` : h`<span class="pc-now pc-inquire">${t('price.inquire')}</span>`}
      </div>
      <div class="pc-actions">
        ${p.price ? h`<button type="button" class="btn btn-primary" data-act="add-cart" data-id="${p.id}" ${stock <= 0 ? 'disabled' : ''}>${icon('cart')} ${t('card.addToCart')}</button>`
                  : h`<a class="btn btn-outline" href="#/product/${p.id}">${icon('phone')} ${t('price.inquireShort')}</a>`}
      </div>
    </div>
  </article>`;
}

export const productGrid = (items, opts) => h`<div class="pgrid">${items.map((p) => productCard(p, opts))}</div>`;

// ── کارت دسته‌بندی ──────────────────────────────────────────
export function catCard(c, count = null) {
  return h`
    <a class="cat-card" href="#/category/${c.id}">
      <span class="cat-ic">${icon(catIcon(c.glyph))}</span>
      <span class="cat-name">${catName(c)}</span>
      ${count !== null ? h`<span class="cat-count">${fmtNum(count)} ${t('catalog.count')}</span>` : ''}
    </a>`;
}

// ── بنر تبلیغاتی ────────────────────────────────────────────
export function bannerHtml(ad) {
  const title = lang() === 'en' && ad.titleEn ? ad.titleEn : ad.title;
  const text = lang() === 'en' && ad.textEn ? ad.textEn : ad.text;
  const cta = lang() === 'en' && ad.ctaEn ? ad.ctaEn : ad.cta;
  return h`
    <div class="banner">
      <div class="banner-body">
        <div class="banner-title">${title}</div>
        ${text ? h`<div class="banner-text">${text}</div>` : ''}
      </div>
      ${ad.link ? h`<a class="btn btn-primary banner-cta" href="${ad.link.startsWith('#') || ad.link.startsWith('/') ? ad.link : '#/'}">${cta || t('common.more')} ${icon('chevron-left')}</a>` : ''}
    </div>`;
}
export const bannerSlot = (slot, ads, extraClass = '') => {
  const list = (ads || []).filter((a) => a.slot === slot);
  if (!list.length) return '';
  return h`<div class="${extraClass} banner-grid mt">${list.map(bannerHtml)}</div>`;
};

// ── سرصفحهٔ بخش ────────────────────────────────────────────
export function sectionHead({ titleIcon = '', title = '', sub = '', link = null, linkLabel = '' }) {
  return h`
    <div class="section-head">
      <div>
        <h2 class="section-title">${titleIcon ? icon(titleIcon) : ''}${title}</h2>
        ${sub ? h`<p class="section-sub">${sub}</p>` : ''}
      </div>
      ${link ? h`<a class="section-link" href="${link}">${linkLabel || t('common.showAll')} ${icon('chevron-left')}</a>` : ''}
    </div>`;
}

// ── مسیر صفحه (Breadcrumb) ──────────────────────────────────
export function breadcrumbs(items) {
  if (ui().showBreadcrumbs === false || !items?.length) return '';
  return h`
    <nav class="breadcrumb" aria-label="breadcrumb">
      <a href="#/">${icon('home')} ${t('nav.home')}</a>
      ${items.map((it, i) => h`
        ${icon('chevron-left')}
        ${i === items.length - 1
          ? h`<span aria-current="page">${it.label}</span>`
          : h`<a href="${it.href}">${it.label}</a>`}`)}
    </nav>`;
}

// ── صفحه‌بندی ───────────────────────────────────────────────
export function pagination(page, pages, makeHref) {
  if (pages <= 1) return '';
  const btn = (p, label, cls = '', disabled = false) => h`
    <a class="pg ${cls}" href="${disabled ? '#' : makeHref(p)}" ${disabled ? 'aria-disabled="true" tabindex="-1"' : ''} ${p === page ? 'aria-current="page"' : ''}>${label}</a>`;
  const nums = [];
  const push = (p) => { if (p >= 1 && p <= pages && !nums.includes(p)) nums.push(p); };
  push(1); push(2);
  for (let p = page - 1; p <= page + 1; p++) push(p);
  push(pages - 1); push(pages);
  nums.sort((a, b) => a - b);
  let out = [btn(page - 1, icon('chevron-right'), '', page <= 1)];
  let last = 0;
  for (const p of nums) {
    if (last && p - last > 1) out.push(h`<span class="pg pg-gap" aria-hidden="true">…</span>`);
    out.push(btn(p, fmtNum(p), p === page ? 'active' : ''));
    last = p;
  }
  out.push(btn(page + 1, icon('chevron-left'), '', page >= pages));
  return h`<nav class="pagination" aria-label="${t('common.page')}">${raw(out.join(''))}</nav>`;
}

// ── وضعیت‌ها ────────────────────────────────────────────────
export const STATUS_BADGE = {
  pending_payment: 'bp-warn', pending_review: 'bp-warn', confirmed: 'bp-info', preparing: 'bp-info',
  ready_pickup: 'bp-accent', shipped: 'bp-violet', delivered: 'bp-success', cancelled: 'bp-danger',
  refunded: 'bp-muted', returned: 'bp-muted',
};
export function statusBadge(status) {
  return h`<span class="badge-pill ${STATUS_BADGE[status] || 'bp-muted'}">${t(`st.${status}`)}</span>`;
}
export function payBadge(payment) {
  const map = { paid: 'bp-success', unpaid: 'bp-warn', pending: 'bp-warn', refunded: 'bp-muted', failed: 'bp-danger', cancelled: 'bp-muted' };
  return h`<span class="badge-pill ${map[payment?.status] || 'bp-muted'}">${t(`ps.${payment?.status || 'unpaid'}`)}</span>`;
}

// ── تایم‌لاین سفارش ─────────────────────────────────────────
import { fmtDate } from './lib/dom.mjs';
export function timelineHtml(order) {
  const items = order.timeline || [];
  if (!items.length) return '';
  return h`
    <div class="timeline">
      ${items.map((it) => h`
        <div class="tl-item">
          <div class="tl-t">${t(`st.${it.status}`) || it.status}</div>
          <div class="tl-d">${fmtDate(it.at)}${it.note ? ` — ${it.note}` : ''}${it.by ? ` · ${it.by}` : ''}</div>
        </div>`)}
    </div>`;
}

// ── کارت آماری ──────────────────────────────────────────────
export function statCard({ icon: ic = 'box', label = '', value = '', sub = '' }) {
  return h`
    <div class="stat-card">
      <span class="stat-ic">${icon(ic)}</span>
      <div><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div>${sub ? h`<div class="tiny muted">${sub}</div>` : ''}</div>
    </div>`;
}
export function kpiCard({ label = '', value = '', sub = '', icon: ic = '' }) {
  return h`
    <div class="kpi">
      <div class="l">${label}</div>
      <div class="v">${value}</div>
      ${sub ? h`<div class="s">${sub}</div>` : ''}
    </div>`;
}

// ── نمودار میله‌ای ──────────────────────────────────────────
export function barChart(points, { height = 130 } = {}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return h`
    <div class="chart" ${height ? h`data-h="${height}px"` : ''}>
      ${points.map((p) => h`<div class="bar" data-tip="${p.label}: ${fmtNum(p.value)}" data-h="${Math.max(2, Math.round((p.value / max) * 100))}%"></div>`)}
    </div>
    <div class="chart-x">${points.map((p) => h`<span>${p.short || ''}</span>`)}</div>`;
}

// ── جدول ────────────────────────────────────────────────────
export function tableHtml(cols, rowsHtml, { emptyText = null } = {}) {
  if (!rowsHtml.length) return raw(`<div class="empty"><h4>${esc(emptyText || t('common.noData'))}</h4></div>`);
  return h`
    <div class="table-wrap">
      <table class="table">
        <thead><tr>${cols.map((c) => h`<th class="${c.cls || ''}">${c.label}</th>`)}</tr></thead>
        <tbody>${raw(rowsHtml.join(''))}</tbody>
      </table>
    </div>`;
}

// ── فرم‌ساز سبک ─────────────────────────────────────────────
export function field({ label = '', name, type = 'text', value = '', placeholder = '', required = false, hint = '', attrs = '', span2 = false, autocomplete = '' }) {
  return h`
    <label class="field ${span2 ? 'span-2' : ''}">
      <span class="label">${label}${required ? h`<span class="req">*</span>` : ''}</span>
      <input class="input" type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''} ${autocomplete ? h`autocomplete="${autocomplete}"` : ''} ${attrs}>
      ${hint ? h`<span class="hint">${hint}</span>` : ''}
    </label>`;
}
export function textareaField({ label = '', name, value = '', placeholder = '', required = false, hint = '', rows = 4, span2 = false, attrs = '' }) {
  return h`
    <label class="field ${span2 ? 'span-2' : ''}">
      <span class="label">${label}${required ? h`<span class="req">*</span>` : ''}</span>
      <textarea class="textarea" name="${name}" rows="${rows}" placeholder="${placeholder}" ${required ? 'required' : ''} ${attrs}>${value}</textarea>
      ${hint ? h`<span class="hint">${hint}</span>` : ''}
    </label>`;
}
export function selectField({ label = '', name, options = [], value = '', required = false, hint = '', span2 = false, placeholder = '' }) {
  const selectedOpt = options.find((o) => String(o.value) === String(value));
  const txt = selectedOpt ? selectedOpt.label : (placeholder || t('common.select'));
  const optsStr = esc(JSON.stringify(options));
  return h`
    <label class="field ${span2 ? 'span-2' : ''}">
      <span class="label">${label}${required ? h`<span class="req">*</span>` : ''}</span>
      <button type="button" class="input select" data-act="open-select" data-name="${name}" data-opts="${optsStr}" data-val="${value}" data-title="${label}" style="text-align: start; padding-inline-end: 32px;">
        <span class="sb-txt" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${txt}</span>
      </button>
      <input type="hidden" name="${name}" value="${value}" ${required ? 'required' : ''}>
      ${hint ? h`<span class="hint">${hint}</span>` : ''}
    </label>`;
}
export function checkField({ label = '', name, checked = false, hint = '' }) {
  return h`
    <label class="check">
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
      <span class="box">${icon('check')}</span>
      <span>${label}${hint ? h`<span class="hint">${hint}</span>` : ''}</span>
    </label>`;
}
export function switchField({ label = '', desc = '', name, checked = false, value = '' }) {
  return h`
    <div class="switch-row">
      <div><div class="t">${label}</div>${desc ? h`<div class="d">${desc}</div>` : ''}</div>
      <label class="switch">
        <input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}>
        <span class="track"></span>
      </label>
    </div>`;
}

// ── شمارندهٔ تعداد ──────────────────────────────────────────
export function qtyWidget({ value = 1, max = 99, min = 1, name = 'qty', small = false }) {
  return h`
    <div class="qty" data-qty>
      <button type="button" data-q="-1" aria-label="-1">${icon('minus')}</button>
      <input type="number" name="${name}" value="${value}" min="${min}" max="${max}" inputmode="numeric">
      <button type="button" data-q="1" aria-label="+1">${icon('plus')}</button>
    </div>`;
}

// ── ورودی ستاره ─────────────────────────────────────────────
export function starsInput({ name = 'rating', value = 0 }) {
  return h`
    <div class="stars-input" data-stars name-wrap="${name}" role="radiogroup" aria-label="${t('pdp.yourRating')}">
      ${[1, 2, 3, 4, 5].map((i) => h`
        <button type="button" data-star="${i}" class="${i <= value ? 'on' : ''}" role="radio" aria-checked="${i === value}" aria-label="${i}">
          <svg class="ic"><use href="#i-star"/></svg>
        </button>`)}
      <input type="hidden" name="${name}" value="${value}">
    </div>`;
}

// ── نمایش قیمت در خلاصهٔ سفارش ─────────────────────────────
export function summaryRows(q, { showPlus = true } = {}) {
  const rows = [];
  rows.push(h`<div class="sum-row"><span>${t('common.subtotal')}</span><span class="v">${fmtMoney(q.subtotal)}</span></div>`);
  if (showPlus && q.plusDiscount > 0) rows.push(h`<div class="sum-row discount"><span>${t('acc.plus')} (${fmtNum(q.plusDiscountPct || 3)}٪)</span><span class="v">−${fmtMoney(q.plusDiscount)}</span></div>`);
  if (q.couponDiscount > 0) rows.push(h`<div class="sum-row discount"><span>${t('common.discountCode')}: ${q.coupon?.code || ''}</span><span class="v">−${fmtMoney(q.couponDiscount)}</span></div>`);
  rows.push(h`<div class="sum-row"><span>${t('common.shipping')}${q.shippingLabel ? h` <span class="muted tiny">(${q.shippingLabel})</span>` : ''}</span><span class="v">${q.shipping === 0 ? t('common.free') : fmtMoney(q.shipping)}</span></div>`);
  if (q.insured) rows.push(h`<div class="sum-row"><span>${t('common.insurance')}</span><span class="v">${q.insuranceFee === 0 ? t('common.free') : fmtMoney(q.insuranceFee)}</span></div>`);
  rows.push(h`<div class="sum-row total"><span>${t('common.payable')}</span><span class="v">${fmtMoney(q.total)}</span></div>`);
  return raw(rows.join(''));
}

// ── نوار پیشرفت ارسال رایگان ────────────────────────────────
/**
 * نوار پیشرفت «تا ارسال رایگان» در سبد خرید.
 * با کلید salesTools.freeShippingBarEnabled در پنل مدیریت روشن/خاموش می‌شود؛
 * آستانه از salesTools.freeShippingThreshold (یا در نبودش، shipping.freeOver) خوانده می‌شود.
 */
export function freeShipBar(subtotal) {
  if (!toolOn('freeShippingBarEnabled')) return '';
  const freeOver = freeShipThreshold();
  if (!freeOver) return '';
  const sub = Number(subtotal) || 0;
  if (sub >= freeOver) {
    return h`
      <div class="freeship freeship-done mt-s" role="status" aria-live="polite">
        <div class="freeship-head"><span class="freeship-ic">${icon('truck')}</span><strong>${t('cart.freeShipUnlocked')}</strong></div>
        <div class="progress freeship-bar"><i data-w="100%"></i></div>
      </div>`;
  }
  const pctv = Math.max(4, Math.min(100, Math.round((sub / freeOver) * 100)));
  const remaining = fmtMoney(freeOver - sub, { withUnit: true }).replace(/<[^>]+>/g, '');
  return h`
    <div class="freeship mt-s" role="status" aria-live="polite">
      <div class="freeship-head"><span class="freeship-ic">${icon('truck')}</span><span>${t('cart.freeShipLeft', { amount: remaining })}</span></div>
      <div class="progress freeship-bar" aria-label="${t('cart.freeShipProgress')}"><i data-w="${pctv}%"></i></div>
    </div>`;
}

// ── کروکی دست‌کش محل فروشگاه ─────────────────────────────
/** کروکی دست‌کش محل فروشگاه */
export function minimapSvg() {
  const fa = isFa();
  return h`
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${t('contact.mapTitle')}">
      <rect class="mm-bg" width="640" height="360"/>
      <!-- دریا -->
      <path class="mm-sea" d="M0 292c60-14 120 10 180 2s110-24 170-14 130 26 190 12 100-18 100-18V360H0Z"/>
      <g class="mm-wave" fill="none">
        <path d="M28 316c14-8 26 8 40 0s26 8 40 0"/>
        <path d="M250 330c14-8 26 8 40 0s26 8 40 0"/>
        <path d="M470 318c14-8 26 8 40 0s26 8 40 0"/>
      </g>
      <!-- بلوک‌های شهری -->
      <g class="mm-block">
        <rect x="36" y="34" width="150" height="86" rx="10"/>
        <rect x="238" y="34" width="120" height="60" rx="10"/>
        <rect x="452" y="34" width="150" height="86" rx="10"/>
        <rect x="36" y="176" width="110" height="70" rx="10"/>
        <rect x="452" y="176" width="150" height="70" rx="10"/>
      </g>
      <!-- خیابان‌ها -->
      <g class="mm-road" fill="none">
        <path d="M0 148h640"/>
        <path d="M0 268h640"/>
        <path d="M204 0v292"/>
        <path d="M420 0v292"/>
      </g>
      <g class="mm-road-thin" fill="none">
        <path d="M312 148v120"/>
      </g>
      <!-- پاساژ مغازه -->
      <g>
        <rect class="mm-shop" x="238" y="176" width="150" height="70" rx="10"/>
        <text class="mm-txt mm-txt-b" x="313" y="205" text-anchor="middle">${fa ? 'بورس الکترونیک هفت‌حوض' : 'Haft-Hoz Electronics Bourse'}</text>
        <text class="mm-txt" x="313" y="226" text-anchor="middle">${fa ? 'طبقهٔ دوم، پلاک ۲۴' : '2nd floor, No. 24'}</text>
      </g>
      <!-- نام خیابان‌ها -->
      <text class="mm-txt" x="24" y="140">${fa ? 'خیابان مدنی' : 'Madani St.'}</text>
      <text class="mm-txt" x="446" y="140">${fa ? 'میدان هفت‌حوض' : 'Haft-Hoz Square'}</text>
      <text class="mm-txt mm-vert" x="196" y="60" transform="rotate(90 196 60)">${fa ? 'جانبازان غربی' : 'W. Janbazan'}</text>
      <!-- نشان مغازه -->
      <g transform="translate(313 176)">
        <circle class="mm-pulse" r="26"/>
        <path class="mm-accent" d="M0-34c11 0 19 8 19 19 0 14-19 31-19 31S-19-1-19-15c0-11 8-19 19-19Z"/>
        <circle class="mm-pin" cx="0" cy="-15" r="7"/>
      </g>
      <g class="mm-tag">
        <rect x="330" y="120" rx="12" width="${fa ? 92 : 74}" height="26"/>
        <text x="${fa ? 376 : 367}" y="137" text-anchor="middle">${fa ? 'مغازهٔ ما' : 'Our shop'}</text>
      </g>
      <!-- قطب‌نما و مقیاس -->
      <g class="mm-compass" transform="translate(596 44)">
        <circle r="17"/>
        <path d="M0-11 4 5 0 1-4 5Z"/>
        <text y="30" text-anchor="middle">N</text>
      </g>
      <g class="mm-scale" transform="translate(36 336)">
        <path d="M0 0h70" fill="none"/>
        <path d="M0-4v8M70-4v8" fill="none"/>
        <text x="78" y="4">${fa ? '۱۰۰ متر' : '100 m'}</text>
      </g>
    </svg>`;
}

// ── بازنشرانی حالت‌های خالی/خطا (برای سادگی فراخوانی از components) ──
export { emptyState, errorState, spinner } from './ui.mjs';

// ── کپچای «من ربات نیستم» (خودکفا، بدون سرویس بیرونی) ────────
export function captchaField({ hidden = false } = {}) {
  return h`
  <div class="captcha" data-captcha ${hidden ? 'hidden' : ''}>
    <label class="check"><input type="checkbox" name="captchaBox" data-act="captcha-open"><span class="box">${icon('check')}</span><span>${t('captcha.label')}</span></label>
    <div class="captcha-ch" data-cch hidden>
      <div class="captcha-img" data-cimg></div>
      <div class="captcha-row">
        <input class="input" name="captchaAnswer" inputmode="numeric" autocomplete="off" placeholder="${t('captcha.placeholder')}" aria-label="${t('captcha.placeholder')}" >
        <button type="button" class="btn btn-ghost" data-act="captcha-refresh" title="${t('captcha.refresh')}" aria-label="${t('captcha.refresh')}">${icon('refresh')}</button>
      </div>
      <div class="captcha-st" data-cst>${t('captcha.hint')}</div>
    </div>
    <input type="hidden" name="captchaToken" data-ctok>
  </div>`;
}
