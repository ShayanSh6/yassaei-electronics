// ─────────────────────────────────────────────────────────────
//  کپچای خودکفا «من ربات نیستم» — چالش ریاضی + تصویر SVG
//  بدون هیچ سرویس بیرونی (گوگل‌ری‌کپچا و امثالهم در ایران تحریم/فیلترند)
// ─────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { badRequest } from './util.mjs';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';
const faDigits = (n) => String(n).replace(/\d/g, (d) => FA[+d]);
const normNum = (s) => String(s == null ? '' : s)
  .replace(/[۰-۹]/g, (c) => String(FA.indexOf(c)))
  .replace(/[٠-٩]/g, (c) => String(AR.indexOf(c)))
  .replace(/[^\d-]/g, '')
  .trim();

const TTL = 5 * 60 * 1000;      // عمر چالش و توکن
const MAX_TRIES = 5;            // حداکثر پاسخ غلط هر چالش
const TOKEN_USES = 2;           // هر توکن حل‌شده حداکثر ۲ مصرف (مثلاً ارسال کد + ثبت‌نام)

const challenges = new Map();   // id -> { ans, exp, tries }
const tokens = new Map();       // token -> { exp, uses }

function sweep(m) {
  const now = Date.now();
  for (const [k, v] of m) if (v.exp < now) m.delete(k);
}
const rnd = (n) => Math.random() * n;
const esc = (ch) => ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svgMath(a, b, mul) {
  const expr = `${faDigits(a)} ${mul ? '×' : '+'} ${faDigits(b)} = ؟`;
  // نویز فقط در حاشیهٔ بالا/پایین تا روی عبارت ریاضی سایه نیندازد
  let noise = '';
  for (let i = 0; i < 3; i++) {
    const top = rnd(2) < 1;
    const y1 = top ? 2 + rnd(6) : 52 + rnd(6);
    const y2 = top ? 2 + rnd(6) : 52 + rnd(6);
    noise += `<line x1="${rnd(150).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${rnd(150).toFixed(1)}" y2="${y2.toFixed(1)}" stroke="hsl(${Math.floor(rnd(360))} 65% 62% / .35)" stroke-width="1"/>`;
  }
  for (let i = 0; i < 6; i++) {
    const top = rnd(2) < 1;
    noise += `<circle cx="${rnd(150).toFixed(1)}" cy="${(top ? 2 + rnd(7) : 51 + rnd(7)).toFixed(1)}" r="${(0.4 + rnd(1.2)).toFixed(1)}" fill="hsl(${Math.floor(rnd(360))} 70% 60% / .35)"/>`;
  }
  const isOp = (ch) => ch === '+' || ch === '×' || ch === '=';
  const chars = [...expr].map((ch, i) => {
    const op = isOp(ch);
    const x = 13 + i * 15;
    // عملگرها کاملاً صاف، بزرگ‌تر و با رنگ متمایز؛ اعداد چرخش خیلی کم
    const y = op ? 40 : 38 + Math.round(rnd(5) - 2);
    const rot = op ? 0 : (rnd(12) - 6).toFixed(1);
    const size = op ? 26 : 21;
    const fill = op ? '#f59e0b' : 'currentColor';
    return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-size="${size}" font-weight="800" fill="${fill}" opacity="${op ? 1 : (0.88 + rnd(0.12)).toFixed(2)}">${ch === ' ' ? '&#160;' : esc(ch)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 60" width="150" height="60" role="img" aria-label="challenges math">${'<rect width="150" height="60" rx="10" fill="none"/>'}${noise}${chars}</svg>`;
}

/** ساخت چالش تازه: { id, svg } */
export function newCaptcha() {
  sweep(challenges);
  const mul = Math.random() < 0.35;
  const a = 2 + Math.floor(rnd(8));
  const b = mul ? 2 + Math.floor(rnd(6)) : 2 + Math.floor(rnd(8));
  const id = randomBytes(9).toString('base64url');
  challenges.set(id, { ans: mul ? a * b : a + b, exp: Date.now() + TTL, tries: 0 });
    if (challenges.size > 2000) challenges.delete(challenges.keys().next().value);
  if (challenges.size > 2000) challenges.delete(challenges.keys().next().value);
  return { id, svg: svgMath(a, b, mul) };
}

/** بررسی پاسخ چالش → توکن یک‌بارمصرف */
export function verifyCaptcha(id, answer) {
  sweep(challenges);
  const c = challenges.get(String(id || ''));
  if (!c) return { ok: false, code: 'captcha_expired' };
  c.tries++;
  if (c.tries > MAX_TRIES) { challenges.delete(id); return { ok: false, code: 'captcha_expired' }; }
  const got = normNum(answer);
  if (got === '' || Number(got) !== c.ans) return { ok: false, code: 'captcha_invalid' };
  challenges.delete(id);
  const token = randomBytes(12).toString('base64url');
  tokens.set(token, { exp: Date.now() + TTL, uses: 0 });
    if (tokens.size > 2000) tokens.delete(tokens.keys().next().value);
  if (tokens.size > 2000) tokens.delete(tokens.keys().next().value);
  return { ok: true, token };
}

export function consumeCaptchaToken(token) {
  sweep(tokens);
  const t = tokens.get(String(token || ''));
  if (!t) return false;
  t.uses++;
  if (t.uses >= TOKEN_USES) tokens.delete(String(token));
  return true;
}

/**
 * نگهبان اندپوینت: اگر قابلیت کپچا روشن باشد، توکن معتبر می‌خواهد.
 * `when=false` یعنی این درخواست نیازی به کپچا ندارد.
 */
export function requireCaptcha(ctx, when = true) {
  if (!when) return;
  if (ctx.state.settings?.features?.captcha === false) return;
  if (!consumeCaptchaToken(ctx.body?.captchaToken)) {
    throw badRequest('captcha_required', 'اول تأیید کن که ربات نیستی (روی «من ربات نیستم» بزن و حاصل را بنویس).');
  }
}

/** شمارندهٔ تلاش‌های ناموفق (برای فعال‌سازی کپچا پس از خطا) */
export function captchaGateInfo(fails) { return fails >= 1; }
