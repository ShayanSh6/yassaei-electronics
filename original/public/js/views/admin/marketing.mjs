// ─────────────────────────────────────────────────────────────
//  بازاریابی: کدهای تخفیف، بنرهای تبلیغاتی و اعلان‌ها
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { tableHtml, field, selectField, switchField, textareaField, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastError, toastApiError, modal, confirmDelete, withBusy, confirmDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);

// Telegram returns English error codes. Keep the human-facing status RTL-safe,
// while the original diagnostic remains available in an isolated LTR block.
function telegramErrorLabel(raw) {
  const value = String(raw || '');
  if (/\bUnauthorized\b|\b401\b/i.test(value)) {
    return L('توکن ربات نامعتبر است یا در BotFather باطل شده است', 'The bot token is invalid or was revoked in BotFather');
  }
  if (/\bForbidden\b|\b403\b/i.test(value)) {
    return L('ربات اجازهٔ دسترسی به این گفتگو را ندارد', 'The bot is not allowed to access this chat');
  }
  if (/\bToo Many Requests\b|\b429\b/i.test(value)) {
    return L('تلگرام موقتاً محدودیت ارسال اعمال کرده است', 'Telegram temporarily rate-limited the bot');
  }
  if (/\bBad Request\b|\b400\b/i.test(value)) {
    return L('درخواست ارسالی به تلگرام معتبر نیست', 'Telegram rejected the request as invalid');
  }
  return L('ارتباط با تلگرام با خطا روبه‌رو شد', 'Telegram connection error');
}

let COUPONS = [];
let ADS = [];
let SLOTS = [];

export async function render(ctx) {
  const sec = ctx.params.section;
  if (sec === 'ads') return adsView();
  if (sec === 'notifications') return notificationsView();
  if (sec === 'telegram') return telegramView();
  if (sec === 'sms') return smsView();
  if (sec === 'lottery') return lotteryView();
  return couponsView();
}

// ── کدهای تخفیف ─────────────────────────────────────────────
async function couponsView() {
  try { COUPONS = (await api.get('/api/admin/coupons')).items || []; }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const active = COUPONS.filter((c) => c.active !== false && new Date(c.endAt) > new Date()).length;

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('percent')} ${t('adm.coupons')}</h2>
        <p class="muted small">${fmtNum(COUPONS.length)} ${L('کد', 'codes')} · ${fmtNum(active)} ${L('فعال', 'active')}</p>
      </div>
      <button class="btn btn-primary btn-sm" data-act="adm-cp-new">${icon('plus')} ${t('common.add')}</button>
    </div>

    ${tableHtml(
      [
        { label: t('cart.coupon') }, { label: t('common.type') }, { label: t('adm.cpValue'), cls: 'num' },
        { label: t('adm.cpUsage'), cls: 'num' }, { label: t('adm.cpDates') }, { label: t('common.status') }, { label: '', cls: 'num' },
      ],
      COUPONS.map((c) => {
        const expired = new Date(c.endAt) < new Date();
        return h`
        <tr>
          <td><span class="mono b">${esc(c.code)}</span>${c.note ? h`<div class="tiny muted">${esc(c.note)}</div>` : ''}</td>
          <td>${c.type === 'percent' ? t('adm.cpPercent') : t('adm.cpAmount')}</td>
          <td class="num">${c.type === 'percent' ? `${fmtNum(c.value)}٪` : fmtMoney(c.value)}
            ${c.maxDiscount ? h`<div class="tiny muted">${L('سقف', 'max')} ${fmtMoney(c.maxDiscount)}</div>` : ''}
            ${c.minOrder ? h`<div class="tiny muted">${L('حداقل سفارش', 'min order')} ${fmtMoney(c.minOrder)}</div>` : ''}</td>
          <td class="num">${fmtNum(c.used || 0)} / ${fmtNum(c.usageLimit || 0)}<div class="tiny muted">${L('هر کاربر', 'per user')}: ${fmtNum(c.perUser || 1)}</div></td>
          <td class="tiny nowrap">${fmtDate(c.startAt, { time: false })}<div class="tiny muted">${fmtDate(c.endAt, { time: false })}</div></td>
          <td>${expired ? h`<span class="badge-pill bp-muted">${t('adm.cpExpired')}</span>`
            : c.active === false ? h`<span class="badge-pill bp-muted">${t('common.inactive')}</span>`
            : h`<span class="badge-pill bp-success">${t('common.active')}</span>`}</td>
          <td>
            <div class="act">
              <button class="btn btn-ghost btn-xs" data-act="adm-cp-toggle" data-id="${c.id}" title="${t('common.active')}">${icon(c.active === false ? 'eye-off' : 'eye')}</button>
              <button class="btn btn-ghost btn-xs" data-act="adm-cp-edit" data-id="${c.id}">${icon('edit')}</button>
              <button class="btn btn-ghost btn-xs" data-act="adm-cp-copy" data-code="${esc(c.code)}">${icon('copy')}</button>
              <button class="btn btn-ghost btn-xs" data-act="adm-cp-del" data-id="${c.id}" data-name="${esc(c.code)}">${icon('trash')}</button>
            </div>
          </td>
        </tr>`;
      }),
      { emptyText: t('common.noData') },
    )}`;
}

function couponForm(c) {
  return modal({
    title: c ? t('common.edit') : t('adm.cpNew'),
    body: h`
      <form class="form-grid" data-act="adm-cp-save" data-id="${c?.id || ''}" data-isnew="${c ? '' : '1'}">
        ${field({ label: t('cart.coupon'), name: 'code', required: !c, value: c?.code || '', attrs: c ? 'readonly' : '', hint: L('حروف بزرگ انگلیسی و عدد', 'Uppercase letters and digits') })}
        ${selectField({
          label: t('common.type'), name: 'type', value: c?.type || 'percent',
          options: [{ value: 'percent', label: t('adm.cpPercent') }, { value: 'amount', label: t('adm.cpAmount') }],
        })}
        ${field({ label: t('adm.cpValue'), name: 'value', type: 'number', required: true, value: c?.value ?? 10, attrs: 'min="1" max="100000000"' })}
        ${field({ label: L('سقف تخفیف', 'Max discount'), name: 'maxDiscount', type: 'number', value: c?.maxDiscount ?? 0, attrs: 'min="0" max="100000000"' })}
        ${field({ label: L('حداقل مبلغ سفارش', 'Minimum order'), name: 'minOrder', type: 'number', value: c?.minOrder ?? 0, attrs: 'min="0" max="100000000"' })}
        ${field({ label: L('سقف استفادهٔ کل', 'Total usage limit'), name: 'usageLimit', type: 'number', value: c?.usageLimit ?? 100, attrs: 'min="1" max="100000"' })}
        ${field({ label: L('سقف هر کاربر', 'Per user'), name: 'perUser', type: 'number', value: c?.perUser ?? 1, attrs: 'min="1" max="100"' })}
        ${field({ label: t('adm.cpStart'), name: 'startAt', type: 'datetime-local', value: toLocal(c?.startAt) })}
        ${field({ label: t('adm.cpEnd'), name: 'endAt', type: 'datetime-local', value: toLocal(c?.endAt) })}
        <div class="span-2">${field({ label: t('common.note'), name: 'note', value: c?.note || '' })}</div>
        <div class="span-2">${switchField({ label: t('common.active'), name: 'active', checked: c ? c.active !== false : true })}</div>
        <button class="btn btn-primary span-2" type="submit">${t('common.save')}</button>
      </form>`,
  });
}

function toLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

let cpHandle = null;
act('adm-cp-new', () => { cpHandle = couponForm(null); });
act('adm-cp-edit', (e, el) => { cpHandle = couponForm(COUPONS.find((c) => c.id === el.dataset.id)); });
act('adm-cp-toggle', async (e, el) => {
  const c = COUPONS.find((x) => x.id === el.dataset.id);
  if (!c) return;
  try { await api.patch(`/api/admin/coupons/${c.id}`, { active: c.active === false }); refresh(true); }
  catch (err) { toastApiError(err); }
});
act('adm-cp-copy', async (e, el) => {
  try { await navigator.clipboard.writeText(el.dataset.code); toastSuccess(t('misc.copied')); }
  catch { toastSuccess(el.dataset.code); }
});
act('adm-cp-del', async (e, el) => {
  if (!(await confirmDelete(el.dataset.name))) return;
  try { await api.del(`/api/admin/coupons/${el.dataset.id}`); toastSuccess(t('misc.deleted')); refresh(true); }
  catch (err) { toastApiError(err); }
});
act('adm-cp-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const isNew = form.dataset.isnew === '1';
  const payload = {
    type: fd.get('type'), value: Number(fd.get('value') || 0), maxDiscount: Number(fd.get('maxDiscount') || 0),
    minOrder: Number(fd.get('minOrder') || 0), usageLimit: Number(fd.get('usageLimit') || 100),
    perUser: Number(fd.get('perUser') || 1), active: fd.get('active') === 'on', note: fd.get('note') || '',
  };
  if (fd.get('startAt')) payload.startAt = new Date(fd.get('startAt')).toISOString();
  if (fd.get('endAt')) payload.endAt = new Date(fd.get('endAt')).toISOString();
  if (isNew) payload.code = String(fd.get('code') || '').toUpperCase();
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      if (isNew) await api.post('/api/admin/coupons', payload);
      else await api.patch(`/api/admin/coupons/${form.dataset.id}`, payload);
      toastSuccess(t('misc.saved'));
      cpHandle?.close();
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── بنرها / تبلیغات ─────────────────────────────────────────
async function adsView() {
  try {
    const r = await api.get('/api/admin/ads');
    ADS = r.items || []; SLOTS = r.slots || [];
  } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('image')} ${t('adm.ads')}</h2>
        <p class="muted small">${t('adm.adsHint')}</p>
      </div>
      <button class="btn btn-primary btn-sm" data-act="adm-ad-new">${icon('plus')} ${t('common.add')}</button>
    </div>

    ${SLOTS.length ? SLOTS.map((s) => {
      const list = ADS.filter((a) => a.slot === s.id);
      return h`
      <div class="card mb">
        <div class="row row-between">
          <strong>${icon('pin')} ${esc(isFa() ? s.fa : (s.en || s.fa))}</strong>
          <span class="badge-pill bp-muted">${fmtNum(list.length)}</span>
        </div>
        ${list.length ? h`
          <div class="ad-rows mt-s">
            ${list.map((a) => h`
              <div class="ad-row ${a.active === false ? 'off' : ''}">
                ${a.image ? h`<img class="ad-img" src="${esc(a.image)}" alt="" loading="lazy" data-h="54px" data-w="88px">` : h`<span class="ad-img ph" data-h="54px" data-w="88px">${icon('image')}</span>`}
                <div class="grow">
                  <span class="b">${esc(isFa() ? a.title : (a.titleEn || a.title))}</span>
                  <span class="tiny muted">${esc(isFa() ? (a.text || '') : (a.textEn || a.text || ''))}</span>
                  <span class="tiny muted nowrap">${L('از', 'From')} ${fmtDate(a.startAt, { time: false })} ${L('تا', 'to')} ${fmtDate(a.endAt, { time: false })}${a.link ? ` · ${esc(a.link)}` : ''}</span>
                </div>
                <div class="act">
                  <button class="btn btn-ghost btn-xs" data-act="adm-ad-toggle" data-id="${a.id}">${icon(a.active === false ? 'eye-off' : 'eye')}</button>
                  <button class="btn btn-ghost btn-xs" data-act="adm-ad-edit" data-id="${a.id}">${icon('edit')}</button>
                  <button class="btn btn-ghost btn-xs" data-act="adm-ad-del" data-id="${a.id}" data-name="${esc(a.title)}">${icon('trash')}</button>
                </div>
              </div>`).join('')}
          </div>` : h`<p class="muted small mt-s">${t('common.noData')}</p>`}
      </div>`;
    }).join('') : emptyState({ icon: 'image', title: t('common.noData') })}`;
}

function adForm(a) {
  return modal({
    title: a ? t('common.edit') : t('adm.adNew'),
    body: h`
      <form class="form-grid" data-act="adm-ad-save" data-id="${a?.id || ''}" data-isnew="${a ? '' : '1'}">
        <div class="span-2">${selectField({
          label: t('adm.adSlot'), name: 'slot', value: a?.slot || SLOTS[0]?.id || 'home_hero',
          options: SLOTS.map((s) => ({ value: s.id, label: isFa() ? s.fa : (s.en || s.fa) })),
        })}</div>
        ${field({ label: t('common.title'), name: 'title', required: true, value: a?.title || '' })}
        ${field({ label: L('عنوان (انگلیسی)', 'Title (EN)'), name: 'titleEn', value: a?.titleEn || '' })}
        <div class="span-2">${textareaField({ label: t('common.text'), name: 'text', value: a?.text || '', rows: 2 })}</div>
        <div class="span-2">${textareaField({ label: L('متن (انگلیسی)', 'Text (EN)'), name: 'textEn', value: a?.textEn || '', rows: 2 })}</div>
        ${field({ label: t('common.link'), name: 'link', value: a?.link || '', hint: '#/products?cat=cases' })}
        ${field({ label: t('common.image'), name: 'image', value: a?.image || '', hint: '/assets/…' })}
        ${field({ label: L('متن دکمه', 'CTA label'), name: 'cta', value: a?.cta || '' })}
        ${field({ label: L('متن دکمه (انگلیسی)', 'CTA (EN)'), name: 'ctaEn', value: a?.ctaEn || '' })}
        ${field({ label: L('شروع', 'Start'), name: 'startAt', type: 'datetime-local', value: toLocal(a?.startAt) })}
        ${field({ label: L('پایان', 'End'), name: 'endAt', type: 'datetime-local', value: toLocal(a?.endAt) })}
        <div class="span-2">${switchField({ label: t('common.active'), name: 'active', checked: a ? a.active !== false : true })}</div>
        <button class="btn btn-primary span-2" type="submit">${t('common.save')}</button>
      </form>`,
  });
}

let adHandle = null;
act('adm-ad-new', () => { adHandle = adForm(null); });
act('adm-ad-edit', (e, el) => { adHandle = adForm(ADS.find((a) => a.id === el.dataset.id)); });
act('adm-ad-toggle', async (e, el) => {
  const a = ADS.find((x) => x.id === el.dataset.id);
  if (!a) return;
  try { await api.patch(`/api/admin/ads/${a.id}`, { active: a.active === false }); refresh(true); }
  catch (err) { toastApiError(err); }
});
act('adm-ad-del', async (e, el) => {
  if (!(await confirmDelete(el.dataset.name))) return;
  try { await api.del(`/api/admin/ads/${el.dataset.id}`); toastSuccess(t('misc.deleted')); refresh(true); }
  catch (err) { toastApiError(err); }
});
act('adm-ad-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const isNew = form.dataset.isnew === '1';
  const payload = {
    slot: fd.get('slot'), title: fd.get('title'), titleEn: fd.get('titleEn') || '',
    text: fd.get('text') || '', textEn: fd.get('textEn') || '', link: fd.get('link') || '',
    image: fd.get('image') || '', cta: fd.get('cta') || '', ctaEn: fd.get('ctaEn') || '',
    active: fd.get('active') === 'on',
  };
  if (fd.get('startAt')) payload.startAt = new Date(fd.get('startAt')).toISOString();
  if (fd.get('endAt')) payload.endAt = new Date(fd.get('endAt')).toISOString();
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      if (isNew) await api.post('/api/admin/ads', payload);
      else await api.patch(`/api/admin/ads/${form.dataset.id}`, payload);
      toastSuccess(t('misc.saved'));
      adHandle?.close();
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── اعلان‌ها ────────────────────────────────────────────────
async function notificationsView() {
  let r = null;
  try { r = await api.get('/api/admin/notifications'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const items = r.items || [];
  const outbox = r.outbox || [];

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('bell')} ${t('adm.notifications')}</h2>
        <p class="muted small">${t('adm.notifHint')}</p>
      </div>
    </div>

    <div class="cart-grid">
      <div class="col">
        <form class="card" data-act="adm-notif-send">
          <strong>${icon('send')} ${t('adm.notifNew')}</strong>
          <div class="form-grid mt-s">
            ${field({ label: t('common.title'), name: 'title', required: true, attrs: 'maxlength="120"' })}
            ${field({ label: L('عنوان (انگلیسی)', 'Title (EN)'), name: 'titleEn', attrs: 'maxlength="120"' })}
            <div class="span-2">${textareaField({ label: t('common.text'), name: 'body', rows: 3, attrs: 'maxlength="600"' })}</div>
            <div class="span-2">${textareaField({ label: L('متن (انگلیسی)', 'Text (EN)'), name: 'bodyEn', rows: 2 })}</div>
            ${selectField({
              label: t('adm.notifLevel'), name: 'level', value: 'info',
              options: [{ value: 'info', label: t('notif.level.info') }, { value: 'success', label: t('notif.level.success') }, { value: 'warning', label: t('notif.level.warning') }, { value: 'error', label: t('notif.level.error') }],
            })}
            ${selectField({
              label: t('common.type'), name: 'type', value: 'announcement',
              options: [{ value: 'announcement', label: t('notif.type.announcement') }, { value: 'news', label: t('notif.type.news') }, { value: 'offer', label: t('notif.type.offer') }, { value: 'system', label: t('notif.type.system') }],
            })}
            ${field({ label: t('common.link'), name: 'link', hint: '#/products' })}
            ${field({ label: L('شناسهٔ کاربر (خالی = همه)', 'User id (empty = everyone)'), name: 'userId' })}
            <div class="span-2">
              <span class="label">${t('adm.channels')}</span>
              <div class="row row-wrap mt-s">
                <label class="check"><input type="checkbox" name="ch_site" checked><span class="box">${icon('check')}</span><span>${t('adm.chSite')}</span></label>
                <label class="check"><input type="checkbox" name="ch_telegram"><span class="box">${icon('check')}</span><span>${t('adm.chTelegram')}</span></label>
                <label class="check"><input type="checkbox" name="ch_email"><span class="box">${icon('check')}</span><span>${t('adm.chEmail')}</span></label>
                <label class="check"><input type="checkbox" name="ch_sms"><span class="box">${icon('check')}</span><span>${t('adm.chSms')}</span></label>
              </div>
              <p class="hint">${t('adm.channelsHint')}</p>
            </div>
          </div>
          <button class="btn btn-primary mt-s" type="submit">${icon('send')} ${t('common.send')}</button>
        </form>
      </div>

      <aside class="col">
        <div class="card">
          <strong>${icon('history')} ${t('adm.notifRecent')} (${fmtNum(items.length)})</strong>
          <div class="notif-list mt-s">
            ${items.length ? items.slice(0, 40).map((n) => h`
              <div class="notif-item lv-${esc(n.level || 'info')}">
                <div class="row row-between">
                  <strong class="tiny">${esc(isFa() ? n.title : (n.titleEn || n.title))}</strong>
                  <span class="tiny muted nowrap">${timeAgo(n.createdAt)}</span>
                </div>
                ${n.body ? h`<p class="tiny muted">${esc(isFa() ? n.body : (n.bodyEn || n.body))}</p>` : ''}
                <span class="tiny muted mono">${n.userId ? esc(n.userId) : L('همهٔ کاربران', 'All users')}${n.link ? ` · ${esc(n.link)}` : ''}</span>
              </div>`).join('') : h`<p class="muted small">${t('common.noData')}</p>`}
          </div>
        </div>
        ${outbox.length ? h`
        <div class="card mt">
          <strong>${icon('mail')} ${L('صف ارسال پیامک/ایمیل', 'SMS / email outbox')} (${fmtNum(outbox.length)})</strong>
          <div class="mt-s">
            ${outbox.map((o) => h`<div class="sum-row"><span class="tiny mono">${esc(o.to || o.target || '')}</span><span class="v tiny">${esc(String(o.body || o.text || '').slice(0, 60))}</span></div>`).join('')}
          </div>
        </div>` : ''}
      </aside>
    </div>`;
}

act('adm-notif-send', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {
    title: String(fd.get('title') || '').trim(),
    titleEn: String(fd.get('titleEn') || '').trim(),
    body: String(fd.get('body') || '').trim(),
    bodyEn: String(fd.get('bodyEn') || '').trim(),
    level: fd.get('level'), type: fd.get('type'),
    link: String(fd.get('link') || '').trim(),
    userId: String(fd.get('userId') || '').trim(),
    channels: ['site', 'telegram', 'email', 'sms'].filter((c) => fd.get(`ch_${c}`)),
  };
  if (payload.title.length < 3) return;
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      const r = await api.post('/api/admin/notifications', payload);
      const res = r.results || {};
      const extra = Object.entries(res).map(([k, v]) => `${k}: ${v.error ? '✗' : `✓${v.ok ?? ''}`}`).join(' ');
      toastSuccess(extra ? `${t('misc.sent')} — ${extra}` : t('misc.sent'), { timeout: 4200 });
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}

// ── بات تلگرام ──────────────────────────────────────────────
async function telegramView() {
  let r = null;
  try { r = await api.get('/api/admin/telegram'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const technicalError = r.lastPingOk === false ? String(r.lastError || '').trim() : '';
  const botStatus = !r.enabled
    ? h`<span class="badge-pill bp-muted">${L('غیرفعال', 'Disabled')}</span>`
    : !r.tokenSet
      ? h`<span class="badge-pill bp-danger">${L('توکن ربات پیدا نشد', 'Bot token not found')}</span>`
      : technicalError
        ? h`<span class="badge-pill bp-danger">${telegramErrorLabel(technicalError)}</span>`
        : h`<span class="badge-pill bp-success">${L('فعال و سالم؛ برای اطمینان پینگ بگیر', 'Active and healthy; run a ping to verify')}</span>`;
  const connectionMode = r.webhook?.ok
    ? h`<span class="badge-pill bp-info">${L('وب‌هوک', 'Webhook')} ✔</span>`
    : h`<span class="badge-pill bp-violet">${L('پولینگ', 'Polling')}</span>`;
  return h`
    <div class="cart-grid">
      <div class="col">
        <form class="card" data-act="adm-tg-save">
          <strong>${icon('send')} ${t('adm.telegram')}</strong>
          <p class="muted small mt-s">${t('adm.tgHint')}</p>
          <div class="form-grid mt-s">
            <div class="span-2">${switchField({ label: t('adm.tgEnabled'), name: 'enabled', checked: !!r.enabled })}</div>
            <div class="span-2">${field({ label: t('adm.tgToken'), name: 'token', hint: t('adm.tgTokenHint'), type: 'password', value: r.token || '', autocomplete: 'off' })}</div>
            <div class="span-2">${field({ label: L('چت‌های مدیر (اعلان سفارش جدید)', 'Admin chat IDs (order alerts)'), name: 'adminChats', value: r.adminChats || '', hint: L('تا ۵ شناسهٔ چت عددی تلگرام، جداشده با کاما (مثلاً: 12345678, 87654321)', 'Up to 5 numeric chat IDs separated by comma') })}</div>
            <div class="span-2">${textareaField({ label: t('adm.tgWelcome'), name: 'welcome', rows: 2, value: r.welcome || '' })}</div>
          </div>
          <button class="btn btn-primary mt-s" type="submit">${icon('check')} ${t('common.save')}</button>
        </form>
        <form class="card mt" data-act="adm-tg-test">
          <strong>${icon('zap')} ${t('adm.tgTest')}</strong>
          <p class="hint mt-s">${t('adm.tgPingHint')}</p>
          <div class="row mt-s row-wrap">
            <input class="input" name="chatId" placeholder="${t('adm.tgChatOptional')}" inputmode="numeric">
            <button class="btn btn-ghost" type="submit">${t('adm.tgPing')}</button>
          </div>
        </form>
      </div>
      <aside class="col">
        <div class="card">
          <strong>${icon('chat')} ${t('adm.tgInbox')} (${fmtNum(r.inbox?.length || 0)}) · ${t('adm.tgSubs')}: ${fmtNum(r.subs || 0)}</strong>
          <p class="tiny muted mt-s tg-status" dir="${isFa() ? 'rtl' : 'ltr'}">
            <span>${L('وضعیت اتصال ربات:', 'Bot status:')}</span>
            ${botStatus}
            ${technicalError ? h`<span class="tg-status-error">
              <span class="badge-pill bp-danger">${L('خطای فنی', 'Technical error')}</span>
              <div dir="ltr" class="mono">${technicalError.slice(0, 240)}</div>
            </span>` : ''}
            <span>${L('حالت اتصال:', 'Mode:')}</span>
            ${connectionMode}
            ${r.lastPoll ? h`<span>${L('آخرین بررسی:', 'Last poll:')} <bdi dir="ltr">${timeAgo(r.lastPoll)}</bdi></span>` : ''}
          </p>
          <div class="notif-list mt-s">
            ${(r.inbox || []).slice(0, 30).map((m) => h`
              <div class="notif-item lv-info">
                <div class="row row-between">
                  <div>
                    <strong class="tiny">${esc(m.name)}</strong>
                    <span class="tiny muted mono" title="${L('شناسهٔ چت', 'Chat ID')}">(${esc(m.chatId)})</span>
                  </div>
                  <span class="tiny muted">${timeAgo(m.at)}</span>
                </div>
                <p class="tiny mt-s">${esc(m.text)}</p>
                <form class="row mt-s" data-act="adm-tg-reply" data-chat="${esc(m.chatId)}">
                  <input class="input" name="text" placeholder="${t('adm.tgReplyPh')}" required>
                  <button class="btn btn-ghost btn-sm" type="submit">${icon('send')}</button>
                </form>
              </div>`) }
            ${!(r.inbox || []).length ? h`<p class="muted small">${t('adm.tgInboxEmpty')}</p>` : ''}
          </div>
        </div>
      </aside>
    </div>`;
}
act('adm-tg-save', async (e, form) => {
  e.preventDefault();
  const payload = { enabled: !!form.enabled?.checked };
  if (form.token?.value) payload.token = form.token.value;
  if (form.welcome !== undefined) payload.welcome = form.welcome.value;
  if (form.adminChats !== undefined) payload.adminChats = form.adminChats.value;
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try { await api.post('/api/admin/telegram', payload); toastSuccess(t('common.saved')); refresh(true); }
    catch (err) { toastApiError(err); }
  });
});
act('adm-tg-test', async (e, form) => {
  e.preventDefault();
  try { await api.post('/api/admin/telegram/test', { chatId: form.chatId.value }); toastSuccess(t('misc.sent')); }
  catch (err) { toastApiError(err); }
});
act('adm-tg-reply', async (e, form) => {
  e.preventDefault();
  try { await api.post('/api/admin/telegram/reply', { chatId: form.dataset.chat, text: form.text.value }); toastSuccess(t('misc.sent')); form.text.value = ''; }
  catch (err) { toastApiError(err); }
});

// ── قرعه‌کشی ────────────────────────────────────────────────
async function lotteryView() {
  let r = null;
  try { r = await api.get('/api/admin/lotteries'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  return h`
    <div class="cart-grid">
      <div class="col">
        <form class="card" data-act="adm-lot-create">
          <strong>${icon('gift2')} ${t('adm.lotteryNew')}</strong>
          <div class="form-grid mt-s">
            ${field({ label: t('common.title'), name: 'title', required: true })}
            ${field({ label: t('adm.lotPrize'), name: 'prize', required: true })}
            ${field({ label: t('adm.lotEnds'), name: 'endsAt', type: 'datetime-local', required: true })}
            ${field({ label: t('adm.lotWinners'), name: 'winnersCount', type: 'number', value: '1' })}
            <div class="span-2">${selectField({ label: t('adm.lotMode'), name: 'entryMode', options: [{ value: 'orders', label: t('adm.lotModeOrders') }, { value: 'manual', label: t('adm.lotModeManual') }] })}</div>
          </div>
          <button class="btn btn-primary mt-s" type="submit">${icon('plus')} ${t('common.create')}</button>
        </form>
      </div>
      <aside class="col">
        <div class="card">
          <strong>${icon('gift2')} ${t('adm.lottery')} (${fmtNum(r.items?.length || 0)})</strong>
          <div class="notif-list mt-s">
            ${(r.items || []).map((l) => h`
              <div class="notif-item lv-${l.status === 'drawn' ? 'success' : l.status === 'active' ? 'info' : 'warning'}">
                <div class="row row-between"><strong class="tiny">${esc(l.title)}</strong><span class="tiny muted">${l.status}</span></div>
                <p class="tiny mt-s">${t('adm.lotPrize')}: ${esc(l.prize)} · ${t('adm.lotEntries')}: ${fmtNum(l.entries || 0)} · ${t('adm.lotEnds')}: ${esc(l.endsAt || '')}</p>
                ${l.winners?.length ? h`<p class="tiny mt-s b">${t('adm.lotWinnersList')}: ${l.winners.map((w) => esc(w.name)).join('، ')}</p>` : ''}
                ${l.status === 'active' ? h`<div class="row mt-s">
                  <button class="btn btn-primary btn-sm" data-act="adm-lot-run" data-id="${l.id}">${icon('sparkles')} ${t('adm.lotRun')}</button>
                  <button class="btn btn-ghost btn-sm" data-act="adm-lot-close" data-id="${l.id}">${icon('close')} ${t('adm.lotClose')}</button>
                </div>` : ''}
              </div>`)}
            ${!(r.items || []).length ? h`<p class="muted small">${t('adm.lotEmpty')}</p>` : ''}
          </div>
        </div>
      </aside>
    </div>`;
}
act('adm-lot-create', async (e, form) => {
  e.preventDefault();
  const endsAt = new Date(form.endsAt.value).toISOString();
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/admin/lotteries', { title: form.title.value, prize: form.prize.value, endsAt, winnersCount: Number(form.winnersCount.value || 1), entryMode: form.entryMode.value });
      toastSuccess(t('common.saved')); refresh(true);
    } catch (err) { toastApiError(err); }
  });
});
act('adm-lot-run', async (e, el) => {
  const ok = await confirmDialog({ text: t('adm.lotRunWarn'), danger: true });
  if (!ok) return;
  await withBusy(el, async () => {
    try {
      const r = await api.post(`/api/admin/lotteries/${el.dataset.id}/run`, {});
      const winners = (r.lottery?.winners || []).map((w) => w.name).join('، ');
      import('../../ui.mjs').then(({ fireConfetti, adaptive }) => {
        const div = document.createElement('div');
        div.innerHTML = '<div class="t-center" style="padding:40px 0;"><h1 class="slot-machine" style="font-size:32px; color:var(--accent); font-weight:800;">???</h1><p class="muted mt-s">در حال انتخاب برنده خوش‌شانس...</p></div>';
        const m = adaptive({
          title: 'در حال قرعه‌کشی...',
          body: div
        });
        const slot = m.panel.querySelector('.slot-machine');
        let ticks = 0;
        const iv = setInterval(() => {
          slot.textContent = '09' + Math.floor(100000000 + Math.random()*900000000); // looks like phone number
          ticks++;
          if (ticks > 25) {
            clearInterval(iv);
            slot.textContent = winners || 'بدون برنده!';
            fireConfetti();
            setTimeout(() => { m.close(); refresh(true); }, 5000);
          }
        }, 120);
      });
    }
    catch (err) { toastApiError(err); }
  });
});
act('adm-lot-close', async (e, el) => {
  await withBusy(el, async () => {
    try { await api.post(`/api/admin/lotteries/${el.dataset.id}/close`, {}); toastSuccess(t('adm.lotClosed')); refresh(true); }
    catch (err) { toastApiError(err); }
  });
});


// ── پیامک انبوه (SMS Marketing) ──────────────────────────────────
async function smsView() {
  return h`
    <div class="card mb-l">
      <h3>${icon('message-square')} کمپین‌های پیامکی (بازگشت مشتریان)</h3>
      <p class="muted small mb">ارسال پیامک انبوه هوشمند به کاربران سایت برای ترغیب به خرید مجدد. (نیازمند تنظیم API پیامک در تنظیمات)</p>
      
      <form class="f-col gap-15 mt" data-act="sms-send">
        <label class="field"><span class="label">جامعه هدف (گیرندگان)</span>
          <select class="input" name="audience">
            <option value="all">همه کاربران ثبت‌نام شده دارای شماره موبایل</option>
            <option value="inactive_30">کاربرانی که ۳۰ روز است لاگین نکرده‌اند</option>
            <option value="abandoned">کاربرانی که سبد خرید رها شده دارند</option>
          </select>
        </label>
        
        <label class="field"><span class="label">متن پیامک</span>
          <textarea class="input" name="message" rows="4" placeholder="مثال: سلام! دلمون برات تنگ شده. با کد تخفیف COMEBACK تا آخر هفته با ۲۰٪ تخفیف از یاسایی خرید کن."></textarea>
        </label>
        
        <div>
          <button type="submit" class="btn btn-primary">${icon('send')} ارسال کمپین پیامکی</button>
        </div>
      </form>
    </div>
  `;
}

act('sms-send', async (e, form) => {
  e.preventDefault();
  const audience = form.audience.value;
  const message = form.message.value;
  if (!message.trim()) return toastError('متن پیامک نمی‌تواند خالی باشد.');
  
  const okd = await confirmDialog({
    title: 'ارسال پیامک انبوه',
    text: 'آیا از ارسال این پیامک انبوه اطمینان دارید؟ هزینه آن از پنل پیامکی شما کسر می‌شود.',
    okText: 'ارسال شود',
    danger: true,
    icon: 'send',
  });
  if (!okd) return;
  
  await withBusy(form.querySelector('button'), async () => {
    try {
      const res = await api.post('/api/admin/marketing/sms/bulk', { audience, message });
      toastSuccess(`ارسال به ${res.count} کاربر با موفقیت در صف قرار گرفت!`);
      form.reset();
    } catch (err) {
      toastApiError(err);
    }
  });
});
