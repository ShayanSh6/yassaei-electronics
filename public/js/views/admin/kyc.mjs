// ─────────────────────────────────────────────────────────────
//  پنل بررسی احراز هویت (KYC)
//  فهرست متمرکز همهٔ درخواست‌ها + پیش‌نمایش مدارک + تأیید/رد سریع
//  مسیر: #/admin/kyc
// ─────────────────────────────────────────────────────────────
import { fmtTel, html as h, raw, icon, esc, fmtNum, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { tableHtml, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy, lightbox, promptDialog, confirmDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);
const KYC_FORM_URL = '/assets/docs/yassaei-kyc.pdf';

// تب‌های فیلتر: همه / در انتظار بررسی / تأیید شده / رد شده
const TABS = [
  { id: '', label: () => L('همه', 'All'), cls: 'bp-info' },
  { id: 'pending', label: () => L('در انتظار بررسی', 'Pending review'), cls: 'bp-warn' },
  { id: 'approved', label: () => L('تأیید شده', 'Approved'), cls: 'bp-success' },
  { id: 'rejected', label: () => L('رد شده', 'Rejected'), cls: 'bp-danger' },
];

const STATUS_META = {
  pending: { cls: 'bp-warn', ic: 'clock', label: () => L('در انتظار بررسی', 'Pending') },
  approved: { cls: 'bp-success', ic: 'check-circle', label: () => L('تأیید شده', 'Approved') },
  rejected: { cls: 'bp-danger', ic: 'x-circle', label: () => L('رد شده', 'Rejected') },
  none: { cls: 'bp-muted', ic: 'shield', label: () => L('ارسال نشده', 'Not submitted') },
};

const F = { status: '', q: '' };
let CACHE = [];
let COUNTS = { all: 0, pending: 0, approved: 0, rejected: 0 };
let RULE = { required: false, condition: 'disabled', minAmount: 0 };
let RULE_LABEL = '';

export async function render(ctx) {
  let r = null;
  try {
    r = await api.get(api.url('/api/admin/kyc', { status: F.status, q: F.q }));
  } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }

  CACHE = r.items || [];
  COUNTS = r.counts || COUNTS;
  RULE = r.rule || RULE;
  RULE_LABEL = r.ruleLabel || '';

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('shield-check')} ${L('احراز هویت (KYC)', 'Identity verification (KYC)')}</h2>
        <p class="muted small">
          ${fmtNum(COUNTS.all || 0)} ${L('درخواست ثبت‌شده', 'submissions')} ·
          ${fmtNum(COUNTS.pending || 0)} ${L('در انتظار بررسی', 'pending')}
        </p>
      </div>
      <a class="btn btn-ghost btn-sm" href="${KYC_FORM_URL}" target="_blank" rel="noopener">${icon('file')} ${L('فرم تعهدنامه', 'Commitment form')}</a>
    </div>

    ${ruleNotice()}

    <div class="tabs mb" data-tabs>
      ${TABS.map((x) => h`
        <a class="tab ${String(F.status) === x.id ? 'active' : ''}" href="#/admin/kyc" data-act="adm-kyc-tab" data-status="${x.id}">
          ${x.label()}${COUNTS[x.id || 'all'] ? h` <span class="badge-pill ${x.cls} tiny">${fmtNum(COUNTS[x.id || 'all'])}</span>` : ''}
        </a>`)}
    </div>

    <form class="card mb adm-filter" data-act="adm-kyc-filter">
      <div class="form-grid">
        <label class="field"><span class="label">${t('common.search')}</span>
          <input class="input" name="q" value="${esc(F.q)}" placeholder="${L('نام / نام کاربری / شماره موبایل', 'Name / username / phone')}">
        </label>
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-kyc-clear">${icon('close')} ${t('catalog.f.clear')}</button>
      </div>
    </form>

    ${CACHE.length ? tableHtml(
      [
        { label: L('کاربر', 'User') },
        { label: t('common.phone') },
        { label: L('تاریخ ارسال', 'Submitted') },
        { label: L('وضعیت', 'Status') },
        { label: L('مدارک', 'Documents') },
        { label: L('عملیات', 'Actions'), cls: 'num' },
      ],
      CACHE.map(rowHtml),
    ) : emptyState({
      icon: 'shield-check',
      title: L('درخواستی در این بخش نیست', 'No requests here'),
      text: L('به‌محض ارسال مدارک توسط کاربران، این‌جا برای بررسی دیده می‌شود.', 'As soon as customers upload documents they appear here for review.'),
    })}`;
}

function ruleNotice() {
  if (!RULE || (!RULE.required && RULE.condition === 'disabled')) {
    return h`<div class="notice notice-info mb">${icon('info')}<span>${raw(L(
      'قاعدهٔ فعلی فروشگاه: <strong>غیرفعال</strong> — هیچ اجباری برای احراز هویت جهت ثبت سفارش وجود ندارد. برای تغییر: تنظیمات ← سفارش و پرداخت ← احراز هویت (KYC).',
      'Current store rule: <strong>disabled</strong> — KYC is not required to place an order. Change it in Settings → Orders → KYC.',
    ))}</span></div>`;
  }
  return h`<div class="notice notice-warn mb">${icon('shield-alert')}<span>${L('قاعدهٔ فعلی فروشگاه: ', 'Current store rule: ')}<strong>${esc(RULE_LABEL || RULE.condition)}</strong>${RULE.condition === 'amount' ? h` — ${L('آستانهٔ مبلغ', 'threshold')}: <strong>${fmtNum(RULE.minAmount)}</strong> ${t('common.toman')}` : ''} · <a class="section-link" href="#/admin/settings/orders">${L('تغییر قاعده', 'change rule')}</a></span></div>`;
}

function rowHtml(u) {
  const st = STATUS_META[u.kycStatus] || STATUS_META.none;
  const docs = docLinks(u);
  return h`
    <tr>
      <td>
        <span class="b">${esc(u.name || u.username)}</span>
        <div class="tiny muted mono">@${esc(u.username)}</div>
        ${u.shahkarValidated ? h`<span class="badge-pill bp-success tiny">${icon('check')} ${L('شاهکار: تطابق دارد', 'Shahkar: match')}</span>` : h`<span class="badge-pill bp-danger tiny">${icon('alert')} ${L('شاهکار: مغایرت', 'Shahkar: mismatch')}</span>`}
      </td>
      <td class="mono tiny nowrap">${fmtTel(u.phone || '')}${u.email ? h`<div class="tiny muted">${esc(u.email)}</div>` : ''}</td>
      <td class="tiny nowrap">${u.submittedAt ? h`${fmtDate(u.submittedAt)}<div class="muted">${timeAgo(u.submittedAt)}</div>` : h`<span class="muted">—</span>`}</td>
      <td><span class="badge-pill ${st.cls}">${icon(st.ic)} ${st.label()}</span>${u.kycMessage ? h`<div class="tiny muted mt-s">${esc(u.kycMessage)}</div>` : ''}</td>
      <td>${docs}</td>
      <td class="num nowrap">
        <div class="row row-wrap" style="justify-content:flex-end;">
          <button class="btn btn-sm btn-success" type="button" data-act="adm-kyc-approve" data-id="${u.id}" ${u.kycStatus === 'approved' ? 'disabled' : ''}>${icon('check-circle')} ${L('تأیید مدارک', 'Approve')}</button>
          <button class="btn btn-sm btn-danger" type="button" data-act="adm-kyc-reject" data-id="${u.id}" ${u.kycStatus === 'rejected' ? 'disabled' : ''}>${icon('x-circle')} ${L('رد مدارک', 'Reject')}</button>
          <a class="btn btn-sm btn-ghost" href="#/admin/users/${u.id}">${icon('user')} ${L('پروفایل', 'Profile')}</a>
        </div>
      </td>
    </tr>`;
}

function docLinks(u) {
  const isImage = (url) => /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(String(url || ''));
  const all = [u.selfie, u.idCard, u.formDoc].filter(Boolean);
  if (!all.length) return h`<span class="muted tiny">${L('مدارکی بارگذاری نشده', 'No documents uploaded')}</span>`;
  const thumbs = [u.selfie, u.idCard].filter(isImage);
  return h`
    <div class="col" style="gap:6px;">
      ${thumbs.length ? h`<div class="kyc-thumbs">${thumbs.map((src, i) => h`<img class="kyc-thumb" src="${esc(src)}" alt="" loading="lazy" data-act="adm-kyc-zoom" data-id="${u.id}" data-i="${i}">`)}</div>` : ''}
      <div class="row row-wrap" style="gap:6px;">
        ${u.selfie ? docChip(u.selfie, L('سلفی', 'Selfie'), 'camera') : ''}
        ${u.idCard ? docChip(u.idCard, L('کارت ملی', 'National ID'), 'card') : ''}
        ${u.formDoc ? docChip(u.formDoc, L('فرم تعهدنامه', 'Signed form'), 'file') : ''}
      </div>
      ${u.reviewedAt ? h`<span class="tiny muted">${L('بررسی توسط', 'Reviewed by')} ${esc(u.reviewedBy || '—')} · ${fmtDate(u.reviewedAt)}</span>` : ''}
    </div>`;
}

function docChip(url, label, ic) {
  return h`<a class="kyc-doc" href="${esc(url)}" target="_blank" rel="noopener">${icon(ic)} ${label}</a>`;
}

/** همهٔ تصویرهای یک کاربر برای لایت‌باکس */
function imagesOf(u) {
  const isImage = (x) => /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(String(x || ''));
  return [u.selfie, u.idCard].filter(isImage);
}

// ── کنش‌ها ──────────────────────────────────────────────────
act('adm-kyc-tab', (e, el) => {
  F.status = String(el.dataset.status || '');
  refresh(true);
});

act('adm-kyc-filter', (e, form) => {
  e.preventDefault();
  F.q = String(new FormData(form).get('q') || '').trim();
  refresh(true);
});

act('adm-kyc-clear', () => { F.q = ''; F.status = ''; refresh(true); });

act('adm-kyc-zoom', (e, el) => {
  const u = CACHE.find((x) => String(x.id) === String(el.dataset.id));
  const imgs = imagesOf(u);
  if (imgs.length) lightbox(imgs, Number(el.dataset.i || 0), L('مدارک احراز هویت', 'KYC documents'));
});

act('adm-kyc-approve', async (e, el) => {
  const okYes = await confirmDialog({
    title: L('تأیید مدارک احراز هویت', 'Approve KYC documents'),
    text: L('با تأیید، این کاربر به خرید اقساطی و همهٔ خدمات دسترسی پیدا می‌کند.', 'Once approved, this customer gets access to installments and all services.'),
    okText: L('تأیید مدارک', 'Approve'),
    icon: 'check-circle',
  });
  if (!okYes) return;
  await decide(el.dataset.id, 'approved', '', el);
});

act('adm-kyc-reject', async (e, el) => {
  const msg = await promptDialog({
    title: L('رد مدارک احراز هویت', 'Reject KYC documents'),
    text: L('دلیل رد شدن را بنویس تا برای کاربر ارسال شود.', 'Write the reason; it will be sent to the customer.'),
    label: L('دلیل رد (برای کاربر)', 'Reason (shown to customer)'),
    value: L('تصویر مدارک ناخوانا یا ناقص است؛ لطفاً عکس واضح‌تر و فرم تعهدنامهٔ امضاشده ارسال کنید.', 'Documents are unreadable or incomplete; please upload clearer photos and the signed form.'),
    okText: L('رد مدارک', 'Reject'),
    required: true,
  });
  if (msg === null) return;
  await decide(el.dataset.id, 'rejected', String(msg || ''), el);
});

async function decide(id, decision, message, el) {
  await withBusy(el, async () => {
    try {
      await api.post(`/api/admin/kyc/${id}/decision`, { decision, message });
      toastSuccess(decision === 'approved' ? L('مدارک تأیید شد.', 'Documents approved.') : L('مدارک رد شد و دلیل برای کاربر ارسال شد.', 'Documents rejected; the reason was sent to the customer.'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
}

export function mount(root) {
  applyDyn(root);
  return null;
}

export const title = () => L('احراز هویت (KYC)', 'KYC');
