// Dedicated editor: all sections, including disabled or hidden ones, remain editable.
import { html as h, icon, raw } from '../../lib/dom.mjs';
import { isFa, t } from '../../i18n.mjs';
import { S, refreshBootstrap } from '../../state.mjs';
import { field, selectField, switchField } from '../../components.mjs';
import { api } from '../../lib/api.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';
import { withBusy, toastSuccess, toastApiError, errorState, confirmDialog } from '../../ui.mjs';
import { SECTIONS } from './index.mjs';
import { normalizeAdminNav, NAV_ICON_NAMES } from '../../lib/admin-nav.mjs';
const L = (fa, en) => isFa() ? fa : en;

export async function renderAdminNav() {
  let prefs;
  try {
    const result = await api.get('/api/admin/settings');
    prefs = normalizeAdminNav(result.settings?.adminNav);
  } catch (err) { return errorState({ title: err.message }); }
  return h`<form class="card" data-act="admin-nav-save">
    <h3>${L('مدیریت منوهای پنل مدیریت', 'Admin sidebar navigation')}</h3>
    <p class="hint mb">${L('همهٔ گزینه‌ها قابل ویرایش‌اند. عنوان خالی یعنی نام پیش‌فرض. پنهان‌کردن، مجوز دسترسی را تغییر نمی‌دهد. برای بازیابی منو همیشه از دکمهٔ بالای پنل استفاده کنید.', 'All sections are editable. Blank titles use defaults. Hiding does not change permissions. The toolbar link always opens this editor.')}</p>
    <div data-admin-nav-list>
    ${prefs.order.map(id => {
      const section = SECTIONS.find(s => s.id === id);
      if (!section) return '';
      const labels = prefs.customLabels[id];
      return h`<div class="panel p-s mb" data-admin-nav-row data-id="${id}">
        <div class="row row-between row-wrap mb-s">
          <strong>${icon(prefs.customIcons[id] || section.icon)} ${section.label()} <small dir="ltr">/${id || 'dashboard'}</small></strong>
          <div class="row">
            <button type="button" class="btn btn-ghost btn-sm" data-act="admin-nav-move" data-direction="up" aria-label="${L('انتقال به بالا', 'Move up')}">↑ ${L('بالا', 'Up')}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="admin-nav-move" data-direction="down" aria-label="${L('انتقال به پایین', 'Move down')}">↓ ${L('پایین', 'Down')}</button>
          </div>
        </div>
        <div class="form-grid">
          ${field({ name: 'fa', label: L('عنوان فارسی', 'Persian title'), value: labels.fa, attrs: raw('maxlength="80"') })}
          ${field({ name: 'en', label: L('عنوان انگلیسی', 'English title'), value: labels.en, attrs: raw('maxlength="80" dir="ltr"') })}
          ${selectField({ name: 'icon', label: L('آیکون', 'Icon'), value: prefs.customIcons[id] || '', options: [{ value: '', label: L('پیش‌فرض', 'Default') }, ...NAV_ICON_NAMES.map(value => ({ value, label: value }))] })}
          ${switchField({ name: 'show', label: L('نمایش در منوی کناری', 'Show in sidebar'), checked: !prefs.hidden.includes(id) })}
        </div>
      </div>`;
    })}
    </div>
    <div class="row row-wrap mt">
      <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
      <button class="btn btn-ghost" type="button" data-act="admin-nav-reset">${icon('refresh')} ${L('بازگشت همهٔ منوها به پیش‌فرض', 'Restore all defaults')}</button>
    </div>
  </form>`;
}

act('admin-nav-move', (e, el) => {
  const row = el.closest('[data-admin-nav-row]');
  if (!row) return;
  const other = el.dataset.direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
  if (!other) return;
  if (el.dataset.direction === 'up') row.parentNode.insertBefore(row, other);
  else row.parentNode.insertBefore(other, row);
  el.focus();
});

async function save(value, button) {
  await withBusy(button, async () => {
    try {
      const result = await api.patch('/api/admin/settings/adminNav', { value });
      S.settings.adminNav = result.value;
      await refreshBootstrap({ silent: true });
      toastSuccess(t('common.saved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
}
act('admin-nav-save', async (e, form) => {
  e.preventDefault();
  const value = { order: [], hidden: [], customLabels: {}, customIcons: {} };
  for (const row of form.querySelectorAll('[data-admin-nav-row]')) {
    const id = row.dataset.id;
    value.order.push(id);
    if (!row.querySelector('[name=show]').checked) value.hidden.push(id);
    value.customLabels[id] = { fa: row.querySelector('[name=fa]').value, en: row.querySelector('[name=en]').value };
    value.customIcons[id] = row.querySelector('[name=icon]').value;
  }
  await save(value, form.querySelector('[type=submit]'));
});
act('admin-nav-reset', async (e, el) => {
  if (!await confirmDialog({ title: L('بازگشت به پیش‌فرض', 'Restore defaults'), text: L('ترتیب، نمایش، عنوان و آیکون همهٔ منوها بازنشانی شود؟', 'Reset order, visibility, titles and icons for all sections?') })) return;
  await save(normalizeAdminNav(), el);
});
