// ─────────────────────────────────────────────────────────────
//  مدیریت کالاها: فهرست با فیلتر و صفحه‌بندی، فرم ایجاد/ویرایش،
//  مشخصات فنی، برچسب‌ها، تصویرها (بارگذاری + جست‌وجوی خودکار)، بارکد
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtMoney, applyDyn, fileToDataURL, copyText } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S, can, catName, brandName, store, feat } from '../../state.mjs';
import { tableHtml, field, textareaField, selectField, switchField, pagination, productImage } from '../../components.mjs';
import { toast, toastSuccess, toastApiError, modal, confirmDelete, withBusy, errorState, spinner, emptyState } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { navigate, refresh } from '../../router.mjs';

const F = { q: '', cat: '', brand: '', status: '', page: 1, limit: 25 };
const E = { images: [], specs: [], tags: [], editing: null };

export async function render(ctx) {
  const id = ctx.params.id;
  if (id === 'new') return editor(null);
  if (id) {
    let r = null;
    try { r = await api.get(`/api/admin/products/${id}`); } catch (err) { return errorState({ title: err?.message || t('err.notFound') }); }
    return editor(r.product);
  }
  return list();
}

// ── فهرست ───────────────────────────────────────────────────
async function list() {
  let r = null;
  try {
    r = await api.get(api.url('/api/admin/products', { q: F.q, cat: F.cat, brand: F.brand, status: F.status, page: F.page, limit: F.limit }));
  } catch (err) { return errorState({ title: err?.message || t('err.generic') }); }
  const items = r.items || [];
  const href = (p) => `#/admin/products?page=${p}`;

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('box')} ${t('adm.products')}</h2>
        <p class="muted small">${fmtNum(r.total || 0)} ${t('catalog.count')}</p>
      </div>
      ${can('products.create') ? h`<a class="btn btn-primary btn-sm" href="#/admin/products/new">${icon('plus')} ${t('adm.productNew')}</a>` : ''}
    </div>

    <form class="card mb adm-filter" data-act="adm-p-filter">
      <div class="form-grid">
        <label class="field"><span class="label">${t('common.search')}</span>
          <input class="input" name="q" value="${esc(F.q)}" placeholder="${t('adm.pName')} / SKU / ${t('pdp.barcode')}">
        </label>
        ${selectField({ label: t('adm.pCat'), name: 'cat', value: F.cat, options: [{ value: '', label: t('common.all') }, ...S.categories.map((c) => ({ value: c.id, label: catName(c) }))] })}
        ${selectField({ label: t('adm.pBrand'), name: 'brand', value: F.brand, options: [{ value: '', label: t('common.all') }, ...S.brands.map((b) => ({ value: b.id, label: brandName(b) }))] })}
        ${selectField({
          label: t('common.status'), name: 'status', value: F.status,
          options: [
            { value: '', label: t('common.all') },
            { value: 'active', label: t('common.active') },
            { value: 'inactive', label: t('common.inactive') },
            { value: 'low', label: t('adm.kpi.lowStock') },
            { value: 'out', label: t('card.outOfStock') },
          ],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-p-clear">${icon('close')} ${t('catalog.f.clear')}</button>
      </div>
    </form>

    ${items.length ? tableHtml(
      [
        { label: '' }, { label: t('adm.pName') }, { label: t('adm.pCat') }, { label: t('common.price'), cls: 'num' },
        { label: t('common.stock'), cls: 'num' }, { label: t('pdp.sold'), cls: 'num' }, { label: t('common.status') }, { label: t('common.actions'), cls: 'num' },
      ],
      items.map((p) => h`
        <tr>
          <td><span class="cl-img" data-h="46px" data-w="46px">${productImage(p)}</span></td>
          <td>
            <a class="b" href="#/admin/products/${p.id}">${esc(isFa() ? p.name : (p.nameEn || p.name))}</a>
            <div class="tiny muted mono">${esc(p.sku || '')}${p.barcode ? ` · ${esc(p.barcode)}` : ''}</div>
          </td>
          <td class="tiny">${esc(p.categoryName || '')}<div class="tiny muted">${esc(p.brandName || '')}</div></td>
          <td class="num">
            ${fmtMoney(p.price)}
            ${p.oldPrice > p.price ? h`<div class="tiny muted"><s>${fmtNum(p.oldPrice)}</s> <span class="badge-pill bp-danger">${fmtNum(p.discountPct)}٪</span></div>` : ''}
          </td>
          <td class="num"><span class="badge-pill ${p.inStock ? (p.stock <= 3 ? 'bp-warn' : 'bp-success') : 'bp-danger'}">${fmtNum(Math.max(0, (p.stock || 0) - (p.reserved || 0)))}</span></td>
          <td class="num">${fmtNum(p.sold || 0)}</td>
          <td>${p.active === false ? h`<span class="badge-pill bp-muted">${t('common.inactive')}</span>` : h`<span class="badge-pill bp-success">${t('common.active')}</span>`}</td>
          <td>
            <div class="act">
              <a class="btn btn-ghost btn-xs" href="#/admin/products/${p.id}">${icon('edit')}</a>
              <a class="btn btn-ghost btn-xs" href="#/product/${p.id}" target="_blank" rel="noopener">${icon('external')}</a>
              <button class="btn btn-ghost btn-xs" data-act="adm-p-igpack" data-id="${p.id}" title="${t('adm.igPack')}">${icon('camera')}</button>
              ${can('products.delete') ? h`<button class="btn btn-ghost btn-xs" data-act="adm-p-del" data-id="${p.id}" data-name="${esc(p.name)}">${icon('trash')}</button>` : ''}
            </div>
          </td>
        </tr>`),
    ) : emptyState({ icon: 'box', title: t('common.noResult'), action: can('products.create') ? { href: '#/admin/products/new', label: t('adm.productNew') } : null })}

    <div class="mt" data-page="${r.page}" data-pages="${r.pages}">${pagination(r.page || 1, r.pages || 1, href)}</div>`;
}

act('adm-p-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  F.q = String(fd.get('q') || '').trim();
  F.cat = String(fd.get('cat') || '');
  F.brand = String(fd.get('brand') || '');
  F.status = String(fd.get('status') || '');
  F.page = 1;
  refresh(true);
});
act('adm-p-clear', () => { Object.assign(F, { q: '', cat: '', brand: '', status: '', page: 1 }); refresh(true); });
act('adm-p-del', async (e, el) => {
  const ok = await confirmDelete(el.dataset.name);
  if (!ok) return;
  try { await api.del(`/api/admin/products/${el.dataset.id}`); toastSuccess(t('adm.pDeleted')); refresh(true); }
  catch (err) { toastApiError(err); }
});

// ── فرم کالا ────────────────────────────────────────────────
function editor(p) {
  const isNew = !p;
  E.editing = p || null;
  E.images = [...(p?.images || [])];
  E.specs = Object.entries(p?.specs || {}).map(([key, value]) => ({ key, value }));
  E.tags = [...(p?.tags || [])];

  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon(isNew ? 'plus' : 'edit')} ${isNew ? t('adm.productNew') : t('adm.productEdit')}</h2>
      <div class="row row-wrap">
        <a class="btn btn-ghost btn-sm" href="#/admin/products">${icon('arrow-right')} ${t('adm.products')}</a>
        ${!isNew ? h`<a class="btn btn-ghost btn-sm" href="#/product/${p.id}" target="_blank" rel="noopener">${icon('external')} ${t('common.view')}</a>` : ''}
      </div>
    </div>

    <form data-act="adm-p-save" data-id="${p?.id || ''}">
      <div class="card">
        <div class="form-grid">
          ${field({ label: t('adm.pName'), name: 'name', required: true, value: p?.name || '' })}
          ${field({ label: t('adm.pNameEn'), name: 'nameEn', value: p?.nameEn || '' })}
          ${selectField({ label: t('adm.pCat'), name: 'categoryId', value: p?.categoryId || '', options: S.categories.map((c) => ({ value: c.id, label: catName(c) })) })}
          
          ${selectField({
            label: isFa() ? "وضعیت کالا" : "Condition",
            name: "condition",
            value: p?.condition || 'new',
            options: [
              { value: 'new', label: isFa() ? 'نو (آکبند)' : 'New' },
              { value: 'used', label: isFa() ? 'دست دوم' : 'Used' },
              { value: 'refurbished', label: isFa() ? 'تعمیر شده' : 'Refurbished' }
            ]
          })}
          ${selectField({ label: t('adm.pBrand'), name: 'brandId', value: p?.brandId || '', options: S.brands.map((b) => ({ value: b.id, label: brandName(b) })) })}
          ${field({ label: t('adm.pSku'), name: 'sku', value: p?.sku || '', hint: isFa() ? 'خالی بگذاری خودکار ساخته می‌شود' : 'Leave empty to auto-generate' })}
          ${selectField({
            label: isFa() ? "اصالت کالا" : "Authenticity",
            name: "authenticity",
            value: p?.authenticity || 'generic',
            options: [
              { value: 'generic', label: isFa() ? 'معمولی / متفرقه' : 'Generic' },
              { value: 'original', label: isFa() ? 'اورجینال (Original)' : 'Original' },
              { value: 'highcopy', label: isFa() ? 'های‌کپی (High Copy)' : 'High Copy' }
            ]
          })}
          ${field({ label: isFa() ? "گارانتی (ماه)" : "Warranty (Months)", name: "warrantyMonths", type: "number", value: p?.warrantyMonths || 0, hint: '0 = بدون گارانتی' })}

          ${field({ label: isFa() ? "تلفن تماس اختصاصی" : "Contact Phone", name: "contactPhone", value: p?.contactPhone || "", hint: isFa() ? "برای خدمات و کالاهای خاص که نیاز به تماس با شماره متفاوتی دارند" : "Specific number for this product/service" })}
          ${field({ label: t('adm.pBarcode'), name: 'barcode', value: p?.barcode || '', attrs: 'inputmode="numeric"' })}
          ${field({ label: t('adm.pPrice'), name: 'price', type: 'number', required: true, value: p?.price ?? '' })}
          ${field({ label: t('adm.pOldPrice'), name: 'oldPrice', type: 'number', value: p?.oldPrice ?? 0 })}
          ${field({ label: t('adm.pStock'), name: 'stock', type: 'number', required: true, value: p?.stock ?? 1 })}
          ${field({ label: t('adm.pWeight'), name: 'weight', type: 'number', value: p?.weight ?? 0 })}
          ${field({ label: t('adm.pWarranty'), name: 'warrantyMonths', type: 'number', value: p?.warrantyMonths ?? 0 })}
          ${selectField({
            label: t('adm.pAuth'), name: 'authenticity', value: p?.authenticity || 'generic',
            options: ['original', 'highcopy', 'generic'].map((a) => ({ value: a, label: t(`auth.${a}`) })),
          })}
        </div>
        ${!isNew && can('barcode.print') ? h`
          <div class="row row-wrap mt-s">
            <button type="button" class="btn btn-ghost btn-sm" data-act="adm-p-barcode" data-id="${p.id}">${icon('barcode')} ${t('adm.bGenerate')}</button>
            ${p.barcode ? h`<code class="tag mono">${p.barcode}</code>` : ''}
          </div>` : ''}
      </div>

      <div class="card mt">
        <strong>${icon('file')} ${t('pdp.description')}</strong>
        <div class="mt-s">${textareaField({ label: 'فارسی', name: 'description', value: p?.description || '', rows: 5 })}</div>
        ${textareaField({ label: 'English', name: 'descriptionEn', value: p?.descriptionEn || '', rows: 4 })}
      </div>

      <div class="card mt">
        <div class="row row-between row-wrap">
          <strong>${icon('image')} ${t('adm.pImages')} (${fmtNum(E.images.length)}/8)</strong>
          <div class="row row-wrap">
            ${can('products.create') ? h`<button type="button" class="btn btn-ghost btn-sm" data-act="adm-p-find" data-name="${esc(p?.nameEn || p?.name || '')}">${icon('search')} ${t('adm.pFindImage')}</button>` : ''}
            <label class="btn btn-ghost btn-sm" for="adm-p-file">${icon('upload')} ${t('adm.pUpload')}</label>
            <input id="adm-p-file" type="file" accept="image/*" multiple hidden data-img-input>
          </div>
        </div>
        <div class="img-list mt-s" data-img-list>${imagesHtml()}</div>
        <div class="mt">
          ${textareaField({ label: t('adm.pVideos'), name: 'videos', value: (p?.videos || []).join('\n'), rows: 2, hint: t('adm.pVideosHint') })}
        </div>
      </div>

      <div class="card mt">
        <div class="row row-between">
          <strong>${icon('list')} ${t('adm.pSpecs')}</strong>
          <button type="button" class="btn btn-ghost btn-sm" data-act="adm-p-spec-add">${icon('plus')} ${t('adm.pAddSpec')}</button>
        </div>
        <div class="mt-s" data-spec-list>${specsHtml()}</div>
      </div>

      <div class="card mt">
        <strong>${icon('tag')} ${t('adm.pTags')}</strong>
        <div class="mt-s" data-tag-list>${tagsHtml()}</div>
        <div class="row mt-s">
          <input class="input" data-tag-input placeholder="${isFa() ? 'برچسب جدید و Enter' : 'New tag and Enter'}" maxlength="30">
          <button type="button" class="btn btn-ghost btn-sm" data-act="adm-p-tag-add">${icon('plus')}</button>
        </div>
      </div>

      <div class="card mt">
        ${switchField({ label: t('adm.pFeatured'), name: 'featured', checked: !!p?.featured })}
        ${switchField({ label: t('adm.pActive'), name: 'active', checked: p ? p.active !== false : true })}
        ${feat('oldPrice') ? switchField({ label: t('adm.pOldPriceTag'), desc: t('adm.pOldPriceTagDesc'), name: 'oldPriceTag', checked: !!p?.oldPriceTag }) : ''}
      </div>

      <div class="card mt">
        <strong>${icon('share')} ${isFa() ? 'انتشار خودکار در شبکه‌های اجتماعی' : 'Social Auto-Publishing'}</strong>
        <p class="muted small mt-s">${isFa() ? 'با فعال کردن هر گزینه، کارت محصول بلافاصله پس از ذخیره به کانال یا صفحه ارسال می‌شود.' : 'Post product card to social channels upon saving.'}</p>
        <div class="grid gap-2 mt-s">
          ${switchField({ label: isFa() ? '📢 انتشار خودکار در کانال تلگرام یاسایی' : '📢 Auto-post to Telegram channel', name: 'publishTelegram', checked: false })}
          ${switchField({ label: isFa() ? '📸 ثبت خودکار در صف اینستاگرام یاسایی' : '📸 Queue auto-post for Instagram', name: 'publishInstagram', checked: false })}
        </div>
      </div>

      <div class="row row-wrap mt">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
        <a class="btn btn-ghost" href="#/admin/products">${t('common.cancel')}</a>
      </div>
    </form>`;
}

function imagesHtml() {
  if (!E.images.length) return h`<p class="muted small">${t('adm.pFindEmpty')}</p>`;
  return E.images.map((src, i) => h`
    <span class="img-item">
      <img src="${src}" alt="${t('img.alt')}" loading="lazy">
      <span class="img-tools">
        ${i > 0 ? h`<button type="button" data-act="adm-img-up" data-i="${i}" title="${t('common.prev')}">${icon('arrow-up')}</button>` : ''}
        <button type="button" data-act="adm-img-del" data-i="${i}" title="${t('common.delete')}">${icon('trash')}</button>
      </span>
      ${i === 0 ? h`<span class="img-main">${t('common.image')} ۱</span>` : ''}
    </span>`).join('');
}

function specsHtml() {
  if (!E.specs.length) return h`<p class="muted small">${t('common.empty')}</p>`;
  return E.specs.map((s, i) => h`
    <div class="spec-row">
      <input class="input" value="${esc(s.key)}" placeholder="${t('adm.pSpecKey')}" data-spec-k="${i}" maxlength="40">
      <input class="input" value="${esc(s.value)}" placeholder="${t('adm.pSpecVal')}" data-spec-v="${i}" maxlength="120">
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="adm-spec-del" data-i="${i}">${icon('trash')}</button>
    </div>`).join('');
}

function tagsHtml() {
  if (!E.tags.length) return h`<p class="muted small">${t('common.empty')}</p>`;
  return h`<div class="row row-wrap">${E.tags.map((tag, i) => h`
    <span class="chip">${esc(tag)}<button type="button" data-act="adm-tag-del" data-i="${i}" aria-label="${t('common.delete')}">${icon('close')}</button></span>`)}</div>`;
}

function paint(root, sel, html) {
  const box = (root || document).querySelector(sel);
  if (box) box.innerHTML = html;
  applyDyn(box || document);
}

// ── کنش‌های فرم ─────────────────────────────────────────────
act('adm-img-del', (e, el) => { E.images.splice(Number(el.dataset.i), 1); paint(null, '[data-img-list]', imagesHtml()); });
act('adm-img-up', (e, el) => {
  const i = Number(el.dataset.i);
  const [x] = E.images.splice(i, 1);
  E.images.splice(i - 1, 0, x);
  paint(null, '[data-img-list]', imagesHtml());
});
act('adm-p-spec-add', () => { E.specs.push({ key: '', value: '' }); paint(null, '[data-spec-list]', specsHtml()); });
act('adm-spec-del', (e, el) => { E.specs.splice(Number(el.dataset.i), 1); paint(null, '[data-spec-list]', specsHtml()); });
act('adm-p-tag-add', () => {
  const input = document.querySelector('[data-tag-input]');
  const v = String(input?.value || '').trim();
  if (!v) return;
  if (!E.tags.includes(v) && E.tags.length < 20) E.tags.push(v);
  if (input) input.value = '';
  paint(null, '[data-tag-list]', tagsHtml());
});
act('adm-tag-del', (e, el) => { E.tags.splice(Number(el.dataset.i), 1); paint(null, '[data-tag-list]', tagsHtml()); });

act('adm-p-barcode', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const r = await api.post('/api/admin/barcode/generate', { productId: el.dataset.id, count: 1 });
      const code = r.codes?.[0]?.barcode || r.codes?.[0] || '';
      if (code) {
        const input = document.querySelector('[name=barcode]');
        if (input) input.value = code;
        toastSuccess(t('adm.bGenerated'));
      }
    } catch (err) { toastApiError(err); }
  });
});

// ── بستهٔ پست اینستاگرام: تصویر + متن آمادهٔ کپی + قیمت + هشتگ ──
function igCaption(p) {
  const st = store();
  const name = isFa() ? p.name : (p.nameEn || p.name);
  const nf = (n) => Number(n || 0).toLocaleString(isFa() ? 'fa-IR' : 'en-US');
  const old = Number(p.oldPrice || 0);
  const stock = Math.max(0, (p.stock || 0) - (p.reserved || 0));
  const link = `${location.origin}/#/product/${p.id}`;
  const desc = String(isFa() ? (p.description || '') : (p.descriptionEn || p.description || '')).split('\n')[0].trim().slice(0, 160);
  const rows = isFa() ? [
    `✨ ${name} ✨`,
    desc,
    '',
    `💰 قیمت: ${nf(p.price)} تومان${old > p.price ? ` (به‌جای ${nf(old)} — ${fmtNum(p.discountPct || 0)}٪ تخفیف)` : ''}`,
    stock > 0 ? '📦 موجود در انبار — همین حالا سفارش بده' : '📦 فعلاً ناموجود؛ پیام بده تا موجود شد خبرت کنیم',
    '🛡 ضمانت اصالت کالا + مهلت تست و مرجوع تا ۷ روز',
    '🚚 ارسال از تهران به سراسر ایران',
    '',
    `🔗 سفارش آنلاین: ${link}`,
    `📞 تلفن: ${st.phone || ''} · 🍏 اینستاگرام: @jam.yassaei`,
  ] : [
    `✨ ${name} ✨`,
    desc,
    '',
    `💰 Price: ${nf(p.price)} Toman${old > p.price ? ` (was ${nf(old)})` : ''}`,
    '🛡 Authenticity guarantee + 7-day return',
    `🔗 Order: ${link}`,
    `📞 ${st.phone || ''}`,
  ];
  return rows.filter((x, i, a) => !(x === '' && (a[i - 1] === '' || i === 0))).join('\n');
}

function igTags(p) {
  const base = isFa()
    ? ['یاسایی', 'لوازم_الکترونیک', 'قطعات', 'تهران', 'نارمک', 'خرید_آنلاین']
    : ['Yassaei', 'Electronics', 'Parts', 'Tehran', 'OnlineShopping'];
  const extra = [p.brandName, p.categoryName].filter(Boolean).map((x) => String(x).trim().replace(/\s+/g, '_'));
  return [...new Set([...base, ...extra])].map((x) => `#${x}`).join(' ');
}

act('adm-p-igpack', async (e, el) => {
  let p = null;
  try { p = (await api.get(`/api/admin/products/${el.dataset.id}`)).product; } catch (err) { toastApiError(err); return; }
  const img = (p.images || [])[0] || '';
  modal({
    title: `${icon('camera')} ${t('adm.igPack')}`,
    subtitle: isFa() ? p.name : (p.nameEn || p.name),
    body: h`
      ${img ? h`
        <div class="row row-wrap mb">
          <img class="igpack-img" src="${esc(img)}" alt="">
          <div class="grow">
            <p class="small muted">${t('adm.igImgHint')}</p>
            <a class="btn btn-ghost btn-sm mt-s" href="${esc(img)}" download="yassaei-${esc(p.sku || p.id)}.jpg" target="_blank" rel="noopener">${icon('download')} ${t('adm.igDl')}</a>
          </div>
        </div>` : h`<p class="notice notice-warn mb">${icon('info')}<span>${t('adm.igNoImg')}</span></p>`}
      ${textareaField({ label: t('adm.igCap'), name: 'igcap', rows: 10, value: igCaption(p) })}
      ${textareaField({ label: t('adm.igTags'), name: 'igtags', rows: 2, value: igTags(p) })}
      <div class="row row-wrap mt-s">
        <button type="button" class="btn btn-primary btn-sm" data-act="adm-ig-copy" data-what="cap">${icon('copy')} ${t('adm.igCopyCap')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="adm-ig-copy" data-what="tags">${icon('copy')} ${t('adm.igCopyTags')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="adm-ig-copy" data-what="all">${icon('copy')} ${t('adm.igCopyAll')}</button>
      </div>`,
  });
});

act('adm-ig-copy', async (e, el) => {
  const panel = el.closest('.modal');
  const cap = panel?.querySelector('[name=igcap]')?.value || '';
  const tags = panel?.querySelector('[name=igtags]')?.value || '';
  const text = el.dataset.what === 'tags' ? tags : el.dataset.what === 'all' ? `${cap}\n\n${tags}` : cap;
  try { await copyText(text); toastSuccess(t('common.copied'), { timeout: 1800 }); }
  catch { toastApiError(new Error(t('err.generic'))); }
});

act('adm-p-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const specs = {};
  form.querySelectorAll('[data-spec-k]').forEach((k) => {
    const i = k.dataset.specK;
    const v = form.querySelector(`[data-spec-v="${i}"]`);
    const key = String(k.value || '').trim();
    if (key) specs[key] = String(v?.value || '').trim();
  });
  const id = form.dataset.id;
  const payload = {
    name: fd.get('name'), nameEn: fd.get('nameEn') || '',
    categoryId: fd.get('categoryId') || '', brandId: fd.get('brandId') || '',
    sku: fd.get('sku') || '', barcode: fd.get('barcode') || '', contactPhone: fd.get('contactPhone') || '', 
    price: Number(fd.get('price') || 0), oldPrice: Number(fd.get('oldPrice') || 0),
    cost: Number(fd.get('cost') || E.editing?.cost || 0), stock: Number(fd.get('stock') || 0),
    weight: Number(fd.get('weight') || 0), warrantyMonths: Number(fd.get('warrantyMonths') || 0),
    authenticity: fd.get('authenticity') || 'generic',
    description: fd.get('description') || '', descriptionEn: fd.get('descriptionEn') || '',
    images: E.images.slice(0, 8), videos: String(form.videos?.value || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 4), specs, tags: E.tags.slice(0, 20),
    featured: fd.get('featured') === 'on', active: fd.get('active') === 'on',
    oldPriceTag: fd.get('oldPriceTag') === 'on',
    publishTelegram: fd.get('publishTelegram') === 'on',
    publishInstagram: fd.get('publishInstagram') === 'on',
  };
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      if (id) { await api.patch(`/api/admin/products/${id}`, payload); toastSuccess(t('adm.pSaved')); }
      else {
        const r = await api.post('/api/admin/products', payload);
        toastSuccess(t('adm.pCreated'));
        if (r.product?.id) { navigate(`#/admin/products/${r.product.id}`); return; }
      }
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

// ── جست‌وجوی خودکار تصویر ───────────────────────────────────
act('adm-p-find', (e, el) => {
  const handle = modal({
    title: t('adm.pFindImage'),
    size: 'lg',
    body: h`
      <form data-act="adm-find-run" class="row row-wrap mb">
        <input class="input grow" name="query" value="${esc(el.dataset.name || '')}" placeholder="${t('adm.pName')}" required>
        <select class="select" name="lang" data-w="110px">
          <option value="en">English</option>
          <option value="fa">فارسی</option>
        </select>
        <button class="btn btn-primary" type="submit">${icon('search')} ${t('common.search')}</button>
      </form>
      <p class="hint mb-s">${t('adm.pFindImageHint')}</p>
      <div data-find-results>${spinner(t('adm.pFindSearching'))}</div>`,
    onMount: (panel) => {
      panel.querySelector('[name=query]')?.focus();
      panel.dataset.findBox = '1';
      const q = el.dataset.name || '';
      if (q) runFind(panel.querySelector('[data-find-results]'), q, 'en');
    },
  });
  void handle;
});

async function runFind(box, query, langCode) {
  if (box) box.innerHTML = spinner(t('adm.pFindSearching'));
  try {
    const r = await api.post('/api/admin/find-image', { query, lang: langCode });
    const items = r.items || [];
    if (box) {
      box.innerHTML = items.length ? h`<div class="find-grid">${items.map((it, i) => h`
        <div class="find-item">
          <img src="/api/admin/image-thumb?url=${encodeURIComponent(it.thumbnail || it.url)}" alt="${esc(it.title || '')}" loading="lazy">
          <div class="find-meta">
            <div class="tiny b">${esc((it.title || '').slice(0, 60))}</div>
            <div class="tiny muted">${esc(it.license || '')} · ${esc(it.source || '')}${it.creator ? ` · ${esc(it.creator)}` : ''}</div>
          </div>
          <button type="button" class="btn btn-primary btn-xs" data-act="adm-find-use" data-url="${esc(it.url)}">${t('adm.pUseImage')}</button>
        </div>`).join('')}</div>`
        : emptyState({ icon: 'image', title: t('adm.pFindEmpty') });
    }
  } catch (err) {
    if (box) box.innerHTML = h`<p class="notice notice-danger">${icon('alert')}<span>${esc(err?.message || t('err.network'))}</span></p>`;
  }
}

act('adm-find-run', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const panel = form.closest('.modal');
  runFind(panel?.querySelector('[data-find-results]'), String(fd.get('query') || ''), String(fd.get('lang') || 'en'));
});

act('adm-find-use', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const r = await api.post('/api/admin/fetch-image', { url: el.dataset.url });
      if (r.url && !E.images.includes(r.url) && E.images.length < 8) E.images.push(r.url);
      paint(null, '[data-img-list]', imagesHtml());
      toastSuccess(t('adm.pSaved'));
      el.closest('.overlay')?.querySelector('[data-lx]')?.click();
    } catch (err) { toastApiError(err); }
  });
});

// ── مانت ────────────────────────────────────────────────────
export function mount(root) {
  applyDyn(root);
  const fileInput = root.querySelector('[data-img-input]');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const files = [...(fileInput.files || [])].slice(0, 8 - E.images.length);
      fileInput.value = '';
      for (const f of files) {
        if (f.size > 4 * 1024 * 1024) { toast(`${t('err.tooLarge')}: ${f.name}`, { type: 'warn' }); continue; }
        try {
          const dataUrl = await fileToDataURL(f);
          const r = await api.upload(dataUrl);
          if (r.url) E.images.push(r.url);
        } catch (err) { toastApiError(err); }
      }
      paint(root, '[data-img-list]', imagesHtml());
    });
  }
  const tagInput = root.querySelector('[data-tag-input]');
  if (tagInput) {
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-act="adm-p-tag-add"]')?.click(); }
    });
  }
  // صفحه‌بندی بدون تغییر نشانی
  root.querySelectorAll('.pagination .pg').forEach((a) => {
    a.addEventListener('click', (e) => {
      const m = /page=(\d+)/.exec(a.getAttribute('href') || '');
      if (!m) return;
      e.preventDefault();
      const p = Number(m[1]);
      if (p >= 1) { F.page = p; refresh(true); }
    });
  });
  return null;
}


// تغییر سریع موجودی (data-act="p-stk" data-id=… data-val=±n)؛ موجودی فعلی از سرور خوانده می‌شود
act('p-stk', async (e, el) => {
  const diff = parseInt(el.dataset.val, 10) || 0;
  const id = el.dataset.id;
  if (!id || !diff) return;
  await withBusy(el, async () => {
    try {
      const r = await api.get(`/api/admin/products/${id}`);
      const newStock = Math.max(0, (Number(r?.product?.stock) || 0) + diff);
      await api.patch(`/api/admin/products/${id}`, { stock: newStock });
      toastSuccess('موجودی به‌روز شد');
      refresh(true);
    } catch (err) {
      toastApiError(err);
    }
  });
});
