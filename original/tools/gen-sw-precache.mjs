// فهرست ماژول‌های ESM + css را داخل sw.js می‌نویسد تا پیش‌کش آفلاین کامل باشد
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.mjs')) files.push('/' + path.relative(path.join(ROOT, 'public'), p).split(path.sep).join('/'));
  }
};
walk(path.join(ROOT, 'public', 'js'));
files.push('/css/app.css');
for (const dir of ['assets/img/brands', 'assets/img/products']) {
  const d = path.join(ROOT, 'public', dir);
  for (const f of fs.readdirSync(d)) if (f.endsWith('.svg')) files.push('/' + dir + '/' + f);
}
files.sort();
const sw = path.join(ROOT, 'public', 'sw.js');
let s = fs.readFileSync(sw, 'utf8');
s = s.replace(/const JS_PRECACHE = \[[^\]]*\];/, `const JS_PRECACHE = [\n${files.map((f) => `  '${f}',`).join('\n')}\n];`);
fs.writeFileSync(sw, s);
console.log('✔ JS_PRECACHE:', files.length, 'فایل');
