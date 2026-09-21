// ─────────────────────────────────────────────────────────────
//  kyc: تست‌های احراز هویت اختیاری/پیکربندی‌پذیر هنگام ثبت سفارش
//         + پنل مدیریت KYC + فرم PDF تعهدنامه
//  اجرا: BASE=http://127.0.0.1:3000 node tests/kyc.mjs
// ─────────────────────────────────────────────────────────────
import { makeClient, login, ensureDemoAccounts, DEMO_PASSWORD } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}

console.log(`\n═══ kyc: احراز هویت پیکربندی‌پذیر + پنل بررسی · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam', 'reza']);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
await login(admin, 'admin', 'Yassaei@1404').catch(async () => { await login(admin, 'admin', 'Demo@1404'); });
await admin.patch('/api/admin/settings/features', { captcha: false });

const user = makeClient(BASE);
await user.get('/api/bootstrap');
await login(user, 'maryam', DEMO_PASSWORD);

const buyer = makeClient(BASE);
await buyer.get('/api/bootstrap');
await login(buyer, 'reza', DEMO_PASSWORD);

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');

// کالای ارزان برای سبد
const prods = (await anon.get('/api/products?limit=3')).json.items || [];
const prod = prods[0] || { id: 'ys-001' };

/** سبد را برای یک کلاینت آماده می‌کند */
async function prepare(cl) {
  await cl.post('/api/cart/clear');
  await cl.post('/api/cart/add', { productId: prod.id, qty: 1 });
}

/** ثبت سفارش تحویل حضوری (بدون نیاز به آدرس) */
const placeOrder = (cl, paymentMethod = 'gateway') => cl.post('/api/checkout', {
  delivery: 'pickup', paymentMethod, acceptTerms: true,
});

/** تنظیم قاعدهٔ KYC از مسیر رسمی پنل مدیریت */
async function setRule(patch) {
  const r = await admin.patch('/api/admin/settings/orders', patch);
  return r;
}

/** وضعیت KYC یک کاربر را مستقیم ست می‌کند (از مسیر پنل مدیریت) */
async function setKycStatus(username, status, message = '') {
  const us = (await admin.get('/api/admin/users?q=' + encodeURIComponent(username))).json.items || [];
  const u = us.find((x) => x.username === username);
  if (!u) return null;
  const r = await admin.patch(`/api/admin/users/${u.id}`, { kycStatus: status, kycMessage: message });
  return { id: u.id, status: r.status };
}

const meKyc = async (cl) => (await cl.get('/api/me')).json?.me?.kycStatus || '';

// ── ۱) پیش‌فرض: غیرفعال ────────────────────────────────────
const resetRule = await setRule({ kyc: { required: false, condition: 'disabled', minAmount: 50000000, message: '' } });
ok('۱. ذخیرهٔ قاعدهٔ «غیرفعال» در تنظیمات سفارش (200)', resetRule.status === 200, `وضعیت: ${resetRule.status}`);
ok('۲. قاعدهٔ ذخیره‌شده condition=disabled و required=false است',
  resetRule.json?.value?.kyc?.condition === 'disabled' && resetRule.json?.value?.kyc?.required === false,
  JSON.stringify(resetRule.json?.value?.kyc));

const boot = await anon.get('/api/bootstrap');
ok('۳. /api/bootstrap قاعدهٔ KYC را به کلاینت می‌دهد (orders.kyc)',
  boot.json?.settings?.orders?.kyc?.condition === 'disabled' && boot.json?.settings?.orders?.kyc?.minAmount === 50000000,
  JSON.stringify(boot.json?.settings?.orders?.kyc));

await setKycStatus('maryam', 'none');
await prepare(user);
const freeOrder = await placeOrder(user);
ok('۴. با قاعدهٔ «غیرفعال»، کاربر بدون احراز هویت می‌تواند سفارش ثبت کند (200)',
  freeOrder.status === 200, `${freeOrder.status} ${freeOrder.json?.code || ''}`);

// ── ۲) قاعدهٔ «تمام سفارش‌ها» ───────────────────────────────
await setRule({ kyc: { required: true, condition: 'all' } });
await prepare(user);
const blockedAll = await placeOrder(user);
ok('۵. با قاعدهٔ «all»، کاربر تأییدنشده مسدود می‌شود (403 kyc_required)',
  blockedAll.status === 403 && blockedAll.json?.code === 'kyc_required',
  `${blockedAll.status} ${blockedAll.json?.code || ''}`);

await setKycStatus('maryam', 'approved');
await prepare(user);
const allowedAll = await placeOrder(user);
ok('۶. با قاعدهٔ «all»، کاربر تأییدشده سفارش را ثبت می‌کند (200)',
  allowedAll.status === 200, `${allowedAll.status} ${allowedAll.json?.code || ''}`);

// ── ۳) قاعدهٔ «بالای مبلغ مشخص» ─────────────────────────────
await setKycStatus('maryam', 'none');
await setRule({ kyc: { required: true, condition: 'amount', minAmount: 999999999 } });
await prepare(user);
const cheapOk = await placeOrder(user);
ok('۷. قاعدهٔ «amount» با آستانهٔ بزرگ: سفارش کوچک آزاد است (200)',
  cheapOk.status === 200, `${cheapOk.status} ${cheapOk.json?.code || ''}`);

await setRule({ kyc: { required: true, condition: 'amount', minAmount: 1000 } });
await prepare(user);
const priceyBlocked = await placeOrder(user);
ok('۸. قاعدهٔ «amount» با آستانهٔ کوچک: سفارش مسدود می‌شود (403 kyc_required)',
  priceyBlocked.status === 403 && priceyBlocked.json?.code === 'kyc_required',
  `${priceyBlocked.status} ${priceyBlocked.json?.code || ''}`);

// ── ۴) قاعدهٔ «فقط اقساطی» ──────────────────────────────────
await setRule({ kyc: { required: true, condition: 'installments' } });
await prepare(user);
const gatewayOk = await placeOrder(user, 'gateway');
ok('۹. قاعدهٔ «installments»: پرداخت با درگاه آزاد است (200)',
  gatewayOk.status === 200, `${gatewayOk.status} ${gatewayOk.json?.code || ''}`);

await prepare(user);
const snapBlocked = await placeOrder(user, 'snapppay');
ok('۱۰. قاعدهٔ «installments»: اسنپ‌پی بدون احراز هویت مسدود است (403 kyc_required)',
  snapBlocked.status === 403 && snapBlocked.json?.code === 'kyc_required',
  `${snapBlocked.status} ${snapBlocked.json?.code || ''}`);

// ── ۵) قاعدهٔ «فقط اولین خرید» ──────────────────────────────
// کاربر تازه (بدون هیچ سفارش قبلی) تا قاعدهٔ first_order درست سنجیده شود
const freshName = 'kycfirst' + String(Date.now()).slice(-6);
const fresh = makeClient(BASE);
await fresh.get('/api/bootstrap');
const reg = await fresh.post('/api/auth/register', {
  mode: 'username', username: freshName, name: 'کاربر تازهٔ احراز هویت',
  password: DEMO_PASSWORD, acceptTerms: true, captchaToken: undefined,
});
ok('۱۱. کاربر تازه برای سنجش قاعدهٔ «اولین خرید» ساخته می‌شود (200)',
  reg.status === 200 && !!reg.json?.me, `${reg.status} ${reg.json?.code || ''}`);

await setRule({ kyc: { required: true, condition: 'first_order' } });
await prepare(fresh);
const firstBlocked = await placeOrder(fresh);
ok('۱۲. قاعدهٔ «first_order»: خرید اولِ کاربر تأییدنشده مسدود می‌شود (403 kyc_required)',
  firstBlocked.status === 403 && firstBlocked.json?.code === 'kyc_required',
  `${firstBlocked.status} ${firstBlocked.json?.code || ''}`);

await setKycStatus(freshName, 'approved');
await prepare(fresh);
const firstApproved = await placeOrder(fresh);
ok('۱۳. قاعدهٔ «first_order»: کاربر تأییدشده خرید اول را ثبت می‌کند (200)',
  firstApproved.status === 200, `${firstApproved.status} ${firstApproved.json?.code || ''}`);

await setKycStatus(freshName, 'none');
await prepare(fresh);
const secondOrder = await placeOrder(fresh);
ok('۱۴. قاعدهٔ «first_order»: خرید دوم بدون احراز هویت آزاد است (200)',
  secondOrder.status === 200, `${secondOrder.status} ${secondOrder.json?.code || ''}`);

// ── ۶) کلیدهای تخت (kycRequired/kycCondition/kycMinAmount) ──
const flat = await setRule({ kycRequired: true, kycCondition: 'amount', kycMinAmount: 12345 });
ok('۱۵. کلیدهای تخت kycRequired/kycCondition/kycMinAmount هم پذیرفته می‌شوند',
  flat.json?.value?.kyc?.required === true && flat.json?.value?.kyc?.condition === 'amount' && flat.json?.value?.kyc?.minAmount === 12345,
  JSON.stringify(flat.json?.value?.kyc));

const badRule = await setRule({ kyc: { condition: 'nonsense' } });
ok('۱۶. قاعدهٔ نامعتبر با خطای 400 رد می‌شود', badRule.status === 400, `وضعیت: ${badRule.status}`);

// ── ۷) پنل مدیریت KYC ───────────────────────────────────────
await setRule({ kyc: { required: false, condition: 'disabled', minAmount: 50000000, message: '' } });
await setKycStatus('maryam', 'none');

const submit = await user.post('/api/user/kyc', {
  selfie: '/uploads/test-selfie.jpg', idCard: '/uploads/test-idcard.jpg', formDoc: '/uploads/test-form.pdf',
});
ok('۱۷. کاربر مدارک احراز هویت را ارسال می‌کند (200) و وضعیت «در انتظار» می‌گیرد',
  submit.status === 200 && (await meKyc(user)) === 'pending',
  `${submit.status} · وضعیت: ${await meKyc(user)}`);

const anonKyc = await anon.get('/api/admin/kyc');
ok('۱۸. کاربر ناشناس به پنل KYC دسترسی ندارد (401)', anonKyc.status === 401, `وضعیت: ${anonKyc.status}`);

const userKyc = await user.get('/api/admin/kyc');
ok('۱۹. کاربر عادی به پنل KYC دسترسی ندارد (403)', userKyc.status === 403, `وضعیت: ${userKyc.status}`);

const list = await admin.get('/api/admin/kyc?status=pending');
const row = (list.json?.items || []).find((x) => x.username === 'maryam');
ok('۲۰. فهرست «در انتظار بررسی» کاربر و مدارکش را برمی‌گرداند',
  list.status === 200 && !!row && row.selfie === '/uploads/test-selfie.jpg' && row.idCard === '/uploads/test-idcard.jpg' && row.formDoc === '/uploads/test-form.pdf',
  `وضعیت: ${list.status} · آیتم: ${row ? 'پیدا شد' : 'پیدا نشد'}`);

ok('۲۱. شمارنده‌های پنل (همه/در انتظار/تأیید/رد) برگردانده می‌شود',
  typeof list.json?.counts?.all === 'number' && typeof list.json?.counts?.pending === 'number'
  && typeof list.json?.counts?.approved === 'number' && typeof list.json?.counts?.rejected === 'number',
  JSON.stringify(list.json?.counts));

ok('۲۲. فیلتر status=pending فقط موارد در انتظار را برمی‌گرداند',
  (list.json?.items || []).every((x) => x.kycStatus === 'pending'),
  JSON.stringify((list.json?.items || []).map((x) => x.kycStatus).slice(0, 6)));

const reject = await admin.post(`/api/admin/kyc/${row?.id}/decision`, {
  decision: 'rejected', message: 'عکس کارت ملی ناخوانا است؛ لطفاً دوباره ارسال کنید.',
});
ok('۲۳. «رد مدارک» با دلیل، وضعیت را rejected می‌کند (200)',
  reject.status === 200 && (await meKyc(user)) === 'rejected',
  `${reject.status} · وضعیت: ${await meKyc(user)}`);

const meAfterReject = await user.get('/api/me');
ok('۲۴. دلیل رد شدن به کاربر نمایش داده می‌شود (kycMessage)',
  String(meAfterReject.json?.me?.kycMessage || '').includes('ناخوانا'),
  meAfterReject.json?.me?.kycMessage);

const approve = await admin.post(`/api/admin/kyc/${row?.id}/decision`, { decision: 'approved', message: '' });
ok('۲۵. «تأیید مدارک» وضعیت را approved می‌کند (200)',
  approve.status === 200 && (await meKyc(user)) === 'approved',
  `${approve.status} · وضعیت: ${await meKyc(user)}`);

const approvedTab = await admin.get('/api/admin/kyc?status=approved');
ok('۲۶. تب «تأیید شده» کاربر تأییدشده را نشان می‌دهد',
  (approvedTab.json?.items || []).some((x) => x.username === 'maryam'),
  `تعداد: ${(approvedTab.json?.items || []).length}`);

const rejectedTab = await admin.get('/api/admin/kyc?status=rejected');
ok('۲۷. تب «رد شده» فقط موارد ردشده را نشان می‌دهد',
  (rejectedTab.json?.items || []).every((x) => x.kycStatus === 'rejected'),
  JSON.stringify((rejectedTab.json?.items || []).map((x) => x.kycStatus).slice(0, 6)));

const overview = await admin.get('/api/admin/overview');
ok('۲۸. داشبورد مدیر، شمار در انتظار بررسی KYC را دارد (awaiting.kyc)',
  typeof overview.json?.awaiting?.kyc === 'number', JSON.stringify(overview.json?.awaiting));

// ── ۸) فرم PDF تعهدنامه ─────────────────────────────────────
const pdf = await anon.get('/assets/docs/yassaei-kyc.pdf');
const head = new TextDecoder().decode((pdf.rawBytes || new Uint8Array()).slice(0, 5));
ok('۲۹. فرم تعهدنامهٔ فارسی در /assets/docs/yassaei-kyc.pdf در دسترس است (200 + PDF)',
  pdf.status === 200 && head === '%PDF-', `${pdf.status} · سرآیند: ${head}`);

const pdfType = pdf.headers?.get?.('content-type') || '';
ok('۳۰. نوع محتوای فرم application/pdf است', pdfType.includes('application/pdf'), pdfType);

// ── ۹) بازگرداندن وضعیت پیش‌فرض ─────────────────────────────
const finalReset = await setRule({ kyc: { required: false, condition: 'disabled', minAmount: 50000000, message: '' } });
await setKycStatus('maryam', 'none');
await setKycStatus('reza', 'none');
ok('۳۱. در پایان، قاعده به «غیرفعال» برمی‌گردد تا بقیهٔ تست‌ها دست‌نخورده بمانند',
  finalReset.json?.value?.kyc?.condition === 'disabled', JSON.stringify(finalReset.json?.value?.kyc));

console.log(`\n═══ نتیجهٔ kyc: ${pass} موفق · ${fail} ناموفق ═══\n`);
if (fail) process.exit(1);
