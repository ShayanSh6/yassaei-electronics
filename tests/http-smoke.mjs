import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const PUB = fileURLToPath(new URL('../public', import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
let pass = 0, fail = 0;
const check = async (path, expect = 200) => {
  try {
    const r = await fetch(BASE + path, { method: 'GET' });
    const ok = r.status === expect;
    ok ? pass++ : fail++;
    if (!ok) console.log(`✘ ${path} → ${r.status}`);
    return r;
  } catch (e) { fail++; console.log(`✘ ${path} → ${e.message}`); }
};
// همهٔ فایل‌های استاتیک
const files = walk(PUB).map((f) => '/' + relative(PUB, f).split('\\').join('/'));
for (const f of files) await check(f);
console.log(`static files checked: ${files.length}`);
// APIهای عمومی
const firstProd = ((await (await fetch(BASE + '/api/products?limit=1')).json()).items || [])[0];
const scanCode = firstProd?.sku || firstProd?.barcode || firstProd?.id || '';
for (const p of ['/api/bootstrap', '/api/products?limit=5', `/api/products/${firstProd?.id}`, '/api/search?q=کابل', '/api/categories', '/api/brands', '/robots.txt', '/sitemap.xml']) {
  const r = await fetch(BASE + p); console.log((r.status === 200 ? '✔' : '✘'), p, r.status); r.status === 200 ? pass++ : fail++;
}
{ // اسکن بارکد (POST) — با کوکی CSRF
  const boot = await fetch(BASE + '/api/bootstrap');
  const csrf = (boot.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('ys_csrf='))?.split('=')[1] || '';
  const cookie = (boot.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const r = await fetch(BASE + '/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Cookie: cookie }, body: JSON.stringify({ code: scanCode }) });
  const j = await r.json().catch(() => ({}));
  const ok = r.status === 200 && j.found === true;
  console.log(ok ? '✔' : '✘', `POST /api/scan (${scanCode})`, r.status, j.found);
  ok ? pass++ : fail++;
}
{ // وضعیت خاموش/روشن
  const r = await fetch(BASE + '/api/system/status'); const j = await r.json();
  const ok = r.status === 200 && j.sleeping === false;
  console.log(ok ? '✔' : '✘', '/api/system/status', r.status, j.sleeping);
  ok ? pass++ : fail++;
}
// هدرهای امنیتی
const home = await fetch(BASE + '/');
for (const hd of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) {
  const v = home.headers.get(hd);
  console.log(v ? '✔' : '✘', hd, v ? v.slice(0, 90) : '(missing)');
  v ? pass++ : fail++;
}
// مسیرهای SPA باید HTML برگردانند
for (const p of ['/products', '/admin', '/pages/faq', '/cart']) {
  const r = await fetch(BASE + p);
  const ct = r.headers.get('content-type') || '';
  const ok = r.status === 200 && ct.includes('html');
  console.log(ok ? '✔' : '✘', 'SPA', p, r.status, ct);
  ok ? pass++ : fail++;
}
console.log(`\n═══ HTTP: ${pass} موفق · ${fail} ناموفق ═══`);
process.exit(fail ? 1 : 0);
