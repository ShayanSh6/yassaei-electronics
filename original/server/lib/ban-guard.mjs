// ─────────────────────────────────────────────────────────────
//  محافظ سلسله‌مراتب مسدودسازی
//  هیچ عملیات API نباید بتواند مالک یا مدیر هم‌سطح/بالاتر را مسدود کند.
// ─────────────────────────────────────────────────────────────
import { forbidden, toLatinDigits } from './util.mjs';

const canonical = (value) => toLatinDigits(String(value ?? '').trim()).toLowerCase();

export const ROLE_RANK = Object.freeze({ user: 1, staff: 2, owner: 3 });

export function rankOf(user) {
  return ROLE_RANK[user?.role] || 0;
}

export function activeUsers(state) {
  return Array.isArray(state?.users) ? state.users : [];
}

export function matchingUsers(state, type, value) {
  const needle = canonical(value);
  if (!needle) return [];
  return activeUsers(state).filter((u) => {
    if (type === 'phone') return canonical(u.phone) === needle;
    if (type === 'email') return canonical(u.email) === needle;
    if (type === 'username') return canonical(u.username) === needle;
    if (type === 'ip') return canonical(u.lastIp) === needle
      || (state.sessions || []).some((s) => s.userId === u.id && canonical(s.ip) === needle)
      || (state.visitors || []).some((v) => v.userId === u.id && canonical(v.ip) === needle);
    if (type === 'token') return [u.visitorToken, ...(u.visitorTokens || [])].filter(Boolean).some((x) => canonical(x) === needle)
      || (state.visitors || []).some((v) => v.userId === u.id && canonical(v.token) === needle);
    return false;
  });
}

/** همهٔ شناسه‌های قابل‌تشخیص مالک؛ برای جلوگیری از بن ناخواستهٔ IP/توکن هم استفاده می‌شود. */
export function ownerOwnsValue(state, type, value) {
  const needle = canonical(value);
  if (!needle) return false;
  return activeUsers(state).filter((u) => u.role === 'owner').some((u) => {
    if (type === 'phone') return canonical(u.phone) === needle;
    if (type === 'email') return canonical(u.email) === needle;
    if (type === 'username') return canonical(u.username) === needle;
    if (type === 'ip') {
      if (canonical(u.lastIp) === needle) return true;
      return (state.sessions || []).some((s) => s.userId === u.id && canonical(s.ip) === needle)
        || (state.visitors || []).some((v) => v.userId === u.id && canonical(v.ip) === needle);
    }
    if (type === 'token') {
      return [u.visitorToken, ...(u.visitorTokens || [])].filter(Boolean).some((x) => canonical(x) === needle)
        || (state.visitors || []).some((v) => v.userId === u.id && canonical(v.token) === needle);
    }
    return false;
  });
}

/**
 * قبل از ایجاد/حذف بن فراخوانی شود. مالک حتی توسط خود مالک قابل بن نیست؛
 * کارکنان نیز حق اقدام روی کارمند دیگر یا مالک را ندارند.
 */
export function assertBanAction(state, actor, type, value, { targetUser = null } = {}) {
  const targets = targetUser ? [targetUser] : matchingUsers(state, type, value);
  if (ownerOwnsValue(state, type, value) || targets.some((u) => u.role === 'owner')) {
    throw forbidden('owner_protected', 'حساب مالک تحت هیچ شرایطی قابل مسدودسازی یا رفع مسدودی نیست.');
  }
  const actorRank = rankOf(actor);
  const equalOrHigher = targets.find((u) => rankOf(u) >= actorRank && rankOf(u) > 0);
  if (equalOrHigher) {
    throw forbidden('rank_protected', 'امکان مسدودسازی یا رفع مسدودی کاربر هم‌سطح یا بالاتر وجود ندارد.');
  }
  if (targetUser && targetUser.id === actor?.id) {
    throw forbidden('self_ban', 'نمی‌توانی حساب خودت را مسدود یا رفع مسدودی کنی.');
  }
  return targets;
}

export function ownerIdentitySet(state, owner) {
  const values = new Set();
  if (!owner) return values;
  for (const v of [owner.phone, owner.email, owner.username, owner.lastIp, owner.visitorToken, ...(owner.visitorTokens || [])]) if (v) values.add(canonical(v));
  for (const s of state.sessions || []) if (s.userId === owner.id && s.ip) values.add(canonical(s.ip));
  for (const v of state.visitors || []) if (v.userId === owner.id) for (const x of [v.ip, v.token]) if (x) values.add(canonical(x));
  return values;
}
