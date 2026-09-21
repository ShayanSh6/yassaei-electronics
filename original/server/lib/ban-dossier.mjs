// پروندهٔ خودکار مسدودسازی: بدون حذف هیچ بخشی از حساب کاربر
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.mjs';
import { nowISO } from './util.mjs';

const cleanName = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'unknown';
const unique = (xs) => [...new Set(xs.filter(Boolean).map((x) => String(x)))];

function relatedAudit(st, user) {
  const username = String(user.username || '').toLowerCase();
  return (st.audit || []).filter((entry) => entry.actorId === user.id
    || String(entry.target || '').toLowerCase().includes(username)
    || String(entry.meta?.username || '').toLowerCase() === username);
}

export function makeBanDossier(st, user, { reason = '', actor = null, banAt = nowISO(), banId = '' } = {}) {
  const sessions = (st.sessions || []).filter((s) => s.userId === user.id);
  const visitors = (st.visitors || []).filter((v) => v.userId === user.id);
  const ips = unique([
    user.lastIp,
    ...sessions.map((s) => s.ip),
    ...visitors.map((v) => v.ip),
  ]);
  const visitorTokens = unique([
    user.visitorToken,
    ...(user.visitorTokens || []),
    ...visitors.map((v) => v.token),
  ]);
  const orders = (st.orders || []).filter((o) => o.userId === user.id);
  const tickets = (st.tickets || []).filter((t) => t.userId === user.id);
  const supportMessages = (st.supportMessages || []).filter((m) => m.userId === user.id);
  const dossier = {
    dossierVersion: 1,
    generatedAt: nowISO(),
    banAt,
    banId,
    reason: String(reason || '').slice(0, 500),
    bannedBy: actor ? { id: actor.id || null, username: actor.username || '', role: actor.role || '' } : null,
    registration: {
      id: user.id,
      username: user.username || '',
      name: user.name || '',
      nameEn: user.nameEn || '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role || 'user',
      createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null,
      loginCount: user.loginCount || 0,
      status: user.status || 'active',
    },
    accountSnapshot: {
      wallet: user.wallet || { balance: 0, transactions: [] },
      addresses: user.addresses || [],
      plus: user.plus || {},
      points: user.points || 0,
      wishlist: user.wishlist || [],
      compare: user.compare || [],
      preferences: user.prefs || {},
      kyc: { status: user.kycStatus || 'none', message: user.kycMessage || '', docs: user.kycDocs || null },
    },
    ipAddresses: ips,
    visitorTokens,
    orders,
    supportTickets: tickets,
    supportMessages,
    auditLogs: (st.audit || []).slice(),
    relatedAuditLogs: relatedAudit(st, user),
  };
  const dir = path.join(DATA_DIR, 'bans');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = String(banAt).replace(/[^0-9]/g, '').slice(0, 17) || String(Date.now());
  const base = `archive-${cleanName(user.id)}-${stamp}`;
  const jsonName = `${base}.json`;
  const mdName = `${base}.md`;
  fs.writeFileSync(path.join(dir, jsonName), JSON.stringify(dossier, null, 2), 'utf8');
  const markdown = [
    `# پروندهٔ مسدودسازی ${user.username || user.id}`,
    '',
    `- زمان مسدودسازی: ${banAt}`,
    `- دلیل: ${dossier.reason || '—'}`,
    `- ثبت‌کننده: ${actor?.username || 'سامانه'}`,
    `- شناسه کاربر: ${user.id}`,
    '',
    '## ثبت‌نام',
    '```json', JSON.stringify(dossier.registration, null, 2), '```',
    '',
    `## IPها (${ips.length})`,
    ...ips.map((ip) => `- ${ip}`),
    '',
    `## توکن‌های بازدید (${visitorTokens.length})`,
    ...visitorTokens.map((token) => `- ${token}`),
    '',
    `## سفارش‌ها (${orders.length})`,
    '```json', JSON.stringify(orders, null, 2), '```',
    '',
    `## تیکت‌های پشتیبانی (${tickets.length})`,
    '```json', JSON.stringify(tickets, null, 2), '```',
    '',
    `## گزارش رویدادها (${dossier.auditLogs.length})`,
    '```json', JSON.stringify(dossier.auditLogs, null, 2), '```',
  ].join('\n');
  fs.writeFileSync(path.join(dir, mdName), markdown, 'utf8');
  return { jsonName, mdName, generatedAt: dossier.generatedAt, dossier };
}

export function listBanDossiers() {
  const dir = path.join(DATA_DIR, 'bans');
  try {
    return fs.readdirSync(dir)
      .filter((name) => /^archive-[a-zA-Z0-9_-]+-\d+\.(json|md)$/.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { name, type: name.endsWith('.md') ? 'markdown' : 'json', size: stat.size, updatedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

export function readBanDossier(name) {
  if (!/^archive-[a-zA-Z0-9_-]+-\d+\.(json|md)$/.test(String(name || ''))) return null;
  const file = path.join(DATA_DIR, 'bans', name);
  try { return fs.readFileSync(file); } catch { return null; }
}
