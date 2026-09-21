import { sendSms, smsConfigured } from './lib/sms.mjs';
import { sendMail, mailConfigured } from './lib/mail.mjs';
import { tgNotifyOrder, tgNotifyTicket } from './lib/telegram.mjs';
// ─────────────────────────────────────────────────────────────
//  API فروشگاه: سبد خرید، پرداخت، سفارش، نظرات، تیکت، پشتیبانی
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, logAudit, publicProduct, pushNotification, broadcast, sseAdd, statusInfo, makeOrderCode, publicNotification, getAutoReply, notifyReply, dayKey } from './lib/helpers.mjs';
import { V, badRequest, conflict, forbidden, notFound, nowISO, randomToken, uid, HttpError, toLatinDigits } from './lib/util.mjs';
import { sendJson } from './lib/http.mjs';
import { requireCaptcha } from './lib/captcha.mjs';
import { kycConfig, kycRequirement } from './lib/kyc.mjs';
import { ROOT, UPLOAD_DIR } from './lib/db.mjs';
import { invalidateSearchIndex } from './api-catalog.mjs';
import { mePayload } from './api-auth.mjs';

/** اعلان چندکاناله به مدیران (تلگرام + پیامک + ایمیل) — هر کانال مستقل و بی‌صدا در خطا */
function notifyAdmins(type, data = {}) {
  try {
    const st = db.raw;
    const store = st.settings?.store || {};
    const owner = (st.users || []).find((u) => u.role === 'owner') || {};
    const adminPhone = store.phone2 || store.phone || owner.phone || '';
    const adminEmail = store.email || owner.email || '';
    const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
    let subject = '', text = '';
    if (type === 'order') {
      const order = data.order;
      if (!order) return;
      tgNotifyOrder(order).catch(() => {});
      subject = `سفارش جدید ${order.code}`;
      text = `🔔 سفارش جدید ${order.code}\nمشتری: ${order.userName || 'مهمان'}${order.userPhone ? ` (${order.userPhone})` : ''}\nاقلام: ${(order.items || []).length}\nمبلغ: ${fa(order.total)} تومان\nتحویل: ${order.delivery === 'pickup' ? 'حضوری' : 'ارسال'}`;
    } else if (type === 'ticket') {
      const ticket = data.ticket;
      if (!ticket) return;
      const message = String(data.message || '');
      tgNotifyTicket(ticket, message).catch(() => {});
      const isNew = (ticket.messages || []).length <= 1;
      subject = isNew ? `تیکت جدید ${ticket.code}: ${ticket.subject || ''}` : `پاسخ کاربر در تیکت ${ticket.code}`;
      text = `🎫 ${subject}\nکاربر: ${ticket.userName || ''}${ticket.userPhone ? ` (${ticket.userPhone})` : ''}\nاولویت: ${ticket.priority || 'normal'}${message ? `\n\n${message.slice(0, 500)}` : ''}`;
    } else {
      return;
    }
    if (adminPhone && smsConfigured()) {
      Promise.resolve().then(() => sendSms(adminPhone, text)).catch(() => {});
    }
    if (adminEmail && mailConfigured()) {
      Promise.resolve().then(() => sendMail({ to: adminEmail, subject, body: text })).catch(() => {});
    }
  } catch {
    // اعلان هرگز نباید جریان اصلی را متوقف کند
  }
}

const MAX_UPLOAD = 4 * 1024 * 1024;
const DEFAULT_ORDER_CEILING = 100000000;
const DEFAULT_CEILING_HOURS = 48;
const orderCeilingMessage = (amount) => {
  const n = Number(amount) || DEFAULT_ORDER_CEILING;
  const label = n === DEFAULT_ORDER_CEILING ? '۱۰۰ میلیون تومان' : `${n.toLocaleString('fa-IR')} تومان`;
  return `سقف مجاز خرید (${label}) رعایت نشده است. لطفاً جهت خریدهای عمده با پشتیبانی تماس بگیرید.`;
};

// ── سقف خرید غلتان ۴۸ ساعته (فقط خریدهای «موفق») ─────────────────
// اصل اساسی: هیچ‌کس به‌خاطر رسیدن به سقف یا تست کردن، مسدود یا محروم نمی‌شود.
//  • pastSpent = مجموع سفارش‌های موفق (payment.status === 'paid') در بازهٔ غلتان
//  • سفارش‌های پرداخت‌نشده، در انتظار، لغوشده یا مرجوعشده هرگز شمرده نمی‌شوند
//  • سهمیهٔ باقی‌مانده = orderCeilingAmount − pastSpent
// همهٔ مقادیر از پنل مدیریت (settings.orders) خوانده می‌شود.
export function rollingCeilingCfg(ordersSettings = {}) {
  return {
    enabled: ordersSettings.orderCeilingEnabled !== false,
    amount: Number(ordersSettings.orderCeilingAmount) > 0 ? Number(ordersSettings.orderCeilingAmount) : DEFAULT_ORDER_CEILING,
    hours: Number(ordersSettings.orderCeilingHours) > 0 ? Number(ordersSettings.orderCeilingHours) : DEFAULT_CEILING_HOURS,
  };
}

/** مجموع خریدهای موفق کاربر/مهمان در بازهٔ غلتان — فقط سفارش‌های پرداخت‌شده */
export function rollingPastSpent(st, { userId, guestId, hours }) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return (st.orders || []).filter((o) => {
    if (!o || o.payment?.status !== 'paid') return false;                       // فقط موفق/پرداخت‌شده
    if (['cancelled', 'refunded', 'returned'].includes(o.status)) return false; // لغو/مرجوع هرگز
    const t = new Date(o.payment?.paidAt || o.createdAt || 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;                        // فقط داخل بازهٔ غلتان
    if (userId) return o.userId === userId;
    return !o.userId && !!guestId && o.guestId === guestId;
  }).reduce((sum, o) => sum + Number(o.total || 0), 0);
}

/** وضعیت لحظه‌ای سقف برای کلاینت (checkout/cart) — خروجی سبک و عمومی */
export function ceilingStatus(st, { userId, guestId }) {
  const cfg = rollingCeilingCfg(st.settings?.orders || {});
  if (!cfg.enabled) return { enabled: false, amount: cfg.amount, hours: cfg.hours, pastSpent: 0, remaining: cfg.amount };
  const pastSpent = rollingPastSpent(st, { userId, guestId, hours: cfg.hours });
  return {
    enabled: true,
    amount: cfg.amount,
    hours: cfg.hours,
    pastSpent,
    remaining: Math.max(0, cfg.amount - pastSpent),
  };
}

/** پیام فارسی محترمانهٔ سقف — دقیقاً همان قالب توافق‌شده */
export function ceilingMessage({ hours, amount, pastSpent, remaining }) {
  const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
  return `سقف مجاز خرید در هر ${fa(hours)} ساعت ${fa(amount)} تومان است. مجموع خریدهای موفق شما در این بازه: ${fa(pastSpent)} تومان. شما می‌توانید تا سقف ${fa(remaining)} تومان سفارش ثبت کنید یا پس از پایان بازه مجدداً اقدام فرمایید.`;
}

/** اعمال سقف غلتان هنگام ثبت سفارش — قبل از هر کسر موجودی/کیف پول و در همان تراکنش */
function enforceRollingCeiling(st, { userId, guestId, amount }) {
  const cfg = rollingCeilingCfg(st.settings?.orders || {});
  if (!cfg.enabled) return false;
  const pastSpent = rollingPastSpent(st, { userId, guestId, hours: cfg.hours });
  const remaining = Math.max(0, cfg.amount - pastSpent);
  if (amount > remaining) {
    throw badRequest('order_ceiling', ceilingMessage({ hours: cfg.hours, amount: cfg.amount, pastSpent, remaining }));
  }
  return true;
}
const hashRiskIdentity = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const normalizePayerIdentity = (value) => toLatinDigits(String(value || '')).replace(/[\u200c\s-]/g, '').trim().toUpperCase();

function enforceOrderCeiling(st, { amount, deviceToken, payerIdentity }) {
  const cfg = st.settings?.orders || {};
  if (cfg.orderMaxCeilingEnabled === false) return { deviceTokenHash: '', paymentInstrumentHash: '' };
  const max = Number(cfg.orderMaxAmount) > 0 ? Number(cfg.orderMaxAmount) : DEFAULT_ORDER_CEILING;
  if (amount > max) throw badRequest('purchase_ceiling', orderCeilingMessage(max));
  const deviceTokenHash = deviceToken ? hashRiskIdentity(deviceToken) : '';
  const paymentInstrumentHash = payerIdentity ? hashRiskIdentity(payerIdentity) : '';
  const today = dayKey();
  const comparable = (o) => {
    if (!o || ['cancelled', 'refunded', 'returned'].includes(o.status)) return false;
    if (String(o.createdAt || '').slice(0, 10) !== today) return false;
    return (deviceTokenHash && o.deviceTokenHash === deviceTokenHash)
      || (paymentInstrumentHash && o.paymentInstrumentHash === paymentInstrumentHash);
  };
  const used = (st.orders || []).filter(comparable).reduce((sum, o) => sum + Number(o.total || 0), 0);
  if (used + amount > max) throw badRequest('purchase_ceiling', orderCeilingMessage(max));
  return { deviceTokenHash, paymentInstrumentHash };
}

const ALLOWED_MAGIC = [
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46], extra: 'WEBP' },
  { mime: 'image/gif', ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
];

// ── سبد خرید ───────────────────────────────────────────────
function cartKey(ctx) { return ctx.user ? `u:${ctx.user.id}` : `g:${ctx.cookies['ys_guest'] || ''}`; }

function getCart(ctx, create = false) {
  const state = ctx.state;
  const guestId = ctx.cookies['ys_guest'] || null;
  let cart = state.carts.find((c) => ctx.user ? c.userId === ctx.user.id : c.guestId === guestId && !c.userId);
  
  // Merge guest cart if user just logged in and has an old guest cart
  if (ctx.user && guestId) {
    const gCart = state.carts.find((c) => c.guestId === guestId && !c.userId);
    if (gCart) {
      if (!cart) {
        gCart.userId = ctx.user.id;
        cart = gCart;
      } else {
        // Merge items into user cart
        for (const it of gCart.items) {
          const ex = cart.items.find(x => x.productId === it.productId);
          if (ex) ex.qty = Math.min(99, ex.qty + it.qty);
          else { if (cart.items.length < 50) cart.items.push(it); }
        }
        gCart.items = []; // Empty the guest cart
        cart.updatedAt = nowISO();
      }
    }
  }

  if (!cart && create && (ctx.user || guestId)) {
    cart = { id: uid('cart'), userId: ctx.user?.id || null, guestId: ctx.user ? null : guestId, items: [], coupon: null, updatedAt: nowISO() };
    if (state.carts.length >= 5000) state.carts.shift();
    state.carts.push(cart);
  }

  // Auto-prune products that were deleted or deactivated by admin
  if (cart && cart.items.length) {
    const originalLength = cart.items.length;
    cart.items = cart.items.filter(it => {
      const prod = state.products.find(x => x.id === it.productId);
      return prod && prod.active !== false;
    });
    if (cart.items.length !== originalLength) {
      cart.updatedAt = nowISO();
    }
  }
  return cart;
}

function serializeCart(state, cart, user) {
  const ceiling = ceilingStatus(state, { userId: user?.id || null, guestId: cart?.guestId || null });
  if (!cart) return { items: [], count: 0, subtotal: 0, weight: 0, ceiling };
  const items = [];
  let subtotal = 0; let weight = 0; let count = 0;
  for (const it of cart.items) {
    const p = state.products.find((x) => x.id === it.productId);
    if (!p || p.active === false) continue;
    const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
    const qty = Math.min(it.qty, Math.max(0, available));
    const lineTotal = qty * Number(p.price || 0);
    subtotal += lineTotal;
    weight += qty * (p.weight || 0);
    count += qty;
    items.push({
      productId: p.id, qty, requestedQty: it.qty, available,
      price: p.price, lineTotal,
      product: publicProduct(p, { categories: state.categories, brands: state.brands }),
    });
  }
  return { items, count, subtotal, weight, coupon: cart.coupon || null, ceiling };
}

function plusActive(user) {
  return !!(user?.plus?.active && user?.plus?.until && new Date(user.plus.until) > new Date());
}

export function calcQuote(state, { items, user, delivery, zone, express, insurance, couponCode, guestId }) {
  const s = state.settings;
  const plus = plusActive(user);
  let subtotal = 0;
  const lines = [];
  for (const it of items) {
    const p = state.products.find((x) => x.id === it.productId);
    if (!p) continue;
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    subtotal += Number(p.price || 0) * qty;
    lines.push({ p, qty, lineTotal: Number(p.price || 0) * qty });
  }
  // تخفیف پلاس
  const plusDiscount = plus && s.plus?.discountPct ? Math.round(subtotal * (Number(s.plus.discountPct) / 100)) : 0;

  // کوپن
  let couponDiscount = 0;
  let coupon = null;
  let couponError = '';
  if (couponCode) {
    coupon = state.coupons.find((c) => c.code.toUpperCase() === String(couponCode).toUpperCase());
    if (!coupon || !coupon.active) couponError = 'کد تخفیف معتبر نیست.';
    else if (new Date(coupon.startAt || 0) > new Date()) couponError = 'این کد هنوز فعال نشده است.';
    else if (new Date(coupon.endAt || '2100-01-01') < new Date()) couponError = 'این کد منقضی شده است.';
    else if (subtotal < (coupon.minOrder || 0)) couponError = `حداقل مبلغ سفارش برای این کد ${coupon.minOrder} تومان است.`;
    else if (coupon.used >= (coupon.usageLimit || Infinity)) couponError = 'ظرفیت این کد تمام شده است.';
    else if (user) {
      const usedByUser = state.orders.filter((o) => o.userId === user.id && o.couponCode === coupon.code && o.status !== 'cancelled').length;
      if (usedByUser >= (coupon.perUser || 1)) couponError = 'این کد را قبلاً استفاده کرده‌ای.';
    } else if (guestId) {
      const usedByGuest = state.orders.filter((o) => (!o.userId && o.guestId === guestId) && o.couponCode === coupon.code && o.status !== 'cancelled').length;
      if (usedByGuest >= (coupon.perUser || 1)) couponError = 'این کد را قبلاً استفاده کرده‌ای.';
    }
    if (coupon && user && coupon.onlyPlus && !plus) couponError = 'این کد فقط برای اعضای پلاس است.';
    if (!couponError) {
      const base = subtotal - plusDiscount;
      couponDiscount = coupon.type === 'percent'
        ? Math.min(Math.round(base * (coupon.value / 100)), coupon.maxDiscount || Infinity)
        : Math.min(coupon.value, base);
    } else coupon = null;
  }

  const goodsValue = Math.max(0, subtotal - plusDiscount - couponDiscount);

  // ارسال
  let shipping = 0;
  let shippingLabel = '';
  if (delivery === 'pickup') { shipping = 0; shippingLabel = 'تحویل حضوری (رایگان)'; }
  else {
    const zones = s.shipping?.zones || [];
    const z = zones.find((x) => x.id === zone) || zones[zones.length - 1] || { fee: s.shipping?.courierBase || 0, name: 'ارسال' };
    shipping = Number(z.fee || 0);
    shippingLabel = z.name || 'ارسال';
    if (express && s.shipping?.expressEnabled) {
      const fee = Number(s.shipping.expressFee || 0);
      shipping += plus ? Math.round(fee * (1 - (Number(s.plus.expressDiscountPct || 0) / 100))) : fee;
      shippingLabel += ' — فوری';
    }
    const freeOver = plus
      ? Number(s.plus?.freeShippingMin ?? 0)
      : (s.shipping?.freeOver === undefined || s.shipping?.freeOver === null ? Infinity : Number(s.shipping.freeOver));
    if (Number.isFinite(freeOver) && goodsValue >= freeOver) { shipping = 0; shippingLabel += ' (رایگان)'; }
  }

  // بیمه
  let insuranceFee = 0;
  let insured = false;
  if (delivery !== 'pickup') {
    if (plus && s.plus?.autoInsurance) { insured = true; insuranceFee = 0; }
    else if (insurance && s.features?.insurance !== false) {
      insured = true;
      insuranceFee = Math.max(Number(s.shipping?.insuranceMin || 0), Math.round(goodsValue * (Number(s.shipping?.insuranceRatePct || 0) / 100)));
    }
  }

  const total = Math.max(0, goodsValue + shipping + insuranceFee);
  return {
    lines, subtotal, plusDiscount, couponDiscount, coupon, couponError,
    goodsValue, shipping, shippingLabel, insuranceFee, insured, total, plus,
  };
}

export function registerShop(router) {
  router.post('/api/reports/lower-price', async (ctx) => {
    ctx.rateLimit(`lowerprice:${ctx.ip}`, 5, 24 * 60 * 60 * 1000);
    const productId = V.id(ctx.body.productId, 'شناسه کالا');
    const price = V.int(ctx.body.price, { min: 1000, field: 'قیمت' });
    const url = V.str(ctx.body.url, { min: 3, max: 500, field: 'آدرس' });
    
    await db.tx((st) => {
      if (!st.lowerPriceReports) st.lowerPriceReports = [];
      st.lowerPriceReports.push({
        id: uid('lrp'),
        productId,
        price,
        url,
        userId: ctx.user ? ctx.user.id : null,
        createdAt: nowISO(),
        status: 'pending'
      });
      if (st.lowerPriceReports.length > 200) st.lowerPriceReports.shift();
          });
    
    sendJson(ctx.res, 200, { ok: true });
  });

  // ── سبد خرید ────────────────────────────────────────────
  router.get('/api/cart', async (ctx) => {
    const cart = await db.tx((st) => getCart({ ...ctx, state: st }, true));
    const data = serializeCart(ctx.state, cart, ctx.user);
    const quote = calcQuote(ctx.state, { items: cart.items, user: ctx.user, delivery: 'courier', zone: 'country', express: false, insurance: false, guestId: ctx.cookies?.['ys_guest'] || '' });
    sendJson(ctx.res, 200, { ok: true, cart: data, guestId: ctx.cookies['ys_guest'] || '', quote: { plus: quote.plus, freeOver: ctx.state.settings.shipping?.freeOver } });
  });

  router.post('/api/cart/add', async (ctx) => {
    const productId = V.id(ctx.body?.productId, 'شناسهٔ کالا');
    const qty = V.int(ctx.body?.qty, { min: 1, max: 99, field: 'تعداد', def: 1 });
    const p = ctx.state.products.find((x) => x.id === productId);
    if (!p || p.active === false) throw notFound('product_not_found', 'کالا یافت نشد.');
    if (!Number(p.price)) throw new HttpError(422, 'service_item', 'این مورد خدماتی/استعلامی است و به سبد اضافه نمی‌شود — لطفاً با مغازه تماس بگیر.');
    const cart = await db.tx((st) => {
      const c = getCart({ ...ctx, state: st }, true);
      const line = c.items.find((i) => i.productId === productId);
      const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
      const current = line?.qty || 0;
      if (current + qty > available) {
        throw new HttpError(409, 'stock_limit', available > 0
          ? `فقط ${available} عدد از این کالا موجود است.`
          : 'این کالا فعلاً ناموجود است. می‌توانی «خبرم کن» را فعال کنی.');
      }
      if (line) line.qty = Math.min(99, line.qty + qty);
      else {
        if (c.items.length >= 50) throw new HttpError(400, 'cart_full', 'سبد خرید شما پر شده است. (حداکثر ۵۰ قلم متفاوت)');
        c.items.push({ productId, qty, addedAt: nowISO() });
      }
      c.updatedAt = nowISO();
      logAudit(ctx.user, 'cart.add', `${productId} x${qty}`, {});
      return c;
    });
    sendJson(ctx.res, 200, { ok: true, cart: serializeCart(ctx.state, cart, ctx.user), me: ctx.user ? mePayload(ctx.state, ctx.user) : null });
  });

  router.patch('/api/cart/item', async (ctx) => {
    const productId = V.id(ctx.body?.productId, 'شناسهٔ کالا');
    const qty = V.int(ctx.body?.qty, { min: 0, max: 99, field: 'تعداد' });
    const cart = await db.tx((st) => {
      const c = getCart({ ...ctx, state: st }, true);
      const line = c.items.find((i) => i.productId === productId);
      if (!line) throw notFound('not_in_cart', 'این کالا در سبد نیست.');
      const p = st.products.find((x) => x.id === productId);
      const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
      if (qty === 0) c.items = c.items.filter((i) => i.productId !== productId);
      else {
        if (qty > available) throw new HttpError(409, 'stock_limit', `فقط ${available} عدد موجود است.`);
        line.qty = qty;
      }
      c.updatedAt = nowISO();
      return c;
    });
    sendJson(ctx.res, 200, { ok: true, cart: serializeCart(ctx.state, cart, ctx.user) });
  });

  router.delete('/api/cart/item/:productId', async (ctx) => {
    const productId = V.id(ctx.params.productId, 'شناسهٔ کالا');
    const cart = await db.tx((st) => {
      const c = getCart({ ...ctx, state: st }, true);
      c.items = c.items.filter((i) => i.productId !== productId);
      c.updatedAt = nowISO();
      return c;
    });
    sendJson(ctx.res, 200, { ok: true, cart: serializeCart(ctx.state, cart, ctx.user) });
  });

  router.post('/api/cart/clear', async (ctx) => {
    await db.tx((st) => {
      const c = getCart({ ...ctx, state: st }, true);
      c.items = []; c.coupon = null; c.updatedAt = nowISO();
    });
    sendJson(ctx.res, 200, { ok: true, cart: { items: [], count: 0, subtotal: 0, weight: 0 } });
  });

  router.post('/api/cart/coupon', async (ctx) => {
    const rawCode = String(ctx.body?.code ?? '').trim();
    const code = rawCode ? V.str(rawCode, { min: 3, max: 32, field: 'کد تخفیف' }).toUpperCase() : '';
    let quote = null;
    if (code) {
      const tempCart = getCart(ctx) || { items: [] };
      quote = calcQuote(ctx.state, { items: tempCart.items, user: ctx.user, delivery: 'courier', zone: 'country', express: false, insurance: false, couponCode: code, guestId: ctx.cookies?.['ys_guest'] || '' });
      if (quote.couponError) throw badRequest('invalid_coupon', quote.couponError);
    }
    const cart = await db.tx((st) => {
      const c = getCart({ ...ctx, state: st }, true);
      c.coupon = code || null;
      return c;
    });
    if (!code || !quote) return sendJson(ctx.res, 200, { ok: true, cart: serializeCart(ctx.state, cart, ctx.user), discount: 0, coupon: null });
    sendJson(ctx.res, 200, { ok: true, cart: serializeCart(ctx.state, cart, ctx.user), discount: quote.couponDiscount, coupon: quote.coupon ? { code: quote.coupon.code, type: quote.coupon.type, value: quote.coupon.value, note: quote.coupon.note } : null });
  });

  // ── محاسبهٔ هزینهٔ ارسال/بیمه/تخفیف ─────────────────────
  router.post('/api/checkout/quote', async (ctx) => {
    // 🔴 BUG FIX: Fetching/pruning cart was outside db.tx(), causing memory corruption and race conditions
    const cart = await db.tx(st => getCart({ ...ctx, state: st }));
    if (!cart || !cart.items.length) throw badRequest('empty_cart', 'سبد خرید خالی است.');
    const delivery = V.oneOf(ctx.body?.delivery, ['pickup', 'courier'], 'delivery', 'courier');
    const zone = V.oneOf(ctx.body?.zone, ['city', 'province', 'country'], 'zone', 'country');
    const express = V.bool(ctx.body?.express, false);
    const insurance = V.bool(ctx.body?.insurance, false);
    const couponCode = V.optStr(ctx.body?.couponCode, { max: 32, field: 'کد تخفیف' });
    const q = calcQuote(ctx.state, { items: cart.items, user: ctx.user, delivery, zone, express, insurance, couponCode: couponCode || cart.coupon, guestId: ctx.cookies?.['ys_guest'] || '' });
    sendJson(ctx.res, 200, {
      ok: true,
      quote: {
        subtotal: q.subtotal, plusDiscount: q.plusDiscount, couponDiscount: q.couponDiscount,
        shipping: q.shipping, shippingLabel: q.shippingLabel, insuranceFee: q.insuranceFee,
        insured: q.insured, total: q.total, plus: q.plus, couponError: q.couponError,
        itemCount: q.lines.reduce((a, b) => a + b.qty, 0),
      },
      // وضعیت سقف خرید غلتان برای هشدار فوری در صفحهٔ تسویه‌حساب
      ceiling: ceilingStatus(ctx.state, { userId: ctx.user?.id || null, guestId: cart.guestId || ctx.cookies?.['ys_guest'] || null }),
      paymentMethods: paymentMethods(ctx.state, q.total),
    });
  });

  // ── ثبت سفارش (با قفل موجودی — بدون race) ───────────────
  router.post('/api/checkout', async (ctx) => {
    const state = ctx.state;
    if (!ctx.user && !state.settings.features?.guestCheckout) throw forbidden('login_required', 'برای ثبت سفارش وارد حساب کاربری شو.');
    ctx.rateLimit(`checkout:${ctx.user?.id || ctx.ip}`, 12, 60 * 60 * 1000);
    const delivery = V.oneOf(ctx.body?.delivery, ['pickup', 'courier'], 'delivery', 'courier');
    const zone = V.oneOf(ctx.body?.zone, ['city', 'province', 'country'], 'zone', 'country');
    const express = V.bool(ctx.body?.express, false);
    const insurance = V.bool(ctx.body?.insurance, false);
    const paymentMethod = V.oneOf(ctx.body?.paymentMethod, ['wallet', 'gateway', 'cod', 'card', 'snapppay', 'azki', 'digipay'], 'paymentMethod', 'gateway');
    const walletUse = V.bool(ctx.body?.useWallet, false);
    const note = V.optStr(ctx.body?.note, { max: 400, field: 'توضیحات سفارش' });
    const addressId = V.optStr(ctx.body?.addressId, { max: 64, field: 'آدرس' });
    // برای کارت‌به‌کارت، شماره کارت/شبا هرگز خام ذخیره نمی‌شود؛ فقط هش آن برای
    // کنترل سقف روزانه استفاده می‌شود. واردکردن این شناسه اختیاری است.
    const payerIdentity = normalizePayerIdentity(V.optStr(ctx.body?.payerCardOrIban, { max: 80, field: 'شناسه کارت یا شبا' }));
    if (payerIdentity && !/^(?:IR[0-9]{24}|[0-9]{16})$/.test(payerIdentity)) {
      throw badRequest('invalid_payment_identity', 'شماره کارت باید ۱۶ رقم یا شماره شبا باید با IR و ۲۴ رقم وارد شود.');
    }
    const accepted = V.bool(ctx.body?.acceptTerms, false);
    if (!accepted) throw badRequest('terms_required', 'پذیرش قوانین و مقررات برای ثبت سفارش الزامی است.');

    // احراز هویت (KYC): پیش‌فرض «غیرفعال» است و قاعدهٔ آن از تنظیمات
    // سفارش خوانده می‌شود (پنل مدیریت → تنظیمات → سفارش و پرداخت).
    // چون قاعدهٔ «amount» و «first_order» به مبلغ و تاریخچهٔ سفارش‌ها
    // نیاز دارد، بررسی داخل همان تراکنش و بعد از محاسبهٔ قیمت انجام می‌شود.
    const kycCfg = kycConfig(state.settings?.orders);

    // اطلاعات تماس مهمان (برای سفارش‌های بدون حساب کاربری)
    const guestName = !ctx.user ? V.str(ctx.body?.guestName, { min: 2, max: 60, field: 'نام تحویل‌گیرنده' }) : '';
    const guestPhoneRaw = !ctx.user ? String(ctx.body?.guestPhone || '').replace(/[\s-]/g, '') : '';
    const guestPhone = !ctx.user ? V.phone(guestPhoneRaw, 'شماره موبایل تحویل‌گیرنده') : '';
    if (delivery === 'pickup' && !state.settings.shipping?.pickupEnabled) throw badRequest('pickup_disabled', 'تحویل حضوری غیرفعال است.');

    const result = await db.tx((st) => {
      const user = ctx.user ? st.users.find((u) => u.id === ctx.user.id) : null;
      const cart = getCart({ ...ctx, state: st });
      if (!cart || !cart.items.length) throw badRequest('empty_cart', 'سبد خرید خالی است.');

      // ۱) بررسی موجودی داخل همان تراکنش (هیچ await بین بررسی و کسر نیست)
      const lines = [];
      for (const it of cart.items) {
        const p = st.products.find((x) => x.id === it.productId);
        if (!p || p.active === false) throw new HttpError(409, 'product_unavailable', 'یکی از کالاهای سبد دیگر در دسترس نیست. سبد را بررسی کن.');
        const available = Math.max(0, (p.stock || 0) - (p.reserved || 0));
        if (it.qty > available) {
          throw new HttpError(409, 'stock_limit', available > 0
            ? `موجودی «${p.name}» فقط ${available} عدد است (درخواست تو: ${it.qty}).`
            : `«${p.name}» ناموجود شد. آن را از سبد حذف کن یا «خبرم کن» را فعال کن.`);
        }
        lines.push({ p, qty: it.qty });
      }

      const q = calcQuote(st, { items: cart.items, user, delivery, zone, express, insurance, couponCode: cart.coupon, guestId: ctx.cookies?.['ys_guest'] || '' });
      if (q.couponError) { cart.coupon = null; throw badRequest('invalid_coupon', q.couponError); }

      // سقف هوشمند پیش از هر کسر موجودی/کیف پول و در همان تراکنش بررسی می‌شود.
      const riskKeys = enforceOrderCeiling(st, { amount: q.total, deviceToken: ctx.visitorToken, payerIdentity });

      // سقف خرید غلتان (فقط خریدهای موفقِ بازهٔ غلتان) — با پیام محترمانه و
      // بدون هیچ‌گونه مسدودسازی کاربر؛ با کم/حذف‌کردن اقلام سبد بلافاصله رفع می‌شود.
      enforceRollingCeiling(st, { userId: user?.id || null, guestId: user ? null : (ctx.cookies['ys_guest'] || null), amount: q.total });

      // ── بررسی احراز هویت بر پایهٔ قاعدهٔ فعال ──────────────
      if (kycCfg.active) {
        const isFirstOrder = !!user && !(st.orders || []).some((o) => o.userId === user.id && o.status !== 'cancelled');
        const need = kycRequirement(kycCfg, { user: user || ctx.user, total: q.total, paymentMethod, isFirstOrder });
        if (need.required) {
          if (!user) throw forbidden('kyc_required', `${need.message} برای احراز هویت ابتدا وارد حساب کاربری شو.`);
          logAudit(user, 'checkout.kyc_blocked', user.id, { reason: need.reason, condition: kycCfg.condition, total: q.total });
          throw forbidden('kyc_required', need.message);
        }
      }

      // آدرس
      let address = null;
      if (delivery === 'courier') {
        if (!user) {
          const gProv = V.str(ctx.body?.guestProvince, { min: 2, max: 40, field: 'استان' });
          const gCity = V.str(ctx.body?.guestCity, { min: 2, max: 40, field: 'شهر' });
          const gAddr = V.str(ctx.body?.guestAddress, { min: 5, max: 300, field: 'آدرس کامل' });
          const gZip = V.optStr(ctx.body?.guestZip, { max: 20 });
          address = { title: 'آدرس مهمان', province: gProv, city: gCity, address: gAddr, zip: gZip, name: guestName, phone: guestPhone };
        } else {
          address = (user.addresses || []).find((a) => a.id === addressId) || (user.addresses || []).find((a) => a.isDefault) || null;
          if (!address) throw badRequest('address_required', 'برای ارسال، ابتدا یک آدرس در پروفایل ثبت کن.');
        }
      }

      // روش پرداخت
      const minOrder = Number(st.settings.orders?.minOrder || 0);
      if (q.total < minOrder) throw badRequest('min_order', `حداقل مبلغ سفارش ${minOrder} تومان است.`);
      let walletUsed = 0;
      let payable = q.total;
      if (walletUse && user && (user.wallet?.balance || 0) > 0) {
        walletUsed = Math.min(user.wallet.balance, payable);
        payable -= walletUsed;
      }
      if (paymentMethod === 'wallet' && payable > 0) throw badRequest('insufficient_balance', 'موجودی کیف پول برای پرداخت کل سفارش کافی نیست.');
      if (paymentMethod === 'cod') {
        if (!st.settings.orders?.codEnabled) throw badRequest('cod_disabled', 'پرداخت در محل فعال نیست.');
        if (delivery === 'pickup') throw badRequest('cod_invalid', 'پرداخت در محل برای تحویل حضوری کاربرد ندارد.');
        if (q.total > 20000000) throw badRequest('cod_limit', 'پرداخت در محل برای مبالغ بالای ۲۰٬۰۰۰٬۰۰۰ تومان ممکن نیست.');
      }
      // کارت‌به‌کارت / واریز بانکی: فقط وقتی مدیر در «ابزارهای فروش» اطلاعات بانکی را روشن و وارد کرده باشد.
      // سفارش مثل پرداخت در محل در وضعیت «در انتظار بررسی» می‌ماند تا فروشگاه رسید را تأیید کند.
      if (paymentMethod === 'card' && !bankTransferAvailable(st.settings)) {
        throw badRequest('card_disabled', 'پرداخت کارت‌به‌کارت در حال حاضر فعال نیست؛ لطفاً روش پرداخت دیگری انتخاب کن.');
      }
      const offlinePay = paymentMethod === 'cod' || paymentMethod === 'card';

      // ۲) کسر موجودی (اتمی)
      for (const l of lines) { l.p.stock = Math.max(0, (l.p.stock || 0) - l.qty); l.p.sold = (l.p.sold || 0) + l.qty; }
      // ۳) کسر کیف پول
      if (walletUsed > 0 && user) {
        user.wallet.balance -= walletUsed;
        user.wallet.transactions.unshift({ id: uid('tx'), at: nowISO(), type: 'purchase', amount: -walletUsed, status: 'done', note: 'پرداخت سفارش', ref: '' });
        if (user.wallet.transactions.length > 50) user.wallet.transactions.length = 50;
      }
      // ۴) کوپن
      if (q.coupon) { q.coupon.used = (q.coupon.used || 0) + 1; }

      const paid = paymentMethod === 'wallet' ? payable === 0 : paymentMethod === 'cod' ? false : false;
      const order = {
        id: uid('ord'), code: makeOrderCode(st),
        userId: user?.id || null,
        guestId: user ? null : (ctx.cookies['ys_guest'] || null),
        userName: user?.name || guestName || 'مهمان',
        userPhone: user?.phone || guestPhone || '',
        isGuest: !user,
        items: lines.map((l) => ({
          productId: l.p.id, name: l.p.name, nameEn: l.p.nameEn, image: l.p.images?.[0] || '',
          price: l.p.price, qty: l.qty, brand: l.p.brandName, sku: l.p.sku,
          cost: Math.max(0, Number(l.p.cost) || 0),
        })),
        subtotal: q.subtotal, plusDiscount: q.plusDiscount, couponDiscount: q.couponDiscount,
        couponCode: q.coupon?.code || '', discount: q.plusDiscount + q.couponDiscount,
        shipping: q.shipping, shippingLabel: q.shippingLabel, express,
        insured: q.insured, insuranceFee: q.insuranceFee,
        total: q.total, walletUsed, payable,
        // فقط هش‌های غیرقابل‌برگشت برای تشخیص سقف؛ شماره کارت/توکن خام هرگز در سفارش ثبت نمی‌شود.
        deviceTokenHash: riskKeys.deviceTokenHash,
        paymentInstrumentHash: riskKeys.paymentInstrumentHash,
        delivery, zone: delivery === 'courier' ? zone : null,
        address: address ? { ...address } : null,
        payment: {
          method: paymentMethod,
          status: walletUsed >= q.total ? 'paid' : (offlinePay ? 'pending' : 'unpaid'),
          ref: '', paidAt: walletUsed >= q.total ? nowISO() : null,
        },
        status: walletUsed >= q.total ? 'confirmed' : (offlinePay ? 'pending_review' : 'pending_payment'),
        note, termsAcceptedAt: nowISO(),
        timeline: [{ status: 'created', at: nowISO(), note: 'ثبت سفارش', by: user?.name || 'مهمان' }],
        createdAt: nowISO(), updatedAt: nowISO(),
        visitDay: new Date().toISOString().slice(0, 10),
      };
      if (order.status === 'confirmed') {
        order.timeline.push({ status: 'confirmed', at: nowISO(), note: 'پرداخت کامل از کیف پول', by: 'سامانه' });
        st.stats.ordersTotal = (st.stats.ordersTotal || 0) + 1;
      }
      st.orders.unshift(order);
      if (st.orders.length > 100000) st.orders.length = 100000;
      st.visits[order.visitDay] = st.visits[order.visitDay] || { visits: 0, unique: 0, orders: 0 };
      st.visits[order.visitDay].orders = (st.visits[order.visitDay].orders || 0) + 1;
      if (user) {
        user.points = (user.points || 0) + Math.floor(q.total / 100000);
        cart.items = []; cart.coupon = null;
      } else {
        cart.items = []; cart.coupon = null;
      }
      logAudit(user, 'order.create', order.code, { total: q.total, delivery, paymentMethod, items: lines.length });
      pushNotification(st, {
        userId: null,
        type: 'admin_alert',
        level: 'success',
        title: `سفارش جدید: ${order.code}`,
        body: `یک سفارش جدید (${lines.length} قلم) به مبلغ ${q.total.toLocaleString('fa-IR')} تومان ثبت شد.`,
        link: '#/admin/orders'
      });
      pushNotification(st, {
        userId: user?.id || null, type: 'order', level: 'info',
        title: `سفارش ${order.code} ثبت شد`, titleEn: `Order ${order.code} placed`,
        body: paymentMethod === 'wallet' && order.status === 'confirmed'
          ? 'پرداخت با موفقیت انجام شد. سفارش در حال آماده‌سازی است.'
          : (paymentMethod === 'card'
            ? 'مبلغ سفارش را کارت‌به‌کارت کن و رسید را برای فروشگاه بفرست؛ پس از تأیید، سفارش آماده‌سازی می‌شود.'
            : (paymentMethod === 'cod' ? 'سفارش در انتظار بررسی و تأیید فروشگاه است.' : 'برای نهایی شدن سفارش، پرداخت را تکمیل کن.')),
        link: `#/account/orders/${order.id}`,
      });
      return { order, payable, paymentMethod };
    });

    invalidateSearchIndex();
    notifyAdmins('order', { order: result.order });
    sendJson(ctx.res, 200, {
      ok: true,
      order: publicOrder(result.order),
      payable: result.payable,
      paymentMethod: result.paymentMethod,
      needsPayment: result.order.payment.status !== 'paid',
      message: 'سفارش با موفقیت ثبت شد.',
      me: ctx.user ? mePayload(ctx.state, ctx.user) : null,
    });
  });

  // ── پرداخت آزمایشی (شبیه‌ساز درگاه) ─────────────────────
  router.post('/api/payments/simulate/:orderId', async (ctx) => {
    const orderId = V.id(ctx.params.orderId, 'شناسهٔ سفارش');
    const success = V.bool(ctx.body?.success, true);
    const out = await db.tx((st) => {
      const o = st.orders.find((x) => x.id === orderId);
      if (!o) throw notFound('order_not_found', 'سفارش یافت نشد.');
      const owner = o.userId === ctx.user?.id;
      const isStaff = ctx.user && (ctx.user.role === 'owner' || ctx.user.role === 'staff');
      const guestOwner = !o.userId && !!o.guestId && o.guestId === (ctx.cookies['ys_guest'] || '');
      if (st.settings.orders?.gatewayMode === 'live') throw badRequest('live_mode', 'درگاه در حالت واقعی است. پرداخت شبیه‌سازی‌شده غیرفعال است.');
      if (!owner && !isStaff && !guestOwner) throw forbidden('forbidden', 'دسترسی ندارید.');
      if (['cancelled', 'refunded', 'returned'].includes(o.status)) throw badRequest('terminal_state', 'این سفارش لغو یا مرجوع شده است و قابل پرداخت نیست.');
      if (o.payment.status === 'paid') return { order: o, already: true };
      if (!success) {
        safeCancelOrder(st, o, 'پرداخت ناموفق / انصراف از پرداخت', 'سامانه');
        if (o.payment) o.payment.status = 'failed';
        return { order: o, already: false };
      }
      const remaining = Math.max(0, o.total - (o.walletUsed || 0));
      o.payment.status = 'paid';
      o.payment.ref = `SIM-${Date.now().toString(36).toUpperCase()}`;
      o.payment.paidAt = nowISO();
      o.payable = 0;
      o.status = 'confirmed';
      o.updatedAt = nowISO();
      o.timeline.push({ status: 'confirmed', at: nowISO(), note: `پرداخت موفق${remaining ? ` (${remaining} تومان)` : ''} — کد پیگیری ${o.payment.ref}`, by: 'سامانه' });
      st.stats.ordersTotal = (st.stats.ordersTotal || 0) + 1;
      st.stats.revenueTotal = (st.stats.revenueTotal || 0) + o.total;
      logAudit(ctx.user, 'order.payment.simulated', o.code, { amount: o.total });
      pushNotification(st, { userId: o.userId, type: 'order', level: 'success', title: `پرداخت سفارش ${o.code} موفق بود`, body: 'سفارش تأیید شد و در حال آماده‌سازی است.', link: `#/account/orders/${o.id}` });
      return { order: o, already: false, remaining };
    });
    sendJson(ctx.res, 200, { ok: true, order: publicOrder(out.order), already: out.already, gatewayMode: 'demo' });
  });

  // ── سفارش‌های من ────────────────────────────────────────
  router.get('/api/me/orders', async (ctx) => {
    ctx.requireUser();
    const items = ctx.state.orders.filter((o) => o.userId === ctx.user.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(publicOrder);
    const summary = {
      total: items.length,
      active: items.filter((o) => !['delivered', 'cancelled', 'refunded', 'returned'].includes(o.status)).length,
      delivered: items.filter((o) => o.status === 'delivered').length,
      spent: items.filter((o) => o.payment?.status === 'paid').reduce((a, b) => a + b.total, 0),
    };
    sendJson(ctx.res, 200, { ok: true, items, summary });
  });

  router.get('/api/me/orders/:id', async (ctx) => {
    ctx.requireUser();
    const o = ctx.state.orders.find((x) => x.id === ctx.params.id || x.code === ctx.params.id);
    if (!o) throw notFound('order_not_found', 'سفارش یافت نشد.');
    if (o.userId !== ctx.user.id && !['owner', 'staff'].includes(ctx.user.role)) throw forbidden('forbidden', 'دسترسی ندارید.');
    const canReviewIds = o.status === 'delivered' ? o.items.map((i) => i.productId) : [];
    sendJson(ctx.res, 200, { ok: true, order: publicOrder(o, { full: true }), canReviewIds, statusInfo: statusInfo(o.status) });
  });

  router.post('/api/me/orders/:id/cancel', async (ctx) => {
    ctx.requireUser();
    const reason = V.optStr(ctx.body?.reason, { max: 300, field: 'دلیل لغو' });
    const out = await db.tx((st) => {
      const o = st.orders.find((x) => x.id === ctx.params.id);
      if (!o) throw notFound('order_not_found', 'سفارش یافت نشد.');
      if (o.userId !== ctx.user.id) throw forbidden('forbidden', 'دسترسی ندارید.');
      if (['shipped', 'delivered', 'cancelled', 'refunded', 'returned'].includes(o.status)) {
        throw badRequest('cannot_cancel', 'این سفارش در وضعیت فعلی قابل لغو نیست. برای مرجوعی، تیکت بزن.');
      }
      const res = safeCancelOrder(st, o, `لغو توسط مشتری${reason ? ` — ${reason}` : ''}`, ctx.user.name);
      let refundNote = res && res.refunded > 0 ? `${res.refunded} تومان به کیف پول بازگشت داده شد.` : '';
      logAudit(ctx.user, 'order.cancel', o.code, { reason });
      pushNotification(st, { userId: o.userId, type: 'order', level: 'warning', title: `سفارش ${o.code} لغو شد`, body: refundNote || 'سفارش لغو شد و موجودی کالا آزاد شد.', link: `#/account/orders/${o.id}` });
      pushNotification(st, { userId: null, type: 'admin_alert', level: 'warning', title: 'لغو سفارش توسط مشتری', body: `سفارش ${o.code} توسط ${ctx.user.name} لغو شد.`, link: '#/admin/orders' });
      return { o, refundNote };
    });
    invalidateSearchIndex();
    sendJson(ctx.res, 200, { ok: true, order: publicOrder(out.o, { full: true }), refundNote: out.refundNote });
  });

  // ── نظرات و سؤالات ──────────────────────────────────────
  router.post('/api/reviews', async (ctx) => {
    ctx.requireUser();
    ctx.rateLimit(`review:${ctx.user.id}`, 8, 24 * 60 * 60 * 1000);
    const productId = V.id(ctx.body?.productId, 'شناسهٔ کالا');
    const type = V.oneOf(ctx.body?.type, ['review', 'question'], 'type', 'review');
    const rating = type === 'review' ? V.int(ctx.body?.rating, { min: 1, max: 5, field: 'امتیاز' }) : 0;
    const title = V.str(ctx.body?.title, { min: 2, max: 80, field: 'عنوان' });
    const body = V.str(ctx.body?.body, { min: 5, max: 1500, field: 'متن' });
    const p = ctx.state.products.find((x) => x.id === productId);
    if (!p) throw notFound('product_not_found', 'کالا یافت نشد.');
    const existing = ctx.state.reviews.find((r) => r.productId === productId && r.userId === ctx.user.id && r.type === type);
    if (existing) throw conflict('already_submitted', 'قبلاً برای این کالا نظر/سؤال ثبت کرده‌ای.');
    const purchased = ctx.state.orders.some((o) => o.userId === ctx.user.id && ['delivered', 'shipped', 'preparing', 'confirmed'].includes(o.status) && o.items.some((i) => i.productId === productId));

    const rec = await db.tx((st) => {
      const r = {
        id: uid('rev'), productId, productName: p.name, userId: ctx.user.id, userName: ctx.user.name,
        userBadge: purchased ? 'buyer' : 'visitor', type, rating, title, body,
        status: 'pending', reply: '', replyAt: null, likes: 0, likedBy: [],
        createdAt: nowISO(),
      };
      st.reviews.unshift(r);
      if (st.reviews.length > 500) st.reviews.length = 500;
      logAudit(ctx.user, 'review.create', `${productId}:${type}`, { rating });
      pushNotification(st, {
        userId: null, type: 'admin_alert', level: 'info',
        title: type === 'review' ? 'نظر جدید در انتظار تأیید' : 'سؤال جدید در انتظار پاسخ',
        body: `${ctx.user.name} روی «${p.name}»: ${title}`, link: '#/admin/reviews',
      });
      return r;
    });
    sendJson(ctx.res, 200, {
      ok: true, review: rec,
      message: 'پیام تو ثبت شد و پس از تأیید مدیر، نمایش داده می‌شود. ممنون از وقتی که گذاشتی!',
    });
  });

  router.post('/api/reviews/:id/like', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسه');
    const out = await db.tx((st) => {
      const r = st.reviews.find((x) => x.id === id);
      if (!r) throw notFound('not_found', 'نظر یافت نشد.');
      r.likedBy = r.likedBy || [];
      const i = r.likedBy.indexOf(ctx.user.id);
      if (i >= 0) { r.likedBy.splice(i, 1); r.likes = Math.max(0, (r.likes || 1) - 1); }
      else { r.likedBy.push(ctx.user.id); r.likes = (r.likes || 0) + 1; }
      return { likes: r.likes, liked: i < 0 };
    });
    sendJson(ctx.res, 200, { ok: true, ...out });
  });

  // ── تیکت‌ها ─────────────────────────────────────────────
  router.get('/api/tickets', async (ctx) => {
    ctx.requireUser();
    const items = ctx.state.tickets.filter((t) => t.userId === ctx.user.id)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .slice(0, 100)
      .map((t) => publicTicket(t, ctx.user.id));
    sendJson(ctx.res, 200, { ok: true, items });
  });

  router.post('/api/tickets', async (ctx) => {
    ctx.requireUser();
    if (ctx.state.settings.features?.tickets === false) throw badRequest('disabled', 'سامانهٔ تیکت موقتاً غیرفعال است.');
    ctx.rateLimit(`ticket:${ctx.user.id}`, 10, 24 * 60 * 60 * 1000);
    const subject = V.str(ctx.body?.subject, { min: 4, max: 100, field: 'موضوع' });
    const category = V.oneOf(ctx.body?.category, ['order', 'return', 'product', 'technical', 'complaint', 'partnership', 'account', 'other'], 'category', 'other');
    const priority = V.oneOf(ctx.body?.priority, ['critical', 'high', 'normal', 'low'], 'priority', 'normal');
    const body = V.str(ctx.body?.body, { min: 10, max: 4000, field: 'متن پیام' });
    const rulesAccepted = V.bool(ctx.body?.rulesAccepted, false);
    if (!rulesAccepted) throw badRequest('rules_required', 'پذیرش قوانین تیکت الزامی است.');
    const attachments = V.arr(ctx.body?.attachments, { max: 4, field: 'پیوست' }).map((x) => String(x).slice(0, 200)).filter((x) => x.startsWith('/uploads/'));

    const ticket = await db.tx((st) => {
      const t = {
        id: uid('tk'), code: `TK-${1000 + st.tickets.length + 1}`,
        userId: ctx.user.id, userName: ctx.user.name, userPhone: ctx.user.phone || '',
        subject, category, priority, body, attachments, rulesAccepted: true,
        status: 'open', messages: [{ from: 'user', userId: ctx.user.id, name: ctx.user.name, body, attachments, at: nowISO() }],
        createdAt: nowISO(), updatedAt: nowISO(),
      };
      st.tickets.unshift(t);
      if (st.tickets.length > 200) st.tickets.length = 200;
      logAudit(ctx.user, 'ticket.create', t.code, { category, priority });
      pushNotification(st, { userId: null, type: 'admin_alert', level: priority === 'critical' ? 'error' : 'info', title: `تیکت جدید: ${subject}`, body: `${ctx.user.name} — اولویت ${priority}`, link: `#/admin/tickets/${t.id}` });
      pushNotification(st, { userId: ctx.user.id, type: 'ticket', level: 'info', title: `تیکت ${t.code} ثبت شد`, body: 'تیم پشتیبانی به‌زودی پاسخ می‌دهد. می‌توانی از همین بخش پیام‌ها را پیگیری کنی.', link: `#/account/tickets/${t.id}` });
      return t;
    });
    notifyAdmins('ticket', { ticket, message: body });
    sendJson(ctx.res, 200, { ok: true, ticket: publicTicket(ticket, ctx.user.id), message: 'تیکت ثبت شد.' });
  });

  router.get('/api/tickets/:id', async (ctx) => {
    ctx.requireUser();
    const t = ctx.state.tickets.find((x) => x.id === ctx.params.id || x.code === ctx.params.id);
    if (!t) throw notFound('not_found', 'تیکت یافت نشد.');
    if (t.userId !== ctx.user.id && !['owner', 'staff'].includes(ctx.user.role)) throw forbidden('forbidden', 'دسترسی ندارید.');
    await db.tx((st) => {
      const tt = st.tickets.find((x) => x.id === t.id);
      tt.readBy = tt.readBy || {};
      tt.readBy[ctx.user.id] = nowISO();
    });
    sendJson(ctx.res, 200, { ok: true, ticket: publicTicket(t, ctx.user.id, true) });
  });

  router.post('/api/tickets/:id/messages', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسهٔ تیکت');
    const body = V.str(ctx.body?.body, { min: 2, max: 4000, field: 'متن پیام' });
    const attachments = V.arr(ctx.body?.attachments, { max: 4, field: 'پیوست' }).map((x) => String(x).slice(0, 200)).filter((x) => x.startsWith('/uploads/'));
    ctx.rateLimit(`tmsg:${ctx.user.id}`, 30, 60 * 60 * 1000);
    const out = await db.tx((st) => {
      const t = st.tickets.find((x) => x.id === id);
      if (!t) throw notFound('not_found', 'تیکت یافت نشد.');
      if (t.userId !== ctx.user.id && !['owner', 'staff'].includes(ctx.user.role)) throw forbidden('forbidden', 'دسترسی ندارید.');
      if (t.status === 'closed' && ctx.user.id === t.userId) {
        const closedAt = new Date(t.updatedAt).getTime();
        if (Date.now() - closedAt > 30 * 86400000) throw badRequest('closed', 'این تیکت بسته شده و امکان ارسال پیام ندارد. تیکت جدید ثبت کن.');
        t.status = 'open';
      }
      const isStaff = ['owner', 'staff'].includes(ctx.user.role);
      if (t.messages.length >= 100) throw badRequest('limit', 'تعداد پیام‌های این تیکت به سقف خود (۱۰۰) رسیده است. لطفا تیکت جدیدی باز کنید.');
      t.messages.push({ from: isStaff ? 'staff' : 'user', userId: ctx.user.id, name: ctx.user.name, body, attachments, at: nowISO() });
      t.updatedAt = nowISO();
      logAudit(ctx.user, 'ticket.message', t.code, { from: isStaff ? 'staff' : 'user' });
      if (!isStaff) {
        pushNotification(st, { userId: null, type: 'admin_alert', level: 'info', title: `پاسخ کاربر در تیکت ${t.code}`, body: t.subject, link: `#/admin/tickets/${t.id}` });
      } else {
        pushNotification(st, { userId: t.userId, type: 'ticket', level: 'success', title: `پاسخ جدید در تیکت ${t.code}`, body: body.slice(0, 120), link: `#/account/tickets/${t.id}` });
      }
      broadcast(t.userId, 'ticket', { id: t.id, code: t.code, at: nowISO() });
      return t;
    });
    if (!['owner', 'staff'].includes(ctx.user.role)) notifyAdmins('ticket', { ticket: out, message: body });
    sendJson(ctx.res, 200, { ok: true, ticket: publicTicket(out, ctx.user.id, true) });
  });

  router.post('/api/tickets/:id/close', async (ctx) => {
    ctx.requireUser();
    const id = V.id(ctx.params.id, 'شناسهٔ تیکت');
    const out = await db.tx((st) => {
      const t = st.tickets.find((x) => x.id === id);
      if (!t) throw notFound('not_found', 'تیکت یافت نشد.');
      if (t.status === 'closed') return t;
      if (t.userId !== ctx.user.id && !['owner', 'staff'].includes(ctx.user.role)) throw forbidden('forbidden', 'دسترسی ندارید.');
      t.status = 'closed';
      t.updatedAt = nowISO();
      t.messages.push({ from: 'system', name: 'سامانه', body: 'تیکت بسته شد.', at: nowISO() });
      logAudit(ctx.user, 'ticket.close', t.code, {});
      return t;
    });
    sendJson(ctx.res, 200, { ok: true, ticket: publicTicket(out, ctx.user.id) });
  });

  // ── چت پشتیبانی آنلاین ──────────────────────────────────
  router.get('/api/support/messages', async (ctx) => {
    ctx.requireUser();
    const list = ctx.state.supportMessages.filter((m) => m.userId === ctx.user.id).slice(-100);
    await db.tx((st) => { for (const m of st.supportMessages) if (m.userId === ctx.user.id && m.from === 'staff') m.readByUser = true; });
    sendJson(ctx.res, 200, { ok: true, items: list, online: true });
  });

  router.post('/api/support/messages', async (ctx) => {
    ctx.requireUser();
    if (ctx.state.settings.features?.liveSupport === false) throw badRequest('disabled', 'چت آنلاین موقتاً غیرفعال است.');
    const body = V.str(ctx.body?.body, { min: 1, max: 1000, field: 'پیام' });
    ctx.rateLimit(`chat:${ctx.user.id}`, 40, 10 * 60 * 1000);
    
    let botReplyText = getAutoReply(body);
    
    const { msg, botMsg } = await db.tx((st) => {
      const m = { id: uid('chat'), userId: ctx.user.id, userName: ctx.user.name, from: 'user', body, at: nowISO(), readByStaff: false };
      st.supportMessages.push(m);
      if (st.supportMessages.length > 500) st.supportMessages = st.supportMessages.slice(-500);
      pushNotification(st, { userId: null, type: 'support', level: 'info', title: 'پیام جدید در چت پشتیبانی', body: `${ctx.user.name}: ${body.slice(0, 100)}`, link: '#/admin/support' });
      broadcast(null, 'support', { userId: ctx.user.id, id: m.id, at: m.at });
      
      let botM = null;
      if (botReplyText) {
        botM = { id: uid('chat'), userId: ctx.user.id, userName: ctx.user.name, from: 'staff', staffName: 'پشتیبان خودکار', body: botReplyText, at: nowISO() };
        st.supportMessages.push(botM);
        m.readByStaff = true;
        pushNotification(st, { userId: ctx.user.id, type: 'support', level: 'info', title: 'پاسخ خودکار پشتیبانی', body: botReplyText.slice(0, 100), link: '#/account/support' });
        broadcast(ctx.user.id, 'support', { userId: ctx.user.id, id: botM.id, at: botM.at });
      }
      
      return { msg: m, botMsg: botM };
    });
    
    if (botReplyText) {
      notifyReply(ctx.user, botReplyText).catch(()=>{});
    }
    
    sendJson(ctx.res, 200, { ok: true, message: msg, botMessage: botMsg });
  });

  // ── پیشنهاد / شکایت / گزارش خطا ─────────────────────────
  // ── قرعه‌کشی عمومی ──
  router.get('/api/lotteries', async (ctx) => {
    const st = ctx.state;
    const me = ctx.user;
    const items = (st.lotteries || []).filter((l) => l.status !== 'closed' || (l.winners || []).length).slice(0, 10).map((l) => {
      const pool = lotteryPool(st, l);
      return {
        id: l.id, title: l.title, prize: l.prize, endsAt: l.endsAt, status: l.status,
        winners: (l.winners || []).map((w) => w.name),
        entries: Math.max(l.entries || 0, pool.length),
        myEntry: me ? pool.includes(me.id) : false,
        entryMode: l.entryMode,
      };
    });
    sendJson(ctx.res, 200, { ok: true, items, enabled: st.settings?.features?.lottery !== false });
  });
  router.post('/api/lotteries/:id/join', async (ctx) => {
    ctx.requireUser();
    const rec = await db.tx((st) => {
      const l = (st.lotteries || []).find((x) => x.id === ctx.params.id);
      if (!l || l.status !== 'active') throw badRequest('not_active', 'این قرعه‌کشی فعال نیست.');
      l.manual = l.manual || [];
      if (l.manual.includes(ctx.user.id)) throw conflict('joined', 'قبلاً شرکت کرده‌اید.');
      l.manual.push(ctx.user.id);
      logAudit(ctx.user, 'lottery.join', l.title, {});
      return l;
    });
    sendJson(ctx.res, 200, { ok: true, entries: (rec.manual || []).length });
  });

  router.post('/api/feedback', async (ctx) => {
    requireCaptcha(ctx, !ctx.user); // فقط برای مهمان‌ها
    const type = V.oneOf(ctx.body?.type, ['suggestion', 'complaint', 'bug'], 'type', 'suggestion');
    const title = V.str(ctx.body?.title, { min: 4, max: 120, field: 'عنوان' });
    const body = V.str(ctx.body?.body, { min: 10, max: 4000, field: 'توضیحات' });
    const contact = V.optStr(ctx.body?.contact, { max: 120, field: 'راه ارتباطی' });
    const page = V.optStr(ctx.body?.page, { max: 120, field: 'صفحه' });
    const attachments = V.arr(ctx.body?.attachments, { max: 3, field: 'پیوست' }).map((x) => String(x).slice(0, 200)).filter((x) => x.startsWith('/uploads/'));
    const key = ctx.user ? `fb:${ctx.user.id}` : `fb:${ctx.ip}`;
    ctx.rateLimit(key, 6, 24 * 60 * 60 * 1000);
    const rec = await db.tx((st) => {
      const f = {
        id: uid('fb'), userId: ctx.user?.id || null, userName: ctx.user?.name || 'مهمان',
        type, title, body, contact, page, attachments,
        device: { ua: ctx.ua.slice(0, 160), screen: V.optStr(ctx.body?.screen, { max: 40, field: 'screen' }) },
        status: 'new', answer: '', createdAt: nowISO(),
      };
      st.feedback.unshift(f);
      if (st.feedback.length > 500) st.feedback.length = 500;
      logAudit(ctx.user, 'feedback.create', `${type}:${title.slice(0, 40)}`, {});
      pushNotification(st, { userId: null, type: 'admin_alert', level: type === 'bug' ? 'error' : 'info', title: type === 'bug' ? `گزارش خطا: ${title}` : (type === 'complaint' ? `شکایت: ${title}` : `پیشنهاد: ${title}`), body: body.slice(0, 140), link: '#/admin/feedback' });
      return f;
    });
    sendJson(ctx.res, 200, { ok: true, id: rec.id, message: 'پیامت ثبت شد. نتیجهٔ بررسی از طریق اعلان یا راه ارتباطی‌ای که دادی اعلام می‌شود.' });
  });

  // ── بارگذاری تصویر ──────────────────────────────────────
  router.post('/api/upload', async (ctx) => {
    ctx.requireUser();
    if (!['owner', 'staff'].includes(ctx.user.role)) ctx.rateLimit(`upload:${ctx.user.id}`, 10, 24 * 60 * 60 * 1000);
    const data = String(ctx.body?.data || '');
    if (!data) throw badRequest('no_data', 'فایلی ارسال نشد.');
    const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buf.length > MAX_UPLOAD) throw new HttpError(413, 'too_large', 'حجم فایل نباید بیشتر از ۴ مگابایت باشد.');
    const found = ALLOWED_MAGIC.find((m) => m.magic.every((b, i) => buf[i] === b) && (!m.extra || buf.slice(8, 12).toString('latin1') === m.extra));
    if (!found) throw badRequest('invalid_type', 'فقط تصویر یا PDF مجاز است.');
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${found.ext}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buf);
    logAudit(ctx.user, 'upload.image', name, { bytes: buf.length });
    sendJson(ctx.res, 200, { ok: true, url: `/uploads/${name}`, size: buf.length, mime: found.mime });
  });

  // ── رویدادهای زنده (SSE) ────────────────────────────────
  router.get('/api/events', async (ctx) => {
    ctx.res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    ctx.res.write(`event: ready\ndata: ${JSON.stringify({ at: nowISO(), user: ctx.user?.id || null })}\n\n`);
    if (ctx.user) sseAdd(String(ctx.user.id), ctx.res);
    sseAdd('all', ctx.res);
    ctx.res.write('retry: 5000\n\n');
  });
}

// ── توابع کمکی ─────────────────────────────────────────────
export function restoreStock(st, order) {
  for (const it of order.items || []) {
    const p = st.products.find((x) => x.id === it.productId);
    if (p) { p.stock = (p.stock || 0) + it.qty; p.sold = Math.max(0, (p.sold || 0) - it.qty); }
  }
}

function lotteryPool(st, l) {
  const ids = new Set(l.manual || []);
  if (l.entryMode === 'orders') {
    for (const o of st.orders || []) {
      if (o.status === 'cancelled') continue;
      if (o.createdAt >= l.createdAt && (!l.endsAt || o.createdAt <= l.endsAt)) ids.add(o.userId);
    }
  }
  const pool = [...ids].filter((id) => st.users.some((u) => u.id === id));
  if (l.entries && pool.length < l.entries) {
    for (let i=0; i < l.entries; i++) pool.push('dummy_' + i);
  }
  return pool;
}

export function publicOrder(o, { full = false, withCost = false } = {}) {
  // قیمت خرید (cost) اقلام فقط برای پنل ادمین ارسال می‌شود؛
  // هرگز نباید به کاربر عادی/مهمان نشت کند.
  const items = (o.items || []).map((it) => (withCost ? it : (() => { const { cost, ...rest } = it || {}; return rest; })()));
  const base = {
    id: o.id, code: o.code, status: o.status, statusInfo: statusInfo(o.status),
    createdAt: o.createdAt, updatedAt: o.updatedAt,
    items, subtotal: o.subtotal, discount: o.discount || 0,
    plusDiscount: o.plusDiscount || 0, couponDiscount: o.couponDiscount || 0, couponCode: o.couponCode || '',
    shipping: o.shipping, shippingLabel: o.shippingLabel || '', express: !!o.express,
    insured: !!o.insured, insuranceFee: o.insuranceFee || 0,
    total: o.total, walletUsed: o.walletUsed || 0, payable: o.payable ?? o.total,
    delivery: o.delivery, zone: o.zone || null, address: o.address || null,
    payment: { method: o.payment?.method, status: o.payment?.status, ref: o.payment?.ref || '', paidAt: o.payment?.paidAt || null },
    timeline: full ? (o.timeline || []) : (o.timeline || []).slice(-3),
    note: full ? (o.note || '') : '',
    refund: o.refund || null,
  };
  if (full) {
    Object.assign(base, {
      userId: o.userId, userName: o.userName, userPhone: o.userPhone, termsAcceptedAt: o.termsAcceptedAt,
      tracking: o.tracking || o.payment?.tracking || '', adminNote: o.adminNote || '',
    });
  }
  return base;
}

function publicTicket(t, userId, full = false) {
  return {
    id: t.id, code: t.code, subject: t.subject, category: t.category, priority: t.priority,
    status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
    body: full ? undefined : String(t.body || '').slice(0, 200),
    attachments: full ? (t.attachments || []) : undefined,
    messages: full ? (t.messages || []) : (t.messages || []).slice(-2),
    messageCount: (t.messages || []).length,
    unread: full ? false : (t.messages || []).some((m) => m.from === 'staff' && (!t.readBy || !t.readBy[userId])),
  };
}

export function paymentMethods(state, total) {
  const s = state.settings.orders || {};
  const list = [];
  if (s.walletEnabled !== false) list.push({ id: 'wallet', fa: 'کیف پول', en: 'Wallet', note: 'پرداخت آنی از موجودی کیف پول' });
  if (s.gatewayEnabled !== false) list.push({ id: 'gateway', fa: 'درگاه بانکی', en: 'Bank gateway', note: s.gatewayMode === 'demo' ? 'حالت آزمایشی (بدون کسر واقعی)' : 'پرداخت امن بانکی' });
  
  // Installment integrations (mocked)
  const isEligible = total >= 1000000;
  list.push({ id: 'snapppay', fa: 'اسنپ‌پی', en: 'SnappPay', note: isEligible ? 'خرید اقساطی ۴ ماهه بدون کارمزد' : 'ویژه خریدهای بالای ۱ میلیون تومان', disabled: !isEligible });
  list.push({ id: 'azki', fa: 'ازکی‌وام', en: 'AzkiVam', note: isEligible ? 'خرید اقساطی تا ۲۴ ماه' : 'ویژه خریدهای بالای ۱ میلیون تومان', disabled: !isEligible });
  list.push({ id: 'digipay', fa: 'دیجی‌پی', en: 'DigiPay', note: isEligible ? 'پرداخت اقساطی سریع' : 'ویژه خریدهای بالای ۱ میلیون تومان', disabled: !isEligible });
  
  if (s.codEnabled !== false) list.push({ id: 'cod', fa: 'پرداخت در محل', en: 'Cash on delivery', note: 'فقط ارسال پستی تا سقف ۲۰٬۰۰۰٬۰۰۰ تومان' });
  // کارت‌به‌کارت / واریز بانکی — فقط وقتی مدیر اطلاعات بانکی را در «ابزارهای فروش» روشن و وارد کرده باشد
  if (bankTransferAvailable(state.settings)) {
    list.push({ id: 'card', fa: 'کارت به کارت / واریز بانکی', en: 'Card-to-card / bank transfer', note: 'واریز به کارت یا شبای فروشگاه و ارسال رسید؛ تأیید دستی توسط فروشگاه' });
  }
  return list;
}

/** آیا پرداخت کارت‌به‌کارت در دسترس است؟ (قابلیت روشن + حداقل شمارهٔ کارت یا شبا) */
export function bankTransferAvailable(settings) {
  const st = settings?.salesTools || {};
  if (st.bankDetailsEnabled === false) return false;
  const bd = st.bankDetails || {};
  return !!(bd.cardNumber || bd.iban);
}

export function safeCancelOrder(st, o, note, by) {
  if (['cancelled', 'refunded', 'returned'].includes(o.status)) return false;
  o.status = 'cancelled';
  o.updatedAt = new Date().toISOString();
  o.timeline.push({ status: 'cancelled', at: o.updatedAt, note, by });
  
  // 1. Restore Stock
  for (const it of o.items || []) {
    const p = st.products.find(x => x.id === it.productId);
    if (p) { p.stock = (p.stock || 0) + it.qty; p.sold = Math.max(0, (p.sold || 0) - it.qty); }
  }

  // 2. Refund wallet and paid amounts
  let refundAmount = 0;
  if (o.payment?.status === 'paid' || (o.walletUsed || 0) > 0) {
    refundAmount = (o.walletUsed || 0) + (o.payment?.status === 'paid' ? Math.max(0, o.total - (o.walletUsed || 0)) : 0);
  }
  const u = st.users.find(x => x.id === o.userId);
  if (u && refundAmount > 0) {
    u.wallet = u.wallet || { balance: 0, transactions: [] };
    u.wallet.balance += refundAmount;
    u.wallet.transactions.unshift({
      id: 'tx_' + Date.now().toString(36),
      at: o.updatedAt, type: 'refund', amount: refundAmount, status: 'done',
      note: `بازگشت وجه سفارش ${o.code}`, ref: o.payment?.ref || ''
    });
    if (u.wallet.transactions.length > 50) u.wallet.transactions.length = 50;
    o.refund = { amount: refundAmount, method: 'wallet', at: o.updatedAt };
  }
  // 3. Restore Coupon
  if (o.couponCode) { const cp = st.coupons.find(c => c.code === o.couponCode); if (cp && cp.used > 0) cp.used--; }
  const wasPaidForStats = o.payment?.status === 'paid';
  if (o.payment) {
    o.payment.status = (o.payment.status !== 'paid' && o.payment.status !== 'failed') ? 'cancelled' : 'refunded';
  }

  if (wasPaidForStats && st.stats) {
    st.stats.revenueTotal = Math.max(0, (st.stats.revenueTotal || 0) - o.total);
    st.stats.ordersTotal = Math.max(0, (st.stats.ordersTotal || 0) - 1);
  }
  const vd = o.visitDay || o.createdAt.slice(0, 10);
  if (st.visits && st.visits[vd] && st.visits[vd].orders > 0) {
    st.visits[vd].orders--;
  }

  // 3. Retract loyalty points
  if (u) {
    const pts = Math.floor(o.total / 100000);
    if (pts > 0) u.points = Math.max(0, (u.points || 0) - pts);
  }
  return { refunded: refundAmount };
}
