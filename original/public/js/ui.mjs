// ─────────────────────────────────────────────────────────────
//  لایهٔ رابط کاربری: توست، مودال، کشو، تأیید، لایت‌باکس، اسکلت
// ─────────────────────────────────────────────────────────────
import { qs, el, esc, icon, raw, html as h } from './lib/dom.mjs';
import { t, lang } from './i18n.mjs';
import { errorMessage, ApiError } from './lib/api.mjs';

const modalRoot = () => qs('#modalRoot');
const drawerRoot = () => qs('#drawerRoot');
const toastRoot = () => qs('#toastRoot');

const SIZE_CLASS = { sm: 'narrow', md: '', lg: 'wide', xl: 'wide' };
const TYPE_CLASS = { success: 'success', error: 'error', warn: 'warning', warning: 'warning', info: 'info' };
const TYPE_ICON = { success: 'check-circle', error: 'alert', warn: 'alert', warning: 'alert', info: 'info' };

// ── توست ────────────────────────────────────────────────────
let toastSeq = 0;
export function toast(message, { type = 'info', title = '', timeout = 3800, action = null } = {}) {
  const root = toastRoot();
  if (!root) return null;
  const id = `t${++toastSeq}`;
  const cls = TYPE_CLASS[type] || 'info';
  const node = el('div', { class: `toast ${cls}`, id, role: type === 'error' ? 'alert' : 'status' });
  node.innerHTML = h`
    ${icon(TYPE_ICON[type] || 'info')}
    <div class="grow">
      ${title ? h`<div class="toast-t">${title}</div>` : ''}
      <div class="${title ? 'toast-d' : 'toast-t'}">${message}</div>
    </div>
    ${action ? h`<button type="button" class="toast-act" data-tid="${id}">${action.label}</button>` : ''}
    <button type="button" class="toast-x" aria-label="${t('common.close')}" data-close="${id}">${icon('close')}</button>`;
  root.appendChild(node);
  // حداکثر ۴ توست هم‌زمان
  while (root.children.length > 4) root.firstElementChild.remove();

  const kill = () => {
    if (!node.isConnected) return;
    node.classList.add('out');
    setTimeout(() => node.remove(), 220);
  };
  const timer = timeout > 0 ? setTimeout(kill, timeout) : null;
  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { clearTimeout(timer); kill(); return; }
    if (action && e.target.closest('[data-tid]')) {
      clearTimeout(timer); kill();
      try { action.onClick(); } catch (err) { console.error(err); }
    }
  });
  return { close: () => { clearTimeout(timer); kill(); } };
}
export const toastSuccess = (m, o) => toast(m, { type: 'success', ...o });
export const toastError = (m, o) => toast(m, { type: 'error', timeout: 5600, ...o });
export const toastWarn = (m, o) => toast(m, { type: 'warn', ...o });

/** نمایش خطای API به‌شکل توست (با پیام انگلیسی در حالت EN) */
export function toastApiError(err, fallbackKey = 'err.generic') {
  const msg = err instanceof ApiError
    ? (lang() === 'en' ? (err.details || err.message) : err.message)
    : errorMessage(err);
  toastError(msg || t(fallbackKey));
}

// ── لایه‌ها (مودال / کشو / شیت) ──────────────────────────────
const layerStack = [];
// جای اسکرول صفحه هنگام قفل‌شدن نگه داشته می‌شود تا با بستن مودال/دیالوگ،
// صفحه به‌جای پریدن به بالا (یا لرزش) دقیقاً سر جای قبلی برگردد.
let lockedScrollY = 0;
function lockScroll(on) {
  if (on) {
    if (!layerStack.length) lockedScrollY = window.scrollY || 0;
    document.body.classList.add('locked');
    document.documentElement.classList.add('locked');
  } else if (!layerStack.length) {
    document.body.classList.remove('locked');
    document.documentElement.classList.remove('locked');
    if (lockedScrollY > 0) window.scrollTo(0, lockedScrollY);
    lockedScrollY = 0;
  }
}

/**
 * ساخت یک لایه.
 * opts: { kind: 'modal'|'drawer'|'sheet', title, subtitle, size, body, footer,
 *         onMount(panel, handle), onClose(result), closeBtn, dismissible }
 */
function makeLayer(opts) {
  const {
    kind = 'modal', title = '', subtitle = '', size = 'md', body = '', footer = '',
    onMount = null, onClose = null, closeBtn = true, dismissible = true,
  } = opts;
  const host = kind === 'modal' ? modalRoot() : drawerRoot();
  if (!host) return { close: () => {} };
  const prevFocus = document.activeElement;
  const isMobile = window.innerWidth < 760;
  const realKind = kind === 'drawer' && isMobile ? 'sheet' : kind;

  const overlay = el('div', {
    class: `overlay${realKind === 'drawer' ? ' overlay-drawer' : ''}${realKind === 'sheet' ? ' overlay-sheet' : ''}`,
  });
  const panelCls = realKind === 'modal' ? `modal ${SIZE_CLASS[size] ?? ''}`.trim() : realKind;
  const panel = el('div', { class: panelCls, role: 'dialog', 'aria-modal': 'true' });
  if (title) panel.setAttribute('aria-label', title);
  const headCls = realKind === 'modal' ? 'modal-h' : 'drawer-h';
  const bodyCls = realKind === 'modal' ? 'modal-b' : 'drawer-b';
  panel.innerHTML = h`
    ${title ? h`<header class="${headCls}">
      <div class="grow"><h3>${title}</h3>${subtitle ? h`<p class="small muted">${subtitle}</p>` : ''}</div>
      ${closeBtn ? h`<button type="button" class="layer-x" data-lx aria-label="${t('common.close')}">${icon('close')}</button>` : ''}
    </header>` : (closeBtn ? h`<button type="button" class="layer-x" data-lx aria-label="${t('common.close')}">${icon('close')}</button>` : '')}
    <div class="${bodyCls}">${body}</div>
    ${footer ? h`<footer class="modal-f">${footer}</footer>` : ''}`;
  overlay.appendChild(panel);
  host.appendChild(overlay);
  lockScroll(true);

  let closed = false;
  const handle = {
    panel, overlay, result: undefined, dismissible,
    close(result) {
      if (closed) return;
      closed = true;
      handle.result = result;
      overlay.classList.add('out');
      panel.classList.add('out');
      setTimeout(() => {
        overlay.remove();
        const i = layerStack.indexOf(handle);
        if (i >= 0) layerStack.splice(i, 1);
        lockScroll(false);
        try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* noop */ }
      }, 190);
      try { onClose?.(result); } catch (e) { console.error(e); }
    },
  };
  layerStack.push(handle);

  overlay.addEventListener('click', (e) => {
    if (closeBtn && e.target.closest('[data-lx]')) { handle.close(null); return; }
    if (e.target === overlay && dismissible) handle.close(null);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const nodes = panel.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([type=hidden]), select, [tabindex]:not([tabindex="-1"])');
    const list = [...nodes].filter((n) => n.offsetParent !== null);
    if (!list.length) return;
    const first = list[0]; const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  setTimeout(() => {
    const first = panel.querySelector('[data-autofocus], input:not([type=hidden]), textarea, select');
    try { first?.focus({ preventScroll: true }); } catch { /* noop */ }
  }, 70);
  try { onMount?.(panel, handle); } catch (e) { console.error(e); }
  return handle;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && layerStack.length) {
    const top = layerStack[layerStack.length - 1];
    if (top.dismissible !== false) { e.preventDefault(); top.close(null); }
  }
});

export function closeAllLayers() { [...layerStack].reverse().forEach(l => l.close(null)); }
export const modal = (o) => makeLayer({ kind: 'modal', ...o });
export const drawer = (o) => makeLayer({ kind: 'drawer', ...o });
export const sheet = (o) => makeLayer({ kind: 'sheet', ...o });

/** باز کردن لایه به‌صورت واکنش‌گرا: در موبایل شیت، در دسکتاپ مودال */
export const adaptive = (o) => makeLayer({ kind: window.innerWidth < 760 ? 'sheet' : 'modal', ...o });

/** گفت‌وگوی تأیید */
export function confirmDialog({ title = '', text = '', okText = '', cancelText = '', danger = false, icon: ic = 'alert' } = {}) {
  return new Promise((resolve) => {
    let result = false;
    makeLayer({
      kind: 'modal',
      title: title || t('common.warning'),
      size: 'sm',
      body: h`
        <div class="confirm-body">
          <span class="confirm-ic ${danger ? 'danger' : ''}">${icon(ic)}</span>
          <p class="confirm-text">${text}</p>
        </div>`,
      footer: h`
        <button type="button" class="btn btn-ghost" data-no>${cancelText || t('common.cancel')}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes data-autofocus>${okText || t('common.confirm')}</button>`,
      onClose: () => resolve(result),
      onMount: (panel, handle) => {
        panel.querySelector('[data-no]').addEventListener('click', () => { result = false; handle.close(); });
        panel.querySelector('[data-yes]').addEventListener('click', () => { result = true; handle.close(); });
      },
    });
  });
}
export const confirmDelete = (text) => confirmDialog({
  title: t('common.delete'), text: text || t('misc.confirmDelete'), okText: t('common.delete'), danger: true, icon: 'trash',
});

/** دریافت متن از کاربر */
export function promptDialog({ title = '', text = '', label = '', value = '', type = 'text', okText = '', required = false, rows = 4 } = {}) {
  return new Promise((resolve) => {
    let result = null;
    makeLayer({
      kind: 'modal',
      title: title || t('common.note'),
      size: 'sm',
      body: h`
        <form class="prompt-form" data-pf>
          ${text ? h`<p class="confirm-text mb-s">${text}</p>` : ''}
          <label class="field">
            <span class="label">${label || title}</span>
            ${type === 'textarea'
              ? h`<textarea class="textarea" name="v" rows="${rows}" data-autofocus>${value}</textarea>`
              : h`<input class="input" type="${type}" name="v" value="${value}" data-autofocus>`}
          </label>
        </form>`,
      footer: h`
        <button type="button" class="btn btn-ghost" data-no>${t('common.cancel')}</button>
        <button type="button" class="btn btn-primary" data-yes>${okText || t('common.confirm')}</button>`,
      onClose: () => resolve(result),
      onMount: (panel, handle) => {
        const input = panel.querySelector('[name=v]');
        const submit = () => {
          const v = String(input.value || '').trim();
          if (required && !v) { input.classList.add('invalid'); input.focus(); return; }
          result = v; handle.close();
        };
        panel.querySelector('[data-no]').addEventListener('click', () => { result = null; handle.close(); });
        panel.querySelector('[data-yes]').addEventListener('click', submit);
        panel.querySelector('[data-pf]').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); submit(); } });
      },
    });
  });
}

// ── لایت‌باکس تصاویر ────────────────────────────────────────
export function lightbox(images, startIndex = 0, title = '') {
  const norm = (x) => (typeof x === 'string' ? { url: x, kind: 'image' } : x);
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean).map(norm).filter((x) => x.url);
  if (!list.length) return null;
  let i = Math.max(0, Math.min(startIndex, list.length - 1));
  let onKey = null;
  let scale = 1; let tx = 0; let ty = 0;
  const apply = (fig) => {
    const m = fig?.querySelector('.lb-img');
    if (m) m.style.transform = `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px) scale(${scale.toFixed(2)})`;
    fig?.classList.toggle('zoomed', scale > 1.01);
  };
  const reset = () => { scale = 1; tx = 0; ty = 0; };
  const render = () => {
    const it = list[i];
    const media = it.kind === 'video'
      ? `<video class="lb-img lb-video" src="${it.url}" controls playsinline autoplay preload="metadata"></video>`
      : `<img class="lb-img" src="${it.url}" alt="${title || t('img.alt')}" decoding="async" draggable="false">
       <div class="watermark-overlay"><div class="watermark-text">${document.title.split('·').pop().trim()}</div></div>`;
    return h`
    <figure class="lb-figure">
      ${raw(media)}
      <div class="lb-tools" role="toolbar" aria-label="${t('pdp.zoomHint')}">
        <button type="button" class="icon-btn" data-zin aria-label="${t('pdp.zoomIn')}">${icon('plus')}</button>
        <button type="button" class="icon-btn" data-zout aria-label="${t('pdp.zoomOut')}">${icon('minus')}</button>
        <button type="button" class="icon-btn tiny-txt" data-zreset aria-label="${t('pdp.zoomReset')}">1x</button>
      </div>
      ${list.length > 1 ? h`<figcaption class="lb-count">${i + 1} / ${list.length}${it.kind === 'video' ? ` · ${t('pdp.video')}` : ''}</figcaption>` : ''}
    </figure>`;
  };
  return makeLayer({
    kind: 'modal',
    size: 'lg',
    title: '',
    body: h`<div data-lb>${render()}</div>`,
    footer: list.length > 1 ? h`
      <button type="button" class="btn btn-ghost" data-prev>${icon('chevron-right')} ${t('common.prev')}</button>
      <button type="button" class="btn btn-ghost" data-next>${t('common.next')} ${icon('chevron-left')}</button>` : '',
    onClose: () => { if (onKey) document.removeEventListener('keydown', onKey); onKey = null; },
    onMount: (panel) => {
      const box = panel.querySelector('[data-lb]');
      const fig = () => box.querySelector('.lb-figure');
      const go = (d) => { i = (i + d + list.length) % list.length; reset(); box.innerHTML = render(); wireFig(); };
      panel.querySelector('[data-prev]')?.addEventListener('click', () => go(-1));
      panel.querySelector('[data-next]')?.addEventListener('click', () => go(1));
      const zoomBy = (f, cx, cy) => {
        const ns = Math.max(1, Math.min(4, scale * f));
        if (ns === 1) { tx = 0; ty = 0; }
        else if (cx != null) { tx = cx - (cx - tx) * (ns / scale); ty = cy - (cy - ty) * (ns / scale); }
        scale = ns; apply(fig());
      };
      let ptrs = new Map(); let pinch0 = 0; let scale0 = 1;
      const wireFig = () => {
        const f = fig(); if (!f) return;
        const media = f.querySelector('.lb-img');
        f.querySelector('[data-zin]')?.addEventListener('click', () => zoomBy(1.5));
        f.querySelector('[data-zout]')?.addEventListener('click', () => zoomBy(1/1.5));
        f.querySelector('[data-zreset]')?.addEventListener('click', () => { reset(); apply(f); });
        f.addEventListener('wheel', (e) => {
          if (list[i].kind === 'video') return;
          e.preventDefault();
          const r = f.getBoundingClientRect();
          zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
        }, { passive: false });
        f.addEventListener('dblclick', (e) => {
          if (list[i].kind === 'video') return;
          const r = f.getBoundingClientRect();
          if (scale > 1.01) { reset(); } else zoomBy(2.5, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
          apply(f);
        });
        f.addEventListener('pointerdown', (e) => {
          if (list[i].kind === 'video') return;
          ptrs.set(e.pointerId, [e.clientX, e.clientY]);
          if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); scale0 = scale; }
          f.setPointerCapture?.(e.pointerId);
        });
        f.addEventListener('pointermove', (e) => {
          if (!ptrs.has(e.pointerId)) return;
          const prev = ptrs.get(e.pointerId);
          ptrs.set(e.pointerId, [e.clientX, e.clientY]);
          if (ptrs.size === 2 && pinch0) {
            const [a, b] = [...ptrs.values()];
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            scale = Math.max(1, Math.min(4, scale0 * (d / pinch0)));
            if (scale === 1) { tx = 0; ty = 0; }
            apply(f);
          } else if (scale > 1.01) {
            tx += e.clientX - prev[0]; ty += e.clientY - prev[1]; apply(f);
          }
        });
        const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
        f.addEventListener('pointerup', up);
        f.addEventListener('pointercancel', up);
        f.querySelector('[data-zin]')?.addEventListener('click', () => zoomBy(1.3));
        f.querySelector('[data-zout]')?.addEventListener('click', () => zoomBy(1 / 1.3));
        f.querySelector('[data-zreset]')?.addEventListener('click', () => { reset(); apply(f); });
        apply(f);
      };
      wireFig();
      onKey = (e) => {
        if (e.key === 'ArrowLeft') go(1);
        else if (e.key === 'ArrowRight') go(-1);
        else if (e.key === '+' || e.key === '=') zoomBy(1.3);
        else if (e.key === '-') zoomBy(1 / 1.3);
        else if (e.key === '0') { reset(); apply(fig()); }
      };
      document.addEventListener('keydown', onKey);
    },
  });
}

// ── اسکلت و وضعیت‌ها ────────────────────────────────────────
export function productSkeleton(n = 8) {
  let out = '';
  for (let i = 0; i < n; i++) out += '<div class="sk sk-card"></div>';
  return raw(`<div class="pgrid">${out}</div>`);
}
export function listSkeleton(n = 5, lines = 3) {
  let out = '';
  for (let i = 0; i < n; i++) {
    let l = '';
    for (let j = 0; j < lines; j++) l += `<div class="sk sk-line w${[70, 40, 55, 80][j % 4]}"></div>`;
    out += h`<div class="card row-card">${l}</div>`;
  }
  return out;
}
export function tableSkeleton(rows = 6, cols = 4) {
  let out = '';
  for (let i = 0; i < rows; i++) {
    let tds = '';
    for (let c = 0; c < cols; c++) tds += `<td><div class="sk sk-line w${[80, 55, 40, 70][c % 4]}"></div></td>`;
    out += `<tr>${tds}</tr>`;
  }
  return raw(`<div class="table-wrap"><table class="table"><tbody>${out}</tbody></table></div>`);
}
export const spinner = (label = '') => h`<div class="row center mt-l" role="status"><span class="spinner"></span>${label ? h`<span class="muted small">${label}</span>` : ''}</div>`;

/** حالت خالی */
export function emptyState({ icon: ic = 'box', title = '', text = '', action = null, act = null } = {}) {
  return h`
    <div class="empty">
      <span class="empty-ic">${icon(ic)}</span>
      <h4>${title || t('common.noData')}</h4>
      ${text ? h`<p>${text}</p>` : ''}
      ${action ? h`<a class="btn btn-primary" href="${action.href || '#/'}">${action.label}</a>` : ''}
      ${act ? h`<button type="button" class="btn btn-primary" data-act="${act.act}" ${act.arg ? h`data-arg="${act.arg}"` : ''}>${act.label}</button>` : ''}
    </div>`;
}

/** حالت خطا با دکمهٔ تلاش دوباره */
export function errorState({ title = '', text = '', retryAct = 'ui-retry' } = {}) {
  return h`
    <div class="empty">
      <span class="empty-ic danger">${icon('alert')}</span>
      <h4>${title || t('err.generic')}</h4>
      ${text ? h`<p>${text}</p>` : ''}
      <button type="button" class="btn btn-primary" data-act="${retryAct}">${t('common.retry')}</button>
    </div>`;
}

/** پیام راهنما / هشدار */
export const notice = (kind, text) => h`
  <div class="notice notice-${kind}">${icon(kind === 'success' ? 'check-circle' : kind === 'danger' ? 'alert' : 'info')}<div class="grow">${text}</div></div>`;

// ── نوار بارگذاری سراسری ────────────────────────────────────
let barEl = null;
let barTimer = null;
export function loadingBar(on) {
  if (on) {
    clearTimeout(barTimer);
    if (!barEl) {
      barEl = el('div', { class: 'loadbar' });
      barEl.innerHTML = '<span class="loadbar-fill"></span>';
      document.body.appendChild(barEl);
    }
    requestAnimationFrame(() => barEl?.classList.add('on'));
  } else {
    barTimer = setTimeout(() => {
      barEl?.classList.remove('on');
      setTimeout(() => { barEl?.remove(); barEl = null; }, 420);
    }, 160);
  }
}

/** اجرای عملیات با قفل دکمه */
export async function withBusy(buttonOrSelector, fn, { busyText = '' } = {}) {
  const btn = typeof buttonOrSelector === 'string' ? qs(buttonOrSelector) : buttonOrSelector;
  const original = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.disabled = true; btn.classList.add('busy');
      btn.innerHTML = h`<span class="spinner"></span>${busyText || t('common.loading')}`;
    }
    return await fn();
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = original; }
  }
}

// ── ابزار فرم ───────────────────────────────────────────────
export function readForm(form) {
  const data = {};
  const fd = new FormData(form);
  for (const [k, v] of fd.entries()) {
    if (k in data && !Array.isArray(data[k])) data[k] = [data[k], v];
    else if (k in data) data[k].push(v);
    else data[k] = v;
  }
  for (const cb of form.querySelectorAll('input[type=checkbox]')) data[cb.name] = cb.checked;
  return data;
}

export function markInvalid(form, fieldName, message) {
  const input = form.querySelector(`[name="${fieldName}"]`);
  if (!input) return;
  input.classList.add('invalid');
  let hint = input.closest('.field')?.querySelector('.field-err');
  if (!hint) {
    hint = el('span', { class: 'field-err' });
    (input.closest('.field') || input.parentElement).appendChild(hint);
  }
  hint.textContent = message;
  try { input.focus({ preventScroll: false }); } catch { /* noop */ }
}
export function clearInvalid(form) {
  form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
  form.querySelectorAll('.field-err').forEach((n) => n.remove());
}

export function fillSelect(sel, items, { valueKey = 'id', labelKey = 'label', placeholder = '', selected = '' } = {}) {
  if (!sel) return;
  const opts = placeholder ? [`<option value="">${esc(placeholder)}</option>`] : [];
  for (const it of items) {
    const v = it[valueKey];
    opts.push(`<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(it[labelKey])}</option>`);
  }
  sel.innerHTML = opts.join('');
}

export async function copyWithToast(text, msg) {
  const { copyText } = await import('./lib/dom.mjs');
  try { await copyText(String(text)); toastSuccess(msg || t('common.copied')); }
  catch { toastError(t('err.generic')); }
}

/** راهنمای نصب PWA */
export function installHintModal() {
  const steps = lang() === 'fa'
    ? ['منوی مرورگر (⋮ یا دکمهٔ اشتراک‌گذاری) را باز کن.', 'گزینهٔ «افزودن به صفحهٔ اصلی» یا «Install app» را بزن.', 'تأیید کن؛ آیکون یاسایی به صفحهٔ اصلی اضافه می‌شود.']
    : ['Open the browser menu (⋮ or the Share button).', 'Choose “Add to Home screen” or “Install app”.', 'Confirm — the Yassaei Electronics icon appears on your home screen.'];
  modal({
    title: t('misc.addToHome'),
    size: 'sm',
    body: h`
      <div class="install-hint">
        <ol class="steps-list">${steps.map((s) => h`<li>${s}</li>`)}</ol>
        <p class="muted small">${t('misc.installHint')}</p>
      </div>`,
    footer: h`<button type="button" class="btn btn-primary" data-ok>${t('common.done')}</button>`,
    onMount: (panel, handle) => panel.querySelector('[data-ok]').addEventListener('click', () => handle.close()),
  });
}

/** آکاردئون‌های داخل یک ریشه را فعال می‌کند */
export function wireAccordions(root = document) {
  root.querySelectorAll('.acc-h').forEach((head) => {
    if (head.dataset.wired) return;
    head.dataset.wired = '1';
    head.addEventListener('click', () => {
      const item = head.closest('.acc-item');
      const open = item.classList.toggle('open');
      const body = item.querySelector('.acc-b');
      if (body) body.hidden = !open;
      head.setAttribute('aria-expanded', String(open));
    });
  });
}

/** تب‌های داخل یک ریشه */
export function wireTabs(root = document, onChange = null) {
  root.querySelectorAll('.tabs').forEach((bar) => {
    if (bar.dataset.wired) return;
    bar.dataset.wired = '1';
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      const key = btn.dataset.tab;
      bar.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      const scope = root;
      scope.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== key; });
      onChange?.(key);
    });
  });
}

// ── صفحهٔ خواب فروشگاه (کلید خاموش/روشن) ────────────────────
/**
 * وقتی فروشگاه «خواب» است یک پردهٔ تمام‌صفحه نشان می‌دهد.
 * اگر بازدیدکننده دسترسی بیدارکردن داشته باشد، دکمهٔ روشن‌کردن ظاهر می‌شود.
 */
export function updateSleepScreen({ sleeping = false, canWake = false, since = null, onWake = null, onLogin = null } = {}) {
  const id = 'sleepScreen';
  let box = document.getElementById(id);
  if (!sleeping) { if (box) box.remove(); document.body?.classList.remove('sleeping'); return; }
  document.body?.classList.add('sleeping');
  const fa = lang() === 'fa';
  const title = fa ? 'فروشگاه الان خاموش است' : 'The store is asleep';
  const text = fa
    ? 'برای استراحت و نگهداری، فروشگاه را خاموش کرده‌ایم. کسی نمی‌تواند سفارش ثبت کند تا دوباره روشن شود.'
    : 'The shop was switched off for a break. Nobody can place orders until it is turned on again.'
  const sinceTxt = since ? `<div class="tiny sleep-since">${fa ? 'خاموش از' : 'Asleep since'}: ${new Date(since).toLocaleString(fa ? 'fa-IR' : 'en-GB')}</div>` : '';
  if (!box) {
    box = document.createElement('div');
    box.id = id;
    box.className = 'sleep-screen';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    document.body?.appendChild(box);
  }
  box.innerHTML = h`
    <div class="sleep-card">
      <span class="sleep-ic">${icon('moon')}</span>
      <h2>${title}</h2>
      <p>${text}</p>
      ${raw(sinceTxt)}
      ${canWake
        ? h`<button class="btn btn-primary btn-block mt" data-sleep-wake>${icon('zap')} ${fa ? 'روشن کردن فروشگاه' : 'Turn the store on'}</button>`
        : h`
          <a class="btn btn-outline btn-block mt" href="#/auth" data-sleep-login>${icon('user')} ${fa ? 'ورود مدیر برای روشن کردن' : 'Sign in as admin to turn it on'}</a>
          <button class="btn btn-ghost btn-block mt-s" data-sleep-reload>${icon('refresh')} ${fa ? 'تلاش دوباره' : 'Try again'}</button>`}
      <p class="tiny sleep-note">${fa ? 'خودکار خاموش نمی‌شود؛ تا وقتی روشنش نکنی خاموش می‌ماند.' : 'It never turns off by itself — it stays off until you switch it on.'}</p>
    </div>`;
  box.querySelector('[data-sleep-wake]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { await onWake?.(); }
    finally { btn.disabled = false; }
  });
  box.querySelector('[data-sleep-reload]')?.addEventListener('click', () => location.reload());
  box.querySelector('[data-sleep-login]')?.addEventListener('click', () => onLogin?.());
}

// ── چشم نمایش/پنهان رمز عبور — خودکار روی همهٔ input[type=password] ──
function enhancePwd(root) {
  root.querySelectorAll?.('input[type="password"]')?.forEach((inp) => {
    if (inp.dataset.pwdDone) return;
    inp.dataset.pwdDone = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pwd-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pwd-eye';
    btn.dataset.eye = '1';
    btn.setAttribute('aria-label', t('pwd.show'));
    btn.title = t('pwd.show');
    btn.innerHTML = icon('eye');
    wrap.appendChild(btn);
  });
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('[data-eye]');
  if (!btn) return;
  const inp = btn.parentElement?.querySelector('input');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = icon(show ? 'eye-off' : 'eye');
  const lbl = show ? t('pwd.hide') : t('pwd.show');
  btn.setAttribute('aria-label', lbl);
  btn.title = lbl;
  inp.focus({ preventScroll: true });
}, true);
new MutationObserver((muts) => {
  for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) enhancePwd(n); });
}).observe(document.documentElement, { childList: true, subtree: true });
enhancePwd(document);

// ── صدای کلیک ظریف رابط کاربری (WebAudio، بدون فایل صوتی) ──
let _ac = null;
export function uiClickSound(force = false) {
  if (!force && !uiSoundEnabled()) return;
  try {
    _ac = _ac || new (window.AudioContext || window.webkitSoundContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    const t0 = _ac.currentTime;
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1560, t0);
    o.frequency.exponentialRampToValueAtTime(1180, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
    o.connect(g).connect(_ac.destination);
    o.start(t0); o.stop(t0 + 0.09);
  } catch { /* بی‌صدا */ }
}
export function uiSoundEnabled() {
  try { return !!JSON.parse(localStorage.getItem('ys_prefs_v1') || '{}').uiSound; } catch { return false; }
}
document.addEventListener('pointerdown', (e) => {
  if (!uiSoundEnabled()) return;
  if (e.target.closest?.('button, a, [role="button"], .pcard, .chip, .gal-thumb')) uiClickSound(true);
}, true);

export function fireConfetti() {
  const colors = ['var(--accent)', 'var(--accent-2)', '#ffeb3b', '#f44336', '#4caf50', '#2196f3', '#e91e63'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.opacity = Math.random() + 0.5;
    el.style.transform = `scale(${Math.random() * 0.8 + 0.4})`;
    el.style.animationDuration = (Math.random() * 2.5 + 2.5) + 's';
    el.style.animationDelay = (Math.random() * 0.2) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.isConnected && el.remove(), 5500);
  }
}
