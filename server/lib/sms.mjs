// ─────────────────────────────────────────────────────────────
//  ارسال پیامک از طریق کاوه‌نگار (API رسمی) — تنظیمات ادمین:
//  settings.sms = { enabled, apiKey, sender }
// ─────────────────────────────────────────────────────────────
import { db } from './db.mjs';

export function smsConfigured() {
  const s = db.raw.settings?.sms;
  return !!(s?.enabled && s?.apiKey);
}

export async function sendSms(receptor, message) {
  const s = db.raw.settings?.sms;
  if (!smsConfigured()) throw new Error('sms not configured');
  const url = `https://api.kavenegar.com/v2/${encodeURIComponent(s.apiKey)}/sms/send.json`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ receptor: String(receptor), message: String(message), sender: s.sender || '' }),
  });
  const j = await r.json().catch(() => ({}));
  if (j?.return !== 0 && j?.return !== 200) throw new Error(`sms return ${j?.return}`);
  return { ok: true };
}
