// ─────────────────────────────────────────────────────────────
//  آزمون محافظت سمت کاربر (anti-inspect) + کلید امنیتی فروشگاه
//
//  ۱) رفتار ماژول public/js/lib/anti-inspect.mjs در DOM واقعی (jsdom):
//     کلیک راست، میان‌برهای DevTools، هشدار کنسول، کشیدن تصاویر
//     و — مهم‌تر از همه — دست‌نخورده‌ماندن تایپ/کپی در فیلدهای ورودی.
//  ۲) کلید `settings.security.antiInspectEnabled` روی سرور زنده:
//     مقدار پیش‌فرض، ذخیره/خواندن از پنل مدیر و بازگرداندن به حالت اول.
// ─────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { makeClient, login } from './lib/demo.mjs';
import { SECURITY_WARNING_FA } from '../public/js/lib/anti-inspect.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0; let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✔ [${pass}] ${name}`); }
  else { fail++; console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`); }
};

console.log(`\n═══ anti-inspect: ۴۴ آزمون محافظت از کد و کلید امنیتی · ${BASE} ═══\n`);

// ── راه‌اندازی DOM واقعی ─────────────────────────────────────
const dom = new JSDOM(`<!doctype html><html><body>
  <main id="root">
    <p id="txt">متن عادی فروشگاه یاسایی</p>
    <input id="q" value="">
    <textarea id="notes"></textarea>
    <div id="dragRow" draggable="true"><img id="dragImg" src="x.svg" alt=""></div>
    <img id="pImg" src="p001.svg" alt="کالا">
  </main>
</body></html>`, { url: 'http://test.local/#/' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
const { initAntiInspect, isDevToolsShortcut, antiInspectActive, printSecurityWarning } =
  await import('../public/js/lib/anti-inspect.mjs');

const { window } = dom;
const $ = (sel) => window.document.querySelector(sel);

// ابزار: آیا رویداد پیش‌فرضش گرفته می‌شود؟
const fire = (type, target, init = {}) => {
  const ev = new window.Event(type, { bubbles: true, cancelable: true, ...init });
  Object.assign(ev, init);            // ctrlKey/shiftKey/key/... روی Event ساده
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
};
const key = (target, init) => {
  const ev = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev.defaultPrevented;
};

// ── ۱) هشدار امنیتی کنسول ───────────────────────────────────
const logged = [];
const realLog = console.log;
const realWarn = console.warn;
console.log = (...a) => logged.push(a.join(' '));
console.warn = (...a) => logged.push(a.join(' '));
printSecurityWarning();
console.log = realLog; console.warn = realWarn;
ok('هشدار امنیتی کنسول شامل متن رسمی فروشگاه است',
  logged.some((l) => l.includes(SECURITY_WARNING_FA)), logged.join(' | ').slice(0, 120));
ok('هشدار امنیتی با استایل %c و رنگ قرمز چاپ می‌شود',
  logged.some((l) => l.startsWith('%c') && /ff2f2f/i.test(l)));

// ── ۲) محافظت روشن (پیش‌فرض) ─────────────────────────────────
initAntiInspect(() => true);
ok('پیش‌فرض محافظت: روشن', antiInspectActive() === true);
ok('کلیک راست روی عنصر عادی صفحه بسته است', fire('contextmenu', $('#txt')) === true);
ok('کلیک راست داخل input آزاد است (چسباندن/غلط‌یاب)', fire('contextmenu', $('#q')) === false);
ok('کلیک راست داخل textarea آزاد است', fire('contextmenu', $('#notes')) === false);

// ── ۳) میان‌برهای DevTools ──────────────────────────────────
ok('F12 مسدود می‌شود', key(window.document.body, { key: 'F12' }) === true);
ok('Ctrl+Shift+I مسدود می‌شود', key(window.document.body, { key: 'I', ctrlKey: true, shiftKey: true }) === true);
ok('Ctrl+Shift+J مسدود می‌شود', key(window.document.body, { key: 'j', ctrlKey: true, shiftKey: true }) === true);
ok('Ctrl+Shift+C مسدود می‌شود', key(window.document.body, { key: 'C', ctrlKey: true, shiftKey: true }) === true);
ok('Ctrl+U (نمایش سورس) مسدود می‌شود', key(window.document.body, { key: 'u', ctrlKey: true }) === true);
ok('مک: Cmd+Opt+I مسدود می‌شود', key(window.document.body, { key: 'i', metaKey: true, altKey: true }) === true);
ok('مک: Cmd+Opt+J مسدود می‌شود', key(window.document.body, { key: 'j', metaKey: true, altKey: true }) === true);
ok('کارکرد isDevToolsShortcut برای Ctrl+Shift+K? (خارج از فهرست)',
  isDevToolsShortcut({ key: 'k', ctrlKey: true, shiftKey: true }) === false);

// ── ۴) تعامل سالم کاربر هرگز نمی‌شکند ───────────────────────
ok('تایپ حرف در input آزاد است', key($('#q'), { key: 'a' }) === false);
ok('تایپ حرف در textarea آزاد است', key($('#notes'), { key: 'ی' }) === false);
ok('Ctrl+C (کپی) آزاد است', key(window.document.body, { key: 'c', ctrlKey: true }) === false);
ok('Ctrl+V (چسباندن) آزاد است', key(window.document.body, { key: 'v', ctrlKey: true }) === false);
ok('Ctrl+S ذخیرهٔ صفحه دست‌نخورده است', key(window.document.body, { key: 's', ctrlKey: true }) === false);
ok('Ctrl+U داخل فیلد ورودی مسدود نمی‌شود', key($('#q'), { key: 'u', ctrlKey: true }) === false);

// ── ۵) کشیدن تصاویر ─────────────────────────────────────────
ok('تصویر کالا draggable="false" می‌شود', $('#pImg').getAttribute('draggable') === 'false');
ok('کشیدن تصویر کالا مسدود است', fire('dragstart', $('#pImg')) === true);
ok('کشیدن‌ورهاکردن پنل مدیر (draggable=true) دست‌نخورده می‌ماند',
  $('#dragImg').getAttribute('draggable') !== 'false' && fire('dragstart', $('#dragImg')) === false);

// ── ۶) خاموش‌کردن از پنل مدیر ───────────────────────────────
initAntiInspect(() => false);
ok('با خاموش‌کردن، محافظت برداشته می‌شود', antiInspectActive() === false);
ok('با خاموش‌بودن کلیک راست آزاد است', fire('contextmenu', $('#txt')) === false);
ok('با خاموش‌بودن F12 مسدود نمی‌شود', key(window.document.body, { key: 'F12' }) === false);
ok('با خاموش‌بودن نشانهٔ draggable از تصاویر برداشته می‌شود',
  $('#pImg').getAttribute('data-nodrag') === null && $('#pImg').getAttribute('draggable') === null);
ok('با خاموش‌بودن کشیدن تصویر آزاد است', fire('dragstart', $('#pImg')) === false);
initAntiInspect(() => true);
ok('روشن‌کردن دوبارهٔ محافظت کار می‌کند',
  antiInspectActive() === true && fire('contextmenu', $('#txt')) === true);

// ── ۷) کلید امنیتی روی سرور زنده ────────────────────────────
const boot = await fetch(BASE + '/api/bootstrap');
const bootJson = await boot.json();
ok('bootstrap کلید security.antiInspectEnabled را می‌فرستد',
  typeof bootJson?.settings?.security?.antiInspectEnabled === 'boolean', JSON.stringify(bootJson?.settings?.security));
ok('پیش‌فرض فروشگاه: محافظت روشن است', bootJson?.settings?.security?.antiInspectEnabled === true);
ok('پارامترهای داخلی صف/محدودسازی نرخ به مرورگر لو نمی‌رود',
  !('maxConcurrent' in (bootJson?.settings?.security || {})) && !('floodBanPerMin' in (bootJson?.settings?.security || {})));

const anon = makeClient(BASE);
await anon.get('/api/bootstrap');
const anonTry = await anon.patch('/api/admin/settings/security', { value: { antiInspectEnabled: false } });
ok('کاربر مهمان نمی‌تواند کلید امنیتی را عوض کند', anonTry.status === 401 || anonTry.status === 403, String(anonTry.status));

const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
await login(admin, 'admin', 'Yassaei@1404').catch(async () => login(admin, 'admin', 'Demo@1404'));
const before = (await admin.get('/api/admin/settings')).json.settings.security || {};
const off = await admin.patch('/api/admin/settings/security', { value: { antiInspectEnabled: false } });
ok('مدیر می‌تواند محافظت را خاموش کند', off.status === 200 && off.json?.value?.antiInspectEnabled === false, JSON.stringify(off.json).slice(0, 120));
ok('خاموش‌بودن روی bootstrap عمومی هم اعمال می‌شود',
  (await (await fetch(BASE + '/api/bootstrap')).json())?.settings?.security?.antiInspectEnabled === false);
const bad = await admin.patch('/api/admin/settings/security', { value: { antiInspectEnabled: 'yes-please' } });
ok('مقدار نامعتبر به پیش‌فرضِ امن (روشن) برمی‌گردد',
  bad.status === 200 && bad.json?.value?.antiInspectEnabled === true, JSON.stringify(bad.json).slice(0, 120));
const on = await admin.patch('/api/admin/settings/security', { value: { antiInspectEnabled: true } });
ok('روشن‌کردن دوباره از پنل مدیر کار می‌کند', on.json?.value?.antiInspectEnabled === true);
ok('تنظیمات صف/محدودسازی نرخ با این ذخیره از بین نمی‌رود',
  Number(on.json?.value?.maxConcurrent) === Number(before.maxConcurrent ?? 80),
  `${on.json?.value?.maxConcurrent} vs ${before.maxConcurrent}`);
const after = (await admin.get('/api/admin/settings')).json.settings.security;
ok('حالت نهایی فروشگاه = محافظت روشن',
  after.antiInspectEnabled === true && (before.antiInspectEnabled === undefined || before.antiInspectEnabled === true),
  JSON.stringify(after));

// ── ۸) اتصال واقعی به برنامه + باندل‌ها (نگهبان حذف‌نشدن سیم‌کشی) ──
const { readFileSync, existsSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const mainSrc = readFileSync(fileURLToPath(new URL('../public/js/main.mjs', import.meta.url)), 'utf8');
ok('main.mjs ماژول محافظت را import می‌کند', /from '\.\/lib\/anti-inspect\.mjs'/.test(mainSrc) && /initAntiInspect/.test(mainSrc));
ok('main.mjs محافظت را با کلید امنیتی فروشگاه راه می‌اندازد',
  /initAntiInspect\(\(\) => settings\(\)\?\.security\?\.antiInspectEnabled !== false\)/.test(mainSrc));
ok('main.mjs بعد از boot و با تغییر تنظیمات، محافظت را هم‌گام می‌کند',
  /await boot\(\);[\s\S]{0,200}refreshAntiInspect\(\)/.test(mainSrc) && /on\('settings', \(\) => refreshAntiInspect\(\)\)/.test(mainSrc));
// esbuild با charset پیش‌فرض (ascii) نویسه‌های فارسی را \uXXXX می‌کند؛ قبل از جست‌وجو بازگردانی می‌کنیم
const unescapeUnicode = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const bundle = readFileSync(fileURLToPath(new URL('../public/bundle/main.js', import.meta.url)), 'utf8');
ok('باندل ساخته‌شده (public/bundle/main.js) متن هشدار امنیتی را دارد',
  unescapeUnicode(bundle).includes(SECURITY_WARNING_FA));
const offlinePath = fileURLToPath(new URL('../yassaei-offline.html', import.meta.url));
if (existsSync(offlinePath)) {
  const offline = readFileSync(offlinePath, 'utf8');
  ok('نسخهٔ تک‌فایلی آفلاین هم محافظت جدید را در خود دارد',
    unescapeUnicode(offline).includes(SECURITY_WARNING_FA));
} else {
  console.log('  • yassaei-offline.html موجود نیست — بازسازی با tools/standalone-build.mjs لازم است');
}

console.log(fail ? `\n═══ ${fail} خطا · ${pass} موفق ═══` : `\n═══ همهٔ ${pass} تست محافظت از کد سبز است ═══`);
process.exit(fail ? 1 : 0);
