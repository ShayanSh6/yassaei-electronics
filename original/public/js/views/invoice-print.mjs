// ─────────────────────────────────────────────────────────────
//  فاکتور چاپی سفارش (A4) — #/invoice/:id
//  استایل کاغذ (.inv-paper …) در public/css/app.css مشترک با پیش‌فاکتور سبد خرید است.
// ─────────────────────────────────────────────────────────────
import { html as h, fmtNum, esc, fmtDate, fmtTel } from '../lib/dom.mjs';
import { api } from '../lib/api.mjs';
import { S } from '../state.mjs';
import { t, isFa } from '../i18n.mjs';
import { bankDetails, fmtCard, fmtIban } from '../lib/sales.mjs';

/** برچسب روش پرداخت (کلید pm.* در i18n؛ برای مقادیر قدیمی مثل online هم جواب می‌دهد) */
function payMethodLabel(method) {
  const m = method === 'online' ? 'gateway' : (method || '');
  if (!m) return 'نامشخص';
  const label = t(`pm.${m}`);
  return label === `pm.${m}` ? m : label;
}

/** جملهٔ وضعیت پرداخت — «پرداخت شد» فقط وقتی واقعاً پرداخت شده باشد */
function paymentSentence(o) {
  const amount = h`<span class="mono">${fmtNum(o.payable ?? o.total)}</span>`;
  const method = h`<strong>${payMethodLabel(o.payment?.method)}</strong>`;
  const st = o.payment?.status;
  if (st === 'paid') return h`مبلغ ${amount} تومان به صورت ${method} پرداخت شد.${o.payment?.ref ? h` (کد پیگیری: <span class="mono">${esc(o.payment.ref)}</span>)` : ''}`;
  if (st === 'refunded') return h`مبلغ ${amount} تومان (${method}) به خریدار بازگردانده شد.`;
  if (o.payment?.method === 'cod') return h`مبلغ ${amount} تومان هنگام تحویل کالا (${method}) دریافت می‌شود.`;
  if (o.payment?.method === 'card') return h`مبلغ ${amount} تومان به صورت ${method} واریز می‌شود؛ سفارش پس از تأیید رسید توسط فروشگاه آماده‌سازی خواهد شد.`;
  return h`مبلغ ${amount} تومان به صورت ${method} در انتظار پرداخت است.`;
}

/** کادر اطلاعات واریز (فقط برای سفارش‌های پرداخت‌نشده و وقتی مدیر اطلاعات بانکی را روشن کرده باشد) */
function bankBlock(o) {
  if (o.payment?.status === 'paid' || o.payment?.status === 'refunded') return '';
  const bd = bankDetails();
  if (!bd) return '';
  return h`
    <div class="inv-bank">
      <strong>${t('proforma.bank')}:</strong>
      ${bd.bankName ? h`<span>${t('pay.card.bank')}: ${esc(bd.bankName)}</span>` : ''}
      ${bd.cardNumber ? h`<span>${t('pay.card.cardNumber')}: <span class="mono" dir="ltr">${fmtCard(bd.cardNumber)}</span></span>` : ''}
      ${bd.iban ? h`<span>${t('pay.card.iban')}: <span class="mono" dir="ltr">${fmtIban(bd.iban)}</span></span>` : ''}
      ${bd.owner ? h`<span>${t('pay.card.owner')}: ${esc(bd.owner)}</span>` : ''}
      <span class="small">${t('pay.card.orderCode')} (${esc(o.code)})</span>
    </div>`;
}

export async function render(ctx) {
  const id = ctx.params.id;
  let o = null;
  try {
    // ابتدا سفارش‌های خود کاربر
    const data = await api.get(`/api/me/orders/${id}`);
    o = data.order;
  } catch (err) {
    if (err?.status === 404 || err?.status === 403) {
      // سپس سفارش‌های پنل مدیریت (اگر دسترسی داشته باشیم)
      try {
        const r = await api.get('/api/admin/orders?q=' + encodeURIComponent(id) + '&page=1&limit=10');
        o = (r?.items || []).find((x) => x.id === id || x.code === id);
      } catch { /* noop */ }
    }
  }

  if (!o) {
    return h`<div class="wrap t-center mt-xl"><h3>یافت نشد یا دسترسی ندارید</h3></div>`;
  }

  const st = S.settings?.store || {};
  const shopName = st.name || 'فروشگاه';
  const shopPhone = st.phone || '';
  const shopAddress = st.address || '';
  const sellerNat = st.economicCode || st.nationalCode || '';

  const items = Array.isArray(o.items) ? o.items : [];
  let subtotal = 0;
  items.forEach((l) => { subtotal += (Number(l.price) || 0) * (Number(l.qty) || 0); });
  const discount = Math.max(0, (subtotal - (o.subtotal ?? subtotal)) + (o.discount || 0));
  const shippingFee = Number(o.shipping ?? o.shippingCost ?? 0) || 0;
  const itemName = (l) => (isFa() ? (l.name || l.title || '') : (l.nameEn || l.name || l.title || ''));

  setTimeout(() => {
    const btn = document.getElementById('btn-print-inv');
    if (btn) btn.click();
  }, 500); // باز شدن خودکار پنجرهٔ چاپ

  return h`
    <div class="inv-stage">
      <div class="inv-controls no-print">
        <button type="button" class="btn btn-primary" id="btn-print-inv">چاپ فاکتور</button>
        <button type="button" class="btn btn-ghost" id="btn-back-inv">بازگشت</button>
      </div>

      <div class="inv-paper">
        <div class="inv-header-grid">
          <div class="inv-seller">
            <strong>فروشنده:</strong> ${esc(shopName)}<br>
            <strong>کد ملی / اقتصادی:</strong> <span class="mono">${esc(sellerNat || '---')}</span><br>
            <strong>تلفن:</strong> <span class="mono">${esc(fmtTel(shopPhone) || '---')}</span><br>
            <strong>آدرس:</strong> ${esc(shopAddress || '---')}
          </div>
          <div class="inv-title-box">
            <h2>صورت‌حساب فروش کالا</h2>
          </div>
          <div class="inv-meta-box">
            <p>شماره فاکتور: <span class="mono">${esc(o.code)}</span></p>
            <p>تاریخ: <span class="mono">${fmtDate(o.createdAt)}</span></p>
            <p>وضعیت: <span>${esc(o.statusInfo?.fa || t(`st.${o.status}`))}</span></p>
          </div>
        </div>

        <div class="inv-buyer-grid">
          <div class="inv-buyer-title">مشخصات خریدار</div>
          <div class="inv-buyer-body">
            <div class="ib-row">
              <span><strong>نام خریدار:</strong> ${esc(o.userName || o.address?.name || o.userPhone || '---')}</span>
              <span><strong>کد ملی / اقتصادی:</strong> <span class="mono">${esc(o.address?.nationalId || '---')}</span></span>
              <span><strong>شماره تماس:</strong> <span class="mono">${esc(fmtTel(o.userPhone || o.address?.phone) || '---')}</span></span>
            </div>
            <div class="ib-row">
              <span><strong>آدرس:</strong> ${esc(o.address ? [o.address.city, o.address.address, o.address.postal ? `کدپستی ${o.address.postal}` : ''].filter(Boolean).join('، ') : (o.delivery === 'pickup' ? 'تحویل حضوری در فروشگاه' : '---'))}</span>
            </div>
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th class="inv-w-row">ردیف</th>
              <th>نام کالا</th>
              <th class="inv-w-qty">تعداد</th>
              <th class="inv-w-unit">مبلغ واحد (تومان)</th>
              <th class="inv-w-total">مبلغ کل (تومان)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((l, idx) => h`
              <tr>
                <td class="t-center mono">${fmtNum(idx + 1)}</td>
                <td>${esc(itemName(l))}${l.sku ? h` <span class="small muted mono">(${esc(l.sku)})</span>` : ''}</td>
                <td class="t-center mono">${fmtNum(l.qty)}</td>
                <td class="t-center mono">${fmtNum(l.price)}</td>
                <td class="t-center mono">${fmtNum((Number(l.price) || 0) * (Number(l.qty) || 0))}</td>
              </tr>
            `)}
          </tbody>
        </table>

        <div class="inv-totals-grid">
          <div class="it-note">
            <strong>توضیحات:</strong><br>
            ${esc(o.note || 'سفارش ثبت شده از طریق وب‌سایت')}
            <br><br>
            <strong>روش ارسال:</strong> ${esc(o.delivery === 'pickup' ? 'دریافت حضوری' : o.delivery === 'post' ? 'پست' : o.delivery === 'courier' ? (o.shippingLabel || 'پیک / پست') : (o.delivery || '---'))}
          </div>
          <div class="it-nums">
            <div class="it-row"><span>جمع کل مبالغ:</span> <span class="mono">${fmtNum(subtotal)}</span></div>
            <div class="it-row"><span>تخفیف:</span> <span class="mono">${fmtNum(discount)}</span></div>
            <div class="it-row"><span>هزینه ارسال:</span> <span class="mono">${fmtNum(shippingFee)}</span></div>
            ${o.insuranceFee ? h`<div class="it-row"><span>بیمهٔ مرسوله:</span> <span class="mono">${fmtNum(o.insuranceFee)}</span></div>` : ''}
            ${o.walletUsed ? h`<div class="it-row"><span>پرداخت از کیف پول:</span> <span class="mono">${fmtNum(o.walletUsed)}</span></div>` : ''}
            <div class="it-row total-final"><span>مبلغ قابل پرداخت:</span> <span class="mono">${fmtNum(o.payable ?? o.total)}</span></div>
          </div>
        </div>

        <div class="inv-payment-row">
          <strong>شرایط پرداخت:</strong><br>
          ${paymentSentence(o)}
          ${bankBlock(o)}
        </div>

        <div class="inv-signatures">
          <div class="sign-box">
            <strong>مهر و امضای فروشنده</strong>
            <div class="sign-space">
              <span class="stamp-fake">${esc(shopName)}</span>
            </div>
            <div class="small mt-s inv-sign-hint">سیستم فاکتور آنلاین</div>
          </div>
          <div class="sign-box">
            <strong>مهر و امضای خریدار</strong>
            <div class="sign-space"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * چاپ فقط برگهٔ فاکتور: برگه موقتاً به body منتقل و با کلاس printing-inv بقیهٔ صفحه
 * پنهان می‌شود؛ بعد از چاپ سر جای خودش برمی‌گردد. (مشترک با پیش‌فاکتور سبد خرید)
 */
export function printPaper(paper) {
  if (!paper) { window.print(); return; }
  const parent = paper.parentNode;
  const next = paper.nextSibling;
  document.body.appendChild(paper);
  document.body.classList.add('printing-inv');
  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    window.removeEventListener('afterprint', restore);
    document.body.classList.remove('printing-inv');
    if (!parent) return;
    if (next && next.parentNode === parent) parent.insertBefore(paper, next);
    else parent.appendChild(paper);
  };
  window.addEventListener('afterprint', restore);
  // مهلت کوتاه تا مرورگر چیدمان جدید را اعمال کند؛ بعد از بسته‌شدن پنجرهٔ چاپ، برگه سر جایش برمی‌گردد
  setTimeout(() => {
    try { window.print(); } catch { /* noop */ }
    setTimeout(restore, 1200);
  }, 40);
}

export function mount(root) {
  const btnPrint = root.querySelector('#btn-print-inv');
  if (btnPrint) btnPrint.addEventListener('click', () => printPaper(root.querySelector('.inv-paper')));
  const btnBack = root.querySelector('#btn-back-inv');
  if (btnBack) btnBack.addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/account/orders'; });
}
