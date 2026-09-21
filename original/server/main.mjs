// ─────────────────────────────────────────────────────────────
//  یاسایی · سرور اصلی
//  اجرای بدون هیچ وابستگی خارجی:  node server/main.mjs
//
//  نقشهٔ کد (برای ویرایش‌های آینده):
//   • lib/db.mjs       : ذخیره‌ساز JSON اتمیک + تراکنش سریال + بازیابی خودکار
//   • lib/http.mjs     : لایهٔ HTTP (gzip، کوکی، استاتیک امن، هدرهای امنیتی)
//   • lib/auth.mjs     : رمز scrypt، نشست، CSRF، TOTP دومرحله‌ای
//   • lib/queue.mjs    : اتاق انتظار ضد-DDoS (صف، گذرنامهٔ HMAC، سنجه‌ها)
//   • lib/util.mjs     : اعتبارسنجی ورودی‌ها (V)، محدودساز نرخ، متن فارسی
//   • api-*.mjs        : مسیرهای API به تفکیک حوزه (کاتالوگ/احراز/فروش/مدیر)
//   • بدنهٔ createServer: ترتیب مهم است → بن IP → سنجهٔ بار → محدودساز نرخ →
//     CSRF → نشست → اتاق انتظار → مسیریاب → استاتیک → SPA fallback
//   هر بخش با کامنت «──» جدا شده؛ قبل از جابه‌جایی کد، ترتیب بالا را حفظ کن.
// ─────────────────────────────────────────────────────────────
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { db, load, logAudit, DATA_DIR, UPLOAD_DIR, ROOT } from './lib/db.mjs';
import { Router } from './lib/router.mjs';
import {
  getQuery, parseCookie, readJsonBody, securityHeaders, sendJson, serveStatic,
  setCookie, clearCookie, clientIp, PUBLIC_DIR,
} from './lib/http.mjs';
import {  HttpError, makeRateLimiter, randomToken, uid, nowISO, BUILD, V, newVisitorToken, cleanVisitorToken, rememberVisitorToken  } from './lib/util.mjs';
import { findSession, touchSession, checkCsrf, hasPerm, requirePerm, issueCsrf, destroySession } from './lib/auth.mjs';
import { heartbeatAll, publicStats, pushNotification } from './lib/helpers.mjs';
import {
  reqEnter, reqLeave, sweepQueue, loadSnapshot, secOf, isOverloaded, issuePass, checkPass,
  joinQueue, queuePos, tryAdmit, waitingSize, ipPerMin, queuePageHtml, removeFromQueue,
} from './lib/queue.mjs';
import { registerCatalog } from './api-catalog.mjs';
import { registerAuth, mePayload, SESSION_COOKIE, CSRF_COOKIE } from './api-auth.mjs';
import { registerShop } from './api-shop.mjs';
import { registerAdmin } from './api-admin.mjs';
import { ownerOwnsValue } from './lib/ban-guard.mjs';
import { buildSeed } from './seed.mjs';
import { DEFAULT_SETTINGS, DEFAULT_PAGES } from './defaults.mjs';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const limiter = makeRateLimiter();
// کش ایندکس SPA (با بررسی mtime تازه می‌شود)
let indexCache = null;
// ضریب محدودسازی نرخ (برای محیط تست قابل افزایش است)
const RATE_SCALE = Math.max(0.1, Number(process.env.BM_RATE_SCALE || 1));
// در محیط تست می‌توان اتاق انتظار را خاموش کرد: BM_QUEUE=off
const QUEUE_OFF = process.env.BM_QUEUE === 'off';

const router = new Router();
registerCatalog(router);
registerAuth(router);
registerShop(router);
registerAdmin(router);

// ── مسیرهای ویژه ────────────────────────────────────────────
router.get('/healthz', async (ctx) => sendJson(ctx.res, 200, { ok: true, uptime: process.uptime(), time: nowISO() }));

// ── حالت خواب / بیداری فروشگاه (کلید خاموش و روشن) ──────────
// وقتی فروشگاه «خواب» است، هیچ عملیات خریدی انجام نمی‌شود ولی پنل
// مدیر و ورود کاربران باز می‌ماند تا بتوانی دوباره روشنش کنی.
const SLEEP_ALLOW = ['/api/system/wake', '/api/system/status'];
const sleepAllowed = (path) =>
  SLEEP_ALLOW.includes(path) || path.startsWith('/api/auth/') || path.startsWith('/api/admin/') || path.startsWith('/api/me');

// ── ثبت بازدیدکننده (یک بار در هر نشست + مسیرها) ──
router.post('/api/track', async (ctx) => {
  ctx.rateLimit('track:' + ctx.ip, 30, 60 * 1000);
  const b = ctx.body || {};
  const ua = String(ctx.req.headers['user-agent'] || '');
  const v = parseAgent(ua);
  const rec = {
    id: uid('vis'), at: nowISO(), ip: clientIp(ctx.req), ua: ua.slice(0, 180),
    token: ctx.visitorToken || null,
    os: v.os, device: v.device, browser: v.browser,
    screen: V.optStr(b.screen, { max: 24, field: 'screen' }),
    tz: V.optStr(b.tz, { max: 48, field: 'tz' }),
    lang: V.optStr(b.lang, { max: 12, field: 'lang' }),
    ref: V.optStr(b.ref, { max: 200, field: 'ref' }),
    path: V.optStr(b.path, { max: 120, field: 'path' }),
    userId: ctx.user?.id || null,
  };
  await db.tx(async (st) => {
    st.visitors = st.visitors || [];
    st.visitors.unshift(rec);
    if (st.visitors.length > 500) st.visitors.length = 500;
    if (rec.userId) {
      const u = st.users.find((x) => x.id === rec.userId);
      if (u) { u.lastIp = rec.ip; u.lastAgent = { os: rec.os, device: rec.device, browser: rec.browser, at: rec.at }; }
      if (ctx.visitorToken) rememberVisitorToken(st, rec.userId, ctx.visitorToken);
    }
  });
  sendJson(ctx.res, 200, { ok: true });
});

router.get('/api/system/status', async (ctx) => {
  const m = ctx.state.meta || {};
  sendJson(ctx.res, 200, {
    ok: true, sleeping: !!m.sleeping, since: m.sleepSince || null, by: m.sleepBy || '', build: BUILD,
    tgWebhook: (tgWebhookState().ok ? 'on' : 'off'),
    uptime: Math.round(process.uptime()), time: nowISO(),
  });
});

router.post('/api/system/sleep', async (ctx) => {
  ctx.requirePerm('settings.edit');
  const minutes = Number(ctx.body?.minutes) || 0;
  await db.tx((st) => {
    st.meta = { ...(st.meta || {}), sleeping: true, sleepSince: nowISO(), sleepBy: ctx.user.username, autoWakeAt: minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null };
    logAudit(ctx.user, 'system.sleep', minutes ? `${minutes}m` : '', {});
  });
  sendJson(ctx.res, 200, { ok: true, sleeping: true, autoWakeAt: ctx.state.meta?.autoWakeAt || null });
});

router.post('/api/system/wake', async (ctx) => {
  ctx.requirePerm('settings.edit');
  await db.tx((st) => {
    st.meta = { ...(st.meta || {}), sleeping: false, sleepSince: null, autoWakeAt: null, wokeAt: nowISO(), wokeBy: ctx.user.username };
    logAudit(ctx.user, 'system.wake', '', {});
  });
  pushNotification(ctx.state, { type: 'system', level: 'success', title: 'فروشگاه روشن شد', body: 'خرید دوباره فعال است.', link: '#/' });
  sendJson(ctx.res, 200, { ok: true, sleeping: false });
});

// ── کنسول سامانه: ریستارت و ریست بخش‌ها (فقط مدیر) ──
router.post('/api/admin/system/restart', async (ctx) => {
  ctx.requireUser(); ctx.requirePerm('settings.edit');
  logAudit(ctx.user, 'system.restart', 'server', {});
  sendJson(ctx.res, 200, { ok: true, restarting: true });
  setTimeout(() => process.exit(0), 700); // Render خودکار دوباره بالا می‌آورد
});
router.post('/api/admin/system/reset', async (ctx) => {
  ctx.requireUser(); ctx.requirePerm('settings.edit');
  const what = V.oneOf(ctx.body?.what, ['audit', 'carts', 'visits', 'visitors'], 'what');
  await db.tx((st) => {
    if (what === 'audit') st.audit = [];
    if (what === 'carts') st.carts = st.carts.filter((c) => c.userId);
    if (what === 'visits') { st.visits = {}; st.visitSessions = {}; }
    if (what === 'visitors') st.visitors = [];
  });
  logAudit(ctx.user, 'system.reset', what, {});
  sendJson(ctx.res, 200, { ok: true, what });
});

// ── اتاق انتظار: وضعیت صف (همان کوکی‌های بازدیدکننده) ──
router.get('/api/queue/status', async (ctx) => {
  const sec = secOf(ctx.state);
  const rl = limiter.hit(`queuepoll:${ctx.ip}`, 40, 60 * 1000);
  if (!rl.ok) { ctx.res.setHeader('Retry-After', String(rl.retryAfter)); return sendJson(ctx.res, 429, { ok: false, code: 'too_many_requests', message: 'کمی صبر کن.' }); }
  const cookieOpts = { httpOnly: true, sameSite: 'Lax', secure: ctx.secure, path: '/' };
  const tok0 = ctx.cookies['ys_q'] || '';
  const grantPass = () => {
    if (tok0) removeFromQueue(tok0);
    setCookie(ctx.res, 'ys_pass', issuePass(sec.passTtlMin), { ...cookieOpts, maxAge: sec.passTtlMin * 60 });
    clearCookie(ctx.res, 'ys_q', cookieOpts);
    sendJson(ctx.res, 200, { ok: true, state: 'pass' });
  };
  if (!isOverloaded(sec)) return grantPass();          // سایت خلوت شد → همه داخل
  let tok = tok0;
  if (!tok || !queuePos(tok)) {                          // هنوز در صف نیست → ثبت
    tok = joinQueue(ctx.ip, tok0);
    setCookie(ctx.res, 'ys_q', tok, cookieOpts);
    return sendJson(ctx.res, 200, { ok: true, state: 'queued', pos: queuePos(tok), waiting: waitingSize(), pollSec: sec.pollSec });
  }
  const adm = tryAdmit(tok, sec);                        // پذیرش دانه‌دانه
  if (adm.admitted) return grantPass();
  sendJson(ctx.res, 200, { ok: true, state: 'queued', pos: adm.pos, waiting: waitingSize(), pollSec: sec.pollSec });
});

// ── بار زندهٔ سرور (برای پنل مدیر) ──
router.get('/api/admin/system/load', async (ctx) => {
  ctx.requireUser(); ctx.requirePerm('users.view');
  const st = ctx.state;
  const snap = loadSnapshot();
  const sec = secOf(st);
  const autoBans = (st.bans || []).filter((b) => b.auto && (!b.until || new Date(b.until) > new Date()));
  sendJson(ctx.res, 200, { ok: true, ...snap, sec, autoBans: autoBans.slice(0, 30), clientErrors: (st.clientErrors || []).slice(0, 12), onlineNow: publicStats(st).onlineNow ?? null });
});

// ── تله‌متری خطاهای کلاینت: مرورگرها باگ‌ها را خودشان گزارش می‌دهند ──
// ── وب‌هوک ربات تلگرام: تلگرام پیام‌ها را این‌جا push می‌کند ──
router.post(TG_WEBHOOK_PATH, async (ctx) => {
  const tg = tgWithEnv(ctx.state.settings?.telegram || {});
  const want = tg?.token ? tgSecret(tg.token) : '';
  const got = String(ctx.req.headers['x-telegram-bot-api-secret-token'] || '');
  if (!want || got !== want) { sendJson(ctx.res, 403, { ok: false, code: 'forbidden', message: 'invalid secret' }); return; }
  ctx.rateLimit('tgwh:' + ctx.ip, 120, 60 * 1000);
  sendJson(ctx.res, 200, { ok: true }); // پاسخ سریع به تلگرام؛ پردازش ناهمگام
  const up = ctx.body || {};
  if (up && up.update_id) await handleUpdate(up).catch((e) => {
    db.raw.meta = { ...(db.raw.meta || {}), tgLastError: `${nowISO()} webhook handle: ${e?.message || e}` };
  });
});

router.post('/api/client-error', async (ctx) => {
  ctx.rateLimit(`cerr:${ctx.ip}`, 20, 60 * 1000);
  const b = ctx.body || {};
  const rec = {
    id: uid('cerr'), at: nowISO(),
    msg: V.optStr(b.msg, { max: 300, field: 'msg' }),
    src: V.optStr(b.src, { max: 200, field: 'src' }),
    line: Number(b.line) || 0,
    path: V.optStr(b.path, { max: 120, field: 'path' }),
    build: V.optStr(b.build, { max: 20, field: 'build' }),
    ua: ctx.ua.slice(0, 120),
  };
  await db.tx((st) => {
    st.clientErrors = st.clientErrors || [];
    st.clientErrors.unshift(rec);
    if (st.clientErrors.length > 300) st.clientErrors.length = 300;
  });
  sendJson(ctx.res, 200, { ok: true });
});

router.get('/robots.txt', async (ctx) => {
  ctx.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  ctx.res.end(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nSitemap: /sitemap.xml\n`);
});

router.get('/sitemap.xml', async (ctx) => {
  const st = ctx.state;
  const base = `${ctx.proto}://${ctx.host}`;
  const urls = [
    '', 'products', 'pages/about', 'pages/guide', 'pages/service', 'pages/faq',
    'pages/terms', 'pages/privacy', 'pages/insurance', 'pages/contact', 'stats', 'search',
    ...st.products.filter((p) => p.active !== false).map((p) => `product/${p.id}`),
    ...st.categories.filter((c) => c.active !== false).map((c) => `products?cat=${c.id}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}/#/${u}</loc><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>`;
  ctx.res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  ctx.res.end(xml);
});

// ── راه‌اندازی ──────────────────────────────────────────────
async function ensureSeed(state) {
  if (state.seeded) return state;
  buildSeed(state);
  return state;
}

/**
 * خودترمیمی: اگر هر یک از مجموعه‌های اصلی دیتابیس مفقود یا از نوع اشتباه باشد
 * (مثلاً بر اثر ویرایش دستی یا نیمه‌ماندن یک نوشتن)، بدون دست‌زدن به داده‌های
 * سالم، همان یک کلید را بازسازی می‌کند. تعداد اصلاح‌ها برگردانده می‌شود.
 */
function repairState(st) {
  let fixed = 0;
  const lists = ['categories', 'brands', 'products', 'users', 'sessions', 'otps', 'carts', 'orders', 'reviews', 'tickets', 'notifications', 'supportMessages', 'feedback', 'coupons', 'ads', 'audit', 'priceAlerts', 'bans', 'visitors', 'lotteries', 'telegramInbox', 'clientErrors', 'tasks', 'careerOpenings', 'jobApplications', 'chatMessages'];
  for (const k of lists) if (!Array.isArray(st[k])) { st[k] = []; fixed++; }
  const maps = ['pages', 'settings', 'visits', 'visitSessions', 'stats', 'imageHashes', 'telegramSubs', 'meta', 'staffPresence'];
  for (const k of maps) if (!st[k] || typeof st[k] !== 'object' || Array.isArray(st[k])) { st[k] = {}; fixed++; }
  for (const s of (st.sessions || [])) { if (s.token) { delete s.token; fixed++; } }
  return fixed;
}

function deepDefaults(target, defaults) {
  // Recursively fill only undefined keys — never overwrites existing false/0/'' values.
  // This ensures admin customizations (including false booleans) are preserved.
  for (const k of Object.keys(defaults)) {
    const defVal = defaults[k];
    const curVal = target[k];
    if (curVal === undefined) {
      target[k] = structuredClone(defVal);
    } else if (
      defVal && typeof defVal === 'object' && !Array.isArray(defVal) &&
      curVal && typeof curVal === 'object' && !Array.isArray(curVal)
    ) {
      deepDefaults(curVal, defVal);
    }
    // else: keep existing value (even if false)
  }
}

function normalizeSettings(state) {
  // اطمینان از وجود همهٔ کلیدهای تنظیمات (پس از ارتقا یا ویرایش دستی)
  // هرگز مقدار ذخیره‌شدهٔ قبلی (حتی false) را بازنویسی نمی‌کند — فقط کلیدهای undefined را پر می‌کند.
  const s = state.settings || {};
  const d = DEFAULT_SETTINGS;
  for (const section of Object.keys(d)) {
    if (!s[section] || typeof s[section] !== 'object' || Array.isArray(s[section])) {
      // اگر بخش کاملاً مفقود است، از پیش‌فرض استفاده کن
      // اما اگر بخش قبلاً وجود داشته و از custom-settings آمده، آن را نگه دار
      if (s[section] === undefined) s[section] = structuredClone(d[section]);
      else if (typeof s[section] === 'object') deepDefaults(s[section], d[section]);
    } else {
      deepDefaults(s[section], d[section]);
    }
  }
  // auth might be missing in very old dbs
  if (!s.auth) s.auth = { otpMode: 'demo', allowRegistration: true, requirePhone: false, force2faStaff: false, sessionDays: 14 };
  else deepDefaults(s.auth, { otpMode: 'demo', allowRegistration: true, requirePhone: false, force2faStaff: false, sessionDays: 14 });

  // ── تضمین پیش‌فرض‌های خاموش برای KYC/Lottery/Installments ──
  // اگر مدیر قبلاً آن‌ها را روشن کرده باشد، مقدار true او حفظ می‌شود.
  // اما برای نصب‌های تازه، باید false باشد (قبلاً در DEFAULT_SETTINGS اصلاح شد).
  // این بخش فقط کلیدهای undefined را پر می‌کند، پس false ذخیره‌شده بازنویسی نمی‌شود.
  if (s.features) {
    if (s.features.lottery === undefined) s.features.lottery = false;
    if (s.features.installments === undefined) s.features.installments = false;
  }
  if (s.orders && s.orders.kyc) {
    if (s.orders.kyc.enabled === undefined) s.orders.kyc.enabled = false;
    if (s.orders.kyc.showInNav === undefined) s.orders.kyc.showInNav = false;
  }

  state.settings = s;
  for (const k of Object.keys(DEFAULT_PAGES)) if (!state.pages?.[k]) state.pages[k] = structuredClone(DEFAULT_PAGES[k]);
  return state;
}

import { startBackupScheduler } from './lib/backup.mjs';
import { startTelegramBot, handleUpdate, tgSecret, tgWebhookState, tgWithEnv, TG_WEBHOOK_PATH } from './lib/telegram.mjs';

/** تجزیهٔ User-Agent: سیستم‌عامل، دستگاه، مرورگر */
function parseAgent(ua) {
  const u = String(ua || '');
  const os = /Windows NT 10/.test(u) ? 'Windows 10/11' : /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : 'نامشخص';
  const device = /Mobile|Android|iPhone/.test(u) ? 'موبایل' : /Tablet|iPad/.test(u) ? 'تبلت' : 'دسکتاپ';
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) && /Version\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : 'نامشخص';
  return { os, device, browser };
}

const server = http.createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  res.req = req;
  const url = req.url || '/';
  const pathname = decodeURI(url.split('?')[0]);
  const method = req.method || 'GET';
  const ip = clientIp(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 200);
  const cookies = parseCookie(req.headers.cookie || '');
  // مسدودسازی IP: قبل از هر چیز بررسی می‌شود (بان‌های زمانیِ منقضی‌شده نادیده گرفته می‌شوند)
  const ipBan = (db.raw.bans || []).find((b) => b.type === 'ip' && b.value === ip && (!b.until || new Date(b.until).getTime() > Date.now()));
  if (ipBan) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(403);
    res.end(JSON.stringify({ ok: false, code: 'banned', message: ipBan.until ? `دسترسی شما تا ${new Date(ipBan.until).toLocaleString('fa-IR')} مسدود شده است.` : 'دسترسی شما مسدود شده است. با پشتیبانی تماس بگیرید.' }));
    return;
  }
  // توکن اختصاصی بازدیدکننده (Visitor Token): از هدر یا کوکی خوانده می‌شود؛
  // اگر مدیر آن را مسدود کرده باشد، دستگاه اجازهٔ ورود ندارد
  const visitorToken = cleanVisitorToken(req.headers['x-visitor-token'] || cookies['ys_vtk'] || '');
  if (visitorToken) {
    const tokBan = (db.raw.bans || []).find((b) => b.type === 'token' && String(b.value).toLowerCase() === visitorToken && (!b.until || new Date(b.until).getTime() > Date.now()));
    if (tokBan) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(403);
      res.end(JSON.stringify({ ok: false, code: 'banned', message: 'دسترسی این دستگاه مسدود شده است. با پشتیبانی تماس بگیرید.' }));
      return;
    }
  }
  const isStaticReq = pathname.startsWith('/assets/') || pathname.startsWith('/js/') || pathname.startsWith('/css/') || pathname.startsWith('/out/') ||
    pathname === '/sw.js' || pathname === '/manifest.webmanifest' ||
    /\.(png|jpe?g|webp|gif|svg|ico|woff2?|mp3|css|js|mjs)$/i.test(pathname);
  // نظرسنجی صف و healthz نباید خودشان بار شمرده شوند (وگرنه صف هرگز خلوت نمی‌شود)
  const heavyReq = !isStaticReq && pathname !== '/api/queue/status' && pathname !== '/healthz';
  reqEnter(ip, heavyReq);
  const xff = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const proto = xff === 'https' ? 'https' : 'http';
  const host = String(req.headers.host || `localhost:${PORT}`).slice(0, 200);

  // لینک قدیمی (bander-mobile.onrender.com) برای همیشه به لینک جدید هدایت می‌شود
  if (/^bander-mobile\./i.test(host)) {
    res.writeHead(301, { Location: `https://yassaei-electronics.onrender.com${url}`, 'Cache-Control': 'public, max-age=86400' });
    return res.end();
  }

  // هدرهای امنیتی روی همهٔ پاسخ‌ها
  for (const [k, v] of Object.entries(securityHeaders(req))) res.setHeader(k, v);
  if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  const respond = (status, code, message, details) => {
    if (res.writableEnded) return;
    sendJson(res, status, { ok: false, code, message: message || 'خطا', details });
  };

  try {
    // محافظت در برابر متدهای نامعتبر و مسیرهای عجیب
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
      return respond(405, 'method_not_allowed', 'متد پشتیبانی نمی‌شود.');
    }
    if (method === 'OPTIONS') { res.writeHead(204, { Allow: 'GET,POST,PATCH,DELETE,OPTIONS' }); return res.end(); }
    if (/\.\./.test(pathname) || /[\x00-\x1f]/.test(pathname)) return respond(400, 'bad_path', 'مسیر نامعتبر است.');

    // ضد-DDoS: سیلابِ فراتر از حدِ یک IP → مسدودسازی خودکار و موقت
    {
      const sec0 = secOf(db.raw);
      if (sec0.floodBanPerMin && !QUEUE_OFF && ipPerMin(ip) > sec0.floodBanPerMin) {
        // هرگز IP/دستگاه شناخته‌شدهٔ مالک را وارد فهرست ban نکن؛
        // مالک باید حتی در برابر تشخیص اشتباه سیلاب قابل نجات بماند.
        if (ownerOwnsValue(db.raw, 'ip', ip)) return respond(429, 'too_many_requests', 'تعداد درخواست‌ها زیاد است. کمی صبر کن.');
        const until = new Date(Date.now() + sec0.floodBanMin * 60000).toISOString();
        await db.tx((st) => {
          st.bans = st.bans || [];
          if (!st.bans.some((b) => b.type === 'ip' && b.value === ip && (!b.until || new Date(b.until).getTime() > Date.now()))) {
            if (st.bans.length >= 10000) st.bans.length = 10000;
            st.bans.unshift({ id: uid('ban'), type: 'ip', value: ip, reason: `مسدودسازی خودکار سیلاب درخواست (${sec0.floodBanMin} دقیقه)`, at: nowISO(), until, by: 'سامانه', auto: true });
            logAudit(null, 'security.autoban', ip, { until });
          }
        });
        res.setHeader('Retry-After', String(sec0.floodBanMin * 60));
        return respond(403, 'banned', 'دسترسی شما به‌دلیل سیلاب غیرعادی درخواست‌ها به‌طور موقت مسدود شد.');
      }
    }

    // محدودسازی نرخ کلی — فایل‌های استاتیک شمرده نمی‌شوند (موج نصب سرویس‌ورکر)
    const isStatic = pathname.startsWith('/assets/') || pathname.startsWith('/js/') || pathname.startsWith('/css/') || pathname.startsWith('/out/') || pathname === '/sw.js' || pathname === '/manifest.webmanifest';
    if (!isStatic) {
      const rl = limiter.hit(`global:${ip}`, Math.round(1800 * RATE_SCALE), 60 * 1000);
      if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return respond(429, 'too_many_requests', 'تعداد درخواست‌ها زیاد است. کمی صبر کن.');
      }
      res.setHeader('X-RateLimit-Remaining', String(rl.remaining ?? ''));
    }

    const state = db.raw;
    const isApi = pathname.startsWith('/api/');

    // CSRF برای درخواست‌های تغییردهنده (تله‌متری خطای کلاینت معاف است: بدون هدر، فقط لاگ)
    if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(method) && pathname !== '/api/client-error' && pathname !== TG_WEBHOOK_PATH && !checkCsrf(req, cookies, method)) {
      logAudit(null, 'security.csrf.reject', pathname, { ip });
      return respond(403, 'csrf_failed', 'توکن امنیتی درخواست نامعتبر است. صفحه را تازه کن و دوباره تلاش کن.');
    }

    // نشست کاربر
    const token = cookies[SESSION_COOKIE] || '';
    const session = token ? findSession(state, token) : null;
    const user = session ? state.users.find((u) => u.id === session.userId) || null : null;
    if (session && user && (user.status === 'blocked' || user.status === 'deleted')) {
      db.tx((st) => destroySession(st, token));
    }
    const activeUser = user && user.status !== 'blocked' && user.status !== 'deleted' ? user : null;

    // ── اتاق انتظار: وقتی بار از حد گذشت، بازدیدکنندگان ناشناس دانه‌دانه وارد می‌شوند ──
    // کاربران واردشده (نشست معتبر) و مسیرهای حیاتی هرگز صف نمی‌شوند.
    {
      const sec = secOf(state);
      const exempt = isStatic || pathname === '/api/queue/status' || pathname === '/healthz' || pathname === '/api/system/status' || pathname === '/robots.txt';
      if (sec.queueEnabled && !QUEUE_OFF && !exempt && !(session && activeUser) && isOverloaded(sec) && !checkPass(cookies['ys_pass'])) {
        const tok = joinQueue(ip, cookies['ys_q'] || '');
        setCookie(res, 'ys_q', tok, { httpOnly: true, sameSite: 'Lax', secure: proto === 'https', path: '/' });
        if (isApi) {
          res.setHeader('Retry-After', String(sec.pollSec));
          return respond(503, 'queued', 'سایت شلوغ است و در صف ورود هستی. لطفاً چند لحظه صبر کن.', { pos: queuePos(tok), waiting: waitingSize(), pollSec: sec.pollSec });
        }
        const langPref = String(req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'fa';
        const html = queuePageHtml({ pos: queuePos(tok), waiting: waitingSize(), pollSec: sec.pollSec, storeName: state.settings?.store?.name, lang: langPref });
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:");
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', String(sec.pollSec));
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(method === 'HEAD' ? undefined : html);
      }
    }

    const ctx = {
      req, res, method, path: pathname, query: getQuery(url), cookies, ip, ua, host, proto,
      visitorToken,
      secure: proto === 'https',
      state,
      user: activeUser,
      session: session && activeUser ? session : null,
      params: {},
      body: {},
      rateLimit(key, limit, windowMs) {
        const r = limiter.hit(key, Math.max(1, Math.round(limit * RATE_SCALE)), windowMs);
        if (!r.ok) {
          res.setHeader('Retry-After', String(r.retryAfter));
          throw new HttpError(429, 'too_many_requests', `محدودیت درخواست: ${r.retryAfter} ثانیه دیگر دوباره تلاش کن.`);
        }
        return r;
      },
      clearRateLimits(matchString) {
        if (limiter.clearAll) limiter.clearAll(matchString);
      },
      requireUser() {
        if (!activeUser) throw new HttpError(401, 'login_required', 'برای این کار باید وارد حساب کاربری شوی.');
        return activeUser;
      },
      requirePerm(key) {
        this.requireUser();
        requirePerm(activeUser, key);
        return true;
      },
      mePayload() { return mePayload(state, activeUser); },
    };

    // خواندن بدنه
    if (!['GET', 'HEAD'].includes(method) && isApi) {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('application/json') || !ct) {
        let limit = 512 * 1024;
        if (pathname === '/api/upload' || pathname === '/api/user/kyc') limit = 6 * 1024 * 1024;
        ctx.body = await readJsonBody(req, limit);
      }
      else return respond(415, 'unsupported_media', 'فقط JSON پشتیبانی می‌شود.');
    }

    // کوکی مهمان (برای سبد خرید)
    if (!cookies['ys_guest']) {
      const gid = randomToken(12);
      setCookie(res, 'ys_guest', gid, { httpOnly: false, sameSite: 'Lax', secure: ctx.secure, maxAge: 60 * 60 * 24 * 60 });
      cookies['ys_guest'] = gid;
      ctx.cookies['ys_guest'] = gid;
    }
    // توکن اختصاصی بازدیدکننده: اگر دستگاه هنوز توکن ندارد، یکی می‌سازیم
    // (کلاینت هم همین توکن را در حافظه نگه می‌دارد و در هدر می‌فرستد)
    if (!ctx.visitorToken && isApi) {
      const vtk = newVisitorToken();
      setCookie(res, 'ys_vtk', vtk, { httpOnly: false, sameSite: 'Lax', secure: ctx.secure, maxAge: 60 * 60 * 24 * 730 });
      cookies['ys_vtk'] = vtk;
      ctx.cookies['ys_vtk'] = vtk;
      ctx.visitorToken = vtk;
    }
    // کوکی CSRF (برای همهٔ بازدیدکنندگان، شامل مهمان‌ها)
    if (!cookies[CSRF_COOKIE]) {
      const csrf = issueCsrf();
      setCookie(res, CSRF_COOKIE, csrf, { httpOnly: false, sameSite: 'Lax', secure: ctx.secure, maxAge: 60 * 60 * 24 * 14 });
      cookies[CSRF_COOKIE] = csrf;
      ctx.cookies[CSRF_COOKIE] = csrf;
      res.setHeader('X-CSRF-Token', csrf);
    }
    if (session && activeUser) {
      if (Date.now() - new Date(session.lastSeenAt).getTime() > 60000) {
        db.tx((st) => { const s = st.sessions.find((x) => x.id === session.id); if (s) touchSession(st, s); });
      }
      if (['owner', 'staff'].includes(activeUser.role)) {
        db.tx((st) => {
          st.staffPresence = st.staffPresence || {};
          const ag = parseAgent(ua);
          const p = st.staffPresence[activeUser.id] || {};
          st.staffPresence[activeUser.id] = {
            userId: activeUser.id,
            username: activeUser.username,
            name: activeUser.name,
            role: activeUser.role,
            lastIp: ip,
            ua: ua.slice(0, 180),
            os: ag.os,
            device: ag.device,
            browser: ag.browser,
            loginAt: p.loginAt || activeUser.lastLoginAt || nowISO(),
            lastActiveAt: nowISO(),
            status: 'online',
          };
        });
      }
    }

    // بیداری خودکار (اگر مدیر زمان‌بندی کرده باشد)
    if (state.meta?.sleeping && state.meta?.autoWakeAt && new Date(state.meta.autoWakeAt) <= new Date()) {
      await db.tx((st) => { st.meta = { ...(st.meta || {}), sleeping: false, sleepSince: null, autoWakeAt: null, wokeAt: nowISO(), wokeBy: 'auto' }; });
    }
    // فروشگاه خواب است: فقط مشاهده، ورود و کارهای مدیریتی مجاز است
    if (state.meta?.sleeping && isApi && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !sleepAllowed(pathname)) {
      return respond(503, 'store_asleep', 'فروشگاه موقتاً خاموش است. مدیر می‌تواند از پنل مدیریت آن را روشن کند.');
    }

    // مسیریابی (API و مسیرهای ویژه)
    {
      const m = router.match(method, pathname);
      if (m && !m.methodNotAllowed) {
        ctx.params = m.params;
        await m.route.handler(ctx);
        // ثبت ممیزی فراگیر: هر نوشتن روی API لاگ می‌شود
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && pathname.startsWith('/api') && !pathname.startsWith('/api/system/')) {
          try { logAudit(ctx.user || null, `api.${method.toLowerCase()}`, pathname, {}); } catch { /* noop */ }
        }
        return;
      }
      if (isApi) {
        if (m?.methodNotAllowed) return respond(405, 'method_not_allowed', 'متد مجاز نیست.');
        return respond(404, 'api_not_found', 'این مسیر API وجود ندارد.');
      }
    }

    // فایل استاتیک
    const served = await serveStatic(req, res, url);
    if (served) return;

    // SPA fallback — با کش حافظه‌ای (mtime) و gzip تا زیر بار سنگین سریع بماند
    if (method === 'GET' || method === 'HEAD') {
      const indexHtml = path.join(PUBLIC_DIR, 'index.html');
      try {
        const stat = fs.statSync(indexHtml);
        let ent = indexCache;
        if (!ent || ent.mtime !== stat.mtimeMs) {
          ent = indexCache = { mtime: stat.mtimeMs, buf: fs.readFileSync(indexHtml), gz: null };
          ent.gz = zlib.gzipSync(ent.buf, { level: 6 });
        }
        
        const gscCode = db.raw.settings?.seo?.googleSiteVerification;
        let buf = ent.buf;
        if (true) {
          const content = buf.toString('utf8');
          const seoDesc = db.raw.settings?.seo?.description || db.raw.settings?.store?.description || '';
          const seoTitle = db.raw.settings?.seo?.title || db.raw.settings?.store?.name || 'فروشگاه';
            const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          let newHead = `  <meta name="description" content="${esc(seoDesc)}">\n  <meta property="og:title" content="${esc(seoTitle)}">\n  <title>${esc(seoTitle)}</title>\n  <meta name="google-site-verification" content="${esc(gscCode)}">\n</head>`;
          buf = Buffer.from(content.replace('</head>', newHead).replace(/<title>.*?<\/title>/, ''), 'utf8');
        }
        
        const useGz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        const out = useGz ? zlib.gzipSync(buf, { level: 6 }) : buf;

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': out.length,
          'Cache-Control': 'no-cache',
          ...(useGz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
        });
        return res.end(method === 'HEAD' ? undefined : out);
      } catch { /* فایل ایندکس نیست → ۴۰۴ پایین */ }
    }
    return respond(404, 'not_found', 'صفحه یافت نشد.');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) {
      console.error(`[error] ${method} ${pathname}`, err);
      try {
        const st = db.raw;
        st.audit?.unshift({ id: uid('log'), at: nowISO(), actorId: null, actorName: 'سامانه', actorRole: 'system', action: 'error.unhandled', target: `${method} ${pathname}`.slice(0, 200), meta: { message: String(err?.message || err).slice(0, 300), ip } });
        db.markDirty();
      } catch { /* noop */ }
    }
    respond(status, err?.code || 'server_error', status >= 500 ? 'خطای داخلی سرور. لطفاً دوباره تلاش کن.' : err.message, err?.details);
  } finally {
    reqLeave();
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms > 1200 && !pathname.startsWith('/api/events')) console.warn(`[slow] ${method} ${pathname} ${ms.toFixed(0)}ms`);
  }
});

server.headersTimeout = 30_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 15_000;

// ── کارهای پس‌زمینه ────────────────────────────────────────
setInterval(() => limiter.sweep(), 5 * 60 * 1000).unref?.();
setInterval(() => { sweepQueue(); }, 30 * 1000).unref?.();
// واچ‌داگ خودترمیمی: هر ۶۰ ثانیه سلامت مجموعه‌ها بررسی و در صورت نیاز بازسازی می‌شود
setInterval(() => {
  try {
    const n = repairState(db.raw);
    if (n) { console.warn(`[selfheal] watchdog rebuilt ${n} collection(s)`); db.markDirty(); }
  } catch (e) { console.error('[selfheal] watchdog failed:', e.message); }
}, 60 * 1000).unref?.();
setInterval(() => { heartbeatAll(); }, 25_000).unref?.();

// لغو خودکار سفارش‌های پرداخت‌نشده + آزادسازی موجودی
setInterval(async () => {
  try {
    await db.tx(async (st) => {
      const hours = Number(st.settings.orders?.autoCancelHours || 72);
      const cutoff = Date.now() - hours * 3600_000;
      let n = 0;
      for (const o of st.orders) {
        if (o.status !== 'pending_payment') continue;
        if (new Date(o.createdAt).getTime() > cutoff) continue;
        const shopApi = await import('./api-shop.mjs'); shopApi.safeCancelOrder(st, o, `لغو خودکار به دلیل عدم پرداخت پس از ${hours} ساعت`, 'سامانه');
        n++;
      }
      if (n) logAudit(null, 'job.autocancel', `${n} orders`, {});
    });
  } catch (err) { console.error('[job] autocancel failed:', err.message); }
}, 10 * 60 * 1000).unref?.();

// پاک‌سازی دوره‌ای لاگ‌ها و نشست‌ها
setInterval(async () => {
  try {
    await db.tx((st) => {
      const cutoff = Date.now() - 90 * 86400000;
      st.audit = st.audit.filter((l) => new Date(l.at).getTime() > cutoff);
      st.sessions = st.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
      st.otps = (st.otps || []).filter((o) => new Date(o.expiresAt).getTime() > Date.now() - 86400000);
      st.bans = (st.bans || []).filter((b) => !b.until || new Date(b.until).getTime() > Date.now());
      st.orders = (st.orders || []).filter((o) => {
        // پروندهٔ حساب بن‌شده باید کامل بماند؛ حتی سفارش‌های لغوشدهٔ او هم
        // برای آرشیو و بازیابی مالک حذف نمی‌شوند.
        const owner = (st.users || []).find((u) => u.id === o.userId);
        const preserved = owner?.banned === true || owner?.status === 'blocked';
        return preserved || !(o.status === 'cancelled' && Date.now() - new Date(o.updatedAt || o.createdAt).getTime() > 90 * 86400000);
      });
      st.carts = (st.carts || []).filter(c => new Date(c.updatedAt || c.createdAt || Date.now()).getTime() > Date.now() - (c.userId ? 30 : 3) * 86400000);
      const vCutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      if (st.visits) {
        for (const k of Object.keys(st.visits)) {
          if (k < vCutoff) delete st.visits[k];
        }
      }
      if (st.outbox && st.outbox.length > 200) st.outbox.length = 200;
    });
  } catch (err) { console.error('[job] cleanup failed:', err.message); }
}, 6 * 3600_000).unref?.();

// ── شروع ───────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  await load(ensureSeed);
  // خودترمیمی هنگام راه‌اندازی: مجموعه‌های مفقود بازسازی می‌شوند
  const repaired = repairState(db.raw);
  normalizeSettings(db.raw);
  if (db.raw.settings?.socials?.telegram?.includes("greenapple_shop_bot")) { db.raw.settings.socials.telegram = "https://t.me/yassaei_electronics_shop_bot"; db.markDirty(); }
  if (repaired) {
    console.warn(`[selfheal] ${repaired} collection(s) rebuilt at boot`);
    try { logAudit(null, 'system.selfheal', `${repaired} collections`, {}); } catch { /* noop */ }
  }
  db.markDirty();
  startBackupScheduler();
  startTelegramBot();
  
  // --- Auto-Migration for Lottery & Refurbished Test Data ---
  await (await import('./lib/db.mjs')).db.tx((st) => {
    if (!st.lotteries) st.lotteries = [];
    if (st.lotteries.length === 0) {
      st.lotteries.push({ id: 'lot_demo_1', title: 'قرعه‌کشی تابستانه یاسایی', prize: 'یک عدد اسپیکر بلوتوثی JBL', status: 'done', entries: 145, winners: [{name: 'رضا احمدی (0912***43)'}], endsAt: new Date(Date.now() - 1000000000).toISOString() });
      st.lotteries.push({ id: 'lot_demo_2', title: 'قرعه‌کشی ماهانه خریداران', prize: 'کد تخفیف ۱۰۰٪ تا سقف ۱ میلیون تومان', status: 'active', entries: 42, winners: [], entryMode: 'manual', endsAt: new Date(Date.now() + 864000000).toISOString() });
    }
    
    const refCount = st.products.filter(p => p.condition === 'used' || p.condition === 'refurbished').length;
    
    // 3. Ensure a Refurbished/Used Category Exists
    const refCat = st.categories.find(c => c.id === 'used_parts');
    if (!refCat) {
      st.categories.push({
        id: 'used_parts',
        name: 'کالاهای دست دوم و استوک',
        nameEn: 'Used & Refurbished',
        glyph: 'refresh-cw',
        parentId: null,
        order: 99,
        active: true,
        description: 'کالاهای تعمیری، دست دوم یا استوک با ضمانت و تست',
        descriptionEn: 'Refurbished and used items with guarantee',
        createdAt: new Date().toISOString()
      });
      console.log('Seeded used_parts category.');
    }

    if (refCount === 0 && st.products.length > 0) {
      st.products[0].condition = 'used';
      st.products[0].price = Math.floor(st.products[0].price * 0.6);
      st.products[0].categoryId = 'used_parts';
      if (st.products.length > 1) {
        st.products[1].condition = 'refurbished';
        st.products[1].price = Math.floor(st.products[1].price * 0.8);
        st.products[1].categoryId = 'used_parts';
      }
    }
  });

  server.listen(PORT, HOST, () => {
    const st = db.raw;
    const owner = st.users.find((u) => u.role === 'owner');
    console.log('');
    console.log('  ╭──────────────────────────────────────────────╮');
    console.log('  │   یاسایی · Yassaei Electronics           │');
    console.log('  ╰──────────────────────────────────────────────╯');
    console.log(`  ➜ آدرس:      http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`  ➜ محصولات:   ${st.products.length}  ·  دسته‌ها: ${st.categories.length}  ·  برندها: ${st.brands.length}`);
    console.log(`  ➜ آمار عمومی: ${JSON.stringify(publicStats(st)).slice(0, 90)}...`);
    if (owner) {
      console.log('');
      console.log('  ورود مدیر:');
      console.log(`    نام کاربری : ${owner.username}`);
      console.log(`    رمز عبور   : ${owner.mustChangePassword ? 'Yassaei@1404  (پس از ورود باید تغییر کند)' : '(تغییر یافته)'}`);
      if (st.users?.some((u) => u.username === 'staff')) console.log('  ورود کارمند: staff / Staff@1404');
      if (st.users?.some((u) => ['maryam','reza','sina'].includes(u.username))) console.log('  کاربران نمونه: maryam | reza | sina  — رمز: Demo@1404');
    }
    console.log('');
  });
})().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e); });

const shutdown = async (signal) => {
  console.log(`\n[system] Received ${signal}, safely flushing DB and shutting down...`);
  try {
    const { db } = await import('./lib/db.mjs');
    await db.tx(() => {}); // wait for queued txs
    await db.flush(true);
    console.log('[system] DB successfully saved to disk. Exiting.');
  } catch (err) {
    console.error('[system] DB flush failed on shutdown:', err);
  }
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
