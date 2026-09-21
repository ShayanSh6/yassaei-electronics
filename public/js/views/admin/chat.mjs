// ─────────────────────────────────────────────────────────────
//  چت داخلی تیم — فقط مدیر (مالک) و کارمندان
//  • پیام + پیوست (تصویر/PDF)
//  • @mention با تکمیل خودکار و هایلایت
//  • ارجاع به سرنخ‌ها: #order:123 · #product:45 · #ticket:67 · #user:89
//    (به‌صورت پیل لینک‌شده قابل کلیک)
//  • نوار «+ ارجاع به سفارش/محصول/تیکت/کاربر»
//  • دریافت زندهٔ پیام‌ها با SSE
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, esc, fmtNum, fileToDataURL, applyDyn, timeAgo } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S, feat, isStaff, on, can } from '../../state.mjs';
import { toastSuccess, toastApiError, toast, withBusy, errorState, spinner, emptyState, promptDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';

const E = { data: null, pending: [] };

const ENTITY_ROUTES = {
  order: (id) => `#/admin/orders/${id}`,
  product: (id) => `#/product/${id}`,
  ticket: (id) => `#/admin/tickets/${id}`,
  user: (id) => `#/admin/users/${id}`,
};

// ── رندر امن متن پیام: هایلایت @mention + پیل ارجاع ─────────
function richText(text, staffSet) {
  let out = esc(text);
  // ارجاع‌ها (پیل‌های لینک‌شده)
  out = out.replace(/#(order|product|ticket|user):([A-Za-z0-9_-]+)/g, (m, kind, id) => {
    const href = ENTITY_ROUTES[kind] ? ENTITY_ROUTES[kind](id) : null;
    const label = `#${kind}:${id}`;
    return href
      ? h`<a class="chat-tag tg-${kind}" href="${href}" title="${label}">${icon(kind === 'order' ? 'cart' : kind === 'product' ? 'box' : kind === 'ticket' ? 'ticket' : 'user')} ${esc(label)}</a>`
      : h`<span class="chat-tag">${esc(label)}</span>`;
  });
  // یادآوری‌ها (هایلایت همکاران)
  out = out.replace(/(^|\s)@([A-Za-z0-9\u0600-\u06FF_.-]{1,40})/g, (m, pre, name) => {
    const isStaffU = staffSet.has(String(name).toLowerCase());
    return `${pre}<span class="chat-mention${isStaffU ? ' is-staff' : ''}">@${esc(name)}</span>`;
  });
  return raw(out);
}

function messageHtml(m, staffSet) {
  const mine = m.userId === S.me?.id;
  const isOwner = m.role === 'owner';
  const name = isFa() ? (m.userName || m.username) : (m.userNameEn || m.userName || m.username);
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('');
  const atts = (m.attachments || []).map((u) => {
    const isImg = /\.(jpe?g|png|webp|gif|svg)$/i.test(u);
    return isImg
      ? h`<a class="chat-att chat-att-img" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(u)}" loading="lazy"></a>`
      : h`<a class="chat-att" href="${esc(u)}" target="_blank" rel="noopener" download>${icon('file')} ${esc(u.split('/').pop() || u)}</a>`;
  }).join('');
  return h`
    <div class="chat-msg ${mine ? 'is-mine' : ''}" data-mid="${m.id}">
      <span class="chat-ava ${isOwner ? 'is-owner' : ''}" aria-hidden="true">${esc(initials || '?')}</span>
      <div class="chat-bubble">
        <div class="chat-head">
          <b class="chat-name">${esc(name || '?')}</b>
          ${isOwner ? h`<span class="chat-role">${isFa() ? 'مدیر' : 'Owner'}</span>` : ''}
          <span class="chat-time" dir="ltr">${timeAgo(m.createdAt)}</span>
        </div>
        ${m.text ? h`<div class="chat-text">${richText(m.text, staffSet)}</div>` : ''}
        ${atts ? h`<div class="chat-atts">${atts}</div>` : ''}
      </div>
    </div>`;
}

export async function render(ctx) {
  if (!S.me || !isStaff()) {
    return emptyState({ icon: 'lock', title: t('err.forbidden') });
  }
  if (!feat('adminChat')) {
    return h`
      <div class="card">
        ${emptyState({ icon: 'chat', title: t('adm.chatOff'), action: { href: '#/admin/settings/team', label: t('adm.features') || t('common.settings') } })}
      </div>`;
  }
  let data = null;
  try {
    data = await api.get('/api/admin/chat');
  } catch (err) {
    if (err?.code === 'disabled') {
      return h`<div class="card">${emptyState({ icon: 'chat', title: t('adm.chatOff'), action: { href: '#/admin/settings/team', label: t('adm.features') || t('common.settings') } })}</div>`;
    }
    return errorState({ title: err?.message || t('err.generic') });
  }
  E.data = data;
  const staffSet = new Set((data.staff || []).map((x) => x.username.toLowerCase()));

  const messages = (data.messages || []).map((m) => messageHtml(m, staffSet)).join('');
  const staffList = (data.staff || []).map((u) => h`
    <button type="button" class="chat-staff ${u.role === 'owner' ? 'is-owner' : ''}" data-act="chat-mention" data-u="${esc(u.username)}">
      <span class="chat-ava sm ${u.role === 'owner' ? 'is-owner' : ''}" aria-hidden="true">${esc(((isFa() ? u.name : (u.nameEn || u.name)) || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('') || '?')}</span>
      <span class="grow">
        <span class="b tiny">${esc(isFa() ? u.name : (u.nameEn || u.name))}</span>
        <span class="tiny muted" dir="ltr">@${esc(u.username)}${u.role === 'owner' ? (isFa() ? ' · مدیر' : ' · owner') : ''}</span>
      </span>
    </button>`).join('');

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('chat')} ${t('adm.chat')}</h2>
      ${can('settings.edit') ? h`<a class="btn btn-ghost btn-sm" href="#/admin/settings/team">${icon('settings')} ${t('common.settings')}</a>` : ''}
      <span class="badge-pill bp-info">${fmtNum((data.messages || []).length)} ${isFa() ? 'پیام' : 'msgs'}</span>
    </div>
    <p class="hint mb-s">${icon('info')} ${t('adm.chatMentionHint')}${isFa() ? ' · ارجاع: ' : ' · references: '} <code>#order:1</code> <code>#product:1</code> <code>#ticket:1</code> <code>#user:1</code></p>

    <div class="chat-wrap">
      <aside class="chat-side">
        <strong class="chat-side-h">${icon('users')} ${t('adm.chatStaff')}</strong>
        <div class="chat-staff-list">${staffList || h`<p class="tiny muted">${t('common.empty') || '—'}</p>`}</div>
      </aside>

      <div class="chat-main">
        <div class="chat-log" data-chat-log>${messages || h`<div class="chat-empty">${emptyState({ icon: 'chat', title: t('adm.chatEmpty') })}</div>`}</div>

        <div class="chat-composer">
          <div class="chat-quick" data-chat-quick>
            <span class="tiny muted">${t('adm.chatRef')}:</span>
            ${['order', 'product', 'ticket', 'user'].map((k) => h`
              <button type="button" class="btn btn-ghost btn-xs" data-act="chat-ref" data-k="${k}">+ ${t(`adm.chatRef${k[0].toUpperCase()}${k.slice(1)}`)}</button>`).join('')}
          </div>
          <div class="chat-row">
            <label class="btn btn-ghost btn-sm chat-attach-btn" for="chat-file" title="${t('adm.chatAttach')}">${icon('upload')}</label>
            <input id="chat-file" type="file" accept="image/*,application/pdf" multiple hidden data-chat-file>
            <div class="chat-pend" data-chat-pend></div>
            <textarea class="textarea" rows="2" data-chat-input placeholder="${t('adm.chatPlaceholder')}" maxlength="2000"></textarea>
            <button type="button" class="btn btn-primary" data-act="chat-send" title="${t('common.send')}">${icon('send')}</button>
          </div>
          <div class="chat-mention-pop" data-chat-mention hidden></div>
        </div>
      </div>
    </div>`;
}

// ── ارسال پیام ─────────────────────────────────────────────
function doSend(root) {
  const input = root.querySelector('[data-chat-input]');
  const log = root.querySelector('[data-chat-log]');
  const text = String(input?.value || '').trim();
  const pending = E.pending.filter((p) => p.url);
  if (!text && !pending.length) return;
  if (pending.some((p) => p.uploading)) { toast(t('common.waitUpload'), { type: 'warn' }); return; }
  const payload = { text, attachments: pending.map((p) => p.url).slice(0, 4) };
  if (!text) payload.text = '📎';
  api.post('/api/admin/chat', payload).then((r) => {
    const m = r?.message;
    if (m) appendMessage(root, m);
    input.value = '';
    E.pending = [];
    paintPend(root);
    closeMention(root);
  }).catch((err) => toastApiError(err));
}

function appendMessage(root, m) {
  const log = root.querySelector('[data-chat-log]');
  if (!log) return;
  if (log.querySelector(`[data-mid="${m.id}"]`)) return;
  const emp = log.querySelector('.chat-empty');
  if (emp) emp.remove();
  const staffSet = new Set((E.data?.staff || []).map((x) => x.username.toLowerCase()));
  log.insertAdjacentHTML('beforeend', messageHtml(m, staffSet));
  log.scrollTop = log.scrollHeight;
  // به‌روزرسانی شمارندهٔ بالای صفحه
  const cnt = document.querySelector('#viewInner .badge-pill.bp-info');
  if (cnt) {
    try {
      const cur = cnt.textContent.match(/\d+/);
      if (cur) cnt.textContent = `${fmtNum(Number(cur[0]) + 1)} ${isFa() ? 'پیام' : 'msgs'}`;
    } catch { /* noop */ }
  }
  E.data = E.data || { staff: [] };
  E.data.messages = E.data.messages || [];
  E.data.messages.push(m);
}

// ── پیوست‌ها ────────────────────────────────────────────────
function paintPend(root) {
  const box = root.querySelector('[data-chat-pend]');
  if (!box) return;
  box.innerHTML = E.pending.map((p, i) => p.uploading
    ? h`<span class="chip">${spinner('')}&nbsp;…</span>`
    : h`<span class="chip">${p.isImg ? h`<img src="${esc(p.url)}" alt="" style="width:18px;height:18px;object-fit:cover;border-radius:4px;vertical-align:-4px">` : icon('file')} ${esc(p.name || 'file')}${p.url ? '' : '…'}<button type="button" class="chip-close" data-act="chat-pend-del" data-i="${i}" aria-label="${t('common.delete')}">${icon('close')}</button></span>`
  ).join('');
}

// ── @mention: تکمیل خودکار ───────────────────────────────────
function currentMentionToken(input) {
  const v = String(input.value || '');
  const upto = v.slice(0, input.selectionStart ?? v.length);
  const m = /(?:^|\s)@([A-Za-z0-9\u0600-\u06FF_.-]{0,40})$/.exec(upto);
  return m ? { start: upto.length - m[1].length - 1, token: m[1] } : null;
}

function openMention(root, input) {
  const pop = root.querySelector('[data-chat-mention]');
  const staff = (E.data?.staff || []).filter((u) => u.id !== S.me?.id);
  const info = currentMentionToken(input);
  if (!info || info.token.length > 40) { closeMention(root); return; }
  const q = info.token.toLowerCase();
  const list = staff.filter((u) => u.username.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)).slice(0, 8);
  if (!list.length) { closeMention(root); return; }
  pop.innerHTML = list.map((u) => h`
    <button type="button" data-act="chat-mention-pick" data-u="${esc(u.username)}">
      <span class="b tiny">@${esc(u.username)}</span>
      <span class="tiny muted">${esc(isFa() ? u.name : (u.nameEn || u.name))}</span>
    </button>`).join('');
  pop.hidden = false;
}

function closeMention(root) {
  const pop = root.querySelector('[data-chat-mention]');
  if (pop) { pop.hidden = true; pop.innerHTML = ''; }
}

function insertAtCursor(input, text, replaceFrom) {
  const pos = replaceFrom ?? (input.selectionStart ?? input.value.length);
  const v = input.value;
  input.value = v.slice(0, pos) + text + v.slice(input.selectionEnd ?? pos);
  const np = pos + text.length;
  input.setSelectionRange(np, np);
  input.focus();
}

// ── مانت + کنش‌ها ───────────────────────────────────────────
export function mount(root) {
  applyDyn(root);
  const input = root.querySelector('[data-chat-input]');
  const fileInput = root.querySelector('[data-chat-file]');
  const log = root.querySelector('[data-chat-log]');
  if (log) log.scrollTop = log.scrollHeight;

  let unsub = null;
  if (input) {
    input.addEventListener('input', () => openMention(root, input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(root); }
      if (e.key === 'Escape') closeMention(root);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const files = [...(fileInput.files || [])].slice(0, 4 - E.pending.length);
      fileInput.value = '';
      for (const f of files) {
        if (f.size > 4 * 1024 * 1024) { toast(`${t('err.tooLarge')}: ${f.name}`, { type: 'warn' }); continue; }
        const idx = E.pending.length;
        E.pending.push({ name: f.name, url: '', uploading: true, isImg: /^image\//.test(f.type) });
        paintPend(root);
        try {
          const dataUrl = await fileToDataURL(f);
          const r = await api.upload(dataUrl);
          if (E.pending[idx]) { E.pending[idx].url = r?.url || ''; E.pending[idx].uploading = false; }
        } catch (err) {
          toastApiError(err);
          if (E.pending[idx]) E.pending.splice(idx, 1);
        }
        paintPend(root);
      }
    });
  }
  // پیام‌های زنده
  unsub = on('sse:chat', (m) => {
    if (!m || !m.id) return;
    appendMessage(root, m);
  });

  return () => { try { unsub && unsub(); } catch { /* noop */ } };
}

act('chat-send', (e, el) => {
  const root = el.closest('.chat-composer')?.closest('.chat-wrap') || el.closest('#viewInner');
  doSend(root || document);
});

act('chat-pend-del', (e, el) => {
  E.pending.splice(Number(el.dataset.i), 1);
  paintPend(el.closest('.chat-wrap') || el.closest('#viewInner'));
});

// انتخاب از فهرست اعضای تیم (کنار چت) → درج @username
act('chat-mention', (e, el) => {
  const root = el.closest('.chat-wrap') || el.closest('#viewInner');
  const input = root.querySelector('[data-chat-input]');
  if (!input) return;
  const v = input.value;
  const pos = input.selectionStart ?? v.length;
  const needsSpace = pos > 0 && !/\s$/.test(v.slice(0, pos));
  insertAtCursor(input, (needsSpace ? ' ' : '') + `@${el.dataset.u} `, pos);
});

// انتخاب از منوی تکمیل خودکار
act('chat-mention-pick', (e, el) => {
  const root = el.closest('.chat-composer') || el.closest('#viewInner');
  const input = root.querySelector('[data-chat-input]');
  if (!input) return;
  const v = input.value;
  const m = /(?:^|\s)@([A-Za-z0-9\u0600-\u06FF_.-]{0,40})$/.exec(v.slice(0, input.selectionStart ?? v.length));
  if (m) {
    const start = (input.selectionStart ?? v.length) - m[1].length - 1;
    insertAtCursor(input, `@${el.dataset.u} `, start);
  } else {
    insertAtCursor(input, `@${el.dataset.u} `);
  }
  closeMention(root);
});

// «+ ارجاع به …» → پرسیدن شماره/شناسه و درج تگ
act('chat-ref', async (e, el) => {
  const kind = el.dataset.k;
  const labels = { order: t('adm.chatRefOrder'), product: t('adm.chatRefProduct'), ticket: t('adm.chatRefTicket'), user: t('adm.chatRefUser') };
  const root = el.closest('.chat-wrap') || el.closest('#viewInner');
  const input = root.querySelector('[data-chat-input]');
  const val = await promptDialog({
    title: `${t('adm.chatRef')}: ${labels[kind]}`,
    label: t('adm.chatRefPh'),
    required: true,
  });
  const id = String(val || '').trim();
  if (!id || !input) return;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) { toast(t('err.generic'), { type: 'warn' }); return; }
  const v = input.value;
  const pos = input.selectionStart ?? v.length;
  const sep = (pos > 0 && !/(\s)$/.test(v.slice(pos - 1))) ? ' ' : '';
  insertAtCursor(input, `${sep}#${kind}:${id} `, pos);
});
