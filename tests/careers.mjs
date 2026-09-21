// ─────────────────────────────────────────────────────────────
//  careers: فرصت‌های شغلی و استخدام
//   • bootstrap: تنظیمات careers + features.careers
//   • فهرست عمومی آگهی‌ها (مهمان) + ثبت درخواست (مهمان/کاربر)
//   • پنل: CRUD آگهی + وضعیت/یادداشت درخواست + دانلود رزومه
//   • کلید اصلی خاموش → حذف کامل از سایت مشتری
//  اجرا: BASE=http://127.0.0.1:3000 node tests/careers.mjs
// ─────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { makeClient, login, ensureDemoAccounts, ensureStaffAccount, DEMO_PASSWORD } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}

console.log(`\n═══ careers: فرصت‌های شغلی و استخدام · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam']);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
if (!(await login(admin, 'admin', 'Yassaei@1404'))) await login(admin, 'admin', 'Demo@1404');
const staff = makeClient(BASE);
await staff.get('/api/bootstrap');
const staffReady = await ensureStaffAccount(BASE);
await login(staff, 'staff', 'Staff@1404');

const user = makeClient(BASE);
await user.get('/api/bootstrap');
await login(user, 'maryam', DEMO_PASSWORD);

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');

const ORIG_FEATURES = (await admin.get('/api/admin/settings')).json?.settings?.features || null;
const ORIG_CAREERS = (await admin.get('/api/admin/settings')).json?.settings?.careers || null;

let openingId = null;
let appId = null;
try {
// ── ۱) پیش‌فرض‌ها در bootstrap ────────────────────────────────
{
  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: features.careers وجود دارد', typeof b?.settings?.features?.careers === 'boolean', JSON.stringify(b?.settings?.features?.careers));
  ok('bootstrap: بخش careers با navShowInNav هست', typeof b?.settings?.careers?.navShowInNav === 'boolean');
  ok('bootstrap: بخش oldPrice با badgeText هست', typeof b?.settings?.oldPrice?.badgeText === 'string' && b.settings.oldPrice.badgeText.length > 0);
  ok('bootstrap: features.oldPrice و adminChat وجود دارند', typeof b?.settings?.features?.oldPrice === 'boolean' && typeof b?.settings?.features?.adminChat === 'boolean');
}

// ── ۲) دسترسی‌های پنل ────────────────────────────────────────
{
  ok('ادمین: فهرست پنل استخدام', (await admin.get('/api/admin/careers')).status === 200);
  ok('کارمند: فهرست پنل استخدام', (await staff.get('/api/admin/careers')).status === 200);
  ok('کاربر عادی: پنل استخدام ممنوع', (await user.get('/api/admin/careers')).status === 403);
  ok('مهمان: پنل استخدام ممنوع', (await anon.get('/api/admin/careers')).status === 401);
}

// ── ۳) ساخت ویرایش آگهی ─────────────────────────────────────
{
  const r = await admin.post('/api/admin/careers/openings', {
    title: 'تعمیرکار منابع تغذیه', titleEn: 'Power Supply Technician',
    department: 'تعمیرات', description: 'تعمیر و تست منابع تغذیه صنعتی',
    responsibilities: ['تعمیر منابع تغذیه', 'تست با اسیلوسکوپ'],
    requirements: ['حداقل دیپلم برق', 'آشنایی با الکترونیک قدرتی'],
    experience: 'حداقل ۲ سال', workingHours: 'شنبه تا چهارشنبه ۹ تا ۱۷', location: 'تهران، نارمک', open: true,
  });
  openingId = r.json?.opening?.id;
  ok('ساخت آگهی → ۲۰۰ + شناسه', r.status === 200 && !!openingId, JSON.stringify(r.json).slice(0, 160));

  const list = (await anon.get('/api/careers')).json;
  const found = (list?.openings || []).find((o) => o.id === openingId);
  ok('آگهی فعال در صفحهٔ عمومی دیده می‌شود', !!found && found.title === 'تعمیرکار منابع تغذیه');
  ok('آگهی عمومی شامل تکالیف و ملاک‌هاست', found && found.responsibilities?.length === 2 && found.requirements?.length === 2);
  ok('آگهی عمومی شامل فیلدهای داخلی نیست', !!found && found.note === undefined);

  const bad = await admin.post('/api/admin/careers/openings', { title: 'x' });
  ok('آگهی بدون عنوان معتبر → ۴۰۰', bad.status === 400, String(bad.status));

  const patch = await staff.patch(`/api/admin/careers/openings/${openingId}`, { workingHours: 'پنجشنبه‌ها ۱۰ تا ۱۴', open: true });
  // سرور ارقام فارسی را به لاتین نرمال می‌کند
  ok('کارمند می‌تواند آگهی را ویرایش کند', patch.status === 200 && patch.json?.opening?.workingHours === 'پنجشنبه‌ها 10 تا 14', JSON.stringify(patch.json?.opening?.workingHours));

  const patchClosed = await admin.patch(`/api/admin/careers/openings/${openingId}`, { open: false });
  ok('خاموش‌کردن آگهی → ۲۰۰', patchClosed.status === 200);
  const list2 = (await anon.get('/api/careers')).json;
  ok('آگهی خاموش در صفحهٔ عمومی نیست', !(list2?.openings || []).some((o) => o.id === openingId));
  const reopen = await admin.patch(`/api/admin/careers/openings/${openingId}`, { open: true });
  ok('روشن‌کردن دوبارهٔ آگهی → ۲۰۰', reopen.status === 200);
}

// ── ۴) ثبت درخواست (مهمان + کاربر) ──────────────────────────
{
  const r = await anon.post(`/api/careers/${openingId}/apply`, {
    name: 'سارا محمدی', phone: '09121110001', age: 29,
    education: 'کارشناسی برق', experience: '۲ سال تعمیرات قدرت',
  });
  appId = r.json?.application?.id;
  ok('درخواست مهمان → ۲۰۰ + وضعیت pending', r.status === 200 && r.json?.application?.status === 'pending', JSON.stringify(r.json).slice(0, 160));

  const dup = await anon.post(`/api/careers/${openingId}/apply`, { name: 'سارا محمدی', phone: '09121110001' });
  ok('درخواست تکراری با همان موبایل → ۴۰۰', dup.status === 400, String(dup.status));

  const badPhone = await user.post(`/api/careers/${openingId}/apply`, { name: 'مریم احمدی', phone: '0500123' });
  ok('شمارهٔ موبایل نامعتبر → ۴۰۰', badPhone.status === 400, String(badPhone.status));

  const missingName = await user.post(`/api/careers/${openingId}/apply`, { phone: '09121110002' });
  ok('نام خالی → ۴۰۰', missingName.status === 400, String(missingName.status));

  const noResumeOk = await user.post(`/api/careers/${openingId}/apply`, {
    name: 'مریم احمدی', phone: '09121110002', age: 24, education: 'کارشناسی',
    resumeUrl: 'https://evil.example.com/x.pdf',
  });
  ok('رزومهٔ بیرون از /uploads/ → ۴۰۰', noResumeOk.status === 400, String(noResumeOk.status));

  const good = await user.post(`/api/careers/${openingId}/apply`, {
    name: 'مریم احمدی', phone: '09121110002', age: 24, education: 'کارشناسی برق',
    experience: 'کارآموز تعمیرات',
  });
  ok('درخواست کاربر ورودی‌شده → ۲۰۰', good.status === 200, JSON.stringify(good.json).slice(0, 120));

  const unknown = await anon.post('/api/careers/jo_nope/apply', { name: 'نسترن رضایی', phone: '09121110003' });
  ok('درخواست برای آگهی ناموجود → ۴۰۴', unknown.status === 404, String(unknown.status));
}

// ── ۵) پنل: درخواست‌ها، وضعیت، یادداشت ──────────────────────
{
  const r = (await admin.get('/api/admin/careers')).json;
  const apps = r?.applications || [];
  ok('پنل: درخواست‌ها با عنوان آگهی برمی‌گردند', apps.some((a) => a.id === appId && a.openingTitle === 'تعمیرکار منابع تغذیه'));
  ok('پنل: شمارندهٔ وضعیت‌ها درست است', (r?.counts?.total || 0) >= 2 && (r?.counts?.pending || 0) >= 2, JSON.stringify(r?.counts));

  const p = await staff.patch(`/api/admin/careers/applications/${appId}`, { status: 'reviewed', note: 'تماس تلفنی انجام شد؛ رزومهٔ خوب' });
  ok('تغییر وضعیت به reviewed + یادداشت → ۲۰۰', p.status === 200 && p.json?.application?.status === 'reviewed');

  const again = (await admin.get('/api/admin/careers')).json;
  const app = (again?.applications || []).find((a) => a.id === appId);
  ok('یادداشت داخلی ذخیره شد', app?.note?.includes('رزومهٔ خوب'), JSON.stringify(app?.note));

  const badStatus = await admin.patch(`/api/admin/careers/applications/${appId}`, { status: 'banana' });
  ok('وضعیت نامعتبر → ۴۰۰', badStatus.status === 400, String(badStatus.status));

  const filt = (await admin.get('/api/admin/careers?status=reviewed')).json;
  ok('فیلتر وضعیت در پنل کار می‌کند', (filt?.applications || []).every((a) => a.status === 'reviewed') && (filt?.applications || []).some((a) => a.id === appId));

  const uPatch = await user.patch(`/api/admin/careers/applications/${appId}`, { status: 'accepted' });
  ok('کاربر عادی نمی‌تواند وضعیت را عوض کند', uPatch.status === 403, String(uPatch.status));
}

// ── ۶) کلید اصلی خاموش → حذف کامل از سایت مشتری ────────────
{
  await admin.patch('/api/admin/settings/features', { value: { careers: false } });
  const pub = await anon.get('/api/careers');
  ok('با خاموش‌بودن کلید، صفحهٔ عمومی ۴۰۴ می‌دهد', pub.status === 404, String(pub.status));
  const pubApply = await anon.post(`/api/careers/${openingId}/apply`, { name: 'ترهٔ تست', phone: '09121110009' });
  ok('با خاموش‌بودن کلید، ثبت درخواست ۴۰۴ می‌دهد', pubApply.status === 404, String(pubApply.status));
  const admStill = await admin.get('/api/admin/careers');
  ok('پنل مدیریت با کلید خاموش باز می‌ماند (برای مدیریت)', admStill.status === 200 && admStill.json?.enabled === false, JSON.stringify(admStill.json?.enabled));

  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: features.careers=false رسید', b?.settings?.features?.careers === false);
}

// ── ۷) کلید منو (navShowInNav) ──────────────────────────────
{
  const r = await admin.patch('/api/admin/settings/careers', { value: { navShowInNav: false } });
  ok('ذخیرهٔ کلید منو → ۲۰۰', r.status === 200, String(r.status));
  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: navShowInNav=false رسید', b?.settings?.careers?.navShowInNav === false);
  const back = await admin.patch('/api/admin/settings/careers', { value: { navShowInNav: true } });
  ok('بازگشت کلید منو → ۲۰۰', back.status === 200);
}

// ── ۸) حذف آگهی ─────────────────────────────────────────────
{
  if (openingId) {
    const d = await staff.delete(`/api/admin/careers/openings/${openingId}`);
    ok('حذف آگهی → ۲۰۰', d.status === 200, String(d.status));
    const list = (await admin.get('/api/admin/careers')).json;
    ok('آگهی از پنل حذف شد', !(list?.openings || []).some((o) => o.id === openingId));
  }
}

} finally {
  // بازگردانی تنظیمات به حالت قبل از تست
  try {
    if (ORIG_FEATURES) await admin.patch('/api/admin/settings/features', { value: {
      careers: ORIG_FEATURES.careers, oldPrice: ORIG_FEATURES.oldPrice, adminChat: ORIG_FEATURES.adminChat,
    } });
    if (ORIG_CAREERS) await admin.patch('/api/admin/settings/careers', { value: { navShowInNav: ORIG_CAREERS.navShowInNav } });
  } catch { /* مهم نیست */ }
}

console.log(`\n  مجموع: ${pass} موفق / ${fail} شکست\n`);
process.exit(fail ? 1 : 0);
