// ─────────────────────────────────────────────────────────────
//  جزئیات تیکت: گفت‌وگوی کاربر/پشتیبانی، پیوست تصویری، بستن تیکت
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate, timeAgo, applyDyn, fileToDataURL } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, loadNotifications } from '../state.mjs';
import { emptyState, textareaField } from '../components.mjs';
import { toastSuccess, toastError, toastApiError, confirmDialog, withBusy, errorState, lightbox } from '../ui.mjs';
import { act, getAct } from '../actions.mjs';
import { refresh } from '../router.mjs';

const STATUS_CLASS = { open: 'bp-warn', answered: 'bp-success', closed: 'bp-muted', in_progress: 'bp-info', new: 'bp-info' };
const PRI_CLASS = { critical: 'bp-danger', high: 'bp-warn', normal: 'bp-info', low: 'bp-muted' };

let pendingFiles = [];

export async function render(ctx) {
  let ticket = null;
  try { ticket = (await api.get(`/api/tickets/${ctx.params.id}`)).ticket; }
  catch (err) {
    return err?.status === 404
      ? emptyState({ icon: 'ticket', title: t('acc.noTickets'), action: { href: '#/account/tickets', label: t('acc.tickets') } })
      : errorState({ title: t('err.generic') });
  }
  pendingFiles = [];
  const sla = (S.ticketPriorities || []).find((p) => p.id === ticket.priority)?.slaHours || 24;
  const closed = ticket.status === 'closed';

  return h`
    <div class="breadcrumb mb-s">
      <a href="#/account">${t('acc.title')}</a> <span>/</span>
      <a href="#/account/tickets">${t('acc.tickets')}</a> <span>/</span>
      <span class="mono">${ticket.code}</span>
    </div>

    <div class="card">
      <div class="row row-between row-wrap">
        <div>
          <h1 class="buy-title">${icon('ticket')} ${esc(ticket.subject)}</h1>
          <p class="muted small mt-s">
            <span class="mono">${ticket.code}</span> · ${fmtDate(ticket.createdAt)} ·
            ${t('acc.ticketCategory')}: ${t(`tc.${ticket.category}`)}
          </p>
        </div>
        <div class="row row-wrap">
          <span class="badge-pill ${STATUS_CLASS[ticket.status] || 'bp-muted'}">${t(`tk.${ticket.status}`)}</span>
          <span class="badge-pill ${PRI_CLASS[ticket.priority] || 'bp-info'}">${t(`tp.${ticket.priority}`)}</span>
          ${!closed ? h`<button class="btn btn-ghost btn-sm" data-act="tk-close" data-id="${ticket.id}">${icon('check')} ${t('acc.ticketClose')}</button>` : ''}
        </div>
      </div>
      <p class="notice notice-info mt-s">${icon('clock')}<span>${t('acc.ticketSla', { h: fmtNum(sla) })}</span></p>
    </div>

    <div class="card mt">
      <strong>${icon('chat')} ${t('common.messages')} (${fmtNum(ticket.messages?.length || 0)})</strong>
      <div class="tk-thread mt-s" data-tk-thread>
        ${(ticket.messages || []).map(messageHtml).join('')}
      </div>

      ${closed ? h`<p class="notice notice-warn mt">${icon('info')}<span>${t('acc.ticketClosedNote')}</span></p>` : ''}
      <form class="mt" data-act="tk-reply" data-id="${ticket.id}">
        ${textareaField({ label: t('acc.ticketWrite'), name: 'body', required: true, rows: 4, placeholder: t('acc.chatPlaceholder') })}
        <div data-attach-preview class="row row-wrap mt-s"></div>
        <div class="row row-between row-wrap mt-s">
          <div class="row row-wrap">
            <label class="btn btn-ghost btn-sm" for="tk-file">${icon('upload')} ${t('common.attach')}</label>
            <input id="tk-file" type="file" accept="image/*" multiple hidden data-attach-input>
            <span class="hint">${t('acc.attachHint')}</span>
          </div>
          <button class="btn btn-primary" type="submit">${icon('send')} ${t('common.send')}</button>
        </div>
      </form>
    </div>`;
}

function messageHtml(m) {
  const mine = m.from === 'user';
  const cls = m.from === 'system' ? 'them sys' : mine ? 'me' : 'them';
  return h`
    <div class="msg ${cls}">
      <div class="msg-bubble">
        <div class="row row-between">
          <strong class="tiny">${esc(mine ? (S.me?.name || t('common.user')) : (m.from === 'staff' ? t('common.support') : m.name || ''))}</strong>
          <span class="tiny muted nowrap">${timeAgo(m.at)}</span>
        </div>
        <div class="msg-text">${esc(m.body || '').replace(/\n/g, '<br>')}</div>
        ${(m.attachments || []).length ? h`<div class="row row-wrap mt-s">${m.attachments.map((a) => h`<img class="tk-att" src="${a}" alt="${t('common.image')}" loading="lazy" data-act="tk-att-open" data-url="${a}">`)}</div>` : ''}
      </div>
    </div>`;
}

// ── پیوست‌ها ────────────────────────────────────────────────
act('tk-att-open', (e, el) => {
  const all = [...document.querySelectorAll('[data-tk-thread] .tk-att')];
  const urls = all.map((x) => x.getAttribute('src'));
  lightbox(urls.length ? urls : [el.getAttribute('src')], Math.max(0, urls.indexOf(el.getAttribute('src'))));
});

function renderAttachPreview(form) {
  const box = form.querySelector('[data-attach-preview]');
  if (!box) return;
  box.innerHTML = pendingFiles.map((f, i) => h`
    <span class="att-chip">
      <img src="${f.url}" alt="${esc(f.name)}">
      <button type="button" class="att-x" data-act="tk-att-del" data-i="${i}" aria-label="${t('common.delete')}">${icon('close')}</button>
    </span>`).join('');
}

act('tk-attach-pick', async (e, el) => {
  const form = el.closest('form');
  const files = [...(el.files || [])].slice(0, 4 - pendingFiles.length);
  el.value = '';
  for (const f of files) {
    if (f.size > 4 * 1024 * 1024) { toastError(t('err.tooLarge')); continue; }
    try {
      const dataUrl = await fileToDataURL(f);
      const r = await api.upload(dataUrl);
      pendingFiles.push({ url: r.url, name: f.name });
    } catch (err) { toastApiError(err); }
  }
  renderAttachPreview(form);
});

act('tk-att-del', (e, el) => {
  pendingFiles.splice(Number(el.dataset.i), 1);
  renderAttachPreview(el.closest('form'));
});

// ── ارسال پاسخ ──────────────────────────────────────────────
act('tk-reply', async (e, form) => {
  e.preventDefault();
  const body = String(new FormData(form).get('body') || '').trim();
  if (body.length < 2) { toastError(t('acc.ticketBodyShort')); return; }
  const btn = form.querySelector('button[type=submit]');
  await withBusy(btn, async () => {
    try {
      const r = await api.post(`/api/tickets/${form.dataset.id}/messages`, {
        body, attachments: pendingFiles.map((f) => f.url),
      });
      pendingFiles = [];
      const thread = form.closest('.card').querySelector('[data-tk-thread]');
      if (thread) {
        thread.innerHTML = (r.ticket?.messages || []).map(messageHtml).join('');
        thread.scrollTop = thread.scrollHeight;
      }
      form.reset();
      renderAttachPreview(form);
      toastSuccess(t('common.sent'));
      loadNotifications(true);
    } catch (err) { toastApiError(err); }
  });
});

act('tk-close', async (e, el) => {
  const ok = await confirmDialog({ text: t('acc.ticketCloseConfirm'), okText: t('acc.ticketClose') });
  if (!ok) return;
  await withBusy(el, async () => {
    try {
      await api.post(`/api/tickets/${el.dataset.id}/close`, {});
      toastSuccess(t('common.done'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root, ctx) {
  applyDyn(root);
  const input = root.querySelector('[data-attach-input]');
  if (input) input.addEventListener('change', (e) => { const fn = getAct('tk-attach-pick'); fn?.(e, e.target); });
  const thread = root.querySelector('[data-tk-thread]');
  if (thread) thread.scrollTop = thread.scrollHeight;
  void ctx;
  return null;
}
