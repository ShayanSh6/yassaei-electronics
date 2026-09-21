// ─────────────────────────────────────────────────────────────
//  ورود / ثبت‌نام / بازیابی / ورود دومرحله‌ای
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, applyDyn, fmtNum } from '../lib/dom.mjs';
import { t, lang } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, refreshBootstrap, mergeGuestData, loadCart, feat } from '../state.mjs';
import { field, checkField, captchaField } from '../components.mjs';
import { toast, toastSuccess, toastApiError, withBusy, clearInvalid, markInvalid, sheet } from '../ui.mjs';
import { act, loadCaptcha, refreshCaptchaIn, getAct } from '../actions.mjs';
import { navigate } from '../router.mjs';


// جلوگیری از ارسال فرم وقتی کپچای نمایان حل نشده (تیک باید اثر داشته باشد)
async function gateCaptcha(form) {
  const box = form?.querySelector?.('[data-captcha]');
  if (!box || box.hidden) return true;
  
  const tokInput = box.querySelector('[data-ctok]');
  if (tokInput?.value) return true;

  const cb = box.querySelector('[name=captchaBox]');
  const input = box.querySelector('[name=captchaAnswer]');
  const st = box.querySelector('[data-cst]');
  
  if (!cb?.checked) {
    cb.checked = true;
    const ch = box.querySelector('[data-cch]');
    if (ch) ch.hidden = false;
    if (!box.dataset.cid) {
      const { loadCaptcha } = await import('../actions.mjs');
      loadCaptcha(box);
    }
    input?.focus();
    toast(t('captcha.required'), { type: 'error', timeout: 4500 });
    return false;
  }

  const val = String(input?.value || '').trim();
  if (!val || !box.dataset.cid) {
    input?.focus();
    toast(t('captcha.required'), { type: 'error', timeout: 4500 });
    return false;
  }

  if (box.dataset.verifying) return false;
  box.dataset.verifying = '1';
  
  try {
    const { api } = await import('../lib/api.mjs');
    const r = await api.post('/api/captcha/verify', { id: box.dataset.cid, answer: val });
    if (tokInput) tokInput.value = r.token || '';
    if (cb) cb.disabled = true;
    if (input) input.disabled = true;
    if (st) { st.textContent = t('captcha.solved'); st.style.color = ''; }
    delete box.dataset.verifying;
    return true;
  } catch (err) {
    delete box.dataset.verifying;
    if (st) {
      st.textContent = err?.message || t('captcha.hint');
      st.style.color = 'var(--danger)';
    }
    input?.focus();
    if (err?.code === 'captcha_expired') {
      input.value = '';
      const { loadCaptcha } = await import('../actions.mjs');
      loadCaptcha(box);
    }
    return false;
  }
}

const state = { challenge: null, methods: [], sent: null, channel: 'phone', target: '', demoCode: '', mode: 'login', regMode: 'username' };

function afterAuth(next, r) {
  if (r && r.switchToken && window.S && S.me) {
    try {
      const arr = JSON.parse(localStorage.getItem("saved_accounts") || "[]");
      const f = arr.filter(x => x.id !== S.me.id);
      f.unshift({ id: S.me.id, token: r.switchToken, name: S.me.name, phone: S.me.phone, role: S.me.role });
      localStorage.setItem("saved_accounts", JSON.stringify(f.slice(0, 5)));
    } catch (e){}
  }
  const dest = next && !next.startsWith('auth') ? `#/${next.replace(/^#|^\/|#$/g, '')}` : '#/';
  refreshBootstrap().then(() => loadCart()).then(() => mergeGuestData()).then(() => navigate(dest));
}

export async function render(ctx) {
  const next = ctx.query.get('next') || '';
  const ref = ctx.query.get('ref') || '';
  const isRegister = ctx.params.mode === 'register' || !!ref;
  const isForgot = ctx.params.mode === 'forgot';

  return h`
    <div class="auth-wrap">
      <div class="card auth-card">
        <div class="t-center mb">
          <span class="pwa-ic center" data-h="56px" data-w="56px">${icon('user')}</span>
          <h1 class="mt-s" data-title>${isRegister ? t('auth.registerTitle') : isForgot ? t('auth.recoveryTitle') : t('auth.loginTitle')}</h1>
        </div>

        <div class="tabs" data-auth-tabs role="tablist">
          <button type="button" class="tab ${!isRegister && !isForgot ? 'active' : ''}" data-at="login" role="tab">${t('common.login')}</button>
          <button type="button" class="tab ${isRegister ? 'active' : ''}" data-at="register" role="tab">${t('common.register')}</button>
          <button type="button" class="tab ${isForgot ? 'active' : ''}" data-at="forgot" role="tab">${t('auth.forgot')}</button>
        </div>

        <!-- ورود -->
        <div class="tab-panel" data-ap="login" ${isRegister || isForgot ? 'hidden' : ''}>
          <div class="btn-group mb" data-method>
            <button type="button" class="btn active" data-m="password">${t('auth.methodPassword')}</button>
            <button type="button" class="btn" data-m="phone">${t('auth.methodPhone')}</button>
            <button type="button" class="btn" data-m="email">${t('auth.methodEmail')}</button>
          </div>

          <form data-act="login-pass" data-apf="password">
            ${field({ label: t('auth.identifier'), name: 'identifier', required: true, autocomplete: 'username' })}
            ${field({ label: t('common.password'), name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}
            <div class="row row-between mb">
              ${checkField({ label: t('auth.remember'), name: 'remember', checked: true })}
              <button type="button" class="link-btn" data-goto="forgot">${t('auth.forgot')}</button>
            </div>
            ${captchaField()}
            <button class="btn btn-primary btn-block" type="submit">${icon('logout')} ${t('common.login')}</button>
          </form>

          <form data-act="otp-send" data-purpose="login" data-apf="phone" hidden>
            ${field({ label: t('common.phone'), name: 'target', type: 'tel', required: true, placeholder: '09xxxxxxxxx' })}
            ${captchaField()}
            <button class="btn btn-primary btn-block" type="submit">${icon('send')} ${t('auth.sendCode')}</button>
          </form>
          <form data-act="otp-send" data-purpose="login" data-apf="email" hidden>
            ${field({ label: t('common.email'), name: 'target', type: 'email', required: true })}
            ${captchaField()}
            <button class="btn btn-primary btn-block" type="submit">${icon('send')} ${t('auth.sendCode')}</button>
          </form>

          <form data-act="otp-login" data-apf="code" hidden>
            <p class="notice notice-info mb">${icon('mail')}<span data-sentto></span></p>
            <p class="notice notice-warn mb" data-democode hidden>${icon('info')}<span></span></p>
            ${field({ label: t('auth.otpCode'), name: 'code', required: true, autocomplete: 'one-time-code', attrs: 'inputmode="numeric" maxlength="6"' })}
            <button class="btn btn-primary btn-block" type="submit">${icon('check')} ${t('common.login')}</button>
            <div class="row row-between mt-s">
              <button type="button" class="link-btn" data-resend>${t('auth.resend')}</button>
              <span class="muted tiny" data-resend-timer></span>
            </div>
          </form>

          <form data-act="login-2fa" data-apf="2fa" hidden>
            <p class="notice notice-info mb">${icon('shield')}<span>${t('auth.2faText')}</span></p>
            <div class="btn-group mb" data-2fa-method></div>
            ${field({ label: t('auth.otpCode'), name: 'code', required: true, autocomplete: 'one-time-code', attrs: 'inputmode="numeric"' })}
            <button class="btn btn-primary btn-block" type="submit">${icon('shield')} ${t('auth.2faVerify')}</button>
          </form>
        </div>

        <!-- ثبت‌نام -->
        <div class="tab-panel" data-ap="register" ${!isRegister ? 'hidden' : ''}>
          <div class="btn-group mb" data-regmode>
            <button type="button" class="btn active" data-m="username">${t('auth.methodPassword')}</button>
            <button type="button" class="btn" data-m="phone">${t('auth.methodPhone')}</button>
            <button type="button" class="btn" data-m="email">${t('auth.methodEmail')}</button>
          </div>
          <form data-act="register" data-next="${next}">
            ${field({ label: t('common.fullName'), name: 'name', required: true, autocomplete: 'name' })}
            <span data-reg-username>${field({ label: t('common.username'), name: 'username', autocomplete: 'username', hint: lang() === 'fa' ? 'حروف انگلیسی، عدد و _ ، حداقل ۳ نویسه' : 'letters, digits and _ , min 3 chars' })}</span>
            <span data-reg-target-phone hidden>${field({ label: t('common.phone'), name: 'phoneTarget', type: 'tel', placeholder: '09xxxxxxxxx' })}</span>
            <span data-reg-target-email hidden>${field({ label: t('common.email'), name: 'emailTarget', type: 'email' })}</span>
            <span data-reg-code hidden>
              <div class="row">
                <span class="grow">${field({ label: t('auth.otpCode'), name: 'code', attrs: 'inputmode="numeric" maxlength="6"' })}</span>
                <button type="button" class="btn btn-ghost" data-reg-send>${t('auth.sendCode')}</button>
              </div>
              <p class="notice notice-warn mb" data-reg-demo hidden>${icon('info')}<span></span></p>
            </span>
            <span data-reg-extra>
              ${field({ label: `${t('common.phone')} (${t('common.optional')})`, name: 'phone', type: 'tel' })}
              ${field({ label: `${t('common.email')} (${t('common.optional')})`, name: 'email', type: 'email' })}
            </span>
            ${field({ label: t('common.password'), name: 'password', type: 'password', required: true, hint: t('auth.passwordRules'), autocomplete: 'new-password' })}
            <div class="row row-between mt-s gap-2">
              <span class="grow">${field({ label: 'کد معرف (اختیاری)', name: 'referralCode', placeholder: 'مثلاً Z8A4X' })}</span>
              <span class="grow">
                <span class="grow" style="width:100%">
                <label class="field">
                  <span class="label">نحوه آشنایی (اختیاری)</span>
                  <input type="hidden" name="hearAboutUs" value="">
                  <button type="button" class="input" data-act="choose-hear" style="text-align: right; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <span data-txt>(انتخاب کنید)</span>
                    ${icon('chevron-down')}
                  </button>
                </label>
              </span>
              </span>
            </div>
            <div class="mb">${checkField({ label: h`${t('auth.acceptTerms')} <a class="section-link" href="#/pages/terms">${t('consent.readTerms')}</a>`, name: 'acceptTerms', checked: true })}</div>
            ${captchaField()}
            <button class="btn btn-primary btn-block" type="submit">${icon('user')} ${t('common.register')}</button>
          </form>
        </div>

        <!-- بازیابی -->
        <div class="tab-panel" data-ap="forgot" ${!isForgot ? 'hidden' : ''}>
          <p class="muted small mb">${t('auth.recoveryText')}</p>
          <form data-act="forgot-send">
            <div class="btn-group mb" data-fch>
              <button type="button" class="btn active" data-m="phone">${t('auth.methodPhone')}</button>
              <button type="button" class="btn" data-m="email">${t('auth.methodEmail')}</button>
            </div>
            ${field({ label: t('common.phone'), name: 'target', type: 'tel', required: true, placeholder: '09xxxxxxxxx' })}
            ${captchaField()}
            <button class="btn btn-primary btn-block" type="submit">${icon('send')} ${t('auth.sendCode')}</button>
          </form>
          <form data-act="forgot-reset" hidden>
            <p class="notice notice-info mb">${icon('mail')}<span data-fsent></span></p>
            <p class="notice notice-warn mb" data-fdemo hidden>${icon('info')}<span></span></p>
            ${field({ label: t('auth.otpCode'), name: 'code', required: true, attrs: 'inputmode="numeric" maxlength="6"' })}
            ${field({ label: t('auth.newPassword'), name: 'password', type: 'password', required: true, hint: t('auth.passwordRules'), autocomplete: 'new-password' })}
            <button class="btn btn-primary btn-block" type="submit">${icon('key')} ${t('common.save')}</button>
          </form>
        </div>
      </div>
    </div>`;
}

export function mount(root, ctx) {
  applyDyn(root);
  // پیش‌بارگذاری کپچا تا به محض باز شدن فرم، ویجت آماده باشد
  root.querySelectorAll('[data-captcha]').forEach((b) => loadCaptcha(b));
  const next = ctx.query.get('next') || '';
  const refCode = ctx.query.get('ref') || '';
  if (refCode) {
    const refInput = root.querySelector('[name=referralCode]');
    if (refInput) {
       refInput.value = refCode;
       // Switch to register tab automatically
       setTimeout(() => root.querySelector('[data-at="register"]')?.click(), 50);
    }
  }
  const panels = { login: root.querySelector('[data-ap="login"]'), register: root.querySelector('[data-ap="register"]'), forgot: root.querySelector('[data-ap="forgot"]') };

  root.querySelectorAll('[data-at]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-at]').forEach((x) => x.classList.toggle('active', x === b));
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== b.dataset.at;
  }));
  root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => root.querySelector(`[data-at="${b.dataset.goto}"]`).click()));

  // روش ورود
  const methodBox = root.querySelector('[data-method]');
  methodBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    methodBox.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('active', x === b));
    const m = b.dataset.m;
    panels.login.querySelectorAll('[data-apf]').forEach((f) => { f.hidden = f.dataset.apf !== m; });
  });

  // حالت ثبت‌نام
  const regBox = root.querySelector('[data-regmode]');
  regBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    regBox.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('active', x === b));
    state.regMode = b.dataset.m;
    root.querySelector('[data-reg-username]').hidden = state.regMode !== 'username';
    root.querySelector('[data-reg-extra]').hidden = state.regMode !== 'username';
    root.querySelector('[data-reg-target-phone]').hidden = state.regMode !== 'phone';
    root.querySelector('[data-reg-target-email]').hidden = state.regMode !== 'email';
    root.querySelector('[data-reg-code]').hidden = state.regMode === 'username';
  });

  // ارسال کد ثبت‌نام
  root.querySelector('[data-reg-send]').addEventListener('click', async (e) => {
    const form = root.querySelector('[data-act="register"]');
    const channel = state.regMode === 'phone' ? 'phone' : 'email';
    const target = channel === 'phone' ? form.querySelector('[name=phoneTarget]').value : form.querySelector('[name=emailTarget]').value;
    try {
      const r = await api.post('/api/auth/otp/send', { channel, target, purpose: 'register', captchaToken: form.querySelector('[data-ctok]')?.value || undefined });
      state.demoCode = r.demoCode || '';
      const demo = root.querySelector('[data-reg-demo]');
      demo.hidden = !r.demoCode;
      if (r.demoCode) demo.querySelector('span').textContent = t('auth.demoCode', { code: r.demoCode });
      toastSuccess(t('auth.codeSentTo', { target: r.target }));
      startResend(root, '[data-reg-send]');
    } catch (err) {
      if (err?.code === 'captcha_required') refreshCaptchaIn(form);
      toastApiError(err);
    }
  });

  // ── اکشن‌ها ──
  act('choose-hear', (e, btn) => {
    const opts = [
      { v: '', l: '(انتخاب کنید)' },
      { v: 'google', l: 'جستجوی گوگل' },
      { v: 'instagram', l: 'اینستاگرام' },
      { v: 'telegram', l: 'تلگرام' },
      { v: 'friend', l: 'معرفی دوستان' },
      { v: 'other', l: 'سایر' },
    ];
    const s = sheet({
      title: 'نحوه آشنایی (اختیاری)',
      body: h`<div class="col" style="gap:4px; padding-bottom: 20px;">
        ${opts.map(o => h`<button class="btn" style="justify-content: flex-start; padding: 14px 16px; background: var(--surface-2); border-radius: 12px; font-size: 15px;" data-v="${o.v}">${o.l}</button>`).join('')}
      </div>`
    });
    s.panel.querySelectorAll('button[data-v]').forEach(b => {
      b.addEventListener('click', () => {
        btn.parentElement.querySelector('input[type="hidden"]').value = b.dataset.v;
        btn.querySelector('[data-txt]').textContent = b.textContent;
        s.close();
      });
    });
  });

  act('login-pass', async (e, form) => {
    e.preventDefault();
    clearInvalid(form);
    if (!(await gateCaptcha(form))) return;
    const fd = new FormData(form);
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/login', { identifier: fd.get('identifier'), password: fd.get('password'), remember: fd.get('remember') === 'on', captchaToken: fd.get('captchaToken') || undefined });
        if (r.twoFactor) {
          state.challenge = r.challengeToken;
          state.methods = r.methods || ['totp'];
          state.sent = r.sent || null;
          show2fa(root, r);
        } else {
          S.me = r.me;
          toastSuccess(t('auth.loginDone'));
          afterAuth(next, r);
        }
      } catch (err) {
        if (err?.code === 'captcha_required' || err?.details?.captchaRequired) refreshCaptchaIn(form);
        toastApiError(err);
      }
    });
  });

  act('otp-send', async (e, form) => {
    e.preventDefault();
    if (!(await gateCaptcha(form))) return;
    const fd = new FormData(form);
    const channel = form.dataset.apf === 'email' ? 'email' : 'phone';
    state.channel = channel;
    state.target = String(fd.get('target') || '').trim();
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/otp/send', { channel, target: state.target, purpose: 'login', captchaToken: fd.get('captchaToken') || undefined });
        state.demoCode = r.demoCode || '';
        const codeForm = panels.login.querySelector('[data-apf="code"]');
        panels.login.querySelectorAll('[data-apf]').forEach((f) => { f.hidden = f !== codeForm; });
        codeForm.querySelector('[data-sentto]').textContent = t('auth.codeSentTo', { target: r.target });
        const demo = codeForm.querySelector('[data-democode]');
        demo.hidden = !r.demoCode;
        if (r.demoCode) demo.querySelector('span').textContent = t('auth.demoCode', { code: r.demoCode });
        toastSuccess(t('auth.codeSent'));
        startResend(root, '[data-resend]');
        codeForm.querySelector('[name=code]').focus();
      } catch (err) {
        if (err?.code === 'captcha_required') refreshCaptchaIn(form);
        toastApiError(err);
      }
    });
  });

  act('otp-login', async (e, form) => {
    e.preventDefault();
    const fd = new FormData(form);
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/login/otp', { channel: state.channel, target: state.target, code: fd.get('code') });
        if (r.twoFactor) { state.challenge = r.challengeToken; state.methods = r.methods || ['totp']; show2fa(root, r); return; }
        S.me = r.me;
        toastSuccess(t('auth.loginDone'));
        afterAuth(next, r);
      } catch (err) { toastApiError(err); }
    });
  });

  root.querySelector('[data-resend]')?.addEventListener('click', async () => {
    try {
      const r = await api.post('/api/auth/otp/send', { channel: state.channel, target: state.target, purpose: 'login' });
      state.demoCode = r.demoCode || '';
      const demo = panels.login.querySelector('[data-democode]');
      demo.hidden = !r.demoCode;
      if (r.demoCode) demo.querySelector('span').textContent = t('auth.demoCode', { code: r.demoCode });
      toastSuccess(t('auth.codeSent'));
      startResend(root, '[data-resend]');
    } catch (err) { toastApiError(err); }
  });

  act('login-2fa', async (e, form) => {
    e.preventDefault();
    const fd = new FormData(form);
    const type = form.querySelector('[data-2fam].active')?.dataset['2fam'] || 'totp';
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/login/2fa', { challengeToken: state.challenge, code: fd.get('code'), type });
        S.me = r.me;
        toastSuccess(t('auth.loginDone'));
        afterAuth(next, r);
      } catch (err) { toastApiError(err); }
    });
  });

  act('register', async (e, form) => {
    e.preventDefault();
    clearInvalid(form);
    if (!(await gateCaptcha(form))) return;
    const fd = new FormData(form);
    const payload = {
      mode: state.regMode, name: fd.get('name'), password: fd.get('password'),
      acceptTerms: fd.get('acceptTerms') === 'on', 
      referralCode: fd.get('referralCode') || '',
      hearAboutUs: fd.get('hearAboutUs') || '',
      captchaToken: fd.get('captchaToken') || undefined,
    };
    if (state.regMode === 'username') {
      payload.username = fd.get('username'); payload.phone = fd.get('phone') || ''; payload.email = fd.get('email') || '';
    } else if (state.regMode === 'phone') {
      payload.target = fd.get('phoneTarget'); payload.code = fd.get('code'); payload.email = fd.get('email') || '';
    } else {
      payload.target = fd.get('emailTarget'); payload.code = fd.get('code'); payload.phone = fd.get('phone') || '';
    }
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/register', payload);
        S.me = r.me;
        toastSuccess(t('auth.registerDone'));
        afterAuth(next || '', r);
      } catch (err) {
        if (err?.code === 'captcha_required') refreshCaptchaIn(form);
        toastApiError(err);
      }
    });
  });

  act('forgot-send', async (e, form) => {
    e.preventDefault();
    if (!(await gateCaptcha(form))) return;
    const fd = new FormData(form);
    const channel = form.querySelector('[data-fch] .active').dataset.m;
    state.channel = channel;
    state.target = String(fd.get('target') || '').trim();
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/password/forgot', { channel, target: state.target, captchaToken: fd.get('captchaToken') || undefined });
        const rf = panels.forgot.querySelector('[data-act="forgot-reset"]');
        panels.forgot.querySelector('[data-act="forgot-send"]').hidden = true;
        rf.hidden = false;
        rf.querySelector('[data-fsent]').textContent = t('auth.codeSentTo', { target: r.target });
        const demo = rf.querySelector('[data-fdemo]');
        demo.hidden = !r.demoCode;
        if (r.demoCode) demo.querySelector('span').textContent = t('auth.demoCode', { code: r.demoCode });
        toastSuccess(t('auth.codeSent'));
      } catch (err) {
        if (err?.code === 'captcha_required') refreshCaptchaIn(form);
        toastApiError(err);
      }
    });
  });

  act('forgot-reset', async (e, form) => {
    e.preventDefault();
    const fd = new FormData(form);
    await withBusy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/auth/password/reset', { channel: state.channel, target: state.target, code: fd.get('code'), password: fd.get('password') });
        S.me = r.me;
        toastSuccess(t('auth.resetDone'));
        afterAuth('', r);
      } catch (err) { toastApiError(err); }
    });
  });

  return null;
}

function show2fa(root, r) {
  const panel = root.querySelector('[data-ap="login"]');
  panel.querySelectorAll('[data-apf]').forEach((f) => { f.hidden = f.dataset.apf !== '2fa'; });
  const form = panel.querySelector('[data-act="login-2fa"]');
  const box = form.querySelector('[data-2fa-method]');
  const methods = state.methods;
  const labels = { totp: t('auth.2faTotp'), sms: t('auth.2faSms'), email: t('auth.2faEmail'), backup: t('auth.2faBackup') };
  box.innerHTML = methods.map((m, i) => h`<button type="button" class="btn ${i === 0 ? 'active' : ''}" data-2fam="${m}">${labels[m] || m}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-2fam]');
    if (!b) return;
    box.querySelectorAll('[data-2fam]').forEach((x) => x.classList.toggle('active', x === b));
  });
  if (r.sent?.demoCode) toast(t('auth.demoCode', { code: r.sent.demoCode }), { title: t('auth.2faTitle'), timeout: 12000 });
  form.querySelector('[name=code]').focus();
}

function startResend(root, sel) {
  let s = 60;
  const elx = root.querySelector(sel);
  const timer = setInterval(() => {
    s -= 1;
    if (elx) elx.textContent = s > 0 ? t('auth.resendIn', { s: fmtNum(s) }) : t('auth.resend');
    if (s <= 0) clearInterval(timer);
  }, 1000);
}

export const title = () => t('auth.title');
