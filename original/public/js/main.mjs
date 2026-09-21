// ─────────────────────────────────────────────────────────────
//  نقطهٔ ورود برنامه: راه‌اندازی، اسکلت سایت، جست‌وجو، پالت فرمان
//
//  نقشهٔ کد سمت کلاینت (برای ویرایش‌های آینده):
//   • state.mjs    : وضعیت سراسری + بوت‌استرپ + اعمال تم/زبان/پوسته
//   • router.mjs   : مسیریاب هش‌محور؛ نماها تنبل بارگیری می‌شوند
//   • views/*      : هر صفحه یک ماژول با render()/mount() است
//   • lib/api.mjs  : کلاینت API با CSRF، تلاش مجدد، روکش صف انتظار
//   • lib/dom.mjs  : قالب امن h`…` (هربخشی خودکار escape می‌شود)
//   • actions.mjs  : هندلرهای data-act (کلیک/submit) یک‌جا ثبت می‌شوند
//   • ui.mjs       : توست، مودال، دراور، دیالوگ تأیید
//  برای افزودن صفحه: یک فایل در views/ بساز و در router ثبتش کن.
// ─────────────────────────────────────────────────────────────
import {
  S, boot, on, settings, store, ui, feat, can, refreshBootstrap,
  setPref, applyPrefs, loadCart, refreshMe, hasConsent, setConsent,
  watchNetwork, watchInstall, promptInstall, adInSlot, isPlus, addSearch,
  accountNav, headerNav, mobileNav, kycVisible,
} from './state.mjs';
import { navIconHtml } from './lib/nav.mjs';
import { t, lang, isFa, applyI18n, setLang } from './i18n.mjs';
import { api } from './lib/api.mjs';
import { html as h, raw, esc, icon, el, qs, debounce, fmtNum, fmtTel, faDigits, catIcon, applyDyn, safeHref } from './lib/dom.mjs';
import { toast, toastSuccess, toastError, toastApiError, modal, drawer, confirmDialog, installHintModal, updateSleepScreen, withBusy, closeAllLayers } from './ui.mjs';
import { installDelegation, act } from './actions.mjs';
import { initRouter, navigate, refresh, parseHash } from './router.mjs';
import { initChat, openChat } from './chat.mjs';
import './map.mjs';
import { catName, brandName, prodName, BUILD } from './state.mjs';
setTimeout(hideWelcome, 10000); // Top-level failsafe
import { bannerHtml, minimapSvg } from './components.mjs';
import { initAntiInspect, refreshAntiInspect } from './lib/anti-inspect.mjs';

// ── راه‌اندازی ──────────────────────────────────────────────
async function init() {
  
  installDelegation();
  // محافظت سمت کاربر: کلیک راست، میان‌برهای DevTools، هشدار کنسول و
  // جلوگیری از کشیدن تصاویر کالا — پیش‌فرض روشن و از پنل مدیر
  // (#/admin/settings/security) قابل خاموش‌کردن است.
  initAntiInspect(() => settings()?.security?.antiInspectEnabled !== false);
  on('settings', () => refreshAntiInspect());
  if (location.search.includes('_nocache')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
  wireStaticControls();
  await boot();
  refreshAntiInspect();   // تنظیمات فروشگاه آمد؛ محافظت را با مقدار واقعی هم‌گام کن
  renderChrome();
  syncSleep();
  applyI18n();
  wireLiveClock();
  wireSearch();
  wirePalette();
  initChat();
  watchNetwork();
  watchInstall();
  wireNetworkToasts();
  wireScroll();
  initRouter();
  registerSW();
  recordVisit();
  subscribeEvents();
  wireSleepHeartbeat();
  wireCursorHalo();
  wireEcoMode();
  sendVisitBeacon();
  wireSearchShortcut();
  maybeCouponFromUrl();
  maybeConsent();
  maybeForcePasswordChange();
  hideWelcome();
  wireRefresh();
  enhanceTooltips();
  wireErrorTelemetry();
  document.getElementById('bootSplash')?.remove();
}

// ── صفحه خوش‌آمد: حداقل ۷۰۰ms بماند، سپس نرم محو شود ──────
const T0 = performance.now();
function hideWelcome() {
  const ws = document.getElementById('welcomeScreen');
  if (!ws) return;
  const wait = Math.max(0, 700 - (performance.now() - T0));
  setTimeout(() => { ws.classList.add('gone'); setTimeout(() => ws.parentNode && ws.parentNode.removeChild(ws), 520); }, wait);
}

// ── دکمهٔ تازه‌سازی بالای صفحه ──────────────────────────────
function wireRefresh() {
  const b = document.getElementById('btnRefresh');
  if (!b) return;
  b.addEventListener('click', async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const { toastError } = await import('./ui.mjs');
      const { isFa } = await import('./i18n.mjs');
      toastError(isFa() ? 'برای بروزرسانی و حذف کش باید به اینترنت متصل باشید' : 'You must be online to refresh the app.');
      return;
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let k of keys) await caches.delete(k);
      }
    } catch (e) {
      console.warn('Cache clear failed', e);
    }
    location.href = location.pathname + '?_nocache=' + Date.now();
  });
}

// ── تولتیپ سراسری: هر دکمه/لینکی که برچسب دارد ولی title نه ──
function enhanceTooltips() {
  const pass = () => {
    for (const elx of document.querySelectorAll('button[aria-label],a[aria-label],[role="button"][aria-label]')) {
      if (!elx.title) elx.title = elx.getAttribute('aria-label') || '';
    }
  };
  pass();
  const ob = new MutationObserver(() => { clearTimeout(ob._t); ob._t = setTimeout(pass, 350); });
  ob.observe(document.body, { childList: true, subtree: true });
}

// ── تله‌متری خطاهای کلاینت → پنل مدیر (خودآگاهی باگ‌ها) ─────
function wireErrorTelemetry() {
  const seen = new Set();
  const send = (msg, src, line) => {
    const key = String(msg).slice(0, 120);
    if (seen.has(key) || seen.size > 12) return;
    seen.add(key);
    try {
      const body = JSON.stringify({ msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 200), line: line || 0, path: location.hash.slice(0, 120), build: window.__BM_BUILD || '' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
      else fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* noop */ }
  };
  window.addEventListener('error', (e) => send(e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => send(`unhandledrejection: ${e.reason?.message || e.reason}`, location.href, 0));
}

// ── لوگوهای برند ────────────────────────────────────────────
// نشان پیش‌فرض سربرگ (SVG درون‌خطی؛ رنگ‌ها با متغیرهای پوسته همگام می‌مانند)
const DEFAULT_BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" class="lg-a" stop-color="#3dabff"/><stop offset="1" class="lg-b" stop-color="#1e8ae8"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#g)"/>
  <path d="M18 10v4M24 10v4M30 10v4M18 34v4M24 34v4M30 34v4M10 18h4M10 24h4M10 30h4M34 18h4M34 24h4M34 30h4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  <rect x="14" y="14" width="20" height="20" rx="4.5" fill="#fff"/>
  <path d="M25.5 18.5 20 26h3.6l-1.6 5.5L28 24h-3.6z" class="lg-bolt" fill="#1e8ae8"/></svg>`;
// لوگوی پیش‌فرض پانویس: نشان باکیفیت یاسایی
const FOOTER_BADGE_SRC = '/assets/img/yassaei-poster-badge.svg';

/** جای‌گذاری لوگو: اگر تصویری ست شده باشد <img> وگرنه نشان پیش‌فرض SVG */
function setBrandLogo(box, src, alt) {
  if (!box) return;
  box.innerHTML = src
    ? `<img src="${esc(src)}" alt="${esc(alt || '')}" width="48" height="48" decoding="async">`
    : DEFAULT_BRAND_SVG;
}

// ── دکمه‌هایی که مدیر «غیرفعال» کرده است ────────────────────
// به‌جای رفتن به مسیر، پیام محترمانه نشان داده می‌شود.
document.addEventListener('click', (e) => {
  const off = e.target?.closest?.('[data-nav-off]');
  if (!off) return;
  e.preventDefault();
  e.stopPropagation();
  toast(t('nav.disabledSection'));
}, true);

// ── اسکلت سایت ──────────────────────────────────────────────
function renderChrome() {
  const st = store();
  const u = ui();

  // نوار بالا — همیشه visible؛ اگر مدیر آیتمی نگذاشته، پیش‌فرض‌های فروشگاه
  const topbar = qs('#topbar');
  const fb = [];
  if (st.freeShipOver) fb.push(isFa() ? `ارسال رایگان سفارش‌های بالای ${fmtNum(st.freeShipOver)} تومان` : `Free shipping over ${fmtNum(st.freeShipOver)}`);
  fb.push(isFa() ? 'ضمانت اصالت کالا؛ مرجوع تا ۷ روز' : 'Authenticity guarantee; 7-day returns');
  if (st.phone) fb.push(isFa() ? `پشتیبانی هر روز ۹ تا ۲۱ — ${fmtTel(st.phone)}` : `Support 9–21 daily — ${fmtTel(st.phone)}`);
  if (st.socials?.instagram || true) fb.push(isFa() ? 'تازه‌های گجت هر هفته در اینستاگرام یاسایی' : 'New gadgets weekly on Instagram');
  const tickerItems = S.ticker?.length ? S.ticker : fb;
  topbar.hidden = false;
  topbar.classList.toggle('no-ticker', u.showTicker === false);
  const one = tickerItems.map((x) => h`<span class="ticker-item">${icon('sparkles')} ${x}</span>`).join('');
  qs('#ticker').innerHTML = `<div class="ticker-track">${one}${one}</div>`;
  const tbPhone = qs('#tb-phone');
  tbPhone.href = `tel:${st.phone || ''}`;
  tbPhone.innerHTML = h`${icon('phone')} ${fmtTel(st.phone || '')}`;

  // برند
  qs('#brandName').textContent = isFa() ? (st.name || t('app.name')) : (st.nameEn || st.name || 'Yassaei Electronics');
  qs('#brandTag').textContent = isFa() ? (st.tagline || '') : (st.taglineEn || '');
  qs('#brandLink').setAttribute('aria-label', `${st.name || ''} — ${t('nav.home')}`);
  // لوگوی سربرگ — اگر مدیر تصویری ست کرده باشد از <img> استفاده می‌شود
  setBrandLogo(qs('#brandLink .brand-logo'), String(st.logo || '').trim(), st.name || '');

  // ناوبری اصلی + نوار پایین موبایل
  renderNav();
  renderMobileNav();

  // پانویس
  renderFooter();

  // ناحیهٔ کاربر
  renderUserArea();
  updateBadges();

  // دکمهٔ نصب
  const installBtn = qs('#btnInstallApp');
  if (installBtn) installBtn.hidden = S.installed;
  // متن‌های آزاد سفارشی مدیر روی chrome ساخته‌شده هم اعمال شوند.
  applyDyn(document.getElementById('siteHeader') || document);
  applyDyn(document.getElementById('siteFooter') || document);
}

// ── ساعت و تقویم زنده رسمی ایران در هدر ──────────────────────
function wireLiveClock() {
  const elDate = qs('#tbClockDate');
  const elTime = qs('#tbClockTime');
  const elWrap = qs('#tbClock');
  if (!elDate || !elTime) return;

  const update = () => {
    try {
      const now = new Date();
      if (isFa()) {
        const dFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          timeZone: 'Asia/Tehran',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const parts = Object.fromEntries(dFmt.formatToParts(now).map(p => [p.type, p.value]));
        elDate.textContent = `${parts.weekday}، ${parts.day} ${parts.month} ${parts.year}`;

        const tFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        elTime.textContent = tFmt.format(now);
      } else {
        const dFmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {
          timeZone: 'Asia/Tehran',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        elDate.textContent = dFmt.format(now);

        const tFmt = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        elTime.textContent = tFmt.format(now);
      }
    } catch {
      /* fallback */
    }
  };

  update();
  setInterval(update, 1000);
}

function renderNav() {
  const nav = qs('#navInner');
  if (!nav) return;
  // ── دکمه‌های ناوبری از «مدیریت منوها» ساخته می‌شوند ──────────────
  // (پنل مدیریت ← تنظیمات ← منوها و بخش‌ها · settings.nav.header)
  // ترتیب، عنوان، آیکون/ایموجی، نمایش و فعال/غیرفعال بودن همه از پنل می‌آید.
  const items = headerNav();
  const link = (l) => h`<a class="nav-link" data-nav-key="${l.key}" href="${l.href}" title="${l.label()}"${l.on ? '' : ' data-nav-off="1"'}>${navIconHtml(l)} ${l.label()}</a>`;
  const head = items.slice(0, 2);
  const rest = items.slice(2);
  let html = head.map(link).join('');

  html += h`
    <div class="nav-more">
      <a href="#/products" class="nav-link">${icon('layers')} ${t('nav.allCategories')} ${icon('chevron-down')}</a>
      <div class="nav-dd mega-menu hidden-default">
        <div class="mega-side">
          ${S.categories.filter((c) => !c.parentId).map((c) => h`<a href="#/category/${c.id}" class="mega-side-link" data-cat="${c.id}">${icon(catIcon(c.glyph))} ${catName(c)}</a>`)}
        </div>
        <div class="mega-content">
          <div class="mega-empty muted small">${t('nav.allCategories')}</div>
        </div>
      </div>
    </div>`;

  html += rest.map(link).join('');

  // بنر تبلیغی نوار (اسلات ticker)
  const tickerAds = adInSlot('ticker');
  if (tickerAds.length) html += h`<span class="nav-link muted tiny">${tickerAds[0].title}</span>`;

  nav.innerHTML = html;

  // Dropdown is handled by CSS hover now
  const sideLinks = nav.querySelectorAll('.mega-side-link');
  const megaContent = nav.querySelector('.mega-content');
  if (sideLinks.length && megaContent) {
    const loadCat = (link) => {
      sideLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const catId = link.dataset.cat;
      
      const subCats = S.categories.filter(c => c.parentId === catId);
      const brands = S.brands.slice(0, 10);
      
      let html = `<a href="#/category/${catId}" class="mega-see-all" style="margin-top:0;">${t('nav.allCategories')} ${catName(S.categories.find(c => c.id === catId) || {})} ${icon('chevron-left')}</a>`;
      html += '<div class="mega-sub-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; align-items: start; align-content: start;">';
      
      if (subCats.length) {
        html += '<div class="mega-sub-col" style="display:flex; flex-direction:column; gap:8px;"><h3>دسته‌بندی‌های زیرمجموعه</h3>';
        subCats.forEach(sc => {
          html += `<a href="#/category/${sc.id}" style="margin:0;">${catName(sc)}</a>`;
        });
        html += '</div>';
      }
      
      html += `<div class="mega-sub-col" style="${!subCats.length ? 'grid-column: 1 / -1;' : ''} display:flex; flex-direction:column; gap:8px;"><h3>برندهای پرطرفدار این دسته</h3><div style="display: flex; flex-wrap: wrap; gap: 8px;">`;
      brands.forEach(b => {
        html += `<a href="#/products?cat=${catId}&brand=${b.id}" class="chip" style="margin:0;">${brandName(b)}</a>`;
      });
      html += '</div></div></div>';
      
      megaContent.innerHTML = html;
      megaContent.scrollTop = 0;
    };

    sideLinks.forEach(link => {
      link.addEventListener('mouseenter', () => loadCat(link));
    });
    
    // Auto-load the first category so the menu is never empty
    if (sideLinks[0]) loadCat(sideLinks[0]);
  }
}

// ── نوار پایین موبایل: از «مدیریت منوها» (settings.nav.mobile) ──
const MOBILE_KEYS = { mHome: 'home', mProducts: 'cats', mSearch: 'search', mCart: 'cart', mAccount: 'me' };
function renderMobileNav() {
  const bar = qs('#mobileNav');
  if (!bar) return;
  const items = mobileNav();
  bar.innerHTML = items.map((it) => h`<a href="${it.href}" data-mn="${MOBILE_KEYS[it.id] || it.id}" title="${it.label()}"${it.on ? '' : ' data-nav-off="1"'}>${navIconHtml(it)}<span>${it.label()}</span>${it.id === 'mCart' ? h`<b class="mn-badge" id="mnCart" hidden>0</b>` : ''}</a>`).join('');
}

function renderFooter() {
  const st = store();
  // لوگوی پانویس — پیش‌فرض: نشان باکیفیت یاسایی؛ در صورت ست‌کردن footerLogo از پنل، تصویر مدیر
  setBrandLogo(qs('#fLogoBox'), String(st.footerLogo || '').trim() || FOOTER_BADGE_SRC, st.name || '');
  qs('#fBrandName').textContent = isFa() ? (st.name || t('app.name')) : (st.nameEn || st.name || '');
  qs('#fDesc').textContent = isFa() ? (st.description || '') : (st.descriptionEn || st.description || '');
  qs('#fYear').textContent = isFa() ? faDigits(new Date().getFullYear()) : String(new Date().getFullYear());

  // نشان‌ها
  qs('#fBadges').innerHTML = h`
    <span class="f-badge">${icon('shield')}<span>${t('home.point1')}</span></span>
    <span class="f-badge">${icon('package-check')}<span>${t('home.point2')}</span></span>
    ${feat('insurance') ? h`<span class="f-badge">${icon('scale')}<span>${t('common.insurance')}</span></span>` : ''}
    ${feat('plus') ? h`<span class="f-badge">${icon('sparkles')}<span>${t('footer.plus')}</span></span>` : ''}`;

  // شبکه‌های اجتماعی
  const soc = st.socials || {};
  const socList = [
    ['instagram', safeHref(soc.instagram || 'https://instagram.com/jam.yassaei'), 'camera'],
    ['telegram', safeHref(soc.telegram), 'send'],
    ['whatsapp', soc.whatsapp ? `https://wa.me/${String(soc.whatsapp).replace(/\D/g, '')}` : '', 'chat'],
    ['eitaa', safeHref(soc.eitaa), 'globe'],
  ].filter((x) => x[1]);
  qs('#fSocial').innerHTML = socList.length
    ? socList.map(([name, url, ic]) => h`<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${name}" title="${name}">${icon(ic)}</a>`).join('')
    : h`<span class="muted tiny">${t('footer.contactUs')}</span>`;

  // تماس
  qs('#fContact').innerHTML = h`
    <li>${icon('phone')}<span>${t('contact.phone')}: <a href="tel:${st.phone}">${fmtTel(st.phone || '')}</a></span></li>
    <li>${icon('chat')}<span>${t('contact.mobile')}: <a href="tel:${st.phone2 || st.phone}">${fmtTel(st.phone2 || '')}</a></span></li>
    <li>${icon('mail')}<span><a href="mailto:${st.email}">${st.email}</a></span></li>
    <li>${icon('pin')}<span>${isFa() ? (st.address || '') : (st.addressEn || st.address || '')}</span></li>
    <li>${icon('clock')}<span>${t('footer.workingHours')}: ${(st.workingHours || []).map((w) => h`<bdi>${isFa() ? w.fa : w.en} ${isFa() ? w.time : w.timeEn}</bdi>`)}</span></li>`;

  // کروکی نقشه در پانویس
  qs('#fMinimap').innerHTML = minimapSvg();
  qs('#fMinimap').setAttribute('title', t('contact.mapTitle'));
}

// ── ناحیهٔ کاربر در سربرگ ───────────────────────────────────
function renderUserArea() {
  const menu = qs('#userMenu');
  const authBtn = qs('#btnAuth');
  if (!S.me) {
    menu.hidden = true;
    authBtn.hidden = false;
    authBtn.innerHTML = h`${icon('user')}<span data-i18n="nav.login">${t('nav.login')}</span>`;
    return;
  }
  authBtn.hidden = true;
  menu.hidden = false;
  const me = S.me;
  const initial = (me.name || me.username || '?').trim().charAt(0);
  menu.innerHTML = h`
    <button type="button" class="um-btn" data-um aria-expanded="false" aria-haspopup="true">
      <span class="um-avatar">${esc(initial)}</span>
      <span class="um-name">${esc(me.name || me.username)}</span>
      ${icon('chevron-down')}
    </button>
    <div class="um-dd" data-umbox hidden>
      <div class="um-dd-head">
        <div class="b">${esc(me.name || me.username)}</div>
        <div class="tiny muted">${esc(me.phone || me.email || me.username)}</div>
        ${isPlus() ? h`<span class="badge-pill bp-accent mt-s">${icon('sparkles')} ${t('acc.plus')}</span>` : ''}
      </div>
      ${(() => {
        // منوی کشویی سربرگ: هشت دکمهٔ اول به‌ترتیب دلخواه مدیر + همیشه دکمهٔ احراز هویت
        const items = accountNav();
        const quick = items.slice(0, 8);
        const kycIt = items.find((x) => x.id === 'kyc');
        if (kycIt && !quick.includes(kycIt)) quick.push(kycIt);
        return quick;
      })().map((it) => {
        const badge = it.id === 'wishlist' && S.wishlist.length ? h`<span class="um-count">${fmtNum(S.wishlist.length)}</span>`
          : it.id === 'wallet' ? h`<span class="um-count">${fmtNum(me.wallet?.balance || 0)}</span>`
          : it.id === 'notifications' && S.unread ? h`<span class="um-count">${fmtNum(S.unread)}</span>`
          : it.id === 'kyc' ? (me.kycStatus === 'approved' ? h`<span class="um-count" style="color:var(--success)">✔</span>` : me.kycStatus === 'pending' ? h`<span class="um-count">…</span>` : me.kycStatus === 'rejected' ? h`<span class="um-count" style="color:var(--danger)">!</span>` : '')
          : '';
        return h`<a href="${it.href}" title="${it.label()}"${it.on ? '' : ' data-nav-off="1"'}>${navIconHtml(it)} ${it.label()} ${badge}</a>`;
      })}
      ${feat('compare') ? h`<a href="#/compare">${icon('scale')} ${t('compare.title')} <span class="um-count">${fmtNum(S.compare.length)}</span></a>` : ''}
      ${me.isAdmin ? h`<div class="sep"></div><a href="#/admin">${icon('settings')} ${t('nav.admin')}</a>` : ''}
      <div class="sep"></div>
      <button type="button" data-act="sound-toggle" aria-pressed="${S.prefs?.uiSound ? 'true' : 'false'}">${icon(S.prefs?.uiSound ? 'volume' : 'volume-off')} ${t('misc.uiSound')} <span class="um-sw ${S.prefs?.uiSound ? 'on' : ''}" aria-hidden="true"></span></button>
      <button type="button" data-act="switch-account-modal">${icon('users')} تعویض حساب کاربری</button>
      <button type="button" data-act="logout">${icon('logout')} ${t('common.logout')}</button>
    </div>`;
  const btn = menu.querySelector('[data-um]');
  const box = menu.querySelector('[data-umbox]');
  // اگر اسکلت سربرگ ناقص باشد، بدون خطا از این‌جا رد می‌شویم
  // (خطای یک عنصر نباید رندر کل سایت را متوقف کند)
  if (!btn || !box) return;
  let closeTimer = null;
  const openMenu = () => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    box.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = (immediate = false) => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (immediate) {
      box.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    } else {
      closeTimer = setTimeout(() => {
        box.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }, 160);
    }
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (box.hidden) openMenu(); else closeMenu(true);
  });
  menu.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover: hover) and (min-width: 768px)').matches) {
      openMenu();
    }
  });
  menu.addEventListener('mouseleave', () => {
    if (window.matchMedia('(hover: hover) and (min-width: 768px)').matches) {
      closeMenu(false);
    }
  });
  document.addEventListener('click', (e) => {
    if (!box.hidden && (!e.target.closest('.user-menu') || e.target.closest('a'))) { closeMenu(true); }
  });
}

act('switch-account-modal', async () => {
  const { modal } = await import('./ui.mjs');
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('saved_accounts') || '[]'); } catch {}
  if (!saved.length) { window.location.hash = '/auth'; return; }
  
  const body = el('div', { class: 'account-switcher' });
  body.innerHTML = `<div class="f-col gap-10">
    ${saved.map(a => `
      <div class="card p-15 f-row align-center jc-between ${a.id === S.me?.id ? 'active' : ''}">
        <div class="f-col">
          <strong>${a.name || 'کاربر'}</strong>
          <span class="small muted">${a.phone || ''} ${a.role === 'owner' ? '(مالک)' : ''}</span>
        </div>
        ${a.id !== S.me?.id ? `<button type="button" class="btn primary btn-sm" data-act="switch-login" data-token="${a.token}">ورود</button>` : '<span class="badge success">فعلی</span>'}
      </div>
    `).join('')}
    <div class="sep"></div>
    <a href="#/auth" class="btn outline w-100" data-lx>+ افزودن حساب جدید</a>
  </div>`;
  
  const m = modal({ title: 'تعویض حساب کاربری', body, closeBtn: true });
});

act('switch-login', async (e, btn) => {
  const token = btn.dataset.token;
  if (!token) return;
  await withBusy(btn, async () => {
    try {
      const r = await api.post('/api/auth/switch', { token });
      S.me = r.me;
      toastSuccess('حساب کاربری تغییر یافت.');
      if (r.switchToken) {
        try {
          const arr = JSON.parse(localStorage.getItem("saved_accounts") || "[]");
          const f = arr.filter(x => x.id !== S.me.id);
          f.unshift({ id: S.me.id, token: r.switchToken, name: S.me.name, phone: S.me.phone, role: S.me.role });
          localStorage.setItem("saved_accounts", JSON.stringify(f.slice(0, 5)));
        } catch (err){}
      }
      closeAllLayers();
      navigate('#/');
      refresh();
      await loadCart();
      renderChrome();
    } catch (err) {
      toastApiError(err);
      // Remove invalid token
      try {
        const arr = JSON.parse(localStorage.getItem("saved_accounts") || "[]");
        localStorage.setItem("saved_accounts", JSON.stringify(arr.filter(a => a.token !== token)));
      } catch(e){}
    }
  });
});

act('logout', async () => {
  const ok = await confirmDialog({ text: t('common.logout') + '؟', okText: t('common.logout') });
  if (!ok) return;
  try {
    await api.post('/api/auth/logout');
    S.me = null;
    await loadCart();
    renderChrome();
    toastSuccess(t('auth.logoutDone'));
    navigate('#/');
    refresh();
  } catch (e) { toastError(t('err.generic')); }
});

// ── بج‌ها ───────────────────────────────────────────────────
let faviconSvgText = "";
let faviconSvgUrl = "";
async function updateFavicon(hasUnread) {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  // آیکون تب مرورگر از پنل مدیر قابل تغییر است (خالی = آیکون پیش‌فرض یاسایی)
  const baseIcon = String(store()?.faviconUrl || '').trim() || '/assets/img/favicon.svg';
  if (!hasUnread) {
    if (link.getAttribute('href') !== baseIcon) link.href = baseIcon;
    return;
  }
  if (faviconSvgUrl !== baseIcon) { faviconSvgUrl = baseIcon; faviconSvgText = ""; }
  if (!faviconSvgText) {
    try {
      const res = await fetch(baseIcon);
      faviconSvgText = await res.text();
    } catch { link.href = baseIcon; return; }
  }
  if (!faviconSvgText.includes('</svg>')) { link.href = baseIcon; return; }
  const modified = faviconSvgText.replace('</svg>', '<circle cx="42" cy="8" r="6" fill="#ef4444" stroke="#fff" stroke-width="1.5"/></svg>');
  link.href = 'data:image/svg+xml,' + encodeURIComponent(modified);
}

export function updateBadges() {
  const set = (id, n) => {
    const elx = qs(id);
    if (!elx) return;
    elx.hidden = !n;
    elx.textContent = fmtNum(n);
  };
  set('#cartBadge', S.cart?.count || 0);
  set('#mnCart', S.cart?.count || 0);
  set('#wishBadge', S.wishlist.length);
  set('#compareBadge', S.compare?.length || 0);
  set('#notifBadge', S.unread);
  updateFavicon(S.unread > 0);
}

// ── کنترل‌های ثابت ──────────────────────────────────────────
function wireStaticControls() {
  qs('#btnFullscreen')?.addEventListener('click', () => {
    const b = qs('#btnFullscreen');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(()=>{});
      b.innerHTML = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><use href="#i-minimize"/></svg>';
    } else {
      document.exitFullscreen().catch(()=>{});
      b.innerHTML = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><use href="#i-maximize"/></svg>';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const b = qs('#btnFullscreen');
    if(b) b.innerHTML = document.fullscreenElement ? '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><use href="#i-minimize"/></svg>' : '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><use href="#i-maximize"/></svg>';
  });
  qs('#btnTheme')?.addEventListener('click', () => {
    const cur = S.prefs.theme === 'auto'
      ? (document.documentElement.getAttribute('data-mode') || 'dark')
      : S.prefs.theme;
    const next = cur === 'dark' ? 'light' : 'dark';
    setPref('theme', next);
    const b = qs('#btnTheme');
    b.innerHTML = icon(next === 'dark' ? 'moon' : 'sun');
  });
  qs('#btnLang')?.addEventListener('click', async () => {
    const next = lang() === 'fa' ? 'en' : 'fa';
    setPref('locale', next);
    qs('#langChip').textContent = next === 'fa' ? 'EN' : 'فا';
    applyI18n();
    renderChrome();
    applyI18n();
    refresh(true);
  });
  qs('#btnMenu')?.addEventListener('click', () => openMobileMenu());
  // دکمهٔ جست‌وجوی نوار پایین موبایل: صفحهٔ محصولات (#/search) باز می‌شود و
  // کادر جست‌وجوی سربرگ (searchInput#) فوکوس و به آن اسکرول می‌شود
  document.querySelectorAll('.mobile-nav a[data-mn="search"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const input = qs('#searchInput');
      if (!input) return; // بدون کادر جست‌وجو، رفتار پیش‌فرض لینک (#/search)
      e.preventDefault();
      navigate('#/search');
      try {
        const header = document.getElementById('siteHeader');
        if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch { window.scrollTo({ top: 0 }); }
      setTimeout(() => {
        try { input.focus({ preventScroll: true }); } catch { input.focus(); }
        input.select?.();
      }, 350);
    });
  });
  const fabTop = qs('#fabTop');
  const fabBottom = qs('#fabBottom');
  fabTop?.addEventListener('click', () => {
    cancelGentleScroll();
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  });
  fabBottom?.addEventListener('click', () => {
    // A second tap pauses a running downward scroll; otherwise it starts one.
    if (gentleScrollDirection === 'down') cancelGentleScroll();
    else scrollDownGently();
  });
  qs('#btnInstallApp')?.addEventListener('click', async () => {
    if (S.installPrompt) { const ok = await promptInstall(); if (!ok) installHintModal(); }
    else installHintModal();
  });
}

function openMobileMenu() {
  drawer({
    title: h`<div style="display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700">
      ${icon('menu')} ${t('nav.menu')}
    </div>`,
    body: h`
      <div class="col" style="gap: 8px">
        <a class="nav-link" href="#/" style="padding: 12px; font-size: 15px; border-bottom: 1px solid var(--border)">${icon('home')} ${t('nav.home')}</a>
        <a class="nav-link" href="#/products" style="padding: 12px; font-size: 15px; border-bottom: 1px solid var(--border)">${icon('grid')} ${t('nav.products')}</a>
        ${S.categories.filter((c) => !c.parentId).map((c) => h`<a class="nav-link" href="#/category/${c.id}" style="padding: 12px; font-size: 15px; border-bottom: 1px solid var(--border)">${icon(catIcon(c.glyph))} ${catName(c)}</a>`).join('')}
        <div class="divider" style="margin: 4px 0"></div>
        ${headerNav().map((l) => h`<a class="nav-link" href="${l.href}" style="padding: 12px; font-size: 15px; border-bottom: 1px solid var(--border)"${l.on ? '' : ' data-nav-off="1"'}>${navIconHtml(l)} ${l.label()}</a>`)}
        ${S.me ? '' : h`<a class="btn btn-primary btn-block mt-s" href="#/auth" style="margin-top: 16px">${icon('user')} ${t('nav.login')}</a>`}
      </div>`,
    });
}

// ── جست‌وجو و پیشنهادها ─────────────────────────────────────
function wireSearch() {
  const form = qs('#searchForm');
  const input = qs('#searchInput');
  const box = qs('#suggestBox');
  let activeIdx = -1;

  const closeBox = () => { box.hidden = true; activeIdx = -1; };

  const suggest = debounce(async () => {
    const q = input.value.trim();
    if (!q) {
      // پیشنهادهای پیش‌فرض: اخیر + پرجست‌وجو
      if (!S.searches.length) { closeBox(); return; }
      box.hidden = false;
      box.innerHTML = h`
        <div class="sg-group">${t('search.recent')}</div>
        ${S.searches.map((s) => h`<div class="sg-item" data-q="${s}">${icon('history')}<span class="sg-title">${s}</span></div>`)}`;
      return;
    }
    try {
      const r = await api.get(`/api/search?q=${encodeURIComponent(q)}&limit=7`);
      box.hidden = false;
      let out = '';
      if (r.didYouMean) out += h`<div class="sg-group">${t('search.didYouMean')}</div><div class="sg-item" data-q="${r.didYouMean}">${icon('sparkles')}<span class="sg-title">${r.didYouMean}</span></div>`;
      if (r.categories?.length) out += h`<div class="sg-group">${t('search.inCategories')}</div>${r.categories.map((c) => h`<a class="sg-item" href="#/category/${c.id}">${icon(catIcon(c.glyph))}<span class="sg-title">${catName(c)}</span></a>`)}`;
      if (r.brands?.length) out += h`<div class="sg-group">${t('search.inBrands')}</div>${r.brands.map((b) => h`<div class="sg-item" data-q="${brandName(b)}">${icon('tag')}<span class="sg-title">${brandName(b)}</span></div>`)}`;
      if (r.products?.length) {
        out += h`<div class="sg-group">${t('search.inProducts')}</div>${r.products.map((p) => h`
          <a class="sg-item" href="#/product/${p.id}">
            ${p.images?.[0] ? h`<img class="sg-thumb" src="${p.images[0]}" alt="" loading="lazy" data-glyph="${p.glyph}">` : icon(p.glyph || 'box')}
            <span class="grow"><span class="sg-title">${prodName(p)}</span><span class="sg-meta">${catName({ name: p.categoryName, nameEn: p.categoryNameEn })}</span></span>
            <span class="sg-price">${fmtNum(p.price)}</span>
          </a>`)}`;
      }
      if (!out) out = h`<div class="sg-item muted">${t('common.noResult')}</div>`;
      box.innerHTML = out;
    } catch { closeBox(); }
  }, 240);

  input.addEventListener('input', suggest);
  input.addEventListener('focus', suggest);
  document.addEventListener('click', (e) => { if (!e.target.closest('.searchbox')) closeBox(); });

  box.addEventListener('click', (e) => {
    // آیتم‌های لینک‌دار (دسته/محصول): با ناوبری بسته شوند و روی صفحهٔ بعد نمانند
    if (e.target.closest('a.sg-item')) { closeBox(); return; }
    const item = e.target.closest('[data-q]');
    if (!item) return;
    e.preventDefault();
    input.value = item.dataset.q;
    closeBox();
    goSearch(item.dataset.q);
  });
  // ایمنی: با هر تغییر مسیر، جعبهٔ پیشنهادها بسته شود
  window.addEventListener('hashchange', closeBox);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    closeBox();
    goSearch(q);
  });

  input.addEventListener('keydown', (e) => {
    const items = [...box.querySelectorAll('.sg-item, a.sg-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((n, i) => n.classList.toggle('active', i === activeIdx));
      items[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
      e.preventDefault();
      const it = items[activeIdx];
      if (it.dataset.q) { input.value = it.dataset.q; goSearch(it.dataset.q); }
      else if (it.getAttribute('href')) location.hash = it.getAttribute('href');
      closeBox();
    } else if (e.key === 'Escape') closeBox();
  });

  // جست‌وجوی صوتی
  qs('#btnVoiceSearch')?.addEventListener('click', () => startVoice(input, goSearch));
  // جست‌وجوی تصویری
  qs('#btnImageSearch')?.addEventListener('click', () => {
    if (!feat('imageSearch')) { toast(t('err.notFound')); return; }
    navigate('#/search/image');
  });
}

function goSearch(q) {
  const s = String(q || '').trim();
  if (!s) return;
  addSearch(s);
  navigate(`/products?q=${encodeURIComponent(s)}`);
}

async function startVoice(input, go) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toastError(t('search.noVoice')); return; }
  // اول اجازهٔ میکروفن را صریح بگیریم تا خطای مبهم «پشتیبانی نمی‌شود» نبینیم
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
    }
  } catch {
    toastError(t('search.micDenied'));
    return;
  }
  const rec = new SR();
  rec.lang = lang() === 'fa' ? 'fa-IR' : 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const btn = qs('#btnVoiceSearch');
  btn.classList.add('active');
  // تاست «در حال گوش دادن» را نگه می‌داریم تا به‌محض خطا/پایان، بسته شود
  // (باگ قبلی: تاست گوش‌دادن و تاست خطا هم‌زمان روی هم می‌ماندند)
  const listening = toast(t('search.listening'), { timeout: 2600 });
  rec.onresult = (e) => {
    listening?.close();
    const text = e.results?.[0]?.[0]?.transcript || '';
    if (text) { input.value = text; go(text); }
    else toast(t('search.noSpeech'));
  };
  rec.onerror = (e) => {
    listening?.close();
    const map = {
      'not-allowed': 'search.micDenied',
      'service-not-allowed': 'search.micDenied',
      network: 'search.voiceNetwork',
      'no-speech': 'search.noSpeech',
      aborted: null,
      'audio-capture': 'search.noMic',
    };
    const key = map[e.error];
    if (key) toastError(t(key));
    else if (e.error !== 'aborted') toastError(t('search.noSpeech'));
  };
  rec.onend = () => { btn.classList.remove('active'); listening?.close(); };
  try { rec.start(); } catch { btn.classList.remove('active'); }
}

// ── پالت فرمان (Ctrl+K) ─────────────────────────────────────
function wirePalette() {
  let palEl = null;
  let onKey = null; // هندلر کلیدهای پالت (بدون اعلان، در حالت strict ماژول ReferenceError می‌داد)
  const close = () => { palEl?.remove(); palEl = null; if (onKey) document.removeEventListener('keydown', onKey, true); onKey = null; };
  const open = async () => {
    if (palEl) { close(); return; }
    palEl = el('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('common.search') });
    palEl.innerHTML = h`
      <div class="cmdk-box">
        <input class="cmdk-input" placeholder="${t('common.searchProducts')}" data-ci autocomplete="off">
        <div class="cmdk-list" data-cl></div>
        <div class="cmdk-foot"><span><kbd>↑↓</kbd> ${t('common.select')}</span><span><kbd>Enter</kbd> ${t('common.next')}</span><span><kbd>Esc</kbd> ${t('common.close')}</span></div>
      </div>`;
    document.body.appendChild(palEl);
    const input = palEl.querySelector('[data-ci]');
    const list = palEl.querySelector('[data-cl]');
    input.focus();

    const baseItems = () => [
      { icon: 'home', label: t('nav.home'), href: '#/' },
      { icon: 'grid', label: t('nav.products'), href: '#/products' },
      { icon: 'percent', label: t('nav.deals'), href: '#/products?discount=1' },
      { icon: 'cart', label: t('cart.title'), href: '#/cart' },
      ...(S.me ? [
        { icon: 'user', label: t('acc.dashboard'), href: '#/account' },
        { icon: 'package-check', label: t('acc.orders'), href: '#/account/orders' },
        ...(feat('wallet') ? [{ icon: 'wallet', label: t('acc.wallet'), href: '#/account/wallet' }] : []),
      ] : [{ icon: 'user', label: t('nav.login'), href: '#/auth' }]),
      ...(S.me?.isAdmin ? [{ icon: 'settings', label: t('adm.title'), href: '#/admin' }] : []),
      { icon: 'moon', label: t('theme.toggle'), run: () => qs('#btnTheme').click() },
      { icon: 'globe', label: 'English / فارسی', run: () => qs('#btnLang').click() },
      { icon: 'chart', label: t('nav.stats'), href: '#/stats' },
      { icon: 'map', label: t('nav.contact'), href: '#/pages/contact' },
    ];

    const renderList = async (q) => {
      let items = baseItems().filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase()));
      if (q) {
        try {
          const r = await api.get(`/api/search?q=${encodeURIComponent(q)}&limit=6`);
          items = [...items, ...r.products.map((p) => ({ icon: p.glyph || 'box', label: prodName(p), meta: fmtNum(p.price), href: `#/product/${p.id}` }))];
        } catch { /* noop */ }
      }
      list.innerHTML = items.length
        ? items.map((i, idx) => h`<div class="cmdk-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">${icon(i.icon)}<span class="grow">${i.label}</span>${i.meta ? h`<span class="muted tiny">${i.meta}</span>` : ''}</div>`)
        : h`<div class="cmdk-item muted">${t('common.noResult')}</div>`;
      list._items = items;
    };
    await renderList('');
    input.addEventListener('input', debounce(() => renderList(input.value.trim()), 200));

    const pick = (idx) => {
      const it = list._items?.[idx];
      if (!it) return;
      close();
      if (it.run) it.run();
      else if (it.href) location.hash = it.href;
    };
    list.addEventListener('click', (e) => {
      const it = e.target.closest('[data-idx]');
      if (it) pick(Number(it.dataset.idx));
    });
    let idx = 0;
    onKey = (e) => {
      const items = list.querySelectorAll('.cmdk-item[data-idx]');
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
        items.forEach((n, i) => n.classList.toggle('active', i === idx));
        items[idx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); pick(idx); }
    };
    document.addEventListener('keydown', onKey, true);
    palEl.addEventListener('click', (e) => { if (e.target === palEl) close(); });
  };
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); open(); }
  });
}

// ── رویدادهای سراسری ────────────────────────────────────────
function subscribeEvents() {
  on('cart', updateBadges);
  on('wishlist', () => { updateBadges(); renderUserArea(); });
  on('compare', () => { updateBadges(); });
  on('notifications', updateBadges);
  on('me', () => { renderUserArea(); updateBadges(); });
  on('settings', () => { applyPrefs(); renderChrome(); applyI18n(); syncSleep(); });
  document.addEventListener('view:rendered', () => syncSleep());
  document.addEventListener('sleep:changed', () => { syncSleep(); renderChrome(); });
  on('install', () => { const b = qs('#btnInstallApp'); if (b) b.hidden = false; });
  on('installed', () => { const b = qs('#btnInstallApp'); if (b) b.hidden = true; toastSuccess(t('home.appInstalled')); });
  on('online', (up) => { if (up) toastSuccess(t('err.online')); else toastWarnOffline(); });
}
// ── ضربان قلب: هم وضعیت خاموش/روشن را تازه می‌کند، هم سرویس را گرم نگه می‌دارد
function wireSleepHeartbeat() {
  const tick = async () => {
    if (document.documentElement.classList.contains('eco')) return; // حالت eco: بدون ترافیک
    try {
      const r = await api.get('/api/system/status');
      const was = !!S.sleeping;
      S.sleeping = !!r.sleeping;
      S.sleepSince = r.since || null;
      if (was !== S.sleeping) {
        syncSleep();
        renderChrome();
        if (String(location.hash || '').startsWith('#/admin')) refresh(true);
      }
    } catch { /* آفلاین یا سرور در حال ریستارت */ }
  };
  setInterval(tick, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

// ── پردهٔ «فروشگاه خاموش است» ───────────────────────────────
function syncSleep() {
  const adminArea = String(location.hash || '').startsWith('#/admin');
  const canWake = can('settings.edit');
  // مدیر داخل پنل پرده را نمی‌بیند تا بتواند فروشگاه را روشن کند
  updateSleepScreen({
    sleeping: !!S.sleeping && !(adminArea && canWake),
    canWake,
    since: S.sleepSince,
    onWake: async () => {
      try {
        await api.post('/api/system/wake', {});
        await refreshBootstrap({ silent: true });
        syncSleep();
        renderChrome();
        toastSuccess(t('sys.awake'));
        refresh(true);
      } catch (err) { toastApiError(err); }
    },
    onLogin: () => navigate('#/auth?next=' + encodeURIComponent(location.hash.slice(1))),
  });
}

let offlineToasted = false;
function toastWarnOffline() {
  if (offlineToasted) return;
  offlineToasted = true;
  toastError(t('err.offline'), { timeout: 4200 });
}
function wireNetworkToasts() {
  window.addEventListener('online', () => { offlineToasted = false; });
}

let gentleScrollCleanup = null;
let gentleScrollRaf = 0;
let gentleScrollDirection = null;
const GENTLE_SCROLL_SPEED = 480;
const GENTLE_SCROLL_TOUCH_GRACE = 450;

function cancelGentleScroll() {
  const cleanup = gentleScrollCleanup;
  gentleScrollCleanup = null;
  if (cleanup) cleanup();
  if (gentleScrollRaf) {
    cancelAnimationFrame(gentleScrollRaf);
    gentleScrollRaf = 0;
  }
  gentleScrollDirection = null;
  // Setting the current position with auto cancels a native smooth scroll too.
  window.scrollTo({ top: window.scrollY || 0, left: window.scrollX || 0, behavior: 'auto' });
}

function scrollDownGently() {
  // This also cancels a native scroll-up animation before starting the down scroll.
  cancelGentleScroll();
  const max = () => Math.max(
    0,
    Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0) - (window.innerHeight || 0),
  );
  const current = window.scrollY || 0;
  if (current >= max() - 1) return;

  gentleScrollDirection = 'down';
  const startedAt = performance.now();
  let last = startedAt;

  const stopOnWheel = (event) => {
    if (Math.abs(Number(event.deltaY) || 0) > 3 || Math.abs(Number(event.deltaX) || 0) > 3) cancelGentleScroll();
  };
  const stopOnTouch = (event) => {
    // Mobile browsers often synthesize a touchstart/click immediately after the FAB tap.
    // Ignore that short emulation window, but stop for a real touch anywhere else.
    if (performance.now() - startedAt < GENTLE_SCROLL_TOUCH_GRACE) return;
    if (!event.target?.closest?.('#fabBottom, #fabTop')) cancelGentleScroll();
  };
  const isNavigationKey = (event) => ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key);
  const stopOnKey = (event) => { if (isNavigationKey(event)) cancelGentleScroll(); };

  const cleanup = () => {
    window.removeEventListener('wheel', stopOnWheel);
    window.removeEventListener('touchstart', stopOnTouch, true);
    window.removeEventListener('keydown', stopOnKey, true);
  };
  gentleScrollCleanup = cleanup;
  window.addEventListener('wheel', stopOnWheel, { passive: true });
  window.addEventListener('touchstart', stopOnTouch, { passive: true, capture: true });
  window.addEventListener('keydown', stopOnKey, true);

  const frame = (now) => {
    if (gentleScrollDirection !== 'down') return;
    const limit = max();
    const y = window.scrollY || 0;
    const elapsed = Math.min(100, Math.max(0, now - last));
    last = now;
    const next = Math.min(limit, y + GENTLE_SCROLL_SPEED * (elapsed / 1000));
    window.scrollTo({ top: next, left: window.scrollX || 0, behavior: 'auto' });
    if (next >= limit - 1 || limit <= y) {
      cancelGentleScroll();
      return;
    }
    gentleScrollRaf = requestAnimationFrame(frame);
  };
  gentleScrollRaf = requestAnimationFrame(frame);
}

function wireScroll() {
  const header = qs('#siteHeader');
  const fabTop = qs('#fabTop');
  const fabBottom = qs('#fabBottom');
  let ticking = false;
  let lastY = window.scrollY || 0;
  const update = () => {
    const y = window.scrollY || 0;
    const viewport = window.innerHeight || 0;
    const documentHeight = Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0);
    const hasRoomBelow = documentHeight - viewport - y > 2;
    if (header) {
      header.classList.toggle('scrolled', y > 8);
      // سربرک هوشمند: با اسکرول به پایین پنهان می‌شود و با کشیدن صفحه به سمت بالا
      // مانند یک پنجرهٔ شناور برمی‌گردد تا دسترسی به منو و سبد خرید سریع بماند.
      const modalOpen = document.body?.classList.contains('locked') || !!document.querySelector('.overlay:not([hidden]),.drawer,.sheet');
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (y <= 160 || modalOpen) {
        // بالای صفحه یا هنگام باز بودن مودال‌ها: سربرگ در جای عادی خود می‌ماند
        header.classList.remove('header-hidden', 'header-pinned');
      } else if (goingDown) {
        header.classList.add('header-hidden');
        header.classList.remove('header-pinned');
      } else if (goingUp) {
        header.classList.remove('header-hidden');
        header.classList.add('header-pinned');
      }
    }
    lastY = y;
    if (fabTop) fabTop.hidden = y < 420;
    if (fabBottom) fabBottom.hidden = !hasRoomBelow;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
}

// ── توافق‌نامهٔ اولین بازدید ────────────────────────────────
let isConsentOpen = false;
function openConsent() {
  if (isConsentOpen) return;
  isConsentOpen = true;
  if (!feat('consent')) return;
  // اگر کاربر برای خواندن قوانین/حریم خصوصی از مودال خارج شده، در همین نشست دیگر مزاحمش نمی‌شویم
  if (sessionStorage.getItem('consentDeferred')) {
    if (!location.hash.startsWith('#/pages/')) {
      sessionStorage.removeItem('consentDeferred');
    } else return;
  }
  modal({
    title: t('consent.title'),
    dismissible: false,
    closeBtn: false,
    size: 'md',
    body: h`
      <p class="confirm-text mb">${t('consent.text')}</p>
      <p class="hint mt-s">${icon('info')} ${t('consent.ttlNote')}</p>
      <form data-act="consent-form" class="col">
        <label class="check"><input type="checkbox" name="terms" checked><span class="box">${icon('check')}</span><span>${t('consent.terms')} <a class="section-link" href="#/pages/terms">${t('consent.readTerms')}</a></span></label>
        <label class="check"><input type="checkbox" name="privacy" checked><span class="box">${icon('check')}</span><span>${t('consent.privacy')} <a class="section-link" href="#/pages/privacy">${t('consent.readPrivacy')}</a></span></label>
        <label class="check"><input type="checkbox" name="marketing"><span class="box">${icon('check')}</span><span>${t('consent.marketing')}</span></label>
      </form>`,
    footer: h`<button type="button" class="btn btn-ghost" data-consent-min>${t('consent.rejectOptional')}</button><button type="button" class="btn btn-primary" data-consent-go>${t('consent.accept')}</button>`,
    onClose: () => { isConsentOpen = false; },
    onMount: (panel, handle) => {
      const form = panel.querySelector('[data-act="consent-form"]');
      // باگ‌گیری راند جاری: کلیک روی لینک داخلی مودال رضایت، قبلاً مودال را روی صفحه نگه می‌داشت
      panel.querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener('click', () => {
        sessionStorage.setItem('consentDeferred', '1');
        handle.close();
      }));
      const go = () => {
        const terms = form.querySelector('[name=terms]').checked;
        const privacy = form.querySelector('[name=privacy]').checked;
        const marketing = form.querySelector('[name=marketing]').checked;
        if (!terms || !privacy) { toastError(t('form.termsRequired')); return; }
        setConsent({ terms, privacy, marketing });
        if (S.me) api.patch('/api/me', { notificationsPrefs: { marketing } }).catch(() => {});
        toastSuccess(t('consent.thanks'));
        handle.close();
      };
      panel.closest('[role="dialog"]').querySelector('[data-consent-go]').addEventListener('click', go);
      panel.closest('[role="dialog"]').querySelector('[data-consent-min]').addEventListener('click', () => {
        setConsent({ terms: true, privacy: true, marketing: false });
        if (S.me) api.patch('/api/me', { notificationsPrefs: { marketing: false } }).catch(() => {});
        toastSuccess(t('consent.thanks'));
        handle.close();
      });
      form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    },
  });
}
act('consent-form', () => {}); // فرم توسط onMount مدیریت می‌شود
act('consent-manage', () => openConsent());
export function maybeConsent() { if (hasConsent()) return; openConsent(); }
act('reload', () => location.reload());

// ── رفع خطای سایت: حذف کش + سرویس‌ورکر و بارگذاری مجدد (با دیالوگ اختصاصی) ──
act('sys-cache-repair', async () => {
  const yes = await confirmDialog({
    title: t('sys.cacheRepairTitle'),
    text: t('sys.cacheRepairText'),
    okText: t('sys.cacheRepairOk'),
    danger: true,
    icon: 'alert',
  });
  if (!yes) return;
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations()
      .then((r) => { for (let i = 0; i < r.length; i++) r[i].unregister(); window.location.reload(true); })
      .catch(() => window.location.reload(true));
  } else {
    window.location.reload(true);
  }
});

// ── اجبار به تغییر رمز پیش‌فرض ──────────────────────────────
let forceHandle = null;
function maybeForcePasswordChange() {
  if (!S.me?.mustChangePassword) return;
  try { if (sessionStorage.getItem('ys_pwd_later')) return; } catch { /* private mode */ }
  forceHandle = modal({
    title: t('acc.passwordChange'),
    dismissible: false,
    closeBtn: false,
    size: 'sm',
    body: h`
      <form data-act="force-pass">
        <p class="notice notice-warn mb">${icon('alert')}<span>${lang() === 'fa' ? 'برای امنیت بیشتر، رمز پیش‌فرض را تغییر بده.' : 'For security, change the default password.'}</span></p>
        <label class="field"><span class="label">${t('acc.currentPassword')}</span><input class="input" type="password" name="current" autocomplete="current-password" required></label>
        <label class="field"><span class="label">${t('acc.newPassword2')}</span><input class="input" type="password" name="next" autocomplete="new-password" required><span class="hint">${t('auth.passwordRules')}</span></label>
        <label class="field"><span class="label">${t('common.passwordConfirm')}</span><input class="input" type="password" name="confirm" autocomplete="new-password" required></label>
        <button class="btn btn-primary btn-block" type="submit">${t('common.save')}</button>
        <button class="btn btn-ghost btn-block mt-s" type="button" data-act="pwd-later">${t('auth.pwdLater')}</button>
      </form>`,
  });
}
act('pwd-later', () => {
  try { sessionStorage.setItem('ys_pwd_later', '1'); } catch { /* private mode */ }
  forceHandle?.close();
  toast(t('auth.pwdLaterToast'));
});
act('force-pass', async (e, form) => {
  const d = new FormData(form);
  if (d.get('next') !== d.get('confirm')) { toastError(lang() === 'fa' ? 'تکرار رمز یکسان نیست.' : 'Passwords do not match.'); return; }
  try {
    await api.post('/api/me/password', { current: d.get('current'), next: d.get('next') });
    await refreshMe();
    renderUserArea();
    toastSuccess(t('acc.passwordChanged'));
    forceHandle?.close();
  } catch (err) {
    toastError(err.message);
  }
});

// ── بازدید و سرویس‌ورکر ─────────────────────────────────────
function recordVisit() {
  const key = 'ys_visit';
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { return; }
  api.post('/api/visits', { path: location.hash || '/' }).catch(() => {});
}

function maybeCouponFromUrl() {
  const m = String(location.href).match(/[?&]coupon=([A-Za-z0-9_-]{2,32})/);
  if (!m) return;
  const code = m[1];
  try { history.replaceState(null, '', String(location.href).replace(/[?&]coupon=[A-Za-z0-9_-]{2,32}/, '').replace(/\?$/, '')); } catch { /* noop */ }
  setTimeout(async () => {
    try {
      await api.post('/api/cart/coupon', { code });
      await loadCart();
      toastSuccess(`${t('cart.couponApplied')}: ${code}`);
    } catch { /* کوپن نامعتبر بود — بی‌سروصدا رد می‌شویم */ }
  }, 700);
}

function wireSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    const tag = String(e.target?.tagName || '').toLowerCase();
    const typing = ['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable;
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const si = qs('#searchInput');
      if (si) { e.preventDefault(); si.focus(); si.select?.(); }
    }
    if (e.key === 'Escape' && document.activeElement === qs('#searchInput')) {
      const si = qs('#searchInput'); si.value = ''; si.blur(); qs('#suggestBox') && (qs('#suggestBox').hidden = true);
    }
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (settings().features?.offlineMode === false) return;
  // updateViaCache:'none' → مرورگر هرگز sw.js را از کش HTTP نمی‌خواند
  // + بررسی به‌روزرسانی هر ساعت و هر بار برگشت به تب
  const doReg = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      setInterval(() => { reg.update().catch(() => {}); }, 3600000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      let initialInstall = !navigator.serviceWorker.controller;
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (initialInstall) {
                initialInstall = false;
                return;
              }
              if (navigator.serviceWorker.controller) {
                toast(isFa() ? 'برای اعمال تغییرات روی دکمه زیر کلیک کنید.' : 'Click update to apply changes.', {
                type: 'info',
                title: isFa() ? 'نسخهٔ جدید آماده است' : 'Update Available',
                timeout: 15000,
                action: { label: isFa() ? 'بروزرسانی' : 'Update', onClick: () => { document.getElementById('btnRefresh')?.click(); } }
                });
              }
            }
          });
        }
      });
    } catch { /* محیط بدون SW */ }
  };
  // init پس از رویداد load اجرا می‌شود؛ پس اگر load گذشته، همین حالا ثبت کن
  if (document.readyState === 'complete') doReg();
  else window.addEventListener('load', doReg, { once: true });
}

// ── شروع ────────────────────────────────────────────────────
on('boot-slow', () => document.body.classList.add('boot-slow'));
on('boot-failed', () => {
  // ولکام‌اسکرین را بردار تا پیام خطا و دکمهٔ تلاش مجدد دیده شود
  const ws = document.getElementById('welcomeScreen'); if(ws && ws.parentNode) ws.parentNode.removeChild(ws);;
  const sp = qs('#bootSplash');
  if (!sp) return;
  sp.innerHTML = h`<div class="empty">
    <h4>${t('boot.failed')}</h4>
    <p class="muted small mt-s">${t('boot.failedHint')}</p>
    <button class="btn btn-primary mt" data-act="reload">${icon('refresh')} ${t('common.retry')}</button>
  </div>`;
});
init().catch((e) => {
  console.error('[boot]', e);
  const ws = document.getElementById('welcomeScreen'); if(ws && ws.parentNode) ws.parentNode.removeChild(ws);;
  const splash = qs('#bootSplash');
  if (splash) splash.innerHTML = h`<div class="empty"><h4>${t('err.generic')}</h4><button class="btn btn-primary" data-act="reload">${t('common.retry')}</button></div>`;
});

// ── نگهبان تازگی نسخه ───────────────────────────────────────
// اگر کلاینت (کش/SW قدیمی) با نسخهٔ سرور یکی نبود، تاست «تازه‌سازی» نشان بده
// تا کاربر هرگز سایت کهنگرفته را نبیند (درمان کش‌های قدیمی موبایل).
function watchBuild() {
  fetch('/api/system/status', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j?.build && j.build !== BUILD && !sessionStorage.getItem('bm-upd-seen')) {
        sessionStorage.setItem('bm-upd-seen', '1');
        toast(t('update.available'), {
          timeout: 0,
          action: { label: t('update.reload'), onClick: () => location.reload() },
        });
      }
    })
    .catch(() => { /* آفلاین — بی‌سروصدا */ });
}
setTimeout(watchBuild, 6000);

// ── هالهٔ موس ──────────────────────────────────────────────
function wireCursorHalo() {
  if (!matchMedia('(pointer:fine)').matches) return;
  const halo = qs('#cursorHalo');
  if (!halo) return;
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, raf = 0;
  const tick = () => {
    cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
    halo.style.left = `${cx.toFixed(1)}px`; halo.style.top = `${cy.toFixed(1)}px`;
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener('pointermove', (e) => {
    if (document.documentElement.classList.contains('eco')) return;
    x = e.clientX; y = e.clientY;
    document.documentElement.classList.add('halo-on');
    if (!raf) raf = requestAnimationFrame(tick);
    const hot = e.target.closest?.('a, button, [role="button"], .pcard, .gal-thumb');
    document.documentElement.classList.toggle('halo-hot', !!hot);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { document.documentElement.classList.remove('halo-on'); });
}

// ── حالت eco برای کاربر بی‌فعال: توقف پولینگ و انیمیشن بدون از دست دادن صفحه ──
const ECO_IDLE_MS = 4 * 60 * 1000;
let ecoTimer = 0;
export function ecoPaused() { return document.documentElement.classList.contains('eco'); }
function wireEcoMode() {
  const enter = () => {
    if (document.documentElement.classList.contains('eco')) return;
    document.documentElement.classList.add('eco');
    document.dispatchEvent(new CustomEvent('eco', { detail: { on: true } }));
  };
  const leave = () => {
    if (!document.documentElement.classList.contains('eco')) return;
    document.documentElement.classList.remove('eco');
    document.dispatchEvent(new CustomEvent('eco', { detail: { on: false } }));
    // تازه‌سازی بی‌صدا: همان صفحه می‌ماند، فقط داده‌ها به‌روز می‌شوند
    import('./state.mjs').then((sm) => sm.refreshBootstrap?.({ silent: true })).catch(() => {});
  };
  const arm = () => { clearTimeout(ecoTimer); ecoTimer = setTimeout(enter, ECO_IDLE_MS); };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove']) document.addEventListener(ev, () => { if (document.documentElement.classList.contains('eco')) leave(); arm(); }, { passive: true, capture: true });
  arm();
}

// ── بیکن بازدیدکننده: یک‌بار در هر نشست ──
function sendVisitBeacon() {
  try {
    if (sessionStorage.getItem('ys_vis')) {
      // فقط به‌روزرسانی مسیر در ناوبری‌ها
      return;
    }
    sessionStorage.setItem('ys_vis', '1');
    const payload = {
      screen: `${screen.width}x${screen.height}`,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      lang: navigator.language || '',
      ref: document.referrer ? document.referrer.slice(0, 200) : '',
      path: location.hash.replace('#', '') || '/',
    };
    import('./lib/api.mjs').then((a) => a.api.post('/api/track', payload)).catch(() => {});
  } catch { /* noop */ }
}
