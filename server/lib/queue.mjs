// ─────────────────────────────────────────────────────────────
//  اتاق انتظار و پدافند ترافیک (Anti-DDoS / Waiting Room)
//  بدون هیچ وابستگی خارجی — همه‌چیز در حافظهٔ همین فرایند.
//
//  منطق:
//   • هر درخواست «در حال پردازش» شمرده می‌شود (inflight).
//   • نرخ درخواست در ثانیه (rps) در پنجرهٔ لغزان ۱۰ ثانیه‌ای ثبت می‌شود.
//   • اگر بار از آستانه گذشت، بازدیدکنندگان ناشناس به صف می‌روند و
//     «دانه‌دانه» با کوکی گذرنامه (امضاشده HMAC) پذیرش می‌شوند.
//   • کاربران واردشده (نشست معتبر) و مدیران هرگز در صف نمی‌مانند.
// ─────────────────────────────────────────────────────────────
import { sign, verify } from './auth.mjs';
import { randomToken } from './util.mjs';

// ── سنجه‌های زنده ───────────────────────────────────────────
let inflight = 0;
const rpsWindow = [];            // timestamp هر درخواست (پنجره ۱۰ ثانیه)
const ipMinute = new Map();      // ip -> [timestamps] برای «پرحرف‌ترین‌ها»

// ── صف انتظار ───────────────────────────────────────────────
const waiting = new Map();       // token -> { ip, since, lastSeen }  (FIFO)

export function reqEnter(ip, heavy = true) {
  inflight++;
  const t = Date.now();
  // فقط درخواست‌های «سنگین» (API/ناوبری) در آستانهٔ rps شمرده می‌شوند؛
  // فایل‌های استاتیک سبک‌اند و موج نصب سرویس‌ورکر نباید صف را فعال کند.
  if (heavy) rpsWindow.push(t);
  let arr = ipMinute.get(ip);
  if (!arr) { arr = []; ipMinute.set(ip, arr); }
  arr.push(t);
  if (arr.length > 1000) arr.shift(); // Hard limit per IP to prevent single-IP memory DoS
}
export function reqLeave() { inflight = Math.max(0, inflight - 1); }

export function sweepQueue() {
  if (ipMinute.size > 10000) ipMinute.clear();
  const t = Date.now();
  while (rpsWindow.length && rpsWindow[0] < t - 10_000) rpsWindow.shift();
  for (const [ip, arr] of ipMinute) {
    while (arr.length && arr[0] < t - 60_000) arr.shift();
    if (!arr.length) ipMinute.delete(ip);
  }
  // صف‌کننده‌هایی که بیش از ۹۰ ثانیه_poll_نکرده‌اند حذف می‌شوند
  for (const [tok, w] of waiting) {
    if (t - w.lastSeen > 90_000) waiting.delete(tok);
  }
}

export function currentRps() { return rpsWindow.length / 10; }
export function waitingSize() { return waiting.size; }
export function ipPerMin(ip) { return (ipMinute.get(ip) || []).length; }

export function loadSnapshot() {
  const top = [...ipMinute.entries()]
    .map(([ip, arr]) => ({ ip, perMin: arr.length }))
    .sort((a, b) => b.perMin - a.perMin)
    .slice(0, 12);
  return { inflight, rps: Math.round(currentRps() * 10) / 10, queued: waiting.size, top };
}

// ── تنظیمات (از settings.security با پیش‌فرض سالم) ──────────
export function secOf(state) {
  const s = (state?.settings?.security) || {};
  return {
    queueEnabled: s.queueEnabled !== false,
    maxConcurrent: Math.max(5, Number(s.maxConcurrent) || 80),
    triggerRps: Math.max(5, Number(s.triggerRps) || 40),
    passTtlMin: Math.min(240, Math.max(5, Number(s.passTtlMin) || 30)),
    pollSec: Math.min(20, Math.max(2, Number(s.pollSec) || 4)),
    floodBanPerMin: Math.max(500, Number(s.floodBanPerMin) || 2500),
    floodBanMin: Math.min(1440, Math.max(1, Number(s.floodBanMin) || 15)),
  };
}

export function isOverloaded(sec) {
  if (!sec || !sec.queueEnabled) return false;
  return inflight > (sec.maxConcurrent || 80) || currentRps() > (sec.triggerRps || 40);
}

// ── گذرنامه (کوکی امضاشده) ──────────────────────────────────
export function issuePass(ttlMin) {
  return sign({ typ: 'qpass', exp: Date.now() + ttlMin * 60_000 });
}
export function checkPass(cookieVal) {
  if (!cookieVal || typeof cookieVal !== 'string' || cookieVal.length > 400) return false;
  const p = verify(cookieVal, 24 * 3600_000);
  return !!p && p.typ === 'qpass' && p.exp > Date.now();
}

// ── صف: پیوستن / موقعیت / پذیرش ────────────────────────────
export function joinQueue(ip, existingToken) {
  const t = Date.now();
  if (existingToken && waiting.has(existingToken)) {
    const w = waiting.get(existingToken);
    if (w.ip === ip) { w.lastSeen = t; return existingToken; }
    waiting.delete(existingToken);
  }
  const tok = randomToken(12);
  waiting.set(tok, { ip, since: t, lastSeen: t });
  if (waiting.size > 2000) {           // سقف ایمنی حافظه
    const first = waiting.keys().next().value;
    waiting.delete(first);
  }
  return tok;
}

export function queuePos(token) {
  let i = 0;
  for (const k of waiting.keys()) { if (k === token) return i + 1; i++; }
  return 0;                              // دیگر در صف نیست
}

/** پذیرش دانه‌دانه: فقط وقتی بارِ جاری زیر سقف است، نفر اول صف گذرنامه می‌گیرد. */
export function tryAdmit(token, sec) {
  const w = waiting.get(token);
  if (!w) return { admitted: false, pos: 0 };
  w.lastSeen = Date.now();
  if (inflight < (sec?.maxConcurrent || 80)) {
    waiting.delete(token);
    return { admitted: true, pos: 0 };
  }
  return { admitted: false, pos: queuePos(token) };
}

/** وقتی بار کاملاً عادی شد، کل صف یک‌جا آزاد می‌شود. */
export function clearQueue() { waiting.clear(); }
export function removeFromQueue(token) { if (token) waiting.delete(token); }

// ── صفحهٔ صف (HTML خودبسنده، درون‌خطی — با CSP اختصاصی سرو می‌شود) ──
export function queuePageHtml({ pos, waiting: total, pollSec, storeName, lang = 'fa' }) {
  const en = lang === 'en';
  const safeName = String(storeName || (en ? 'Yassaei Electronics' : 'یاسایی')).replace(/[<>&"']/g, '');
  const T = en ? {
    dir: 'ltr', title: 'High traffic — your turn is coming',
    p1: 'To keep the site fast and error-free for everyone, entry is managed in a queue.',
    p2: 'Please keep this page open — it enters the site automatically when it is your turn.',
    label: 'people in queue', st: 'Checking your turn…',
    err: 'Connection lost — retrying…',
  } : {
    dir: 'rtl', title: 'شلوغی سایت — نوبت شما در حال رسیدن است',
    p1: 'برای اینکه سایت بدون کندی و خطا برای همه کار کند، ورود به‌صورت نوبتی انجام می‌شود.',
    p2: 'لطفاً این صفحه را نبندید؛ خودش به‌محض رسیدن نوبت وارد سایت می‌شود.',
    label: 'نفر در صف', st: 'در حال بررسی نوبت…',
    err: 'اتصال قطع شد — دوباره تلاش می‌کنیم…',
  };
  return `<!doctype html>
<html lang="${en ? 'en' : 'fa'}" dir="${T.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeName} · صف ورود</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(1200px 600px at 70% -10%, #12323d 0%, #0b1418 55%, #070d10 100%);
    color: #e8f4f8; font-family: Vazirmatn, Tahoma, sans-serif; padding: 24px;
  }
  .card {
    width: min(480px, 100%); background: #101c22ee; border: 1px solid #f59e0b33;
    border-radius: 22px; padding: 34px 28px; text-align: center;
    box-shadow: 0 24px 70px #0009, 0 0 0 1px #ffffff08 inset;
  }
  .logo { font-size: 44px; line-height: 1; }
  h1 { font-size: 19px; margin: 14px 0 6px; color: #fff; }
  p { font-size: 13.5px; color: #9fc3cf; line-height: 2; }
  .pos {
    margin: 20px auto 6px; width: 128px; height: 128px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: conic-gradient(#f59e0b var(--pct, 10%), #1b2c34 0);
    position: relative;
  }
  .pos::before { content: ''; position: absolute; inset: 10px; border-radius: 50%; background: #0d171c; }
  .pos b { position: relative; font-size: 34px; color: #f59e0b; font-variant-numeric: tabular-nums; }
  .pos span { position: relative; font-size: 11px; color: #7fa8b5; margin-top: 2px; }
  .bar { height: 6px; border-radius: 99px; background: #1b2c34; overflow: hidden; margin: 18px 0 10px; }
  .bar i { display: block; height: 100%; width: 30%; border-radius: 99px; background: linear-gradient(90deg, #f59e0b, #7ce0f7); animation: slide 1.6s ease-in-out infinite; }
  @keyframes slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(420%); } }
  .st { font-size: 12px; color: #6f95a2; }
  .err { color: #ffb4a2; font-size: 12px; margin-top: 10px; display: none; }
  @media (prefers-reduced-motion: reduce) { .bar i { animation: none; } }
</style>
</head>
<body>
  <main class="card" aria-live="polite">
    <div class="logo">🍏</div>
    <h1>${T.title}</h1>
    <p>${T.p1}<br>${T.p2}</p>
    <div class="pos" id="posRing"><b id="posNum">…</b><span>${T.label}</span></div>
    <div class="bar"><i></i></div>
    <div class="st" id="st">${T.st}</div>
    <div class="err" id="err">${T.err}</div>
  </main>
<script>
(function () {
  var POLL = ${Math.max(2, Math.min(20, Number(pollSec) || 4))} * 1000;
  var LOCALE = '${en ? 'en' : 'fa'}';
  var posEl = document.getElementById('posNum');
  var ring = document.getElementById('posRing');
  var st = document.getElementById('st');
  var err = document.getElementById('err');
  var fails = 0;
  function fmtPos(n) { return LOCALE === 'en' ? String(n) : n.toLocaleString('fa-IR'); }
  function render(pos, total) {
    if (pos > 0) {
      posEl.textContent = fmtPos(pos);
      var pct = total > 1 ? Math.max(4, Math.round((1 - (pos - 1) / total) * 100)) : 96;
      ring.style.setProperty('--pct', pct + '%');
      st.textContent = LOCALE === 'en' ? 'You will enter automatically when it is your turn…' : 'به‌محض رسیدن نوبت، خودکار وارد سایت می‌شوید…';
    }
  }
  render(${Number(pos) || 1}, ${Number(total) || 1});
  function tick() {
    fetch('/api/queue/status', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        fails = 0; err.style.display = 'none';
        if (d && d.state === 'pass') {
          st.textContent = LOCALE === 'en' ? 'Your turn! Entering the site…' : 'نوبت شما رسید! در حال ورود به سایت…';
          posEl.textContent = fmtPos(0);
          ring.style.setProperty('--pct', '100%');
          setTimeout(function () { location.reload(); }, 700);
          return;
        }
        if (d && d.state === 'queued') { render(d.pos || 1, d.waiting || 1); setTimeout(tick, POLL); return; }
        // حالت open یعنی سایت خلوت شد:
        location.reload();
      })
      .catch(function () {
        fails++;
        err.style.display = 'block';
        setTimeout(tick, Math.min(15000, POLL * fails));
      });
  }
  setTimeout(tick, 1200);
})();
</script>
</body>
</html>`;
}
