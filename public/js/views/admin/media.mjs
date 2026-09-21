import { html as h, icon, esc, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { S, refreshBootstrap } from '../../state.mjs';
import { toastSuccess, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { api } from '../../lib/api.mjs';

function renderList() {
  const media = S.settings?.media || {};
  
  const fields = [
    { id: 'logo', label: 'لوگوی اصلی سایت (مربع یا مستطیل)', hint: 'آدرس URL تصویر را وارد کنید', val: media.logo || '' },
    { id: 'favicon', label: 'فاوآیکون (نماد کنار تب مرورگر)', hint: 'مربع و کوچک (ترجیحاً SVG یا PNG)', val: media.favicon || '' },
    { id: 'heroBg', label: 'پس‌زمینه بنر هیرو', hint: 'تصویر اصلی بالای صفحه', val: media.heroBg || '' },
    { id: 'heroImg', label: 'عکس کنار بنر هیرو', hint: 'اگر هیرو به صورت split باشد', val: media.heroImg || '' },
  ];
  
  return h`
    <div class="card mb-l" id="media-form">
      <h3>${icon('image')} مدیریت تصاویر ثابت سایت</h3>
      <p class="muted small mb">آدرس تصاویر مورد نظر خود را در فیلدهای زیر وارد کنید تا جایگزین تصاویر پیش‌فرض قالب شوند.</p>
      
      <div class="f-col gap-15 mt">
        ${fields.map(f => h`
          <div class="panel p-m" style="border: 1px solid var(--border); border-radius: 8px;">
            <label class="field mb-0">
              <span class="label b">${f.label}</span>
              <input type="text" class="input ltr" data-key="${f.id}" value="${esc(f.val)}" placeholder="${f.hint}">
            </label>
            ${f.val ? h`<img src="${esc(f.val)}" style="max-height: 50px; margin-top: 10px; border-radius: 4px;" alt="preview">` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="mt-l">
        <button class="btn btn-primary" data-act="md-save">${icon('save')} ذخیره تغییرات رسانه</button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  return h`
    <div class="row row-between mb">
      <h2>${icon('image')} ${isFa() ? 'رسانه‌ها و بنرها' : 'Media Manager'}</h2>
    </div>
    <div id="md-root">
      ${renderList()}
    </div>
  `;
}

export function mount(root) {
  applyDyn(root);
}

act('md-save', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const root = document.querySelector('#md-root');
      const inputs = root.querySelectorAll('input[data-key]');
      const media = {};
      
      inputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) media[inp.dataset.key] = val;
      });
      
      const payload = { value: media };
      
      await api.patch('/api/admin/settings/media', payload);
      await refreshBootstrap();
      
      toastSuccess(t('common.success'));
      
      // Update the UI dynamically
      if (root) {
        root.innerHTML = renderList();
        applyDyn(root);
      }
      
      // Apply immediately to the DOM if possible
      if (media.favicon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = media.favicon;
      }
      if (media.logo) {
        document.querySelectorAll('.hdr-logo img').forEach(img => img.src = media.logo);
      }
      
    } catch (err) {
      toastApiError(err);
    }
  });
});
