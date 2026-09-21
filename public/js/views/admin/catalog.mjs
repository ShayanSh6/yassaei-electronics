// ─────────────────────────────────────────────────────────────
//  مدیریت دسته‌ها و برندها
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { refreshBootstrap } from '../../state.mjs';
import { tableHtml, field, selectField, switchField, textareaField } from '../../components.mjs';
import { toastSuccess, toastApiError, modal, confirmDelete, withBusy, errorState, emptyState } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

let CATS = [];
let BRANDS = [];

export async function render() {
  let r = null;
  try { r = await api.get('/api/admin/categories'); } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  CATS = r.items || [];
  BRANDS = r.brands || [];

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('layers')} ${t('adm.categories')}</h2>
      <div class="row row-wrap">
        <button class="btn btn-primary btn-sm" data-act="adm-cat-new">${icon('plus')} ${t('common.category')}</button>
        <button class="btn btn-outline btn-sm" data-act="adm-brand-new">${icon('plus')} ${t('common.brand')}</button>
      </div>
    </div>

    <div class="card">
      <strong>${icon('layers')} ${t('common.category')} (${fmtNum(CATS.length)})</strong>
      ${tableHtml(
        [
          { label: t('adm.catGlyph') }, { label: t('adm.catName') }, { label: t('adm.catParent') },
          { label: t('adm.catOrder'), cls: 'num' }, { label: t('common.count'), cls: 'num' }, { label: t('common.status') }, { label: '', cls: 'num' },
        ],
        CATS.map((c) => h`
          <tr>
            <td><span class="cat-ic" data-h="34px" data-w="34px">${icon(c.glyph || 'box')}</span></td>
            <td><span class="b">${esc(isFa() ? c.name : (c.nameEn || c.name))}</span><div class="tiny muted mono">${esc(c.id)}</div></td>
            <td class="tiny">${esc(CATS.find((x) => x.id === c.parentId)?.name || '—')}</td>
            <td class="num">${fmtNum(c.order || 0)}</td>
            <td class="num">${fmtNum(c.productCount || 0)}</td>
            <td>${c.active === false ? h`<span class="badge-pill bp-muted">${t('common.inactive')}</span>` : h`<span class="badge-pill bp-success">${t('common.active')}</span>`}</td>
            <td>
              <div class="act">
                <button class="btn btn-ghost btn-xs" data-act="adm-cat-edit" data-id="${c.id}">${icon('edit')}</button>
                <a class="btn btn-ghost btn-xs" href="#/category/${c.id}" target="_blank" rel="noopener">${icon('external')}</a>
                <button class="btn btn-ghost btn-xs" data-act="adm-cat-del" data-id="${c.id}" data-name="${esc(c.name)}">${icon('trash')}</button>
              </div>
            </td>
          </tr>`),
        { emptyText: t('common.noData') },
      )}
    </div>

    <div class="card mt">
      <strong>${icon('tag')} ${t('common.brand')} (${fmtNum(BRANDS.length)})</strong>
      ${tableHtml(
        [
          { label: t('adm.brandName') }, { label: t('adm.brandNameEn') }, { label: t('common.count'), cls: 'num' },
          { label: t('common.status') }, { label: '', cls: 'num' },
        ],
        BRANDS.map((b) => h`
          <tr>
            <td class="b">${esc(b.name)}<div class="tiny muted mono">${esc(b.id)}</div></td>
            <td class="tiny">${esc(b.nameEn || '')}${b.country ? h` <span class="muted">· ${esc(b.country)}</span>` : ''}</td>
            <td class="num">${fmtNum(b.productCount || 0)}</td>
            <td>${b.active === false ? h`<span class="badge-pill bp-muted">${t('common.inactive')}</span>` : h`<span class="badge-pill bp-success">${t('common.active')}</span>`}</td>
            <td>
              <div class="act">
                <button class="btn btn-ghost btn-xs" data-act="adm-brand-edit" data-id="${b.id}">${icon('edit')}</button>
                <button class="btn btn-ghost btn-xs" data-act="adm-brand-del" data-id="${b.id}" data-name="${esc(b.name)}">${icon('trash')}</button>
              </div>
            </td>
          </tr>`),
        { emptyText: t('common.noData') },
      )}
    </div>`;
}

// ── دسته‌ها ─────────────────────────────────────────────────
const GLYPHS = ['box', 'cable', 'plug', 'battery', 'speaker', 'watch', 'glasses', 'mic', 'camera', 'phone', 'card', 'zap', 'image', 'headset', 'anchor', 'palm', 'wave', 'globe', 'layers', 'tag', 'chip', 'solder', 'wrench', 'fan', 'tv', 'keyboard', 'chart'];

function catForm(c) {
  return modal({
    title: c ? t('common.edit') : t('common.add'),
    body: h`
      <form class="form-grid" data-act="adm-cat-save" data-id="${c?.id || ''}" data-isnew="${c ? '' : '1'}">
        ${!c ? field({ label: 'id', name: 'id', hint: isFa() ? 'خالی بگذاری خودکار ساخته می‌شود' : 'Auto if empty' }) : ''}
        ${field({ label: t('adm.catName'), name: 'name', required: true, value: c?.name || '' })}
        ${field({ label: t('adm.brandNameEn'), name: 'nameEn', value: c?.nameEn || '' })}
        ${selectField({ label: t('adm.catGlyph'), name: 'glyph', value: c?.glyph || 'box', options: GLYPHS.map((g) => ({ value: g, label: g })) })}
        ${selectField({
          label: t('adm.catParent'), name: 'parentId', value: c?.parentId || '',
          options: [{ value: '', label: t('adm.catNoParent') }, ...CATS.filter((x) => x.id !== c?.id).map((x) => ({ value: x.id, label: x.name }))],
        })}
        ${field({ label: t('adm.catOrder'), name: 'order', type: 'number', value: c?.order ?? CATS.length + 1, attrs: 'min="0" max="999"' })}
        <div class="span-2">${textareaField({ label: t('common.description'), name: 'description', value: c?.description || '', rows: 2 })}</div>
        <div class="span-2">${textareaField({ label: L2('توضیحات انگلیسی', 'Description (EN)'), name: 'descriptionEn', value: c?.descriptionEn || '', rows: 2 })}</div>
        <div class="span-2">${switchField({ label: t('common.active'), name: 'active', checked: c ? c.active !== false : true })}</div>
        <button class="btn btn-primary span-2" type="submit">${t('common.save')}</button>
      </form>`,
  });
}
const L2 = (fa, en) => (isFa() ? fa : en);
let catHandle = null;
act('adm-cat-new', () => { catHandle = catForm(null); });
act('adm-cat-edit', (e, el) => { catHandle = catForm(CATS.find((c) => c.id === el.dataset.id)); });
act('adm-cat-del', async (e, el) => {
  if (!(await confirmDelete(el.dataset.name))) return;
  try {
    await api.del(`/api/admin/categories/${el.dataset.id}`);
    toastSuccess(t('misc.deleted'));
    await refreshBootstrap({ silent: true });
    refresh(true);
  } catch (err) { toastApiError(err); }
});
act('adm-cat-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const isNew = form.dataset.isnew === '1';
  const payload = {
    name: fd.get('name'), nameEn: fd.get('nameEn') || '', glyph: fd.get('glyph') || 'box',
    parentId: fd.get('parentId') || '', order: Number(fd.get('order') || 0),
    description: fd.get('description') || '', descriptionEn: fd.get('descriptionEn') || '',
    active: fd.get('active') === 'on',
  };
  if (isNew && fd.get('id')) payload.id = fd.get('id');
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      if (isNew) await api.post('/api/admin/categories', payload);
      else await api.patch(`/api/admin/categories/${form.dataset.id}`, payload);
      toastSuccess(t('misc.saved'));
      catHandle?.close();
      await refreshBootstrap({ silent: true });
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── برندها ──────────────────────────────────────────────────
function brandForm(b) {
  return modal({
    title: b ? t('common.edit') : t('common.add'),
    size: 'sm',
    body: h`
      <form data-act="adm-brand-save" data-id="${b?.id || ''}" data-isnew="${b ? '' : '1'}">
        ${!b ? field({ label: 'id', name: 'id', hint: L2('خالی بگذاری خودکار ساخته می‌شود', 'Auto if empty') }) : ''}
        ${field({ label: t('adm.brandName'), name: 'name', required: true, value: b?.name || '' })}
        ${field({ label: t('adm.brandNameEn'), name: 'nameEn', value: b?.nameEn || '' })}
        ${field({ label: L2('کشور', 'Country'), name: 'country', value: b?.country || '' })}
        ${switchField({ label: t('common.active'), name: 'active', checked: b ? b.active !== false : true })}
        <button class="btn btn-primary btn-block mt-s" type="submit">${t('common.save')}</button>
      </form>`,
  });
}
let brandHandle = null;
act('adm-brand-new', () => { brandHandle = brandForm(null); });
act('adm-brand-edit', (e, el) => { brandHandle = brandForm(BRANDS.find((b) => b.id === el.dataset.id)); });
act('adm-brand-del', async (e, el) => {
  if (!(await confirmDelete(el.dataset.name))) return;
  try {
    await api.del(`/api/admin/brands/${el.dataset.id}`);
    toastSuccess(t('misc.deleted'));
    await refreshBootstrap({ silent: true });
    refresh(true);
  } catch (err) { toastApiError(err); }
});
act('adm-brand-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const isNew = form.dataset.isnew === '1';
  const payload = { name: fd.get('name'), nameEn: fd.get('nameEn') || '', country: fd.get('country') || '', active: fd.get('active') === 'on' };
  if (isNew && fd.get('id')) payload.id = fd.get('id');
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      if (isNew) await api.post('/api/admin/brands', payload);
      else await api.patch(`/api/admin/brands/${form.dataset.id}`, payload);
      toastSuccess(t('misc.saved'));
      brandHandle?.close();
      await refreshBootstrap({ silent: true });
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}
