// ── آزمون سلامت کلاینت: همهٔ ماژول‌ها پارس شوند و i18n سالم باشد ──
// اجرا: node tests/client-parse.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['public/js', 'server', 'tools'];
let files = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.mjs')) files.push(p);
  }
}
for (const r of roots) walk(r);

let fail = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail++; console.log(`✘ parse: ${f}\n   ${String(e.stderr).split('\n').slice(0, 4).join('\n   ')}`); }
}
console.log(`parse: ${files.length - fail}/${files.length} ماژول سالم`);

// i18n باید import شود و تعداد کلیدها منطقی باشد
try {
  const m = await import('../public/js/i18n.mjs');
  let n = m.dictSize ? m.dictSize() : 0;
  if (n && typeof n === 'object') n = n.fa || n.en || 0;
  if (!(n > 1000)) { fail++; console.log(`✘ i18n dictSize=${n} (کمتر از انتظار)`); }
  else console.log(`✔ i18n: ${n} کلید`);
  let miss = m.missingKeys ? m.missingKeys() : [];
  if (miss && typeof miss === 'object' && !Array.isArray(miss)) miss = [...(miss.fa || []), ...(miss.en || [])];
  if (miss.length) { fail++; console.log(`✘ کلیدهای ناقص: ${miss.slice(0, 8).join(', ')}`); }
  else console.log('✔ i18n: هیچ کلید ناقص بین فا و انگلیسی نیست');
} catch (e) { fail++; console.log('✘ i18n import:', e.message); }

console.log(fail ? `\n═══ ${fail} خطا ═══` : '\n═══ همه سالم ═══');
process.exit(fail ? 1 : 0);
