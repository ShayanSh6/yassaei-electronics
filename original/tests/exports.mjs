// ─────────────────────────────────────────────────────────────
//  exports: ۱۶ تست خروجی‌های CSV و اکسل (orders.csv و finance.csv)
// ─────────────────────────────────────────────────────────────
import {
  makeClient,
  login,
  ensureDemoAccounts,
  ensureStaffAccount,
  STAFF_PERMS,
  DEMO_PASSWORD,
  STAFF_PASSWORD,
} from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ [${pass}] ${name}`);
  } else {
    fail++;
    console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`);
  }
}

console.log(`\n═══ exports: ۱۶ تست خروجی CSV و امنیت اکسل · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam']);
const staffInfo = await ensureStaffAccount(BASE);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
await login(admin, 'admin', 'Yassaei@1404').catch(async () => {
  await login(admin, 'admin', 'Demo@1404');
});
await admin.patch('/api/admin/settings/features', { captcha: false });

const user = makeClient(BASE);
await user.get('/api/bootstrap');
await login(user, 'maryam', DEMO_PASSWORD);

const staff = makeClient(BASE);
await staff.get('/api/bootstrap');
await login(staff, 'staff', STAFF_PASSWORD);

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');

// ثبت یک سفارش با ورودی تست تزریق فرمول
const prods = (await anon.get('/api/products?limit=2')).json.items || [];
const pTest = prods[0] || { id: 'ys-001' };
await user.post('/api/cart/clear');
await user.post('/api/cart/add', { productId: pTest.id, qty: 1 });
const injOrder = await user.post('/api/checkout', {
  delivery: 'pickup',
  paymentMethod: 'gateway',
  acceptTerms: true,
  note: '=cmd|’ /C calc’!A0', // فرمول اکسل مخرب
});
const injOrderId = injOrder.json?.order?.id;
// پرداخت سفارش
await user.post(`/api/payments/simulate/${injOrderId}`, { success: true });

// ── ۱) تست‌های orders.csv (تست ۱ تا ۸) ──
// 1
const oAnon = await anon.get('/api/admin/export/orders.csv');
ok('۱. کاربر ناشناس دسترسی به orders.csv ندارد (401)', oAnon.status === 401);

// 2
const oUser = await user.get('/api/admin/export/orders.csv');
ok('۲. کاربر عادی دسترسی به orders.csv ندارد (403)', oUser.status === 403);

// 3
const oStaff = await staff.get('/api/admin/export/orders.csv');
ok('۳. کارمند با دسترسی orders.view می‌تواند orders.csv را دریافت کند (200)', oStaff.status === 200, `وضعیت: ${oStaff.status}`);

// 4
const ctOrder = oStaff.headers?.get?.('content-type') || '';
ok('۴. هدر Content-Type برای orders.csv مقدار text/csv; charset=utf-8 است', ctOrder.includes('text/csv') && ctOrder.includes('utf-8'), ctOrder);

// 5
ok('۵. خروجی orders.csv با کاراکتر BOM فارسی آغاز می‌شود', oStaff.hasBom);

// 6
const textOrder = oStaff.text ? oStaff.text() : '';
ok('۶. خروجی orders.csv شامل ستون تاریخ شمسی است', textOrder.includes('تاریخ شمسی') && /140\d\/\d\d\/\d\d/.test(textOrder));

// 7
ok('۷. خروجی orders.csv شامل ستون سود است', textOrder.includes('سود'));

// 8
ok('۸. سپر تزریق فرمول اکسل در orders.csv فعال است (کاراکتر = خنثی شده)', textOrder.includes("'=cmd") || !textOrder.includes('=cmd|'));

// ── ۲) تست‌های finance.csv (تست ۹ تا ۱۶) ──
// 9
const fAnon = await anon.get('/api/admin/export/finance.csv');
ok('۹. کاربر ناشناس دسترسی به finance.csv ندارد (401)', fAnon.status === 401);

// 10
const fUser = await user.get('/api/admin/export/finance.csv');
ok('۱۰. کاربر عادی دسترسی به finance.csv ندارد (403)', fUser.status === 403);

// 11 (کارمند به صورت پیش‌فرض stats.view ندارد)
const fStaffWithout = await staff.get('/api/admin/export/finance.csv');
ok('۱۱. کارمند بدون دسترسی stats.view دسترسی به finance.csv ندارد (403)', fStaffWithout.status === 403, `وضعیت: ${fStaffWithout.status}`);

// اعطای دسترسی stats.view به کارمند
const allUsers = (await admin.get('/api/admin/users?limit=200')).json.items || [];
const sUser = allUsers.find((u) => u.username === 'staff');
if (sUser) {
  await admin.patch(`/api/admin/users/${sUser.id}`, {
    permissions: { ...STAFF_PERMS, 'stats.view': true },
  });
}

// 12
const fStaffWith = await staff.get('/api/admin/export/finance.csv');
ok('۱۲. کارمند با دسترسی stats.view می‌تواند finance.csv را دریافت کند (200)', fStaffWith.status === 200, `وضعیت: ${fStaffWith.status}`);

// 13
const ctFinance = fStaffWith.headers?.get?.('content-type') || '';
ok('۱۳. هدر Content-Type برای finance.csv مقدار text/csv; charset=utf-8 است', ctFinance.includes('text/csv') && ctFinance.includes('utf-8'), ctFinance);

// 14
ok('۱۴. خروجی finance.csv با کاراکتر BOM فارسی آغاز می‌شود', fStaffWith.hasBom);

// 15
const textFinance = fStaffWith.text ? fStaffWith.text() : '';
ok('۱۵. خروجی finance.csv شامل ستون سود خالص و تاریخ شمسی است', textFinance.includes('سود خالص') && textFinance.includes('تاریخ شمسی'));

// 16
ok('۱۶. خروجی finance.csv فقط شامل فاکتورهای پرداخت‌شده است', (textFinance.includes('تأیید شده') || textFinance.includes('ارسال شده') || textFinance.includes('تحویل شده')) && !textFinance.includes('لغو شده'));

// بازگرداندن دسترسی کارمند
if (sUser) {
  await admin.patch(`/api/admin/users/${sUser.id}`, {
    permissions: STAFF_PERMS,
  });
}

console.log(`\n═══ نتیجه exports: ${pass} موفق · ${fail} ناموفق ═══\n`);
if (fail) process.exit(1);
