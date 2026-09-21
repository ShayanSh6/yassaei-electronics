// ─────────────────────────────────────────────────────────────
//  صفحهٔ محصول (PDP) با نظرات، سؤالات و کالاهای مشابه
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, esc, fmtNum, fmtMoney, stars, fmtDate, timeAgo, linkify, applyDyn , fmtTel} from '../lib/dom.mjs';
import { t, lang, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, feat, ship, catById, catName, prodName, brandName, inWishlist, inCompare, hasAlert, pushRecent, adInSlot, oldPriceBadgeText } from '../state.mjs';
import { productGrid, breadcrumbs, starsInput, qtyWidget, emptyState, bannerSlot, field, textareaField } from '../components.mjs';
import { toast, toastSuccess, toastApiError, wireTabs, withBusy, modal } from '../ui.mjs';
import { act } from '../actions.mjs';
import { navigate } from '../router.mjs';
import { toolOn, salesCfg, whatsappLink, whatsappIcon } from '../lib/sales.mjs';

/** مدت گارانتی نشان یاسایی: گارانتی اختصاصی کالا مقدم است، وگرنه مقدار پنل مدیریت */
function warrantyBadgeMonths(p) {
  const own = Number(p?.warrantyMonths) || 0;
  if (own > 0) return own;
  return Number(salesCfg().productWarrantyMonths) || 0;
}

/** نشان «ضمانت اصالت و سلامت فیزیکی قطعات الکتریکی یاسایی» — با کلید productWarrantyBadgeEnabled */
function warrantyBadge(p) {
  if (!toolOn('productWarrantyBadgeEnabled')) return '';
  const months = warrantyBadgeMonths(p);
  return h`
    <div class="pdp-warranty-badge mt-s" role="note">
      <span class="pwb-ic" aria-hidden="true">⚡</span>
      <span>${t('pdp.authBadge')}${months > 0 ? h` <span class="pwb-months">· ${t('pdp.authBadgeMonths', { n: fmtNum(months) })}</span>` : ''}</span>
    </div>`;
}

/** نشان «به قیمت خرید قبل» — برای موجودی‌های قدیمی (کلید اصلی: features.oldPrice) */
function oldPriceBadge(p) {
  if (!p?.oldPriceTag || !feat('oldPrice')) return '';
  return h`
    <div class="oldprice-banner mt-s" role="note">
      <span class="opb-ic" aria-hidden="true">🔥</span>
      <span class="opb-text">${esc(oldPriceBadgeText())}</span>
      <span class="opb-hint">${t('pdp.oldPriceBadgeHint')}</span>
    </div>`;
}

/** دکمهٔ «استعلام قیمت همکاری و خرید عمده» — ویژهٔ برق‌کاران و پیمانکاران؛ با کلید wholesaleInquiryEnabled */
function wholesaleBtn(p) {
  if (!toolOn('wholesaleInquiryEnabled')) return '';
  return h`
    <button type="button" class="btn btn-outline btn-block mt-s" data-act="wholesale-inquiry"
      data-id="${p.id}" data-name="${prodName(p)}" data-sku="${p.sku || ''}" data-price="${p.price || 0}">
      📦 ${t('pdp.wholesale')}
    </button>`;
}

/**
 * دکمهٔ «مشاورهٔ فنی در واتساپ» — کنار دکمهٔ تماس با فروشگاه.
 * با کلید salesTools.whatsappConsultEnabled خاموش می‌شود؛ شماره از تنظیمات
 * (شمارهٔ اختصاصی واتساپ یا واتساپ/تلفن فروشگاه) خوانده می‌شود.
 */
function whatsappBtn(p, cls = '') {
  if (!toolOn('whatsappConsultEnabled')) return '';
  const msg = `سلام وقت بخیر، از سایت الکتریکی یاسایی پیام می‌دهم. درباره محصول «${prodName(p)}» با کد ${p.sku || p.id} سوال فنی داشتم.`;
  const href = whatsappLink(msg);
  if (!href) return '';
  return h`<a class="btn btn-whatsapp ${cls}" href="${href}" target="_blank" rel="noopener noreferrer">${whatsappIcon()} <span>${t('pdp.whatsapp')}</span></a>`;
}

export async function render(ctx) {
  const oldLd = document.getElementById('json-ld');
  if (oldLd) oldLd.remove();
  const id = ctx.params.id;
  let data = null;
  try { data = await api.get(`/api/products/${encodeURIComponent(id)}`); }
  catch { return emptyState({ icon: 'alert', title: t('err.notFound'), text: t('err.notFoundText'), action: { href: '#/products', label: t('err.goHome') } }); }
  const p = data.product;
  const allRev = data.reviews || [];
  const reviews = allRev.filter((r) => r.type !== 'question');
  const questions = allRev.filter((r) => r.type === 'question');
  const rstats = data.reviewStats || { count: 0, avg: 0, dist: [0, 0, 0, 0, 0], questions: 0 };
  const related = data.related || [];

  // زنجیرهٔ دسته
  const chain = [];
  let c = catById(p.categoryId);
  while (c) { chain.unshift(c); c = c.parentId ? catById(c.parentId) : null; }

  const images = (p.images && p.images.length ? p.images : []).slice(0, 6);
  const media = [
    ...images.map((u) => ({ url: u, kind: 'image' })),
    ...(p.videos || []).slice(0, 4).map((u) => ({ url: u, kind: 'video', poster: images[0] || '' })),
  ];
  const stock = p.stock ?? 0;
  const storePhone = p.contactPhone ? String(p.contactPhone).trim() : String(S.settings?.store?.phone || '').trim();
  const zones = ship().zones || [];

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": prodName(p),
    "image": p.images?.length ? p.images.map(img => window.location.origin + img) : [],
    "description": (isFa() ? p.description : (p.descriptionEn || p.description)) || prodName(p),
    "sku": p.sku || p.id,
    "brand": { "@type": "Brand", "name": p.brandName || '' },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "IRR",
      "price": String(p.price || 0),
      "priceValidUntil": new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      "itemCondition": "https://schema.org/NewCondition",
      "availability": ((p.stock || 0) > (p.reserved || 0)) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
  if (rstats.avg > 0) {
    schema.aggregateRating = { "@type": "AggregateRating", "ratingValue": String(rstats.avg), "reviewCount": String(rstats.count) };
  }
  const sc = document.createElement('script');
  sc.id = 'json-ld';
  sc.type = 'application/ld+json';
  sc.textContent = JSON.stringify(schema);
  document.head.appendChild(sc);

  return h`
    ${breadcrumbs([...chain.map((x) => ({ label: catName(x), href: `#/category/${x.id}` })), { label: prodName(p) }])}
    <div class="pdp">
      <div class="gallery">
        <div class="gal-main" data-act="lightbox" data-imgs='${esc(JSON.stringify(media))}' data-i="0" role="button" tabindex="0" aria-label="${t('pdp.zoomHint')}">
        <div class="watermark-overlay"><div class="watermark-text">${S.settings?.store?.nameEn || S.settings?.store?.name || ''}</div></div>
          ${media[0]?.kind === 'video'
            ? h`<video src="${media[0].url}" poster="${media[0].poster}" controls playsinline preload="metadata" class="gal-video"></video>`
            : (images[0] ? h`<img src="${images[0]}" alt="${prodName(p)}" data-glyph="${p.glyph}">` : raw(`<svg class="ic"><use href="#i-${p.glyph || 'box'}"/></svg>`))}
          <span class="gal-zoom-hint" aria-hidden="true">${icon('search')} ${t('pdp.zoomHint')}</span>
        </div>
        ${media.length > 1 ? h`<div class="gal-thumbs">${media.map((m, i) => h`
          <button type="button" class="gal-thumb ${i === 0 ? 'active' : ''}" data-thumb="${i}" aria-label="${i + 1}">
            ${m.kind === 'video'
              ? raw(`<span class="gt-video">${m.poster ? `<img src="${m.poster}" alt="" loading="lazy">` : ''}<svg class="ic"><use href="#i-play"/></svg></span>`)
              : h`<img src="${m.url}" alt="" loading="lazy">`}
          </button>`)}</div>` : ''}
        <div class="row row-wrap">
          ${feat('wishlist') ? h`<button type="button" class="btn btn-ghost btn-sm ${inWishlist(p.id) ? 'btn-wish-active is-wishlisted active' : ''}" data-act="wish-toggle" data-id="${p.id}" aria-pressed="${inWishlist(p.id)}">${icon('heart')} ${inWishlist(p.id) ? t('card.wishlistRemove') : t('card.wishlistAdd')}</button>` : ''}
          ${feat('compare') ? h`<button type="button" class="btn btn-ghost btn-sm ${inCompare(p.id) ? 'active' : ''}" data-act="compare-toggle" data-id="${p.id}">${icon('scale')} ${t('compare.add')}</button>` : ''}
          
        </div>
      </div>

      <div class="buy-box">
        ${p.brandName ? h`<div class="pc-brand">${isFa() ? p.brandName : (p.brandNameEn || p.brandName)}</div>` : ''}
        <h1 class="buy-title">${prodName(p)}</h1>
        ${!isFa() && p.name ? h`<div class="buy-title-en">${p.name}</div>` : ''}
        <div class="row row-wrap mt-s">
          <a href="#/products?cat=${p.categoryId}" class="badge-pill bp-accent">${icon(catIconSafe(p.glyph))} ${catName(chain[chain.length - 1])}</a>
          <a href="#/products?authenticity=${p.authenticity || 'generic'}" class="badge-pill ${p.authenticity === 'original' ? 'bp-success' : p.authenticity === 'highcopy' ? 'bp-warn' : 'bp-muted'}">${t(`auth.${p.authenticity || 'generic'}`)}</a>
          ${p.featured ? h`<a href="#/products?sort=popular" class="badge-pill bp-violet">${icon('star')} ${t('home.featured')}</a>` : ''}
        </div>
        ${warrantyBadge(p)}
        ${oldPriceBadge(p)}
        <div class="row row-between mt-s">
          <div class="pc-rate">${stars(p.ratingAvg)} <span class="muted small">${fmtNum(rstats.avg || p.ratingAvg)} · ${fmtNum(rstats.count || p.ratingCount)} ${t('common.reviews')}</span></div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="share" data-title="${prodName(p)}" style="color:var(--accent);">${icon('share')} ${t('pdp.share')}</button>
        </div>
        ${p.createdAt ? h`<p class="muted tiny mt-s" style="opacity:0.8">${icon('calendar')} ${isFa() ? 'تاریخ ثبت محصول:' : 'Added on:'} ${fmtDate(p.createdAt)}</p>` : ''}

        <div class="buy-price">
          ${p.oldPrice > p.price ? h`<span class="pc-old">${fmtMoney(p.oldPrice)}</span>` : ''}
          ${p.price ? h`<span class="buy-now">${fmtMoney(p.price)}</span>` : h`<span class="buy-now pc-inquire">${t('price.inquire')}</span>`}
          ${p.discountPct > 0 ? h`<span class="pc-off">${fmtNum(p.discountPct)}٪</span>` : ''}
        </div>
        ${p.oldPrice > p.price ? h`<p class="hint">${t('pdp.save')}: ${fmtMoney(p.oldPrice - p.price)}</p>` : ''}

        <div class="pc-stock ${stock <= 0 ? 'out' : stock <= 3 ? 'low' : ''} mt-s">
          <span class="dot"></span>
          ${stock <= 0 ? t('card.outOfStock') : t('pdp.stockCount', { n: fmtNum(stock) })}
          ${stock > 0 && stock <= 3 ? h` <span class="badge-pill bp-warn">${t('common.lowStock')}</span>` : ''}
        </div>

        ${p.price ? h`
        <div class="row mt">
          ${qtyWidget({ value: 1, max: Math.max(1, stock), name: 'qty' })}
          <button type="button" class="btn btn-primary btn-lg grow" data-act="pdp-add" data-id="${p.id}" ${stock <= 0 ? 'disabled' : ''}>${icon('cart')} ${t('pdp.addToCart')}</button>
        </div>
        <button type="button" class="btn btn-outline btn-block mt-s" data-act="pdp-buy" data-id="${p.id}" ${stock <= 0 ? 'disabled' : ''}>${icon('zap')} ${t('pdp.buyNow')}</button>
        ${wholesaleBtn(p)}` : h`
        <div class="row mt">
          ${storePhone ? h`<a class="btn btn-primary btn-lg grow" href="tel:${storePhone}">${icon('phone')} ${t('pdp.callStore')}</a>` : ''}
          <a class="btn btn-outline btn-lg" href="#/pages/contact">${icon('map')} ${t('pdp.visitStore')}</a>
        </div>
        ${wholesaleBtn(p)}
        ${whatsappBtn(p, 'btn-block mt-s')}
        <p class="hint mt-s">${icon('info')} ${t('pdp.serviceHint')}</p>`}
        ${p.price && (storePhone || whatsappBtn(p)) ? h`
        <div class="pdp-contact mt-s">
          ${storePhone ? h`<a class="btn btn-ghost" href="tel:${storePhone}">${icon('phone')} ${t('pdp.callStore')}: <bdi>${fmtTel(storePhone)}</bdi></a>` : ''}
          ${whatsappBtn(p)}
        </div>` : ''}

        ${stock <= 0 && feat('priceAlerts') ? h`
          <button type="button" class="btn btn-ghost btn-block mt-s ${hasAlert(p.id) ? 'active' : ''}" data-act="notify-me" data-id="${p.id}">
            ${icon('bell')} ${hasAlert(p.id) ? t('common.notified') : t('common.notifyMe')}
          </button>` : ''}

        <div class="divider"></div>
        <ul class="col">
          <li class="row"><span class="stat-ic" data-h="30px" data-w="30px">${icon('store')}</span><span class="small">${t('pdp.pickup')}</span></li>
          <li class="row"><span class="stat-ic" data-h="30px" data-w="30px">${icon('truck')}</span><span class="small">${t('checkout.courier')}: ${zones.map((z) => `${isFa() ? z.name : z.nameEn} ${fmtNum(z.fee)}`).join(' · ')}</span></li>
          ${feat('insurance') ? h`<li class="row"><span class="stat-ic" data-h="30px" data-w="30px">${icon('scale')}</span><span class="small">${t('checkout.insuranceDesc')}</span></li>` : ''}
          <li class="row"><span class="stat-ic" data-h="30px" data-w="30px">${icon('shield')}</span><span class="small">${p.warrantyMonths > 0 ? t('pdp.warrantyMonths', { n: fmtNum(p.warrantyMonths) }) : t('pdp.noWarranty')}</span></li>
        </ul>

        <div class="divider"></div>
        <div class="row row-between small muted">
          <span>${t('pdp.sku')}: <button type="button" class="link-btn mono" data-act="copy" data-text="${p.sku}">${p.sku}</button></span>
          ${p.barcode ? h`<span>${t('pdp.barcode')}: <button type="button" class="link-btn mono" data-act="copy" data-text="${p.barcode}">${p.barcode}</button></span>` : ''}
        </div>
        <div class="row row-between small muted mt-s">
          <span>${icon('eye')} ${fmtNum(p.views)} ${t('pdp.viewed')}</span>
          <span>${icon('package-check')} ${fmtNum(p.sold)} ${t('pdp.sold')}</span>
        </div>
      </div>
    </div>

    ${bannerSlot('product_page', adInSlot('product_page'))}

    <section class="section card">
      <div class="tabs" role="tablist">
        <button type="button" class="tab active" data-tab="specs" role="tab">${t('pdp.specs')}</button>
        <button type="button" class="tab" data-tab="desc" role="tab">${t('pdp.description')}</button>
        ${feat('reviews') ? h`<button type="button" class="tab" data-tab="reviews" role="tab">${t('pdp.reviews')} (${fmtNum(rstats.count)})</button>` : ''}
        ${feat('questions') ? h`<button type="button" class="tab" data-tab="questions" role="tab">${t('pdp.questions')} (${fmtNum(rstats.questions || questions.length)})</button>` : ''}
      </div>

      <div class="tab-panel" data-panel="specs">
        ${Object.keys(p.specs || {}).length ? h`
          <table class="spec-table">
            <tbody>${Object.entries(p.specs).map(([k, v]) => h`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)}</tbody>
          </table>` : h`<p class="muted">${t('common.noData')}</p>`}
        ${p.weight ? h`<table class="spec-table mt-s"><tbody><tr><th>${t('pdp.weight')}</th><td>${fmtNum(p.weight)} ${t('pdp.gram')}</td></tr></tbody></table>` : ''}
        ${(p.tags || []).length ? h`<div class="row row-wrap mt">${p.tags.map((tg) => h`<a class="tag" href="#/products?q=${encodeURIComponent(tg)}">#${tg}</a>`)}</div>` : ''}
      </div>

      <div class="tab-panel" data-panel="desc" hidden>
        <div class="rev-body">${linkify(isFa() ? (p.description || '') : (p.descriptionEn || p.description || ''))}</div>
        ${!isFa() && p.descriptionEn ? '' : (p.descriptionEn ? h`<div class="rev-body muted mt-s" dir="ltr">${esc(p.descriptionEn)}</div>` : '')}
      </div>

      ${feat('reviews') ? h`
      <div class="tab-panel" data-panel="reviews" hidden>
        <div class="rev-summary mb">
          <div class="rev-score">
            <div class="n">${fmtNum(rstats.avg || 0)}</div>
            ${stars(rstats.avg || 0)}
            <div class="muted small mt-s">${fmtNum(rstats.count)} ${t('common.reviews')}</div>
          </div>
          <div class="rev-bars">
            ${[5, 4, 3, 2, 1].map((s) => h`
              <div class="rev-bar"><span>${fmtNum(s)}★</span><span class="track"><span class="fill" data-w="${rstats.count ? Math.round(((rstats.dist?.[s - 1] || 0) / rstats.count) * 100) : 0}%"></span></span><span>${fmtNum(rstats.dist?.[s - 1] || 0)}</span></div>`)}
          </div>
        </div>
        <div data-reviews>
          ${reviews.length ? reviews.map(reviewHtml).join('') : h`<p class="muted">${t('pdp.noReviews')}</p>`}
        </div>
        <div class="divider"></div>
        ${S.me ? h`
          <form data-act="review-submit" data-pid="${p.id}">
            <strong>${t('pdp.writeReview')}</strong>
            <div class="mt-s">${starsInput({ name: 'rating', value: 5 })}</div>
            <label class="field mt-s"><span class="label">${t('common.title')}</span><input class="input" name="title" maxlength="80" required></label>
            <label class="field"><span class="label">${t('common.body')}</span><textarea class="textarea" name="body" maxlength="1500" required></textarea></label>
            <button class="btn btn-primary" type="submit">${t('common.submit')}</button>
          </form>` : h`<p class="notice notice-info">${icon('user')}<span>${t('pdp.loginToReview')} <a class="section-link" href="#/auth?next=product/${p.id}">${t('nav.login')}</a></span></p>`}
      </div>` : ''}

      ${feat('questions') ? h`
      <div class="tab-panel" data-panel="questions" hidden>
        <div data-questions>
          ${questions.length ? questions.map(reviewHtml).join('') : h`<p class="muted">${t('pdp.noQuestions')}</p>`}
        </div>
        <div class="divider"></div>
        ${S.me ? h`
          <form data-act="question-submit" data-pid="${p.id}">
            <strong>${t('pdp.askQuestion')}</strong>
            <label class="field mt-s"><span class="label">${t('common.title')}</span><input class="input" name="title" maxlength="80" required></label>
            <label class="field"><span class="label">${t('common.body')}</span><textarea class="textarea" name="body" maxlength="1500" required></textarea></label>
            <button class="btn btn-primary" type="submit">${t('common.submit')}</button>
          </form>` : h`<p class="notice notice-info">${icon('user')}<span>${t('pdp.loginToReview')} <a class="section-link" href="#/auth?next=product/${p.id}">${t('nav.login')}</a></span></p>`}
      </div>` : ''}
    </section>

    ${related.length ? h`
    <section class="section">
      <div class="section-head"><div><h2 class="section-title">${icon('layers')} ${t('pdp.related')}</h2></div></div>
      ${productGrid(related.slice(0, 5))}
    </section>` : ''}

    ${S.recent.filter((x) => x !== p.id).length ? h`
    <section class="section">
      <div class="section-head"><div><h2 class="section-title">${icon('history')} ${t('misc.recentlyViewed')}</h2></div></div>
      <div data-recent></div>
    </section>` : ''}

    ${toolOn('stickyBuyBarEnabled') ? h`
    <div class="pdp-bar no-print" data-pdp-bar aria-hidden="true">
      <div class="pdp-bar-info">
        <span class="pdp-bar-thumb">${images[0] ? h`<img src="${images[0]}" alt="" loading="lazy" decoding="async">` : icon(catIconSafe(p.glyph))}</span>
        <div class="pdp-bar-p">
          <div class="pdp-bar-title">${prodName(p)}</div>
          ${p.price ? h`<div class="b">${fmtMoney(p.price)}</div>` : h`<div class="b pc-inquire">${t('price.inquireShort')}</div>`}
          ${(p.oldPrice || 0) > p.price ? h`<div class="tiny muted del">${fmtMoney(p.oldPrice)}</div>` : ''}
        </div>
      </div>
      ${!p.price
        ? (storePhone ? h`<a class="btn btn-primary" href="tel:${storePhone}">${icon('phone')} ${t('pdp.callStore')}</a>`
                      : h`<a class="btn btn-primary" href="#/pages/contact">${icon('chat')} ${t('nav.contact')}</a>`)
        : stock > 0
          ? h`<button type="button" class="btn btn-primary" data-act="pdp-add" data-id="${p.id}">${icon('cart')} ${t('pdp.stickyAdd')}</button>`
          : h`<button type="button" class="btn btn-ghost pdp-bar-out" disabled aria-disabled="true">${icon('x-circle')} ${t('card.outOfStock')}</button>`}
    </div>` : ''}
  `;
}

function catIconSafe(g) {
  const map = { cable: 'cable', adapter: 'plug', case: 'shield', glass: 'layers', powerbank: 'battery', battery: 'battery', dongle: 'plug', speaker: 'speaker', audio: 'headset', wearable: 'watch', content: 'camera', gaming: 'zap', car: 'truck', light: 'light', mics: 'mic', misc: 'box' };
  return map[g] || 'box';
}

function reviewHtml(r) {
  return h`
    <div class="review" data-rid="${r.id}">
      <div class="rev-head">
        <span class="rev-who">${esc(r.userName)}</span>
        <span class="badge-pill ${r.userBadge === 'buyer' ? 'bp-success' : 'bp-muted'}">${r.userBadge === 'buyer' ? t('pdp.buyerBadge') : t('pdp.visitorBadge')}</span>
        ${r.rating ? stars(r.rating) : ''}
        <span class="rev-date">${fmtDate(r.createdAt, { time: false })}</span>
      </div>
      <div class="rev-title">${esc(r.title)}</div>
      <div class="rev-body">${esc(r.body)}</div>
      ${r.reply ? h`<div class="rev-reply"><strong>${t('pdp.storeReply')}:</strong> ${esc(r.reply)}</div>` : ''}
      <div class="rev-actions">
        <button type="button" class="link-btn" data-act="review-like" data-id="${r.id}">${icon('heart')} ${t('pdp.helpful')} (${fmtNum(r.likes || 0)})</button>
      </div>
    </div>`;
}

// ── ذره‌بین زوم (هاور موس روی تصویر کالا) ───────────────────
// فقط روی دستگاه‌های دارای موس؛ لنز دایره‌ای همان تصویر را با بزرگ‌نمایی
// پیکسل‌به‌پیکسل (object-fit:cover یکسان) نشان می‌دهد.
function wireLens(root) {
  const gal = root.querySelector('.gal-main');
  if (!gal) return;
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return;
  const Z = 2.6; // میزان بزرگ‌نمایی ذره‌بین
  let lens = null;
  let limg = null;
  const hide = () => { if (lens) lens.style.display = 'none'; };
  gal.addEventListener('mousemove', (e) => {
    const img = gal.querySelector('img');
    if (!img || !img.currentSrc) { hide(); return; }
    const r = gal.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { hide(); return; }
    if (!lens) {
      lens = document.createElement('div');
      lens.className = 'gal-lens';
      lens.setAttribute('aria-hidden', 'true');
      limg = document.createElement('img');
      limg.alt = '';
      lens.appendChild(limg);
      gal.appendChild(lens);
    }
    const size = Math.max(120, Math.min(190, Math.round(r.width * 0.46)));
    lens.style.width = `${size}px`;
    lens.style.height = `${size}px`;
    lens.style.display = 'block';
    lens.style.left = `${Math.max(-size * 0.15, Math.min(r.width - size * 0.85, x - size / 2))}px`;
    lens.style.top = `${Math.max(-size * 0.15, Math.min(r.height - size * 0.85, y - size / 2))}px`;
    const bw = r.width * Z;
    const bh = r.height * Z;
    limg.src = img.currentSrc;
    limg.style.width = `${bw}px`;
    limg.style.height = `${bh}px`;
    // نقطهٔ زیر نشانگر در مرکز لنز؛ با clamp لبه‌ها خالی نمی‌ماند
    const qx = Math.max(size / 2, Math.min(bw - size / 2, (x / r.width) * bw));
    const qy = Math.max(size / 2, Math.min(bh - size / 2, (y / r.height) * bh));
    limg.style.left = `${size / 2 - qx}px`;
    limg.style.top = `${size / 2 - qy}px`;
  });
  gal.addEventListener('mouseleave', hide);
  gal.addEventListener('click', hide);
}

export function mount(root, ctx) {
  applyDyn(root);
  // نوار خرید چسبان (فقط موبایل؛ نمایش/پنهان با CSS): وقتی کاربر از جعبهٔ خرید اصلی
  // عبور کرد، نوار با انیمیشن بالا می‌آید؛ با برگشت به بالا دوباره پنهان می‌شود.
  const pdpBar = root.querySelector('[data-pdp-bar]');
  const buyBox = root.querySelector('.buy-box') || root.querySelector('button[data-act="pdp-add"]');
  if (pdpBar && buyBox) {
    const setShown = (on) => { pdpBar.classList.toggle('show', on); pdpBar.setAttribute('aria-hidden', on ? 'false' : 'true'); };
    if (window.IntersectionObserver) {
      const obs = new IntersectionObserver((entries) => {
        if (!pdpBar.isConnected) { obs.disconnect(); return; } // خروج از صفحه → آزادسازی
        entries.forEach((e) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0));
      }, { threshold: 0 });
      obs.observe(buyBox);
    } else {
      const onScroll = () => {
        if (!pdpBar.isConnected) { window.removeEventListener('scroll', onScroll); return; }
        setShown(buyBox.getBoundingClientRect().bottom < 0);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  pushRecent(ctx.params.id);
  wireTabs(root);
  wireLens(root);

  // بندانگشتی‌ها
  // سوئیپ گالری در موبایل
  const gal = root.querySelector('.gal-main');
  if (gal) {
    let sx = null;
    let swiped = false;
    gal.addEventListener('click', (e) => {
      if (!swiped) return;
      swiped = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
    gal.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; sx = e.clientX; }, { passive: true });
    gal.addEventListener('pointerup', (e) => {
      if (sx == null || e.pointerType !== 'touch') return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) < 48) return;
      swiped = true;
      const items = JSON.parse(root.querySelector('[data-imgs]')?.dataset.imgs || '[]');
      if (items.length < 2) return;
      let i = Number(root.querySelector('[data-imgs]').dataset.i || 0);
      i = (i + (dx < 0 ? 1 : -1) + items.length) % items.length;
      root.querySelector(`[data-thumb="${i}"]`)?.click();
    }, { passive: true });
  }

  root.querySelectorAll('[data-thumb]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.thumb);
    const items = JSON.parse(root.querySelector('[data-imgs]').dataset.imgs || '[]');
    const gal = root.querySelector('.gal-main');
    const m = items[i];
    if (gal && m) {
      gal.querySelector('img, video')?.remove();
      if (m.kind === 'video') {
        const v = document.createElement('video');
        v.src = m.url; v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.className = 'gal-video';
        if (m.poster) v.poster = m.poster;
        gal.prepend(v);
      } else {
        const img = document.createElement('img');
        img.src = m.url; img.alt = '';
        gal.prepend(img);
      }
    }
    root.querySelectorAll('[data-thumb]').forEach((x) => x.classList.toggle('active', x === b));
    root.querySelector('[data-imgs]').dataset.i = String(i);
  }));

  // افزودن به سبد با تعداد انتخابی
  act('pdp-add', async (e, el) => {
    const qty = Number(root.querySelector('.qty input')?.value || 1);
    await withBusy(el, async () => {
      try {
        const { addToCart } = await import('../state.mjs');
        await addToCart(el.dataset.id, qty);
        toastSuccess(t('card.added'), { timeout: 2400 });
      } catch (err) { toastApiError(err); }
    });
  });
  act('pdp-buy', async (e, el) => {
    const qty = Number(root.querySelector('.qty input')?.value || 1);
    try {
      const { addToCart } = await import('../state.mjs');
      await addToCart(el.dataset.id, qty);
      navigate('#/checkout');
    } catch (err) { toastApiError(err); }
  });

  act('review-like', async (e, el) => {
    if (!S.me) { navigate('#/auth'); return; }
    try {
      const r = await api.post(`/api/reviews/${el.dataset.id}/like`);
      el.innerHTML = h`${icon('heart')} ${t('pdp.helpful')} (${fmtNum(r.likes)})`;
    } catch (err) { toastApiError(err); }
  });

  act('review-submit', async (e, form) => {
    e.preventDefault();
    const fd = new FormData(form);
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/reviews', {
          productId: form.dataset.pid, type: 'review',
          rating: Number(fd.get('rating') || 0), title: fd.get('title'), body: fd.get('body'),
        });
        toastSuccess(r.message || t('pdp.reviewSubmitted'), { timeout: 5000 });
        form.reset();
      } catch (err) { toastApiError(err); }
    });
  });
  act('question-submit', async (e, form) => {
    e.preventDefault();
    const fd = new FormData(form);
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/reviews', { productId: form.dataset.pid, type: 'question', title: fd.get('title'), body: fd.get('body') });
        toastSuccess(r.message || t('pdp.questionSubmitted'), { timeout: 5000 });
        form.reset();
      } catch (err) { toastApiError(err); }
    });
  });

  // کالاهای اخیر
  const recentBox = root.querySelector('[data-recent]');
  if (recentBox && S.recent.length) {
    api.get('/api/products?limit=60').then((r) => {
      const ids = S.recent.filter((x) => x !== ctx.params.id).slice(0, 5);
      const items = ids.map((id) => r.items.find((p) => p.id === id)).filter(Boolean);
      recentBox.innerHTML = productGrid(items);
      applyDyn(recentBox);
    }).catch(() => {});
  }
  return () => {};
}

/** مودال «استعلام قیمت همکاری و خرید عمده» — با جزئیات محصول از پیش پر می‌شود */
let wholesaleHandle = null;
function openWholesaleModal(el) {
  const name = el.dataset.name || '';
  const sku = el.dataset.sku || '';
  const price = Number(el.dataset.price) || 0;
  const url = `${window.location.origin}${window.location.pathname}#/product/${el.dataset.id}`;
  const prefill = t('pdp.wholesalePrefill', {
    name, sku: sku || '—', price: price ? fmtMoney(price) : t('price.inquireShort'),
    qty: '100', url,
  });
  const waText = `سلام، برای «${name}»${sku ? ` (کد: ${sku})` : ''} درخواست قیمت همکاری/خرید عمده دارم.`;
  const wa = whatsappLink(waText);

  // مهمان: ثبت تیکت نیاز به ورود دارد → راهنمای ورود + میان‌بر واتساپ/تماس
  if (!S.me) {
    wholesaleHandle = modal({
      title: `📦 ${t('pdp.wholesaleTitle')}`,
      body: h`
        <div class="col">
          <div class="notice notice-info">${icon('info')}<span>${t('pdp.wholesaleIntro')}</span></div>
          <div class="small muted">${name}${sku ? h` — <span class="mono">${esc(sku)}</span>` : ''}</div>
          <div class="row row-wrap mt">
            <a class="btn btn-primary" href="#/auth?next=product/${el.dataset.id}">${icon('user')} ${t('pdp.wholesaleLogin')}</a>
            ${wa ? h`<a class="btn btn-whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer">${whatsappIcon()} ${t('pdp.wholesaleAskWa')}</a>` : ''}
          </div>
        </div>`,
    });
    return;
  }

  // کاربر واردشده: تیکت «همکاری/عمده» با جزئیات از پیش پرشده
  wholesaleHandle = modal({
    title: `📦 ${t('pdp.wholesaleTitle')}`,
    body: h`
      <form data-act="wholesale-send" class="form-grid" data-pid="${el.dataset.id}" data-pname="${esc(name)}">
        <div class="notice notice-info span-2">${icon('info')}<span>${t('pdp.wholesaleIntro')}</span></div>
        <div class="span-2 small muted">${name}${sku ? h` — <span class="mono">${esc(sku)}</span>` : ''}${price ? h` · <span class="b">${fmtMoney(price)}</span>` : ''}</div>
        ${field({ label: t('pdp.wholesaleQty'), name: 'qty', type: 'number', value: '100', attrs: 'min="1" max="100000"', required: true })}
        ${textareaField({ label: t('pdp.wholesaleMsg'), name: 'body', rows: 5, span2: true, value: prefill, required: true })}
        <button class="btn btn-primary span-2" type="submit">${icon('send')} ${t('pdp.wholesaleSubmit')}</button>
      </form>`,
  });
}

act('wholesale-send', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const body = String(fd.get('body') || '').trim();
  if (body.length < 10) { toastError(t('pdp.wholesaleShort')); return; }
  const pname = form.dataset.pname || '';
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api.post('/api/tickets', {
        subject: `استعلام قیمت همکاری و عمده — ${pname}`.slice(0, 100),
        category: 'partnership',
        priority: 'normal',
        body,
        rulesAccepted: true,
      });
      toastSuccess(r.message || t('pdp.wholesaleSent'), { timeout: 5000 });
      wholesaleHandle?.close();
    } catch (err) { toastApiError(err); }
  });
});

act('wholesale-inquiry', (e, el) => openWholesaleModal(el));

export const title = (ctx) => ctx.params.id;


act('share-native', async (e, el) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: el.dataset.title,
        url: el.dataset.url
      });
    } catch (err) {}
  } else {
    try {
      await navigator.clipboard.writeText(el.dataset.url);
      toastSuccess(isFa() ? 'لینک کپی شد!' : 'Link copied!');
    } catch (err) {}
  }
});
