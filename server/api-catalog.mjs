// ─────────────────────────────────────────────────────────────
//  API عمومی: کاتالوگ، جست‌وجوی پیشرفته، آمار، صفحه‌ها
// ─────────────────────────────────────────────────────────────
import { db, logAudit, publicStats, publicProduct, recordVisit, pushNotification } from './lib/helpers.mjs';
import { hamming, histDistance } from './lib/helpers.mjs';
import { normalizeText, phoneticKey, levenshtein, V, notFound, badRequest, nowISO, toLatinDigits, uid } from './lib/util.mjs';
import { sendJson } from './lib/http.mjs';
import { publicKyc } from './lib/kyc.mjs';

// ── ایندکس جست‌وجو (کش در حافظه) ───────────────────────────
let searchIndex = null;
let indexStamp = '';

function buildIndex(state) {
  const stamp = `${state.products.length}:${state.products.map((p) => p.updatedAt || '').join('|').length}:${state.categories.length}:${state.brands.length}`;
  if (searchIndex && indexStamp === stamp) return searchIndex;
  const cats = new Map(state.categories.map((c) => [c.id, c]));
  const brands = new Map(state.brands.map((b) => [b.id, b]));
  const docs = state.products.filter((p) => p.active !== false).map((p) => {
    const cat = cats.get(p.categoryId);
    const brand = brands.get(p.brandId);
    const name = normalizeText(p.name);
    const nameEn = normalizeText(p.nameEn);
    const tags = (p.tags || []).map(normalizeText);
    const specText = normalizeText(Object.values(p.specs || {}).join(' '));
    const descText = normalizeText(`${p.description || ''} ${p.descriptionEn || ''}`);
    const catName = normalizeText(`${cat?.name || ''} ${cat?.nameEn || ''}`);
    const brandName = normalizeText(`${brand?.name || ''} ${brand?.nameEn || ''}`);
    return {
      id: p.id, name, nameEn, tags, specText, descText, catName, brandName,
      // کدهای فنی برای جست‌وجوی سریع پارت‌نامبر: SKU و بارکد با نرمال‌سازی سختگیرانه
      sku: normalizeCode(p.sku), barcode: normalizeCode(p.barcode),
      nameEnTokens: nameEn.split(' ').filter(Boolean),
      categoryId: p.categoryId, brandId: p.brandId,
      price: p.price, stock: Math.max(0, (p.stock || 0) - (p.reserved || 0)),
      rating: p.ratingAvg || 0, sold: p.sold || 0, views: p.views || 0,
      discount: p.oldPrice && p.oldPrice > p.price ? (1 - p.price / p.oldPrice) : 0,
      createdAt: p.createdAt,
      pk: phoneticKey(p.name),
      tokens: new Set(`${name} ${nameEn} ${tags.join(' ')} ${catName} ${brandName}`.split(' ').filter(Boolean)),
    };
  });
  // نگاشت توکن → اسناد برای تکمیل خودکار
  const tokenMap = new Map();
  for (const d of docs) for (const t of d.tokens) {
    if (!tokenMap.has(t)) tokenMap.set(t, []);
    tokenMap.get(t).push(d.id);
  }
  searchIndex = { docs, byId: new Map(docs.map((d) => [d.id, d])), tokenMap, cats, brands };
  indexStamp = stamp;
  return searchIndex;
}
export function invalidateSearchIndex() { searchIndex = null; indexStamp = ''; }

/**
 * نرمال‌سازی کد فنی (SKU/بارکد/پارت‌نامبر): ارقام فارسی/عربی → لاتین،
 * حروف کوچک، حذف فاصله/خط تیره/جداکننده‌ها. «سیم ۲.۵» → «سیم2.5»، «LM-317» → «lm317».
 */
function normalizeCode(s) {
  return toLatinDigits(String(s ?? '')).toLowerCase().replace(/[^a-z0-9.\u0600-\u06FF]+/g, '');
}

/**
 * تقویت حداکثری برای تطابق دقیق کد فنی — با کلید skuFastSearchEnabled در
 * تنظیمات (ابزارهای فروش) خاموش/روشن می‌شود. پارت‌نامبرهایی مثل LM317 یا
 * NE555 یا «سیم 2.5» همیشه بالای همهٔ نتایج می‌آیند.
 */
function skuBoost(d, q) {
  const nq = normalizeCode(q);
  if (!nq) return 0;
  let best = 0;
  // ۱) تطابق دقیق SKU/بارکد → بالاترین اولویت
  for (const code of [d.sku, d.barcode]) {
    const c = String(code || '');
    if (!c) continue;
    if (c === nq) best = Math.max(best, 6000);
    else if (c.startsWith(nq) || nq.startsWith(c)) best = Math.max(best, 2400);
    else if (c.includes(nq)) best = Math.max(best, 1400);
  }
  // ۲) پارت‌نامبر داخل نام لاتین به‌صورت توکن کامل (LM317، NE555، C16 …)
  for (const tok of d.nameEnTokens || []) {
    const c = normalizeCode(tok);
    if (c && c === nq) best = Math.max(best, 3200);
  }
  // ۳) تگ‌های فنی مثل «سیم 2.5» یا «مقاومت 1k»
  for (const tg of d.tags || []) {
    const c = normalizeCode(tg);
    if (!c) continue;
    if (c === nq) best = Math.max(best, 3200);
    else if (c.includes(nq)) best = Math.max(best, 900);
  }
  return best;
}

function scoreDoc(d, tokens, rawQ) {
  let score = 0;
  const q = rawQ;
  if (q && d.name === q) score += 200;
  if (q && d.name.startsWith(q)) score += 120;
  if (q && d.name.includes(q)) score += 80;
  if (q && d.nameEn.includes(q)) score += 60;
  for (const t of tokens) {
    if (!t) continue;
    if (d.name.split(' ').includes(t)) score += 55;
    else if (d.name.includes(t)) score += 34;
    if (d.nameEn.includes(t)) score += 26;
    if (d.tags.some((x) => x.includes(t))) score += 30;
    if (d.brandName.includes(t)) score += 40;
    if (d.catName.includes(t)) score += 34;
    if (d.specText.includes(t)) score += 12;
    if (d.descText.includes(t)) score += 8;
  }
  return score;
}

export function runSearch(state, opts = {}) {
  const idx = buildIndex(state);
  const q = normalizeText(opts.q || '');
  const tokens = q ? q.split(' ').filter(Boolean).slice(0, 10) : [];
  const catId = opts.cat || null;
  const brandIds = new Set(opts.brands || []);
  const minPrice = Number(opts.minPrice) || 0;
  const maxPrice = Number(opts.maxPrice) || Infinity;
  const inStockOnly = !!opts.inStock;
  const idSet = opts.ids && opts.ids.length ? new Set(opts.ids) : null;
  const discountOnly = !!opts.discount;
  // فیلتر «کالاهای به قیمت قبل»: فقط وقتی کلید اصلی فروشگاه روشن است (خاموش = بدون اثر)
  const oldPriceOnly = state.settings?.features?.oldPrice !== false && !!opts.oldPrice;
  const minRating = Number(opts.minRating) || 0;
  const authenticity = opts.authenticity || null;
  // کلید اصلی جست‌وجوی سریع پارت‌نامبر (پنل مدیریت → تنظیمات → ابزارهای فروش)
  const skuFast = state.settings?.salesTools?.skuFastSearchEnabled !== false;

  // زیردسته‌ها
  let catSet = null;
  if (catId) {
    catSet = new Set([catId]);
    let added = true;
    while (added) {
      added = false;
      for (const c of state.categories) if (c.parentId && catSet.has(c.parentId) && !catSet.has(c.id)) { catSet.add(c.id); added = true; }
    }
  }

  const products = state.products.filter((p) => p.active !== false);
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const results = [];
  for (const d of idx.docs) {
    const p = prodMap.get(d.id);
    if (!p) continue;
    if (catSet && !catSet.has(p.categoryId)) continue;
    if (brandIds.size && !brandIds.has(p.brandId)) continue;
    if (authenticity && p.authenticity !== authenticity) continue;
    if (p.price < minPrice || p.price > maxPrice) continue;
    if (inStockOnly && d.stock <= 0) continue;
    if (idSet && !idSet.has(p.id)) continue;
    if (discountOnly && !(p.oldPrice > p.price)) continue;
    if (oldPriceOnly && !p.oldPriceTag) continue;
    if (minRating && (p.ratingAvg || 0) < minRating) continue;
    const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
    let score = tokens.length ? scoreDoc(d, tokens, q) : 0;
    // جست‌وجوی سریع پارت‌نامبر/SKU/بارکد (کلید skuFastSearchEnabled در پنل مدیریت)
    if (tokens.length && skuFast) score += skuBoost(d, q);
    if (tokens.length && score <= 0) continue;
    score += d.rating * 4 + Math.min(d.sold, 50) * 0.6 + (available > 0 ? 8 : -20) + d.discount * 25;
    results.push({ p, score, available });
  }

  // اگر نتیجه‌ای نبود → جست‌وجوی فازی
  let fuzzy = null;
  if (!results.length && tokens.length) {
    const vocab = [...idx.tokenMap.keys()];
    const suggestions = [];
    for (const t of tokens) {
      let best = null;
      for (const w of vocab) {
        if (w === t) continue;
        const dist = levenshtein(t, w, 2);
        if (dist <= 2 && (!best || dist < best.dist)) best = { w, dist };
      }
      if (best) suggestions.push(best.w);
    }
    if (suggestions.length) {
      fuzzy = suggestions.join(' ');
      for (const d of idx.docs) {
        let sc = 0;
        for (const s of suggestions) {
          if (d.name.includes(s) || d.tags.some((x) => x.includes(s)) || d.brandName.includes(s) || d.catName.includes(s)) sc += 25;
        }
        if (sc > 0) results.push({ p: prodMap.get(d.id), score: sc, available: d.stock });
      }
    }
  }

  const sort = opts.sort || 'relevant';
  const sorters = {
    relevant: (a, b) => b.score - a.score || b.available - a.available,
    newest: (a, b) => String(b.p.createdAt).localeCompare(String(a.p.createdAt)),
    oldest: (a, b) => String(a.p.createdAt).localeCompare(String(b.p.createdAt)),
    cheapest: (a, b) => a.p.price - b.p.price,
    dearest: (a, b) => b.p.price - a.p.price,
    popular: (a, b) => (b.p.sold || 0) - (a.p.sold || 0) || (b.p.views || 0) - (a.p.views || 0),
    rating: (a, b) => (b.p.ratingAvg || 0) - (a.p.ratingAvg || 0),
    discount: (a, b) => (b.p.oldPrice ? (1 - b.p.price / b.p.oldPrice) : 0) - (a.p.oldPrice ? (1 - a.p.price / a.p.oldPrice) : 0),
    name: (a, b) => String(a.p.name).localeCompare(String(b.p.name), 'fa'),
  };
  results.sort(sorters[sort] || sorters.relevant);

  const total = results.length;
  const limit = Math.min(Math.max(1, Number(opts.limit) || 24), 96);
  const page = Math.max(1, Number(opts.page) || 1);
  const start = (page - 1) * limit;
  const slice = results.slice(start, start + limit).map((r) => r.p);

  const facets = {
    brands: {}, categories: {}, priceMin: null, priceMax: null, authenticity: {},
  };
  const pool = tokens.length || catId || brandIds.size ? results.map((r) => r.p) : products;
  for (const p of pool) {
    facets.brands[p.brandId] = (facets.brands[p.brandId] || 0) + 1;
    facets.categories[p.categoryId] = (facets.categories[p.categoryId] || 0) + 1;
    facets.authenticity[p.authenticity || 'generic'] = (facets.authenticity[p.authenticity || 'generic'] || 0) + 1;
    facets.priceMin = facets.priceMin === null ? p.price : Math.min(facets.priceMin, p.price);
    facets.priceMax = facets.priceMax === null ? p.price : Math.max(facets.priceMax, p.price);
  }

  return { items: slice, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), facets, didYouMean: fuzzy };
}

// ── ثبت مسیرها ──────────────────────────────────────────────
export function registerCatalog(router) {

  // ── فید ترب و ایمالز (Torob / Emalls API) ─────────────
  router.get('/api/feed/torob', async (ctx) => {
    const st = ctx.state;
    const page = parseInt(ctx.query.page) || 1;
    const limit = 100;
    const all = st.products.filter(p => p.active !== false);
    const paginated = all.slice((page - 1) * limit, page * limit);
    
    const results = paginated.map(p => {
      const stock = Math.max(0, (p.stock || 0) - (p.reserved || 0));
      return {
        product_id: p.id,
        page_url: `https://yassaei-electronics.onrender.com/#/product/${p.id}`,
        price: p.price,
        old_price: p.oldPrice > p.price ? p.oldPrice : p.price,
        availability: stock > 0 ? 'instock' : 'outofstock',
        title: p.name,
        subtitle: p.nameEn || '',
        image_url: p.images?.[0] ? `https://yassaei-electronics.onrender.com${p.images[0]}` : ''
      };
    });
    
    sendJson(ctx.res, 200, {
      max_pages: Math.ceil(all.length / limit),
      products: results
    });
  });

  // نسخهٔ عمومی تنظیمات منوها (فقط کلیدهای لازم برای نمایش)
  function publicNav(nav) {
    const out = {};
    if (!nav || typeof nav !== 'object') return out;
    for (const g of ['account', 'header', 'mobile']) {
      if (!Array.isArray(nav[g])) continue;
      out[g] = nav[g].slice(0, 60).map((x) => ({
        id: x?.id, show: x?.show !== false, on: x?.on !== false,
        fa: x?.fa || '', en: x?.en || '', icon: x?.icon || '', emoji: x?.emoji || '',
      }));
    }
    return out;
  }

  // وضعیت اولیهٔ برنامه
  router.get('/api/bootstrap', async (ctx) => {
    const state = ctx.state;
    const s = state.settings;
    sendJson(ctx.res, 200, {
      ok: true,
      serverTime: nowISO(),
      sleeping: !!state.meta?.sleeping,
      sleepSince: state.meta?.sleepSince || null,
      settings: {
        store: s.store, theme: s.theme, ui: s.ui, features: s.features,
        shipping: publicShipping(s.shipping), plus: publicPlus(s.plus, s.features),
        // ابزارهای فروش (نوار خرید چسبان، واتساپ، پیش‌فاکتور، نوار ارسال رایگان، کارت‌به‌کارت)
        salesTools: publicSalesTools(s.salesTools),
        // محافظت سمت کاربر (کلیک راست، میان‌برهای DevTools، هشدار کنسول و
        // جلوگیری از کشیدن تصاویر). فقط همین یک کلید عمومی می‌شود؛ پارامترهای
        // داخلی صف/محدودسازی نرخ هرگز به مرورگر فرستاده نمی‌شوند.
        security: { antiInspectEnabled: s.security?.antiInspectEnabled !== false },
        currency: s.currency, seo: s.seo, partners: s.partners, orders: { minOrder: s.orders?.minOrder || 0, codEnabled: !!s.orders?.codEnabled, walletEnabled: !!s.orders?.walletEnabled, gatewayEnabled: !!s.orders?.gatewayEnabled, gatewayMode: s.orders?.gatewayMode || 'demo', kyc: publicKyc(s.orders) },
        // فرصت‌های شغلی + نشان «به قیمت خرید قبل» (فقط کلیدهای نمایشی)
        careers: { navShowInNav: s.careers?.navShowInNav !== false },
        oldPrice: { badgeText: s.oldPrice?.badgeText || '🔥 به قیمت خرید قبل', badgeTextEn: s.oldPrice?.badgeTextEn || '🔥 At previous purchase price' },
        otpMode: s.auth?.otpMode || 'demo',
        translations: s.translations, layout: s.layout, media: s.media, notifications: s.notifications,
        // مدیریت منوها و بخش‌ها (settings.nav): نمایش/فعال بودن، عنوان، آیکون و ترتیب
        // هر دکمه. اگر خالی باشد، کلاینت پیش‌فرض‌های خودش را می‌سازد.
        ...(ctx.user && ['owner', 'staff'].includes(ctx.user.role) ? { adminNav: s.adminNav } : {}),
        nav: publicNav(s.nav)
      },
      categories: state.categories.filter((c) => c.active !== false).map(publicCategory),
      brands: state.brands.filter((b) => b.active !== false).map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn })),
      me: ctx.user ? await ctx.mePayload() : null,
      stats: s.features?.publicStats ? publicStats(state) : null,
      ads: activeAds(state),
      ticker: s.ui?.tickerItems || [],
      orderStatuses: (await import('./defaults.mjs')).ORDER_STATUSES,
      ticketCategories: (await import('./defaults.mjs')).TICKET_CATEGORIES,
      ticketPriorities: (await import('./defaults.mjs')).TICKET_PRIORITIES,
    });
  });

  router.get('/api/products', async (ctx) => {
    const q = ctx.query;
    if ((q.get('q') || '').trim()) { try { logAudit(ctx.user || null, 'search', q.get('q').slice(0, 80), {}); } catch { /* noop */ } }
    const opts = {
      q: q.get('q') || '', cat: q.get('cat') || '', sort: q.get('sort') || 'relevant',
      brands: (q.get('brand') || '').split(',').filter(Boolean),
      minPrice: q.get('min') || 0, maxPrice: q.get('max') || 0,
      inStock: q.get('inStock') === '1', discount: q.get('discount') === '1',
      oldPrice: q.get('oldPrice') === '1',
      ids: (q.get('ids') || '').split(',').filter(Boolean),
      minRating: q.get('rating') || 0, authenticity: q.get('authenticity') || '',
      page: q.get('page') || 1, limit: q.get('limit') || 24,
    };
    if (!opts.maxPrice) opts.maxPrice = Infinity;
    const r = runSearch(ctx.state, opts);
    if (opts.q && r.items.length === 0) {
      db.tx((st) => {
        st.missedSearches = st.missedSearches || {};
        const k = String(opts.q).toLowerCase().trim().slice(0, 50);
        if (k) {
          if (!st.missedSearches[k]) {
            const keys = Object.keys(st.missedSearches);
            if (keys.length > 2000) delete st.missedSearches[keys[0]];
            st.missedSearches[k] = { count: 0, notified: false };
          }
          st.missedSearches[k].count++;
          if (st.missedSearches[k].count >= 5 && !st.missedSearches[k].notified) {
            st.missedSearches[k].notified = true;
            for (const u of st.users) {
              if (u.role === 'admin' || u.role === 'staff') {
                pushNotification(st, { userId: u.id, type: 'system', level: 'warn', title: 'تقاضای بالای کالای ناموجود', body: `کلمه «${k}» بیش از ۵ بار جستجو شده اما در فروشگاه موجود نیست. بررسی کنید.`, link: '#/admin/insights' });
              }
            }
          }
        }
      }).catch(()=>{});
    }
    sendJson(ctx.res, 200, {
      ok: true,
      items: r.items.map((p) => publicProduct(p, { categories: ctx.state.categories, brands: ctx.state.brands })),
      total: r.total, page: r.page, pages: r.pages, limit: r.limit,
      facets: r.facets, didYouMean: r.didYouMean,
    });
  });

  router.get('/api/products/:id', async (ctx) => {
    const state = ctx.state;
    const id = ctx.params.id;
    const p = state.products.find((x) => x.id === id || x.sku === id || x.barcode === id);
    if (!p || p.active === false) throw notFound('product_not_found', 'کالا یافت نشد.');
    // ثبت بازدید (بدون قفل سنگین)
    await db.tx((st) => { const t = st.products.find((x) => x.id === p.id); if (t) t.views = (t.views || 0) + 1; });
    try { logAudit(ctx.user || null, 'product.view', p.id, {}); } catch { /* noop */ }
    invalidateSearchIndex();
    const related = state.products
      .filter((x) => x.id !== p.id && x.active !== false && (x.categoryId === p.categoryId || x.brandId === p.brandId))
      .slice(0, 8);
    const reviews = state.reviews
      .filter((r) => r.productId === p.id && r.status === 'approved')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(ctx.res, 200, {
      ok: true,
      product: publicProduct(p, { full: true, categories: state.categories, brands: state.brands }),
      category: publicCategory(state.categories.find((c) => c.id === p.categoryId) || {}),
      brand: state.brands.find((b) => b.id === p.brandId) || null,
      related: related.map((x) => publicProduct(x, { categories: state.categories, brands: state.brands })),
      reviews: reviews.slice(0, 30).map(publicReview),
      reviewStats: reviewStats(reviews),
      isInWishlist: ctx.user ? (ctx.user.wishlist || []).includes(p.id) : false,
      myReview: ctx.user ? (state.reviews.find((r) => r.productId === p.id && r.userId === ctx.user.id) || null) : null,
    });
  });

  router.get('/api/categories', async (ctx) => {
    const state = ctx.state;
    const counts = {};
    for (const p of state.products) if (p.active !== false) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    sendJson(ctx.res, 200, {
      ok: true,
      items: state.categories.filter((c) => c.active !== false).map((c) => ({ ...publicCategory(c), count: counts[c.id] || 0 })),
    });
  });

  router.get('/api/brands', async (ctx) => {
    const state = ctx.state;
    const counts = {};
    for (const p of state.products) if (p.active !== false) counts[p.brandId] = (counts[p.brandId] || 0) + 1;
    sendJson(ctx.res, 200, {
      ok: true,
      items: state.brands.filter((b) => b.active !== false).map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn, count: counts[b.id] || 0 })),
    });
  });

  // ── فرصت‌های شغلی (عمومی) ──────────────────────────────────
  // فهرست آگهی‌های استخدام فعال — فقط وقتی کلید اصلی فروشگاه روشن باشد
  router.get('/api/careers', async (ctx) => {
    const state = ctx.state;
    if (state.settings?.features?.careers === false) throw notFound('careers_disabled', 'این بخش فعلاً فعال نیست.');
    const openings = (state.careerOpenings || [])
      .filter((o) => o.open !== false)
      .map((o) => ({
        id: o.id, title: o.title, titleEn: o.titleEn || '', department: o.department || '',
        description: o.description || '',
        responsibilities: o.responsibilities || [], requirements: o.requirements || [],
        experience: o.experience || '', workingHours: o.workingHours || '', location: o.location || '',
        createdAt: o.createdAt,
      }));
    sendJson(ctx.res, 200, { ok: true, enabled: true, openings });
  });

  // ثبت درخواست استخدام (مهمان هم می‌تواند؛ رزومه اختیاری است)
  router.post('/api/careers/:id/apply', async (ctx) => {
    const state = ctx.state;
    if (state.settings?.features?.careers === false) throw notFound('careers_disabled', 'این بخش فعلاً فعال نیست.');
    const id = V.id(ctx.params.id, 'شناسه');
    const body = ctx.body || {};
    const name = V.str(body.name, { min: 2, max: 60, field: 'نام و نام خانوادگی' });
    const phone = String(body.phone ?? '').replace(/[\s-]/g, '');
    if (!/^09\d{9}$/.test(phone)) throw badRequest('invalid_phone', 'شمارهٔ موبایل معتبر نیست (۱۱ رقم، شروع با ۰۹).');
    const age = body.age !== undefined && body.age !== null && body.age !== '' ? V.int(body.age, { min: 16, max: 80, field: 'سن', def: '' }) : '';
    const education = V.optStr(body.education, { max: 60, field: 'تحصیلات' });
    const experience = V.optStr(body.experience, { max: 300, field: 'سابقهٔ کاری' });
    const resumeUrl = body.resumeUrl ? String(body.resumeUrl).slice(0, 300) : '';
    if (resumeUrl && (!resumeUrl.startsWith('/uploads/') || resumeUrl.includes('..'))) throw badRequest('invalid_resume', 'فایل رزومه معتبر نیست.');
    ctx.rateLimit(`career:${ctx.user?.id || ctx.ip}`, ctx.user ? 10 : 4, 24 * 60 * 60 * 1000);

    const created = await db.tx((st) => {
      const o = (st.careerOpenings || []).find((x) => x.id === id);
      if (!o || o.open === false) throw notFound('opening_not_found', 'این فرصت شغلی دیگر فعال نیست.');
      // جلوگیری از ثبت تکراری با همان شمارهٔ موبایل برای همین شغل
      if ((st.jobApplications || []).some((a) => a.openingId === id && a.phone === phone)) {
        throw badRequest('already_submitted', 'شما قبلاً برای همین فرصت شغلی درخواست ثبت کرده‌اید.');
      }
      const a = {
        id: uid('ja'),
        openingId: id,
        name, phone, age,
        education: education || '', experience: experience || '',
        resumeUrl: resumeUrl || '',
        userId: ctx.user?.id || null, userName: ctx.user?.name || '',
        status: 'pending', note: '',
        createdAt: nowISO(), updatedAt: nowISO(),
      };
      st.jobApplications = st.jobApplications || [];
      st.jobApplications.unshift(a);
      logAudit(ctx.user || null, 'career.application.submit', `${o.title}:${phone}`, { resume: !!resumeUrl });
      // خبر فوری به مدیران و کارمندان
      for (const u of st.users) {
        if ((u.role === 'owner' || u.role === 'staff') && u.status !== 'blocked') {
          pushNotification(st, {
            userId: u.id, type: 'system', level: 'info',
            title: 'درخواست استخدام جدید',
            body: `${name} برای «${o.title}» درخواست داد.`,
            link: '#/admin/careers',
          });
        }
      }
      return { ...a };
    });
    sendJson(ctx.res, 200, { ok: true, application: { id: created.id, status: created.status, createdAt: created.createdAt } });
  });

  // جست‌وجوی یکپارچه + تکمیل خودکار
  router.get('/api/search', async (ctx) => {
    const state = ctx.state;
    const q = String(ctx.query.get('q') || '').trim();
    const limit = Math.min(Number(ctx.query.get('limit')) || 8, 20);
    const nq = normalizeText(q);
    if (!nq) {
      const popular = [...state.products].filter((p) => p.active !== false).sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, limit);
      return sendJson(ctx.res, 200, { ok: true, query: '', products: popular.map((p) => publicProduct(p, { categories: state.categories, brands: state.brands })), categories: [], brands: [], pages: [], trending: trendingTerms(state) });
    }
    const r = runSearch(state, { q, limit, page: 1, sort: 'relevant' });
    const cats = state.categories.filter((c) => normalizeText(`${c.name} ${c.nameEn}`).includes(nq)).slice(0, 4);
    const brands = state.brands.filter((b) => normalizeText(`${b.name} ${b.nameEn}`).includes(nq)).slice(0, 4);
    const pages = pageMatches(state, nq).slice(0, 4);
    sendJson(ctx.res, 200, {
      ok: true, query: stripAngles(q),
      products: r.items.map((p) => publicProduct(p, { categories: state.categories, brands: state.brands })),
      total: r.total, didYouMean: r.didYouMean,
      categories: cats.map(publicCategory),
      brands: brands.map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn })),
      pages, trending: trendingTerms(state),
    });
  });

  // جست‌وجوی تصویری (مشابه Google Lens) — هش تصویر از سمت کلاینت محاسبه می‌شود
  router.post('/api/search/image', async (ctx) => {
    const state = ctx.state;
    if (state.settings.features?.imageSearch === false) throw badRequest('disabled', 'جست‌وجوی تصویری غیرفعال است.');
    const dhash = V.optStr(ctx.body?.dhash, { max: 32, field: 'dhash' });
    const hist = Array.isArray(ctx.body?.hist) ? ctx.body.hist.slice(0, 64).map((x) => Number(x) || 0) : [];
    if (!dhash || dhash.length !== 16) throw badRequest('invalid_hash', 'هش تصویر معتبر نیست. لطفاً دوباره تلاش کنید.');
    const hashes = state.imageHashes || {};
    const scored = [];
    for (const [pid, h] of Object.entries(hashes)) {
      const p = state.products.find((x) => x.id === pid && x.active !== false);
      if (!p) continue;
      const d = hamming(dhash, h.dhash || '');
      const hd = hist.length && Array.isArray(h.hist) ? histDistance(hist, h.hist) : 0.5;
      const score = Math.max(0, 100 - d * 2.2) * 0.72 + (1 - hd) * 100 * 0.28;
      if (d <= 18 || hd <= 0.42) scored.push({ p, score, distance: d });
    }
    scored.sort((a, b) => b.score - a.score);
    sendJson(ctx.res, 200, {
      ok: true,
      indexed: Object.keys(hashes).length,
      items: scored.slice(0, 12).map((x) => ({ ...publicProduct(x.p, { categories: state.categories, brands: state.brands }), matchScore: Math.round(x.score), distance: x.distance })),
    });
  });

  // اسکن بارکد → نمایش قیمت (برای دستگاه بارکدخوان / موبایل)
  router.post('/api/scan', async (ctx) => {
    const state = ctx.state;
    const code = V.str(ctx.body?.code, { max: 64, field: 'بارکد' });
    const p = state.products.find((x) => x.barcode === code || x.sku === code || x.id === code);
    if (!p) {
      return sendJson(ctx.res, 404, { ok: false, code: 'not_found', message: 'کالایی با این بارکد پیدا نشد.', found: false });
    }
    const pp = publicProduct(p, { full: true, categories: state.categories, brands: state.brands });
    if (ctx.user && (ctx.user.role === 'owner' || ctx.user.role === 'staff')) {
      Object.assign(pp, { cost: p.cost || 0, stock: p.stock || 0, reserved: p.reserved || 0, sku: p.sku });
    }
    sendJson(ctx.res, 200, { ok: true, found: true, product: pp });
  });

  router.get('/api/stats/public', async (ctx) => {
    if (ctx.state.settings.features?.publicStats === false) return sendJson(ctx.res, 200, { ok: true, stats: null });
    const s = ctx.state;
    const days = Object.entries(s.visits).slice(-14).map(([d, v]) => ({ date: d, visits: v.visits || 0, unique: v.unique || 0 }));
    sendJson(ctx.res, 200, { ok: true, stats: publicStats(s), chart: days, topProducts: topProducts(s) });
  });

  router.get('/api/pages/:key', async (ctx) => {
    const key = V.oneOf(ctx.params.key, ['about', 'guide', 'service', 'faq', 'terms', 'privacy', 'insurance', 'ticketRules', 'bugReport', 'contact', 'installments'], 'key');
    let page = ctx.state.pages?.[key];
    if (!page && key === 'installments') {
      page = {
        title: 'راهنمای خرید اقساطی',
        body: '<h3>شرایط خرید اقساطی</h3><p>در این فروشگاه می‌توانید از طریق درگاه‌های <strong>اسنپ‌پی، ازکی‌وام و دیجی‌پی</strong> خرید اقساطی انجام دهید.</p><ul><li>حداقل مبلغ خرید برای ثبت سفارش اقساطی ۱ میلیون تومان است.</li><li>تأیید احراز هویت (KYC) از پنل کاربری الزامی است.</li></ul>',
        titleEn: 'Installments Guide',
        bodyEn: '<p>You can purchase via SnappPay, AzkiVam, or DigiPay.</p>'
      };
    }
    if (!page) throw notFound('page_not_found', 'صفحه یافت نشد.');
    sendJson(ctx.res, 200, { ok: true, key, page, settings: { store: ctx.state.settings.store, shipping: publicShipping(ctx.state.settings.shipping), plus: publicPlus(ctx.state.settings.plus, ctx.state.settings.features) } });
  });

  router.post('/api/visits', async (ctx) => {
    ctx.rateLimit('visit:' + ctx.ip, 10, 60 * 1000);
    await db.tx((st) => { recordVisit(st, ctx.cookies['ys_vid'] || ctx.ip, ctx.ip); });
    sendJson(ctx.res, 200, { ok: true });
  });

  // نظرات یک محصول (عمومی)
  router.get('/api/products/:id/reviews', async (ctx) => {
    const p = ctx.state.products.find((x) => x.id === ctx.params.id);
    if (!p) throw notFound('product_not_found', 'کالا یافت نشد.');
    const all = ctx.state.reviews.filter((r) => r.productId === p.id && r.status === 'approved');
    const type = ctx.query.get('type') || 'all';
    const list = type === 'all' ? all : all.filter((r) => r.type === type);
    sendJson(ctx.res, 200, {
      ok: true, items: list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200).map(publicReview),
      stats: reviewStats(all),
      canReview: !!ctx.user,
      myReview: ctx.user ? (ctx.state.reviews.find((r) => r.productId === p.id && r.userId === ctx.user.id) || null) : null,
    });
  });
}

// ── توابع کمکی ─────────────────────────────────────────────
function stripAngles(s) { return String(s || '').replace(/[<>]/g, '').slice(0, 120); }
export function publicCategory(c) {
  return { id: c.id, name: c.name, nameEn: c.nameEn, glyph: c.glyph || 'misc', parentId: c.parentId || null, order: c.order || 0, description: c.description || '', descriptionEn: c.descriptionEn || '' };
}
export function publicReview(r) {
  return {
    id: r.id, productId: r.productId, type: r.type || 'review', rating: r.rating || 0,
    title: r.title || '', body: r.body || '', userName: r.userName || 'کاربر', userBadge: r.userBadge || 'visitor',
    status: r.status, reply: r.reply || '', replyAt: r.replyAt || null, likes: r.likes || 0,
    createdAt: r.createdAt,
  };
}
export function reviewStats(list) {
  const rated = list.filter((r) => r.type === 'review' && r.rating > 0);
  const dist = [0, 0, 0, 0, 0];
  for (const r of rated) dist[Math.min(5, Math.max(1, r.rating)) - 1]++;
  const avg = rated.length ? rated.reduce((a, b) => a + b.rating, 0) / rated.length : 0;
  return { count: rated.length, avg: Math.round(avg * 10) / 10, dist, questions: list.filter((r) => r.type === 'question').length };
}
/**
 * ابزارهای فروش برای کلاینت: فقط کلیدهای عمومی. اطلاعات بانکی تنها وقتی ارسال می‌شود
 * که قابلیت روشن باشد تا با خاموش‌شدن در پنل، بلافاصله از سایت مشتری حذف شود.
 */
export function publicSalesTools(st) {
  const t = st && typeof st === 'object' ? st : {};
  const bankOn = t.bankDetailsEnabled !== false;
  const bd = bankOn && t.bankDetails && typeof t.bankDetails === 'object' ? t.bankDetails : {};
  return {
    stickyBuyBarEnabled: t.stickyBuyBarEnabled !== false,
    whatsappConsultEnabled: t.whatsappConsultEnabled !== false,
    whatsappPhone: typeof t.whatsappPhone === 'string' ? t.whatsappPhone : '',
    wholesaleInquiryEnabled: t.wholesaleInquiryEnabled !== false,
    productWarrantyBadgeEnabled: t.productWarrantyBadgeEnabled !== false,
    productWarrantyMonths: Number(t.productWarrantyMonths) > 0 ? Number(t.productWarrantyMonths) : 0,
    skuFastSearchEnabled: t.skuFastSearchEnabled !== false,
    proformaInvoiceEnabled: t.proformaInvoiceEnabled !== false,
    freeShippingBarEnabled: t.freeShippingBarEnabled !== false,
    freeShippingThreshold: Number(t.freeShippingThreshold) > 0 ? Number(t.freeShippingThreshold) : 0,
    bankDetailsEnabled: bankOn,
    bankDetails: {
      bankName: bd.bankName || '', cardNumber: bd.cardNumber || '', iban: bd.iban || '', owner: bd.owner || '',
    },
  };
}
export function publicShipping(s = {}) {
  return {
    courierBase: s.courierBase || 0, freeOver: s.freeOver || 0,
    insuranceRatePct: s.insuranceRatePct ?? 1.5, insuranceMin: s.insuranceMin || 0,
    pickupEnabled: s.pickupEnabled !== false, courierEnabled: s.courierEnabled !== false,
    expressEnabled: !!s.expressEnabled, expressFee: s.expressFee || 0, handlingHours: s.handlingHours || 24,
    zones: s.zones || [],
  };
}
export function publicPlus(s = {}, features = {}) {
  return {
    enabled: features?.plus !== false && s.enabled !== false, price: s.price || 0, durationDays: s.durationDays || 30,
    discountPct: s.discountPct || 0, freeShippingMin: s.freeShippingMin ?? 0, autoInsurance: !!s.autoInsurance,
    prioritySupport: !!s.prioritySupport, expressDiscountPct: s.expressDiscountPct || 0, perks: s.perks || [],
  };
}
export function activeAds(state) {
  if (state.settings.features?.ads === false) return [];
  const now = Date.now();
  return (state.ads || []).filter((a) => {
    if (!a.active) return false;
    if (a.startAt && new Date(a.startAt).getTime() > now) return false;
    if (a.endAt && new Date(a.endAt).getTime() < now) return false;
    return true;
  }).map((a) => ({ id: a.id, slot: a.slot, title: a.title, titleEn: a.titleEn, text: a.text, textEn: a.textEn, link: a.link, cta: a.cta, ctaEn: a.ctaEn, image: a.image }));
}
function trendingTerms(state) {
  const freq = new Map();
  for (const p of state.products) {
    if (p.active === false) continue;
    for (const t of p.tags || []) freq.set(t, (freq.get(t) || 0) + (p.sold || 1));
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
}
function topProducts(state) {
  return [...state.products].filter((p) => p.active !== false)
    .sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5)
    .map((p) => publicProduct(p, { categories: state.categories, brands: state.brands }));
}
function pageMatches(state, q) {
  const out = [];
  const pages = state.pages || {};
  const titles = {
    about: ['درباره ما', 'about'], guide: ['راهنمای خرید', 'buying guide'], service: ['خدمات مشتریان', 'customer service'],
    faq: ['سوالات متداول', 'faq'], terms: ['قوانین و مقررات', 'terms'], privacy: ['حریم خصوصی', 'privacy'],
    insurance: ['بیمه مرسوله', 'insurance'], ticketRules: ['قوانین تیکت', 'ticket rules'], bugReport: ['گزارش خطا', 'bug report'], contact: ['تماس با ما', 'contact'],
  };
  for (const [key, names] of Object.entries(titles)) {
    if (!pages[key]) continue;
    const blob = normalizeText(names.join(' ') + ' ' + JSON.stringify(pages[key].hero || {}));
    if (blob.includes(q)) out.push({ key, title: names[0], titleEn: names[1], link: `#/pages/${key}` });
  }
  return out;
}
