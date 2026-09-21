// ─────────────────────────────────────────────────────────────
//  پنل مدیریت استخدام: کلیدهای اصلی/منو، آگهی‌های شغلی (CRUD)
//  و درخواست‌های متقاضیان (وضعیت، یادداشت داخلی، دانلود رزومه)
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S, feat, can } from '../../state.mjs';
import { field, textareaField, selectField, switchField, tableHtml } from '../../components.mjs';
import { toast, toastSuccess, toastApiError, modal, confirmDelete, withBusy, errorState, spinner, emptyState, promptDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh, navigate } from '../../router.mjs';

const E = { data: null, statusFilter: '' };
const STATUSES = ['pending', 'reviewed', 'accepted', 'rejected'];
const statusCls = (s) => ({ pending: 'bp-warn', reviewed: 'bp-info', accepted: 'bp-success', rejected: 'bp-danger' }[s] || 'bp-muted');

export async function render(ctx) {
  const tab = ['openings', 'apps', 'settings'].includes(ctx.params.id) ? ctx.params.id : 'openings';
  let data = null;
  try {
    data = await api.get('/api/admin/careers');
  } catch (err) {
    return errorState({ title: err?.message || t('err.generic') });
  }
  E.data = data;
  const s = S.settings || {};

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('users')} ${t('adm.careers')}</h2>
      <a class="btn btn-ghost btn-sm" href="#/careers" target="_blank" rel="noopener">${icon('external')} ${t('common.view')}</a>
    </div>

    <div class="tabs mb" data-admc-tabs>
      <a class="tab ${tab === 'openings' ? 'active' : ''}" href="#/admin/careers/openings">${icon('list')} ${t('adm.openings')} <span class="cnt">(${fmtNum((data.openings || []).length)})</span></a>
      <a class="tab ${tab === 'apps' ? 'active' : ''}" href="#/admin/careers/apps">${icon('users')} ${t('adm.applications')} <span class="cnt">(${fmtNum((data.applications || []).length)})</span>${(data.counts?.pending || 0) ? h`<span class="cnt cnt-warn">(${fmtNum(data.counts.pending)})</span>` : ''}</a>
      <a class="tab ${tab === 'settings' ? 'active' : ''}" href="#/admin/careers/settings">${icon('settings')} ${t('common.settings')}</a>
    </div>

    ${tab === 'openings' ? openingsTab(data) : ''}
    ${tab === 'apps' ? appsTab(data) : ''}
    ${tab === 'settings' ? settingsTab(s, data) : ''}`;
}

// ── آگهی‌های شغلی ───────────────────────────────────────────
function openingsTab(data) {
  const openings = data.openings || [];
  return h`
    <div class="row row-between row-wrap mb">
      <p class="muted small">${fmtNum(openings.length)} ${t('adm.openings')}</p>
      <button type="button" class="btn btn-primary btn-sm" data-act="admc-opening-new">${icon('plus')} ${t('adm.openingNew')}</button>
    </div>
    ${openings.length ? h`
    <div class="job-admin-list">
      ${openings.map((o) => h`
        <article class="card job-admin">
          <div class="row row-between row-wrap">
            <div>
              <h3>${esc(o.title)} ${o.titleEn ? h`<span class="muted tiny">(${esc(o.titleEn)})</span>` : ''}</h3>
              <div class="tiny muted row row-wrap">
                ${o.department ? h`<span>${icon('store')} ${esc(o.department)}</span>` : ''}
                ${o.workingHours ? h`<span>${icon('clock')} ${esc(o.workingHours)}</span>` : ''}
                ${o.location ? h`<span>${icon('pin')} ${esc(o.location)}</span>` : ''}
              </div>
            </div>
            <div class="row row-wrap">
              <span class="badge-pill ${o.open !== false ? 'bp-success' : 'bp-muted'}">${o.open !== false ? t('adm.openingOpen') : t('common.inactive') || 'غیرفعال'}</span>
              <button class="btn btn-ghost btn-xs" data-act="admc-opening-edit" data-id="${o.id}" title="${t('adm.openingEdit')}">${icon('edit')}</button>
              <button class="btn btn-ghost btn-xs" data-act="admc-opening-del" data-id="${o.id}" data-name="${esc(o.title)}" title="${t('common.delete')}">${icon('trash')}</button>
            </div>
          </div>
          ${(o.responsibilities || []).length ? h`<ul class="tiny job-ul mt-s">${o.responsibilities.slice(0, 4).map((x) => h`<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        </article>`).join('')}
    </div>` : h`<div class="card">${emptyState({ icon: 'users', title: t('careers.empty') })}</div>`}`;
}

// ── مودال ویرایش/ایجاد آگهی ─────────────────────────────────
function openingForm(o) {
  const isNew = !o;
  return h`
    <form data-act="admc-opening-save" data-id="${o?.id || ''}">
      <div class="form-grid">
        ${field({ label: t('adm.openingTitle'), name: 'title', required: true, value: o?.title || '' })}
        ${field({ label: t('adm.openingTitleEn'), name: 'titleEn', value: o?.titleEn || '' })}
        ${field({ label: t('careers.department'), name: 'department', value: o?.department || '' })}
        ${field({ label: t('careers.workingHours'), name: 'workingHours', value: o?.workingHours || '', placeholder: isFa() ? 'مثلاً: شنبه تا چهارشنبه ۹ تا ۱۷' : 'e.g. Sat–Thu 9–17' })}
        ${field({ label: t('careers.location'), name: 'location', value: o?.location || '', placeholder: isFa() ? 'مثلاً: تهران، نارمک' : 'e.g. Tehran' })}
        ${field({ label: t('careers.experienceNeed'), name: 'experience', value: o?.experience || '', placeholder: isFa() ? 'مثلاً: حداقل ۲ سال' : 'e.g. min 2 years' })}
        ${textareaField({ label: t('careers.description'), name: 'description', value: o?.description || '', rows: 4 })}
        ${textareaField({ label: t('careers.responsibilities') + ' — ' + (isFa() ? 'هر 줄 یک تکلیف' : 'one per line'), name: 'responsibilities', value: (o?.responsibilities || []).join('\n'), rows: 4 })}
        ${textareaField({ label: t('careers.requirements') + ' — ' + (isFa() ? 'هر 줄 یک ملاک' : 'one per line'), name: 'requirements', value: (o?.requirements || []).join('\n'), rows: 4 })}
      </div>
      <div class="card mt">
        ${switchField({ label: t('adm.openingOpen'), desc: isFa() ? 'خاموش = آگهی در صفحهٔ عمومی نشان داده نمی‌شود' : 'Off = hidden from the public page', name: 'open', checked: o ? o.open !== false : true })}
      </div>
      <div class="row row-wrap mt">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
      </div>
    </form>`;
}

act('admc-opening-new', () => {
  modal({ title: `${icon('plus')} ${t('adm.openingNew')}`, size: 'lg', body: openingForm(null) });
});

act('admc-opening-edit', (e, el) => {
  const o = (E.data?.openings || []).find((x) => x.id === el.dataset.id);
  if (!o) return;
  modal({ title: `${icon('edit')} ${t('adm.openingEdit')}`, subtitle: o.title, size: 'lg', body: openingForm(o) });
});

act('admc-opening-del', async (e, el) => {
  const ok = await confirmDelete(el.dataset.name);
  if (!ok) return;
  await withBusy(el, async () => {
    try { await api.del(`/api/admin/careers/openings/${el.dataset.id}`); toastSuccess(t('common.deleted')); refresh(true); }
    catch (err) { toastApiError(err); }
  });
});

act('admc-opening-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const lines = (v) => String(fd.get(v) || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
  const payload = {
    title: fd.get('title'), titleEn: fd.get('titleEn') || '',
    department: fd.get('department') || '', description: fd.get('description') || '',
    responsibilities: lines('responsibilities'), requirements: lines('requirements'),
    experience: fd.get('experience') || '', workingHours: fd.get('workingHours') || '',
    location: fd.get('location') || '', open: fd.get('open') === 'on',
  };
  const id = form.dataset.id;
  const btn = form.querySelector('button[type=submit]');
  await withBusy(btn, async () => {
    try {
      if (id) { await api.patch(`/api/admin/careers/openings/${id}`, payload); toastSuccess(t('common.saved')); }
      else { await api.post('/api/admin/careers/openings', payload); toastSuccess(t('common.saved')); }
      document.querySelector('[data-lx]')?.click();
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── درخواست‌ها ───────────────────────────────────────────────
function appsTab(data) {
  const apps = (data.applications || []).filter((a) => !E.statusFilter || a.status === E.statusFilter);
  const counts = data.counts || {};
  return h`
    <div class="row row-wrap mb">
      <button class="btn btn-sm ${!E.statusFilter ? 'btn-primary' : 'btn-ghost'}" data-act="admc-app-filter" data-v="">${t('common.all')} (${fmtNum(counts.total || 0)})</button>
      ${STATUSES.map((st) => h`
        <button class="btn btn-sm ${E.statusFilter === st ? 'btn-primary' : 'btn-ghost'}" data-act="admc-app-filter" data-v="${st}">${t(`appStatus.${st}`)} (${fmtNum(counts[st] || 0)})</button>`).join('')}
    </div>
    ${apps.length ? tableHtml(
      [
        { label: t('adm.appName') }, { label: t('adm.appOpening') }, { label: t('adm.appResume') },
        { label: t('adm.appStatus'), cls: 'num' }, { label: t('common.date'), cls: 'num' }, { label: '', cls: 'num' },
      ],
      apps.map((a) => h`
        <tr>
          <td>
            <div class="b">${esc(a.name)}</div>
            <div class="tiny muted" dir="ltr">📱 ${esc(a.phone)}</div>
            <div class="tiny muted">${a.age ? `${t('adm.appAge')}: ${fmtNum(Number(a.age))} · ` : ''}${esc(a.education || '—')}</div>
          </td>
          <td class="tiny">${esc(a.openingTitle)}</td>
          <td>${a.resumeUrl ? h`<a class="link-btn" href="${esc(a.resumeUrl)}" download target="_blank" rel="noopener">${icon('download')} ${t('adm.appResume')}</a>` : h`<span class="tiny muted">—</span>`}</td>
          <td class="num">
            <select class="select select-sm" data-act="admc-app-status" data-id="${a.id}" style="width:auto;">
              ${STATUSES.map((st) => h`<option value="${st}" ${a.status === st ? 'selected' : ''}>${t(`appStatus.${st}`)}</option>`).join('')}
            </select>
            ${a.note ? h`<div class="tiny muted mt-s" title="${esc(a.note)}">${icon('file')} ${esc(String(a.note).slice(0, 30))}${String(a.note).length > 30 ? '…' : ''}</div>` : ''}
          </td>
          <td class="num tiny muted">${fmtDate(a.createdAt)}</td>
          <td>
            <div class="act">
              <button class="btn btn-ghost btn-xs" data-act="admc-app-view" data-id="${a.id}" title="${t('common.details')}">${icon('eye')}</button>
            </div>
          </td>
        </tr>`),
    ) : h`<div class="card">${emptyState({ icon: 'users', title: t('common.noResult') || 'نتیجه‌ای نیست' })}</div>`}`;
}

act('admc-app-filter', (e, el) => {
  E.statusFilter = el.dataset.v || '';
  refresh(true);
});

act('admc-app-status', async (e, el) => {
  const sel = el;
  const id = sel.dataset.id;
  const a = (E.data?.applications || []).find((x) => x.id === id);
  try {
    await api.patch(`/api/admin/careers/applications/${id}`, { status: sel.value, note: a?.note || '' });
    toastSuccess(t('common.saved'), { timeout: 1800 });
  } catch (err) { toastApiError(err); }
});

act('admc-app-view', (e, el) => {
  const a = (E.data?.applications || []).find((x) => x.id === el.dataset.id);
  if (!a) return;
  modal({
    title: `${icon('users')} ${t('adm.appName')}`,
    subtitle: a.name,
    body: h`
      <form data-act="admc-app-save" data-id="${a.id}">
        <div class="form-grid">
          ${field({ label: t('adm.appPhone'), name: 'phone', value: a.phone, attrs: 'dir="ltr" readonly' })}
          ${field({ label: t('adm.appAge'), name: 'age', value: a.age || '', attrs: 'readonly' })}
          ${field({ label: t('adm.appEducation'), name: 'education', value: a.education || '', attrs: 'readonly' })}
          ${field({ label: t('adm.appOpening'), name: 'opening', value: a.openingTitle, attrs: 'readonly' })}
          ${field({ label: t('common.date'), name: 'date', value: fmtDate(a.createdAt), attrs: 'readonly' })}
          ${a.userName ? field({ label: t('adm.appUser'), name: 'user', value: a.userName, attrs: 'readonly' }) : ''}
        </div>
        ${a.experience ? h`
          <div class="mt-s">
            <div class="label">${t('adm.appExperience')}</div>
            <p class="small">${esc(a.experience)}</p>
          </div>` : ''}
        ${a.resumeUrl ? h`
          <div class="mt-s">
            <div class="label">${t('adm.appResume')}</div>
            <div class="row row-wrap">
              <a class="btn btn-primary btn-sm" href="${esc(a.resumeUrl)}" download target="_blank" rel="noopener">${icon('download')} ${t('common.download')}</a>
              ${a.resumeUrl.match(/\.(jpe?g|png|webp|gif|svg)$/i) ? h`<a class="btn btn-ghost btn-sm" href="${esc(a.resumeUrl)}" target="_blank" rel="noopener">${icon('eye')} ${t('common.view')}</a>` : ''}
            </div>
          </div>` : ''}
        <div class="mt-s">
          ${selectField({ label: t('adm.appStatus'), name: 'status', value: a.status || 'pending', options: STATUSES.map((st) => ({ value: st, label: t(`appStatus.${st}`) })) })}
          ${textareaField({ label: t('adm.appNote'), name: 'note', value: a.note || '', rows: 3, hint: isFa() ? 'فقط شما و همکارانتان می‌بینید' : 'Only visible to staff' })}
        </div>
        <div class="row row-wrap mt">
          <button class="btn btn-primary" type="submit">${icon('save')} ${t('adm.appSave')}</button>
        </div>
      </form>`,
  });
});

act('admc-app-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/careers/applications/${form.dataset.id}`, { status: fd.get('status'), note: fd.get('note') || '' });
      toastSuccess(t('common.saved'));
      document.querySelector('[data-lx]')?.click();
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── تنظیمات کلیدی ───────────────────────────────────────────
function settingsTab(s, data) {
  const f = s.features || {};
  const careers = s.careers || {};
  const canSettings = can('settings.edit');
  return h`
    <p class="notice notice-info mb">${icon('info')}<span>${isFa() ? 'کلیدهای اصلی: با خاموش‌کردن، بخش کامل از سایت و منو حذف می‌شود.' : 'Master switches: turning off removes the whole section from the site and nav.'}</span></p>

    <div class="card mb">
      <strong>${icon('zap')} ${isFa() ? 'فرصت‌های شغلی و استخدام' : 'Careers & recruitment'}</strong>
      <div class="mt-s">
        ${canSettings ? switchField({ label: t('adm.careersEnabled'), desc: t('adm.careersEnabledDesc'), name: 'careersEnabled', checked: f.careers !== false }) : h`<div class="row"><span class="badge-pill ${f.careers !== false ? 'bp-success' : 'bp-muted'}">${f.careers !== false ? 'ON' : 'OFF'}</span><span class="tiny muted">${t('adm.careersEnabled')}</span></div>`}
        ${canSettings ? switchField({ label: t('adm.careersNav'), desc: t('adm.careersNavDesc'), name: 'careersNav', checked: careers.navShowInNav !== false }) : h`<div class="row"><span class="badge-pill ${careers.navShowInNav !== false ? 'bp-success' : 'bp-muted'}">${careers.navShowInNav !== false ? 'ON' : 'OFF'}</span><span class="tiny muted">${t('adm.careersNav')}</span></div>`}
      </div>
    </div>

    ${canSettings ? h`
    <div class="row row-wrap mt">
      <button class="btn btn-primary" data-act="admc-quick-save">${icon('save')} ${t('common.save')}</button>
    </div>` : ''}
    ${data.enabled === false ? h`<p class="notice notice-warn mt">${icon('alert')}<span>${t('careers.closed')}</span></p>` : ''}`;
}

// ── ذخیرهٔ سریع کلیدها ───────────────────────────────────────
act('admc-quick-save', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const root = el.closest('#viewInner') || document;
      const features = {};
      for (const key of ['careersEnabled']) {
        const input = root.querySelector(`[name=${key}]`);
        if (!input) continue;
        const featKey = { careersEnabled: 'careers' }[key];
        features[featKey] = input.checked;
      }
      await api.patch('/api/admin/settings/features', { value: features });
      const navInput = root.querySelector('[name=careersNav]');
      if (navInput) await api.patch('/api/admin/settings/careers', { value: { navShowInNav: navInput.checked } });
      toastSuccess(t('common.saved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}
