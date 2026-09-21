import { html as h, icon, esc, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { S, refreshBootstrap, can } from '../../state.mjs';
import { toastSuccess, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { renderAdminNav } from './admin-nav.mjs';
import { api } from '../../lib/api.mjs';

const SECTIONS = [
  { id: 'hero', name: 'بنر اصلی (هیرو)' },
  { id: 'strip', name: 'بنر باریک زیر هیرو' },
  { id: 'categories', name: 'دسته‌بندی‌های اصلی' },
  { id: 'partners', name: 'نوار متحرک برندها' },
  { id: 'featured', name: 'لیست محصولات ویژه' },
  { id: 'deals', name: 'لیست شگفت‌انگیز' },
  { id: 'oldPriced', name: 'کالاهای به قیمت خرید قبل' },
  { id: 'best', name: 'لیست پرفروش‌ترین‌ها' },
  { id: 'refurbished', name: 'کالاهای دست دوم و تعمیر شده' },
  { id: 'fresh', name: 'لیست تازه‌ها' },
  { id: 'brands', name: 'تگ برندها' },
  { id: 'partFinder', name: 'باکس تماس و پیداکننده قطعه' },
  { id: 'whyUs', name: 'ویژگی‌های فروشگاه (چرا ما)' },
  { id: 'stats', name: 'آمار زنده' },
  { id: 'plus', name: 'بنر پلاس' },
  { id: 'visitStore', name: 'باکس دانلود اپلیکیشن و آدرس' },
  { id: 'recent', name: 'بازدیدهای اخیر کاربر' },
  { id: 'minimap', name: 'نقشه فروشگاه (فوتر)' },
  { id: 'buyback', name: 'بنر خریدار کالای دست دوم' },
];

let currentOrder = [];

function initOrder() {
  const overrides = S.settings?.layout?.homeOrder;
  if (overrides && Array.isArray(overrides)) {
    // Merge known and unknown
    const existing = overrides.filter(id => SECTIONS.find(s => s.id === id));
    const missing = SECTIONS.filter(s => !overrides.includes(s.id)).map(s => s.id);
    currentOrder = [...existing, ...missing];
  } else {
    currentOrder = SECTIONS.map(s => s.id);
  }
}

function renderList() {
  const hidden = S.settings?.layout?.homeHidden || [];
  
  return h`
    <div class="card mb-l" id="layout-list">
      <h3>${icon('layout')} چیدمان صفحه اصلی</h3>
      <p class="muted small mb">برای تغییر ترتیب، بخش‌ها را بگیرید و بالا/پایین بکشید. برای مخفی کردن، روی آیکون چشم کلیک کنید.</p>
      
      <div class="layout-items f-col gap-10 mt" id="sortable-list">
        ${currentOrder.map(id => {
          const sec = SECTIONS.find(s => s.id === id);
          if (!sec) return '';
          const isHidden = hidden.includes(id);
          return h`
            <div class="layout-item panel p-s f-row row-between" data-id="${id}" style="border: 1px solid var(--border); border-radius: 8px; cursor: grab; background: ${isHidden ? 'var(--bg-card)' : 'var(--bg-body)'}; opacity: ${isHidden ? '0.6' : '1'};">
              <div class="f-row gap-10 align-center">
                <div style="cursor: grab; color: var(--text-muted); padding: 5px;">${icon('menu')}</div>
                <strong style="${isHidden ? 'text-decoration: line-through;' : ''}">${sec.name}</strong>
              </div>
              <div>
                ${id === 'buyback' ? '<span class="badge badge-success" style="font-size:0.7rem;">همیشه فعال</span>' : `<button class="btn btn-ghost btn-sm" data-act="ly-toggle" data-id="${id}" title="${isHidden ? 'نمایش' : 'مخفی کردن'}">\n                  ${icon(isHidden ? 'eye-off' : 'eye')}\n                </button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="mt-l">
        <button class="btn btn-primary" data-act="ly-save">${icon('save')} ذخیره تغییرات</button>
      </div>
    </div>
  `;
}

export async function render(ctx) {
  initOrder();
  const adminTab = ctx.params.id === 'adminNav';
  const tabs = h`<div class="tabs mb">
    <a class="tab ${!adminTab ? 'active' : ''}" href="#/admin/layout">${isFa() ? 'چیدمان سایت' : 'Store layout'}</a>
    ${can('settings.edit') ? h`<a class="tab ${adminTab ? 'active' : ''}" href="#/admin/layout/adminNav">${isFa() ? 'مدیریت منوهای پنل مدیریت' : 'Admin sidebar navigation'}</a>` : ''}
  </div>`;
  if (adminTab) return h`${tabs}${can('settings.edit') ? await renderAdminNav() : t('adm.noPermission')}`;
  return h`
    <div class="row row-between mb">
      <h2>${icon('layout')} ${isFa() ? 'چیدمان و منوها' : 'Layout & Menus'}</h2>
    </div>
    ${tabs}
    <p class="notice notice-info mb-l">${icon('info')} این بخش به شما اجازه می‌دهد چینش و نمایش بخش‌های سایت را بدون کدنویسی تغییر دهید.</p>
    <div class="card mb-l row row-between row-wrap">
      <span>${icon('layout')} <b>مدیریت منوها و بخش‌ها</b><span class="muted small"> — نمایش/مخفی کردن دکمه‌ها، تغییر نام، آیکون و ترتیب منوی کاربری، ناوبری سایت و نوار موبایل.</span></span>
      <a class="btn btn-primary btn-sm" href="#/admin/settings/nav">${icon('settings')} باز کردن</a>
    </div>
    
    <div id="ly-root">
      ${renderList()}
    </div>
  `;
}

export function mount(root) {
  applyDyn(root);
  
  // Simple drag and drop logic
  let draggedEl = null;
  const list = root.querySelector('#sortable-list');
  if (!list) return;
  
  list.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('layout-item')) {
      draggedEl = e.target;
      e.target.style.opacity = '0.4';
    }
  });
  
  list.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('layout-item')) {
      e.target.style.opacity = e.target.querySelector('button[data-act="ly-toggle"]')?.title === 'نمایش' ? '0.6' : '1';
      draggedEl = null;
      updateCurrentOrder();
    }
  });
  
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedEl) return;
    const target = e.target.closest('.layout-item');
    if (target && target !== draggedEl) {
      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) target.parentNode.insertBefore(draggedEl, target);
      else target.parentNode.insertBefore(draggedEl, target.nextSibling);
    }
  });
  
  // Make items draggable
  root.querySelectorAll('.layout-item').forEach(el => el.setAttribute('draggable', 'true'));
}

function updateCurrentOrder() {
  const list = document.querySelector('#sortable-list');
  if (list) {
    currentOrder = Array.from(list.querySelectorAll('.layout-item')).map(el => el.dataset.id);
  }
}

act('ly-toggle', (e, el) => {
  const id = el.dataset.id;
  const hidden = S.settings?.layout?.homeHidden || [];
  
  if (!S.settings.layout) S.settings.layout = {};
  if (!S.settings.layout.homeHidden) S.settings.layout.homeHidden = [];
  
  if (hidden.includes(id)) {
    S.settings.layout.homeHidden = hidden.filter(x => x !== id);
  } else {
    S.settings.layout.homeHidden.push(id);
  }
  
  const root = document.querySelector('#ly-root');
  if (root) {
    root.innerHTML = renderList();
    mount(root); // rebind drag/drop
  }
});

act('ly-save', async (e, el) => {
  await withBusy(el, async () => {
    try {
      updateCurrentOrder();
      
      const payload = {
        value: {
          homeOrder: currentOrder,
          homeHidden: S.settings?.layout?.homeHidden || []
        }
      };
      
      await api.patch('/api/admin/settings/layout', payload);
      await refreshBootstrap();
      toastSuccess(t('common.success'));
    } catch (err) {
      toastApiError(err);
    }
  });
});
