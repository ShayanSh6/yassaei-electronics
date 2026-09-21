/* سرویس‌ورکر یاسایی — پوستهٔ آفلاین + کش هوشمند */
const VERSION = 'ys-v138';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const DATA = `${VERSION}-data`;

const PRECACHE = [
  '/',
  '/index.html',
  '/css/app.css',
  '/manifest.webmanifest',
  '/bundle/main.js',
  '/assets/img/favicon.svg',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/img/icon-maskable-512.png',
  '/assets/img/hero-circuit.svg',
  '/assets/fonts/Vazirmatn-Regular.woff2',
  '/assets/fonts/Vazirmatn-Medium.woff2',
  '/assets/fonts/Vazirmatn-Bold.woff2',
  '/assets/fonts/Vazirmatn-ExtraBold.woff2',
];

// فهرست ماژول‌ها به‌صورت خودکار توسط tools/gen-sw-precache.mjs به‌روز می‌شود
const JS_PRECACHE = [
  '/assets/img/brands/anker.svg',
  '/assets/img/brands/apple.svg',
  '/assets/img/brands/baseus.svg',
  '/assets/img/brands/dji.svg',
  '/assets/img/brands/greenlion.svg',
  '/assets/img/brands/hoco.svg',
  '/assets/img/brands/huawei.svg',
  '/assets/img/brands/jbl.svg',
  '/assets/img/brands/lenovo.svg',
  '/assets/img/brands/no_name.svg',
  '/assets/img/brands/philips.svg',
  '/assets/img/brands/porodo.svg',
  '/assets/img/brands/realme.svg',
  '/assets/img/brands/remax.svg',
  '/assets/img/brands/samsung.svg',
  '/assets/img/brands/sandisk.svg',
  '/assets/img/brands/sony.svg',
  '/assets/img/brands/soundcore.svg',
  '/assets/img/brands/xiaomi.svg',
  '/assets/img/products/p001.svg',
  '/assets/img/products/p002.svg',
  '/assets/img/products/p003.svg',
  '/assets/img/products/p004.svg',
  '/assets/img/products/p005.svg',
  '/assets/img/products/p006.svg',
  '/assets/img/products/p007.svg',
  '/assets/img/products/p008.svg',
  '/assets/img/products/p009.svg',
  '/assets/img/products/p010.svg',
  '/assets/img/products/p011.svg',
  '/assets/img/products/p012.svg',
  '/assets/img/products/p013.svg',
  '/assets/img/products/p014.svg',
  '/assets/img/products/p015.svg',
  '/assets/img/products/p016.svg',
  '/assets/img/products/p017.svg',
  '/assets/img/products/p018.svg',
  '/assets/img/products/p019.svg',
  '/assets/img/products/p020.svg',
  '/assets/img/products/p021.svg',
  '/assets/img/products/p022.svg',
  '/assets/img/products/p023.svg',
  '/assets/img/products/p024.svg',
  '/assets/img/products/p025.svg',
  '/assets/img/products/p026.svg',
  '/assets/img/products/p027.svg',
  '/assets/img/products/p028.svg',
  '/assets/img/products/p029.svg',
  '/assets/img/products/p030.svg',
  '/assets/img/products/p031.svg',
  '/assets/img/products/p032.svg',
  '/assets/img/products/p033.svg',
  '/assets/img/products/p034.svg',
  '/assets/img/products/p035.svg',
  '/assets/img/products/p036.svg',
  '/assets/img/products/p037.svg',
  '/assets/img/products/p038.svg',
  '/assets/img/products/p039.svg',
  '/assets/img/products/p040.svg',
  '/assets/img/products/p041.svg',
  '/assets/img/products/p042.svg',
  '/assets/img/products/p043.svg',
  '/assets/img/products/p044.svg',
  '/assets/img/products/p045.svg',
  '/assets/img/products/p046.svg',
  '/assets/img/products/p047.svg',
  '/assets/img/products/p048.svg',
  '/assets/img/products/p049.svg',
  '/assets/img/products/p050.svg',
  '/assets/img/products/p051.svg',
  '/assets/img/products/p052.svg',
  '/assets/img/products/p053.svg',
  '/assets/img/products/p054.svg',
  '/assets/img/products/p055.svg',
  '/assets/img/products/p056.svg',
  '/assets/img/products/p057.svg',
  '/assets/img/products/p058.svg',
  '/assets/img/products/p059.svg',
  '/assets/img/products/p060.svg',
  '/assets/img/products/p061.svg',
  '/assets/img/products/p062.svg',
  '/assets/img/products/p063.svg',
  '/assets/img/products/p064.svg',
  '/assets/img/products/p065.svg',
  '/assets/img/products/p066.svg',
  '/assets/img/products/p067.svg',
  '/assets/img/products/p068.svg',
  '/assets/img/products/p069.svg',
  '/assets/img/products/p070.svg',
  '/assets/img/products/p071.svg',
  '/assets/img/products/p072.svg',
  '/assets/img/products/p073.svg',
  '/assets/img/products/p074.svg',
  '/assets/img/products/p075.svg',
  '/assets/img/products/p076.svg',
  '/assets/img/products/p077.svg',
  '/assets/img/products/p078.svg',
  '/assets/img/products/p079.svg',
  '/assets/img/products/p080.svg',
  '/assets/img/products/p081.svg',
  '/assets/img/products/p082.svg',
  '/assets/img/products/p083.svg',
  '/css/app.css',
  '/js/actions.mjs',
  '/js/chat.mjs',
  '/js/components.mjs',
  '/js/i18n.mjs',
  '/js/lib/admin-nav.mjs',
  '/js/lib/anti-inspect.mjs',
  '/js/lib/api.mjs',
  '/js/lib/bank-box.mjs',
  '/js/lib/dom.mjs',
  '/js/lib/kyc.mjs',
  '/js/lib/nav-icons.mjs',
  '/js/lib/nav.mjs',
  '/js/lib/sales.mjs',
  '/js/lib/vision.mjs',
  '/js/main.mjs',
  '/js/map.mjs',
  '/js/router.mjs',
  '/js/state.mjs',
  '/js/ui.mjs',
  '/js/views/account.mjs',
  '/js/views/admin/admin-nav.mjs',
  '/js/views/admin/careers.mjs',
  '/js/views/admin/catalog.mjs',
  '/js/views/admin/chat.mjs',
  '/js/views/admin/dashboard.mjs',
  '/js/views/admin/devices.mjs',
  '/js/views/admin/feedback.mjs',
  '/js/views/admin/finance.mjs',
  '/js/views/admin/index.mjs',
  '/js/views/admin/insights.mjs',
  '/js/views/admin/invoice.mjs',
  '/js/views/admin/kyc.mjs',
  '/js/views/admin/layout.mjs',
  '/js/views/admin/marketing.mjs',
  '/js/views/admin/media.mjs',
  '/js/views/admin/orders.mjs',
  '/js/views/admin/pages.mjs',
  '/js/views/admin/products.mjs',
  '/js/views/admin/reviews.mjs',
  '/js/views/admin/settings.mjs',
  '/js/views/admin/tasks.mjs',
  '/js/views/admin/templates.mjs',
  '/js/views/admin/tickets.mjs',
  '/js/views/admin/translations.mjs',
  '/js/views/admin/users.mjs',
  '/js/views/auth.mjs',
  '/js/views/careers.mjs',
  '/js/views/cart.mjs',
  '/js/views/catalog.mjs',
  '/js/views/checkout-done.mjs',
  '/js/views/checkout.mjs',
  '/js/views/compare.mjs',
  '/js/views/home.mjs',
  '/js/views/invoice-print.mjs',
  '/js/views/lottery.mjs',
  '/js/views/not-found.mjs',
  '/js/views/order-detail.mjs',
  '/js/views/page.mjs',
  '/js/views/pay.mjs',
  '/js/views/price-check.mjs',
  '/js/views/product.mjs',
  '/js/views/search-image.mjs',
  '/js/views/stats.mjs',
  '/js/views/ticket-detail.mjs',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    // ماژول‌ها و css را پیش‌کش کن تا اولین بازدید هم آفلاین کامل کار کند
    const rc = await caches.open(RUNTIME);
    // صف با هم‌روندی محدود تا سرور تک‌رشته‌ای زیر بار موج نصب نخوابد
    const queue = [...JS_PRECACHE];
    const workers = await Promise.all([1, 2, 3, 4, 5, 6].map(async () => {
      while (queue.length) {
        const u = queue.shift();
        try { await rc.add(new Request(u, { cache: 'reload' })); }
        catch { try { await rc.add(new Request(u, { cache: 'reload' })); } catch { /* رد شو */ } }
      }
    }));
    // بوت‌استرپ را همان موقع نصب پیش‌کش کن تا اولین بازدید هم آفلاین کار کند
    try {
      const dc = await caches.open(DATA);
      const r = await fetch('/api/bootstrap');
      if (r.ok) await putSafe(dc, new Request('/api/bootstrap'), r);
    } catch { /* هنوز آنلاین نیست */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME && k !== DATA).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isNav = (req) => req.mode === 'navigate';
const sameOrigin = (url) => url.origin === self.location.origin;

async function putSafe(cache, req, res) {
  try {
    if (res && res.ok && req.method === 'GET') await cache.put(req, res.clone());
  } catch { /* quota */ }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url)) return;

  // ناوبری SPA: شبکه اول، در آفلاین پوستهٔ کش‌شده
  if (isNav(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch(req);
        if (res.ok) await putSafe(cache, new Request('/index.html'), res);
        return res;
      } catch {
        const hit = await cache.match('/index.html') || await cache.match('/');
        return hit || new Response('<!doctype html><meta charset="utf-8"><title>آفلاین</title><p style="font-family:Tahoma;padding:24px">اتصال اینترنت برقرار نیست.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // داده‌های API: شبکه اول + کش کوتاه‌مدت برای خواندن آفلاین
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA);
      try {
        const res = await fetch(req);
        if (res.ok && (url.pathname === '/api/bootstrap' || url.pathname.startsWith('/api/products') || url.pathname.startsWith('/api/pages/') || url.pathname === '/api/stats/public')) {
          await putSafe(cache, req, res);
        }
        return res;
      } catch {
        const hit = await cache.match(req);
        if (hit) {
          const head = new Headers(hit.headers);
          head.set('X-Offline', '1');
          return new Response(hit.body, { status: hit.status, headers: head });
        }
        return Response.error();
      }
    })());
    return;
  }

  // فایل‌های استاتیک: کش اول + به‌روزرسانی در پس‌زمینه
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/out/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const network = fetch(req).then((res) => { putSafe(cache, req, res); return res; }).catch(() => null);
      if (hit) return hit;
      const res = await network;
      if (res) return res;
      // آفلاین با query نسخهٔ جدید: نسخهٔ کش‌شدهٔ بدون query قابل قبول است
      const stale = await cache.match(req, { ignoreSearch: true });
      if (stale) return stale;
      const shell = await caches.open(SHELL);
      return (await shell.match(req)) || Response.error();
    })());
    return;
  }
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'CLEAN') {
    caches.delete(DATA);
  }
});
