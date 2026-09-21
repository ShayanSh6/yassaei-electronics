/** Auth routes: register / login / me. */
import type { User } from '../types';
import type { Store } from '../db';
import { createSession, hashPassword, publicUser, requireUser, verifyPassword } from '../auth';
import { HttpError, json, nowISO, readJson, randomHex, requireStr, str } from '../util';

interface RegisterBody {
  name?: unknown;
  username?: unknown;
  phone?: unknown;
  password?: unknown;
}

export async function register(store: Store, req: Request): Promise<Response> {
  const body = (await readJson(req)) as RegisterBody;

  const name = requireStr(body.name, 'نام باید حداقل ۲ حرف باشد', 2);
  const username = requireStr(body.username, 'نام کاربری باید حداقل ۳ حرف باشد', 3);
  const phone = requireStr(body.phone, 'شماره تماس الزامی است');
  const password = str(body.password);
  if (password.length < 4) throw new HttpError(400, 'رمز عبور باید حداقل ۴ حرف باشد');

  const usernameTaken = store.db.users.some(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (usernameTaken) throw new HttpError(400, 'نام کاربری قبلاً ثبت شده است');

  const user: User = {
    id: `u-${randomHex(6)}`,
    username,
    name,
    role: 'customer',
    phone,
    passwordHash: hashPassword(password),
    createdAt: nowISO(),
    lastLoginAt: nowISO(),
  };

  const token = store.transaction((db) => {
    db.users.push(user);
    const t = randomHex(32);
    db.sessions.push({ token: t, userId: user.id, role: user.role, createdAt: nowISO() });
    return t;
  });

  return json({ token, user: publicUser(user) }, 201);
}

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

export async function login(store: Store, req: Request): Promise<Response> {
  const body = (await readJson(req)) as LoginBody;
  const username = str(body.username).trim();
  const password = str(body.password);

  const user = store.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, 'نام کاربری یا رمز عبور اشتباه است');
  }

  user.lastLoginAt = nowISO();
  const token = createSession(store, user.id, user.role);
  return json({ token, user: publicUser(user) });
}

export function me(store: Store, req: Request): Response {
  const user = requireUser(store, req);
  return json({ user: publicUser(user) });
}
