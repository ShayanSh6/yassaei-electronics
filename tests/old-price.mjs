// ─────────────────────────────────────────────────────────────
//  old-price: نشان «به قیمت خرید قبل» (settings.oldPrice + features.oldPrice)
//   • فیلد oldPriceTag روی کالا (POST/PATCH پنل) + نشتی در API عمومی
//   • فیلتر /api/products?oldPrice=1 + احترام به کلید اصلی
//   • bootstrap: متن دلخواه نشان + ویرایش از پنل (sanitize)
//  اجرا: BASE=http://127.0.0.1:3000 node tests/old-price.mjs
// ─────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { makeClient, login } from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
}

console.log(`\n═══ old-price: نشان «به قیمت خرید قبل» · ${BASE} ═══\n`);

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
if (!(await login(admin, 'admin', 'Yassaei@1404'))) await login(admin, 'admin', 'Demo@1404');

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');

const ORIG_FEATURES = (await admin.get('/api/admin/settings')).json?.settings?.features || null;
const ORIG_OLDPRICE = (await admin.get('/api/admin/settings')).json?.settings?.oldPrice || null;

let prod = null;
let originalTag = false;
try {
// ── ۱) پیش‌فرض‌ها در bootstrap ────────────────────────────────
{
  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: features.oldPrice پیش‌فرض روشن است', b?.settings?.features?.oldPrice !== false);
  ok('bootstrap: متن نشان فارسی وجود دارد', typeof b?.settings?.oldPrice?.badgeText === 'string' && b.settings.oldPrice.badgeText.includes('خرید قبل'), JSON.stringify(b?.settings?.oldPrice));
  ok('bootstrap: متن نشان انگلیسی وجود دارد', typeof b?.settings?.oldPrice?.badgeTextEn === 'string' && b.settings.oldPrice.badgeTextEn.length > 0);
}

// ── ۲) فعال‌کردن برچسب روی یک کالا ──────────────────────────
{
  const list = (await admin.get('/api/admin/products?limit=30')).json;
  prod = (list?.items || []).find((p) => p.active !== false) || (list?.items || [])[0];
  ok('کالای تستی پیدا شد', !!prod, JSON.stringify(prod?.id));

  originalTag = !!prod?.oldPriceTag;
  const r = await admin.patch(`/api/admin/products/${prod.id}`, { oldPriceTag: true });
  ok('PATCH کالا با oldPriceTag → ۲۰۰', r.status === 200, JSON.stringify(r.json).slice(0, 160));

  const pub = (await anon.get(`/api/products/${prod.id}`)).json;
  ok('API عمومی: oldPriceTag=true ارسال می‌شود', pub?.product?.oldPriceTag === true, JSON.stringify(pub?.product?.oldPriceTag));

  const filtered = (await anon.get('/api/products?oldPrice=1&limit=96')).json;
  ok('فیلتر oldPrice=1: کالا برمی‌گردد', (filtered?.items || []).some((p) => p.id === prod.id));
  ok('فیلتر oldPrice=1: همهٔ نتایج برچسب دارند', (filtered?.items || []).every((p) => p.oldPriceTag === true));

  const all = (await anon.get('/api/products?limit=96')).json;
  ok('فیلتر بدون پارامتر: رفتار عادی (بدون محدودیت اضافی)', (all?.items || []).length >= (filtered?.items || []).length);
}

// ── ۳) ترکیب با فیلتر تخفیف ─────────────────────────────────
{
  if (prod) {
    const combo = (await anon.get(`/api/products?oldPrice=1&min=0&max=${prod.price}`)).json;
    ok('ترکیب با فیلتر قیمت کار می‌کند', (combo?.items || []).every((p) => p.oldPriceTag === true));
  }
}

// ── ۴) خاموش‌کردن برچسب ─────────────────────────────────────
{
  if (prod) {
    await admin.patch(`/api/admin/products/${prod.id}`, { oldPriceTag: false });
    const filtered = (await anon.get('/api/products?oldPrice=1&limit=96')).json;
    ok('بعد از خاموش‌کردن، کالا در فیلتر نیست', !(filtered?.items || []).some((p) => p.id === prod.id));
    // برای مراحل بعدی دوباره روشن می‌کنیم
    await admin.patch(`/api/admin/products/${prod.id}`, { oldPriceTag: true });
  }
}

// ── ۵) کلید اصلی خاموش → فیلتر بی‌اثر + bootstrap ──────────
{
  await admin.patch('/api/admin/settings/features', { value: { oldPrice: false } });
  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: features.oldPrice=false رسید', b?.settings?.features?.oldPrice === false);
  const filtered = (await anon.get('/api/products?oldPrice=1&limit=96')).json;
  const plain = (await anon.get('/api/products?limit=96')).json;
  ok('با کلید خاموش، پارامتر oldPrice بی‌اثر است (تعداد مثل حالت عادی)', (filtered?.total || 0) === (plain?.total || 0), `${filtered?.total} vs ${plain?.total}`);
  await admin.patch('/api/admin/settings/features', { value: { oldPrice: true } });
}

// ── ۶) ویرایش متن نشان از پنل ──────────────────────────────
{
  const r = await admin.patch('/api/admin/settings/oldPrice', { value: { badgeText: '⚡ قیمت پیش از اصلاح', badgeTextEn: '⚡ Pre-correction price' } });
  ok('ذخیرهٔ متن نشان → ۲۰۰', r.status === 200, JSON.stringify(r.json).slice(0, 160));
  const b = (await anon.get('/api/bootstrap')).json;
  ok('bootstrap: متن جدید رسید', b?.settings?.oldPrice?.badgeText === '⚡ قیمت پیش از اصلاح' && b?.settings?.oldPrice?.badgeTextEn === '⚡ Pre-correction price', JSON.stringify(b?.settings?.oldPrice));

  const bad1 = await admin.patch('/api/admin/settings/oldPrice', { value: { badgeText: 'x' } });
  ok('متن خیلی کوتاه → ۴۰۰', bad1.status === 400, String(bad1.status));
  const bad2 = await admin.patch('/api/admin/settings/oldPrice', { value: { badgeTextEn: '' } });
  ok('متن انگلیسی خالی → ۴۰۰', bad2.status === 400, String(bad2.status));
}

} finally {
  try {
    if (prod) await admin.patch(`/api/admin/products/${prod.id}`, { oldPriceTag: originalTag });
    if (ORIG_FEATURES) await admin.patch('/api/admin/settings/features', { value: { oldPrice: ORIG_FEATURES.oldPrice } });
    if (ORIG_OLDPRICE) await admin.patch('/api/admin/settings/oldPrice', { value: { badgeText: ORIG_OLDPRICE.badgeText, badgeTextEn: ORIG_OLDPRICE.badgeTextEn } });
  } catch { /* مهم نیست */ }
}

console.log(`\n  مجموع: ${pass} موفق / ${fail} شکست\n`);
process.exit(fail ? 1 : 0);
