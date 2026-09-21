// ─────────────────────────────────────────────────────────────
//  API احراز هویت و حساب کاربری
//  روش‌های ورود: نام‌کاربری+رمز / موبایل+کد / ایمیل+کد / ورود دومرحله‌ای
// ─────────────────────────────────────────────────────────────
import {
  createSession, destroySession, destroyUserSessions, findSession, touchSession,
  hashPassword, verifyPassword, passwordNeedsRehash, makeOtp, consumeOtp,
  generateTotpSecret, otpauthUrl, verifyTotp, hasPerm, PERMISSIONS, sign, verify,
} from './lib/auth.mjs';
import { db, logAudit, deliver, pushNotification, publicNotification } from './lib/helpers.mjs';
import { V, badRequest, conflict, forbidden, notFound, nowISO, randomToken, sha256, uid, unauthorized, HttpError, rememberVisitorToken } from './lib/util.mjs';
import { sendJson, setCookie, clearCookie } from './lib/http.mjs';
import { newCaptcha, verifyCaptcha, requireCaptcha } from './lib/captcha.mjs';
import { kycConfig } from './lib/kyc.mjs';
import { publicProduct } from './lib/helpers.mjs';

const SESSION_COOKIE = 'ys_session';
const CSRF_COOKIE = 'ys_csrf';

// تلاش‌های ناموفق ورود (قفل موقت)
const failedLogins = new Map(); // unlocked temporarily for debug
function failKey(id, ip) { return `${id}|${ip}`; }
function isLocked(k) {
  const rec = failedLogins.get(k);
  if (!rec) return 0;
  if (rec.count >= 6) {
    const left = Math.ceil((rec.until - Date.now()) / 1000);
    if (left > 0) return left;
    failedLogins.delete(k);
  }
  return 0;
}
function registerFailure(k) {
  const rec = failedLogins.get(k) || { count: 0, until: 0 };
  rec.count++;
  if (rec.count >= 6) rec.until = Date.now() + 1 * 60 * 1000; // reduced lockout to 1 minute
  failedLogins.set(k, rec);
  if (failedLogins.size > 10000) {
    const now = Date.now();
    for (const [key, val] of failedLogins) {
      if (val.until && val.until < now) failedLogins.delete(key);
    }
    if (failedLogins.size > 10000) failedLogins.clear();
  }
  return 6 - rec.count;
}
function clearFailure(k) { failedLogins.delete(k); }
function failCount(k) { return failedLogins.get(k)?.count || 0; }

const DAY = 24 * 3600 * 1000;
/** نشان‌های کاربر: خریدار پرکار، پیشگام، نقدنویس و… */
export function computeBadges(state, user) {
  if (!user) return [];
  const orders = state.orders.filter((o) => o.userId === user.id);
  const done = orders.filter((o) => ['delivered', 'sent', 'processing', 'paid'].includes(o.status));
  const spent = done.reduce((a, o) => a + (o.total || 0), 0);
  const reviews = state.reviews.filter((r) => r.userId === user.id).length;
  const tickets = state.tickets.filter((x) => x.userId === user.id).length;
  const ageDays = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / DAY;
  const plusActive = !!(user.plus?.active && user.plus?.until && new Date(user.plus.until) > new Date());
  const earlyIdx = state.users.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))).findIndex((u) => u.id === user.id);
  const defs = [
    { id: 'first-buy', got: done.length >= 1, hint: 'firstBuy' },
    { id: 'silver-buyer', got: done.length >= 5, hint: 'silver' },
    { id: 'gold-buyer', got: done.length >= 15, hint: 'gold' },
    { id: 'big-spender', got: spent >= 50_000_000, hint: 'spender' },
    { id: 'early-bird', got: earlyIdx >= 0 && earlyIdx < 100, hint: 'early' },
    { id: 'veteran', got: ageDays >= 365, hint: 'vet' },
    { id: 'reviewer', got: reviews >= 3, hint: 'rev' },
    { id: 'plus-member', got: plusActive, hint: 'plus' },
    { id: 'wallet-user', got: (user.wallet?.balance || 0) > 0 || (user.wallet?.txs?.length || 0) > 0, hint: 'wallet' },
    { id: 'supporter', got: tickets >= 1, hint: 'ticket' },
  ];
  return defs.map((d) => ({ ...d, progress: d.id === 'silver-buyer' ? Math.min(done.length, 5) : d.id === 'gold-buyer' ? Math.min(done.length, 15) : d.id === 'reviewer' ? Math.min(reviews, 3) : undefined }));
}

export function mePayload(state, user) {
  if (!user) return null;
  const cart = state.carts.find((c) => c.userId === user.id);
  const unread = state.notifications.filter((n) => (n.userId === user.id || n.userId === null) && !n.read && (n.userId === user.id ? true : true)).length;
  const plusActive = !!(user.plus?.active && user.plus?.until && new Date(user.plus.until) > new Date());
  return {
    id: user.id, username: user.username, name: user.name, nameEn: user.nameEn || '',
    phone: user.phone || '', email: user.email || '',
    role: user.role,
    permissions: user.role === 'owner' ? Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])) : (user.permissions || {}),
    isAdmin: user.role === 'owner' || user.role === 'staff',
    wallet: { balance: user.wallet?.balance || 0 },
    plus: { active: plusActive, until: user.plus?.until || null, startedAt: user.plus?.startedAt || null },
    addresses: user.addresses || [],
    wishlist: user.wishlist || [],
    compare: user.compare || [],
    cartCount: cart ? cart.items.reduce((a, b) => a + b.qty, 0) : 0,
    unreadNotifications: unread,
    mustChangePassword: !!user.mustChangePassword,
    twoFA: { enabled: !!user.twoFA?.enabled, method: user.twoFA?.method || null, methods: user.twoFA?.methods || [] },
    points: user.points || 0,
    referralCode: user.referralCode || user.id.substring(0, 6).toUpperCase(),
    referralCount: state.users.filter((u) => u.referredBy === user.id).length,
    kycStatus: user.kycStatus || 'none',

    kycMessage: user.kycMessage || '',
    badges: computeBadges(state, user),
    
    prefs: user.prefs || {},
    notificationsPrefs: user.notificationsPrefs || {},
    consent: user.consent || {},
    status: user.status || 'active',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
    alerts: (state.priceAlerts || []).filter((a) => a.userId === user.id).map((a) => a.productId),
  };
}

function setSessionCookies(ctx, session, rawToken, { secure }) {
  const maxAge = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
  setCookie(ctx.res, SESSION_COOKIE, rawToken, { httpOnly: true, sameSite: 'Lax', secure, maxAge });
  if (!ctx.cookies[CSRF_COOKIE]) {
    const csrf = randomToken(24);
    setCookie(ctx.res, CSRF_COOKIE, csrf, { httpOnly: false, sameSite: 'Lax', secure, maxAge });
  }
}

function startSession(ctx, user, remember = true) {
  const secure = ctx.secure;
  const session = createSession(ctx.state, user, { ip: ctx.ip, ua: ctx.ua, remember });
  if (ctx.visitorToken) rememberVisitorToken(ctx.state, user.id, ctx.visitorToken);
  setSessionCookies(ctx, session, session.token, { secure });
  return session;
}

/** بررسی مسدودسازی: موبایل/ایمیل/نام کاربری (بان‌های زمانیِ منقضی نادیده گرفته می‌شوند) */
function banHit(state, vals) {
  const list = state.bans || [];
  if (!list.length) return null;
  const norm = (x) => String(x == null ? '' : x).trim().toLowerCase();
  const nowT = Date.now();
  for (const b of list) {
    if (b.until && new Date(b.until).getTime() <= nowT) continue;
    const bv = norm(b.value);
    if (!bv) continue;
    for (const v of vals) if (norm(v) === bv) return b;
  }
  return null;
}
const bannedErr = () => forbidden('banned', 'دسترسی شما به سایت مسدود شده است. با پشتیبانی تماس بگیرید.');

export function registerAuth(router) {
  // ── ارسال کد یک‌بارمصرف ─────────────────────────────────
  // ── کپچا «من ربات نیستم» (خودکفا، بدون سرویس بیرونی) ───────
  router.get('/api/captcha', async (ctx) => {
    if (ctx.state.settings?.features?.captcha === false) { sendJson(ctx.res, 200, { ok: true, disabled: true }); return; }
    const c = newCaptcha();
    sendJson(ctx.res, 200, { ok: true, id: c.id, svg: c.svg });
  });
  router.post('/api/captcha/unban', async (ctx) => {
    const r = verifyCaptcha(ctx.body?.token, ctx.body?.answer);
    if (!r.ok) throw badRequest(r.code, 'کپچا اشتباه است.');
    ctx.clearRateLimits(ctx.ip);
    if (ctx.user) ctx.clearRateLimits(ctx.user.id);
    sendJson(ctx.res, 200, { ok: true });
  });

  router.post('/api/captcha/verify', async (ctx) => {
    ctx.rateLimit(`cap:${ctx.ip}`, 40, 10 * 60 * 1000);
    const r = verifyCaptcha(ctx.body?.id, ctx.body?.answer);
    if (!r.ok) throw badRequest(r.code, r.code === 'captcha_expired' ? 'کپچا منقضی شد؛ یکی دیگر بگیر.' : 'جواب درست نیست؛ دوباره تلاش کن.');
    sendJson(ctx.res, 200, { ok: true, token: r.token });
  });

  router.post('/api/auth/otp/send', async (ctx) => {
    const state = ctx.state;
    const channel = V.oneOf(ctx.body?.channel, ['phone', 'email'], 'channel');
    const purpose = V.oneOf(ctx.body?.purpose, ['login', 'register', 'reset', 'verify', '2fa'], 'purpose', 'login');
    if (purpose === 'login' || purpose === 'register' || purpose === 'reset') requireCaptcha(ctx);
    const target = channel === 'phone' ? V.phone(ctx.body?.target) : V.email(ctx.body?.target);
    ctx.rateLimit(`otp:${target}`, 4, 10 * 60 * 1000);
    ctx.rateLimit(`otp-ip:${ctx.ip}`, 14, 60 * 60 * 1000);

    const existing = state.users.find((u) => (channel === 'phone' ? u.phone === target : u.email === target));
    if (purpose === 'login' && !existing) {
      throw notFound('account_not_found', 'حسابی با این مشخصات پیدا نشد. ابتدا ثبت‌نام کنید.');
    }
    if (purpose === 'register' && existing) {
      throw conflict('account_exists', 'این شماره یا ایمیل قبلاً ثبت شده است. وارد شوید.');
    }
    const { code } = await db.tx((st) => makeOtp(st, { userId: existing?.id || null, channel, target, purpose }));
    const demo = (state.settings.auth?.otpMode || 'demo') === 'demo' && (!existing || (existing.role !== 'owner' && existing.role !== 'staff'));
    const text = channel === 'phone'
      ? `کد تأیید یاسایی: ${code}\nاین کد ۵ دقیقه اعتبار دارد و در اختیار دیگران قرار ندهید.`
      : `کد تأیید یاسایی: ${code} — این کد ۵ دقیقه اعتبار دارد.`;
    await db.tx((st) => {
      deliver(st, {
        channel: channel === 'phone' ? 'sms' : 'email', target, code: demo ? code : '',
        subject: channel === 'phone' ? '' : 'کد تأیید یاسایی', body: text, purpose,
      });
    });
    logAudit(ctx.user, 'auth.otp.send', target, { channel, purpose });
    sendJson(ctx.res, 200, {
      ok: true, channel, target: maskTarget(target, channel), purpose, expiresIn: 300,
      demoCode: demo ? code : undefined,
      demoNote: demo ? 'حالت آزمایشی: چون سامانهٔ پیامک/ایمیل واقعی متصل نیست، کد همین‌جا نمایش داده می‌شود.' : undefined,
    });
  });

  // ── ثبت‌نام ─────────────────────────────────────────────
  router.post('/api/auth/register', async (ctx) => {
    const state = ctx.state;
    if (state.settings.auth?.allowRegistration === false) throw forbidden('registration_disabled', 'ثبت‌نام کاربر جدید موقتاً غیرفعال است.');
    const mode = V.oneOf(ctx.body?.mode, ['username', 'phone', 'email'], 'mode', 'username');
    if (state.settings.auth?.requirePhone === true && mode !== 'phone') throw forbidden('phone_required', 'تأیید شماره موبایل برای ثبت‌نام الزامی است.');
    requireCaptcha(ctx);
    ctx.rateLimit(`reg:${ctx.ip}`, 25, 60 * 60 * 1000); // آی‌پی‌های اشتراکی/CGNAT ایران
    const name = V.str(ctx.body?.name, { min: 2, max: 60, field: 'نام و نام خانوادگی' });
    const password = V.password(ctx.body?.password);
    const accepted = V.bool(ctx.body?.acceptTerms);
    if (!accepted) throw badRequest('terms_required', 'پذیرش قوانین و مقررات و حریم خصوصی الزامی است.');
    
    const hearAboutUs = V.optStr(ctx.body?.hearAboutUs, { max: 50 });
    const refCode = V.optStr(ctx.body?.referralCode, { max: 20 });
    let referredBy = null;
    if (refCode) {
      const referrerUser = state.users.find(u => (u.referralCode || u.id.substring(0, 6).toUpperCase()) === refCode.toUpperCase());
      if (referrerUser) referredBy = referrerUser.id;
    }
    if (banHit(state, [ctx.body?.username, ctx.body?.phone, ctx.body?.email])) throw bannedErr();

    let username = ''; let phone = ''; let email = ''; let code = '';
    if (mode === 'username') {
      username = V.username(ctx.body?.username);
      phone = V.optStr(ctx.body?.phone ? V.phone(ctx.body.phone) : '');
      email = V.optStr(ctx.body?.email ? V.email(ctx.body.email) : '');
    } else if (mode === 'phone') {
      phone = V.phone(ctx.body?.target || ctx.body?.phone);
      code = V.str(ctx.body?.code, { min: 4, max: 8, field: 'کد تأیید' });
      username = V.optStr(ctx.body?.username) || `user_${phone.slice(-6)}`;
      email = V.optStr(ctx.body?.email ? V.email(ctx.body.email) : '');
    } else {
      email = V.email(ctx.body?.target || ctx.body?.email);
      code = V.str(ctx.body?.code, { min: 4, max: 8, field: 'کد تأیید' });
      username = V.optStr(ctx.body?.username) || `user_${sha256(email).slice(0, 6)}`;
      phone = V.optStr(ctx.body?.phone ? V.phone(ctx.body.phone) : '');
    }
    
    const result = await db.tx((st) => {
      if (st.users.some((u) => u.username === username)) throw conflict('username_taken', 'این نام کاربری قبلاً گرفته شده است.');
      if (phone && st.users.some((u) => u.phone === phone)) throw conflict('phone_taken', 'این شمارهٔ موبایل قبلاً ثبت شده است.');
      if (email && st.users.some((u) => u.email === email)) throw conflict('email_taken', 'این ایمیل قبلاً ثبت شده است.');
      if (mode !== 'username') {
        const target = mode === 'phone' ? phone : email;
        const r = consumeOtp(st, { target, purpose: mode === 'phone' ? 'register' : 'register', code });
        if (!r.ok) throw badRequest('invalid_code', otpMessage(r.reason));
      }
      const user = {
        id: uid('u'), username, name, nameEn: '', phone, email,
        passwordHash: hashPassword(password), mustChangePassword: false,
        role: 'user', permissions: {},
        twoFA: { enabled: false, method: null, methods: [], secret: generateTotpSecret(), backupCodes: [] },
        wallet: { balance: 0, transactions: [] },
        plus: { active: false, startedAt: null, until: null },
        addresses: [], wishlist: [], compare: [],
        prefs: { theme: st.settings.theme?.mode || 'dark', locale: 'fa', density: 'normal' },
        consent: { termsAt: nowISO(), privacyAt: nowISO() },
        notificationsPrefs: { marketing: true, orders: true, restock: true },
        referralCode: uid(6).toUpperCase(),
        referredBy: referredBy, hearAboutUs: hearAboutUs, points: 0, status: 'active',
        createdAt: nowISO(), lastLoginAt: null, loginCount: 0,
        visitorToken: ctx.visitorToken || '',
        visitorTokens: ctx.visitorToken ? [ctx.visitorToken] : [],
      };
      if (referredBy) {
        const ref = st.users.find((u) => u.id === referredBy);
        if (ref) {
          ref.referralCount = (ref.referralCount || 0) + 1;
          if (ref.referralCount <= 50) {
            ref.points = (ref.points || 0) + 10;
            user.points = (user.points || 0) + 10;
          }
        }
      }
      if (st.users.length >= 100000) throw badRequest('system_full', 'ظرفیت ثبت‌نام سامانه تکمیل شده است.');
      st.users.push(user);
      logAudit(user, 'auth.register', user.username, { mode });
      // انتقال سبد مهمان
      const guestCart = st.carts.find((c) => c.guestId === ctx.cookies['ys_guest']);
      if (guestCart) {
        guestCart.userId = user.id;
        guestCart.guestId = null;
      }
      pushNotification(st, {
        userId: user.id, type: 'welcome', level: 'success',
        title: 'به یاسایی خوش آمدی', titleEn: 'Welcome to Yassaei Electronics',
        body: 'حساب کاربری‌ات ساخته شد. کد تخفیف WELCOME10 برای اولین خرید فعال است.',
        bodyEn: 'Your account is ready. Use code WELCOME10 on your first order.',
        link: '#/products',
      });
      return { user };
    });

    const session = startSession(ctx, result.user, true);
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, result.user), sessionId: session.id.slice(0, 8), switchToken: session.token });
  });

  // ── ورود با رمز عبور ────────────────────────────────────
  router.post('/api/auth/login', async (ctx) => {
    const state = ctx.state;
    const identifierRaw = V.str(ctx.body?.identifier, { min: 3, max: 120, field: 'نام کاربری / موبایل / ایمیل' });
    const password = String(ctx.body?.password || '');
    const remember = V.bool(ctx.body?.remember, true);
    const identifier = identifierRaw.trim().toLowerCase();
    if (banHit(state, [identifier])) throw bannedErr();
    const lockKey = failKey(identifier, ctx.ip);
    const locked = isLocked(lockKey);
    if (locked) throw new HttpError(423, 'locked', `به دلیل تلاش‌های ناموفق زیاد، تا ${locked} ثانیه دیگر نمی‌توانی وارد شوی.`);
    requireCaptcha(ctx); // کپچا برای ورود با رمز همیشه الزامی است (همسان با ثبت‌نام/OTP/بازیابی)
    ctx.rateLimit(`login:${ctx.ip}`, 40, 10 * 60 * 1000); // آی‌پی‌های اشتراکی/CGNAT؛ ضدبروت‌فورس واقعی = قفل هر شناسه

    // ── تطبیق هویت ────────────────────────────────────────────
    // ترتیب: نام کاربری/ایمیل دقیق، سپس موبایل — و موبایل فقط وقتی شناسه
    // واقعاً شماره باشد. نکتهٔ مهم: هرگز با رشتهٔ خالی تطبیق نده، وگرنه هر
    // نام کاربری بدون رقم (مثل «maryam») با اولین کاربری که موبایلش خالی است
    // یکی گرفته می‌شود؛ نتیجه: ورود ناموفق کاربر واقعی یا ورود به حساب اشتباه.
    const digits = identifierRaw.replace(/\D/g, '');
    const phoneForms = new Set([identifierRaw, digits]);
    if (digits.length === 12 && digits.startsWith('98')) phoneForms.add('0' + digits.slice(2));
    if (digits.length === 10 && digits.startsWith('9')) phoneForms.add('0' + digits);
    const user = state.users.find((u) => u.username === identifier || (u.email && u.email === identifier))
      || state.users.find((u) => digits.length >= 10 && u.phone && phoneForms.has(u.phone));

    if (user && banHit(state, [user.phone, user.email, user.username])) throw bannedErr();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const left = registerFailure(lockKey);
      logAudit(null, 'auth.login.failed', identifierRaw.slice(0, 60), { ip: ctx.ip });
      const e = unauthorized('invalid_credentials', left > 0
        ? `نام کاربری یا رمز عبور اشتباه است. ${left} تلاش دیگر تا قفل شدن موقت.`
        : 'نام کاربری یا رمز عبور اشتباه است.');
      e.details = { captchaRequired: true };
      throw e;
    }
    if (user.status === 'blocked') throw forbidden('account_blocked', 'حساب کاربری شما مسدود شده است. با پشتیبانی تماس بگیرید.');
    if (user.status === 'deleted') throw forbidden('account_deleted', 'این حساب حذف شده است.');
    clearFailure(lockKey);

    // ورود دومرحله‌ای
    if (user.twoFA?.enabled && state.settings.features?.twoFactor !== false) {
      const methods = user.twoFA.methods?.length ? user.twoFA.methods : [user.twoFA.method || 'totp'];
      const challenge = sign({ sub: user.id, iat: Date.now(), exp: Date.now() + 10 * 60 * 1000, purpose: '2fa' });
      let sent = null;
      if (methods.includes('sms') && user.phone) {
        const { code } = await db.tx((st) => makeOtp(st, { userId: user.id, channel: 'phone', target: user.phone, purpose: '2fa', ttlMs: 3 * 60 * 1000 }));
        await db.tx((st) => deliver(st, { channel: 'sms', target: user.phone, code: (st.settings.auth?.otpMode || 'demo') === 'demo' ? code : '', body: `کد ورود دومرحله‌ای یاسایی: ${code}`, purpose: '2fa' }));
        sent = { channel: 'sms', target: maskTarget(user.phone, 'phone'), demoCode: (state.settings.auth?.otpMode || 'demo') === 'demo' && user.role !== 'owner' && user.role !== 'staff' ? code : undefined };
      } else if (methods.includes('email') && user.email) {
        const { code } = await db.tx((st) => makeOtp(st, { userId: user.id, channel: 'email', target: user.email, purpose: '2fa', ttlMs: 3 * 60 * 1000 }));
        await db.tx((st) => deliver(st, { channel: 'email', target: user.email, code: (st.settings.auth?.otpMode || 'demo') === 'demo' ? code : '', subject: 'کد ورود دومرحله‌ای', body: `کد ورود دومرحله‌ای یاسایی: ${code}`, purpose: '2fa' }));
        sent = { channel: 'email', target: maskTarget(user.email, 'email'), demoCode: (state.settings.auth?.otpMode || 'demo') === 'demo' && user.role !== 'owner' && user.role !== 'staff' ? code : undefined };
      }
      return sendJson(ctx.res, 200, { ok: true, twoFactor: true, challengeToken: challenge, methods, sent, expiresIn: 600 });
    }

    await db.tx((st) => {
      const u = st.users.find((x) => x.id === user.id);
      u.lastLoginAt = nowISO();
      u.loginCount = (u.loginCount || 0) + 1;
      if (passwordNeedsRehash(u.passwordHash)) u.passwordHash = hashPassword(password);
      logAudit(u, 'auth.login', u.username, { ip: ctx.ip });
    });
    const session = startSession(ctx, user, remember);
    sendJson(ctx.res, 200, { ok: true, twoFactor: false, me: mePayload(ctx.state, user), sessionId: session.id.slice(0, 8) });
  });

  // ── مرحلهٔ دوم ورود ────────────────────────────────────
  router.post('/api/auth/login/2fa', async (ctx) => {
    const challenge = V.str(ctx.body?.challengeToken, { min: 10, max: 500, field: 'challengeToken' });
    const payload = verify(challenge, 10 * 60 * 1000);
    if (!payload || payload.purpose !== '2fa') throw unauthorized('invalid_challenge', 'نشست تأیید دومرحله‌ای منقضی شده است. دوباره وارد شوید.');
    const code = V.str(ctx.body?.code, { min: 6, max: 16, field: 'کد تأیید' });
    const type = V.oneOf(ctx.body?.type, ['totp', 'sms', 'email', 'backup'], 'type', 'totp');
    ctx.rateLimit(`2fa:${payload.sub}`, 12, 15 * 60 * 1000);

    const user = ctx.state.users.find((u) => u.id === payload.sub);
    if (!user) throw unauthorized('invalid_credentials', 'کاربر یافت نشد.');
    let ok = false;
    let usedBackup = null;
    if (type === 'totp') ok = verifyTotp(user.twoFA?.secret, code);
    else if (type === 'backup') {
      const c = code.trim().toUpperCase().replace(/-/g, '');
      const idx = (user.twoFA?.backupCodes || []).findIndex((b) => b.replace(/-/g, '').toUpperCase() === c);
      if (idx >= 0) { ok = true; usedBackup = idx; }
    } else {
      const target = type === 'sms' ? user.phone : user.email;
      const r = await db.tx((st) => consumeOtp(st, { target, purpose: '2fa', code }));
      ok = r.ok;
      if (!r.ok && r.reason) throw unauthorized('invalid_code', otpMessage(r.reason));
    }
    if (!ok) {
      logAudit(user, 'auth.2fa.failed', user.username, { type });
      throw unauthorized('invalid_code', 'کد تأیید نامعتبر است.');
    }
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === user.id);
      if (type === 'backup') {
        const c = code.trim().toUpperCase().replace(/-/g, '');
        const realIdx = (u.twoFA?.backupCodes || []).findIndex(b => b.replace(/-/g, '').toUpperCase() === c);
        if (realIdx >= 0) u.twoFA.backupCodes.splice(realIdx, 1);
      }
      u.lastLoginAt = nowISO();
      u.loginCount = (u.loginCount || 0) + 1;
      logAudit(u, 'auth.login', u.username, { type: '2fa', method: type });
    });
    const session = startSession(ctx, user, true);
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, user), sessionId: session.id.slice(0, 8), switchToken: session.token });
  });

  // ── ورود فقط با کد (بدون رمز) ───────────────────────────
  router.post('/api/auth/login/otp', async (ctx) => {
    const channel = V.oneOf(ctx.body?.channel, ['phone', 'email'], 'channel');
    const target = channel === 'phone' ? V.phone(ctx.body?.target) : V.email(ctx.body?.target);
    const code = V.str(ctx.body?.code, { min: 4, max: 8, field: 'کد تأیید' });
    ctx.rateLimit(`otplogin:${target}`, 8, 15 * 60 * 1000);

    const r = await db.tx((st) => consumeOtp(st, { target, purpose: 'login', code }));
    if (!r.ok) throw unauthorized('invalid_code', otpMessage(r.reason));
    const user = ctx.state.users.find((u) => (channel === 'phone' ? u.phone === target : u.email === target));
    if (!user) throw notFound('account_not_found', 'حسابی با این مشخصات پیدا نشد. ابتدا ثبت‌نام کنید.');
    if (user.status === 'blocked') throw forbidden('account_blocked', 'حساب کاربری مسدود است.');

    if (user.twoFA?.enabled) {
      const challenge = sign({ sub: user.id, iat: Date.now(), exp: Date.now() + 10 * 60 * 1000, purpose: '2fa' });
      return sendJson(ctx.res, 200, { ok: true, twoFactor: true, challengeToken: challenge, methods: user.twoFA.methods || [user.twoFA.method] });
    }
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === user.id);
      u.lastLoginAt = nowISO(); u.loginCount = (u.loginCount || 0) + 1;
      logAudit(u, 'auth.login', u.username, { method: 'otp', channel });
    });
    const session = startSession(ctx, user, true);
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, user), sessionId: session.id.slice(0, 8), switchToken: session.token });
  });

  // ── بازیابی رمز عبور ────────────────────────────────────
  router.post('/api/auth/password/forgot', async (ctx) => {
    const channel = V.oneOf(ctx.body?.channel, ['phone', 'email'], 'channel');
    const target = channel === 'phone' ? V.phone(ctx.body?.target) : V.email(ctx.body?.target);
    requireCaptcha(ctx);
    ctx.rateLimit(`reset:${target}`, 4, 15 * 60 * 1000);
    const user = ctx.state.users.find((u) => (channel === 'phone' ? u.phone === target : u.email === target));
    if (!user) throw notFound('account_not_found', 'حسابی با این مشخصات پیدا نشد.');
    const { code } = await db.tx((st) => makeOtp(st, { userId: user.id, channel, target, purpose: 'reset', ttlMs: 10 * 60 * 1000 }));
    await db.tx((st) => deliver(st, {
      channel: channel === 'phone' ? 'sms' : 'email', target,
      code: (st.settings.auth?.otpMode || 'demo') === 'demo' ? code : '',
      subject: 'بازیابی رمز عبور', body: `کد بازیابی رمز عبور: ${code}\nاگر شما این درخواست را نداده‌اید، این پیام را نادیده بگیرید.`, purpose: 'reset',
    }));
    logAudit(user, 'auth.password.forgot', target, { channel });
    sendJson(ctx.res, 200, {
      ok: true, target: maskTarget(target, channel), expiresIn: 600,
      demoCode: (ctx.state.settings.auth?.otpMode || 'demo') === 'demo' && (!user || (user.role !== 'owner' && user.role !== 'staff')) ? code : undefined,
    });
  });

  router.post('/api/auth/password/reset', async (ctx) => {
    const channel = V.oneOf(ctx.body?.channel, ['phone', 'email'], 'channel');
    const target = channel === 'phone' ? V.phone(ctx.body?.target) : V.email(ctx.body?.target);
    const code = V.str(ctx.body?.code, { min: 4, max: 8, field: 'کد تأیید' });
    const password = V.password(ctx.body?.password);
    const r = await db.tx((st) => consumeOtp(st, { target, purpose: 'reset', code }));
    if (!r.ok) throw unauthorized('invalid_code', otpMessage(r.reason));
    const user = await db.tx((st) => {
      const u = st.users.find((x) => (channel === 'phone' ? x.phone === target : x.email === target));
      if (!u) throw notFound('account_not_found', 'حساب یافت نشد.');
      u.passwordHash = hashPassword(password);
      u.mustChangePassword = false;
      destroyUserSessions(st, u.id);
      logAudit(u, 'auth.password.reset', u.username, { channel });
      return u;
    });
    const session = startSession(ctx, user, true);
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, user), sessionId: session.id.slice(0, 8), switchToken: session.token });
  });

  // ── خروج ────────────────────────────────────────────────
  router.post('/api/auth/switch', async (ctx) => {
    const token = V.str(ctx.body?.token, { max: 200, field: 'token' });
    const session = findSession(ctx.state, token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      throw unauthorized('invalid_token', 'نشست منقضی شده است. لطفا دوباره وارد شوید.');
    }
    const user = ctx.state.users.find(u => u.id === session.userId);
    if (!user || user.status !== 'active') throw unauthorized('invalid_user', 'حساب کاربری مسدود یا نامعتبر است.');
    setSessionCookies(ctx, session, token, { secure: ctx.secure });
    session.lastSeenAt = nowISO();
    session.ip = ctx.ip;
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, user), switchToken: session.token });
  });

  router.post('/api/auth/logout', async (ctx) => {
    const token = ctx.cookies[SESSION_COOKIE];
    await db.tx((st) => {
      if (token) {
        const s = findSession(st, token);
        if (s) logAudit(st.users.find((u) => u.id === s.userId), 'auth.logout', s.userId, {});
      }
      destroySession(st, token);
    });
    clearCookie(ctx.res, SESSION_COOKIE, { httpOnly: true, sameSite: 'Lax', secure: ctx.secure });
    sendJson(ctx.res, 200, { ok: true });
  });

  // ── اطلاعات کاربر ───────────────────────────────────────
  
  // KYC Upload Endpoint
    router.post('/api/user/kyc', async (ctx) => {
    ctx.requireUser();
    // اگر مدیر سیستم احراز هویت را کامل خاموش کرده باشد، ارسال مدارک هم
    // معنا ندارد و با پیام محترمانه رد می‌شود (kycEnabled = false).
    if (kycConfig(ctx.state.settings?.orders).enabled === false) {
      throw forbidden('kyc_disabled', 'سیستم احراز هویت در حال حاضر موقتاً غیرفعال است. لطفاً بعداً مراجعه کنید.');
    }
    ctx.rateLimit(`kyc:${ctx.user.id}`, 3, 24 * 60 * 60 * 1000);
    const b = ctx.body || {};
    
    // Simulate Shahkar API
    const isShahkarValid = Math.random() > 0.15;
    
    await db.tx((st) => {
      const u = st.users.find(x => x.id === ctx.user.id);
      if (!u) throw notFound();
      u.kycStatus = 'pending';
      u.kycMessage = isShahkarValid ? 'تایید اولیه از سامانه شاهکار دریافت شد. در انتظار بررسی سلفی توسط کارشناس.' : 'عدم تطابق اطلاعات در سامانه شاهکار. نیازمند بررسی دقیق کارشناس.';
      u.kycDocs = {
        selfie: V.optStr(b.selfie, { max: 300 }),
        idCard: V.optStr(b.idCard, { max: 300 }),
        formDoc: V.optStr(b.formDoc, { max: 300 }),
        shahkarValidated: isShahkarValid,
        submittedAt: new Date().toISOString()
      };
      
      import('./lib/telegram.mjs').then(tg => {
        tg.tgBroadcast(st, `👤 <b>درخواست احراز هویت جدید (KYC)</b>\nکاربر: ${u.name || u.username} (${u.phone || ''})\nاستعلام سامانه شاهکار: ${isShahkarValid ? '✅ تطابق دارد' : '❌ مغایرت یا خطا'}\nجهت بررسی مدارک و تایید سلفی به پنل مدیریت مراجعه کنید.`);
      }).catch(()=>{});
    });

    sendJson(ctx.res, 200, { ok: true, status: 'pending' });
  });

  router.get('/api/me', async (ctx) => {
    ctx.requireUser();
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, ctx.user) });
  });

  router.patch('/api/me', async (ctx) => {
    ctx.requireUser();
    const patch = {};
    if (ctx.body?.name !== undefined) patch.name = V.str(ctx.body.name, { min: 2, max: 60, field: 'نام' });
    if (ctx.body?.nameEn !== undefined) patch.nameEn = V.optStr(ctx.body.nameEn, { max: 60, field: 'نام انگلیسی' });
    if (ctx.body?.email !== undefined && ctx.body.email !== '') {
      const em = V.email(ctx.body.email);
      if (ctx.state.users.some((u) => u.email === em && u.id !== ctx.user.id)) throw conflict('email_taken', 'این ایمیل قبلاً ثبت شده است.');
      patch.email = em;
    }
    if (ctx.body?.phone !== undefined && ctx.body.phone !== '') {
      const ph = V.phone(ctx.body.phone);
      if (ctx.state.users.some((u) => u.phone === ph && u.id !== ctx.user.id)) throw conflict('phone_taken', 'این شماره قبلاً ثبت شده است.');
      patch.phone = ph;
    }
    if (ctx.body?.prefs !== undefined && typeof ctx.body.prefs === 'object') {
      const p = ctx.body.prefs;
      patch.prefs = {
        theme: V.oneOf(p.theme, ['dark', 'light', 'auto'], 'theme', ctx.user.prefs?.theme || 'dark'),
        locale: V.oneOf(p.locale, ['fa', 'en'], 'locale', ctx.user.prefs?.locale || 'fa'),
        density: V.oneOf(p.density, ['compact', 'normal', 'comfy'], 'density', ctx.user.prefs?.density || 'normal'),
        reduceMotion: V.bool(p.reduceMotion, !!ctx.user.prefs?.reduceMotion),
      };
    }
    if (ctx.body?.notificationsPrefs !== undefined && typeof ctx.body.notificationsPrefs === 'object') {
      const n = ctx.body.notificationsPrefs;
      patch.notificationsPrefs = {
        marketing: V.bool(n.marketing, !!ctx.user.notificationsPrefs?.marketing),
        orders: V.bool(n.orders, ctx.user.notificationsPrefs?.orders !== false),
        restock: V.bool(n.restock, ctx.user.notificationsPrefs?.restock !== false),
        support: V.bool(n.support, ctx.user.notificationsPrefs?.support !== false),
      };
    }
    if (ctx.body?.consent !== undefined) patch.consent = { ...ctx.user.consent, termsAt: nowISO(), privacyAt: nowISO() };

    const user = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      Object.assign(u, patch);
      logAudit(u, 'user.profile.update', u.username, { fields: Object.keys(patch).join(',') });
      return u;
    });
    sendJson(ctx.res, 200, { ok: true, me: mePayload(ctx.state, user) });
  });

  router.post('/api/me/password', async (ctx) => {
    ctx.requireUser();
    ctx.rateLimit(`pwd:${ctx.user.id}`, 10, 60 * 60 * 1000);
    const current = String(ctx.body?.currentPassword || '');
    const next = V.password(ctx.body?.newPassword);
    if (!verifyPassword(current, ctx.user.passwordHash)) throw unauthorized('invalid_password', 'رمز عبور فعلی اشتباه است.');
    if (current === next) throw badRequest('same_password', 'رمز جدید نباید با رمز فعلی یکسان باشد.');
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.passwordHash = hashPassword(next);
      u.mustChangePassword = false;
      const currentSessionId = ctx.session?.id; destroyUserSessions(st, u.id, currentSessionId);
      logAudit(u, 'user.password.change', u.username, {});
    });
    sendJson(ctx.res, 200, { ok: true, message: 'رمز عبور تغییر کرد. سایر نشست‌ها بسته شدند.' });
  });

  // ── ورود دومرحله‌ای: تنظیمات ────────────────────────────
  router.get('/api/me/2fa', async (ctx) => {
    ctx.requireUser();
    const u = ctx.user;
    // راز TOTP باید ماندگار شود؛ وگرنه کد اپ هرگز با سرور نمی‌خواند
    if (!u.twoFA?.secret) {
      await db.tx((st) => {
        const user = st.users.find((x) => x.id === u.id);
        user.twoFA = user.twoFA || { enabled: false, method: null, methods: [], backupCodes: [] };
        if (!user.twoFA.secret) user.twoFA.secret = generateTotpSecret();
        u.twoFA = user.twoFA;
      });
    }
    sendJson(ctx.res, 200, {
      ok: true,
      enabled: !!u.twoFA?.enabled,
      method: u.twoFA?.method || null,
      methods: u.twoFA?.methods || [],
      secret: u.twoFA?.secret || '',
      otpauth: otpauthUrl(u.twoFA.secret, u.username),
      hasPhone: !!u.phone, hasEmail: !!u.email,
      backupCodes: u.twoFA?.backupCodes || [],
      currentCodeHint: 'برای فعال‌سازی، کد ۶ رقمی اپ احراز هویت را وارد کن.',
    });
  });

  router.post('/api/me/2fa/enable', async (ctx) => {
    ctx.requireUser();
    if (ctx.state.settings.features?.twoFactor === false) throw badRequest('disabled', 'ورود دومرحله‌ای توسط مدیر غیرفعال شده است.');
    const method = V.oneOf(ctx.body?.method, ['totp', 'sms', 'email'], 'method');
    const code = V.optStr(ctx.body?.code, { max: 8, field: 'کد' });
    const u = ctx.user;
    if (method === 'sms' && !u.phone) throw badRequest('no_phone', 'ابتدا شمارهٔ موبایل را در پروفایل ثبت کن.');
    if (method === 'email' && !u.email) throw badRequest('no_email', 'ابتدا ایمیل را در پروفایل ثبت کن.');
    if (method === 'totp') {
      if (!code || code.length !== 6) throw badRequest('code_required', 'کد ۶ رقمی اپ احراز هویت را وارد کن.');
      if (!verifyTotp(u.twoFA?.secret, code)) throw badRequest('invalid_code', 'کد نامعتبر است. ساعت دستگاهت را بررسی کن.');
    }
    const backup = await db.tx((st) => {
      const user = st.users.find((x) => x.id === u.id);
      user.twoFA = user.twoFA || {};
      user.twoFA.secret = user.twoFA.secret || generateTotpSecret();
      user.twoFA.enabled = true;
      user.twoFA.method = method;
      user.twoFA.methods = [...new Set([...(user.twoFA.methods || []), method])];
      if (!user.twoFA.backupCodes?.length) {
        user.twoFA.backupCodes = Array.from({ length: 8 }, () => `${randomToken(3).slice(0, 4).toUpperCase()}-${randomToken(3).slice(0, 4).toUpperCase()}`);
      }
      logAudit(user, 'user.2fa.enable', user.username, { method });
      return user.twoFA.backupCodes;
    });
    sendJson(ctx.res, 200, { ok: true, enabled: true, method, backupCodes: backup, otpauth: otpauthUrl(ctx.user.twoFA.secret, ctx.user.username) });
  });

  router.post('/api/me/2fa/disable', async (ctx) => {
    ctx.requireUser();
    ctx.rateLimit(`pwd:${ctx.user.id}`, 10, 60 * 60 * 1000);
    const password = String(ctx.body?.password || '');
    const code = V.optStr(ctx.body?.code, { max: 8, field: 'کد' });
    const u = ctx.user;
    const passOk = verifyPassword(password, u.passwordHash);
    const totpOk = code && verifyTotp(u.twoFA?.secret, code);
    if (!passOk && !totpOk) throw unauthorized('invalid_credentials', 'برای غیرفعال‌سازی، رمز عبور یا کد احراز هویت لازم است.');
    await db.tx((st) => {
      const user = st.users.find((x) => x.id === u.id);
      user.twoFA = { enabled: false, method: null, methods: [], secret: generateTotpSecret(), backupCodes: [] };
      logAudit(user, 'user.2fa.disable', user.username, {});
    });
    sendJson(ctx.res, 200, { ok: true, enabled: false });
  });

  // ── آدرس‌ها ─────────────────────────────────────────────
  router.post('/api/me/addresses', async (ctx) => {
    ctx.requireUser();
    const a = validateAddress(ctx.body);
    const list = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.addresses = u.addresses || [];
      if (u.addresses.length >= 12) throw badRequest('too_many', 'حداکثر ۱۲ آدرس می‌توانی ثبت کنی.');
      if (a.isDefault) u.addresses.forEach((x) => { x.isDefault = false; });
      if (!u.addresses.length) a.isDefault = true;
      u.addresses.push(a);
      logAudit(u, 'user.address.add', a.id, {});
      return u.addresses;
    });
    sendJson(ctx.res, 200, { ok: true, addresses: list });
  });

  router.patch('/api/me/addresses/:id', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسهٔ آدرس');
    const list = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      const a = (u.addresses || []).find((x) => x.id === id);
      if (!a) throw notFound('address_not_found', 'آدرس یافت نشد.');
      Object.assign(a, validateAddress({ ...a, ...ctx.body, id }, { partial: true }));
      if (a.isDefault) u.addresses.forEach((x) => { if (x.id !== id) x.isDefault = false; });
      logAudit(u, 'user.address.update', id, {});
      return u.addresses;
    });
    sendJson(ctx.res, 200, { ok: true, addresses: list });
  });

  router.delete('/api/me/addresses/:id', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسهٔ آدرس');
    const list = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.addresses = (u.addresses || []).filter((x) => x.id !== id);
      if (u.addresses.length && !u.addresses.some((x) => x.isDefault)) u.addresses[0].isDefault = true;
      logAudit(u, 'user.address.delete', id, {});
      return u.addresses;
    });
    sendJson(ctx.res, 200, { ok: true, addresses: list });
  });

  // ── لیست من (علاقه‌مندی) و مقایسه ───────────────────────
  router.post('/api/me/wishlist/:productId', async (ctx) => {
    ctx.requireUser();
    const pid = V.id(ctx.params.productId, 'شناسهٔ کالا');
    if (!ctx.state.products.some((p) => p.id === pid)) throw notFound('product_not_found', 'کالا یافت نشد.');
    const { list, added } = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.wishlist = u.wishlist || [];
      const i = u.wishlist.indexOf(pid);
      if (i >= 0) { u.wishlist.splice(i, 1); } else { u.wishlist.push(pid); if (u.wishlist.length > 200) u.wishlist.shift(); }
      logAudit(u, 'user.wishlist.toggle', pid, { added: i < 0 });
      return { list: u.wishlist, added: i < 0 };
    });
    sendJson(ctx.res, 200, { ok: true, wishlist: list, added });
  });

  router.get('/api/me/wishlist', async (ctx) => {
    ctx.requireUser();
    const items = (ctx.user.wishlist || []).map((id) => ctx.state.products.find((p) => p.id === id)).filter(Boolean)
      .map((p) => publicProduct(p, { categories: ctx.state.categories, brands: ctx.state.brands }));
    sendJson(ctx.res, 200, { ok: true, items });
  });

  router.post('/api/me/compare/:productId', async (ctx) => {
    ctx.requireUser();
    const pid = V.id(ctx.params.productId, 'شناسهٔ کالا');
    const { list, added } = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.compare = u.compare || [];
      const i = u.compare.indexOf(pid);
      if (i >= 0) u.compare.splice(i, 1);
      else { u.compare.push(pid); if (u.compare.length > 5) u.compare.shift(); }
      return { list: u.compare, added: i < 0 };
    });
    sendJson(ctx.res, 200, { ok: true, compare: list, added });
  });

  router.delete('/api/me/compare', async (ctx) => {
    ctx.requireUser();
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      if (u) u.compare = [];
    });
    sendJson(ctx.res, 200, { ok: true, compare: [] });
  });

  // ── هشدار موجودی ────────────────────────────────────────
  router.post('/api/me/alerts/:productId', async (ctx) => {
    ctx.requireUser();
    const pid = V.id(ctx.params.productId, 'شناسهٔ کالا');
    if (!ctx.state.products.some((p) => p.id === pid)) throw notFound('product_not_found', 'کالا یافت نشد.');
    const { subscribed } = await db.tx((st) => {
      st.priceAlerts = st.priceAlerts || [];
      const i = st.priceAlerts.findIndex((a) => a.userId === ctx.user.id && a.productId === pid);
      if (i >= 0) { st.priceAlerts.splice(i, 1); return { subscribed: false }; }
      if (st.priceAlerts.filter(a => a.userId === ctx.user.id).length >= 50) throw badRequest('limit', 'حداکثر ۵۰ کالا را می‌توانی در لیست «خبرم کن» داشته باشی.');
      st.priceAlerts.push({ id: uid('al'), userId: ctx.user.id, productId: pid, createdAt: nowISO() });
      if (st.priceAlerts.length > 200) st.priceAlerts.shift();
      logAudit(ctx.user, 'user.alert.subscribe', pid, {});
      return { subscribed: true };
    });
    sendJson(ctx.res, 200, { ok: true, subscribed });
  });

  // ── کیف پول ─────────────────────────────────────────────
  router.get('/api/me/wallet', async (ctx) => {
    ctx.requireUser();
    sendJson(ctx.res, 200, { ok: true, balance: ctx.user.wallet?.balance || 0, transactions: (ctx.user.wallet?.transactions || []).slice(0, 100) });
  });

  router.post('/api/me/wallet/deposit', async (ctx) => {
    ctx.requireUser();
    const amount = V.int(ctx.body?.amount, { min: 10000, max: 50000000, field: 'مبلغ' });
    const out = await db.tx((st) => {
      if (st.settings.orders?.gatewayMode === 'live') throw badRequest('live_mode', 'درگاه در حالت واقعی است. شارژ شبیه‌سازی‌شده غیرفعال است.');
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.wallet = u.wallet || { balance: 0, transactions: [] };
      const ref = `SIM-${Date.now().toString(36).toUpperCase()}`;
      u.wallet.balance += amount;
      u.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'deposit', amount, status: 'done', note: 'شارژ کیف پول (درگاه آزمایشی)', ref });
      if (u.wallet.transactions.length > 200) u.wallet.transactions.length = 200;
      logAudit(u, 'wallet.deposit', String(amount), { ref });
      return { balance: u.wallet.balance, transactions: u.wallet.transactions.slice(0, 50) };
    });
    sendJson(ctx.res, 200, { ok: true, ...out, gatewayMode: ctx.state.settings.orders?.gatewayMode || 'demo' });
  });

  // ── اشتراک پلاس ─────────────────────────────────────────
  router.post('/api/me/plus/subscribe', async (ctx) => {
    ctx.requireUser();
    const s = ctx.state.settings;
    if (s.features?.plus === false || s.plus?.enabled === false) throw badRequest('disabled', 'اشتراک پلاس در حال حاضر غیرفعال است.');
    const price = Number(s.plus?.price || 0);
    const days = Number(s.plus?.durationDays || 30);
    const method = V.oneOf(ctx.body?.method, ['wallet', 'gateway'], 'method', 'wallet');
    const out = await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      if (method === 'gateway') throw badRequest('not_supported', 'درگاه پرداخت برای پلاس در این نسخه فعال نیست. فقط از کیف پول استفاده کنید.');
      if (method === 'wallet') {
        if ((u.wallet?.balance || 0) < price) throw badRequest('insufficient_balance', 'موجودی کیف پول کافی نیست.');
        u.wallet.balance -= price;
        u.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'purchase', amount: -price, status: 'done', note: `خرید اشتراک پلاس ${days} روزه`, ref: '' });
      if (u.wallet.transactions.length > 200) u.wallet.transactions.length = 200;
      }
      const base = u.plus?.active && new Date(u.plus.until) > new Date() ? new Date(u.plus.until) : new Date();
      u.plus = { active: true, startedAt: u.plus?.startedAt || nowISO(), until: new Date(base.getTime() + days * 86400000).toISOString(), method };
      logAudit(u, 'plus.subscribe', `${price}/${days}d`, { method });
      pushNotification(st, { userId: u.id, type: 'plus', level: 'success', title: 'اشتراک پلاس فعال شد', body: `تا ${new Date(u.plus.until).toLocaleDateString('fa-IR')} از مزایای پلاس بهره‌مند هستی.`, link: '#/account/plus' });
      return { plus: u.plus, balance: u.wallet?.balance || 0 };
    });
    sendJson(ctx.res, 200, { ok: true, ...out, perks: s.plus?.perks || [] });
  });

  // ── اعلان‌ها ────────────────────────────────────────────
  router.get('/api/me/notifications', async (ctx) => {
    ctx.requireUser();
    const list = ctx.state.notifications.filter((n) => n.userId === ctx.user.id || n.userId === null)
      .slice(0, 100).map((n) => ({ ...publicNotification(n), read: n.read || (n.userId === null ? !!ctx.user.readGlobal?.[n.id] : !!n.read) }));
    sendJson(ctx.res, 200, { ok: true, items: list });
  });

  router.post('/api/me/notifications/read', async (ctx) => {
    ctx.requireUser();
    const ids = Array.isArray(ctx.body?.ids) ? ctx.body.ids.slice(0, 200) : [];
    const all = V.bool(ctx.body?.all);
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.readGlobal = u.readGlobal || {};
      for (const n of st.notifications) {
        if (n.userId === u.id && (all || ids.includes(n.id))) n.read = true;
        if (n.userId === null && (all || ids.includes(n.id))) u.readGlobal[n.id] = true;
      }
    });
    sendJson(ctx.res, 200, { ok: true });
  });

  router.delete('/api/me/notifications/:id', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسه');
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      u.deletedNotifications = u.deletedNotifications || [];
      u.deletedNotifications.push(id);
      if (u.deletedNotifications.length > 500) u.deletedNotifications.shift();
      const n = st.notifications.find((x) => x.id === id && x.userId === u.id);
      if (n) st.notifications = st.notifications.filter((x) => x.id !== id);
    });
    sendJson(ctx.res, 200, { ok: true });
  });

  // ── نشست‌های فعال ───────────────────────────────────────
  router.get('/api/me/sessions', async (ctx) => {
    ctx.requireUser();
    const list = ctx.state.sessions.filter((s) => s.userId === ctx.user.id).map((s) => ({
      id: s.id.slice(0, 12), current: s.id === ctx.session?.id,
      createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, ip: s.ip, ua: s.ua,
    }));
    sendJson(ctx.res, 200, { ok: true, items: list });
  });

  router.post('/api/me/sessions/revoke', async (ctx) => {
    ctx.requireUser();
    const id = V.optStr(ctx.body?.id, { max: 20, field: 'شناسهٔ نشست' });
    const allOthers = V.bool(ctx.body?.allOthers);
    await db.tx((st) => {
      if (allOthers) {
        st.sessions = st.sessions.filter((s) => !(s.userId === ctx.user.id && s.id !== ctx.session?.id));
      } else if (id) {
        st.sessions = st.sessions.filter((s) => !(s.userId === ctx.user.id && s.id.startsWith(id)));
      }
      logAudit(ctx.user, 'user.session.revoke', id || 'all-others', {});
    });
    sendJson(ctx.res, 200, { ok: true });
  });

  // ── خروجی داده‌های شخصی و حذف حساب ──────────────────────
  router.get('/api/me/export', async (ctx) => {
    ctx.requireUser();
    const u = ctx.user;
    const data = {
      exportedAt: nowISO(),
      profile: { id: u.id, username: u.username, name: u.name, phone: u.phone, email: u.email, createdAt: u.createdAt, points: u.points },
      addresses: u.addresses, wishlist: u.wishlist,
      wallet: u.wallet, plus: u.plus,
      orders: ctx.state.orders.filter((o) => o.userId === u.id),
      reviews: ctx.state.reviews.filter((r) => r.userId === u.id),
      tickets: ctx.state.tickets.filter((t) => t.userId === u.id),
      feedback: ctx.state.feedback.filter((f) => f.userId === u.id),
      notifications: ctx.state.notifications.filter((n) => n.userId === u.id),
    };
    logAudit(u, 'user.data.export', u.username, {});
    sendJson(ctx.res, 200, { ok: true, data });
  });

  router.post('/api/me/delete', async (ctx) => {
    ctx.requireUser();
    const password = String(ctx.body?.password || '');
    if (!verifyPassword(password, ctx.user.passwordHash)) throw unauthorized('invalid_password', 'رمز عبور اشتباه است.');
    await db.tx((st) => {
      const u = st.users.find((x) => x.id === ctx.user.id);
      if (u.role === 'owner') throw forbidden('owner_protected', 'حساب مالک قابل حذف نیست.');
      u.status = 'deleted';
      u.name = 'کاربر حذف‌شده';
      u.email = '';
      u.phone = '';
      u.addresses = [];
      u.wishlist = [];
      u.wallet = { balance: 0, transactions: u.wallet?.transactions || [] };
      u.kycDocs = null;
      destroyUserSessions(st, u.id);
      logAudit({ id: u.id, username: u.username, role: u.role }, 'user.account.delete', u.username, {});
    });
    clearCookie(ctx.res, SESSION_COOKIE, { httpOnly: true, sameSite: 'Lax', secure: ctx.secure });
    sendJson(ctx.res, 200, { ok: true, message: 'حساب کاربری حذف شد. سوابق مالی طبق قانون نگهداری می‌شود.' });
  });
}

// ── توابع کمکی ─────────────────────────────────────────────
function maskTarget(target, channel) {
  if (channel === 'phone') return String(target).replace(/(\d{4})\d{3}(\d{3})/, '$1***$2');
  const [u, d] = String(target).split('@');
  return `${u.slice(0, 2)}***@${d || ''}`;
}
function otpMessage(reason) {
  switch (reason) {
    case 'expired': return 'کد منقضی شده است. کد جدید درخواست بده.';
    case 'locked': return 'به دلیل تلاش زیاد، این کد قفل شده است. کد جدید درخواست بده.';
    case 'mismatch': return 'کد واردشده اشتباه است.';
    default: return 'کد تأیید یافت نشد. ابتدا درخواست کد بده.';
  }
}
export function validateAddress(body, { partial = false } = {}) {
  const zones = ['city', 'province', 'country'];
  const a = {
    id: body?.id && /^[A-Za-z0-9_-]{3,64}$/.test(String(body.id)) ? String(body.id) : uid('adr'),
    title: V.str(body?.title, { min: 1, max: 30, field: 'عنوان آدرس', allowEmpty: partial }),
    receiver: V.str(body?.receiver, { min: 2, max: 60, field: 'نام گیرنده' }),
    phone: V.phone(body?.phone),
    province: V.str(body?.province, { min: 2, max: 40, field: 'استان' }),
    city: V.str(body?.city, { min: 2, max: 40, field: 'شهر' }),
    zone: V.oneOf(body?.zone, zones, 'منطقهٔ ارسال', 'province'),
    street: V.str(body?.street, { min: 5, max: 300, field: 'آدرس کامل' }),
    postal: V.optStr(body?.postal, { max: 10, field: 'کد پستی' }),
    isDefault: V.bool(body?.isDefault, false),
    note: V.optStr(body?.note, { max: 200, field: 'توضیحات' }),
    createdAt: body?.createdAt || nowISO(),
  };
  if (a.postal && !/^\d{10}$/.test(a.postal)) a.postal = '';
  return a;
}

export { SESSION_COOKIE, CSRF_COOKIE, touchSession, hasPerm };
