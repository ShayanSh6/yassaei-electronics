#!/usr/bin/env node
// ابزار نجات مالک: node tools/unban-owner.mjs <phone_or_username>
// داده‌ها، سفارش‌ها و موجودی هرگز حذف نمی‌شوند؛ فقط قفل‌های امنیتی مالک پاک می‌شوند.
import { db, load } from '../server/lib/db.mjs';
import { logAudit } from '../server/lib/db.mjs';
import { nowISO, toLatinDigits } from '../server/lib/util.mjs';

const needle = toLatinDigits(String(process.argv[2] || '').trim()).toLowerCase();
if (!needle) {
  console.error('روش استفاده: node tools/unban-owner.mjs <phone_or_username>');
  process.exit(2);
}

await load();
const result = await db.tx((st) => {
  // حتی اگر یک خرابی قدیمی نقش مالک را تغییر داده باشد، شناسهٔ اعلام‌شده
  // برای بازیابی کافی است؛ نقش در ادامه دوباره به owner برمی‌گردد.
  const owner = (st.users || []).find((u) => [u.phone, u.username].filter(Boolean).some((v) => toLatinDigits(String(v).trim()).toLowerCase() === needle));
  if (!owner) throw new Error('حساب مالک با این شماره یا نام کاربری پیدا نشد.');
  const identities = new Set([owner.phone, owner.username, owner.email, owner.lastIp, owner.visitorToken, ...(owner.visitorTokens || [])].filter(Boolean).map((v) => toLatinDigits(String(v).trim()).toLowerCase()));
  for (const s of st.sessions || []) if (s.userId === owner.id && s.ip) identities.add(toLatinDigits(String(s.ip).trim()).toLowerCase());
  for (const v of st.visitors || []) if (v.userId === owner.id) for (const x of [v.ip, v.token]) if (x) identities.add(toLatinDigits(String(x).trim()).toLowerCase());
  const before = (st.bans || []).length;
  st.bans = (st.bans || []).filter((b) => !identities.has(toLatinDigits(String(b.value || '').trim()).toLowerCase()));
  owner.role = 'owner';
  owner.status = 'active';
  owner.banned = false;
  owner.permissions = owner.permissions || {};
  logAudit(owner, 'owner.emergency_unban', owner.username, { removedBans: before - st.bans.length, at: nowISO() });
  return { id: owner.id, username: owner.username, removedBans: before - st.bans.length };
});
await db.flush(true);
console.log(`مالک «${result.username}» با موفقیت بازیابی شد؛ ${result.removedBans} قفل/بن مرتبط پاک شد.`);
