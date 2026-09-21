/**
 * Password hashing (node:crypto scrypt) and bearer-token sessions
 * persisted in db.sessions [{token, userId, role, createdAt}].
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PublicUser, Session, User } from './types';
import type { Store } from './db';
import { HttpError, nowISO, randomHex } from './util';

const KEY_LEN = 64;

/** Hash "password" as scrypt$<saltHex>$<hashHex> with a random 16-byte salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(password, salt, expected.length || KEY_LEN);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function publicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, name: u.name, role: u.role, phone: u.phone };
}

export function createSession(store: Store, userId: string, role: Session['role']): string {
  const token = randomBytes(32).toString('hex');
  store.db.sessions.push({ token, userId, role, createdAt: nowISO() });
  store.touch();
  return token;
}

function getBearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function userFromToken(store: Store, token: string) {
  const session = store.db.sessions.find((s) => s.token === token);
  if (!session) return null;
  const user = store.db.users.find((u) => u.id === session.userId);
  return user ?? null;
}

/** No header → null; header present but token invalid/user gone → 401. */
export function optionalUser(store: Store, req: Request) {
  const token = getBearer(req);
  if (!token) return null;
  const user = userFromToken(store, token);
  if (!user) throw new HttpError(401, 'نشست نامعتبر است؛ دوباره وارد شوید');
  return user;
}

/** Auth required. */
export function requireUser(store: Store, req: Request) {
  const user = optionalUser(store, req);
  if (!user) throw new HttpError(401, 'برای این کار باید وارد حساب شوید');
  return user;
}

/** Admin (owner|staff) required. */
export function requireAdmin(store: Store, req: Request) {
  const user = requireUser(store, req);
  if (user.role !== 'owner' && user.role !== 'staff') {
    throw new HttpError(403, 'دسترسی غیرمجاز');
  }
  return user;
}

export { randomHex };
