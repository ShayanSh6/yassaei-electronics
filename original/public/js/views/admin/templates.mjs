import { html as h, icon, esc, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { S, refreshBootstrap } from '../../state.mjs';
import { toastSuccess, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { api } from '../../lib/api.mjs';

function renderList() {
  const notifs = S.settings?.notifications || {};
  
  const fields = [
    { id: 'otpSms', label: 'متن پیامک کد تایید (OTP)', hint: 'مثال: کد تایید شما: {code}', val: notifs.otpSms || '' },
    { id: 'orderConfirmed', label: 'پیامک تایید سفارش', hint: 'متغیرها: {orderCode}, {name}, {total}', val: notifs.orderConfirmed || '' },
    { id: 'orderShipped', label: 'پیامک ارسال سفارش', hint: 'متغیرها: {orderCode}, {name}, {tracking}', val: notifs.orderShipped || '' },
    { id: 'tgWelcome', label: 'پیام خوش‌آمدگویی ربات تلگرام', hint: 'متن پیش‌فرض منوی استارت', val: notifs.tgWelcome || '' },
  ];
  
  return h`
    <div class="card mb-l" id="tmpl-form">
      <h3>${icon('mail')} قالب پیام‌های سیستم</h3>
      <p class="muted small mb">می‌توانید متن‌های ارسال شده به کاربر در رویدادهای مختلف را شخصی‌سازی کنید. در صورت خالی گذاشتن، از متن پیش‌فرض سیستم استفاده می‌شود.</p>
      
      <div class="f-col gap-15 mt">
        ${fields.map(f => h`
          <div class="panel p-m" style="border: 1px solid var(--border); border-radius: 8px;">
            <label class="field mb-0">
              <span class="label b">${f.label}</span>
              <textarea class="textarea" data-key="${f.id}" rows="2" placeholder="${f.hint}">${esc(f.val)}</textarea>
            </label>
          </div>
        `).join('')}
      </div>
      
      <div class="mt-l">
        <button class="btn btn-primary" data-act="tp-save">${icon('save')} ذخیره قالب‌ها</button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  return h`
    <div class="row row-between mb">
      <h2>${icon('mail')} ${isFa() ? 'قالب پیام‌ها' : 'Message Templates'}</h2>
    </div>
    <div id="tp-root">
      ${renderList()}
    </div>
  `;
}

export function mount(root) {
  applyDyn(root);
}

act('tp-save', async (e, el) => {
  await withBusy(el, async () => {
    try {
      const root = document.querySelector('#tp-root');
      const inputs = root.querySelectorAll('textarea[data-key]');
      const notifs = {};
      
      inputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) notifs[inp.dataset.key] = val;
      });
      
      const payload = { value: notifs };
      
      await api.patch('/api/admin/settings/notifications', payload);
      await refreshBootstrap();
      
      toastSuccess(t('common.success'));
      
      // Update the UI dynamically
      if (root) {
        root.innerHTML = renderList();
        applyDyn(root);
      }
    } catch (err) {
      toastApiError(err);
    }
  });
});
