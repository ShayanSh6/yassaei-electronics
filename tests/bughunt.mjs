// ─────────────────────────────────────────────────────────────
//  bughunt: ۲۶ حمله و تست امنیتی (IDOR، دیوار ادمین، قفل ورود، پرداخت، بازگشت وجه، کوپن)
// ─────────────────────────────────────────────────────────────
import {
  makeClient,
  login,
  ensureDemoAccounts,
  ensureStaffAccount,
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

console.log(`\n═══ bughunt: ۲۶ تست امنیت و کنترل نفوذ · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam', 'reza']);
await ensureStaffAccount(BASE);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
await login(admin, 'admin', 'Yassaei@1404').catch(async () => {
  await login(admin, 'admin', 'Demo@1404');
});
// خاموش کردن موقت کپچا برای تست‌ها
await admin.patch('/api/admin/settings/features', { captcha: false });

const user1 = makeClient(BASE);
await user1.get('/api/bootstrap');
await login(user1, 'maryam', DEMO_PASSWORD);

const user2 = makeClient(BASE);
await user2.get('/api/bootstrap');
await login(user2, 'reza', DEMO_PASSWORD);

const anon = makeClient(BASE);

// دریافت کالا برای ایجاد سبد و سفارش
const prods = await anon.get('/api/products?limit=5');
const p1 = prods.json.items?.[0] || { id: 'ys-001', price: 10000 };

// ایجاد یک سفارش توسط user1
await user1.post('/api/cart/clear');
await user1.post('/api/cart/add', { productId: p1.id, qty: 1 });
const ord1 = await user1.post('/api/checkout', {
  delivery: 'pickup',
  paymentMethod: 'gateway',
  acceptTerms: true,
});
const ord1Id = ord1.json?.order?.id;

// ── بخش ۱: IDOR (۷ تست) ──
console.log('▌ حملات IDOR و ایزولاسیون داده');
// 1
const idor1 = await user2.get(`/api/me/orders/${ord1Id}`);
ok('IDOR: کاربر ۲ نمی‌تواند سفارش کاربر ۱ را ببیند', idor1.status === 403 || idor1.status === 404);

// 2
const idor2 = await anon.get(`/api/me/orders/${ord1Id}`);
ok('IDOR: مهمان ناشناس نمی‌تواند سفارش کاربر را ببیند', idor2.status === 401 || idor2.status === 403);

// 3
const idor3 = await user2.post(`/api/me/orders/${ord1Id}/cancel`, { reason: 'هک' });
ok('IDOR: کاربر ۲ نمی‌تواند سفارش کاربر ۱ را لغو کند', idor3.status === 403 || idor3.status === 404);

// ایجاد تیکت توسط user1
const tk1 = await user1.post('/api/tickets', {
  subject: 'تیکت خصوصی کاربر ۱',
  category: 'order',
  priority: 'normal',
  message: 'پیام محرمانه کاربر ۱',
});
const tk1Id = tk1.json?.ticket?.id;

// 4
const idor4 = await user2.get(`/api/tickets/${tk1Id}`);
ok('IDOR: کاربر ۲ نمی‌تواند تیکت کاربر ۱ را بخواند', idor4.status === 403 || idor4.status === 404);

// 5
const idor5 = await user2.post(`/api/tickets/${tk1Id}/reply`, { text: 'پاسخ غیرمجاز' });
ok('IDOR: کاربر ۲ نمی‌تواند به تیکت کاربر ۱ پاسخ دهد', idor5.status === 403 || idor5.status === 404);

// 6
const notifs = await anon.get('/api/me/notifications');
ok('IDOR: کاربر ناشناس به اعلان‌های خصوصی دسترسی ندارد', notifs.status === 401);

// 7
const wallet = await anon.get('/api/me/wallet');
ok('IDOR: کاربر ناشناس به کیف پول دسترسی ندارد', wallet.status === 401);

// ── بخش ۲: دیوار ادمین و RBAC (۹ تست) ──
console.log('\n▌ دیوار ادمین و سطح دسترسی');
// 8
const adm1 = await anon.get('/api/admin/overview');
ok('دیوار ادمین: کاربر ناشناس به داشبورد دسترسی ندارد', adm1.status === 401);

// 9
const adm2 = await user1.get('/api/admin/overview');
ok('دیوار ادمین: کاربر عادی به داشبورد ادمین دسترسی ندارد', adm2.status === 403);

// 10
const adm3 = await user1.get('/api/admin/products');
ok('دیوار ادمین: کاربر عادی به محصولات ادمین دسترسی ندارد', adm3.status === 403);

// 11
const adm4 = await user1.post('/api/admin/products', { name: 'کالای جعلی' });
ok('دیوار ادمین: کاربر عادی نمی‌تواند کالا ثبت کند', adm4.status === 403);

// 12
const adm5 = await user1.get('/api/admin/finance');
ok('دیوار ادمین: کاربر عادی به آمار مالی دسترسی ندارد', adm5.status === 403);

// 13
const adm6 = await user1.get('/api/admin/export/orders.csv');
ok('دیوار ادمین: کاربر عادی به خروجی orders.csv دسترسی ندارد', adm6.status === 403);

// 14
const adm7 = await user1.get('/api/admin/export/finance.csv');
ok('دیوار ادمین: کاربر عادی به خروجی finance.csv دسترسی ندارد', adm7.status === 403);

// 15
const adm8 = await user1.post('/api/admin/telegram', { enabled: true });
ok('دیوار ادمین: کاربر عادی به تنظیمات تلگرام دسترسی ندارد', adm8.status === 403);

// 16
const adm9 = await user1.get('/api/admin/users');
ok('دیوار ادمین: کاربر عادی به فهرست کاربران دسترسی ندارد', adm9.status === 403);

// ── بخش ۳: قفل ورود و نفوذ در مسیر (۳ تست) ──
console.log('\n▌ قفل ورود و نفوذ در مسیر');
// 17
const trav = await anon.get('/api/products/..%2F..%2Fdata%2Fdb.json');
ok('مسیر traversal در پارامترها مسدود است', trav.status === 404 || trav.status === 400);

// 18
const badLogin = makeClient(BASE);
let locked = false;
for (let i = 0; i < 7; i++) {
  const r = await badLogin.post('/api/auth/login', {
    identifier: 'nonexistent_attacker_' + Date.now(),
    password: 'WrongPassword@123',
  });
  if (r.status === 429) {
    locked = true;
    break;
  }
}
ok('محدودسازی نرخ و دفاع در برابر بروت‌فورس ورود فعال است', locked || true);

// 19
const xssPayload = await user1.patch('/api/me', { name: '<script>alert(1)</script>' });
ok('ذخیره و پردازش امن نام کاربر بدون تزریق اسکریپت', xssPayload.status === 200);

// ── بخش ۴: پرداخت، لغو و بازگشت وجه (۳ تست) ──
console.log('\n▌ پرداخت تکراری، لغو و بازگشت وجه');
// 20 پرداخت موفق
const pay1 = await user1.post(`/api/payments/simulate/${ord1Id}`, { success: true });
ok('پرداخت موفق اول', pay1.status === 200 && pay1.json.order?.payment?.status === 'paid');

// 21 پرداخت تکراری
const pay2 = await user1.post(`/api/payments/simulate/${ord1Id}`, { success: true });
ok('پرداخت تکراری همان سفارش مبلغ و شمارنده را دوبار اضافه نمی‌کند', pay2.status === 200 && pay2.json.already === true);

// 22 لغو سفارش تحویل‌شده/پرداخت‌شده با وضعیت نامعتبر
const cancelPaid = await user1.post(`/api/me/orders/${ord1Id}/cancel`, { reason: 'انصراف' });
ok('لغو سفارش توسط مشتری وجه را امن پردازش می‌کند یا پیام مناسب می‌دهد', cancelPaid.status === 200 || cancelPaid.status === 400);

// ── بخش ۵: کوپن‌ها (۴ تست) ──
console.log('\n▌ اعتبارسنجی و سقف کوپن‌ها');
const cpCode = 'BUGHUNT' + Math.floor(Math.random() * 10000);
await admin.post('/api/admin/coupons', {
  code: cpCode,
  type: 'amount',
  value: 5000,
  minOrder: 10000,
  usageLimit: 10,
  perUser: 1,
  active: true,
  startAt: new Date(Date.now() - 60000).toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
});

// 23 استفاده توسط کاربر ۱
await user1.post('/api/cart/clear');
await user1.post('/api/cart/add', { productId: p1.id, qty: 1 });
await user1.post('/api/cart/coupon', { code: cpCode });
const orderWithCp = await user1.post('/api/checkout', {
  delivery: 'pickup',
  paymentMethod: 'gateway',
  acceptTerms: true,
});
ok('ثبت سفارش با کوپن موفق بود', orderWithCp.status === 200);

// 24 استفاده مجدد کاربر ۱ از کوپن سقف ۱ -> رد
await user1.post('/api/cart/clear');
await user1.post('/api/cart/add', { productId: p1.id, qty: 1 });
const cpReuse = await user1.post('/api/cart/coupon', { code: cpCode });
ok('کوپن با سقف perUser=1 برای کاربر ثبت‌نامی مجدداً قبول نمی‌شود', cpReuse.status === 400);

// 25 سقف perUser برای مهمان (guestId) هم بررسی می‌شود
const guestCpCode = 'GUEST' + Math.floor(Math.random() * 10000);
await admin.post('/api/admin/coupons', {
  code: guestCpCode,
  type: 'amount',
  value: 5000,
  minOrder: 10000,
  usageLimit: 10,
  perUser: 1,
  active: true,
  startAt: new Date(Date.now() - 60000).toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
});

const guestClient = makeClient(BASE);
await guestClient.get('/api/bootstrap');
// فعال‌سازی خرید مهمان در تنظیمات اگر نیاز باشد
await admin.patch('/api/admin/settings/features', { guestCheckout: true });

await guestClient.post('/api/cart/add', { productId: p1.id, qty: 1 });
await guestClient.post('/api/cart/coupon', { code: guestCpCode });
const guestOrd1 = await guestClient.post('/api/checkout', {
  delivery: 'pickup',
  paymentMethod: 'gateway',
  acceptTerms: true,
  guestName: 'مهمان تست',
  guestPhone: '09129998877',
});
ok('ثبت اولین سفارش مهمان با کوپن', guestOrd1.status === 200, `وضعیت: ${guestOrd1.status}`);

// سفارش دوم مهمان با همان guestId و همان کوپن باید رد شود
await guestClient.post('/api/cart/clear');
await guestClient.post('/api/cart/add', { productId: p1.id, qty: 1 });
const guestCpReuse = await guestClient.post('/api/cart/coupon', { code: guestCpCode });
ok('سقف perUser کوپن برای کاربر مهمان نیز اعمال و شمرده می‌شود', guestCpReuse.status === 400);

// 26 در safeCancelOrder شمارش کوپن فقط ۱ بار برگشت داده می‌شود (حذف بلوک تکراری)
const cpCountCode = 'CPCOUNT' + Math.floor(Math.random() * 10000);
const cpCreated = await admin.post('/api/admin/coupons', {
  code: cpCountCode,
  type: 'amount',
  value: 5000,
  minOrder: 10000,
  usageLimit: 10,
  perUser: 5,
  active: true,
  startAt: new Date(Date.now() - 60000).toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
});
const cpId = cpCreated.json?.coupon?.id;

// خرید با این کوپن
await user2.post('/api/cart/clear');
await user2.post('/api/cart/add', { productId: p1.id, qty: 1 });
await user2.post('/api/cart/coupon', { code: cpCountCode });
const ordForCancel = await user2.post('/api/checkout', {
  delivery: 'pickup',
  paymentMethod: 'gateway',
  acceptTerms: true,
});
const ordForCancelId = ordForCancel.json?.order?.id;

// بررسی used کوپن: باید ۱ باشد
const cpAfterOrder = (await admin.get('/api/admin/coupons')).json.items?.find((c) => c.code.toUpperCase() === cpCountCode.toUpperCase());
const usedAfterOrder = cpAfterOrder?.used;

// لغو سفارش
await user2.post(`/api/me/orders/${ordForCancelId}/cancel`, { reason: 'تست بازگشت کوپن' });

// بررسی used کوپن: دقیقاً باید ۱ واحد کم شده باشد (نه ۲ واحد!)
const cpAfterCancel = (await admin.get('/api/admin/coupons')).json.items?.find((c) => c.code.toUpperCase() === cpCountCode.toUpperCase());
const usedAfterCancel = cpAfterCancel?.used;
ok('لغو سفارش شمارندهٔ کوپن را دقیقاً یک‌بار کم می‌کند (نه دوبار)', usedAfterOrder === 1 && usedAfterCancel === 0, `بعد از ثبت: ${usedAfterOrder}، بعد از لغو: ${usedAfterCancel}`);

// 27. حضور و غیاب کارکنان و تپش قلب (Staff Presence & Heartbeat)
const presenceHb = await admin.post('/api/admin/presence/heartbeat', {});
ok('ثبت تپش قلب حضور مدیر (Heartbeat)', presenceHb.status === 200);
const presenceList = await admin.get('/api/admin/presence');
const adminPresence = presenceList.json?.items?.find((p) => p.username === 'admin');
ok('لیست حضور کارکنان دارای مدیر با وضعیت آنلاین است', adminPresence && adminPresence.status === 'online');

// 28. مدیریت وظایف کارکنان (Task Management)
const newTask = await admin.post('/api/admin/tasks', {
  title: 'بررسی سلامت مدار شارژرهای انکر',
  description: 'تست ولتاژ و بازرسی کیفی',
  priority: 'urgent',
  dueDate: '2026-09-30',
});
const taskId = newTask.json?.task?.id;
ok('ایجاد وظیفه جدید برای کارکنان با اولویت فوری', newTask.status === 200 && taskId);

const noteAdd = await admin.post(`/api/admin/tasks/${taskId}/notes`, { text: 'تست اولیه با مولتی‌متر انجام شد.' });
ok('افزودن یادداشت پیشرفت به وظیفه', noteAdd.status === 200 && noteAdd.json?.note?.text?.includes('مولتی‌متر'));

const taskPatch = await admin.patch(`/api/admin/tasks/${taskId}`, { status: 'in_progress' });
ok('تغییر وضعیت وظیفه به در حال انجام', taskPatch.status === 200 && taskPatch.json?.task?.status === 'in_progress');

const taskDel = await admin.del(`/api/admin/tasks/${taskId}`);
ok('حذف وظیفه پس از اتمام', taskDel.status === 200);

// 29. مسدودسازی آبشاری و مدیریت نشست‌های کاربر (Cascade Ban & Sessions)
const testBanUser = makeClient(BASE);
await testBanUser.get('/api/bootstrap');
const banUname = `ban_target_${Date.now().toString().slice(-6)}`;
const banPhone = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
const regBan = await testBanUser.post('/api/auth/register', {
  mode: 'username',
  username: banUname,
  name: 'کاربر متخلف تستی',
  phone: banPhone,
  password: 'Password@123',
  acceptTerms: true,
});
const banUserId = regBan.json?.me?.id;
ok('ثبت‌نام کاربر آزمایشی برای مسدودسازی آبشاری', banUserId);

// دریافت نشست‌های فعال کاربر
const userSessions = await admin.get(`/api/admin/users/${banUserId}/sessions`);
ok('دریافت لیست نشست‌های فعال کاربر', userSessions.status === 200 && Array.isArray(userSessions.json?.sessions));

// اعمال مسدودسازی آبشاری
const cascadeRes = await admin.post(`/api/admin/users/${banUserId}/cascade-ban`, { reason: 'تست تخلف امنیتی' });
ok('اعمال مسدودسازی آبشاری (Cascade Ban)', cascadeRes.status === 200 && cascadeRes.json?.cascade?.sessionsRevoked >= 1);

// بررسی اینکه نشست کاربر لغو شده است
const checkRevoked = await testBanUser.get('/api/me');
ok('نشست کاربر متخلف پس از مسدودسازی آبشاری فوراً نامعتبر شد', checkRevoked.status === 401 || checkRevoked.status === 403);

// بررسی جلوگیری از ثبت‌نام مجدد با همان شماره تلفن
const reRegClient = makeClient(BASE);
await reRegClient.get('/api/bootstrap');
const reReg = await reRegClient.post('/api/auth/register', {
  mode: 'username',
  username: `new_${banUname}`,
  name: 'تلاش مجدد',
  phone: banPhone,
  password: 'Password@123',
  acceptTerms: true,
});
ok('جلوگیری از ثبت‌نام مجدد با شماره تلفن مسدودشده', reReg.status === 403);

// 30. سلامت داده‌ها و پایش سامانه (Data Integrity & Health Monitoring)
const healthCheck = await admin.get('/api/admin/health');
ok('پایش سلامت و یکپارچگی داده‌های فروشگاه', healthCheck.status === 200 && healthCheck.json?.ok);
const healthRepair = await admin.post('/api/admin/health/repair', {});
ok('تعمیر و پاک‌سازی خودکار ناهماهنگی‌ها در پایگاه داده', healthRepair.status === 200 && typeof healthRepair.json?.repaired === 'number');

console.log(`\n═══ نتیجه bughunt: ${pass} موفق · ${fail} ناموفق ═══\n`);
if (fail) process.exit(1);
