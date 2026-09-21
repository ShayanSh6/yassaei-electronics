// ─────────────────────────────────────────────────────────────
//  رجیستری اکشن‌های واگذارشده (event delegation)
// ─────────────────────────────────────────────────────────────
import { S, addToCart, toggleWishlist, toggleCompare, toggleAlert, hasAlert, feat, setPref, MAX_COMPARE_ITEMS } from './state.mjs';
import { t, lang, isFa } from './i18n.mjs';
import { toast, toastSuccess, toastError, toastApiError, modal, lightbox, confirmDialog, withBusy, uiClickSound } from './ui.mjs';
import { api } from './lib/api.mjs';
import { html as h, icon, esc, fmtMoney, fmtNum, stars } from './lib/dom.mjs';
import { prodName } from './state.mjs';
import { navigate, refresh } from './router.mjs';
import { field } from './components.mjs';

const registry = new Map();
export function act(name, fn) { registry.set(name, fn); return fn; }
export function getAct(name) { return registry.get(name); }
export const hasAct = (name) => registry.has(name);

// ── اکشن‌های مشترک ──────────────────────────────────────────
act('add-cart', async (e, el) => {
  const id = el.dataset.id;
  const qty = Number(el.dataset.qty || 1) || 1;
  await withBusy(el, async () => {
    try {
      await addToCart(id, qty);
      toastSuccess(t('card.added'), { timeout: 2600 });
    } catch (err) {
      toastApiError(err);
    }
  });
});

function syncWishlistButtons(productId, isAdded) {
  const id = String(productId);
  const label = isAdded ? t('card.wishlistRemove') : t('card.wishlistAdd');
  // A product can appear in a card, a quick view and the PDP at the same time.
  // Keep every copy in sync without forcing a route refresh.
  document.querySelectorAll('[data-act="wish-toggle"]').forEach((button) => {
    if (button.dataset.id !== id) return;
    button.classList.toggle('btn-wish-active', isAdded);
    button.classList.toggle('is-wishlisted', isAdded);
    button.classList.toggle('active', isAdded);
    button.classList.toggle('btn-danger', isAdded);
    button.setAttribute('aria-pressed', String(isAdded));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = button.classList.contains('pc-qbtn') ? icon('heart') : h`${icon('heart')} ${label}`;
  });
}

act('wish-toggle', async (e, el) => {
  if (!S.me) { navigate('#/auth?next=' + encodeURIComponent(location.hash.slice(1))); return; }
  try {
    const r = await toggleWishlist(el.dataset.id);
    const isAdded = r.added !== undefined ? !!r.added : !!r.in;
    syncWishlistButtons(el.dataset.id, isAdded);
    toast(isAdded ? t('card.wishlistAdd') : t('card.wishlistRemove'), { timeout: 2000 });
    if (location.hash.includes('wishlist')) {
      refresh(true);
    }
  } catch (err) { toastApiError(err); }
});

act('compare-toggle', async (e, el) => {
  try {
    const id = el.dataset.id;
    if (!id) return;
    const r = await toggleCompare(id);
    if (r.in === false) {
      toast(t('compare.remove'), { timeout: 1800 });
      if (location.hash.startsWith('#/compare')) {
        const { refresh } = await import('./router.mjs');
        refresh();
      }
    } else {
      toastSuccess(t('compare.add'), { timeout: 1800 });
      navigate('#/compare');
    }
  } catch (err) { toastApiError(err); }
});

act('cmp-add', async (e, el) => {
  try {
    const id = el.dataset.id;
    if (!id) return;
    if (S.compare.length >= MAX_COMPARE_ITEMS && !S.compare.includes(id)) {
      toastError('حداکثر ۵ محصول را می‌توانی هم‌زمان مقایسه کنی.');
      return;
    }
    const r = await toggleCompare(id);
    if (r.in) toastSuccess(t('compare.add'), { timeout: 1800 });
    const { refresh } = await import('./router.mjs');
    refresh();
  } catch (err) { toastApiError(err); }
});

act('cmp-clear', async () => {
  try {
    const { writeLS, LS, emit } = await import('./state.mjs');
    S.compare = [];
    writeLS(LS.cmp, []);
    emit('compare', []);
    if (S.me) {
      try {
        const { api } = await import('./lib/api.mjs');
        await api.delete('/api/me/compare');
      } catch { /* noop */ }
    }
    toast('لیست مقایسه پاک شد.');
    const { refresh } = await import('./router.mjs');
    refresh();
  } catch (err) { toastApiError(err); }
});

act('notify-me', async (e, el) => {
  if (!S.me) { navigate('#/auth?next=' + encodeURIComponent(location.hash.slice(1))); return; }
  try {
    const r = await toggleAlert(el.dataset.id);
    toastSuccess(r.on ? t('common.notified') : t('common.notifyMe'), { timeout: 2400 });
    document.querySelectorAll(`[data-act="notify-me"][data-id="${el.dataset.id}"]`).forEach((n) => {
      n.classList.toggle('active', r.on);
    });
  } catch (err) { toastApiError(err); }
});

act('lightbox', (e, el) => {
  let imgs = [];
  try { imgs = JSON.parse(el.dataset.imgs || '[]'); } catch { imgs = [el.dataset.imgs || '']; }
  lightbox(imgs, Number(el.dataset.i || 0), el.dataset.alt || '');
});

act('sound-toggle', () => {
  const on = !S.prefs?.uiSound;
  setPref('uiSound', on);
  const btn = document.querySelector('[data-act="sound-toggle"]');
  if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.innerHTML = h`${icon(on ? 'volume' : 'volume-off')} ${t('misc.uiSound')} <span class="um-sw ${on ? 'on' : ''}" aria-hidden="true"></span>`; }
  toast(on ? t('misc.uiSoundOn') : t('misc.uiSoundOff'), { timeout: 1600 });
  if (on) uiClickSound(true);
});

act('copy', async (e, el) => {
  const { copyText } = await import('./lib/dom.mjs');
  try { await copyText(el.dataset.text || el.textContent.trim()); toastSuccess(t('common.copied'), { timeout: 1800 }); }
  catch { toastError(t('err.generic')); }
});

act('share', async (e, el) => {
  const url = el.dataset.url || location.href;
  const title = el.dataset.title || document.title;
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch { return; }
  }
  const { copyText } = await import('./lib/dom.mjs');
  try { await copyText(url); toastSuccess(t('misc.shareDone'), { timeout: 2000 }); }
  catch { toastError(t('err.generic')); }
});

act('quick-view', async (e, el) => {
  const id = el.dataset.id;
  try {
    const r = await api.get(`/api/products/${encodeURIComponent(id)}`);
    const p = r.product;
    modal({
      title: prodName(p),
      size: 'md',
      body: h`
        <div class="row">
          <div class="qv-media">${p.images?.[0] ? h`<img src="${p.images[0]}" alt="${prodName(p)}" class="qv-img" data-glyph="${p.glyph || 'misc'}">` : icon(p.glyph || 'box')}</div>
          <div class="grow">
            ${p.brandName ? h`<div class="pc-brand">${p.brandName}</div>` : ''}
            <div class="pc-rate mb-s">${stars(p.ratingAvg)} <span class="muted tiny">${fmtNum(p.ratingAvg)} · ${fmtNum(p.ratingCount)} ${t('common.reviews')}</span></div>
            <div class="buy-price">
              ${p.oldPrice > p.price ? h`<span class="pc-old">${fmtMoney(p.oldPrice)}</span>` : ''}
              <span class="buy-now">${fmtMoney(p.price)}</span>
            </div>
            <div class="pc-stock ${p.stock <= 0 ? 'out' : p.stock <= 3 ? 'low' : ''}"><span class="dot"></span>${p.stock <= 0 ? t('card.outOfStock') : t('pdp.stockCount', { n: fmtNum(p.stock) })}</div>
          </div>
        </div>
        ${p.description ? h`<p class="muted small mt-s">${esc(p.description).slice(0, 220)}…</p>` : ''}
        <div class="row mt">
          <a class="btn btn-ghost" href="#/product/${p.id}">${t('common.details')} ${icon('chevron-left')}</a>
        </div>`,
      footer: h`
        <button type="button" class="btn btn-ghost" data-close>${t('common.close')}</button>
        <button type="button" class="btn btn-primary" data-add ${p.stock <= 0 ? 'disabled' : ''}>${icon('cart')} ${t('pdp.addToCart')}</button>`,
      onMount: (panel, handle) => {
        panel.querySelector('[data-close]').addEventListener('click', () => handle.close());
        panel.querySelector('[data-add]').addEventListener('click', async (ev) => {
          await withBusy(ev.currentTarget, async () => {
            try { await addToCart(p.id, 1); toastSuccess(t('card.added'), { timeout: 2200 }); handle.close(); }
            catch (err) { toastApiError(err); }
          });
        });
      },
    });
  } catch (err) { toastApiError(err); }
});

act('ui-retry', () => { import('./router.mjs').then((m) => m.refresh()); });

act('scroll-top', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// شمارندهٔ تعداد
act('qty-btn', (e, el) => {
  const wrap = el.closest('.qty');
  const input = wrap?.querySelector('input');
  if (!input) return;
  const d = Number(el.dataset.q || 0);
  const min = Number(input.min || 1);
  const max = Number(input.max || 99);
  const v = Math.max(min, Math.min(max, (Number(input.value) || min) + d));
  input.value = v;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

act('confirm-nav', async (e, el) => {
  const ok = await confirmDialog({ text: el.dataset.text || t('misc.confirmDelete'), danger: el.dataset.danger === '1', okText: el.dataset.ok || '' });
  if (ok && el.dataset.href) navigate(el.dataset.href);
});

// باز کردن آکاردئون‌ها با کلیک روی سربرگ (واگذارشده)
act('acc', (e, el) => {
  const item = el.closest('.acc-item');
  if (!item) return;
  const open = item.classList.toggle('open');
  const body = item.querySelector('.acc-b');
  if (body) body.hidden = !open;
  el.setAttribute('aria-expanded', String(open));
});

act('print-page', () => { window.print(); });

// ── کپچا «من ربات نیستم» ────────────────────────────────────
export async function showCaptchaChallenge() {
  const { modal } = await import('./ui.mjs');
  const { icon } = await import('./lib/dom.mjs');
  const { api } = await import('./lib/api.mjs');
  
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'captcha-box';
    box.dataset.captcha = 'true';
    box.innerHTML = `
      <div class="c-wrap">
        <label class="c-check"><input type="checkbox" name="captchaBox"> <span>من ربات نیستم</span></label>
        <div data-cch hidden>
          <div data-cimg class="c-svg"></div>
          <p data-cst class="small muted">کد تصویر را وارد کن</p>
          <div class="f-row">
            <input type="text" name="captchaAnswer" class="input f-1" inputmode="numeric" autocomplete="off" dir="ltr" maxlength="6">
            <button type="button" class="btn outline" data-act="captcha-refresh" aria-label="تغییر تصویر">${icon('refresh')}</button>
          </div>
          <input type="hidden" name="captchaToken" data-ctok>
          <button type="button" class="btn primary w-100" data-act="captcha-unban" style="margin-top:1rem">تأیید</button>
        </div>
      </div>`;
    
    let resolved = false;
    const m = modal({
      title: 'تأیید امنیتی',
      body: box,
      closeBtn: true,
      onClose: () => { if (!resolved) resolve(false); }
    });
    
    loadCaptcha(box);

    const btn = box.querySelector('[data-act="captcha-unban"]');
    const chk = box.querySelector('[name=captchaBox]');
    chk.addEventListener('change', () => {
       const ch = box.querySelector('[data-cch]');
       if (ch) ch.hidden = !chk.checked;
       if (chk.checked && !box.dataset.cid) loadCaptcha(box);
    });

    btn.addEventListener('click', async () => {
      const cid = box.dataset.cid;
      const ans = box.querySelector('[name=captchaAnswer]').value;
      if (!cid || !ans) return;
      btn.disabled = true;
      try {
        await api.post('/api/captcha/unban', { token: cid, answer: ans });
        resolved = true;
        m.close(true);
        resolve(true);
      } catch(e) {
        btn.disabled = false;
        loadCaptcha(box);
      }
    });
  });
}

export async function loadCaptcha(box) {
  if (!box) return;
  const ch = box.querySelector('[data-cch]');
  const img = box.querySelector('[data-cimg]');
  const tok = box.querySelector('[data-ctok]');
  const st = box.querySelector('[data-cst]');
  const ans = box.querySelector('[name=captchaAnswer]');
  if (tok) tok.value = '';
  if (ans) { ans.value = ''; ans.disabled = false; }
  const cb = box.querySelector('[name=captchaBox]');
  if (cb) cb.disabled = false;
  try {
    const r = await api.get('/api/captcha');
    if (r.disabled) { box.hidden = true; return; }
    box.hidden = false;
    box.dataset.cid = r.id;
    if (img) img.innerHTML = r.svg || '';
    if (st) st.textContent = t('captcha.hint');
    if (ch) ch.hidden = !cb?.checked;
  } catch { /* آفلاین یا خطا: جعبه همان‌طور بماند */ }
}
export function refreshCaptchaIn(form) {
  const box = form?.querySelector?.('[data-captcha]');
  if (box) { box.hidden = false; loadCaptcha(box); }
}
act('captcha-open', (e, input) => {
  const box = input.closest('[data-captcha]');
  const ch = box?.querySelector('[data-cch]');
  if (!ch) return;
  ch.hidden = !input.checked;
  if (input.checked && !box.dataset.cid) loadCaptcha(box);
});
act('captcha-refresh', (e, btn) => loadCaptcha(btn.closest('[data-captcha]')));


// ── اکشن خالی برای المان‌های بدون منطق ──────────────────────
act('noop', () => {});

// ── نصب واگذارشده‌ها ────────────────────────────────────────
import { adaptive } from './ui.mjs';

act('open-select', (e, btn) => {
  const name = btn.dataset.name;
  const title = btn.dataset.title || t('common.select');
  const val = btn.dataset.val;
  let opts = [];
  try { opts = JSON.parse(btn.dataset.opts || '[]'); } catch {}

  const s = adaptive({
    title,
    body: h`<div class="col" style="gap:4px; padding-bottom: 20px; max-height: 60vh; overflow-y: auto;">
      ${opts.map(o => h`<button class="btn" style="justify-content: flex-start; padding: 14px 16px; background: ${String(o.value) === String(val) ? 'var(--primary)' : 'var(--surface-2)'}; color: ${String(o.value) === String(val) ? '#fff' : 'inherit'}; border-radius: 12px; font-size: 15px;" data-v="${o.value}">${o.label}</button>`).join('')}
    </div>`
  });

  s.panel.querySelectorAll('button[data-v]').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.dataset.v;
      btn.dataset.val = v;
      const txtEl = btn.querySelector('.sb-txt');
      if (txtEl) txtEl.textContent = b.textContent;
      const hidden = btn.parentElement.querySelector(`input[name="${name}"]`);
      if (hidden) {
        hidden.value = v;
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
      s.close();
    });
  });
});

export function installDelegation() {
  let lastActionMs = 0;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.disabled || el.classList.contains('busy')) return;
    if (el.tagName === 'FORM') return;

    // تاخیر کوتاه سراسری برای جلوگیری از تداخل (دابل‌کلیک‌های ناخواسته)
    const now = Date.now();
    if (now - lastActionMs < 150) { e.preventDefault(); return; }
    lastActionMs = now; // فرم‌ها فقط با رویداد submit اجرا می‌شوند، نه کلیک روی فیلدها
    if (el.tagName === 'A') e.preventDefault();
    const name = el.dataset.act;
    const fn = registry.get(name);
    if (!fn) {
      console.warn('[actions] unknown:', name);
      return;
    }
    try {
      const r = fn(e, el);
      if (r && typeof r.catch === 'function') r.catch((err) => { console.error('[action]', name, err); if (err?.code) toastApiError(err); });
    } catch (err) { console.error('[action]', name, err); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.classList.contains('busy') || form.querySelector('button.busy')) { e.preventDefault(); return; }
    
    // تاخیر سراسری برای فرم‌ها
    const now = Date.now();
    if (now - lastActionMs < 300) { e.preventDefault(); return; }
    lastActionMs = now;

    const name = form?.dataset?.act;
    if (!name) return;
    e.preventDefault();
    const fn = registry.get(name);
    if (!fn) { console.warn('[actions] unknown submit:', name); return; }
    try {
      const r = fn(e, form);
      if (r && typeof r.catch === 'function') r.catch((err) => { console.error('[action]', name, err); if (err?.code) toastApiError(err); });
    } catch (err) { console.error('[action]', name, err); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    // دکمه‌های +/- شمارنده
    if (el.matches?.('.qty input')) return;
    // فرم‌های زنده (فیلترها): با تغییر هر فیلد، اکشن فرم اجرا می‌شود
    const liveForm = !el.dataset?.act ? el.closest?.('form[data-act][data-live]') : null;
    if (!el.dataset?.act && !liveForm) return;
    const target = el.dataset?.act ? el : liveForm;
    const fn = registry.get(target.dataset.act);
    if (!fn) return;
    try {
      const r = fn(e, target);
      if (r && typeof r.catch === 'function') r.catch((err) => console.error(err));
    } catch (err) { console.error(err); }
  });


  

  // کلیک روی دکمه‌های شمارنده
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.qty [data-q]');
    if (!b) return;
    e.preventDefault();
    const fn = registry.get('qty-btn');
    fn(e, b);
  });

  // تصویر شکست‌خورده → جای‌گزین گلیفی
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el?.tagName !== 'IMG' || el.dataset.fallbackDone) return;
    el.dataset.fallbackDone = '1';
    const glyph = el.dataset.glyph || 'misc';
    el.src = placeholderFor(glyph);
  }, true);
}

// ── تصویر جای‌گزین (دیتایوری SVG گلیفی) ─────────────────────
const GLYPH_PATH = {
  cable: 'M30 40h14v14H30zM37 54c0 18 12 20 20 14s20-4 22 8M62 66h16v12H62z',
  adapter: 'M34 34h32v34H34zM42 34V22M58 34V22M44 68h12v8H44z',
  shield: 'M34 22h32v56H34zM40 28h12v16H40z',
  layers: 'M36 26h28v48H36zM30 34l30-14 30 14',
  battery: 'M26 40h48v26H26zM32 46h8v14h-8zM44 46h8v14h-8z',
  plug: 'M24 42h34v16H24zM58 36h22v28H58z',
  speaker: 'M30 24h40v52H30zM50 54a10 10 0 1 0 0 .1M50 32a5 5 0 1 0 0 .1',
  headset: 'M28 56a22 22 0 0 1 44 0M24 52h10v20H24zM66 52h10v20H66z',
  watch: 'M38 34h24v32H38zM42 14h16v20H42zM42 66h16v20H42z',
  camera: 'M50 18a18 18 0 1 0 0 36 18 18 0 0 0 0-36zM50 54v34M50 88l-14-24M50 88l14-24',
  zap: 'M26 44h14l6-8h10l6 8h14a10 10 0 0 1 0 20H26a10 10 0 0 1 0-20',
  truck: 'M38 28h24v30H38zM44 58h12v10H44z',
  light: 'M30 26h18l6 12H24zM34 38h20v40H34z',
  mic: 'M42 18h16v28H42zM36 40a14 14 0 0 0 28 0M50 54v30M36 86h28',
  box: 'M26 36 50 24l24 12v28L50 76 26 64zM26 36l24 12 24-12M50 48v28',
  phone: 'M36 16h28v68H36zM44 74h12',
};
function placeholderFor(glyph) {
  const d = GLYPH_PATH[glyph] || GLYPH_PATH.box;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123a52"/><stop offset="1" stop-color="#0a2135"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><g fill="none" stroke="#7fd3ec" stroke-opacity=".8" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"><path d="${d}"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

act('pdp-lower-price', (e, el) => {
  const id = el.dataset.id;
  import('./ui.mjs').then(({ modal }) => {
    modal({
      title: 'گزارش قیمت مناسب‌تر',
      body: h`
        <form data-act="submit-lower-price" data-id="${id}">
          <p class="mb">اگر این کالا را در فروشگاه دیگری با قیمت پایین‌تر دیده‌اید، به ما اطلاع دهید:</p>
          <div class="form-grid mb">
            ${field({ label: 'قیمت فروشگاه دیگر (تومان)', name: 'price', type: 'number', required: true })}
            ${field({ label: 'آدرس فروشگاه (لینک سایت یا نام)', name: 'url', required: true })}
          </div>
          <div class="row row-wrap mt">
            <button type="submit" class="btn btn-primary">${icon('send')} ثبت</button>
            <button type="button" class="btn btn-ghost" data-lx>لغو</button>
          </div>
        </form>
      `
    });
  });
});

act('submit-lower-price', async (e, form) => {
  e.preventDefault();
  const { withBusy, toastSuccess, toastApiError } = await import('./ui.mjs');
  await withBusy(form, async () => {
    try {
      await api.post('/api/reports/lower-price', {
        productId: form.dataset.id,
        price: Number(form.price.value),
        url: form.url.value
      });
      toastSuccess('با تشکر! گزارش شما ثبت شد.');
      form.closest('[role="dialog"]')?.querySelector('[data-lx]')?.click();
    } catch (err) {
      toastApiError(err);
    }
  });
});

act('accept-consent-now', async (e, el) => {
  const { setConsent } = await import('./state.mjs');
  setConsent({ terms: true, privacy: true, marketing: false });
  toastSuccess(isFa() ? 'قوانین و مقررات با موفقیت پذیرفته شد.' : 'Terms accepted.');
  sessionStorage.removeItem('consentDeferred');
  const { maybeConsent } = await import('./main.mjs');
  maybeConsent(); // won't do anything since it's already set
  import('./router.mjs').then(m => m.refresh());
});
