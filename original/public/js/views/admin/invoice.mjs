import { html as h, qs, esc, fmtMoney, fmtNum, icon } from '../../lib/dom.mjs';
import { t } from '../../i18n.mjs';
import { S } from '../../state.mjs';
import { confirmDialog, toastError, toastWarn } from '../../ui.mjs';

function numToPersianWords(num) {
  if (num === 0) return 'صفر';
  if (!num) return '-';
  const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const dahgan = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const dah = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const scale = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  const getGroup = (n) => {
    let res = [];
    if (n > 99) { res.push(sadgan[Math.floor(n / 100)]); n %= 100; }
    if (n > 9 && n < 20) { res.push(dah[n - 10]); n = 0; }
    else if (n > 9) { res.push(dahgan[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) { res.push(yekan[n]); }
    return res.join(' و ');
  };

  let parts = [];
  let s = String(num);
  while (s.length > 0) {
    parts.push(parseInt(s.slice(-3), 10));
    s = s.slice(0, -3);
  }

  let words = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== 0) {
      let g = getGroup(parts[i]);
      if (scale[i]) g += ' ' + scale[i];
      words.unshift(g);
    }
  }
  return words.join(' و ');
}

let items = [];
let invData = {
  name: '', phone: '', phone2: '', address: '', natId: '',
  date: '', issuer: '', sellerNat: '',
  discount: 0, tax: 0, cash: 0, nonCash: 0
};
try {
  const savedItems = localStorage.getItem('draft_inv_items');
  const savedData = localStorage.getItem('draft_inv_data');
  if (savedItems) items = JSON.parse(savedItems);
  if (savedData) {
    const parsed = JSON.parse(savedData);
    invData = { ...invData, ...parsed };
  }
} catch(e) {}
function saveDraft() {
  localStorage.setItem('draft_inv_items', JSON.stringify(items));
  localStorage.setItem('draft_inv_data', JSON.stringify(invData));
}

function updateInvoiceView(box) {
  saveDraft();
  const tableBody = box.querySelector('#inv-items');
  if (!tableBody) return;
  
  let html = '';
  let subtotal = 0;
  items.forEach((it, i) => {
    const total = it.qty * it.price;
    subtotal += total;
    html += h`
      <tr>
        <td class="t-center">${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="t-center">${fmtNum(it.qty)}</td>
        <td class="t-center">${fmtNum(it.price)}</td>
        <td class="t-center b">${fmtNum(total)}</td>
        <td class="no-print t-center">
          <button class="btn btn-sm btn-text danger" data-del="${i}">${icon('trash')}</button>
        </td>
      </tr>
    `;
  });
  tableBody.innerHTML = html || `<tr><td colspan="6" class="t-center muted">سبد فاکتور خالی است.</td></tr>`;
  
  const totalPayable = Math.max(0, subtotal - invData.discount + invData.tax);
  
  box.querySelector('#inv-subtotal').textContent = fmtMoney(subtotal, { withUnit: false });
  
  box.querySelector('#inv-discount-row').style.display = invData.discount > 0 ? '' : 'none';
  box.querySelector('#inv-discount').textContent = fmtMoney(invData.discount, { withUnit: false });
  
  box.querySelector('#inv-tax-row').style.display = invData.tax > 0 ? '' : 'none';
  box.querySelector('#inv-tax').textContent = fmtMoney(invData.tax, { withUnit: false });
  
  box.querySelector('#inv-total-num').textContent = fmtMoney(totalPayable, { withUnit: false });
  box.querySelector('#inv-total-words').textContent = totalPayable > 0 ? numToPersianWords(totalPayable) + ' تومان' : '-';
  
  box.querySelector('#inv-c-name-view').textContent = invData.name || '---';
  box.querySelector('#inv-c-phone-view').textContent = invData.phone || '---';
  box.querySelector('#inv-c-nat-view').textContent = invData.natId || '---';
  box.querySelector('#inv-c-addr-view').textContent = invData.address || '---';
  
  const autoDate = new Date().toLocaleDateString('fa-IR');
  box.querySelector('#inv-date-view').textContent = invData.date || autoDate;
  box.querySelector('#inv-code-view').textContent = window.currentInvId || '---';
  
  box.querySelector('#inv-issuer-view').textContent = invData.issuer ? `صادرکننده: ${invData.issuer}` : '';
  
  if (invData.sellerNat) {
    box.querySelector('#seller-nat-view').textContent = invData.sellerNat;
  } else {
    box.querySelector('#seller-nat-view').textContent = '---';
  }
  
  const paymentRow = box.querySelector('#inv-payment-row');
  if (invData.cash > 0 || invData.nonCash > 0) {
    paymentRow.style.display = '';
    box.querySelector('#inv-cash').textContent = invData.cash > 0 ? fmtMoney(invData.cash, { withUnit: false }) : '---';
    box.querySelector('#inv-noncash').textContent = invData.nonCash > 0 ? fmtMoney(invData.nonCash, { withUnit: false }) : '---';
  } else {
    paymentRow.style.display = 'none';
  }

  // Attach delete events
  tableBody.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => {
      items.splice(Number(b.dataset.del), 1);
      updateInvoiceView(box);
    };
  });
}

function handleAddCustom(box) {
  const name = qs('#custom-name', box).value.trim();
  const price = parseInt(qs('#custom-price', box).value) || 0;
  const qty = parseInt(qs('#custom-qty', box).value) || 1;
  if (!name || price <= 0) return;
  items.push({ name, price, qty });
  qs('#custom-name', box).value = '';
  qs('#custom-price', box).value = '';
  qs('#custom-qty', box).value = '1';
  updateInvoiceView(box);
}

function handleScanner(e, box) {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;
  
  const customQty = parseInt(qs('#scan-qty', box).value) || 1;
  e.target.value = '';
  
  const p = window.allProducts?.find(x => 
    (x.sku && x.sku.toLowerCase() === q) || 
    (x.barcode && x.barcode === q) || 
    x.name.toLowerCase().includes(q) || 
    x.id === q
  );
  
  if (p) {
    const existing = items.find(i => i.id === p.id);
    if (existing) existing.qty += customQty;
    else items.push({ id: p.id, name: p.name, price: p.price, qty: customQty });
    updateInvoiceView(box);
    
    e.target.style.backgroundColor = '#d4edda';
    setTimeout(() => { e.target.style.backgroundColor = ''; }, 300);
  } else {
    e.target.style.backgroundColor = '#f8d7da';
    setTimeout(() => { e.target.style.backgroundColor = ''; }, 300);
  }
}

export async function render(ctx) {
  if (!window.allProducts) {
    try {
      const r = await fetch('/api/admin/products').then(res => res.json());
      if (r.ok) window.allProducts = r.items;
    } catch {}
  }
  
  const shopName = S.settings?.store?.name || 'فروشگاه الکترونیک';
  const shopPhone = S.settings?.store?.phone || '';
  const shopAddress = S.settings?.store?.address || '';
  const sellerNatId = S.settings?.store?.enamad || ''; // Using enamad field as a generic id if available
  
  // Set random ID for the session so it doesn't change on every keystroke
  if (!window.currentInvId) window.currentInvId = Math.floor(10000 + Math.random() * 90000);
  if (!invData.sellerNat) invData.sellerNat = sellerNatId;

  return h`
    <div id="invoice-app-box" class="f-col h-100">
      <div class="row row-between mb-s no-print">
        <h2 class="m-0">${icon('printer')} فاکتورساز رسمی در لحظه</h2>
        <div class="f-row gap-10">
          <label class="field f-row gap-10" style="margin-right: 15px; cursor: pointer;">
            <input type="checkbox" id="chk-show-stamp" checked style="width:18px;height:18px;">
            <span style="font-weight:bold;">نمایش مهر و امضا</span>
          </label>
          <button class="btn btn-primary" id="btn-print-inv">${icon('printer')} چاپ A4</button>
          <button class="btn btn-default" id="btn-print-a5">${icon('printer')} چاپ A5</button>
          <button class="btn btn-default" id="btn-print-thermal">${icon('printer')} حرارتی 8cm</button>
        </div>
      </div>
      
      <div class="inv-container f-row row-wrap gap-20">
        
        <!-- پنل کنترل -->
        <div class="inv-controls no-print p-m panel f-col gap-15" style="flex: 1 1 350px; max-width: 100%; align-self: start;">
          <!-- بخش فراخوانی آنلاین اضافه شد -->
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">فراخوانی سفارش آنلاین</h4>
          <div class="f-row gap-10">
            <label class="field" style="flex:1;">
              <input type="text" class="input ltr" id="inp-load-order" placeholder="شماره سفارش (مثال 123)">
            </label>
            <button class="btn btn-primary" id="btn-load-order">${icon('download')} استخراج اطلاعات</button>
          </div>
          
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">اقلام فاکتور دستی</h4>
          <div class="f-row gap-10">
            <label class="field" style="flex:1;">
              <span class="label">اسکن بارکد / نام (Enter)</span>
              <input type="text" class="input ltr" id="inv-scanner" placeholder="BM-..." autocomplete="off">
            </label>
            <label class="field" style="width:70px;">
              <span class="label">تعداد</span>
              <input type="number" class="input ltr" id="scan-qty" value="1">
            </label>
          </div>
          <button class="btn btn-default w-100 mt-s" id="btn-add-scan">افزودن به لیست</button>
          
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">یا کالا دستی</h4>
          
          <div class="f-col gap-10">
            <label class="field"><span class="label">نام کالا</span><input type="text" class="input" id="custom-name" placeholder="مثال: هندزفری"></label>
            <div class="f-row row-wrap gap-10">
              <label class="field" style="flex:1;"><span class="label">قیمت واحد (تومان)</span><input type="number" class="input ltr" id="custom-price" placeholder="0"></label>
              <label class="field" style="width:80px;"><span class="label">تعداد</span><input type="number" class="input ltr" id="custom-qty" value="1"></label>
            </div>
            <button class="btn btn-default w-100" id="btn-add-custom">افزودن به لیست</button>
          </div>
          
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">مشخصات خریدار</h4>
          
          <div class="f-row row-wrap gap-10">
            <label class="field" style="flex:1;"><span class="label">نام خریدار</span><input type="text" class="input" id="inp-name"></label>
            <label class="field" style="flex:1;"><span class="label">شماره تماس</span><input type="text" class="input ltr" id="inp-phone"></label>
          </div>
          <div class="f-row row-wrap gap-10">
            <label class="field" style="flex:1;"><span class="label">کد ملی / اقتصادی</span><input type="text" class="input ltr" id="inp-natId"></label>
            <label class="field" style="flex:1;"><span class="label">تاریخ (خالی = امروز)</span><input type="text" class="input" id="inp-date" placeholder="140X/X/X"></label>
          </div>
          <label class="field"><span class="label">آدرس خریدار</span><textarea class="textarea" id="inp-address" rows="1"></textarea></label>
          
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">کسورات، اضافات و پرداخت</h4>
          
          <div class="f-row row-wrap gap-10">
            <label class="field" style="flex:1;"><span class="label">تخفیف کل (تومان)</span><input type="number" class="input ltr" id="inp-discount" placeholder="0"></label>
            <label class="field" style="flex:1;"><span class="label">مالیات/ارزش افزوده</span><input type="number" class="input ltr" id="inp-tax" placeholder="0"></label>
          </div>
          <div class="f-row row-wrap gap-10">
            <label class="field" style="flex:1;"><span class="label">پرداخت نقدی</span><input type="number" class="input ltr" id="inp-cash" placeholder="0"></label>
            <label class="field" style="flex:1;"><span class="label">کارتخوان/حواله</span><input type="number" class="input ltr" id="inp-noncash" placeholder="0"></label>
          </div>
          
          <h4 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 5px; margin-bottom: 2px; margin-top: 15px; display: block;">تنظیمات فروشنده</h4>
          <div class="f-row row-wrap gap-10">
            <label class="field" style="flex:1;"><span class="label">کد اقتصادی فروشنده</span><input type="text" class="input ltr" id="inp-seller-nat" value="${sellerNatId}"></label>
            <label class="field" style="flex:1;"><span class="label">تلفن دوم مغازه (دلخواه)</span><input type="text" class="input ltr" id="inp-phone2" placeholder="09..."></label>
            <label class="field" style="flex:1;"><span class="label">نام صادرکننده (اپراتور)</span><input type="text" class="input" id="inp-issuer"></label>
          </div>
          
          <div class="mt-l">
            <button class="btn btn-danger btn-block btn-outline" id="btn-clear">${icon('trash')} پاک‌کردن کل فاکتور</button>
          </div>
        </div>
        
        <!-- پیش‌نمایش چاپی (کاغذ A4) -->
        <div class="inv-paper shadow" id="print-area">
          <div class="inv-watermark">${shopName}</div>
          <div class="inv-header-grid">
            <div class="inv-seller">
              <strong>فروشنده:</strong> ${shopName}<br>
              <strong>کد ملی / اقتصادی:</strong> <span class="mono" id="seller-nat-view">${sellerNatId || '---'}</span><br>
              <strong>تلفن:</strong> <span class="mono">${shopPhone || '---'}${invData.phone2 ? ' - ' + invData.phone2 : ''}</span><br>
              <strong>آدرس:</strong> ${shopAddress || '---'}
            </div>
            <div class="inv-title-box">
              <h2>صورت‌حساب فروش کالا</h2>
            </div>
            <div class="inv-meta-box">
              <p>شماره فاکتور: <span class="mono">INV-<span id="inv-code-view"></span></span></p>
              <p>تاریخ: <span class="mono" id="inv-date-view"></span></p>
            </div>
          </div>

          <div class="inv-buyer-grid">
            <div class="inv-buyer-title">مشخصات خریدار</div>
            <div class="inv-buyer-body">
              <div class="ib-row">
                <span><strong>نام خریدار:</strong> <span id="inv-c-name-view">---</span></span>
                <span><strong>کد ملی / اقتصادی:</strong> <span class="mono" id="inv-c-nat-view">---</span></span>
                <span><strong>شماره تماس:</strong> <span class="mono" id="inv-c-phone-view">---</span></span>
              </div>
              <div class="ib-row">
                <span><strong>آدرس:</strong> <span id="inv-c-addr-view">---</span></span>
              </div>
            </div>
          </div>

          <div style="overflow-x: auto; max-width: 100%;"><table class="inv-table" style="min-width: 500px;">
            <thead>
              <tr>
                <th width="40">ردیف</th>
                <th>شرح کالا و خدمات</th>
                <th width="60">تعداد</th>
                <th width="120">مبلغ واحد (تومان)</th>
                <th width="150">مبلغ کل (تومان)</th>
                <th class="no-print" width="40">عملکرد</th>
              </tr>
            </thead>
            <tbody id="inv-items">
              <tr><td colspan="6" class="t-center muted">سبد فاکتور خالی است.</td></tr>
            </tbody>
          </table></div>

          <div class="inv-totals-grid">
            <div class="inv-totals-words">
              <strong>جمع کل به حروف:</strong>
              <span id="inv-total-words">-</span>
            </div>
            <div class="inv-totals-nums">
              <div class="it-row">
                <span>جمع مبالغ:</span>
                <span id="inv-subtotal" class="mono">0</span>
              </div>
              <div class="it-row" id="inv-discount-row" style="display:none; color: red;">
                <span>تخفیف اعمال شده:</span>
                <span class="mono">- <span id="inv-discount">0</span></span>
              </div>
              <div class="it-row" id="inv-tax-row" style="display:none;">
                <span>مالیات و ارزش افزوده:</span>
                <span class="mono">+ <span id="inv-tax">0</span></span>
              </div>
              <div class="it-row total-final">
                <span>جمع کل پرداختی:</span>
                <span id="inv-total-num" class="mono">0</span>
              </div>
            </div>
          </div>
          
          <div class="inv-payment-row" id="inv-payment-row" style="display:none;">
            <strong>نحوه تسویه:</strong> &nbsp;
            نقدی: <span id="inv-cash" class="mono">---</span> تومان &nbsp;&nbsp;|&nbsp;&nbsp;
            غیرنقدی (کارتخوان/حواله): <span id="inv-noncash" class="mono">---</span> تومان
          </div>

          <div class="inv-signatures">
            <div class="sign-box">
              <strong>مهر و امضای فروشنده</strong>
              <div class="sign-space">
                <div class="stamp-fake">
                  <div class="stamp-title">${shopName === 'یاسایی' ? 'الکتریکی یاسایی' : shopName}</div>
                  <div class="stamp-meta" style="display: ${shopPhone ? 'block' : 'none'}">تلفن: ${shopPhone}</div>
                  <div class="stamp-meta" style="display: ${shopAddress ? 'block' : 'none'}">${shopAddress}</div>
                </div>
              </div>
              <div class="small mt-s" id="inv-issuer-view" style="color:#555;"></div>
            </div>
            <div class="sign-box">
              <strong>مهر و امضای خریدار</strong>
              <div class="sign-space"></div>
            </div>
          </div>

        </div>
        
      </div>
      
      <style>
        .f-row { display: flex; align-items: center; }
        .f-col { display: flex; flex-direction: column; }
        .gap-10 { gap: 10px; }
        .gap-15 { gap: 15px; }
        .gap-20 { gap: 20px; }
        .row-wrap { flex-wrap: wrap; }

        .inv-container { align-items: stretch; }
        .inv-paper { flex: 1 1 300px; max-width: 100%; overflow-x: hidden; background: #fff; color: #000; padding: 25px; border-radius: 4px; border: 4px double #333; font-family: iransans, iranyekan, tahoma, sans-serif; direction: rtl; min-height: 290mm; position: relative; z-index: 1; }
        @media print { body.printing-inv .inv-paper { min-height: 0 !important; height: auto !important; page-break-after: avoid; overflow: hidden !important; } }
        
        .inv-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; font-weight: 900; color: rgba(0,0,0,0.06); white-space: nowrap; pointer-events: none; z-index: 0; user-select: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        
        .inv-header-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 15px; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; align-items: center; }
        .inv-seller { font-size: 13px; line-height: 1.8; }
        .inv-title-box h2 { margin: 0; font-size: 22px; font-weight: 900; text-align: center; border: 2px solid #000; padding: 5px 20px; border-radius: 8px; }
        .inv-meta-box { text-align: left; font-size: 13px; line-height: 1.8; }
        
        .inv-buyer-grid { border: 2px solid #000; margin-bottom: 15px; display: flex; border-radius: 4px; overflow: hidden; }
        .inv-buyer-title { background: #eee; border-left: 2px solid #000; padding: 15px 5px; min-width: 40px; writing-mode: vertical-rl; text-orientation: mixed; text-align: center; font-weight: bold; font-size: 13px; line-height: 1.5; }
        .inv-buyer-body { flex: 1; padding: 8px 15px; display: flex; flex-direction: column; justify-content: center; gap: 8px; font-size: 13px; }
        .ib-row { display: flex; gap: 20px; flex-wrap: wrap; }
        .ib-row > span { flex: 1; min-width: 150px; }
        
        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #000; }
        .inv-table th, .inv-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
        .inv-table th { background: #eee; font-weight: bold; text-align: center; }
        
        .inv-totals-grid { display: flex; border: 2px solid #000; border-radius: 4px; margin-bottom: 15px; overflow: hidden; }
        .inv-totals-words { flex: 1; padding: 10px 15px; font-size: 13px; border-left: 2px solid #000; }
        .inv-totals-nums { width: 300px; display: flex; flex-direction: column; font-size: 13px; }
        .it-row { display: flex; justify-content: space-between; padding: 6px 15px; border-bottom: 1px solid #aaa; }
        .it-row:last-child { border-bottom: none; }
        .total-final { font-weight: bold; font-size: 15px; background: #eee; }
        
        .inv-payment-row { border: 2px solid #000; padding: 10px 15px; border-radius: 4px; font-size: 13px; margin-bottom: 30px; }

        .inv-signatures { display: flex; justify-content: space-around; margin-top: 40px; margin-bottom: 40px; }
        .inv-signatures .sign-box { text-align: center; font-size: 14px; }
        .sign-space { height: 100px; width: 220px; border: 1px dashed #ccc; margin-top: 10px; display: flex; align-items: center; justify-content: center; overflow: visible; }
        .stamp-fake { color: #1e3a8a; border: 2px solid #1e3a8a; padding: 4px 8px; border-radius: 6px; transform: rotate(-6deg); opacity: 0.85; display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; width: 200px; min-height: 70px; background: rgba(255,255,255,0.9); box-shadow: inset 0 0 4px rgba(30,58,138,0.1); }
        .stamp-title { font-weight: 900; font-size: 15px; text-align: center; white-space: nowrap; margin-bottom: 2px; }
        .stamp-meta { font-size: 8.5px; text-align: center; line-height: 1.5; font-weight: normal; margin: 0; }
        
        @media print {
          body.printing-thermal .inv-paper {
            width: 78mm !important;
            padding: 2mm !important;
            font-size: 11px !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
          }
          body.printing-thermal .inv-header-grid {
            display: flex; flex-direction: column; align-items: center; border-bottom: 1px dashed #000; gap: 5px; margin-bottom: 10px; padding-bottom: 10px;
          }
          body.printing-thermal .inv-buyer-grid {
            border: 1px dashed #000; flex-direction: column;
          }
          body.printing-thermal .inv-buyer-title {
            writing-mode: horizontal-tb; text-align: center; border-left: none; border-bottom: 1px dashed #000; padding: 5px; width: 100%;
          }
          body.printing-thermal .inv-buyer-body { padding: 5px; gap: 4px; font-size: 11px; }
          body.printing-thermal .ib-row { flex-direction: column; gap: 4px; }
          body.printing-thermal .inv-table th, body.printing-thermal .inv-table td { padding: 4px 2px; font-size: 10px; border: 1px dashed #000; }
          body.printing-thermal .inv-totals-grid { flex-direction: column; border: 1px dashed #000; }
          body.printing-thermal .inv-totals-words { border-left: none; border-bottom: 1px dashed #000; font-size: 11px; padding: 5px; text-align: center; }
          body.printing-thermal .inv-totals-nums { width: 100%; }
          body.printing-thermal .it-row { padding: 4px 5px; font-size: 11px; border-bottom: 1px dashed #aaa; }
          body.printing-thermal .inv-payment-row { padding: 5px; font-size: 11px; border: 1px dashed #000; flex-direction: column; display: flex; gap: 4px; }
          body.printing-thermal .inv-signatures { flex-direction: column; gap: 20px; align-items: center; }
          body.printing-thermal .sign-space { width: 150px; height: 70px; }
          body.printing-thermal .stamp-fake { width: 140px; min-height: 50px; padding: 2px 4px; border: 1px solid #1e3a8a; box-shadow: none; opacity: 0.9; transform: rotate(-3deg); }
          body.printing-thermal .stamp-title { font-size: 12px; }
          body.printing-thermal .stamp-meta { font-size: 7px; }
          @page { margin: 0; }
          
          /* Original A4 rules below */
          body.printing-inv > :not(.inv-paper) { display: none !important; }
          body, html { background: #fff !important; color: #000 !important; height: auto !important; }
          .no-print { display: none !important; }
          
          body *, html * { visibility: visible; }
          
          .inv-paper { 
            position: static !important; 
            width: 100% !important; 
            max-width: 100% !important; 
            margin: 0 !important; 
            border: none !important; 
            padding: 0 !important; 
            box-shadow: none !important; 
          }
          body.printing-a5 .inv-paper { font-size: 11px; padding: 15px !important; border: 2px solid #000 !important; }
          body.printing-a5 .inv-watermark { font-size: 80px; }
          body.printing-a5 .inv-header-grid { gap: 10px; padding-bottom: 10px; margin-bottom: 10px; }
          body.printing-a5 .inv-title-box h2 { font-size: 16px; padding: 3px 10px; }
          body.printing-a5 .inv-table th, body.printing-a5 .inv-table td { font-size: 11px; padding: 4px; }
          
          @page { size: auto; margin: 0.5cm; }
        }
      </style>
    </div>
  `;
}

export function mount(root, ctx) {
  const box = qs('#invoice-app-box', root);
  if (!box) return;

  const bindInp = (id, key, isNum = false) => {
    const el = qs('#' + id, box);
    if (!el) return;
    el.oninput = () => {
      invData[key] = isNum ? (parseInt(el.value) || 0) : el.value.trim();
      updateInvoiceView(box);
    };
  };

  bindInp('inp-name', 'name');
  bindInp('inp-phone', 'phone');
  bindInp('inp-phone2', 'phone2');
  bindInp('inp-natId', 'natId');
  bindInp('inp-address', 'address');
  bindInp('inp-date', 'date');
  bindInp('inp-issuer', 'issuer');
  bindInp('inp-seller-nat', 'sellerNat');
  bindInp('inp-discount', 'discount', true);
  bindInp('inp-tax', 'tax', true);
  bindInp('inp-cash', 'cash', true);
  bindInp('inp-noncash', 'nonCash', true);

  const loadOrder = async (code) => {
    if (!code) return;
    try {
      const btnLoad = qs('#btn-load-order', box);
      const prevTxt = btnLoad ? btnLoad.innerHTML : '';
      if (btnLoad) btnLoad.innerHTML = '...';
      const r = await fetch('/api/admin/orders?q=' + encodeURIComponent(code)).then(res => res.json());
      if (btnLoad) btnLoad.innerHTML = prevTxt;
      
      const order = (r.items || []).find(x => x.code === code || x.id === code);
      if (order) {
        items = (order.items || []).map(it => ({ id: it.productId, name: it.title || it.name, price: it.price, qty: it.qty }));
        invData.name = order.userName || order.userPhone || '';
        invData.phone = order.userPhone || '';
        invData.address = order.address ? `${order.address.city ? order.address.city + '، ' : ''}${order.address.address}` : '';
        
        let sub = 0;
        items.forEach(x => sub += x.price * x.qty);
        let shipping = order.shippingCost || 0;
        // Estimate discount mapped for the POS builder 
        let calculatedDiscount = (sub + shipping) - order.payable;
        invData.discount = Math.max(0, calculatedDiscount);
        
        if (order.payment?.method === 'online' || order.payment?.method === 'wallet') {
          invData.nonCash = order.payable;
          invData.cash = 0;
        } else {
          invData.cash = order.payable;
          invData.nonCash = 0;
        }
        
        window.currentInvId = order.code;
        
        if(qs('#inp-name', box)) qs('#inp-name', box).value = invData.name;
        if(qs('#inp-phone', box)) qs('#inp-phone', box).value = invData.phone;
        if(qs('#inp-address', box)) qs('#inp-address', box).value = invData.address;
        if(qs('#inp-discount', box)) qs('#inp-discount', box).value = invData.discount || '';
        if(qs('#inp-cash', box)) qs('#inp-cash', box).value = invData.cash || '';
        if(qs('#inp-noncash', box)) qs('#inp-noncash', box).value = invData.nonCash || '';
        if(qs('#inp-load-order', box)) qs('#inp-load-order', box).value = '';
        
        updateInvoiceView(box);
      } else {
        toastWarn('سفارشی با این شماره در سیستم یافت نشد.');
      }
    } catch (e) {
      toastError('خطا در ارتباط با سرور.');
    }
  };

  const btnLoadOrder = qs('#btn-load-order', box);
  if (btnLoadOrder) {
    btnLoadOrder.onclick = () => {
      const code = qs('#inp-load-order', box)?.value.trim();
      if (code) loadOrder(code);
    };
  }

  const inpLoadOrder = qs('#inp-load-order', box);
  if (inpLoadOrder) {
    inpLoadOrder.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const code = inpLoadOrder.value.trim();
        if (code) loadOrder(code);
      }
    };
  }

  const scanner = qs('#inv-scanner', box);
  if (scanner) scanner.addEventListener('keydown', (e) => handleScanner(e, box));
  const btnAddScan = qs('#btn-add-scan', box);
  if (btnAddScan) btnAddScan.onclick = () => { if(scanner && scanner.value) handleScanner({key:'Enter', target: scanner}, box); };
  
  const btnAdd = qs('#btn-add-custom', box);
  if (btnAdd) btnAdd.onclick = () => handleAddCustom(box);
  
  const chkStamp = qs('#chk-show-stamp', box);
  if (chkStamp) {
    chkStamp.onchange = () => {
      const sigs = qs('.inv-signatures', box);
      if (sigs) sigs.style.display = chkStamp.checked ? 'flex' : 'none';
    };
  }

  const doPrint = (mode) => {
    const paper = qs('.inv-paper', box);
    const parent = paper.parentNode;
    const next = paper.nextSibling;
    document.body.appendChild(paper);
    document.body.classList.add('printing-inv');
    if (mode) document.body.classList.add(mode);
    window.print();
    document.body.classList.remove('printing-inv');
    if (mode) document.body.classList.remove(mode);
    if (next) parent.insertBefore(paper, next);
    else parent.appendChild(paper);
  };

  const btnPrintA4 = qs('#btn-print-inv', box);
  if (btnPrintA4) btnPrintA4.onclick = () => doPrint();

  const btnPrintA5 = qs('#btn-print-a5', box);
  if (btnPrintA5) btnPrintA5.onclick = () => doPrint('printing-a5');

  const btnThermal = qs('#btn-print-thermal', box);
  if (btnThermal) btnThermal.onclick = () => doPrint('printing-thermal');

  const btnClear = qs('#btn-clear', box);
  if (btnClear) btnClear.onclick = async () => {
    const okd = await confirmDialog({
      title: 'پاک کردن فاکتور',
      text: 'آیا از پاک کردن کل اطلاعات فاکتور مطمئن هستید؟',
      okText: 'بله، پاک کن',
      danger: true,
      icon: 'trash',
    });
    if (!okd) return;
    items = [];
    invData = { name: '', phone: '', phone2: '', address: '', natId: '', date: '', issuer: '', sellerNat: invData.sellerNat, discount: 0, tax: 0, cash: 0, nonCash: 0 };
    localStorage.removeItem('draft_inv_items');
    localStorage.removeItem('draft_inv_data');
    box.querySelectorAll('.inv-controls input, .inv-controls textarea').forEach(i => {
      if(i.id === 'scan-qty' || i.id === 'custom-qty') i.value = '1';
      else if (i.id === 'inp-seller-nat') i.value = invData.sellerNat;
      else i.value = '';
    });
    window.currentInvId = Math.floor(10000 + Math.random() * 90000);
    updateInvoiceView(box);
  };

  updateInvoiceView(box);
  setTimeout(() => { if(scanner) scanner.focus(); }, 100);
  
  // Auto-load if passed via query params
  if (ctx && ctx.query && ctx.query.get('orderId')) {
    loadOrder(ctx.query.get('orderId'));
  }
}
