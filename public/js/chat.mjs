// ─────────────────────────────────────────────────────────────
//  چت پشتیبانی آنلاین (پنجرهٔ شناور + رشتهٔ مشترک)
// ─────────────────────────────────────────────────────────────
import { S, on } from './state.mjs';
import { t, lang } from './i18n.mjs';
import { api } from './lib/api.mjs';
import { html as h, esc, icon, timeAgo, el } from './lib/dom.mjs';
import { toastApiError, toast } from './ui.mjs';
import { act } from './actions.mjs';

let winEl = null;
let threadEl = null;
let unread = 0;

export const msgHtml = (m) => h`
  <div class="msg ${m.from === 'user' ? 'me' : 'them'}" data-id="${m.id || ''}">
    ${esc(m.body)}
    <span class="tm">${timeAgo(m.at)}</span>
  </div>`;

export async function loadThread() {
  const r = await api.get('/api/support/messages');
  return r.items || [];
}

export function threadHtml(items) {
  if (!items.length) {
    return h`<div class="msg them">${t('acc.chatWelcome')}</div>`;
  }
  return items.map(msgHtml).join('');
}

function scrollThread(box) {
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

export async function sendChat(body) {
  const r = await api.post('/api/support/messages', { body });
  return r;
}

// ── پنجرهٔ شناور ────────────────────────────────────────────
export function openChat() {
  if (!feat()) return;
  if (!S.me) {
    toast(t('chat.loginFirst'));
    location.hash = '#/auth?next=' + encodeURIComponent('account/support');
    return;
  }
  if (winEl) { closeChat(); return; }
  const root = document.getElementById('chatRoot');
  winEl = el('div', { class: 'chat-win', role: 'dialog', 'aria-label': t('chat.title') });
  winEl.innerHTML = h`
    <header class="chat-h">
      <span class="stat-ic" data-h="34px" data-w="34px">${icon('headset')}</span>
      <div class="grow">
        <div class="t">${t('chat.title')}</div>
        <div class="s"><span class="online-dot"></span>${t('chat.online')}</div>
      </div>
      <button type="button" class="icon-btn" data-cx aria-label="${t('chat.minimize')}">${icon('close')}</button>
    </header>
    <div class="chat-b" data-thread><div class="msg them">${t('common.loading')}</div></div>
    <form class="chat-f" data-act="chat-send">
      <input class="input" name="body" maxlength="1000" placeholder="${t('acc.chatPlaceholder')}" autocomplete="off">
      <button type="submit" class="btn btn-primary btn-icon" aria-label="${t('common.send')}">${icon('send')}</button>
    </form>`;
  root.appendChild(winEl);
  threadEl = winEl.querySelector('[data-thread]');
  winEl.querySelector('[data-cx]').addEventListener('click', closeChat);
  const ih = winEl.querySelector('.chat-h .stat-ic');
  if (ih) { ih.style.width = '34px'; ih.style.height = '34px'; ih.style.borderRadius = '11px'; }
  loadThread()
    .then((items) => { threadEl.innerHTML = threadHtml(items); scrollThread(threadEl); })
    .catch(() => { threadEl.innerHTML = h`<div class="msg them">${t('err.network')}</div>`; });
  winEl.querySelector('input[name=body]').focus();
}

export function closeChat() {
  winEl?.remove();
  winEl = null;
  threadEl = null;
}
export const chatOpen = () => !!winEl;

function appendLive(m) {
  const boxes = [];
  if (threadEl) boxes.push(threadEl);
  document.querySelectorAll('[data-thread-page]').forEach((n) => boxes.push(n));
  for (const box of boxes) {
    if (box.querySelector(`[data-id="${m.id}"]`)) continue;
    const first = box.querySelector('.msg');
    if (first && !first.dataset.id && box.children.length === 1 && first.classList.contains('them') && first.textContent === t('acc.chatWelcome')) box.innerHTML = '';
    box.insertAdjacentHTML('beforeend', msgHtml(m));
    scrollThread(box);
  }
}

// ── اکشن ارسال (هم پنجرهٔ شناور هم صفحهٔ حساب) ───────────────
act('chat-open', () => openChat());
act('chat-send', async (e, form) => {
  const input = form.querySelector('input[name=body], textarea[name=body]');
  const body = String(input?.value || '').trim();
  if (!body) return;
  input.value = '';
  const me = { id: 'tmp', from: 'user', body, at: new Date().toISOString() };
  const boxes = [];
  if (threadEl) boxes.push(threadEl);
  document.querySelectorAll('[data-thread-page]').forEach((n) => boxes.push(n));
  for (const b of boxes) { b.insertAdjacentHTML('beforeend', msgHtml(me)); scrollThread(b); }
  try {
    const r = await sendChat(body);
    const saved = r.message;
    toast(t('chat.sent'), { timeout: 1600 });
    for (const b of boxes) {
      // Find the pending me message (it might not be the last one if others came in)
      const last = b.querySelector('.msg.me:not([data-id])');
      if (last) {
        last.dataset.id = saved.id;
        last.querySelector('.tm').textContent = timeAgo(saved.at);
      }
    }
    if (r.botMessage) {
      appendLive(r.botMessage);
    }
  } catch (err) {
    toastApiError(err);
    for (const b of boxes) b.lastElementChild?.remove();
    input.value = body;
  }
});

// ── رویدادهای زنده ─────────────────────────────────────────
export function initChat() {
  document.getElementById('fabSupport')?.addEventListener('click', openChat);
  document.getElementById('btnSupportTop')?.addEventListener('click', openChat);

  on('sse:support', (d) => {
    if (!S.me || d?.userId !== S.me.id) return;
    // پیام کارمند: نمایش زنده
    loadThread().then((items) => {
      const m = items.find((x) => x.id === d.id);
      if (m && m.from === 'staff') {
        if (chatOpen()) appendLive(m);
        else {
          unread += 1;
          updateFabDot();
          toast(m.body, { title: t('chat.title'), timeout: 6000, action: { label: t('common.view'), onClick: openChat } });
        }
      }
      const page = document.querySelector('[data-thread-page]');
      if (page && !chatOpen()) { page.innerHTML = threadHtml(items); scrollThread(page); }
    }).catch(() => {});
  });
  on('me', () => updateFabDot());
}

export function updateFabDot() {
  const fab = document.getElementById('fabSupport');
  if (!fab) return;
  let dot = fab.querySelector('.fab-dot');
  if (unread > 0) {
    if (!dot) { dot = el('span', { class: 'fab-dot' }); fab.appendChild(dot); }
  } else dot?.remove();
}
export function clearChatUnread() { unread = 0; updateFabDot(); }

function feat() { return S.settings?.features?.liveSupport !== false; }
export const chatEnabled = feat;
