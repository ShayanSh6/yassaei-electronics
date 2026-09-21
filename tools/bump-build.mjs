// ─────────────────────────────────────────────────────────────
//  یک قدم جلو بردن تگ BUILD و همگام‌کردن همهٔ جاهایی که نسخه دارند:
//    ۱) public/js/state.mjs      ۲) public/sw.js      ۳) server/lib/util.mjs
//    ۴) public/bundle/main.js (esbuild)  ۵) yassaei-offline.html
//
//  استفاده:
//    npm run bump              → ys-v126 به ys-v127 (خودکار)
//    npm run bump -- ys-v130   → پرش به نسخهٔ مشخص
//    npm run bump -- --dry     → فقط نمایش، بدون تغییر
//
//  یادآوری: کش سرویس‌ورکر با همین تگ باطل می‌شود؛ اگر تگ را دستی در یک فایل
//  جلو ببری و بقیه را جا بگذاری، موبایل کاربر نسخهٔ قدیمی را نگه می‌دارد.
// ─────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const explicit = argv.find((a) => /^ys-v\d+$/.test(a));

const SOURCES = [
  { file: 'public/js/state.mjs', re: /(export const BUILD = ')ys-v\d+(';)/ },
  { file: 'public/sw.js', re: /(const VERSION = ')ys-v\d+(';)/ },
  { file: 'server/lib/util.mjs', re: /(export const BUILD = ')ys-v\d+(';)/ },
];

const current = readFileSync(join(ROOT, 'server/lib/util.mjs'), 'utf8').match(/BUILD = '(ys-v\d+)'/)?.[1];
if (!current) { console.error('✘ تگ BUILD فعلی پیدا نشد.'); process.exit(1); }
const next = explicit || `ys-v${Number(current.slice(4)) + 1}`;
console.log(`▶ BUILD: ${current} → ${next}${dry ? '  (آزمایشی، بدون تغییر)' : ''}`);
if (dry) process.exit(0);

let touched = 0;
for (const { file, re } of SOURCES) {
  const p = join(ROOT, file);
  const s = readFileSync(p, 'utf8');
  if (!re.test(s)) { console.error(`  ✘ الگوی نسخه در ${file} پیدا نشد`); process.exit(1); }
  writeFileSync(p, s.replace(re, `$1${next}$2`));
  console.log(`  ✔ ${file}`);
  touched++;
}

// باندل و نسخهٔ تک‌فایلی باید از همان سورس ساخته شوند تا تگ‌ها یکی بمانند
console.log('  … ساخت باندل (esbuild)');
execFileSync('npx', ['esbuild', 'public/js/main.mjs', '--bundle', '--minify', '--format=esm', '--target=es2017',
  `--outfile=${join(ROOT, 'public/bundle/main.js')}`], { cwd: ROOT, stdio: 'inherit' });
console.log('  … هم‌گام‌سازی فهرست پیش‌کش سرویس‌ورکر');
execFileSync(process.execPath, [join(ROOT, 'tools/gen-sw-precache.mjs')], { cwd: ROOT, stdio: 'inherit' });
console.log('  … ساخت نسخهٔ تک‌فایلی آفلاین');
execFileSync(process.execPath, [join(ROOT, 'tools/standalone-build.mjs')], { cwd: ROOT, stdio: 'inherit' });

// بازبینی نهایی: هر پنج جا باید تگ جدید را داشته باشند
const checks = [
  ['public/js/state.mjs', next],
  ['public/sw.js', next],
  ['server/lib/util.mjs', next],
  ['public/bundle/main.js', next],
  ['yassaei-offline.html', next],
];
let ok = true;
for (const [file, tag] of checks) {
  const has = readFileSync(join(ROOT, file), 'utf8').includes(tag);
  console.log(`  ${has ? '✔' : '✘'} ${file}${has ? '' : ' → تگ جدید نیست!'}`);
  if (!has) ok = false;
}
const stale = ['public/js/state.mjs', 'public/sw.js', 'server/lib/util.mjs', 'public/bundle/main.js', 'yassaei-offline.html']
  .filter((f) => /ys-v\d+/.test(readFileSync(join(ROOT, f), 'utf8')) && readFileSync(join(ROOT, f), 'utf8').includes(current));
if (stale.length) { console.log(`  ✘ تگ قدیمی (${current}) هنوز در: ${stale.join(', ')}`); ok = false; }
console.log(ok ? `✔ همهٔ ${touched + 2} فایل روی ${next} هم‌گام شدند.` : '✘ هم‌گام‌سازی ناتمام ماند.');
process.exit(ok ? 0 : 1);
