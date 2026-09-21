// ─────────────────────────────────────────────────────────────
//  حساب کاربری: داشبورد، سفارش‌ها، کیف پول، پلاس، آدرس‌ها، اعلان‌ها،
//  تیکت‌ها، پشتیبانی، نظرات من، بازخورد، پروفایل، امنیت، ترجیحات، داده‌ها
// ─────────────────────────────────────────────────────────────
import { fmtTel, html as h, raw, icon, esc, fmtNum, fmtMoney, fmtDate, timeAgo, applyDyn, stars } from '../lib/dom.mjs';
import { t, lang, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import {
  S, feat, isPlus, plusCfg, refreshMe, loadNotifications, markNotificationsRead,
  deleteNotification, kycCfg, accountNav, navEntry, kycVisible,
} from '../state.mjs';
import { kycRuleText } from '../lib/kyc.mjs';
import { navIconHtml, navDisabledHtml, navDisabledText } from '../lib/nav.mjs';
import {
  productGrid, emptyState, statusBadge, tableHtml, field, textareaField,
  selectField, checkField, switchField, captchaField,
} from '../components.mjs';
import { toastSuccess, toastError, toastApiError, modal, confirmDialog, confirmDelete, withBusy, promptDialog } from '../ui.mjs';
import { act } from '../actions.mjs';
import { navigate, refresh } from '../router.mjs';
import { threadHtml, loadThread, clearChatUnread } from '../chat.mjs';

export async function render(ctx) {
  const sec = ctx.params.section || '';
  // ── دکمه‌های پنل کاربری از «مدیریت منوها» خوانده می‌شوند ──────────
  // (تنظیمات پنل مدیریت ← تنظیمات ← منوها و بخش‌ها · settings.nav.account)
  // اگر مدیر چیزی تغییر نداده باشد، همان پیش‌فرض‌های nav.mjs نمایش داده می‌شود.
  const nav = accountNav().map((it) => ({
    key: it.id,
    id: it.path,
    href: it.href,
    icon: it.icon,
    emoji: it.emoji,
    label: () => it.label(),
    on: it.on !== false,
  }));
  const body = await sectionHtml(sec, ctx);
  return h`
    <div class="section-head"><div>
      <h1 class="section-title">${icon('user')} ${t('acc.title')}</h1>
      <p class="section-sub">${t('acc.hello', { name: esc(S.me?.name || S.me?.username || '') })} · ${t('acc.memberSince', { date: fmtDate(S.me?.createdAt, { time: false }) })}</p>
    </div></div>
    <div class="acc-grid">
      <aside class="acc-side">
        <div class="acc-user">
          <span class="av">${esc((S.me?.name || S.me?.username || '?').charAt(0))}</span>
          <div class="grow">
            <div class="b nowrap">${esc(S.me?.name || S.me?.username)}</div>
            <div class="tiny muted">${S.me?.role === 'owner' ? t('common.admin') : S.me?.role === 'staff' ? 'کارمند' : t('common.user')}</div>
          </div>
        </div>
        <nav class="acc-nav" aria-label="${t('acc.title')}">
          ${nav.map((s) => h`<a href="${s.href}" class="${s.id === sec ? 'active' : ''}" data-acc-key="${s.key}" title="${s.label()}"${s.on ? '' : ' data-nav-off="1"'}>${navIconHtml(s)} ${s.label()}${s.id === 'notifications' && S.unread ? h`<span class="cnt">${fmtNum(S.unread)}</span>` : ''}</a>`)}
        </nav>
      </aside>
      <div data-accbody>${body}</div>
    </div>`;
}

async function sectionHtml(sec, ctx) {
  // بخشی که مدیر آن را «غیرفعال» کرده باشد، پیام محترمانه نشان می‌دهد
  // (دکمهٔ آن همچنان در فهرست می‌ماند تا کاربر گم نشود).
  const key = sec === '' ? 'dashboard' : sec;
  const entry = navEntry('account', key);
  const kycItem = navEntry('account', 'kyc');
  if (entry && entry.on === false) return raw(navDisabledHtml({ title: `${navDisabledText()} (${entry.label()})` }));
  if (sec === 'kyc' && (!kycVisible() || (kycItem && kycItem.on === false))) {
    return raw(navDisabledHtml({ title: navDisabledText() }));
  }
  switch (sec) {
    case 'orders': return ordersHtml();
    case 'wishlist': return wishlistHtml();
    case 'wallet': return walletHtml();
    case 'plus': return plusHtml();
    case 'addresses': return addressesHtml();
    case 'notifications': return notificationsHtml();
    case 'tickets': return ticketsHtml();
    case 'support': return supportHtml();
    case 'reviews': return reviewsHtml();
    case 'feedback': return feedbackHtml();
    
    case 'referrals': return referralsHtml();
    case 'profile': return profileHtml();
    
    case 'kyc':
      return kycHtml();
    case 'security': return securityHtml();
    case 'prefs': return prefsHtml();
    case 'data': return dataHtml();
    default: return dashboardHtml();
  }
}

// ── داشبورد ─────────────────────────────────────────────────
async function dashboardHtml() {
  let orders = [];
  try { orders = (await api.get('/api/me/orders')).items || []; } catch { /* noop */ }
  const recent = orders.slice(0, 4);
  return h`
    <div class="stats-grid mb">
      <div class="stat-card"><span class="stat-ic">${icon('package-check')}</span><div><div class="stat-val">${fmtNum(orders.length)}</div><div class="stat-lbl">${t('acc.orders')}</div></div></div>
      ${feat('wallet') ? h`<div class="stat-card"><span class="stat-ic">${icon('wallet')}</span><div><div class="stat-val">${fmtNum(S.me?.wallet?.balance || 0)}</div><div class="stat-lbl">${t('common.balance')}</div></div></div>` : ''}
      <div class="stat-card"><span class="stat-ic">${icon('heart')}</span><div><div class="stat-val">${fmtNum(S.wishlist.length)}</div><div class="stat-lbl">${t('acc.wishlist')}</div></div></div>
      <div class="stat-card"><span class="stat-ic">${icon('gift')}</span><div><div class="stat-val">${fmtNum(S.me?.points || 0)}</div><div class="stat-lbl">${t('common.points')}</div></div></div>
    </div>
    ${(() => {
      const badges = S.me?.badges || [];
      const got = badges.filter((b) => b.got).length;
      if (!badges.length) return '';
      return h`<div class="card mb">
        <div class="row row-between"><strong>${icon('award')} ${t('acc.badges')}</strong><span class="muted tiny">${fmtNum(got)} / ${fmtNum(badges.length)}</span></div>
        <div class="badges-grid mt-s">
          ${badges.map((b) => h`
            <div class="badge-item ${b.got ? 'got' : ''}" title="${t(`badge.${b.id}.d`)}">
              <span class="bi-ic">${icon(b.got ? 'award' : 'lock')}</span>
              <b>${t(`badge.${b.id}`)}</b>
              <span class="tiny muted">${b.got ? t('badge.got') : (b.progress !== undefined ? `${fmtNum(b.progress)}×` : t('badge.locked'))}</span>
            </div>`) }
        </div>
      </div>`;
    })()}
    ${isPlus() ? h`<div class="notice notice-success mb">${icon('sparkles')}<span>${t('acc.plusActive', { date: fmtDate(S.me?.plus?.until, { time: false }) })}</span></div>`
      : feat('plus') ? h`<div class="notice notice-info mb">${icon('sparkles')}<span>${t('acc.plusInactive')} — <a class="section-link" href="#/account/plus">${t('acc.plusSubscribe')}</a></span></div>` : ''}
    ${orders.length ? h`
      <div class="section-head"><div><h2 class="section-title">${icon('history')} ${t('acc.orders')}</h2></div><a class="section-link" href="#/account/orders">${t('common.showAll')}</a></div>
      ${orderRows(recent)}` : emptyState({ icon: 'cart', title: t('acc.noOrders'), text: t('acc.noOrdersText'), action: { href: '#/products', label: t('cart.goShopping') } })}
    ${S.me?.referralCode && feat('referrals') ? h`
      <div class="card mt">
        <strong>${icon('gift')} ${t('acc.referralCode')}</strong>
        <div class="row mt-s">
          <code class="tag mono b" data-h="34px">${S.me.referralCode}</code>
          <button class="btn btn-ghost btn-sm" data-act="copy" data-text="${S.me.referralCode}">${icon('copy')} ${t('common.copy')}</button>
        </div>
        <p class="hint mt-s">${t('acc.referralText')}</p>
      </div>` : ''}`;
}

function orderRows(orders) {
  return tableHtml(
    [{ label: t('acc.orderCode') }, { label: t('acc.orderDate') }, { label: t('common.status') }, { label: t('acc.orderTotal'), cls: 'num' }, { label: t('common.actions'), cls: 'num' }],
    orders.map((o) => h`
      <tr>
        <td class="mono b">${o.code}</td>
        <td class="nowrap">${fmtDate(o.createdAt, { time: false })}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="num">${fmtMoney(o.total)}</td>
        <td><div class="act"><a class="btn btn-ghost btn-xs" href="#/account/orders/${o.id}">${t('common.view')}</a></div></td>
      </tr>`),
  );
}

// ── سفارش‌ها ────────────────────────────────────────────────
async function ordersHtml() {
  let items = [];
  try { items = (await api.get('/api/me/orders')).items || []; } catch { /* noop */ }
  if (!items.length) return emptyState({ icon: 'package-check', title: t('acc.noOrders'), text: t('acc.noOrdersText'), action: { href: '#/products', label: t('cart.goShopping') } });
  return orderRows(items);
}

// ── لیست من ─────────────────────────────────────────────────
async function wishlistHtml() {
  if (!S.wishlist.length) return emptyState({ icon: 'heart', title: t('acc.wishlistEmpty'), text: t('acc.wishlistEmptyText'), action: { href: '#/products', label: t('cart.goShopping') } });
  const r = await api.get('/api/products?limit=96').catch(() => null);
  const items = S.wishlist.map((id) => r?.items?.find((p) => p.id === id)).filter(Boolean);
  return productGrid(items);
}

// ── کیف پول ─────────────────────────────────────────────────
async function walletHtml() {
  if (!feat('wallet')) return emptyState({ icon: 'wallet', title: t('err.notFound') });
  let w = { balance: 0, transactions: [] };
  try { w = await api.get('/api/me/wallet'); } catch { /* noop */ }
  return h`
    <div class="card mb">
      <div class="row row-between row-wrap">
        <div><div class="muted small">${t('common.balance')}</div><div class="buy-now">${fmtMoney(w.balance)}</div></div>
        <button class="btn btn-primary" data-act="wallet-deposit">${icon('plus')} ${t('acc.walletDeposit')}</button>
      </div>
      <p class="hint mt-s">${t('acc.walletNote')}</p>
    </div>
    ${tableHtml(
      [{ label: t('common.date') }, { label: t('common.type') }, { label: t('common.amount'), cls: 'num' }, { label: t('common.note') }],
      (w.transactions || []).map((x) => h`
        <tr>
          <td class="nowrap">${fmtDate(x.at)}</td>
          <td><span class="badge-pill ${x.amount >= 0 ? 'bp-success' : 'bp-warn'}">${t(`acc.tx.${x.type}`) || x.type}</span></td>
          <td class="num b">${x.amount >= 0 ? '+' : ''}${fmtNum(x.amount)}</td>
          <td class="muted small">${esc(x.note || '')} ${x.ref ? h`<button class="link-btn mono" data-act="copy" data-text="${x.ref}">${x.ref}</button>` : ''}</td>
        </tr>`),
      { emptyText: t('acc.walletEmpty') },
    )}`;
}

act('wallet-deposit', () => {
  const handle = modal({
    title: t('acc.walletDeposit'),
    size: 'sm',
    body: h`
      <form data-act="wallet-deposit-do">
        <p class="notice notice-warn mb">${icon('info')}<span>${t('checkout.gatewayDemo')}</span></p>
        ${field({ label: t('acc.walletAmount'), name: 'amount', type: 'number', required: true, value: '100000', attrs: 'min="10000" step="10000"' })}
        <div class="row row-wrap mb">
          ${[100000, 200000, 500000, 1000000].map((v) => h`<button type="button" class="chip" data-amt="${v}">${fmtNum(v)}</button>`)}
        </div>
        <button class="btn btn-primary btn-block" type="submit">${icon('card')} ${t('common.deposit')}</button>
      </form>`,
    onMount: (panel, handle) => {
      panel.querySelectorAll('[data-amt]').forEach((b) => b.addEventListener('click', () => { panel.querySelector('[name=amount]').value = b.dataset.amt; }));
    },
  });
  void handle;
});
act('wallet-deposit-do', async (e, form) => {
  e.preventDefault();
  const amount = Number(new FormData(form).get('amount') || 0);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/me/wallet/deposit', { amount });
      await refreshMe();
      toastSuccess(t('acc.walletDeposited'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── پلاس ────────────────────────────────────────────────────
function plusHtml() {
  if (!feat('plus')) return emptyState({ icon: 'sparkles', title: t('err.notFound') });
  const p = plusCfg();
  const active = isPlus();
  return h`
    <div class="card mb t-center">
      <span class="pwa-ic center" data-h="60px" data-w="60px">${icon('sparkles')}</span>
      <h2 class="mt-s">${active ? t('acc.plusActive', { date: fmtDate(S.me?.plus?.until, { time: false }) }) : t('acc.plusInactive')}</h2>
      <p class="buy-price center"><span class="buy-now">${fmtMoney(p.price)}</span><span class="buy-cur">/ ${fmtNum(p.durationDays)} ${t('common.day')}</span></p>
      <div class="row center row-wrap">
        <button class="btn btn-primary" data-act="plus-buy" data-method="wallet" ${feat('wallet') ? '' : 'hidden'}>${icon('wallet')} ${t('acc.plusPayWallet')}</button>
        <button class="btn btn-ghost" data-act="plus-buy" data-method="gateway">${icon('card')} ${t('acc.plusPayGateway')}</button>
      </div>
      <p class="hint mt-s">${t('checkout.gatewayDemo')}</p>
    </div>
    <div class="section-head"><div><h2 class="section-title">${icon('gift')} ${t('acc.plusPerks')}</h2></div></div>
    <div class="pwa-grid">
      ${(p.perks || []).map((perk) => h`<div class="pwa-card"><span class="pwa-ic">${icon('check')}</span><div>${isFa() ? perk.fa : perk.en}</div></div>`)}
    </div>`;
}
act('plus-buy', async (e, el) => {
  await withBusy(el, async () => {
    try {
      await api.post('/api/me/plus/subscribe', { method: el.dataset.method });
      await refreshMe();
      toastSuccess(t('acc.plusSubscribed'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── آدرس‌ها ─────────────────────────────────────────────────
function addressesHtml() {
  const list = S.me?.addresses || [];
  return h`
    <div class="row row-between mb">
      <strong>${t('acc.addresses')} (${fmtNum(list.length)})</strong>
      <button class="btn btn-primary btn-sm" data-act="addr-new">${icon('plus')} ${t('acc.addAddress')}</button>
    </div>
    ${list.length ? h`<div class="pwa-grid">${list.map((a) => h`
      <div class="card">
        <div class="row row-between">
          <strong>${esc(a.title || '')}</strong>
          ${a.isDefault ? h`<span class="badge-pill bp-accent">${t('acc.addrDefault')}</span>` : ''}
        </div>
        <p class="muted small mt-s">${esc(a.receiver || '')} · ${fmtTel(a.phone || '')}<br>${esc(a.street || '')}${a.city ? `، ${esc(a.city)}` : ''}${a.postal ? `<br>${t('common.postal')}: ${esc(a.postal)}` : ''}</p>
        ${a.note ? h`<p class="hint">${esc(a.note)}</p>` : ''}
        <div class="row mt-s">
          <button class="btn btn-ghost btn-xs" data-act="addr-edit" data-id="${a.id}">${icon('edit')} ${t('common.edit')}</button>
          <button class="btn btn-ghost btn-xs" data-act="addr-del" data-id="${a.id}">${icon('trash')} ${t('common.delete')}</button>
          ${!a.isDefault ? h`<button class="btn btn-ghost btn-xs" data-act="addr-default" data-id="${a.id}">${icon('check')} ${t('acc.addrDefault')}</button>` : ''}
        </div>
      </div>`)}</div>` : emptyState({ icon: 'pin', title: t('acc.noAddress') })}`;
}

function addressForm(a = null) {
  return modal({
    title: a ? t('acc.editAddress') : t('acc.addAddress'),
    body: h`
      <form data-act="addr-save2" class="form-grid" data-id="${a?.id || ''}">
        ${field({ label: t('acc.addrTitle'), name: 'title', required: true, value: a?.title || '' })}
        ${field({ label: t('acc.addrReceiver'), name: 'receiver', required: true, value: a?.receiver || S.me?.name || '' })}
        ${field({ label: t('acc.addrPhone'), name: 'phone', type: 'tel', required: true, value: a?.phone || S.me?.phone || '' })}
        ${field({ label: t('common.city'), name: 'city', value: a?.city || '' })}
        ${field({ label: t('common.postal'), name: 'postal', value: a?.postal || '' })}
        ${field({ label: t('acc.addrStreet'), name: 'street', required: true, span2: true, value: a?.street || '' })}
        ${field({ label: t('acc.addrNote'), name: 'note', span2: true, value: a?.note || '' })}
        <label class="check span-2"><input type="checkbox" name="isDefault" ${a?.isDefault ? 'checked' : ''}><span class="box">${icon('check')}</span><span>${t('acc.addrDefault')}</span></label>
        <button class="btn btn-primary span-2" type="submit">${t('common.save')}</button>
      </form>`,
  });
}
let addrHandle2 = null;
act('addr-new', () => { addrHandle2 = addressForm(null); });
act('addr-edit', (e, el) => {
  const a = (S.me?.addresses || []).find((x) => x.id === el.dataset.id);
  if (a) addrHandle2 = addressForm(a);
});
act('addr-del', async (e, el) => {
  const ok = await confirmDelete();
  if (!ok) return;
  try {
    const r = await api.del(`/api/me/addresses/${el.dataset.id}`);
    if (S.me) S.me.addresses = r.addresses;
    toastSuccess(t('acc.addrDeleted'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});
act('addr-default', async (e, el) => {
  const a = (S.me?.addresses || []).find((x) => x.id === el.dataset.id);
  try {
    const r = await api.patch(`/api/me/addresses/${el.dataset.id}`, { ...a, isDefault: true });
    if (S.me) S.me.addresses = r.addresses;
    toastSuccess(t('acc.addrSaved'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});
act('addr-save2', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.isDefault = fd.get('isDefault') === 'on';
  const id = form.dataset.id;
  try {
    const r = id
      ? await api.patch(`/api/me/addresses/${id}`, payload)
      : await api.post('/api/me/addresses', payload);
    if (S.me) S.me.addresses = r.addresses;
    toastSuccess(t('acc.addrSaved'));
    addrHandle2?.close();
    refresh(true);
  } catch (err) { toastApiError(err); }
});

// ── اعلان‌ها ────────────────────────────────────────────────
async function notificationsHtml() {
  await loadNotifications(true);
  const list = S.notifications;
  return h`
    <div class="row row-between mb">
      <strong>${t('common.notifications')} (${fmtNum(list.length)})</strong>
      <button class="btn btn-ghost btn-sm" data-act="notif-read-all">${icon('check')} ${t('acc.markAllRead')}</button>
    </div>
    ${list.length ? h`<div class="col">${list.map((n) => h`
      <div class="card ${n.read ? '' : 'notif-unread'}">
        <div class="row row-between">
          <strong class="row">${icon(notifIcon(n.type))} ${esc(isFa() ? n.title : (n.titleEn || n.title))}</strong>
          <span class="muted tiny nowrap">${timeAgo(n.createdAt)}</span>
        </div>
        ${n.body ? h`<p class="muted small mt-s">${esc(isFa() ? n.body : (n.bodyEn || n.body))}</p>` : ''}
        <div class="row mt-s">
          ${n.link ? h`<a class="btn btn-ghost btn-xs" href="${n.link}">${t('common.view')}</a>` : ''}
          ${!n.read ? h`<button class="btn btn-ghost btn-xs" data-act="notif-read" data-id="${n.id}">${t('notif.markRead')}</button>` : ''}
          <button class="btn btn-ghost btn-xs" data-act="notif-del" data-id="${n.id}">${icon('trash')}</button>
        </div>
      </div>`)}</div>` : emptyState({ icon: 'bell', title: t('acc.notifEmpty') })}`;
}
function notifIcon(type) {
  return { order: 'package-check', restock: 'box', ticket: 'ticket', support: 'headset', review: 'star', plus: 'sparkles', wallet: 'wallet', account: 'user', feedback: 'flag', admin_alert: 'alert', offer: 'percent', welcome: 'heart' }[type] || 'bell';
}
act('notif-read-all', async () => { await markNotificationsRead([], true); refresh(true); });
act('notif-read', async (e, el) => { await markNotificationsRead([el.dataset.id]); refresh(true); });
act('notif-del', async (e, el) => { await deleteNotification(el.dataset.id); refresh(true); });

// ── تیکت‌ها ─────────────────────────────────────────────────
async function ticketsHtml() {
  let items = [];
  try { items = (await api.get('/api/tickets')).items || []; } catch { /* noop */ }
  return h`
    <div class="row row-between mb">
      <strong>${t('common.tickets')} (${fmtNum(items.length)})</strong>
      <button class="btn btn-primary btn-sm" data-act="ticket-new">${icon('plus')} ${t('acc.ticketNew')}</button>
    </div>
    ${items.length ? tableHtml(
      [{ label: t('acc.orderCode') }, { label: t('acc.ticketSubject') }, { label: t('common.status') }, { label: t('common.priority') }, { label: t('common.date') }, { label: '' }],
      items.map((x) => h`
        <tr>
          <td class="mono">${x.code}</td>
          <td class="nowrap">${esc(x.subject)}</td>
          <td><span class="badge-pill ${x.status === 'closed' ? 'bp-muted' : x.status === 'answered' ? 'bp-success' : 'bp-warn'}">${t(`tk.${x.status}`)}</span></td>
          <td>${t(`tp.${x.priority}`)}</td>
          <td class="nowrap">${fmtDate(x.createdAt, { time: false })}</td>
          <td><a class="btn btn-ghost btn-xs" href="#/account/tickets/${x.id}">${t('common.view')}${x.unread ? h` <span class="badge-pill bp-danger">${fmtNum(x.messageCount)}</span>` : ''}</a></td>
        </tr>`),
    ) : emptyState({ icon: 'ticket', title: t('acc.noTickets') })}`;
}

let ticketHandle = null;
act('ticket-new', () => {
  const cats = S.ticketCategories || [];
  const pris = S.ticketPriorities || [];
  ticketHandle = modal({
    title: t('acc.ticketNew'),
    body: h`
      <form data-act="ticket-create">
        ${field({ label: t('acc.ticketSubject'), name: 'subject', required: true })}
        <div class="form-grid">
          ${selectField({ label: t('acc.ticketCategory'), name: 'category', required: true, options: cats.map((c) => ({ value: c.id || c, label: t(`tc.${c.id || c}`) })) })}
          ${selectField({ label: t('acc.ticketPriority'), name: 'priority', options: pris.map((pp) => ({ value: pp.id || pp, label: t(`tp.${pp.id || pp}`) })), value: 'normal' })}
        </div>
        ${textareaField({ label: t('acc.ticketBody'), name: 'body', required: true, rows: 5 })}
        <div class="mb">${checkField({ label: h`${t('acc.ticketRules')} <a class="section-link" href="#/pages/ticketRules">${t('acc.ticketViewRules')}</a>`, name: 'rules', required: true })}</div>
        <button class="btn btn-primary btn-block" type="submit">${t('common.submit')}</button>
      </form>`,
  });
});
act('ticket-create', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (fd.get('rules') !== 'on') { toastError(t('form.rulesRequired')); return; }
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api.post('/api/tickets', { subject: fd.get('subject'), category: fd.get('category'), priority: fd.get('priority'), body: fd.get('body'), rulesAccepted: true });
      toastSuccess(t('acc.ticketCreated', { code: r.ticket?.code || '' }));
      ticketHandle?.close();
      navigate(`#/account/tickets/${r.ticket?.id || ''}`);
    } catch (err) { toastApiError(err); }
  });
});

// ── پشتیبانی (چت) ───────────────────────────────────────────
async function supportHtml() {
  if (!feat('liveSupport')) return emptyState({ icon: 'headset', title: t('err.notFound') });
  let items = [];
  try { items = await loadThread(); } catch { /* noop */ }
  clearChatUnread();
  return h`
    <div class="card">
      <div class="row row-between mb-s">
        <strong>${icon('headset')} ${t('acc.chatTitle')}</strong>
        <a class="btn btn-ghost btn-xs" href="#/account/tickets">${icon('ticket')} ${t('acc.chatOpenTicket')}</a>
      </div>
      <div class="chat-b" data-thread-page data-h="340px">${threadHtml(items)}</div>
      <form class="chat-f mt-s" data-act="chat-send">
        <input class="input" name="body" maxlength="1000" placeholder="${t('acc.chatPlaceholder')}" autocomplete="off">
        <button type="submit" class="btn btn-primary btn-icon" aria-label="${t('common.send')}">${icon('send')}</button>
      </form>
    </div>`;
}

// ── نظرات من / بازخورد ──────────────────────────────────────
async function exportData() {
  const r = await api.get('/api/me/export');
  return r.data;
}
async function reviewsHtml() {
  let data = null;
  try { data = await exportData(); } catch { /* noop */ }
  const list = data?.reviews || [];
  if (!list.length) return emptyState({ icon: 'star', title: t('acc.reviewEmpty') });
  return h`<div class="col">${list.map((r) => h`
    <div class="card">
      <div class="row row-between">
        <strong>${esc(r.productName || r.productId)}</strong>
        <span class="badge-pill ${r.status === 'approved' ? 'bp-success' : r.status === 'rejected' ? 'bp-danger' : 'bp-warn'}">${t(`common.${r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'}`)}</span>
      </div>
      <div class="row row-wrap mt-s">${r.rating ? stars(r.rating) : ''}<span class="muted tiny">${fmtDate(r.createdAt, { time: false })}</span><span class="badge-pill bp-muted">${r.type === 'question' ? t('common.question') : t('common.review')}</span></div>
      <div class="rev-title mt-s">${esc(r.title)}</div>
      <div class="rev-body">${esc(r.body)}</div>
      ${r.reply ? h`<div class="rev-reply"><strong>${t('pdp.storeReply')}:</strong> ${esc(r.reply)}</div>` : ''}
    </div>`)}</div>`;
}
async function feedbackHtml() {
  let data = null;
  try { data = await exportData(); } catch { /* noop */ }
  const list = data?.feedback || [];
  return h`
    <div class="row row-between mb">
      <strong>${t('acc.feedback')}</strong>
      <button class="btn btn-primary btn-sm" data-act="feedback-new">${icon('plus')} ${t('acc.feedbackNew')}</button>
    </div>
    ${list.length ? h`<div class="col">${list.map((f) => h`
      <div class="card">
        <div class="row row-between">
          <span class="badge-pill ${f.type === 'bug' ? 'bp-danger' : f.type === 'complaint' ? 'bp-warn' : 'bp-info'}">${t(`ft.${f.type}`)}</span>
          <span class="badge-pill bp-muted">${t(`fs.${f.status}`)}</span>
        </div>
        <div class="rev-title mt-s">${esc(f.title)}</div>
        <div class="rev-body">${esc(f.body)}</div>
        ${f.response ? h`<div class="rev-reply">${esc(f.response)}</div>` : ''}
        <div class="muted tiny mt-s">${fmtDate(f.createdAt)}</div>
      </div>`)}</div>` : emptyState({ icon: 'flag', title: t('acc.noFeedback') })}`;
}
let fbHandle = null;
act('feedback-new', () => {
  fbHandle = modal({
    title: t('acc.feedbackNew'),
    body: h`
      <form data-act="feedback-send">
        ${selectField({ label: t('acc.feedbackType'), name: 'type', options: ['suggestion', 'complaint', 'bug'].map((x) => ({ value: x, label: t(`ft.${x}`) })), value: 'suggestion' })}
        ${field({ label: t('common.title'), name: 'title', required: true })}
        ${textareaField({ label: t('common.body'), name: 'body', required: true, rows: 5 })}
        ${field({ label: t('acc.feedbackContact'), name: 'contact', hint: t('acc.feedbackContactHint'), value: S.me?.phone || S.me?.email || '' })}
        ${S.me ? '' : captchaField()}
        <button class="btn btn-primary btn-block" type="submit">${t('common.submit')}</button>
      </form>`,
  });
});
act('feedback-send', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/feedback', { type: fd.get('type'), title: fd.get('title'), body: fd.get('body'), contact: fd.get('contact') || '', captchaToken: fd.get('captchaToken') || undefined });
      toastSuccess(t('acc.feedbackSent'));
      fbHandle?.close();
      refresh(true);
    } catch (err) {
      if (err?.code === 'captcha_required') { const b = form.querySelector('[data-captcha]'); if (b) { b.hidden = false; } }
      toastApiError(err);
    }
  });
});

// ── پروفایل ─────────────────────────────────────────────────
function profileHtml() {
  const me = S.me;
  return h`
    <form class="card form-grid" data-act="profile-save">
      ${field({ label: t('common.fullName'), name: 'name', required: true, value: me?.name || '' })}
      ${field({ label: 'Name (EN)', name: 'nameEn', value: me?.nameEn || '' })}
      ${field({ label: t('common.username'), name: 'username', value: me?.username || '', attrs: 'disabled' })}
      ${field({ label: t('common.phone'), name: 'phone', type: 'tel', value: me?.phone || '' })}
      ${field({ label: t('common.email'), name: 'email', type: 'email', value: me?.email || '' })}
      <div class="span-2 row">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
      </div>
    </form>`;
}
act('profile-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api.patch('/api/me', { name: fd.get('name'), nameEn: fd.get('nameEn'), phone: fd.get('phone'), email: fd.get('email') });
      S.me = r.me;
      toastSuccess(t('acc.profileSaved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── امنیت ───────────────────────────────────────────────────
async function securityHtml() {
  let two = null;
  let sessions = [];
  try { two = await api.get('/api/me/2fa'); } catch { /* noop */ }
  try { sessions = (await api.get('/api/me/sessions')).items || []; } catch { /* noop */ }
  return h`
    <div class="card mb">
      <strong>${icon('key')} ${t('acc.passwordChange')}</strong>
      <form class="form-grid mt-s" data-act="pass-change">
        ${field({ label: t('acc.currentPassword'), name: 'current', type: 'password', required: true, autocomplete: 'current-password' })}
        ${field({ label: t('acc.newPassword2'), name: 'next', type: 'password', required: true, hint: t('auth.passwordRules'), autocomplete: 'new-password' })}
        ${field({ label: t('common.passwordConfirm'), name: 'confirm', type: 'password', required: true, autocomplete: 'new-password' })}
        <div class="span-2"><button class="btn btn-primary" type="submit">${t('common.save')}</button></div>
      </form>
    </div>

    ${feat('twoFactor') ? h`
    <div class="card mb">
      <div class="row row-between">
        <strong>${icon('shield')} ${t('acc.2faSection')}</strong>
        <span class="badge-pill ${two?.enabled ? 'bp-success' : 'bp-muted'}">${two?.enabled ? t('acc.2faOn') : t('acc.2faOff')}</span>
      </div>
      <div class="mt-s" data-2fa-box>
        ${two?.enabled ? h`
          <p class="muted small">${t('acc.2faMethods')}: ${(two.methods || []).map((m) => t(`auth.2fa${m === 'totp' ? 'Totp' : m === 'sms' ? 'Sms' : 'Email'}`)).join('، ')}</p>
          ${two.backupCodes?.length ? h`<details class="mt-s"><summary class="link-btn">${t('acc.2faBackup')}</summary><p class="hint">${t('acc.2faBackupHint')}</p><div class="row row-wrap">${two.backupCodes.map((c) => h`<code class="tag mono">${c}</code>`)}</div></details>` : ''}
          <button class="btn btn-danger btn-sm mt" data-act="2fa-disable">${icon('close')} ${t('acc.2faDisable')}</button>`
        : h`
          <p class="muted small">${t('acc.2faOff')}</p>
          <button class="btn btn-primary btn-sm mt-s" data-act="2fa-setup">${icon('shield')} ${t('acc.2faEnable')}</button>`}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="row row-between">
        <strong>${icon('users')} ${t('acc.sessions')}</strong>
        <button class="btn btn-ghost btn-sm" data-act="sessions-revoke">${icon('logout')} ${t('acc.revokeAll')}</button>
      </div>
      <p class="muted small mt-s">${t('acc.sessionsText')}</p>
      ${tableHtml(
        [{ label: t('acc.current') }, { label: 'IP' }, { label: t('common.date') }, { label: '' }],
        sessions.map((s) => h`
          <tr>
            <td>${s.current ? h`<span class="badge-pill bp-success">${t('acc.current')}</span>` : h`<span class="muted tiny">${esc((s.ua || '').slice(0, 40))}</span>`}</td>
            <td class="mono small">${esc(s.ip || '')}</td>
            <td class="nowrap small">${fmtDate(s.lastSeenAt || s.createdAt)}</td>
            <td>${!s.current ? h`<button class="btn btn-ghost btn-xs" data-act="session-revoke" data-id="${s.id}">${icon('trash')}</button>` : ''}</td>
          </tr>`),
      )}
    </div>`;
}
act('pass-change', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (fd.get('next') !== fd.get('confirm')) { toastError(lang() === 'fa' ? 'تکرار رمز یکسان نیست.' : 'Passwords do not match.'); return; }
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/me/password', { current: fd.get('current'), next: fd.get('next') });
      toastSuccess(t('acc.passwordChanged'));
      form.reset();
    } catch (err) { toastApiError(err); }
  });
});

async function loadQrLib() {
  if (window.qrcode) return window.qrcode;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/js/vendor/qrcode-generator.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.qrcode;
}

act('2fa-setup', async () => {
  try {
    const two = await api.get('/api/me/2fa');
    modal({
      title: t('acc.2faEnable'),
      body: h`
        <div data-2fa-setup>
          <p class="muted small">${t('acc.2faScan')}</p>
          <div class="center mt-s" data-qr></div>
          <p class="hint t-center mono" data-key>${two.secret || ''}</p>
          <div class="btn-group mt-s" data-methods>
            <button type="button" class="btn active" data-mm="totp">${t('auth.2faTotp')}</button>
            <button type="button" class="btn" data-mm="sms" ${two.hasPhone ? '' : 'disabled'}>${t('auth.2faSms')}</button>
            <button type="button" class="btn" data-mm="email" ${two.hasEmail ? '' : 'disabled'}>${t('auth.2faEmail')}</button>
          </div>
          <form data-act="2fa-enable" class="mt">
            ${field({ label: t('acc.2faEnterCode'), name: 'code', attrs: 'inputmode="numeric" maxlength="6"' })}
            <button class="btn btn-primary btn-block" type="submit">${t('common.confirm')}</button>
          </form>
        </div>`,
      onMount: async (panel) => {
        try {
          const qrc = await loadQrLib();
          const qr = qrc(0, 'M');
          qr.addData(two.otpauth);
          qr.make();
          const box = panel.querySelector('[data-qr]');
          const svg = qr.createSvgTag({ cellSize: 4, margin: 2 });
          box.innerHTML = svg;
          const svgEl = box.querySelector('svg');
          if (svgEl) { svgEl.setAttribute('width', '180'); svgEl.setAttribute('height', '180'); svgEl.classList.add('qr-img'); }
        } catch { panel.querySelector('[data-qr]').innerHTML = h`<code class="tag mono">${two.otpauth}</code>`; }
        panel.querySelector('[data-methods]').addEventListener('click', (e) => {
          const b = e.target.closest('[data-mm]');
          if (!b) return;
          panel.querySelectorAll('[data-mm]').forEach((x) => x.classList.toggle('active', x === b));
          panel.querySelector('[name=code]').closest('.field').hidden = b.dataset.mm !== 'totp';
        });
      },
    });
  } catch (err) { toastApiError(err); }
});
act('2fa-enable', async (e, form) => {
  const method = form.closest('[data-2fa-setup]').querySelector('[data-mm].active')?.dataset.mm || 'totp';
  const code = new FormData(form).get('code') || '';
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api.post('/api/me/2fa/enable', { method, code });
      await refreshMe();
      toastSuccess(t('acc.2faEnabled'));
      if (r.backupCodes?.length) {
        modal({
          title: t('acc.2faBackup'),
          size: 'sm',
          body: h`<p class="hint">${t('acc.2faBackupHint')}</p><div class="row row-wrap mt-s">${r.backupCodes.map((c) => h`<code class="tag mono b">${c}</code>`)}</div>`,
        });
      }
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});
act('2fa-disable', async () => {
  const password = await promptDialog({ title: t('acc.2faDisable'), label: t('common.password'), type: 'password', required: true });
  if (password === null) return;
  try {
    await api.post('/api/me/2fa/disable', { password });
    await refreshMe();
    toastSuccess(t('acc.2faDisabled'));
    refresh(true);
  } catch (err) { toastApiError(err); }
});
act('sessions-revoke', async () => {
  const ok = await confirmDialog({ text: t('acc.revokeAll'), danger: true });
  if (!ok) return;
  try { await api.post('/api/me/sessions/revoke', { allOthers: true }); toastSuccess(t('acc.revokeDone')); refresh(true); }
  catch (err) { toastApiError(err); }
});
act('session-revoke', async (e, el) => {
  try { await api.post('/api/me/sessions/revoke', { id: el.dataset.id }); toastSuccess(t('acc.revokeDone')); refresh(true); }
  catch (err) { toastApiError(err); }
});

// ── ترجیحات ─────────────────────────────────────────────────
function prefsHtml() {
  const p = S.prefs;
  const np = S.me?.notificationsPrefs || {};
  return h`
    <div class="card mb">
      <strong>${icon('settings')} ${t('acc.prefs')}</strong>
      <p class="muted small mt-s">${t('acc.prefsText')}</p>
      <div class="form-grid mt">
        ${selectField({ label: t('acc.prefTheme'), name: 'theme', value: p.theme, options: [{ value: 'dark', label: t('theme.dark') }, { value: 'light', label: t('theme.light') }, { value: 'auto', label: t('theme.auto') }] })}
        ${selectField({ label: t('acc.prefLang'), name: 'locale', value: p.locale, options: [{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }] })}
        ${selectField({ label: t('acc.prefDensity'), name: 'density', value: p.density, options: [{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'comfy', label: 'Comfy' }] })}
      </div>
      ${switchField({ label: t('acc.prefMotion'), desc: lang() === 'fa' ? 'خاموش کردن انیمیشن‌ها برای راحتی چشم' : 'Turn animations off', name: 'reduceMotion', checked: !!p.reduceMotion })}
    </div>
    <div class="card">
      <strong>${icon('bell')} ${t('acc.prefNotif')}</strong>
      <form data-act="notif-prefs" class="mt-s">
        ${switchField({ label: t('acc.notifMarketing'), name: 'marketing', checked: !!np.marketing })}
        ${switchField({ label: t('acc.notifOrders'), name: 'orders', checked: np.orders !== false })}
        ${switchField({ label: t('acc.notifRestock'), name: 'restock', checked: np.restock !== false })}
        ${switchField({ label: t('acc.notifSupport'), name: 'support', checked: np.support !== false })}
        <button class="btn btn-primary mt" type="submit">${t('common.save')}</button>
      </form>
    </div>`;
}
act('notif-prefs', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  try {
    const r = await api.patch('/api/me', {
      notificationsPrefs: { marketing: fd.get('marketing') === 'on', orders: fd.get('orders') === 'on', restock: fd.get('restock') === 'on', support: fd.get('support') === 'on' },
    });
    S.me = r.me;
    toastSuccess(t('misc.saved'));
  } catch (err) { toastApiError(err); }
});

// ── داده‌ها ─────────────────────────────────────────────────
function dataHtml() {
  return h`
    <div class="card mb">
      <strong>${icon('download')} ${t('acc.exportData')}</strong>
      <p class="muted small mt-s">${t('acc.exportHint')}</p>
      <button class="btn btn-primary mt-s" data-act="data-export">${icon('download')} ${t('common.download')}</button>
    </div>
    <div class="card">
      <strong class="danger-text">${icon('alert')} ${t('acc.deleteAccount')}</strong>
      <p class="muted small mt-s">${t('acc.deleteWarn')}</p>
      <button class="btn btn-danger mt-s" data-act="data-delete">${icon('trash')} ${t('acc.deleteAccount')}</button>
    </div>`;
}
act('data-export', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yassaei-electronics-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toastSuccess(t('common.download'));
    } catch (err) { toastApiError(err); }
  });
});
act('data-delete', async () => {
  const ok = await confirmDialog({ title: t('acc.deleteAccount'), text: t('acc.deleteWarn'), danger: true, okText: t('common.delete') });
  if (!ok) return;
  const password = await promptDialog({ title: t('acc.deleteConfirm'), label: t('common.password'), type: 'password', required: true });
  if (password === null) return;
  try {
    await api.post('/api/me/delete', { password });
    S.me = null;
    navigate('#/');
    refresh();
  } catch (err) { toastApiError(err); }
});

// ── مانت ────────────────────────────────────────────────────
export function mount(root, ctx) {
  applyDyn(root);
  void ctx;
  return null;
}

export const title = (ctx) => t('acc.title');


// فرم رسمی تعهدنامه و احراز هویت فروشگاه یاسایی (فارسی، قابل چاپ)
export const KYC_FORM_URL = '/assets/docs/yassaei-kyc.pdf';
export const KYC_FORM_NAME = 'yassaei-kyc.pdf';
// استایل «دانلود کنید» (لینک درون‌متنی) — قرمز و کاملاً چشمگیر
const KYC_DL_STYLE = 'color:#dc2626 !important;font-weight:800;text-decoration:underline;';
// استایل دکمهٔ دانلود: پس‌زمینهٔ قرمز + متن سفید و کاملاً خوانا
// (رفع باگ: قبلاً رنگ متن قرمز بود و روی پس‌زمینهٔ قرمز دیده نمی‌شد)
// با !important نوشته می‌شود تا از استایل‌های عمومی دکمه‌ها جلو بزند.
export const KYC_BTN_STYLE = 'background:#dc2626 !important;color:#ffffff !important;font-weight:800;font-size:14px;padding:10px 20px;border-radius:8px;border:none;display:inline-flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer;';

/** لینک قرمز دانلود فرم تعهدنامه (درون متن راهنما) */
function kycDownloadLink(label = 'دانلود کنید') {
  return h`<a class="kyc-dl" href="${KYC_FORM_URL}" target="_blank" rel="noopener" download="${KYC_FORM_NAME}" style="${KYC_DL_STYLE}">${icon('download')} ${label}</a>`;
}

/** دکمهٔ قرمز و بزرگ دانلود فرم (متن سفید روی زمینهٔ قرمز — همیشه خوانا) */
function kycDownloadButton() {
  return h`<a class="btn kyc-dl-btn" href="${KYC_FORM_URL}" target="_blank" rel="noopener" download="${KYC_FORM_NAME}"
    style="${KYC_BTN_STYLE}">📥 دانلود فرم تعهدنامه و احراز هویت (PDF)</a>`;
}

async function kycHtml() {
  const isApproved = S.me.kycStatus === 'approved';
  const isPending = S.me.kycStatus === 'pending';
  const isRejected = S.me.kycStatus === 'rejected';
  const kyc = kycCfg();
  const ruleNote = kycRuleText(kyc, { fa: isFa() });

  if (isApproved) {
    return h`
      <div class="card kyc-state">
        <span class="kyc-emoji" style="color:var(--success)" aria-hidden="true">✅</span>
        <h3 class="section-title mt">${icon('shield-check')} احراز هویت تأیید شده است</h3>
        <p class="muted mt-s">شما می‌توانید بدون محدودیت از تمامی خدمات، خرید اقساطی و ثبت سفارش استفاده کنید.</p>
        <div class="mt">${kycDownloadButton()}</div>
      </div>
    `;
  }

  if (isPending) {
    return h`
      <div class="card kyc-state">
        <span class="kyc-emoji" aria-hidden="true">⏳</span>
        <h3 class="section-title mt">${icon('shield-check')} در حال بررسی مدارک</h3>
        <p class="muted mt-s">مدارک شما دریافت شده و در صف بررسی توسط کارشناسان یاسایی الکترونیک قرار دارد. لطفاً شکیبا باشید.</p>
        ${S.me.kycMessage ? h`<p class="muted tiny mt-s">${esc(S.me.kycMessage)}</p>` : ''}
        <div class="mt">${kycDownloadButton()}</div>
      </div>
    `;
  }

  return h`
    <div class="card">
      <h3 class="section-title mb">${icon('shield-check')} تکمیل احراز هویت (KYC)</h3>
      ${isRejected ? h`<div class="notice notice-danger mb">${icon('x-circle')}<span>مدارک قبلی شما به دلیل نقص یا ناخوانا بودن رد شد. لطفاً دوباره ارسال کنید.${S.me.kycMessage ? h`<br><span class="tiny">${esc(S.me.kycMessage)}</span>` : ''}</span></div>` : ''}
      <div class="notice notice-info mb">${icon('info')}<span>${esc(ruleNote)}</span></div>
      <p class="muted mb"><strong>توجه:</strong> حداکثر حجم مجاز برای هر فایل ۲ مگابایت است.<br>با تأیید مدارک، امکان استفاده از <strong>خرید اقساطی (اسنپ‌پی، ازکی‌وام، دیجی‌پی)</strong>، شرکت در <strong>قرعه‌کشی‌ها</strong> و دریافت <strong>کدهای تخفیف ویژه</strong> برای شما فعال می‌شود.</p>

      <div class="row row-wrap mb">
        ${kycDownloadButton()}
        <a class="btn btn-ghost" href="${KYC_FORM_URL}" target="_blank" rel="noopener">${icon('eye')} پیش‌نمایش فرم</a>
      </div>

      <div class="notice notice-warn mb">${icon('file')}<span>
        <strong>راهنمای بارگذاری مدارک:</strong>
        <ol class="kyc-steps mt-s">
          <li>فرم تعهدنامهٔ رسمی یاسایی را ${kycDownloadLink('دانلود کنید')}، پرینت گرفته و امضا کنید (یا به صورت دیجیتال پر کنید).</li>
          <li>یک عکس واضح از کارت ملی یا شناسنامه خود بگیرید.</li>
          <li>یک عکس سلفی در حالی که کارت ملی و فرم تعهدنامه را در دست دارید بگیرید.</li>
        </ol>
      </span></div>

      <form class="col" data-act="kyc-submit">
        <label class="field">
          <span class="label">عکس سلفی (همراه با کارت ملی و فرم)</span>
          <input class="input" type="file" name="selfie" accept="image/*" required>
        </label>
        <label class="field">
          <span class="label">عکس کارت ملی یا شناسنامه</span>
          <input class="input" type="file" name="idCard" accept="image/*" required>
        </label>
        <label class="field">
          <span class="label">فرم امضا شدهٔ تعهدنامه (PDF یا عکس)</span>
          <input class="input" type="file" name="formDoc" accept="image/*,.pdf" required>
        </label>
        <p class="hint">اگر هنوز فرم را پر نکرده‌اید، از اینجا ${kycDownloadLink('دانلود کنید')}.</p>
        <button type="submit" class="btn btn-primary mt-s">${icon('upload')} ارسال مدارک</button>
      </form>
    </div>
  `;
}


function referralsHtml() {
  const refCode = S.me?.referralCode || S.me?.id?.substring(0, 6).toUpperCase();
  const refLink = window.location.origin + '#/auth?ref=' + refCode;
  
  return h`
    <div class="card box pad">
      <h3 class="mb-4">${icon('users')} دعوت از دوستان (Referral)</h3>
      <p class="text-muted mb-4">با دعوت از دوستان خود هم به آن‌ها هدیه بدهید و هم خودتان پاداش بگیرید!</p>
      
      <div class="grid gap-3 mb-4">
        <div class="box pad" style="background: var(--surface-2); border-radius: var(--radius);">
          <div class="muted mb-2">کد معرف شما:</div>
          <div class="row row-between">
            <h2 class="mono m-0">${refCode}</h2>
            <button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${refCode}'); import('../ui.mjs').then(m => m.toastSuccess('کد کپی شد'))">${icon('copy')} کپی کد</button>
          </div>
        </div>
        <div class="box pad" style="background: var(--surface-2); border-radius: var(--radius);">
          <div class="muted mb-2">لینک دعوت اختصاصی:</div>
          <div class="row row-between gap-2">
            <input readonly value="${refLink}" class="input flex-1" style="font-size: 0.85rem;" dir="ltr">
            <button class="btn btn-ghost" onclick="navigator.clipboard.writeText('${refLink}'); import('../ui.mjs').then(m => m.toastSuccess('لینک کپی شد'))">${icon('copy')}</button>
          </div>
        </div>
      </div>
      
      <div class="stats-grid mb-4">
        <div class="stat-card">
          <span class="stat-ic" style="color:var(--info)">${icon('users')}</span>
          <div><div class="stat-val">${S.me?.referralCount || 0}</div><div class="stat-lbl">دوستان دعوت‌شده</div></div>
        </div>
        <div class="stat-card">
          <span class="stat-ic" style="color:var(--success)">${icon('gift')}</span>
          <div><div class="stat-val">${(S.me?.referralCount || 0) * 10}</div><div class="stat-lbl">امتیاز دریافتی</div></div>
        </div>
      </div>
      
      <div class="alert info">
        <h4 class="mb-2">${icon('info')} پاداش‌ها (به‌زودی بر اساس قوانین سایت):</h4>
        <ul class="mb-0" style="padding-right: 20px;">
          <li>دعوت از هر نفر (ثبت‌نام موفق): <strong>تخفیف روی سبد خرید بعدی یا ارسال رایگان</strong></li>
          <li>دعوت از بیش از ۱۰ نفر: <strong>دریافت جایزه ویژه وفاداری</strong></li>
        </ul>
      </div>
    </div>
  `;
}

// ارسال مدارک احراز هویت (سلفی + کارت ملی + فرم تعهدنامهٔ امضاشده)
act('kyc-submit', async (e, form) => {
  e.preventDefault();
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const upload = async (file) => {
        if (!file) return null;
        const res = await api.post('/api/upload', { data: await readAsDataUrl(file) });
        return res.url;
      };

      const selfie = await upload(form.selfie?.files?.[0]);
      const idCard = await upload(form.idCard?.files?.[0]);
      const formDoc = await upload(form.formDoc?.files?.[0]);

      await api.post('/api/user/kyc', { selfie, idCard, formDoc });
      toastSuccess('مدارک شما ارسال شد و در صف بررسی کارشناسان یاسایی قرار گرفت.');
      await refreshMe().catch(() => {});
      refresh(true);
    } catch (err) {
      toastApiError(err);
    }
  });
});

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
    reader.readAsDataURL(file);
  });
}
