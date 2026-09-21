// ─────────────────────────────────────────────────────────────
//  جاروب رازها (secret scan)
//  اجرا: node tools/secret-scan.mjs [--warn]
//
//  چرا؟ توکن ربات، کلید سرویس و رمز واقعی نباید در کدی که در گیت است،
//  در پوشهٔ عمومی (public/) یا در نسخهٔ تک‌فایلی آفلاین بماند.
//  • فایل‌های کد/مستند/اسکریپت  → خطا (خروج با کد ۱)
//  • دادهٔ زمان‌اجرا (data/**)    → هشدار، چون توکن زندهٔ فروشگاه آن‌جاست
//    (تنها راه رفع کامل: باطل‌کردن توکن در BotFather و ست‌کردن BM_TG_TOKEN)
// ─────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { BOT_TOKEN_RE } from './offline-seed.mjs';

const WARN_ONLY = process.argv.includes('--warn');
const TEXT_EXT = /\.(mjs|js|cjs|ts|json|md|html|css|py|sh|yml|yaml|txt|env|example)$/i;
const PUBLIC_ARTIFACT = /^(yassaei-offline\.html|public\/|render\.yaml)/;
const RUNTIME_DATA = /^data\//;

const RULES = [
  { id: 'telegram-bot-token', re: new RegExp(BOT_TOKEN_RE.source, 'g'), hint: 'توکن ربات را باطل کن (BotFather → /revoke) و در پنل/متغیر محیطی BM_TG_TOKEN بگذار' },
  { id: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/g, hint: 'کلید Google را باطل و در متغیر محیطی بگذار' },
  { id: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g, hint: 'کلید AWS را باطل کن' },
  { id: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, hint: 'کلید خصوصی هرگز نباید در ریپو باشد' },
  { id: 'password-hash', re: /scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{6,}\$/g, hint: 'هش رمز فقط باید در دیتابیس سرور باشد، نه در فایل عمومی', artifactsOnly: true },
  { id: 'plaintext-password', re: /"password"\s*:\s*"(?!Demo@1404)[^"]{6,}"/g, hint: 'رمز واقعی در فایل عمومی؛ نسخهٔ آفلاین باید رمز نمایشی داشته باشد', artifactsOnly: true },
];

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0').filter(Boolean);

const findings = [];
for (const f of files) {
  if (!TEXT_EXT.test(f)) continue;
  let st; try { st = statSync(f); } catch { continue; }
  if (!st.isFile() || st.size > 12 * 1024 * 1024) continue;
  const isArtifact = PUBLIC_ARTIFACT.test(f);
  const isRuntime = RUNTIME_DATA.test(f);
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const rule of RULES) {
    if (rule.artifactsOnly && !isArtifact) continue;
    const hits = [...text.matchAll(rule.re)];
    if (!hits.length) continue;
    for (const h of hits.slice(0, 3)) {
      const line = text.slice(0, h.index).split('\n').length;
      findings.push({
        file: f, line, rule: rule.id, hint: rule.hint,
        level: isRuntime ? 'warn' : 'fail',
      });
    }
  }
}

const fails = findings.filter((x) => x.level === 'fail');
const warns = findings.filter((x) => x.level === 'warn');

if (!findings.length) {
  console.log('═══ جاروب رازها: پاک ═══');
  process.exit(0);
}
console.log(`═══ جاروب رازها: ${fails.length} خطا · ${warns.length} هشدار ═══`);
for (const x of findings) {
  console.log(`  ${x.level === 'fail' ? '✘' : '⚠'} ${x.file}:${x.line} → ${x.rule}`);
  if (x.level === 'fail') console.log(`      راهنمای رفع: ${x.hint}`);
}
if (warns.length) {
  console.log('\n  ⚠ هشدارها مربوط به «دادهٔ زمان‌اجرا»ی فروشگاه است (data/)؛');
  console.log('    برای رفع کامل: توکن را در BotFather باطل کن و BM_TG_TOKEN را در Render ست کن.');
}
process.exit(fails.length && !WARN_ONLY ? 1 : 0);
