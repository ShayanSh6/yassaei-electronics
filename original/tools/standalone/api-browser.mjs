// ─────────────────────────────────────────────────────────────
//  نسخهٔ تک‌فایلی: بک‌اند داخل مرورگر (جایگزین lib/api.mjs)
//  همهٔ داده‌ها از window.__SEED می‌آید و در localStorage ذخیره می‌شود.
// ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code || 'error');
    this.status = status; this.code = code; this.details = details;
  }
}
export function getCookie() { return ''; }

const EN_MESSAGES = {
  login_required: 'Please sign in to continue.', store_asleep: 'The store is temporarily turned off.',
  unauthorized: 'Authentication failed.', forbidden: 'You do not have access to this section.',
  not_found: 'Not found.', product_not_found: 'Product not found.', order_not_found: 'Order not found.',
  invalid_credentials: 'Incorrect username or password.', invalid_code: 'The verification code is not valid.',
  invalid_phone: 'Invalid mobile number.', weak_password: 'Password is too weak.',
  stock_limit: 'Not enough stock for this quantity.', empty_cart: 'Your cart is empty.',
  insufficient_balance: 'Wallet balance is not enough.', account_exists: 'This account already exists.',
  username_taken: 'This username is already taken.', terms_required: 'You must accept the terms and conditions.',
  rules_required: 'You must accept the ticket rules.', address_required: 'Please add a shipping address first.',
  already_submitted: 'You have already submitted this.', product_unavailable: 'One of the items in your cart is no longer available.',
  cannot_cancel: 'This order cannot be cancelled in its current state.', disabled: 'This feature is currently disabled.',
};

let busy = 0;
const listeners = new Set();
export function onLoading(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setLoading(v) { busy = Math.max(0, busy + (v ? 1 : -1)); for (const fn of listeners) { try { fn(busy > 0); } catch { /* noop */ } } }

// ── پایگاه دادهٔ محلی ────────────────────────────────────────
const LS_DB = 'ys_stand_db_v2', LS_SESSION = 'ys_stand_session';
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
const nowISO = () => new Date().toISOString();
function freshDB() { return JSON.parse(JSON.stringify(window.__SEED)); }
let DB = null;
try { const s = localStorage.getItem(LS_DB); DB = s ? JSON.parse(s) : freshDB(); } catch { DB = freshDB(); }
if (!DB || !DB.products) DB = freshDB();
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_DB, JSON.stringify(DB)); } catch { /* noop */ } }, 250); }
let SESSION = null;
try { SESSION = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch { SESSION = null; }
function setSession(s) { SESSION = s; try { s ? localStorage.setItem(LS_SESSION, JSON.stringify(s)) : localStorage.removeItem(LS_SESSION); } catch { /* noop */ } }
const me = () => (SESSION?.userId ? DB.users.find((u) => u.id === SESSION.userId) || null : null);
const isStaff = () => { const u = me(); return u && (u.role === 'owner' || u.role === 'staff'); };
const err = (status, code, message) => { throw { __http: true, status, code, message }; };

// ── کپچای آفلاین «من ربات نیستم» (نسخهٔ محلی، بدون سرویس بیرونی) ──
const CAPS = new Map();
const CAPTOKS = new Map();
const capOn = () => DB.settings?.features?.captcha !== false;
function capSvg(a, b, mul) {
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fd = (n) => String(n).replace(/\d/g, (d) => FA[+d]);
  const expr = `${fd(a)} ${mul ? '×' : '+'} ${fd(b)} = ؟`;
  let noise = '';
  for (let i = 0; i < 5; i++) noise += `<line x1="${(Math.random() * 150).toFixed(1)}" y1="${(3 + Math.random() * 54).toFixed(1)}" x2="${(Math.random() * 150).toFixed(1)}" y2="${(3 + Math.random() * 54).toFixed(1)}" stroke="hsl(${Math.floor(Math.random() * 360)} 65% 62% / .45)" stroke-width="1.1"/>`;
  const chars = [...expr].map((ch, i) => `<text x="${13 + i * 15}" y="${38 + Math.round(Math.random() * 9 - 4)}" transform="rotate(${(Math.random() * 26 - 13).toFixed(1)} ${13 + i * 15} 38)" font-size="20" font-weight="800" fill="currentColor">${ch === ' ' ? '&#160;' : ch}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 60" width="150" height="60" role="img">${noise}${chars}</svg>`;
}
function needCap(token) {
  if (!capOn()) return;
  const t = CAPTOKS.get(String(token || ''));
  if (!t || t.exp < Date.now() || t.uses >= 2) err(400, 'captcha_required', 'اول تأیید کن که ربات نیستی.');
  t.uses++;
  if (t.uses >= 2) CAPTOKS.delete(String(token));
}
const A = (s) => (window.__ASSETS && window.__ASSETS[s]) || s;
const fix = (s) => String(s ?? '').replace(/\/assets\/[A-Za-z0-9_\/.-]+/g, (m) => A(m));
const fixObj = (o) => {
  if (typeof o === 'string') return fix(o);
  if (Array.isArray(o)) return o.map(fixObj);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = fixObj(o[k]); return r; }
  return o;
};
const norm = (s) => String(s || '').toLowerCase().replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک').replace(/[ً-ٰٟ]/g, '').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();
function audit(type, detail) { DB.audit = DB.audit || []; DB.audit.unshift({ id: uid('aud'), at: nowISO(), userId: me()?.id || null, userName: me()?.name || 'مهمان', type, detail: detail || '', ip: 'local' }); if (DB.audit.length > 600) DB.audit.length = 600; }
function mePayload(u) {
  if (!u) return null;
  const { password, pass, ...rest } = u;
  return fixObj({ ...rest, addresses: u.addresses || [], wallet: u.wallet || { balance: 0, transactions: [] }, plus: u.plus || { active: false }, wishlist: u.wishlist || [], compare: u.compare || [], alerts: u.alerts || [] });
}
const pubProduct = (p, full = false) => fixObj({ id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, nameEn: p.nameEn, brand: p.brand, brandName: p.brandName, categoryId: p.categoryId, price: p.price, oldPrice: p.oldPrice || 0, cost: full ? p.cost : undefined, stock: p.stock, reserved: p.reserved || 0, sold: p.sold || 0, images: p.images || [], desc: p.desc, descEn: p.descEn, specs: p.specs || [], tags: p.tags || [], active: p.active !== false, rating: p.rating || 0, ratingCount: p.ratingCount || 0, createdAt: p.createdAt, warranty: p.warranty, highlight: p.highlight });
function cartOf() {
  const u = me();
  const key = u ? u.id : (SESSION?.guestId || (SESSION = { ...SESSION, guestId: uid('g') }, setSession(SESSION), SESSION.guestId));
  let c = DB.carts.find((x) => (u ? x.userId === u.id : x.guestId === key && !x.userId));
  if (!c) { c = { id: uid('cart'), userId: u ? u.id : null, guestId: u ? null : key, items: [], coupon: null, updatedAt: nowISO() }; DB.carts.push(c); }
  return c;
}
function couponOk(cp, subtotal) {
  if (!cp || cp.active === false) return null;
  if (cp.startAt && nowISO() < cp.startAt) return null;
  if (cp.endAt && nowISO() > cp.endAt) return null;
  if (cp.usageLimit && (cp.used || 0) >= cp.usageLimit) return null;
  if (subtotal < (cp.minOrder || 0)) return null;
  return cp;
}
function quote(b) {
  const c = cartOf();
  if (!c.items.length) err(400, 'empty_cart', 'سبد خرید خالی است.');
  const u = me();
  const plus = !!(u?.plus?.active);
  let subtotal = 0;
  for (const it of c.items) { const p = DB.products.find((x) => x.id === it.productId); if (!p) err(400, 'product_unavailable', 'کالایی در سبد موجود نیست.'); subtotal += p.price * it.qty; }
  let plusDiscount = plus ? Math.round(subtotal * ((DB.settings.plus?.discountPct || 2) / 100)) : 0;
  const cp = couponOk(DB.coupons.find((x) => x.code === c.coupon), subtotal);
  let couponDiscount = 0;
  if (cp) { couponDiscount = cp.type === 'percent' ? Math.round((subtotal - plusDiscount) * cp.value / 100) : cp.value; if (cp.maxDiscount) couponDiscount = Math.min(couponDiscount, cp.maxDiscount); couponDiscount = Math.min(couponDiscount, subtotal - plusDiscount); }
  const sh = DB.settings.shipping || {};
  const delivery = b?.delivery || 'courier';
  let shipping = 0, shippingLabel = delivery === 'pickup' ? 'تحویل حضوری' : 'ارسال پستی';
  if (delivery === 'courier') {
    const zone = (sh.zones || []).find((z) => z.id === (b?.zone || 'city')) || (sh.zones || [])[0] || { fee: 0, name: 'شهر' };
    shipping = Number(zone.fee || 0);
    shippingLabel = `ارسال به ${zone.name || zone.nameEn || ''}`;
    const freeOver = Number.isFinite(Number(sh.freeOver)) ? Number(sh.freeOver) : 0;
    if (freeOver > 0 && subtotal - plusDiscount - couponDiscount >= freeOver) { shipping = 0; shippingLabel += ' — رایگان'; }
    if (b?.express) { shipping += Number(sh.expressFee || 0); shippingLabel += ' + فوری'; }
  }
  let insurance = 0;
  if (b?.insurance && delivery === 'courier') insurance = plus && DB.settings.plus?.autoInsurance ? 0 : Math.round((subtotal) * ((sh.insurancePct || 1.5) / 100));
  const total = Math.max(0, subtotal - plusDiscount - couponDiscount + shipping + insurance);
  return fixObj({ subtotal, plusDiscount, couponDiscount, discount: plusDiscount + couponDiscount, shipping, shippingLabel, insurance, total, payable: total, freeOver: sh.freeOver || 0, plus, coupon: cp ? cp.code : '' });
}
function pushNotif(n) { DB.notifications = DB.notifications || []; DB.notifications.unshift(fixObj({ id: uid('ntf'), at: nowISO(), read: false, ...n })); }

// ── مسیریابی ────────────────────────────────────────────────
function route(method, path, q, body) {
  const P = path.replace(/\/+$/, '');
  const seg = P.split('/').filter(Boolean);
  const guest = !me();
  // سیستم
  if (P === '/api/system/status') return { ok: true, sleeping: !!DB.meta?.sleeping, since: DB.meta?.sleepSince || null, by: DB.meta?.sleepBy || '', uptime: 1, time: nowISO() };
  if (P === '/api/system/sleep' && method === 'POST') { if (!isStaff()) err(403, 'forbidden'); DB.meta = { ...(DB.meta || {}), sleeping: true, sleepSince: nowISO(), sleepBy: me().username, autoWakeAt: null }; audit('system.sleep'); save(); return { ok: true, sleeping: true }; }
  if (P === '/api/system/wake' && method === 'POST') { if (!isStaff()) err(403, 'forbidden'); DB.meta = { ...(DB.meta || {}), sleeping: false, sleepSince: null }; audit('system.wake'); pushNotif({ type: 'system', level: 'success', title: 'فروشگاه روشن شد', body: 'خرید دوباره فعال است.', link: '#/' }); save(); return { ok: true, sleeping: false }; }
  if (DB.meta?.sleeping && method !== 'GET' && !P.startsWith('/api/auth') && !P.startsWith('/api/admin') && !P.startsWith('/api/system')) err(503, 'store_asleep', 'فروشگاه موقتاً خاموش است.');
  // بوت‌استرپ و کاتالوگ
  if (P === '/api/bootstrap') return fixObj({ ok: true, settings: DB.settings, categories: DB.categories, brands: DB.brands, ticker: DB.settings.store?.ticker || [], payMethods: (DB.settings.orders?.payMethods || [{ id: 'gateway' }, { id: 'cod' }, { id: 'wallet' }]), sleeping: !!DB.meta?.sleeping, sleepSince: DB.meta?.sleepSince || null, me: mePayload(me()) });
  if (P === '/api/categories') return fixObj({ ok: true, items: DB.categories });
  if (P === '/api/brands') return fixObj({ ok: true, items: DB.brands });
  if (P === '/api/stats/public') {
    if (DB.settings.features?.publicStats === false) return { ok: true, stats: null };
    return fixObj({ ok: true, stats: { products: DB.products.filter((p) => p.active !== false).length, categories: DB.categories.length, brands: DB.brands.length, ordersToday: DB.orders.filter((o) => (o.createdAt || '').slice(0, 10) === nowISO().slice(0, 10)).length, ordersTotal: (DB.settings.stats?.baseOrders || 200) + DB.orders.length, visitsToday: 12 + DB.orders.length, pending: DB.orders.filter((o) => ['pending_payment', 'pending_review', 'confirmed', 'preparing'].includes(o.status)).length } });
  }
  if (seg[1] === 'pages' && seg[2]) return fixObj({ ok: true, page: DB.pages[seg[2]] || null });
  if (P === '/api/scan' && method === 'POST') { const p = DB.products.find((x) => x.barcode === body?.code || x.sku === body?.code || x.id === body?.code); if (!p) return { ok: false, found: false, code: 'not_found', message: 'کالایی با این بارکد پیدا نشد.' }; return { ok: true, found: true, product: pubProduct(p, isStaff()) }; }
  if (P === '/api/search/image' && method === 'POST') return { ok: true, items: [] };
  if (seg[1] === 'search') { const list = productQuery({ q: q.get('q') || '' }); return fixObj({ ok: true, ...list, didYouMean: '' }); }
  if (seg[1] === 'products' && seg[2] && method === 'GET') {
    const p = DB.products.find((x) => x.id === seg[2]);
    if (!p) err(404, 'product_not_found');
    const reviews = fixObj(DB.reviews.filter((r) => r.productId === p.id && r.status === 'approved'));
    return fixObj({ ok: true, product: pubProduct(p), reviews, related: pubList(productQuery({ cat: p.categoryId, limit: 8 })).items.filter((x) => x.id !== p.id) });
  }
  if (seg[1] === 'products' && method === 'GET') return fixObj({ ok: true, ...pubList(productQuery(Object.fromEntries(q))) });
  // احراز هویت
  if (P === '/api/auth/login' && method === 'POST') {
    const id = norm(body?.identifier);
    const u = DB.users.find((x) => norm(x.username) === id || norm(x.phone || '') === id || norm(x.email || '') === id);
    if (!u || (u.password || '') !== String(body?.password || '')) err(401, 'invalid_credentials', EN_MESSAGES.invalid_credentials);
    if (u.blocked) err(403, 'account_blocked', 'حساب مسدود است.');
    setSession({ userId: u.id }); audit('auth.login'); save();
    return fixObj({ ok: true, me: mePayload(u) });
  }
  if (P === '/api/auth/logout' && method === 'POST') { setSession(null); return { ok: true }; }
  if (P === '/api/captcha' && method === 'GET') {
    if (!capOn()) return { ok: true, disabled: true };
    const mul = Math.random() < 0.35;
    const a = 2 + Math.floor(Math.random() * 8);
    const b = mul ? 2 + Math.floor(Math.random() * 6) : 2 + Math.floor(Math.random() * 8);
    const id = uid('cap');
    CAPS.set(id, { ans: mul ? a * b : a + b, exp: Date.now() + 300000 });
    return { ok: true, id, svg: capSvg(a, b, mul) };
  }
  if (P === '/api/captcha/verify' && method === 'POST') {
    const c = CAPS.get(String(body?.id || ''));
    const FA = '۰۱۲۳۴۵۶۷۸۹';
    const got = String(body?.answer ?? '').replace(/[۰-۹]/g, (x) => String(FA.indexOf(x))).replace(/[^\d-]/g, '');
    if (!c || c.exp < Date.now()) err(400, 'captcha_expired', 'کپچا منقضی شد.');
    CAPS.delete(String(body.id));
    if (got === '' || Number(got) !== c.ans) err(400, 'captcha_invalid', 'جواب درست نیست.');
    const token = uid('captok');
    CAPTOKS.set(token, { exp: Date.now() + 300000, uses: 0 });
    return { ok: true, token };
  }
  if (P === '/api/auth/register' && method === 'POST') {
    needCap(body?.captchaToken);
    if (DB.users.some((x) => x.username === body?.username)) err(409, 'username_taken');
    const u = { id: uid('u'), username: body.username, name: body.name || body.username, phone: body.phone || '', email: body.email || '', password: body.password || '', role: 'user', wallet: { balance: 0, transactions: [] }, plus: { active: false }, addresses: [], wishlist: [], compare: [], alerts: [], notifications: [], notificationsPrefs: { marketing: true }, createdAt: nowISO() };
    DB.users.push(u); setSession({ userId: u.id }); audit('auth.register'); save();
    return fixObj({ ok: true, me: mePayload(u) });
  }
  if (P === '/api/auth/otp/send' && method === 'POST') { needCap(body?.captchaToken); return { ok: true, devCode: '123456', channel: 'sms' }; }
  if (P === '/api/auth/login/otp' && method === 'POST') {
    if (String(body?.code) !== '123456') err(400, 'invalid_code');
    let u = DB.users.find((x) => (x.phone || '') === String(body?.phone || ''));
    if (!u) { u = { id: uid('u'), username: String(body.phone), name: 'کاربر جدید', phone: String(body.phone), email: '', password: uid('pw'), role: 'user', wallet: { balance: 0, transactions: [] }, plus: { active: false }, addresses: [], wishlist: [], compare: [], alerts: [], notificationsPrefs: {}, createdAt: nowISO() }; DB.users.push(u); }
    setSession({ userId: u.id }); save(); return fixObj({ ok: true, me: mePayload(u) });
  }
  if (P.startsWith('/api/auth/')) return { ok: true };
  // من
  if (P === '/api/me' && method === 'GET') { const u = me(); if (!u) err(401, 'login_required'); return fixObj({ ok: true, me: mePayload(u) }); }
  if (P === '/api/me' && method === 'PATCH') { const u = me(); if (!u) err(401, 'login_required'); Object.assign(u, pick(body, ['name', 'email', 'notificationsPrefs'])); save(); return fixObj({ ok: true, me: mePayload(u) }); }
  if (P === '/api/me' && method === 'DELETE') { setSession(null); return { ok: true }; }
  if (P === '/api/me/export') return fixObj({ ok: true, data: { user: mePayload(me()), orders: myOrders() } });
  if (P === '/api/me/password' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); if (u.password !== body?.current) err(400, 'invalid_credentials'); u.password = body.next || u.password; u.mustChangePassword = false; save(); return { ok: true }; }
  if (P === '/api/me/2fa') return { ok: true, enabled: false, methods: [] };
  if (P === '/api/me/2fa/enable' || P === '/api/me/2fa/disable') return { ok: true };
  if (P === '/api/me/sessions') return { ok: true, items: [{ id: 's1', current: true, device: 'همین مرورگر', at: nowISO() }] };
  if (P === '/api/me/sessions/revoke') return { ok: true };
  if (P === '/api/me/addresses' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); const a = { id: uid('adr'), ...pick(body, ['title', 'receiver', 'phone', 'province', 'city', 'zone', 'street', 'postal', 'note']), isDefault: !!body?.isDefault, createdAt: nowISO() }; u.addresses = u.addresses || []; u.addresses.push(a); save(); return fixObj({ ok: true, addresses: u.addresses }); }
  if (seg[2] === 'me' && seg[3] === 'addresses' && seg[4]) {
    const u = me(); if (!u) err(401, 'login_required');
    const a = (u.addresses || []).find((x) => x.id === seg[4]); if (!a) err(404, 'not_found');
    if (method === 'PATCH') Object.assign(a, pick(body, ['title', 'receiver', 'phone', 'province', 'city', 'zone', 'street', 'postal', 'note', 'isDefault']));
    if (method === 'DELETE') u.addresses = u.addresses.filter((x) => x.id !== seg[4]);
    save(); return fixObj({ ok: true, addresses: u.addresses });
  }
  if (P === '/api/me/wallet') { const u = me(); if (!u) err(401, 'login_required'); return fixObj({ ok: true, wallet: u.wallet || { balance: 0, transactions: [] } }); }
  if (P === '/api/me/wallet/deposit' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); const amt = Math.max(1000, Number(body?.amount) || 0); u.wallet = u.wallet || { balance: 0, transactions: [] }; u.wallet.balance += amt; u.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'deposit', amount: amt, status: 'done', note: 'شارژ کیف پول (نسخهٔ محلی)' }); save(); return fixObj({ ok: true, wallet: u.wallet }); }
  if (P === '/api/me/plus/subscribe' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); const fee = Number(DB.settings.plus?.fee || 149000); if (body?.method === 'wallet') { if ((u.wallet?.balance || 0) < fee) err(400, 'insufficient_balance'); u.wallet.balance -= fee; } u.plus = { active: true, startedAt: nowISO(), until: new Date(Date.now() + 30 * 864e5).toISOString(), method: body?.method || 'gateway' }; save(); return fixObj({ ok: true, me: mePayload(u) }); }
  if (P === '/api/me/notifications') { const u = me(); if (!u) err(401, 'login_required'); const items = fixObj((DB.notifications || []).filter((n) => !n.userId || n.userId === u.id)); return { ok: true, items }; }
  if (P === '/api/me/notifications/read' && method === 'POST') { const u = me(); (DB.notifications || []).forEach((n) => { if (!n.userId || n.userId === u?.id) n.read = true; }); save(); return { ok: true }; }
  if (seg[2] === 'me' && seg[3] === 'wishlist' || (seg[2] === 'me' && seg[3] === 'compare') || (seg[2] === 'me' && seg[3] === 'alerts')) {
    const u = me(); if (!u) err(401, 'login_required');
    const kind = seg[3]; const pid = seg[4];
    u[kind] = u[kind] || [];
    if (method === 'POST') { if (u[kind].includes(pid)) u[kind] = u[kind].filter((x) => x !== pid); else u[kind].push(pid); }
    if (method === 'DELETE') u[kind] = u[kind].filter((x) => x !== pid);
    save(); return fixObj({ ok: true, [kind]: u[kind] });
  }
  // سبد و پرداخت
  if (P === '/api/cart' && method === 'GET') { const c = cartOf(); return fixObj({ ok: true, cart: cartData(c), guestId: SESSION?.guestId || '', quote: { plus: !!me()?.plus?.active, freeOver: DB.settings.shipping?.freeOver } }); }
  if (P === '/api/cart/add' && method === 'POST') { const c = cartOf(); const p = DB.products.find((x) => x.id === body?.productId); if (!p) err(404, 'product_not_found'); const qty = Math.max(1, Number(body?.qty) || 1); const it = c.items.find((x) => x.productId === p.id); if (it) it.qty = Math.min(p.stock || 99, it.qty + qty); else c.items.push({ productId: p.id, qty: Math.min(p.stock || 99, qty) }); save(); return fixObj({ ok: true, cart: cartData(c) }); }
  if (P === '/api/cart/item' && method === 'PATCH') { const c = cartOf(); const it = c.items.find((x) => x.productId === body?.productId); if (it) it.qty = Math.max(1, Number(body?.qty) || 1); save(); return fixObj({ ok: true, cart: cartData(c) }); }
  if (seg[1] === 'cart' && seg[2] === 'item' && seg[3] && method === 'DELETE') { const c = cartOf(); c.items = c.items.filter((x) => x.productId !== seg[3]); save(); return fixObj({ ok: true, cart: cartData(c) }); }
  if (P === '/api/cart/clear' && method === 'POST') { const c = cartOf(); c.items = []; c.coupon = null; save(); return fixObj({ ok: true, cart: cartData(c) }); }
  if (P === '/api/cart/coupon' && method === 'POST') { const c = cartOf(); const code = String(body?.code || '').trim(); if (!code) { c.coupon = null; save(); return fixObj({ ok: true, cart: cartData(c) }); } const cp = DB.coupons.find((x) => x.code.toLowerCase() === code.toLowerCase()); if (!couponOk(cp, c.items.reduce((s, i) => s + (DB.products.find((p) => p.id === i.productId)?.price || 0) * i.qty, 0))) err(400, 'invalid_code', 'کد تخفیف معتبر نیست.'); c.coupon = cp.code; save(); return fixObj({ ok: true, cart: cartData(c) }); }
  if (P === '/api/checkout/quote' && method === 'POST') return fixObj({ ok: true, quote: quote(body) });
  if (P === '/api/checkout' && method === 'POST') {
    if (!body?.acceptTerms) err(400, 'terms_required');
    const u = me(); const q2 = quote(body); const c = cartOf();
    const pay = body?.paymentMethod || 'gateway';
    if (pay === 'wallet' && (u?.wallet?.balance || 0) < q2.total) err(400, 'insufficient_balance');
    const lines = c.items.map((it) => { const p = DB.products.find((x) => x.id === it.productId); return { productId: p.id, name: p.name, nameEn: p.nameEn, image: A(p.images?.[0] || ''), price: p.price, qty: it.qty, brand: p.brandName, sku: p.sku }; });
    for (const it of c.items) { const p = DB.products.find((x) => x.id === it.productId); p.stock = Math.max(0, (p.stock || 0) - it.qty); p.sold = (p.sold || 0) + it.qty; }
    const order = fixObj({ id: uid('ord'), code: `BM-${nowISO().slice(0, 10).replace(/-/g, '')}-${String(DB.orders.length + 1).padStart(4, '0')}`, userId: u?.id || null, guestId: u ? null : SESSION?.guestId, userName: u?.name || body?.guestName || 'مهمان', userPhone: u?.phone || body?.guestPhone || '', isGuest: !u, items: lines, subtotal: q2.subtotal, plusDiscount: q2.plusDiscount, couponDiscount: q2.couponDiscount, couponCode: c.coupon || '', discount: q2.discount, shipping: q2.shipping, shippingLabel: q2.shippingLabel, insurance: q2.insurance, total: q2.total, delivery: body?.delivery || 'courier', zone: body?.zone || 'city', express: !!body?.express, note: body?.note || '', address: u ? (u.addresses || []).find((a) => a.id === body?.addressId) || (u.addresses || [])[0] || null : { title: 'تحویل حضوری', receiver: body?.guestName || 'مهمان', phone: body?.guestPhone || '' }, payment: { method: pay, status: pay === 'wallet' ? 'paid' : pay === 'cod' ? 'pending' : 'unpaid', paidAt: pay === 'wallet' ? nowISO() : null }, status: pay === 'wallet' ? 'confirmed' : pay === 'cod' ? 'pending_review' : 'pending_payment', timeline: [{ at: nowISO(), status: 'created', label: 'ثبت سفارش' }], createdAt: nowISO() });
    if (pay === 'wallet' && u) { u.wallet.balance -= q2.total; u.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'purchase', amount: -q2.total, status: 'done', note: 'پرداخت سفارش' }); }
    DB.orders.unshift(order); c.items = []; c.coupon = null;
    audit('order.create', order.code); save();
    return fixObj({ ok: true, order, needsPayment: order.payment.status === 'unpaid', paymentMethod: pay, me: mePayload(me()) });
  }
  if (seg[1] === 'payments' && seg[2] === 'simulate' && method === 'POST') {
    const o = DB.orders.find((x) => x.id === seg[3]); if (!o) err(404, 'order_not_found');
    if (body?.success === false) { o.payment.status = 'failed'; o.status = 'cancelled'; } else { o.payment.status = 'paid'; o.payment.paidAt = nowISO(); if (o.status === 'pending_payment') { o.status = 'confirmed'; o.timeline.push({ at: nowISO(), status: 'confirmed', label: 'پرداخت موفق' }); } }
    save(); return fixObj({ ok: true, order: o });
  }
  // سفارش‌ها
  if (P === '/api/me/orders') { return fixObj({ ok: true, items: myOrders() }); }
  if (seg[2] === 'me' && seg[3] === 'orders' && seg[4] && seg[5] === 'cancel' && method === 'POST') {
    const o = myOrders().find((x) => x.id === seg[4]); if (!o) err(404, 'order_not_found');
    if (!['pending_payment', 'pending_review', 'confirmed'].includes(o.status)) err(400, 'cannot_cancel');
    o.status = 'cancelled'; o.payment.status = o.payment.status === 'paid' ? 'refunded' : o.payment.status;
    o.timeline.push({ at: nowISO(), status: 'cancelled', label: 'لغو شد' }); save();
    return fixObj({ ok: true, order: o });
  }
  if (seg[2] === 'me' && seg[3] === 'orders' && seg[4]) { const o = myOrders().find((x) => x.id === seg[4]); if (!o) err(404, 'order_not_found'); return fixObj({ ok: true, order: o }); }
  // نظر / تیکت / پشتیبانی / بازخورد
  if (P === '/api/reviews' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); if (DB.reviews.some((r) => r.productId === body?.productId && r.userId === u.id && r.type === (body?.type || 'review'))) err(409, 'already_submitted'); const r = fixObj({ id: uid('rev'), productId: body.productId, productName: DB.products.find((p) => p.id === body.productId)?.name || '', userId: u.id, userName: u.name, type: body?.type || 'review', rating: Number(body?.rating) || 0, title: body?.title || '', body: body?.body || '', status: 'pending', likes: 0, createdAt: nowISO() }); DB.reviews.unshift(r); save(); return { ok: true, review: r }; }
  if (seg[1] === 'reviews' && seg[2] && seg[3] === 'like' && method === 'POST') { const r = DB.reviews.find((x) => x.id === seg[2]); if (r) r.likes = (r.likes || 0) + 1; save(); return { ok: true, likes: r?.likes || 0 }; }
  if (P === '/api/tickets' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); if (!body?.rulesAccepted) err(400, 'rules_required'); const t = fixObj({ id: uid('tk'), code: `TK-${1000 + DB.tickets.length + 1}`, userId: u.id, userName: u.name, subject: body?.subject || '', category: body?.category || 'other', priority: body?.priority || 'normal', status: 'open', messages: [{ id: uid('msg'), from: 'user', body: body?.body || '', at: nowISO() }], createdAt: nowISO() }); DB.tickets.unshift(t); save(); return { ok: true, ticket: t }; }
  if (P === '/api/tickets' && method === 'GET') { const u = me(); if (!u) err(401, 'login_required'); return fixObj({ ok: true, items: DB.tickets.filter((t) => t.userId === u.id) }); }
  if (seg[1] === 'tickets' && seg[2] && method === 'GET') { const t = DB.tickets.find((x) => x.id === seg[2]); if (!t) err(404, 'not_found'); return fixObj({ ok: true, ticket: t }); }
  if (seg[1] === 'tickets' && seg[2] && seg[3] === 'messages' && method === 'POST') { const t = DB.tickets.find((x) => x.id === seg[2]); if (!t) err(404, 'not_found'); t.messages.push({ id: uid('msg'), from: 'user', body: body?.body || '', at: nowISO() }); t.status = 'open'; save(); return fixObj({ ok: true, ticket: t }); }
  if (seg[1] === 'tickets' && seg[2] && seg[3] === 'close' && method === 'POST') { const t = DB.tickets.find((x) => x.id === seg[2]); if (t) t.status = 'closed'; save(); return { ok: true }; }
  if (P === '/api/support/messages' && method === 'GET') { const u = me(); return fixObj({ ok: true, items: (DB.supportMessages || []).filter((m) => m.userId === u?.id) }); }
  if (P === '/api/support/messages' && method === 'POST') { const u = me(); if (!u) err(401, 'login_required'); const m = fixObj({ id: uid('chat'), userId: u.id, userName: u.name, from: 'user', body: body?.body || '', at: nowISO(), readByStaff: false }); DB.supportMessages = DB.supportMessages || []; DB.supportMessages.push(m); save(); return { ok: true, message: m }; }
  if (P === '/api/feedback' && method === 'POST') { const u = me(); if (!u) needCap(body?.captchaToken); const f = fixObj({ id: uid('fb'), userId: u?.id || null, userName: u?.name || 'مهمان', type: body?.type || 'suggestion', title: body?.title || '', body: body?.body || '', contact: body?.contact || '', page: body?.page || '', status: 'new', createdAt: nowISO() }); DB.feedback = DB.feedback || []; DB.feedback.unshift(f); save(); return { ok: true, feedback: f }; }
  if (P === '/api/visits' && method === 'POST') return { ok: true };
  // ── پنل مدیر ──
  if (seg[1] === 'admin') {
    if (!isStaff()) err(403, 'forbidden', EN_MESSAGES.forbidden);
    const rest = seg.slice(2).join('/');
    if (rest === 'overview') return fixObj({ ok: true, kpi: { orders: DB.orders.length, revenue: DB.orders.filter((o) => o.payment.status === 'paid').reduce((s, o) => s + o.total, 0), users: DB.users.length, products: DB.products.length, pendingOrders: DB.orders.filter((o) => o.status === 'pending_review').length, lowStock: DB.products.filter((p) => (p.stock || 0) <= 3).length }, awaiting: { orders: DB.orders.filter((o) => o.status === 'pending_review').length, reviews: DB.reviews.filter((r) => r.status === 'pending').length, tickets: DB.tickets.filter((t) => t.status === 'open').length, feedback: (DB.feedback || []).filter((f) => f.status === 'new').length, support: (DB.supportMessages || []).filter((m) => !m.readByStaff).length }, recentOrders: DB.orders.slice(0, 6), chart: Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10); return { date: d, label: d, visits: 40 + ((i * 37) % 60) + DB.orders.filter((o) => (o.createdAt || '').slice(0, 10) === d).length * 9, orders: DB.orders.filter((o) => (o.createdAt || '').slice(0, 10) === d).length }; }) });
    if (rest === 'products' && method === 'GET') return fixObj({ ok: true, items: DB.products.map((p) => pubProduct(p, true)), total: DB.products.length });
    if (rest === 'products' && method === 'POST') { const p = { id: uid('prd'), sku: body?.sku || `BM-${1000 + DB.products.length}`, barcode: body?.barcode || '', name: body?.name || 'کالای جدید', nameEn: body?.nameEn || '', brand: body?.brand || '', brandName: (DB.brands.find((b) => b.id === body?.brand) || {}).name || 'متفرقه', categoryId: body?.categoryId || (DB.categories[0] || {}).id, price: Number(body?.price) || 0, oldPrice: Number(body?.oldPrice) || 0, cost: Number(body?.cost) || 0, stock: Number(body?.stock) || 0, images: body?.images || ['/assets/img/products/p001.svg'], desc: body?.desc || '', descEn: body?.descEn || '', specs: body?.specs || [], active: body?.active !== false, rating: 0, ratingCount: 0, createdAt: nowISO() }; DB.products.unshift(p); audit('product.create', p.name); save(); return fixObj({ ok: true, product: pubProduct(p, true) }); }
    if (seg[2] === 'products' && seg[3] && method === 'GET') { const p = DB.products.find((x) => x.id === seg[3]); if (!p) err(404, 'product_not_found'); return fixObj({ ok: true, product: pubProduct(p, true) }); }
    if (seg[2] === 'products' && seg[3] && method === 'PATCH') { const p = DB.products.find((x) => x.id === seg[3]); if (!p) err(404, 'product_not_found'); Object.assign(p, pick(body, ['name', 'nameEn', 'price', 'oldPrice', 'cost', 'stock', 'categoryId', 'brand', 'brandName', 'desc', 'descEn', 'specs', 'images', 'active', 'sku', 'barcode', 'warranty', 'highlight', 'tags'])); audit('product.edit', p.name); save(); return fixObj({ ok: true, product: pubProduct(p, true) }); }
    if (seg[2] === 'products' && seg[3] && method === 'DELETE') { DB.products = DB.products.filter((x) => x.id !== seg[3]); audit('product.delete', seg[3]); save(); return { ok: true }; }
    if (rest === 'categories' && method === 'GET') return fixObj({ ok: true, items: DB.categories.map((c) => ({ ...c, productCount: DB.products.filter((p) => p.categoryId === c.id).length })) });
    if (rest === 'categories' && method === 'POST') { const c = { id: body?.id || uid('cat'), name: body?.name || '', nameEn: body?.nameEn || '', icon: body?.icon || 'box', active: body?.active !== false, order: DB.categories.length + 1 }; DB.categories.push(c); save(); return fixObj({ ok: true, category: c }); }
    if (seg[2] === 'categories' && seg[3] && method === 'PATCH') { const c = DB.categories.find((x) => x.id === seg[3]); if (c) Object.assign(c, pick(body, ['name', 'nameEn', 'icon', 'active', 'order'])); save(); return fixObj({ ok: true, category: c }); }
    if (rest === 'brands' && method === 'POST') { const b = { id: uid('br'), name: body?.name || '', nameEn: body?.nameEn || '', country: body?.country || '' }; DB.brands.push(b); save(); return fixObj({ ok: true, brand: b }); }
    if (seg[2] === 'brands' && seg[3] && method === 'PATCH') { const b = DB.brands.find((x) => x.id === seg[3]); if (b) Object.assign(b, pick(body, ['name', 'nameEn', 'country'])); save(); return fixObj({ ok: true, brand: b }); }
    if (rest === 'orders' && method === 'GET') { const st = q.get('status'); return fixObj({ ok: true, items: st ? DB.orders.filter((o) => o.status === st) : DB.orders, total: DB.orders.length }); }
    if (seg[2] === 'orders' && seg[3] && method === 'PATCH') { const o = DB.orders.find((x) => x.id === seg[3]); if (!o) err(404, 'order_not_found'); if (body?.status) { o.status = body.status; o.timeline = o.timeline || []; o.timeline.push({ at: nowISO(), status: body.status, label: body.status }); } if (body?.tracking) o.tracking = body.tracking; if (body?.note !== undefined) o.adminNote = body.note; audit('order.status', `${o.code} → ${o.status}`); save(); return fixObj({ ok: true, order: o }); }
    if (rest === 'reviews' && method === 'GET') return fixObj({ ok: true, items: DB.reviews.map((r) => ({ ...r, productName: r.productName || DB.products.find((p) => p.id === r.productId)?.name || '' })) });
    if (seg[2] === 'reviews' && seg[3] && method === 'PATCH') { const r = DB.reviews.find((x) => x.id === seg[3]); if (!r) err(404, 'not_found'); if (body?.status) r.status = body.status; if (body?.reply !== undefined) r.reply = body.reply; audit('review.moderate', r.status); save(); return fixObj({ ok: true, review: r }); }
    if (rest === 'tickets' && method === 'GET') return fixObj({ ok: true, items: DB.tickets });
    if (seg[2] === 'tickets' && seg[3] && method === 'GET') { const t = DB.tickets.find((x) => x.id === seg[3]); if (!t) err(404, 'not_found'); return fixObj({ ok: true, ticket: t }); }
    if (seg[2] === 'tickets' && seg[3] && method === 'PATCH') { const t = DB.tickets.find((x) => x.id === seg[3]); if (!t) err(404, 'not_found'); if (body?.status) t.status = body.status; if (body?.priority) t.priority = body.priority; if (body?.body) t.messages.push({ id: uid('msg'), from: 'staff', body: body.body, at: nowISO() }); save(); return fixObj({ ok: true, ticket: t }); }
    if (rest === 'support' && method === 'GET') { const th = {}; for (const m of (DB.supportMessages || [])) { (th[m.userId] = th[m.userId] || { userId: m.userId, userName: m.userName, messages: [], lastAt: '' }).messages.push(m); th[m.userId].lastAt = m.at; } return fixObj({ ok: true, items: Object.values(th) }); }
    if (seg[2] === 'support' && seg[3] && method === 'POST') { const m = fixObj({ id: uid('chat'), userId: seg[3], userName: 'پشتیبانی', from: 'staff', body: body?.body || '', at: nowISO() }); DB.supportMessages = DB.supportMessages || []; DB.supportMessages.push(m); save(); return { ok: true, message: m }; }
    if (rest === 'feedback' && method === 'GET') return fixObj({ ok: true, items: DB.feedback || [] });
    if (seg[2] === 'feedback' && seg[3] && method === 'PATCH') { const f = (DB.feedback || []).find((x) => x.id === seg[3]); if (f) Object.assign(f, pick(body, ['status', 'answer'])); save(); return fixObj({ ok: true, feedback: f }); }
    if (rest === 'users' && method === 'GET') return fixObj({ ok: true, items: DB.users.map((u) => mePayload(u)) });
    if (seg[2] === 'users' && seg[3] && method === 'PATCH') { const u = DB.users.find((x) => x.id === seg[3]); if (!u) err(404, 'not_found'); if (body?.role) u.role = body.role; if (body?.blocked !== undefined) u.blocked = body.blocked; if (body?.perms) u.perms = body.perms; if (Number(body?.walletAdjust)) { u.wallet = u.wallet || { balance: 0, transactions: [] }; u.wallet.balance += Number(body.walletAdjust); u.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'adjust', amount: Number(body.walletAdjust), status: 'done', note: body?.walletReason || 'تنظیم توسط مدیر' }); } save(); return fixObj({ ok: true, user: mePayload(u) }); }
    if (rest === 'coupons' && method === 'GET') return fixObj({ ok: true, items: DB.coupons });
    if (rest === 'coupons' && method === 'POST') { const c = { id: uid('cpn'), code: (body?.code || '').toUpperCase(), type: body?.type || 'percent', value: Number(body?.value) || 0, maxDiscount: Number(body?.maxDiscount) || 0, minOrder: Number(body?.minOrder) || 0, usageLimit: Number(body?.usageLimit) || 0, used: 0, perUser: Number(body?.perUser) || 1, active: body?.active !== false, startAt: body?.startAt || '', endAt: body?.endAt || '', note: body?.note || '' }; DB.coupons.push(c); save(); return fixObj({ ok: true, coupon: c }); }
    if (seg[2] === 'coupons' && seg[3] && method === 'PATCH') { const c = DB.coupons.find((x) => x.id === seg[3]); if (c) Object.assign(c, pick(body, ['code', 'type', 'value', 'maxDiscount', 'minOrder', 'usageLimit', 'perUser', 'active', 'startAt', 'endAt', 'note'])); save(); return fixObj({ ok: true, coupon: c }); }
    if (rest === 'ads' && method === 'GET') return fixObj({ ok: true, items: DB.ads });
    if (rest === 'ads' && method === 'POST') { const a = { id: uid('ad'), slot: body?.slot || 'home_strip', title: body?.title || '', titleEn: body?.titleEn || '', text: body?.text || '', textEn: body?.textEn || '', link: body?.link || '', cta: body?.cta || '', ctaEn: body?.ctaEn || '', image: body?.image || '', active: body?.active !== false, startAt: '', endAt: '' }; DB.ads.push(a); save(); return fixObj({ ok: true, ad: a }); }
    if (seg[2] === 'ads' && seg[3] && method === 'PATCH') { const a = DB.ads.find((x) => x.id === seg[3]); if (a) Object.assign(a, pick(body, ['slot', 'title', 'titleEn', 'text', 'textEn', 'link', 'cta', 'ctaEn', 'image', 'active'])); save(); return fixObj({ ok: true, ad: a }); }
    if (rest === 'notifications' && method === 'GET') return fixObj({ ok: true, items: DB.notifications || [] });
    if (rest === 'notifications' && method === 'POST') { pushNotif({ userId: body?.userId || null, title: body?.title || '', titleEn: body?.titleEn || '', body: body?.body || '', bodyEn: body?.bodyEn || '', link: body?.link || '', level: body?.level || 'info', type: body?.type || 'news' }); save(); return { ok: true }; }
    if (rest === 'settings' && method === 'GET') return fixObj({ ok: true, settings: DB.settings });
    if (seg[2] === 'settings' && seg[3] && method === 'PATCH') { const patch = body?.value && typeof body.value === 'object' ? body.value : body; DB.settings[seg[3]] = { ...(DB.settings[seg[3]] || {}), ...patch }; audit('settings.edit', seg[3]); save(); return fixObj({ ok: true, section: seg[3], value: DB.settings[seg[3]] }); }
    if (rest === 'pages' && method === 'GET') return fixObj({ ok: true, pages: DB.pages });
    if (seg[2] === 'pages' && seg[3] && method === 'PATCH') { const p = DB.pages[seg[3]]; if (p === undefined) err(404, 'not_found'); if (Array.isArray(p)) { if (Array.isArray(body?.items)) DB.pages[seg[3]] = body.items; else if (Array.isArray(body)) DB.pages[seg[3]] = body; } else DB.pages[seg[3]] = { ...p, ...body }; save(); return fixObj({ ok: true, page: DB.pages[seg[3]] }); }
    if (rest === 'lotteries' && method === 'GET') return fixObj({ ok: true, items: (DB.lotteries || []).map(l => ({ id: l.id, title: l.title, prize: l.prize, endsAt: l.endsAt, status: l.status, winners: (l.winners || []).map(w => w.name), entries: (l.manual || []).length, myEntry: me() ? (l.manual || []).includes(me().id) : false })), enabled: DB.settings?.features?.lottery !== false });
    if (seg[1] === 'lotteries' && seg[3] === 'join' && method === 'POST') { const u = me(); if (!u) err(401, 'unauthorized'); const l = (DB.lotteries || []).find(x => x.id === seg[2]); if (!l || l.status !== 'active') err(400, 'not_active', 'این قرعه‌کشی فعال نیست.'); l.manual = l.manual || []; if (l.manual.includes(u.id)) err(409, 'joined', 'قبلاً شرکت کرده‌اید.'); l.manual.push(u.id); audit('lottery.join', l.title); save(); return fixObj({ ok: true, entries: l.manual.length }); }
    if (rest === 'audit') return fixObj({ ok: true, items: DB.audit || [] });
    if (rest === 'stats') return fixObj({ ok: true, days: [4, 6, 5, 8, 7, 9, 10].map((v, i) => ({ date: nowISO().slice(0, 10), orders: v, visits: v * 13 })), totals: { orders: DB.orders.length, revenue: DB.orders.filter((o) => o.payment.status === 'paid').reduce((s, o) => s + o.total, 0) } });
    if (rest === 'barcode' && method === 'GET') return fixObj({ ok: true, items: (DB.barcodeLog || []).slice(0, 30) });
    if (rest === 'barcode/generate' && method === 'POST') return fixObj({ ok: true, barcode: DB.products.find((p) => p.id === body?.productId)?.barcode || '6260000000001' });
    if (rest === 'barcode/scan-log' && method === 'POST') { DB.barcodeLog = DB.barcodeLog || []; DB.barcodeLog.unshift({ id: uid('sc'), at: nowISO(), code: body?.code || '', by: me()?.name || '' }); save(); return { ok: true }; }
    if (rest === 'image-index' && method === 'GET') return { ok: true, items: [], indexed: 0 };
    if (rest === 'image-index' && method === 'POST') return { ok: true, indexed: 0 };
    if (rest === 'find-image' || rest === 'fetch-image') return { ok: false, code: 'offline', message: 'جست‌وجوی تصویر در نسخهٔ محلی/آفلاین در دسترس نیست.', results: [] };
    if (rest === 'backup' && method === 'POST') { try { localStorage.setItem('ys_stand_backup', JSON.stringify(DB)); } catch { /* noop */ } return { ok: true, file: 'local-backup' }; }
    if (rest === 'maintenance/cleanup' && method === 'POST') return { ok: true, removed: 0 };
    if (seg[2] === 'export' || rest.startsWith('export/')) return fixObj({ ok: true, data: DB });
    err(404, 'not_found');
  }
  err(404, 'not_found', `مسیر پیدا نشد: ${path}`);
}
function pick(o, keys) { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; }
function myOrders() { const u = me(); return fixObj(u ? DB.orders.filter((o) => o.userId === u.id) : DB.orders.filter((o) => !o.userId && o.guestId === SESSION?.guestId)); }
function productQuery(qq) {
  let items = DB.products.filter((p) => p.active !== false);
  const s = norm(qq.q);
  if (s) items = items.filter((p) => norm(p.name).includes(s) || norm(p.nameEn).includes(s) || norm(p.brandName).includes(s) || (p.tags || []).some((t) => norm(t).includes(s)));
  if (qq.cat) items = items.filter((p) => p.categoryId === qq.cat);
  if (qq.brand) items = items.filter((p) => p.brand === qq.brand || p.brandName === qq.brand);
  if (qq.ids) { const set = String(qq.ids).split(',').filter(Boolean); if (set.length) items = items.filter((p) => set.includes(p.id)); }
  if (qq.inStock === '1' || qq.inStock === 'true') items = items.filter((p) => (p.stock || 0) > 0);
  if (qq.discount === '1') items = items.filter((p) => (p.oldPrice || 0) > p.price);
  if (qq.min) items = items.filter((p) => p.price >= Number(qq.min));
  if (qq.max) items = items.filter((p) => p.price <= Number(qq.max));
  const sort = qq.sort || 'newest';
  if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
  else if (sort === 'popular') items.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  else if (sort === 'discount') items.sort((a, b) => disc(b) - disc(a));
  else items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const limit = Math.min(96, Number(qq.limit) || 24);
  const page = Math.max(1, Number(qq.page) || 1);
  const total = items.length;
  return { items: items.slice((page - 1) * limit, page * limit), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
const disc = (p) => (p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
function pubList(r) { return { ...r, items: r.items.map((p) => pubProduct(p)) }; }
function cartData(c) {
  const items = c.items.map((it) => { const p = DB.products.find((x) => x.id === it.productId); return fixObj({ productId: it.productId, qty: it.qty, name: p?.name || '', nameEn: p?.nameEn || '', image: A(p?.images?.[0] || ''), price: p?.price || 0, stock: p?.stock || 0, brandName: p?.brandName || '' }); });
  return { items, coupon: c.coupon || '', count: items.reduce((s, i) => s + i.qty, 0), subtotal: items.reduce((s, i) => s + i.price * i.qty, 0) };
}

// ── رابط api (هم‌شکل با نسخهٔ اصلی) ─────────────────────────
export const withQuery = (path, params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
};
async function request(method, path) {
  setLoading(true);
  await new Promise((r) => setTimeout(r, 40));
  try {
    const [p, qs] = String(path).split('?');
    const q = new URLSearchParams(qs || '');
    const body = arguments[2];
    const out = route(method, p, q, body || {});
    return out;
  } catch (e) {
    if (e && e.__http) throw new ApiError(e.status, e.code, e.message);
    throw e;
  } finally { setLoading(false); }
}
export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  put: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p),
  url: withQuery,
};
export function errorMessage(e) {
  const code = e?.code || '';
  return e?.message || EN_MESSAGES[code] || 'خطایی رخ داد. دوباره تلاش کن.';
}
export function errorEn(e) { return EN_MESSAGES[e?.code || ''] || e?.message || 'Something went wrong.'; }
// برای آزمون‌ها
if (typeof window !== 'undefined') window.__STANDALONE_API = { api, route, getDB: () => DB, reset: () => { DB = freshDB(); save(); } };
