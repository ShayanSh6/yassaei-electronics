// ─────────────────────────────────────────────────────────────
//  فرصت‌های شغلی — صفحهٔ عمومی آگهی‌های استخدام + فرم درخواست
//  (مهمان هم می‌تواند درخواست بدهد؛ رزومه اختیاری است)
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fileToDataURL, applyDyn } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S } from '../state.mjs';
import { field, textareaField } from '../components.mjs';
import { toastSuccess, toastApiError, toast, adaptive, withBusy, errorState, spinner, emptyState } from '../ui.mjs';
import { act } from '../actions.mjs';

let DATA = { openings: [] };
const E = { uploading: false };

export async function render(ctx) {
  let r;
  try {
    r = await api.get('/api/careers');
  } catch (err) {
    if (err?.status === 404) {
      return emptyState({ icon: 'users', title: t('nav.careers'), text: t('careers.empty') });
    }
    return errorState({ title: err?.message || t('err.generic') });
  }
  DATA = r || { openings: [] };
  const openings = DATA.openings || [];

  return h`
    <section class="section">
      <div class="section-head">
        <div>
          <h1 class="section-title">${icon('users')} ${t('careers.title')}</h1>
          <p class="section-sub">${t('careers.sub')}</p>
        </div>
      </div>

      ${openings.length ? h`
      <div class="job-list">
        ${openings.map((o) => jobCard(o)).join('')}
      </div>` : h`
      <div class="card">${emptyState({ icon: 'users', title: t('careers.empty') })}</div>`}
    </section>`;
}

function jobCard(o) {
  const title = isFa() ? o.title : (o.titleEn || o.title);
  const meta = [
    o.department ? `${icon('store')} ${esc(o.department)}` : '',
    o.workingHours ? `${icon('clock')} ${esc(o.workingHours)}` : '',
    o.location ? `${icon('pin')} ${esc(o.location)}` : '',
  ].filter(Boolean);
  return h`
    <article class="card job-card">
      <div class="job-head">
        <div>
          <h3 class="job-title">${esc(title)}</h3>
          <div class="job-meta">${meta.join('<span class="job-sep">·</span>')}</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-act="car-apply" data-id="${o.id}">${icon('send')} ${t('careers.apply')}</button>
      </div>
      ${o.description ? h`<p class="job-desc">${esc(o.description)}</p>` : ''}
      <div class="job-cols">
        ${(o.responsibilities || []).length ? h`
          <div>
            <div class="job-h">${icon('list')} ${t('careers.responsibilities')}</div>
            <ul class="job-ul">${o.responsibilities.map((x) => h`<li>${esc(x)}</li>`).join('')}</ul>
          </div>` : ''}
        ${(o.requirements || []).length ? h`
          <div>
            <div class="job-h">${icon('check-circle')} ${t('careers.requirements')}</div>
            <ul class="job-ul">${o.requirements.map((x) => h`<li>${esc(x)}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
      ${o.experience ? h`<p class="tiny muted mt-s">${icon('clock')} ${t('careers.experienceNeed')}: ${esc(o.experience)}</p>` : ''}
    </article>`;
}

// ── مودال درخواست ───────────────────────────────────────────
act('car-apply', (e, el) => {
  const o = (DATA.openings || []).find((x) => x.id === el.dataset.id);
  if (!o) return;
  const title = isFa() ? o.title : (o.titleEn || o.title);
  const handle = adaptive({
    title: `${icon('users')} ${t('careers.applyTitle')}`,
    subtitle: title,
    body: h`
      <form data-act="car-submit" data-id="${o.id}" class="car-form">
        <div class="form-grid">
          ${field({ label: t('careers.name'), name: 'name', required: true, value: S.me?.name || '', attrs: 'autocomplete="name"' })}
          ${field({ label: t('careers.phone'), name: 'phone', required: true, value: S.me?.phone || '', attrs: 'inputmode="numeric" autocomplete="tel" placeholder="09xxxxxxxxx"' })}
          ${field({ label: t('careers.age'), name: 'age', type: 'number', value: '', attrs: 'min="16" max="80"' })}
          ${field({ label: t('careers.education'), name: 'education', value: '', placeholder: isFa() ? 'مثلاً: کارشناسی برق' : 'e.g. BSc Electrical' })}
          ${textareaField({ label: t('careers.experience'), name: 'experience', value: '', placeholder: t('careers.experiencePh'), rows: 3 })}
        </div>
        <div class="mt-s">
          <div class="label">${t('careers.resume')} — ${t('careers.resumeHint')}</div>
          <label class="btn btn-ghost btn-sm car-file-btn" for="car-file">
            ${icon('upload')} ${t('common.upload')}
            <span class="muted tiny" data-car-fname></span>
          </label>
          <input id="car-file" type="file" accept="image/*,application/pdf" hidden data-car-file>
        </div>
        <div data-car-up></div>
        <div class="row row-wrap mt">
          <button class="btn btn-primary" type="submit">${icon('send')} ${t('careers.send')}</button>
        </div>
      </form>`,
  });
  const fileInput = handle?.panel?.querySelector('[data-car-file]');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      const nameSpan = handle.panel.querySelector('[data-car-fname]');
      const up = handle.panel.querySelector('[data-car-up]');
      if (!f) { if (nameSpan) nameSpan.textContent = ''; return; }
      if (f.size > 4 * 1024 * 1024) { toast(`${t('err.tooLarge')}: ${f.name}`, { type: 'warn' }); fileInput.value = ''; return; }
      if (nameSpan) nameSpan.textContent = ` · ${f.name}`;
      E.uploading = true;
      if (up) up.innerHTML = spinner(t('common.uploading') || '…');
      try {
        const dataUrl = await fileToDataURL(f);
        const r = await api.upload(dataUrl);
        if (r?.url) fileInput.dataset.url = r.url;
      } catch (err) { toastApiError(err); if (up) up.innerHTML = ''; }
      finally { E.uploading = false; }
    });
  }
});

act('car-submit', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const fileInput = form.querySelector('[data-car-file]');
  const resumeUrl = fileInput?.dataset.url || '';
  if (E.uploading) { toast(t('common.waitUpload') || 'صبر کنید…', { type: 'warn' }); return; }
  const payload = {
    name: fd.get('name'), phone: fd.get('phone'),
    age: fd.get('age') || '', education: fd.get('education') || '',
    experience: fd.get('experience') || '', resumeUrl,
  };
  const btn = form.querySelector('button[type=submit]');
  await withBusy(btn, async () => {
    try {
      await api.post(`/api/careers/${form.dataset.id}/apply`, payload);
      toastSuccess(t('careers.sent'));
      document.querySelector('[data-lx]')?.click();
    } catch (err) { toastApiError(err); }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}
