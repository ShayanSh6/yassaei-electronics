// ─────────────────────────────────────────────────────────────
//  «همه‌چیز سبز است؟» با یک دستور:   npm run verify
//
//  ۱) یک سرور آزمایشی روی پورت آزاد و با پوشهٔ دادهٔ جدا (موقت) بالا می‌آورد
//     → دادهٔ واقعی فروشگاه (data/db.json) دست‌نخورده می‌ماند
//  ۲) همهٔ تست‌ها + جاروب رازها را اجرا می‌کند
//  ۳) جدول خلاصه چاپ و با اولین شکست، کد خطا برمی‌گرداند
//
//  گزینه‌ها:
//    --base=http://127.0.0.1:3000   روی سرور در حال اجرا تست کن (سرور جدید بالا نیاید)
//    --fresh                        دیتابیس تازهٔ seed‌شده (بدون کپی data/db.json)
//    --keep                         پوشهٔ دادهٔ موقت را پاک نکن (برای دیباگ)
// ─────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { copyFileSync, mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const argVal = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
const givenBase = argVal('base');
const fresh = argv.includes('--fresh');
const keep = argv.includes('--keep');

const SUITES = [
  ['api', 'tests/api.mjs', true],
  ['endpoints', 'tests/endpoints.mjs', true],
  ['http-smoke', 'tests/http-smoke.mjs', true],
  ['telegram-bot', 'tests/telegram-bot.mjs', false],
  ['bughunt', 'tests/bughunt.mjs', true],
  ['races', 'tests/races.mjs', true],
  ['exports', 'tests/exports.mjs', true],
  ['kyc', 'tests/kyc.mjs', true],
  ['sales-tools', 'tests/sales-tools.mjs', true],
  ['careers', 'tests/careers.mjs', true],
  ['old-price', 'tests/old-price.mjs', true],
  ['admin-chat', 'tests/admin-chat.mjs', true],
  ['admin-navigation', 'tests/admin-navigation.mjs', true],
  ['low-stock', 'tests/low-stock.mjs', false],
  ['admin-nav-ui', 'tests/admin-navigation-ui.mjs', false],
  ['anti-inspect', 'tests/anti-inspect.mjs', true],
  ['order-ceiling', 'tests/order-ceiling.mjs', true],
  ['sleep-ui', 'tests/sleep-ui.mjs', false],
  ['client-parse', 'tests/client-parse.mjs', false],
  ['render-admin', 'tests/render-admin.mjs', true],
  ['render-store', 'tests/render-store.mjs', true],
  ['offline-views3', 'tests/offline-views3.mjs', false],
  ['standalone-smoke', 'tests/standalone-smoke.mjs', false],
];

const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.on('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

const run = (cmd, args, opts = {}) => new Promise((resolve) => {
  const p = spawn(cmd, args, { cwd: ROOT, ...opts });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
});

const waitForServer = async (base, ms = 25000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    for (const path of ['/api/system/status', '/healthz']) {
      try {
        const r = await fetch(base + path);
        if (r.ok) return await r.json();
      } catch { /* منتظر بمان */ }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

let child = null;
let dataDir = null;
let base = givenBase || '';
const cleanup = () => {
  if (child) { try { child.kill('SIGTERM'); } catch { /* noop */ } child = null; }
  if (dataDir && !keep) { try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* noop */ } }
  try {
    const pDir = join(process.cwd(), 'public/assets/img/products');
    for (const f of readdirSync(pDir)) {
      if (/^p1[2-9]\d_.*\.svg$/.test(f)) rmSync(join(pDir, f), { force: true });
    }
  } catch { /* noop */ }
};
process.on('SIGINT', () => { cleanup(); process.exit(130); });

if (!base) {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  dataDir = mkdtempSync(join(tmpdir(), 'ys-verify-'));
  mkdirSync(join(dataDir, 'uploads'), { recursive: true });
  if (!fresh) {
    const src = join(ROOT, 'data', 'db.json');
    if (existsSync(src)) copyFileSync(src, join(dataDir, 'db.json'));
  }
  console.log(`▶ سرور آزمایشی روی ${base} (پوشهٔ دادهٔ جدا: ${dataDir}${fresh ? ' · seed تازه' : ''})`);
  child = spawn(process.execPath, ['server/main.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      BM_DATA_DIR: dataDir,
      BM_UPLOAD_DIR: join(dataDir, 'uploads'),
      BM_QUEUE: 'off',
      BM_TG: 'off',
      BM_RATE_SCALE: '6',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.stderr.write(d));
  const health = await waitForServer(base);
  if (!health) {
    console.error('✘ سرور آزمایشی بالا نیامد؛ لاگ سرور را چک کن.');
    cleanup();
    process.exit(2);
  }
  console.log(`  سرور آماده است · build: ${health.build}`);
}

// ── یک نکتهٔ مهم: باندل عمومی با سورس‌ها هم‌خوان است؟ ──────────
let buildNote = '';
try {
  const freshOut = join(tmpdir(), `ys-bundle-check-${process.pid}.js`);
  const esbuild = await run('npx', ['esbuild', 'public/js/main.mjs', '--bundle', '--minify', '--format=esm', '--target=es2017', `--outfile=${freshOut}`]);
  if (esbuild.code === 0) {
    const a = readFileSync(join(ROOT, 'public/bundle/main.js'));
    const b = readFileSync(freshOut);
    if (!a.equals(b)) buildNote = 'باندل public/bundle/main.js با سورس‌ها فرق دارد → npm run build بزن';
    rmSync(freshOut, { force: true });
  }
} catch { /* esbuild در دسترس نبود؛ مهم نیست */ }

const results = [];
for (const [name, file, needsServer] of SUITES) {
  if (needsServer && !base) { results.push([name, 'SKIP', 0]); continue; }
  const t0 = Date.now();
  const { code, out } = await run(process.execPath, [file], { env: { ...process.env, BASE: base } });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const fails = (out.match(/✘/g) || []).length;
  results.push([name, code === 0 ? 'PASS' : 'FAIL', `${secs}s`, fails]);
  if (code !== 0) {
    const lines = out.split('\n').filter((l) => l.includes('✘') || /ERROR|Error/.test(l)).slice(0, 6);
    for (const l of lines) console.log(`   ${l.trim()}`);
  }
}

// ── جاروب رازها (کد و فایل‌های عمومی) ──────────────────────────
{
  const { code, out } = await run(process.execPath, ['tools/secret-scan.mjs']);
  const errs = /جاروب رازها: (\d+) خطا/.exec(out);
  results.push(['secret-scan', code === 0 ? 'PASS' : 'FAIL', '', errs ? Number(errs[1]) : 0]);
}

console.log('\n═══ خلاصهٔ verify ═══');
let failed = 0;
for (const [name, state, secs, extra] of results) {
  const icon = state === 'PASS' ? '✔' : state === 'FAIL' ? '✘' : '•';
  console.log(`  ${icon} ${name.padEnd(18)} ${state}${secs ? '  ' + secs : ''}${extra ? `  (خطا: ${extra})` : ''}`);
  if (state === 'FAIL') failed++;
}
if (buildNote) console.log(`\n  ⚠ ${buildNote}`);
console.log(failed ? `\n✘ ${failed} بخش ناموفق — قبل از دیپلوی رفعش کن.` : '\n✔ همه‌چیز سبز است.');

cleanup();
process.exit(failed ? 1 : 0);
