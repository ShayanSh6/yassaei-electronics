// ─────────────────────────────────────────────────────────────
//  نگهبان سرویس: هر ۲۰ ثانیه یک درخواست سبک به سرور می‌زند تا
//  فروشگاه گرم بماند و در صورت افتادن، خودش بالا بیاید.
//  اجرا:  node tools/keepalive.mjs
// ─────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 3000);
const URL = `http://127.0.0.1:${PORT}/api/system/status`;
const EVERY = Math.max(5, Number(process.env.KEEPALIVE_SECONDS || 20)) * 1000;
let downSince = 0;
let restarts = 0;

async function ping() {
  try {
    const r = await fetch(URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (downSince) {
      console.log(`[keepalive] back up after ${Math.round((Date.now() - downSince) / 1000)}s — sleeping=${j.sleeping}`);
      downSince = 0;
    }
    return true;
  } catch (err) {
    if (!downSince) { downSince = Date.now(); console.log(`[keepalive] server not responding: ${err.message}`); }
    return false;
  }
}

function restartServer() {
  restarts++;
  console.log(`[keepalive] restarting server (attempt ${restarts})…`);
  const child = spawn(process.execPath, ['server/main.mjs'], {
    cwd: process.cwd(), stdio: 'ignore', detached: true, env: { ...process.env, PORT: String(PORT) },
  });
  child.unref();
}

console.log(`[keepalive] watching ${URL} every ${EVERY / 1000}s`);
let misses = 0;
setInterval(async () => {
  const ok = await ping();
  misses = ok ? 0 : misses + 1;
  if (misses >= 3 && restarts < 20) { misses = 0; restartServer(); }
}, EVERY);

// ── گرم نگه‌داشتن نمونهٔ ابری Render (هر ۸ دقیقه) ─────────────
const REMOTE = process.env.REMOTE_KEEPALIVE || 'https://yassaei-electronics.onrender.com/api/system/status';
setInterval(() => { fetch(REMOTE, { signal: AbortSignal.timeout(30000) }).then((r) => console.log('[keepalive] remote ping', r.status)).catch((e) => console.log('[keepalive] remote ping failed', e.message)); }, 8 * 60000);
fetch(REMOTE, { signal: AbortSignal.timeout(30000) }).catch(() => {});
