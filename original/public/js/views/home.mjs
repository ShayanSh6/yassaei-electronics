// ─────────────────────────────────────────────────────────────
//  صفحهٔ اصلی
// ─────────────────────────────────────────────────────────────
import { html as h, icon, fmtNum, esc, raw, fmtTel } from '../lib/dom.mjs';
import { t, lang, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, feat, store, plusCfg, adInSlot, isPlus, catName, prodName, brandName } from '../state.mjs';
import { productGrid, catCard, bannerSlot, sectionHead, statCard, minimapSvg } from '../components.mjs';


export async function render() {
  const st = store();
  let recentItems = [];
  if (feat('recentlyViewed') && (S.recent || []).length) {
    try { recentItems = (await api.get(`/api/products?ids=${S.recent.slice(0, 8).join(',')}&limit=8`)).items || []; } catch { recentItems = []; }
  }
  let items = [];
  let cats = S.categories;
  let brands = S.brands;
  let stats = S.stats;
  try {
    const [pr, cr, br] = await Promise.all([
      api.get('/api/products?limit=48&sort=popular'),
      S.categories.length ? Promise.resolve(null) : api.get('/api/categories'),
      S.brands.length ? Promise.resolve(null) : api.get('/api/brands'),
    ]);
    items = pr.items || [];
    if (cr) cats = cr.items || [];
    if (br) brands = br.items || [];
    if (feat('publicStats')) {
      try { const sr = await api.get('/api/stats/public'); stats = sr.stats || stats; } catch { /* noop */ }
    }
  } catch { /* نمایش با دادهٔ موجود */ }

  const featured = items.filter((p) => p.featured).slice(0, 8);
  const best = [...items].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 8);
  const fresh = [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 8);
  const deals = items.filter((p) => p.discountPct > 0).sort((a, b) => b.discountPct - a.discountPct).slice(0, 8);
  // موجودی‌های قدیمی — «به قیمت خرید قبل» (کلید اصلی: features.oldPrice)
  const oldPriced = feat('oldPrice') ? items.filter((p) => p.oldPriceTag).slice(0, 8) : [];
  const refurbished = items.filter((p) => p.condition === 'used' || p.condition === 'refurbished').slice(0, 8);
  const topCats = cats.filter((c) => !c.parentId).slice(0, 12);
  const list = featured.length ? featured : best.slice(0, 8);

  
  const secHtml = {
    hero: h`
    <section class="hero">
      <div class="hero-bg"><img src="/assets/img/hero-circuit.svg" alt="" decoding="async"></div>
      <div class="hero-inner">
        <span class="hero-kicker">${icon('zap')} ${t('home.heroKicker')}</span>
        <h1 class="hero-title">${t('home.heroTitle')}</h1>
        <p class="hero-text">${t('home.heroText')}</p>
        <div class="row center row-wrap mt">
          <a class="btn btn-primary" href="#/products?sort=popular">${icon('cart')} ${t('home.shopNow')}</a>
          <a class="btn btn-ghost" href="#/pages/about">${t('nav.about')}</a>
        </div>
        <div class="hero-points">
          <span class="hero-point">${icon('shield')} ${t('home.point1')}</span>
          <span class="hero-point">${icon('package-check')} ${t('home.point2')}</span>
          <span class="hero-point">${icon('truck')} ${t('home.point3')}</span>
          <span class="hero-point">${icon('store')} ${t('home.point4')}</span>
        </div>
      </div>
    </section>`,
    
    strip: bannerSlot('home_strip', adInSlot('home_strip')),
    
    categories: h`<section class="section">
      ${sectionHead({ titleIcon: 'layers', title: t('home.categories'), sub: t('home.categoriesSub'), link: '#/products', linkLabel: t('common.showAll') })}
      <div class="cat-grid">${topCats.map((c) => catCard(c, c.count ?? null))}</div>
    </section>`,
    
    partners: (feat('partners') && (S.settings.partners?.items?.length)) ? h`
    <section class="partners-sec partners-top">
      ${sectionHead({ titleIcon: 'store', title: t('home.partnersTitle') })}
      <div class="marquee" aria-label="${t('home.partnersTitle')}">
        <div class="marquee-track">
          ${[...S.settings.partners.items, ...S.settings.partners.items].map((p) => {
            const br = (S.brands || []).find((b) => b.name === p.fa || (p.en && (b.nameEn === p.en || b.nameEn?.toLowerCase() === p.en.toLowerCase())));
            const href = br ? `#/products?brand=${br.id}` : `#/search?q=${encodeURIComponent(p.fa)}`;
            return h`<a class="partner-chip" href="${href}" title="${isFa() ? p.fa : (p.en || p.fa)}">
              <img class="pt-logo" src="/assets/img/brands/${br ? br.id : 'no_name'}.svg" alt="" loading="lazy" decoding="async">
              <b>${isFa() ? p.fa : (p.en || p.fa)}</b></a>`;
          }).join('')}
        </div>
      </div>
    </section>` : '',
    
    featured: list.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'star', title: t('home.featured'), sub: t('home.featuredSub'), link: '#/products?sort=popular' })}
      ${productGrid(list)}
    </section>` : '',
    
    deals: deals.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'percent', title: t('home.deals'), sub: t('home.dealsSub'), link: '#/products?discount=1' })}
      ${productGrid(deals)}
    </section>` : '',

    oldPriced: oldPriced.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'zap', title: t('home.oldPriced'), sub: t('home.oldPricedSub'), link: '#/products?oldPrice=1' })}
      ${productGrid(oldPriced)}
    </section>` : '',
    
    best: best.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'chart', title: t('home.bestSellers'), sub: t('home.bestSellersSub'), link: '#/products?sort=popular' })}
      ${productGrid(best)}
    </section>` : '',
    
    
    refurbished: refurbished.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'refresh-cw', title: isFa() ? 'کالاهای دست دوم و تعمیر شده' : 'Used & Refurbished', link: '#/products' })}
      ${productGrid(refurbished)}
    </section>` : '',

    fresh: fresh.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'sparkles', title: t('home.newArrivals'), sub: t('home.newArrivalsSub'), link: '#/products?sort=newest' })}
      ${productGrid(fresh)}
    </section>` : '',
    
    brands: brands.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'tag', title: t('home.brands') })}
      <div class="row row-wrap">
        ${brands.slice(0, 18).map((b) => h`<a class="chip" href="#/products?brand=${b.id}">${brandName(b)}</a>`)}
      </div>
    </section>` : '',
    
    partFinder: h`
    <section class="section">
      <div class="card pf-card">
        <strong>${icon('search')} ${t('home.partFinder')}</strong>
        <p class="muted small mt-s">${t('home.partFinderText')}</p>
        <div class="row row-wrap mt-s">
          ${S.settings?.store?.phone ? h`<a class="btn btn-primary btn-sm" href="tel:${S.settings.store.phone}">${icon('phone')} ${t('home.partFinderCta')}: <bdi>${fmtTel(S.settings.store.phone)}</bdi></a>` : ''}
          <a class="btn btn-outline btn-sm" href="#/pages/contact">${icon('chat')} ${t('nav.contact')}</a>
          ${(S.settings?.store?.socials?.instagram) ? h`<a class="btn btn-ghost btn-sm" href="${S.settings.store.socials.instagram}" target="_blank" rel="noopener">${icon('camera')} ${t('social.instagram')}</a>` : ''}
        </div>
      </div>
    </section>`,
    
    whyUs: h`
    <section class="section">
      ${sectionHead({ titleIcon: 'shield', title: t('home.whyUs'), sub: t('home.whyUsSub') })}
      <div class="pwa-grid">
        <div class="pwa-card"><span class="pwa-ic">${icon('shield')}</span><div><div class="b">${t('home.point1')}</div><div class="muted small">${isFa() ? 'همهٔ کالاها پیش از فروش تست می‌شوند و با فاکتور رسمی و گارانتی فروشگاه تحویل می‌گیرید.' : 'Every item is tested before sale and delivered with an official invoice and store warranty.'}</div></div></div>
        <div class="pwa-card"><span class="pwa-ic">${icon('package-check')}</span><div><div class="b">${t('home.point2')}</div><div class="muted small">${isFa() ? 'طبق قانون، ۷ روز کاری فرصت داری بدون دلیل کالا را برگردانی؛ فقط هزینهٔ برگشت با توست.' : 'By law you have 7 working days to return an item without reason; only return shipping is on you.'}</div></div></div>
        <div class="pwa-card"><span class="pwa-ic">${icon('truck')}</span><div><div class="b">${t('home.point3')}</div><div class="muted small">${isFa() ? 'سفارش‌ها هر روز کاری از تهران راهی می‌شوند؛ داخل شهر با پیک و بقیهٔ ایران با پست.' : 'Orders leave Tehran every working day — by courier in the city and by post nationwide.'}</div></div></div>
        <div class="pwa-card"><span class="pwa-ic">${icon('headset')}</span><div><div class="b">${t('footer.support')}</div><div class="muted small">${isFa() ? 'چت آنلاین، تیکت و تلفن؛ نصب گلس و مشاورهٔ خرید هم در مغازه رایگان است.' : 'Live chat, tickets and phone; screen-guard installation and buying advice are free in store.'}</div></div></div>
      </div>
    </section>`,
    
    stats: (feat('publicStats') && stats) ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'chart', title: t('home.statsTitle'), link: '#/stats', linkLabel: t('common.showAll') })}
      <div class="stats-grid">
        ${statCard({ icon: 'box', label: t('stats.products'), value: fmtNum(stats.products) })}
        ${statCard({ icon: 'package-check', label: t('stats.ordersTotal'), value: fmtNum(stats.ordersTotal) })}
        ${statCard({ icon: 'cart', label: t('stats.ordersToday'), value: fmtNum(stats.ordersToday) })}
        ${statCard({ icon: 'eye', label: t('stats.visitsToday'), value: fmtNum(stats.visitsToday) })}
        ${statCard({ icon: 'users', label: t('stats.customers'), value: fmtNum(stats.customers) })}
        ${statCard({ icon: 'truck', label: t('stats.delivered'), value: fmtNum(stats.deliveredOrders) })}
      </div>
    </section>` : '',
    
    plus: (feat('plus') && !isPlus()) ? h`
    <section class="section">
      <div class="banner">
        <div class="banner-body">
          <div class="banner-title">${icon('sparkles')} ${t('home.plusTitle')}</div>
          <div class="banner-text">${t('home.plusText')}</div>
          <div class="row row-wrap mt-s">
            ${(plusCfg().perks || []).slice(0, 4).map((p) => h`<span class="chip">${icon('check')} ${isFa() ? p.fa : p.en}</span>`)}
          </div>
        </div>
        <a class="btn btn-primary banner-cta" href="#/account/plus">${t('home.plusCta')} ${icon('chevron-left')}</a>
      </div>
    </section>` : '',
    
    
    buyback: h`
    <section class="section">
      <div class="banner" style="background: var(--bg-card); border: 2px dashed var(--primary); border-radius: 12px; padding: 20px; text-align: center;">
        <div class="banner-body" style="align-items: center;">
          <div class="banner-title" style="color: var(--primary); font-size: 1.4rem;">${icon('refresh-cw')} ${isFa() ? 'خریدار کالای دست دوم و معیوب شما' : 'We Buy Your Second-hand Items'}</div>
          <div class="banner-text mt-s" style="color: var(--text-muted); max-width: 600px; line-height: 1.6;">
            ${isFa() ? 'اگر تلویزیون LCD یا کالای الکترونیکی دیگری دارید که می‌خواهید بفروشید (حتی اگر خراب یا شکسته است)، ما آن را از شما می‌خریم! برای هماهنگی و قیمت‌گذاری تماس بگیرید.' : 'Got an old or broken LCD TV or electronics? We buy them! Contact us for a quote.'}
          </div>
        </div>
        <a class="btn btn-primary banner-cta mt" href="#/pages/contact" style="width: fit-content; margin: 15px auto 0;">${icon('phone')} ${isFa() ? 'تماس و هماهنگی' : 'Contact Us'}</a>
      </div>
    </section>`,

    visitStore: h`
    <section class="section">
      <div class="catalog" >
        <div class="card">
          ${sectionHead({ titleIcon: 'store', title: t('home.visitStore'), sub: t('home.visitStoreText') })}
          <p class="muted small mb">${esc(isFa() ? (st.address || '') : (st.addressEn || st.address || ''))}</p>
          <div class="row row-wrap">
            <a class="btn btn-primary" href="#/pages/contact">${icon('map')} ${t('home.openMap')}</a>
            <a class="btn btn-ghost" href="tel:${st.phone}">${icon('phone')} ${fmtTel(st.phone || '')}</a>
          </div>
        </div>
        <div class="card">
          ${sectionHead({ titleIcon: 'download', title: t('home.appTitle'), sub: t('home.appText') })}
          <div class="row row-wrap">
            <button type="button" class="btn btn-primary" data-act="install-app">${icon('download')} ${t('home.installCta')}</button>
          </div>
          <p class="hint mt-s">${t('misc.installHint')}</p>
        </div>
      </div>
    </section>`,
    
    recent: recentItems.length ? h`
    <section class="section">
      ${sectionHead({ titleIcon: 'history', title: t('home.recent'), sub: t('home.recentSub') })}
      ${productGrid(recentItems)}
    </section>` : '',
    
    minimap: h`
    <section class="section">
      <div class="card">
        <div class="minimap" data-act="open-map" role="button" tabindex="0" aria-label="${t('contact.mapTitle')}">
          ${raw(minimapSvg())}
          <span class="minimap-hint">${icon('pin')} ${t('contact.mapHint')}</span>
        </div>
      </div>
    </section>`
  };

  const layoutCfg = S.settings?.layout || {};
  const order = layoutCfg.homeOrder || ['buyback', 'hero', 'strip', 'categories', 'partners', 'featured', 'deals', 'best', 'fresh', 'brands', 'partFinder', 'whyUs', 'stats', 'plus', 'visitStore', 'recent', 'minimap'];
  
  if (!order.includes('buyback')) order.push('buyback');
  if (!order.includes('refurbished')) order.splice(order.indexOf('fresh') + 1, 0, 'refurbished');
  if (oldPriced.length && !order.includes('oldPriced')) order.splice(order.indexOf('deals') + 1, 0, 'oldPriced');

  const hidden = new Set(layoutCfg.homeHidden || []);
  hidden.delete('buyback');

  const renderedSections = order
    .filter(id => !hidden.has(id))
    .map(id => secHtml[id] || '')
    .join('');

  return h`
    ${bannerSlot('home_hero', adInSlot('home_hero'))}
    ${raw(renderedSections)}
  `;

}

export function mount() {
  // نوار برندها: حرکت خودکار + کشیدن با نگه‌داشتن ماوس/انگشت
  const box = document.querySelector('.marquee');
  const track = box?.querySelector('.marquee-track');
  if (!box || !track) return null;
  let pos = 0;
  let dragging = false;
  let moved = 0;
  let suppressClick = false;
  let lastX = 0;
  let last = performance.now();
  let raf = 0;
  const speed = 42; // پیکسل بر ثانیه
  // نصف دقیق شامل نصف فاصلهٔ بین آیتم‌ها تا درز لوپ دیده نشود
  const half = () => {
    const gap = parseFloat(getComputedStyle(track).gap || '10') || 10;
    return (track.scrollWidth + gap) / 2 || 1;
  };
  // اگر محتوای پایه کوتاه‌تر از ۱٫۶ برابر viewport است، پایه را چند برابر کن
  // و همیشه دقیقاً دو کپی نگه دار تا لوپ بدون درز بماند
  const ensureCopies = () => {
    const gap = parseFloat(getComputedStyle(track).gap || '10') || 10;
    const kids = [...track.children];
    if (!kids.length) return;
    const n0 = track.dataset.base ? Number(track.dataset.base) : kids.length / 2;
    const base = kids.slice(0, n0);
    const baseW = base.reduce((a, el) => a + el.offsetWidth + gap, 0);
    let mult = 1;
    while (baseW * mult < innerWidth * 1.6 && mult < 4) mult++;
    track.dataset.base = String(n0);
    const want = n0 * mult * 2;
    if (kids.length === want) return;
    const frag = document.createDocumentFragment();
    for (let c = 0; c < 2; c++) for (let m2 = 0; m2 < mult; m2++) base.forEach((el) => frag.appendChild(el.cloneNode(true)));
    track.innerHTML = '';
    track.appendChild(frag);
  };
  ensureCopies();
  addEventListener('resize', ensureCopies, { passive: true });
  // جهت حرکت وابسته به جهت صفحه: RTL → محتوا از چپ وارد می‌شود (pos مثبت)
  const sign = () => (getComputedStyle(track).direction === 'rtl' ? 1 : -1);
  const wrap = () => {
    const hw = half();
    if (sign() > 0) { if (pos >= hw) pos -= hw; if (pos < 0) pos += hw; }
    else { if (pos <= -hw) pos += hw; if (pos > 0) pos -= hw; }
  };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging && !document.documentElement.classList.contains('eco')) pos += sign() * speed * dt;
    wrap();
    track.style.transform = `translateX(${pos.toFixed(1)}px)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick = false;
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    box.classList.add('grabbing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const move = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    pos += dx;
    moved += Math.abs(dx);
    lastX = e.clientX;
  };
  const up = () => {
    last = performance.now(); // reset timer on drop to avoid massive dt jump
    dragging = false;
    box.classList.remove('grabbing');
    if (moved > 8) suppressClick = true;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  const onClick = (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const noDrag = (e) => e.preventDefault();
  box.addEventListener('dragstart', noDrag);
  box.addEventListener('click', onClick, true);
  box.addEventListener('pointerdown', down);
  return () => {
    cancelAnimationFrame(raf);
  box.removeEventListener('pointerdown', down);
    box.removeEventListener('dragstart', noDrag);
    box.removeEventListener('click', onClick, true);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
}

export const title = () => t('nav.home');
