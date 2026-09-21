// ─────────────────────────────────────────────────────────────
//  پشتیبانی: تیکت‌ها (فهرست + گفت‌وگو + اولویت/وضعیت)
//  و چت زندهٔ پشتیبانی (پشتیبانی آنلاین)
// ─────────────────────────────────────────────────────────────
import { fmtTel, html as h, icon, esc, fmtNum, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S } from '../../state.mjs';
import { tableHtml, selectField, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy, lightbox } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);
const STATUS_CLASS = { open: 'bp-warn', answered: 'bp-success', closed: 'bp-muted' };
const PRI_CLASS = { critical: 'bp-danger', high: 'bp-warn', normal: 'bp-info', low: 'bp-muted' };
const F = { status: '' };

export async function render(ctx) {
  if (ctx.params.section === 'support') return support(ctx.params.id);
  if (ctx.params.id) return ticketDetail(ctx.params.id);
  return ticketList();
}

// ── فهرست تیکت‌ها ───────────────────────────────────────────
async function ticketList() {
  let r = null;
  try { r = await api.get(api.url('/api/admin/tickets', { status: F.status })); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const items = r.items || [];
  const counts = r.counts || {};

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('ticket')} ${t('adm.tickets')}</h2>
        <p class="muted small">${L('باز', 'Open')}: ${fmtNum(counts.open || 0)} · ${L('بسته', 'Closed')}: ${fmtNum(counts.closed || 0)} · ${L('خوانده‌نشده', 'Unread')}: ${fmtNum(items.filter((x) => x.unread).length)}</p>
      </div>
      <form class="row" data-act="adm-tk-filter" data-live>
        ${selectField({
          label: t('common.status'), name: 'status', value: F.status,
          options: [{ value: '', label: t('common.all') }, { value: 'open', label: t('tk.open') }, { value: 'answered', label: t('tk.answered') }, { value: 'closed', label: t('tk.closed') }],
        })}
      </form>
    </div>

    ${tableHtml(
      [
        { label: t('acc.ticketSubject') }, { label: t('acc.ticketCategory') }, { label: t('common.priority') },
        { label: t('common.user') }, { label: t('common.messages'), cls: 'num' },
        { label: t('common.status') }, { label: t('common.updated'), cls: 'num' }, { label: '', cls: 'num' },
      ],
      items.map((x) => h`
        <tr class="${x.unread ? 'row-new' : ''}">
          <td>
            ${x.unread ? h`<span class="dot-new" title="${L('خوانده‌نشده', 'Unread')}"></span>` : ''}
            <a class="b" href="#/admin/tickets/${x.id}">${esc(x.subject)}</a>
            <div class="tiny muted mono">${esc(x.code)}</div>
            ${x.lastMessage ? h`<div class="tiny muted clip">${esc(x.lastMessage)}</div>` : ''}
          </td>
          <td>${t(`tc.${x.category}`)}</td>
          <td><span class="badge-pill ${PRI_CLASS[x.priority] || 'bp-info'}">${t(`tp.${x.priority}`)}</span></td>
          <td class="tiny">${esc(x.userName || '')}<div class="tiny muted mono">${fmtTel(x.userPhone || '')}</div></td>
          <td class="num">${fmtNum(x.messageCount || 0)}</td>
          <td><span class="badge-pill ${STATUS_CLASS[x.status] || 'bp-muted'}">${t(`tk.${x.status}`)}</span></td>
          <td class="num tiny nowrap">${timeAgo(x.updatedAt || x.createdAt)}</td>
          <td><a class="btn btn-ghost btn-xs" href="#/admin/tickets/${x.id}">${icon('chevron-left')}</a></td>
        </tr>`),
      { emptyText: t('acc.noTickets') },
    )}`;
}

act('adm-tk-filter', (e, form) => {
  e.preventDefault();
  F.status = String(new FormData(form).get('status') || '');
  refresh(true);
});

// ── جزئیات تیکت ─────────────────────────────────────────────
async function ticketDetail(id) {
  let tk = null;
  try { tk = (await api.get(`/api/admin/tickets/${id}`)).ticket; }
  catch (err) {
    return err?.status === 404
      ? emptyState({ icon: 'ticket', title: t('acc.noTickets'), action: { href: '#/admin/tickets', label: t('adm.tickets') } })
      : errorState({ title: err?.message || t('err.generic') });
  }
  const u = tk.user;
  return h`
    <div class="breadcrumb mb-s">
      <a href="#/admin/tickets">${t('adm.tickets')}</a> <span>/</span> <span class="mono">${esc(tk.code)}</span>
    </div>

    <div class="cart-grid">
      <div class="col">
        <div class="card">
          <div class="row row-between row-wrap">
            <div>
              <h2 class="buy-title">${icon('ticket')} ${esc(tk.subject)}</h2>
              <p class="muted small mt-s">
                <span class="mono">${esc(tk.code)}</span> · ${t('acc.ticketCategory')}: ${t(`tc.${tk.category}`)} ·
                ${fmtDate(tk.createdAt)} · ${L('آخرین به‌روزرسانی', 'Updated')}: ${timeAgo(tk.updatedAt || tk.createdAt)}
              </p>
            </div>
            <div class="row row-wrap">
              <span class="badge-pill ${STATUS_CLASS[tk.status] || 'bp-muted'}">${t(`tk.${tk.status}`)}</span>
              <span class="badge-pill ${PRI_CLASS[tk.priority] || 'bp-info'}">${t(`tp.${tk.priority}`)}</span>
            </div>
          </div>
        </div>

        <div class="card mt">
          <strong>${icon('chat')} ${t('common.messages')} (${fmtNum(tk.messages?.length || 0)})</strong>
          <div class="tk-thread mt">
            ${(tk.messages || []).map(messageHtml).join('')}
          </div>
          <form class="mt" data-act="adm-tk-reply" data-id="${tk.id}">
            <label class="field">
              <span class="label">${t('adm.tkReply')}</span>
              <textarea class="textarea" name="body" rows="3" placeholder="${L('پاسخ خود را بنویس…', 'Write your reply…')}"></textarea>
            </label>
            <div class="row row-wrap mt-s">
              <button class="btn btn-primary" type="submit">${icon('send')} ${t('common.send')}</button>
              <select class="select select-sm" name="status">
                <option value="answered">${t('tk.answered')}</option>
                <option value="open">${t('tk.open')}</option>
                <option value="closed">${t('tk.closed')}</option>
              </select>
            </div>
          </form>
        </div>
      </div>

      <aside class="col">
        <div class="card">
          <strong>${icon('user')} ${esc(u?.name || tk.userName || '')}</strong>
          <div class="mt-s">
            <div class="sum-row"><span>${t('common.phone')}</span><span class="v mono">${fmtTel(u?.phone || tk.userPhone || '')}</span></div>
            ${u?.email ? h`<div class="sum-row"><span>${t('common.email')}</span><span class="v tiny">${esc(u.email)}</span></div>` : ''}
            <div class="sum-row"><span>${t('acc.plus')}</span><span class="v">${u?.plus ? h`<span class="badge-pill bp-accent">${t('common.active')}</span>` : h`<span class="muted">—</span>`}</span></div>
            <div class="sum-row"><span>${t('common.orders')}</span><span class="v">${fmtNum(u?.orders || 0)}</span></div>
          </div>
          ${u ? h`<a class="btn btn-ghost btn-sm btn-block mt-s" href="#/admin/users/${u.id}">${icon('edit')} ${L('مدیریت کاربر', 'Manage user')}</a>` : ''}
        </div>

        <div class="card mt">
          <strong>${icon('settings')} ${t('adm.tkManage')}</strong>
          <form class="mt-s" data-act="adm-tk-meta" data-id="${tk.id}">
            <label class="field"><span class="label">${t('common.priority')}</span>
              <select class="select" name="priority">
                ${['critical', 'high', 'normal', 'low'].map((p) => h`<option value="${p}" ${tk.priority === p ? 'selected' : ''}>${t(`tp.${p}`)}</option>`)}
              </select>
            </label>
            <button class="btn btn-outline btn-sm btn-block" type="submit">${t('common.save')}</button>
          </form>
          <div class="row row-wrap mt-s">
            ${tk.status !== 'closed'
              ? h`<button class="btn btn-ghost btn-sm" data-act="adm-tk-status" data-id="${tk.id}" data-status="closed">${icon('check')} ${L('بستن تیکت', 'Close ticket')}</button>`
              : h`<button class="btn btn-ghost btn-sm" data-act="adm-tk-status" data-id="${tk.id}" data-status="open">${icon('refresh')} ${L('بازکردن', 'Reopen')}</button>`}
          </div>
        </div>
      </aside>
    </div>`;
}

function messageHtml(m) {
  const staff = m.from === 'staff';
  const cls = m.from === 'system' ? 'them sys' : staff ? 'me' : 'them';
  const who = staff ? (m.staffName ? `${t('common.support')} · ${m.staffName}` : t('common.support')) : (m.name || t('common.user'));
  return h`
    <div class="msg ${cls}">
      <div class="msg-bubble">
        <div class="row row-between">
          <strong class="tiny">${esc(who)}</strong>
          <span class="tiny muted nowrap">${timeAgo(m.at)}</span>
        </div>
        <div class="msg-text">${esc(m.body || '').replace(/\n/g, '<br>')}</div>
        ${(m.attachments || []).length ? h`<div class="row row-wrap mt-s">${m.attachments.map((a) => h`<img class="tk-att" src="${esc(a)}" alt="${t('common.image')}" loading="lazy" data-act="adm-att-open" data-url="${esc(a)}">`)}</div>` : ''}
      </div>
    </div>`;
}

act('adm-att-open', (e, el) => { e.preventDefault(); lightbox([el.dataset.url], 0, t('common.image')); });

act('adm-tk-reply', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const body = String(fd.get('body') || '').trim();
  if (body.length < 1) return;
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/tickets/${form.dataset.id}`, { body, status: fd.get('status') || 'answered' });
      toastSuccess(t('misc.sent'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

act('adm-tk-meta', async (e, form) => {
  e.preventDefault();
  try {
    await api.patch(`/api/admin/tickets/${form.dataset.id}`, { priority: new FormData(form).get('priority') });
    toastSuccess(t('misc.saved'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});

act('adm-tk-status', async (e, el) => {
  try {
    await api.patch(`/api/admin/tickets/${el.dataset.id}`, { status: el.dataset.status });
    toastSuccess(t('misc.saved'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});

// ── چت پشتیبانی ─────────────────────────────────────────────
let THREADS = [];
async function support(userId) {
  let r = null;
  try { r = await api.get('/api/admin/support'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  THREADS = r.items || [];
  const active = THREADS.find((x) => x.userId === userId) || null;

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('chat')} ${t('adm.support')}</h2>
      <span class="badge-pill bp-info">${fmtNum(THREADS.reduce((a, b) => a + (b.unread || 0), 0))} ${L('خوانده‌نشده', 'unread')}</span>
    </div>

    <div class="sup-grid">
      <div class="card sup-list">
        ${THREADS.length ? THREADS.map((x) => h`
          <a class="sup-item ${active && active.userId === x.userId ? 'active' : ''} ${x.unread ? 'has-new' : ''}" href="#/admin/support/${x.userId}">
            <span class="sup-av">${esc((x.userName || '?').slice(0, 1))}</span>
            <span class="grow">
              <span class="row row-between"><strong class="tiny">${esc(x.userName || '')}</strong><span class="tiny muted nowrap">${timeAgo(x.last?.at)}</span></span>
              <span class="tiny muted clip">${esc(x.last?.body || '')}</span>
            </span>
            ${x.unread ? h`<span class="badge-pill bp-danger">${fmtNum(x.unread)}</span>` : ''}
          </a>`).join('') : h`<p class="muted small">${t('common.noData')}</p>`}
      </div>

      <div class="card sup-chat">
        ${active ? h`
          <div class="row row-between mb-s">
            <strong>${icon('user')} ${esc(active.userName)}</strong>
            <span class="tiny muted">${fmtNum(active.count || 0)} ${t('common.messages')}</span>
          </div>
          <div class="msg-thread sup-thread" data-thread>
            ${(active.messages || []).map(messageHtml).join('')}
          </div>
          <form class="row mt-s" data-act="adm-sup-send" data-id="${active.userId}">
            <input class="input grow" name="body" placeholder="${L('پاسخ سریع…', 'Quick reply…')}" autocomplete="off">
            <button class="btn btn-primary" type="submit">${icon('send')}</button>
          </form>
        ` : emptyState({ icon: 'chat', title: t('adm.supSelect'), text: t('adm.supSelectHint') })}
      </div>
    </div>`;
}

act('adm-sup-send', async (e, form) => {
  e.preventDefault();
  const input = form.querySelector('[name=body]');
  const body = String(input.value || '').trim();
  if (!body) return;
  input.value = '';
  try {
    await api.post(`/api/admin/support/${form.dataset.id}`, { body });
    const box = form.closest('.sup-chat')?.querySelector('[data-thread]');
    if (box) {
      const wrap = document.createElement('div');
      wrap.innerHTML = messageHtml({ from: 'staff', staffName: S.me?.name || '', body, at: new Date().toISOString() }).trim();
      if (wrap.firstElementChild) box.appendChild(wrap.firstElementChild);
      box.scrollTop = box.scrollHeight;
    }
    const item = THREADS.find((x) => x.userId === form.dataset.id);
    if (item) { item.last = { body, at: new Date().toISOString(), from: 'staff' }; item.unread = 0; }
    toastSuccess(t('misc.sent'));
  } catch (err) { toastApiError(err); input.value = body; }
});

export function mount(root, ctx) {
  applyDyn(root);
  if (ctx?.params?.section === 'support' && ctx.params.id) {
    const box = root.querySelector('[data-thread]');
    if (box) box.scrollTop = box.scrollHeight;
  }
  return null;
}
