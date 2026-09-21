/** Shop routes: cart validation, coupons, orders (guest or authed), reviews. */
import type { Coupon, Order, OrderItem, ShippingMethod, PaymentMethod } from '../types';
import type { Store } from '../db';
import { optionalUser, requireUser } from '../auth';
import {
  HttpError,
  int,
  json,
  nowISO,
  num,
  randomHex,
  readJson,
  requireStr,
  str,
} from '../util';

export const PEYK_COST = 80_000;
export const POST_COST = 120_000;
export const FREE_POST_THRESHOLD = 2_000_000;

const SHIPPING_METHODS: ShippingMethod[] = ['post', 'peyk', 'pickup'];
const PAYMENT_METHODS: PaymentMethod[] = ['online', 'cod'];

interface RawItem {
  id?: unknown;
  qty?: unknown;
}

function parseItems(body: { items?: unknown }): Array<{ id: string; qty: number }> {
  if (!Array.isArray(body.items)) throw new HttpError(400, 'لیست اقلام نامعتبر است');
  const items: Array<{ id: string; qty: number }> = [];
  for (const raw of body.items as Array<Record<string, unknown>>) {
    if (raw === null || typeof raw !== 'object') continue;
    const id = str((raw as RawItem).id).trim();
    if (!id) continue;
    const qty = Math.max(1, int((raw as RawItem).qty) ?? 1);
    items.push({ id, qty });
  }
  return items;
}

/* ---------- cart ---------- */

export async function cartValidate(store: Store, req: Request): Promise<Response> {
  const body = await readJson(req);
  const requested = parseItems(body);

  const items = [];
  let subtotal = 0;
  for (const { id, qty } of requested) {
    const p = store.db.products.find((x) => x.id === id);
    if (!p || p.active === false) continue; // drop unknown / inactive
    const clampedQty = Math.max(0, Math.min(qty, p.stock));
    subtotal += p.price * clampedQty;
    items.push({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      qty: clampedQty,
      image: p.images[0] ?? '',
      active: true,
    });
  }
  return json({ items, subtotal });
}

/* ---------- coupons ---------- */

export function findCoupon(db: { coupons: Coupon[] }, code: string): Coupon | null {
  const normalized = code.trim().toUpperCase();
  return db.coupons.find((c) => c.code.toUpperCase() === normalized) ?? null;
}

export function couponDiscount(coupon: Coupon, subtotal: number): number {
  return coupon.type === 'percent'
    ? Math.floor((subtotal * coupon.value) / 100)
    : Math.min(coupon.value, subtotal);
}

/** Shared validation used by /api/coupon/validate and order creation. */
export function validateCoupon(
  store: Store,
  codeRaw: unknown,
  subtotal: number,
): { coupon: Coupon; discount: number } {
  const code = str(codeRaw).trim();
  if (!code) throw new HttpError(400, 'کد تخفیف را وارد کنید');
  const coupon = findCoupon(store.db, code);
  if (!coupon || coupon.active === false) throw new HttpError(400, 'کد تخفیف نامعتبر است');
  if (subtotal < coupon.minSubtotal) {
    throw new HttpError(
      400,
      `این کد تخفیف برای سبد خرید بالای ${coupon.minSubtotal.toLocaleString('fa-IR')} تومان است`,
    );
  }
  return { coupon, discount: couponDiscount(coupon, subtotal) };
}

export async function couponValidate(store: Store, req: Request): Promise<Response> {
  const body = await readJson(req);
  const subtotal = num(body.subtotal);
  if (subtotal === undefined || subtotal < 0) throw new HttpError(400, 'مبلغ سبد نامعتبر است');
  const { coupon, discount } = validateCoupon(store, body.code, subtotal);
  return json({
    ok: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
  });
}

/* ---------- orders ---------- */

function nextOrderId(db: { orders: Order[] }): { id: string; code: string } {
  let max = 0;
  for (const o of db.orders) {
    const m = /^o-(\d+)$/.exec(o.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = max + 1;
  return { id: `o-${String(n).padStart(4, '0')}`, code: `YS-${String(n).padStart(5, '0')}` };
}

export function shippingCostFor(shipping: ShippingMethod, subtotal: number): number {
  if (shipping === 'pickup') return 0;
  if (shipping === 'peyk') return PEYK_COST;
  return subtotal >= FREE_POST_THRESHOLD ? 0 : POST_COST; // post
}

export async function createOrder(store: Store, req: Request): Promise<Response> {
  // Bearer optional → guest orders allowed; a *bad* token is still rejected.
  const user = optionalUser(store, req);
  const body = await readJson(req);

  const requested = parseItems(body);

  const customerRaw = (body.customer ?? {}) as Record<string, unknown>;
  const customer = {
    name: requireStr(customerRaw.name, 'نام و نام خانوادگی الزامی است', 2),
    phone: requireStr(customerRaw.phone, 'شماره تماس الزامی است'),
    address: requireStr(customerRaw.address, 'آدرس تحویل الزامی است'),
    ...(str(customerRaw.note).trim() ? { note: str(customerRaw.note).trim() } : {}),
  };

  const shipping = str(body.shipping).trim() as ShippingMethod;
  if (!SHIPPING_METHODS.includes(shipping)) throw new HttpError(400, 'روش ارسال نامعتبر است');
  const payment = str(body.payment).trim() as PaymentMethod;
  if (!PAYMENT_METHODS.includes(payment)) throw new HttpError(400, 'روش پرداخت نامعتبر است');

  // Snapshot items + verify stock inside one transaction (rollback on failure).
  const order = store.transaction<Order>((db) => {
    if (requested.length === 0) throw new HttpError(400, 'سبد سفارش خالی است');

    const items: OrderItem[] = [];
    let subtotal = 0;
    for (const { id, qty } of requested) {
      const p = db.products.find((x) => x.id === id);
      if (!p || p.active === false) throw new HttpError(400, `محصول ${id} در فروشگاه موجود نیست`);
      if (qty > p.stock) {
        throw new HttpError(400, `موجودی «${p.name}» کافی نیست (موجودی: ${p.stock})`);
      }
      items.push({ id: p.id, name: p.name, price: p.price, qty, image: p.images[0] ?? '' });
      subtotal += p.price * qty;
    }

    let discount = 0;
    let usedCouponCode: string | null = null;
    if (body.couponCode !== undefined && str(body.couponCode).trim() !== '') {
      const { coupon, discount: d } = validateCoupon(store, body.couponCode, subtotal);
      discount = d;
      usedCouponCode = coupon.code;
    }

    const shippingCost = shippingCostFor(shipping, subtotal);
    const total = subtotal - discount + shippingCost;
    const { id, code } = nextOrderId(db);

    for (const item of items) {
      const p = db.products.find((x) => x.id === item.id);
      if (!p) throw new HttpError(400, `محصول ${item.id} در فروشگاه موجود نیست`);
      p.stock -= item.qty;
      p.sold += item.qty;
      p.updatedAt = nowISO();
    }

    const o: Order = {
      id,
      code,
      items,
      subtotal,
      discount,
      shippingCost,
      total,
      status: 'pending',
      customer,
      shipping,
      payment,
      createdAt: nowISO(),
      userId: user ? user.id : null,
      couponCode: usedCouponCode,
    };
    db.orders.push(o);
    return o;
  });

  return json({ order }, 201);
}

export function listMyOrders(store: Store, req: Request): Response {
  const user = requireUser(store, req);
  const orders = store.db.orders
    .filter((o) => o.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return json(orders);
}

export function getOrder(store: Store, req: Request, id: string): Response {
  const order = store.db.orders.find((o) => o.id === id || o.code === id.toUpperCase());
  if (!order) throw new HttpError(404, 'سفارش یافت نشد');
  // Guest orders (userId === null) are viewable by anyone holding the id/code;
  // customer orders require the owner themselves or an admin.
  if (order.userId !== null) {
    const user = requireUser(store, req);
    const isAdmin = user.role === 'owner' || user.role === 'staff';
    if (!isAdmin && order.userId !== user.id) throw new HttpError(403, 'دسترسی غیرمجاز');
  }
  return json({ order });
}

/* ---------- reviews ---------- */

export async function createReview(store: Store, req: Request): Promise<Response> {
  const user = requireUser(store, req);
  const body = await readJson(req);

  const productId = str(body.productId).trim();
  const rating = int(body.rating);
  const comment = str(body.comment).trim();

  if (!productId) throw new HttpError(400, 'شناسهٔ محصول الزامی است');
  if (rating === undefined || rating < 1 || rating > 5) {
    throw new HttpError(400, 'امتیاز باید بین ۱ تا ۵ باشد');
  }
  if (!comment) throw new HttpError(400, 'متن نظر الزامی است');

  const review = store.transaction((db) => {
    const product = db.products.find((p) => p.id === productId || p.sku === productId.toUpperCase());
    if (!product) throw new HttpError(404, 'محصول یافت نشد');

    const r = {
      id: `rv-${randomHex(6)}`,
      productId: product.id,
      userId: user.id,
      userName: user.name,
      rating,
      comment,
      createdAt: nowISO(),
    };
    db.reviews.push(r);

    const productReviews = db.reviews.filter((x) => x.productId === product.id);
    product.ratingCount = productReviews.length;
    product.ratingAvg =
      Math.round(
        (productReviews.reduce((sum, x) => sum + x.rating, 0) / productReviews.length) * 10,
      ) / 10;
    product.updatedAt = nowISO();
    return r;
  });

  return json({ review }, 201);
}
