import { html as h, icon, esc, applyDyn } from '../../lib/dom.mjs';
import { t, isFa, defaultFa, defaultEn } from '../../i18n.mjs';
import { S, refreshBootstrap } from '../../state.mjs';
import { toastSuccess, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { api } from '../../lib/api.mjs';

let filterQuery = '';
let currentLangTab = 'fa';

function currentOverrides() {
  return S.settings?.translations?.[currentLangTab] || {};
}
function currentReplacements() {
  return S.settings?.translations?.replacements?.[currentLangTab] || {};
}
function matches(query, ...values) {
  return !query || values.some((value) => String(value || '').toLowerCase().includes(query));
}

function renderTable() {
  const overrides = currentOverrides();
  const defaults = currentLangTab === 'fa' ? defaultFa : defaultEn;
  const keys = [...new Set([...Object.keys(defaults), ...Object.keys(overrides)])]
    .filter((k) => matches(filterQuery, k, defaults[k], overrides[k]))
    .slice(0, 150);
  if (keys.length === 0) return h`<div class="card t-center muted p-xl">${isFa() ? 'موردی یافت نشد.' : 'Nothing found.'}</div>`;
  return h`
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th style="width:250px">${isFa() ? 'کلید ترجمه' : 'Translation key'}</th><th style="width:35%">${isFa() ? 'متن پیش‌فرض' : 'Default text'}</th><th>${isFa() ? 'متن جایگزین' : 'Custom text'}</th><th style="width:60px"></th></tr></thead>
        <tbody>${keys.map((k) => h`
          <tr>
            <td class="mono small muted" style="word-break:break-all">${k}</td>
            <td class="small">${esc(defaults[k] || '')}</td>
            <td><textarea class="textarea" data-key="${k}" rows="1" style="min-height:38px;resize:vertical">${esc(overrides[k] || '')}</textarea></td>
            <td><button class="btn btn-ghost btn-sm" data-act="tr-clear" data-key="${k}" title="${isFa() ? 'حذف جایگزین' : 'Clear override'}">${icon('trash')}</button></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function replacementRows() {
  const replacements = currentReplacements();
  const entries = Object.entries(replacements).filter(([from, to]) => matches(filterQuery, from, to));
  return entries.length ? entries.map(([from, to]) => h`
    <div class="row row-wrap gap-10 tr-replacement-row" data-replacement-row>
      <input class="input grow" data-replacement-from value="${esc(from)}" maxlength="500" placeholder="${isFa() ? 'متن اصلی روی سایت' : 'Exact text on the site'}">
      <span class="muted">←</span>
      <input class="input grow" data-replacement-to value="${esc(to)}" maxlength="1000" placeholder="${isFa() ? 'متن سفارشی' : 'Custom text'}">
      <button type="button" class="btn btn-ghost btn-sm" data-act="tr-replacement-del" title="${t('common.delete')}">${icon('trash')}</button>
    </div>`).join('')
    : h`<p class="muted small" data-tr-replacement-empty>${isFa() ? 'هنوز جایگزینی آزاد ثبت نشده است.' : 'No free-text replacements yet.'}</p>`;
}

export function render(ctx) {
  return h`
    <div class="row row-between row-wrap mb">
      <div><h2>${icon('globe')} ${isFa() ? 'مدیریت متون و ترجمه‌ها' : 'Site text and translations'}</h2><p class="muted small">${isFa() ? 'هر کلید ترجمه یا متن قابل‌مشاهدهٔ سایت را جست‌وجو و سفارشی کن؛ تغییرها پایدار ذخیره می‌شوند.' : 'Search and customize any visible site text; changes are stored persistently.'}</p></div>
      <button class="btn btn-primary" data-act="tr-save">${icon('save')} ${t('common.save')}</button>
    </div>
    <div class="card mb">
      <div class="row row-wrap gap-15">
        <div class="tabs"><button class="btn ${currentLangTab === 'fa' ? 'btn-default' : 'btn-ghost'}" data-act="tr-tab" data-lang="fa">فارسی</button><button class="btn ${currentLangTab === 'en' ? 'btn-default' : 'btn-ghost'}" data-act="tr-tab" data-lang="en">English</button></div>
        <label class="field" style="flex:1;max-width:500px;margin:0"><div class="input-with-icon"><span class="ic">${icon('search')}</span><input type="text" class="input" id="tr-search" placeholder="${t('common.search')}…" value="${esc(filterQuery)}"></div></label>
      </div>
    </div>
    <div id="tr-list">${renderTable()}</div>
    <section class="card mt">
      <div class="row row-between row-wrap"><div><h3 class="section-title">${icon('edit')} ${isFa() ? 'جایگزینی آزاد هر متن' : 'Free-text replacements'}</h3><p class="hint">${isFa() ? 'متن دقیق دکمه، عنوان، پیام خطا یا توضیح را در ستون اول بگذار؛ روی متن‌های قابل‌مشاهدهٔ همین زبان اعمال می‌شود.' : 'Enter the exact button, heading, error or description text; it applies to visible text in this language.'}</p></div><button type="button" class="btn btn-ghost btn-sm" data-act="tr-replacement-add">${icon('plus')} ${t('common.add')}</button></div>
      <div class="col gap-10 mt-s" data-tr-replacements>${replacementRows()}</div>
    </section>`;
}

function rerenderList(root) {
  const list = root.querySelector('#tr-list');
  if (list) { list.innerHTML = renderTable(); applyDyn(list); }
  const rows = root.querySelector('[data-tr-replacements]');
  if (rows) { rows.innerHTML = replacementRows(); applyDyn(rows); }
}

export function mount(root) {
  applyDyn(root);
  const searchInp = root.querySelector('#tr-search');
  if (searchInp) searchInp.oninput = (e) => { filterQuery = e.target.value.trim().toLowerCase(); rerenderList(root); };
}

act('tr-tab', (e, el) => {
  currentLangTab = el.dataset.lang;
  const root = el.closest('[data-admbody]') || el.closest('.adm-grid') || document.querySelector('main');
  root.querySelectorAll('[data-act="tr-tab"]').forEach((button) => { button.className = button.dataset.lang === currentLangTab ? 'btn btn-default' : 'btn btn-ghost'; });
  rerenderList(root);
});

act('tr-clear', (e, el) => { const textarea = el.closest('tr')?.querySelector('textarea'); if (textarea) textarea.value = ''; });
act('tr-replacement-add', (e, el) => {
  const list = el.closest('[data-admbody]')?.querySelector('[data-tr-replacements]') || document.querySelector('[data-tr-replacements]');
  if (!list) return;
  list.querySelector('[data-tr-replacement-empty]')?.remove();
  list.insertAdjacentHTML('beforeend', h`<div class="row row-wrap gap-10 tr-replacement-row" data-replacement-row><input class="input grow" data-replacement-from maxlength="500" placeholder="${isFa() ? 'متن اصلی روی سایت' : 'Exact text on the site'}"><span class="muted">←</span><input class="input grow" data-replacement-to maxlength="1000" placeholder="${isFa() ? 'متن سفارشی' : 'Custom text'}"><button type="button" class="btn btn-ghost btn-sm" data-act="tr-replacement-del" title="${t('common.delete')}">${icon('trash')}</button></div>`);
  list.lastElementChild?.querySelector('input')?.focus();
});
act('tr-replacement-del', (e, el) => el.closest('[data-replacement-row]')?.remove());

act('tr-save', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const root = el.closest('[data-admbody]') || document.querySelector('main');
      const overrides = { ...currentOverrides() };
      root.querySelectorAll('textarea[data-key]').forEach((textarea) => { const val = textarea.value.trim(); if (val) overrides[textarea.dataset.key] = val; else delete overrides[textarea.dataset.key]; });
      const replacements = {};
      root.querySelectorAll('[data-replacement-row]').forEach((row) => {
        const from = row.querySelector('[data-replacement-from]')?.value.trim();
        const to = row.querySelector('[data-replacement-to]')?.value ?? '';
        if (from && to.trim()) replacements[from] = to;
      });
      const allReplacements = { ...(S.settings?.translations?.replacements || {}), [currentLangTab]: replacements };
      await api.patch('/api/admin/settings/translations', { value: { [currentLangTab]: overrides, replacements: allReplacements } });
      await refreshBootstrap({ silent: true });
      toastSuccess(t('common.success'));
    } catch (err) { toastApiError(err); }
  });
});
