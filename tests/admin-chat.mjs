// ─────────────────────────────────────────────────────────────
//  admin-chat: چت داخلی تیم (فقط مدیر و کارمند)
//   • فقط نقش‌های owner/staff (کاربر عادی ۴۰۳)
//   • ارسال پیام + پیوست (فقط مسیرهای /uploads/)
//   • فهرست اعضای تیم + محدودیت‌های ورودی (متن خالی/بلند)
//   • کلید اصلی خاموش → ۴۰۳ با کد disabled
//  اجرا: BASE=http://127.0.0.1:3000 node tests/admin-chat.mjs
// ─────────────────────────────────────────────────────────────
import { makeClient, login, ensureDemoAccounts, ensureStaffAccount, DEMO_PASSWORD } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}

console.log(`\n═══ admin-chat: چت داخلی تیم · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE, ['maryam']);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
if (!(await login(admin, 'admin', 'Yassaei@1404'))) await login(admin, 'admin', 'Demo@1404');
await ensureStaffAccount(BASE);
const staff = makeClient(BASE);
await staff.get('/api/bootstrap');
await login(staff, 'staff', 'Staff@1404');

const user = makeClient(BASE);
await user.get('/api/bootstrap');
await login(user, 'maryam', DEMO_PASSWORD);

const ORIG_FEATURES = (await admin.get('/api/admin/settings')).json?.settings?.features || null;

// تصویر ۱×۱ برای پیوست
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

try {
// ── ۱) دسترسی‌ها ────────────────────────────────────────────
{
  const a = await admin.get('/api/admin/chat');
  ok('مدیر: خواندن چت → ۲۰۰', a.status === 200, String(a.status));
  ok('مدیر: فهرست اعضای تیم شامل خودش و کارمند است', (a.json?.staff || []).length >= 2 && (a.json?.staff || []).some((u) => u.role === 'staff'), JSON.stringify(a.json?.staff || []));
  ok('مدیر: آرایهٔ پیام‌ها وجود دارد', Array.isArray(a.json?.messages));

  const s = await staff.get('/api/admin/chat');
  ok('کارمند: خواندن چت → ۲۰۰', s.status === 200, String(s.status));

  const u = await user.get('/api/admin/chat');
  ok('کاربر عادی: خواندن چت ممنوع (۴۰۳)', u.status === 403, String(u.status));
  const uPost = await user.post('/api/admin/chat', { text: 'سلام' });
  ok('کاربر عادی: نوشتن در چت ممنوع (۴۰۳)', uPost.status === 403, String(uPost.status));

  const anonC = makeClient(BASE);
  await anonC.get('/api/bootstrap');
  const an = await anonC.get('/api/admin/chat');
  ok('مهمان: چت ممنوع (۴۰۱)', an.status === 401, String(an.status));
}

// ── ۲) ارسال پیام ──────────────────────────────────────────
let msgId = null;
{
  const r = await staff.post('/api/admin/chat', { text: 'سلام همکاران، #order:o12345 را چک کنید @admin' });
  msgId = r.json?.message?.id;
  ok('کارمند: ارسال پیام → ۲۰۰ + شناسه', r.status === 200 && !!msgId, JSON.stringify(r.json).slice(0, 200));
  ok('پیام شامل نام و نقش فرستنده است', r.json?.message?.role === 'staff' && typeof r.json?.message?.userName === 'string');

  const g = (await admin.get('/api/admin/chat')).json;
  const m = (g?.messages || []).find((x) => x.id === msgId);
  ok('مدیر پیام کارمند را می‌بیند', !!m && m.text.includes('#order:o12345'));
  ok('پیام آخرین پیام‌ها (حداکثر ۲۰۰) است', (g?.messages || []).length <= 200);

  const empty = await staff.post('/api/admin/chat', { text: '   ' });
  ok('متن خالی → ۴۰۰', empty.status === 400, String(empty.status));

  const long = await staff.post('/api/admin/chat', { text: 'x'.repeat(2500) });
  ok('متن بلندتر از ۲۰۰۰ → ۴۰۰', long.status === 400, String(long.status));

  const justAtLimit = await staff.post('/api/admin/chat', { text: 'y'.repeat(2000) });
  ok('متن دقیقاً ۲۰۰۰ نویسه → ۲۰۰', justAtLimit.status === 200, String(justAtLimit.status));
}

// ── ۳) پیوست‌ها ─────────────────────────────────────────────
{
  const up = await staff.post('/api/upload', { data: TINY_PNG });
  ok('بارگذاری تصویر آزمایشی → ۲۰۰', up.status === 200 && (up.json?.url || '').startsWith('/uploads/'), JSON.stringify(up.json).slice(0, 120));
  const url = up.json?.url || '';

  const r = await admin.post('/api/admin/chat', { text: '📎', attachments: [url, 'https://evil.example.com/x.png', '/uploads/../etc/passwd'] });
  ok('ارسال با پیوست → ۲۰۰', r.status === 200, JSON.stringify(r.json).slice(0, 160));
  const atts = r.json?.message?.attachments || [];
  ok('فقط پیوستهای /uploads/ می‌مانند (دیگرها فیلتر می‌شوند)', atts.length === 1 && atts[0] === url, JSON.stringify(atts));

  const g = (await staff.get('/api/admin/chat')).json;
  const m = (g?.messages || []).find((x) => x.id === r.json?.message?.id);
  ok('کارمند پیوست مدیر را می‌بیند', !!m && (m.attachments || []).length === 1);

  const many = await staff.post('/api/admin/chat', { text: '📎', attachments: [url, url, url, url, url] });
  ok('بیش از ۴ پیوست → ۴۰۰', many.status === 400, String(many.status));
}

// ── ۴) کلید اصلی خاموش ────────────────────────────────────
{
  await admin.patch('/api/admin/settings/features', { value: { adminChat: false } });
  const b = (await admin.get('/api/bootstrap')).json;
  ok('bootstrap: features.adminChat=false رسید', b?.settings?.features?.adminChat === false);
  const g = await admin.get('/api/admin/chat');
  ok('با کلید خاموش، خواندن چت ۴۰۳ با کد disabled', g.status === 403 && g.json?.code === 'disabled', `${g.status} ${g.json?.code}`);
  const p = await staff.post('/api/admin/chat', { text: 'تست' });
  ok('با کلید خاموش، نوشتن در چت ۴۰۳', p.status === 403, String(p.status));
}

} finally {
  try {
    if (ORIG_FEATURES) await admin.patch('/api/admin/settings/features', { value: { adminChat: ORIG_FEATURES.adminChat } });
  } catch { /* مهم نیست */ }
}

console.log(`\n  مجموع: ${pass} موفق / ${fail} شکست\n`);
process.exit(fail ? 1 : 0);
