// ─────────────────────────────────────────────────────────────
//  تکمیل خرید (Checkout)
// ─────────────────────────────────────────────────────────────
import { fmtTel, html as h, icon, fmtNum, fmtMoney, esc, applyDyn, debounce } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, ship, feat, ordersCfg, isPlus, refreshMe, loadCart, kycCfg, kycVisible } from '../state.mjs';
import { summaryRows, emptyState, field, checkField, switchField, selectField, textareaField } from '../components.mjs';
import { kycBlocksMethod, kycRuleText } from '../lib/kyc.mjs';
import { toast, toastSuccess, toastError, toastApiError, modal, withBusy } from '../ui.mjs';
import { act } from '../actions.mjs';
import { navigate, refresh } from '../router.mjs';

let quote = null;
let payMethods = [];
let ceiling = null;

/** آیا سبد فعلی از سهمیهٔ باقی‌ماندهٔ سقف خرید غلتان بیشتر است؟ */
function ceilingBlocked() {
  return !!(ceiling?.enabled && quote && Number(quote.total) > Number(ceiling.remaining));
}

/**
 * هشدار محترمانهٔ سقف خرید ۴۸ ساعته — هیچ کاربری مسدود یا محروم نمی‌شود؛
 * با کم/حذف‌کردن اقلام سبد تا رسیدن زیر سهمیه، محدودیت بلافاصله رفع می‌شود.
 */
function ceilingNotice() {
  if (!ceilingBlocked()) return '';
  const msg = isFa()
    ? h`سقف مجاز خرید در هر ${fmtNum(ceiling.hours)} ساعت ${fmtMoney(ceiling.amount)} است. مجموع خریدهای موفق شما در این بازه: ${fmtMoney(ceiling.pastSpent)}. شما می‌توانید تا سقف ${fmtMoney(ceiling.remaining)} سفارش ثبت کنید یا پس از پایان بازه مجدداً اقدام فرمایید.`
    : h`The fair purchase ceiling for every ${fmtNum(ceiling.hours)} hours is ${fmtMoney(ceiling.amount)}. Your successful purchases in this window: ${fmtMoney(ceiling.pastSpent)}. You can place orders up to ${fmtMoney(ceiling.remaining)}, or try again after the window ends.`;
  return h`
    <div class="notice notice-warn ceiling-notice mt" data-ceiling-notice role="alert">
      ${icon('shield')}
      <div>
        <strong>${t('checkout.ceilingTitle')}</strong>
        <p class="small mt-s">${msg}</p>
        <p class="hint tiny muted mt-s">${icon('info')} ${t('checkout.ceilingHint')}</p>
        <a class="btn btn-ghost btn-sm mt-s" href="#/cart">${icon('cart')} ${t('cart.title')}</a>
      </div>
    </div>`;
}

export async function render(ctx) {
  await loadCart().catch(() => {});
  if (!S.cart.items?.length) {
    return emptyState({ icon: 'cart', title: t('cart.empty'), text: t('cart.emptyText'), action: { href: '#/products', label: t('cart.goShopping') } });
  }
  
  // ورود اجباری فقط وقتی مدیر «خرید بدون حساب کاربری» را خاموش کرده باشد (تنظیمات → قابلیت‌ها)
  if (!S.me && !feat('guestCheckout')) {
    return emptyState({ icon: 'user', title: t('checkout.loginRequired'), action: { href: '#/auth?next=checkout', label: t('nav.login') } });
  }

  // احراز هویت (KYC) دیگر مانع ثبت سفارش نیست؛ قاعدهٔ آن از تنظیمات
  // فروشگاه خوانده می‌شود و در صورت لزوم فقط هشدار می‌دهیم. تصمیم نهایی
  // با سرور است (server/lib/kyc.mjs).
  const kyc = kycCfg();
  const kycApproved = S.me?.kycStatus === 'approved';

  const sh = ship();
  const zones = sh.zones || [];
  const addresses = S.me?.addresses || [];
  const defZone = zones[0]?.id || 'country';
  const defAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;
  // روش تحویل پیش‌فرض: پستی برای کاربر واردشده (اگر مدیر آن را خاموش نکرده باشد)، وگرنه حضوری
  const courierOk = sh.courierEnabled !== false && !!S.me;
  const defDelivery = courierOk ? 'courier' : 'pickup';

  // نقل‌قول اولیه
  try {
    const q = await api.post('/api/checkout/quote', { delivery: defDelivery, zone: defZone, express: false, insurance: false });
    quote = q.quote;
    ceiling = q.ceiling || null;
    payMethods = (q.paymentMethods || []).filter((m) => (S.me ? true : ['cod', 'gateway', 'card'].includes(m.id)));
    if (!payMethods.length) payMethods = [{ id: 'cod', fa: 'پرداخت در محل', en: 'Cash on delivery', note: '' }];
  } catch (e) { quote = null; ceiling = null; }

  return h`
    <div class="section-head"><div><h1 class="section-title">${icon('card')} ${t('checkout.title')}</h1></div></div>
    <div class="checkout-steps">
      <span class="cstep active"><span class="n">1</span> ${t('checkout.step1')}</span>
      <span class="cstep"><span class="n">2</span> ${t('checkout.step2')}</span>
      <span class="cstep"><span class="n">3</span> ${t('checkout.step3')}</span>
    </div>

    <form class="cart-grid" data-act="checkout-submit" novalidate>
      <div class="col">
        <section class="card">
          <strong class="row mb-s">${icon('truck')} ${t('checkout.delivery')}</strong>
          <div class="col">
            <label class="radio-card">
              <input type="radio" name="delivery" value="pickup" ${sh.pickupEnabled === false ? 'disabled' : ''} ${defDelivery === 'pickup' ? 'checked' : ''}>
              <span class="dot"></span>
              <span><span class="b">${t('checkout.pickup')}</span><span class="hint" >${t('checkout.pickupDesc')} ${t('checkout.pickupReady', { h: fmtNum(sh.handlingHours || 24) })}</span></span>
            </label>
            <label class="radio-card${courierOk ? '' : ' disabled'}">
              <input type="radio" name="delivery" value="courier" ${defDelivery === 'courier' ? 'checked' : ''} ${courierOk ? '' : 'disabled'}>
              <span class="dot"></span>
              <span><span class="b">${t('checkout.courier')}</span><span class="hint">${t('checkout.courierDesc')}${S.me ? '' : ` — ${t('checkout.guestCourierNote')}`}</span></span>
            </label>
          </div>

          <div data-courier-opts class="mt">
            ${selectField({
      label: t('checkout.zone'),
      name: 'zone',
      value: defZone,
      options: zones.map(z => ({ value: z.id, label: `${isFa() ? z.name : z.nameEn} — ${fmtNum(z.fee)} ${t('common.toman')} · ${isFa() ? z.eta : ''}` }))
    })}
            ${sh.expressEnabled ? switchField({ label: t('checkout.express'), desc: `${fmtNum(sh.expressFee || 0)} ${t('common.toman')}${isPlus() ? ` · ${t('acc.plus')}: −${fmtNum(sh.expressDiscountPct || 50)}٪` : ''}`, name: 'express' }) : ''}
            ${feat('insurance') ? switchField({ label: t('checkout.insuranceOpt'), desc: isPlus() && (S.settings?.plus?.autoInsurance) ? t('checkout.insuranceAuto') : t('checkout.insuranceDesc'), name: 'insurance', checked: isPlus() }) : ''}

            <div class="divider"></div>
            <strong class="row mb-s">${icon('pin')} ${t('checkout.address')}</strong>

            ${S.me ? h`
              ${addresses.length ? h`
                <div class="col" data-addresses>
                  ${addresses.map((a, i) => h`
                    <label class="radio-card">
                      <input type="radio" name="addressId" value="${a.id}" ${a.id === defAddress?.id || (!defAddress && i === 0) ? 'checked' : ''}>
                      <span class="dot"></span>
                      <span>
                        <span class="b">${esc(a.title || t('acc.addrTitle'))}${a.isDefault ? h` <span class="badge-pill bp-accent tiny">${t('acc.addrDefault')}</span>` : ''}</span>
                        <span class="hint">${esc([a.city, a.address].filter(Boolean).join(' — '))}${a.zip ? h` · <span class="mono">${esc(a.zip)}</span>` : ''}</span>
                        <span class="hint tiny muted">${esc(a.name || S.me.name || '')}${a.phone ? h` · <span class="mono">${fmtTel(a.phone)}</span>` : ''}</span>
                      </span>
                    </label>`)}
                </div>
                <button type="button" class="btn btn-ghost btn-sm mt-s" data-act="addr-add">${icon('plus')} ${t('checkout.addAddress')}</button>`
                : h`
                <div class="notice notice-info">${icon('info')}<span>${t('checkout.noAddress')}</span></div>
                <button type="button" class="btn btn-ghost btn-sm mt-s" data-act="addr-add">${icon('plus')} ${t('checkout.addAddress')}</button>`}`
              : h`
              <div class="notice notice-info mb-s">${icon('info')}<span>${t('checkout.guestHint')}</span></div>
              <div class="form-grid">
                ${field({ label: t('checkout.guestName'), name: 'guestName', required: true, autocomplete: 'name' })}
                ${field({ label: t('checkout.guestPhone'), name: 'guestPhone', type: 'tel', required: true, placeholder: t('checkout.guestPhoneHint'), autocomplete: 'tel' })}
                ${field({ label: t('common.province'), name: 'guestProvince', value: S.settings?.store?.city || '', required: true })}
                ${field({ label: t('common.city'), name: 'guestCity', value: S.settings?.store?.city || '', required: true })}
                ${textareaField({ label: t('common.address'), name: 'guestAddress', required: true, rows: 2, span2: true })}
                ${field({ label: t('common.postal'), name: 'guestZip', attrs: 'maxlength="10" inputmode="numeric"' })}
              </div>
              <p class="hint mt-s" data-guest-cod-note hidden>${t('checkout.guestCodPickup')}</p>`}
          </div>
        </section>

        <section class="card">
          <strong class="row mb-s">${icon('wallet')} ${t('checkout.paymentMethod')}</strong>
          ${kyc.active && !kycApproved ? h`
            <div class="notice notice-info mb-s">${icon('shield-check')}<span>${esc(kycRuleText(kyc, { fa: isFa() }))}${kycVisible() ? h` <a class="section-link" href="#/account/kyc">${isFa() ? 'تکمیل احراز هویت (KYC)' : 'Complete KYC'}</a>` : ''}</span></div>` : ''}
          <div class="col" data-paymethods>
            ${(() => {
              const list = payMethods.length ? payMethods : [{ id: 'gateway', fa: 'درگاه بانکی', en: 'Bank gateway', note: '' }];
              const kycStatus = S.me?.kycStatus || 'none';
              const total = quote?.total || 0;
              const lockedOf = (id) => kycBlocksMethod(kyc, { kycStatus, paymentMethod: id, total });
              const firstOpen = list.findIndex((m) => !lockedOf(m.id));
              return list.map((m, i) => {
                const locked = lockedOf(m.id);
                return h`
              <label class="radio-card${locked ? ' disabled' : ''}">
                <input type="radio" name="paymentMethod" value="${m.id}" ${i === firstOpen ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                <span class="dot"></span>
                <span><span class="b">${isFa() ? m.fa : m.en}</span><span class="hint">${esc(m.note || '')}${m.id === 'gateway' && ordersCfg().gatewayMode === 'demo' ? ` — ${t('checkout.gatewayDemo')}` : ''}${locked ? ` <span style="color:var(--danger)">(${isFa() ? 'نیازمند احراز هویت' : 'KYC Required'})</span>` : ''}</span></span>
              </label>`;
              });
            })()}
          </div>
          ${payMethods.some((m) => m.id === 'card') ? h`<div class="mt-s" data-card-identity hidden>${field({ label: t('checkout.cardIdentity'), name: 'payerCardOrIban', hint: t('checkout.cardIdentityHint'), attrs: 'inputmode="numeric" maxlength="32" autocomplete="off"' })}</div>` : ''}
          ${S.me && feat('wallet') && (S.me.wallet?.balance || 0) > 0 ? switchField({ label: t('checkout.useWallet'), desc: t('checkout.walletBalance', { amount: fmtNum(S.me.wallet.balance) }), name: 'useWallet', checked: true }) : ''}
          <label class="field mt"><span class="label">${t('checkout.note')}</span><textarea class="textarea" name="note" rows="2" maxlength="400" placeholder="${t('checkout.notePlaceholder')}"></textarea></label>
        </section>

        <section class="card">
          ${checkField({ label: h`${t('checkout.acceptTerms')} <a class="section-link" href="#/pages/terms">${t('consent.readTerms')}</a>`, name: 'acceptTerms', checked: true })}
          <p class="hint mt-s">${t('checkout.concurrencyNote')}</p>
        </section>
      </div>

      <aside class="summary card">
        <strong>${t('cart.summary')}</strong>
        <div data-quote>${quote ? summaryRows(quote) : h`<div class="sk sk-line w100"></div>`}</div>
        <div data-ceiling>${ceilingNotice()}</div>
        <button class="btn btn-primary btn-block btn-lg mt" type="submit" ${ceilingBlocked() ? 'disabled' : ''}>${icon('check')} ${t('checkout.placeOrder')}</button>
        <a class="btn btn-ghost btn-block mt-s" href="#/cart">${icon('chevron-right')} ${t('cart.title')}</a>
      </aside>
    </form>`;
}

async function requote(form) {
  const fd = new FormData(form);
  try {
    const q = await api.post('/api/checkout/quote', {
      delivery: fd.get('delivery') || 'courier',
      zone: fd.get('zone') || 'country',
      express: fd.get('express') === 'on',
      insurance: fd.get('insurance') === 'on',
    });
    quote = q.quote;
    ceiling = q.ceiling || null;
    const box = form.querySelector('[data-quote]');
    if (box) box.innerHTML = summaryRows(quote);
    // به‌روزرسانی زندهٔ هشدار سقف خرید: با رسیدن سبد زیر سهمیه، مسدودی بلافاصله رفع می‌شود
    const cbox = form.querySelector('[data-ceiling]');
    if (cbox) cbox.innerHTML = ceilingNotice();
    const submitBtn = form.querySelector('button[type=submit]');
    if (submitBtn) submitBtn.disabled = ceilingBlocked();
    // نمایش/پنهان‌سازی بخش پستی
    const co = form.querySelector('[data-courier-opts]');
    const delivery = fd.get('delivery');
    if (co) co.hidden = delivery !== 'courier';
    // مهمان: پرداخت در محل فقط برای ارسال پستی
    if (!S.me) {
      const cod = form.querySelector('input[name="paymentMethod"][value="cod"]');
      if (cod) {
        cod.disabled = delivery === 'pickup';
        cod.closest('.radio-card')?.classList.toggle('disabled', delivery === 'pickup');
        const note = form.querySelector('[data-guest-cod-note]');
        if (note) note.hidden = delivery !== 'pickup';
        if (cod.disabled && cod.checked) {
          const gw = form.querySelector('input[name="paymentMethod"][value="gateway"]');
          if (gw) gw.checked = true;
        }
      }
    }
  } catch { /* noop */ }
}

export function mount(root) {
  applyDyn(root);
  const form = root.querySelector('form[data-act="checkout-submit"]');
  if (!form) return null;
  const rq = debounce(() => requote(form), 220);
  const syncCardIdentity = () => {
    const box = form.querySelector('[data-card-identity]');
    if (box) box.hidden = form.querySelector('input[name="paymentMethod"]:checked')?.value !== 'card';
  };
  form.addEventListener('change', rq);
  form.addEventListener('change', syncCardIdentity);
  syncCardIdentity();
  requote(form);

  act('addr-add', () => openAddressModal());

  act('checkout-submit', async (e, f) => {
    e.preventDefault();
    const fd = new FormData(f);
    if (ceilingBlocked()) { toastError(t('checkout.ceilingTitle')); return; }
    if (!fd.get('acceptTerms')) { toastError(t('form.termsRequired')); return; }
    if (S.me && fd.get('delivery') === 'courier' && !fd.get('addressId')) { toastError(t('checkout.noAddress')); return; }
    if (!S.me && fd.get('delivery') === 'courier') {
      if (!fd.get('guestProvince') || !fd.get('guestCity') || !fd.get('guestAddress')) {
        toastError(isFa() ? 'لطفاً آدرس پستی را کامل وارد کنید.' : 'Please enter your shipping address.');
        return;
      }
    }
    if (!S.me) {
      if (!String(fd.get('guestName') || '').trim()) { toastError(t('checkout.guestNameRequired')); return; }
      if (!/^09\d{9}$/.test(String(fd.get('guestPhone') || '').replace(/[\s-]/g, ''))) { toastError(t('checkout.guestPhoneInvalid')); return; }
    }
    await withBusy(f.querySelector('button[type=submit]'), async () => {
      try {
        const r = await api.post('/api/checkout', {
          delivery: fd.get('delivery'), zone: fd.get('zone'), express: fd.get('express') === 'on',
          insurance: fd.get('insurance') === 'on', paymentMethod: fd.get('paymentMethod') || 'gateway',
          useWallet: fd.get('useWallet') === 'on', note: fd.get('note') || '', addressId: fd.get('addressId') || '',
          payerCardOrIban: fd.get('payerCardOrIban') || '',
          guestName: S.me ? '' : String(fd.get('guestName') || '').trim(),
          guestPhone: S.me ? '' : String(fd.get('guestPhone') || '').replace(/[\s-]/g, ''),
          acceptTerms: true,
        });
        if (r.me) { S.me = r.me; refreshMe(); }
        try { sessionStorage.setItem('ys_last_order', JSON.stringify(r.order)); } catch { /* noop */ }
        await loadCart();
        // درگاه/اقساطی → شبیه‌ساز درگاه؛ کارت‌به‌کارت → صفحهٔ اطلاعات واریز (کارت/شبا با کپی یک‌کلیکی)
        if (r.needsPayment && ['gateway', 'snapppay', 'azki', 'digipay', 'card'].includes(r.paymentMethod)) navigate(`#/pay/${r.order.id}`);
        else navigate(`#/checkout/done/${r.order.id}`);
      } catch (err) {
        toastApiError(err);
        if (err?.code === 'stock_limit' || err?.code === 'product_unavailable') refresh(true);
      }
    });
  });
  return null;
}

let addrHandle = null;
function openAddressModal() {
  if (!S.me) { navigate('#/auth?next=checkout'); return; }
  addrHandle = modal({
    title: t('acc.addAddress'),
    body: h`
      <form data-act="addr-save" class="form-grid">
        ${field({ label: t('acc.addrTitle'), name: 'title', required: true })}
        ${field({ label: t('acc.addrReceiver'), name: 'receiver', required: true, value: S.me.name || '' })}
        ${field({ label: t('acc.addrPhone'), name: 'phone', type: 'tel', required: true, value: S.me.phone || '' })}
        ${field({ label: t('common.city'), name: 'city', value: S.settings?.store?.city || '' })}
        ${field({ label: t('common.postal'), name: 'postal' })}
        ${field({ label: t('acc.addrStreet'), name: 'street', required: true, span2: true })}
        ${field({ label: t('acc.addrNote'), name: 'note', span2: true })}
        <label class="check span-2"><input type="checkbox" name="isDefault"><span class="box">${icon('check')}</span><span>${t('acc.addrDefault')}</span></label>
        <button class="btn btn-primary span-2" type="submit">${t('common.save')}</button>
      </form>`,
  });
}

act('addr-save', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.isDefault = fd.get('isDefault') === 'on';
  try {
    const r = await api.post('/api/me/addresses', payload);
    if (r.addresses && S.me) S.me.addresses = r.addresses;
    toastSuccess(t('acc.addrSaved'));
    addrHandle?.close();
    refresh(true);
  } catch (err) { toastApiError(err); }
});

export const title = () => t('checkout.title');
