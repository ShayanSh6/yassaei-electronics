/** Admin routes: stats, product CRUD, order management, users. All require owner|staff. */
import type { Order, OrderStatus, OrderStatusEvent, Product } from '../types';
import type { Store } from '../db';
import { requireAdmin } from '../auth';
import {
  HttpError,
  bool,
  int,
  json,
  nowISO,
  paginate,
  readJson,
  requireInt,
  requireStr,
  str,
} from '../util';
import { matchesQuery, normalizeQuery } from './catalog';
import { sanitizeBulkTiers } from './shop';

const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'done', 'canceled'];

/* ---------- stats ---------- */

/** Low-stock threshold from settings (default 5, clamped 1..100). */
export function lowStockThreshold(store: Store): number {
  const raw = store.db.settings.inventory?.lowStockThreshold;
  const n = typeof raw === 'number' ? Math.round(raw) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : 5;
}

export function adminStats(store: Store, req: Request): Response {
  requireAdmin(store, req);
  const db = store.db;
  const threshold = lowStockThreshold(store);

  const ordersByStatus = { pending: 0, processing: 0, shipped: 0, done: 0, canceled: 0 };
  let ordersTotal = 0;
  let revenueTotal = 0;
  for (const o of db.orders) {
    if (ordersByStatus[o.status] !== undefined) ordersByStatus[o.status] += 1;
    ordersTotal += o.total;
    if (o.status !== 'canceled') revenueTotal += o.total;
  }

  const recentOrders = [...db.orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 8);

  const topProducts = [...db.products]
    .sort((a, b) => b.sold - a.sold || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((p) => ({ id: p.id, name: p.name, sold: p.sold, price: p.price }));

  // revenue per day for the last 14 days (non-canceled), oldest → newest
  const daily: { day: string; label: string; total: number; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daily.push({ day: key, label: `${d.getMonth() + 1}/${d.getDate()}`, total: 0, count: 0 });
  }
  const byDay = new Map(daily.map((d) => [d.day, d]));
  for (const o of db.orders) {
    if (o.status === 'canceled') continue;
    const day = String(o.createdAt).slice(0, 10);
    const slot = byDay.get(day);
    if (slot) {
      slot.total += o.total;
      slot.count += 1;
    }
  }

  return json({
    products: db.products.length,
    lowStock: db.products.filter((p) => p.stock < threshold).length,
    lowStockThreshold: threshold,
    orders: db.orders.length,
    ordersTotal,
    revenueTotal,
    users: db.users.length,
    ordersByStatus,
    recentOrders,
    topProducts,
    dailyRevenue: daily,
  });
}

/* ---------- settings ---------- */

export function adminGetSettings(store: Store, req: Request): Response {
  requireAdmin(store, req);
  return json({
    inventory: {
      lowStockThreshold: lowStockThreshold(store),
    },
  });
}

export async function adminPatchSettings(store: Store, req: Request): Promise<Response> {
  requireAdmin(store, req);
  const body = await readJson(req);
  const inventory = body.inventory;
  if (inventory !== undefined) {
    if (typeof inventory !== 'object' || inventory === null) {
      throw new HttpError(400, 'بخش تنظیمات نامعتبر است');
    }
    const raw = (inventory as Record<string, unknown>).lowStockThreshold;
    if (raw !== undefined) {
      const n = typeof raw === 'number' ? Math.round(raw) : NaN;
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        throw new HttpError(400, 'آستانهٔ کم‌موجودی باید عددی بین ۱ تا ۱۰۰ باشد');
      }
      store.transaction((db) => {
        db.settings.inventory = { ...(db.settings.inventory ?? {}), lowStockThreshold: n };
      });
    }
  }
  return adminGetSettings(store, req);
}

/* ---------- products ---------- */

export function adminListProducts(store: Store, req: Request, url: URL): Response {
  requireAdmin(store, req);
  const db = store.db;
  const q = normalizeQuery(url.searchParams.get('q'));
  const cat = url.searchParams.get('cat');

  const filtered = db.products.filter((p) => {
    if (cat && p.categoryId !== cat) return false;
    return matchesQuery(p, q);
  });
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const result = paginate(filtered, url.searchParams.get('page'), url.searchParams.get('perPage'), 20, 100);
  return json(result);
}

interface ProductCreateBody {
  name?: unknown;
  nameEn?: unknown;
  categoryId?: unknown;
  brandId?: unknown;
  price?: unknown;
  oldPrice?: unknown;
  stock?: unknown;
  [key: string]: unknown;
}

function nextProductId(db: { products: Product[] }): { id: string; sku: string } {
  let max = 0;
  for (const p of db.products) {
    const m = /^ys-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = max + 1;
  return { id: `ys-${String(n).padStart(3, '0')}`, sku: `YS-${String(n).padStart(3, '0')}` };
}

export async function adminCreateProduct(store: Store, req: Request): Promise<Response> {
  requireAdmin(store, req);
  const body = (await readJson(req)) as ProductCreateBody;

  const name = requireStr(body.name, 'نام محصول الزامی است', 2);
  const categoryId = str(body.categoryId).trim();
  const price = requireInt(body.price, 'قیمت باید عددی نامنفی باشد');
  const stock = requireInt(body.stock, 'موجودی باید عددی نامنفی باشد');

  const product = store.transaction<Product>((db) => {
    const category = db.categories.find((c) => c.id === categoryId);
    if (!category) throw new HttpError(400, 'دسته‌بندی نامعتبر است');
    const brandId = str(body.brandId).trim() || 'gen';
    const brand = db.brands.find((b) => b.id === brandId);
    if (!brand) throw new HttpError(400, 'برند نامعتبر است');

    const { id, sku } = nextProductId(db);
    const oldPriceRaw = body.oldPrice;
    const oldPrice =
      oldPriceRaw === undefined || oldPriceRaw === null || oldPriceRaw === ''
        ? null
        : typeof oldPriceRaw === 'number' && Number.isFinite(oldPriceRaw) && oldPriceRaw > 0
          ? oldPriceRaw
          : null;

    const p: Product = {
      id,
      sku,
      barcode: str(body.barcode),
      name,
      nameEn: str(body.nameEn),
      categoryId,
      brandId,
      brandName: brand.name,
      brandNameEn: brand.nameEn,
      glyph: str(body.glyph) || category.glyph,
      price,
      oldPrice,
      cost: int(body.cost) ?? price,
      stock,
      reserved: int(body.reserved) ?? 0,
      authenticity: str(body.authenticity) || 'original',
      warrantyMonths: int(body.warrantyMonths) ?? 0,
      images: Array.isArray(body.images) && body.images.every((i) => typeof i === 'string')
        ? (body.images as string[])
        : [`/uploads/cat-${categoryId}.svg`],
      specs: body.specs && typeof body.specs === 'object' && !Array.isArray(body.specs)
        ? (body.specs as Record<string, string | number>)
        : {},
      description: str(body.description),
      descriptionEn: str(body.descriptionEn),
      tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map((t) => String(t)) : [],
      featured: bool(body.featured) ?? false,
      active: bool(body.active) ?? true,
      weight: int(body.weight) ?? 0,
      views: 0,
      sold: 0,
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      condition: str(body.condition) || 'new',
      bulkTiers: sanitizeBulkTiers(body.bulkTiers) ?? null,
    };
    db.products.push(p);
    return p;
  });

  return json({ product }, 201);
}

const PRODUCT_STRING_FIELDS = [
  'name',
  'nameEn',
  'barcode',
  'glyph',
  'description',
  'descriptionEn',
  'condition',
  'authenticity',
  'categoryId',
  'brandId',
] as const;

const PRODUCT_NUMBER_FIELDS = ['price', 'stock', 'reserved', 'warrantyMonths', 'weight', 'cost'] as const;

export async function adminPatchProduct(store: Store, req: Request, id: string): Promise<Response> {
  requireAdmin(store, req);
  const body = await readJson(req);

  const product = store.transaction<Product>((db) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new HttpError(404, 'محصول یافت نشد');

    for (const field of PRODUCT_STRING_FIELDS) {
      if (body[field] !== undefined) p[field] = str(body[field]);
    }
    for (const field of PRODUCT_NUMBER_FIELDS) {
      if (body[field] !== undefined) {
        const n = int(body[field]);
        if (n === undefined || n < 0) throw new HttpError(400, `مقدار ${field} نامعتبر است`);
        p[field] = n;
      }
    }
    if (body.oldPrice !== undefined) {
      if (body.oldPrice === null || body.oldPrice === '') {
        p.oldPrice = null;
      } else {
        const n = int(body.oldPrice);
        if (n === undefined || n < 0) throw new HttpError(400, 'قیمت قبل از تخفیف نامعتبر است');
        p.oldPrice = n;
      }
    }
    if (body.featured !== undefined) {
      p.featured = bool(body.featured) ?? p.featured;
    }
    if (body.active !== undefined) {
      p.active = bool(body.active) ?? p.active;
    }
    if (body.images !== undefined) {
      if (!Array.isArray(body.images) || !body.images.every((i) => typeof i === 'string')) {
        throw new HttpError(400, 'لیست تصاویر نامعتبر است');
      }
      p.images = body.images as string[];
    }
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) throw new HttpError(400, 'لیست برچسب‌ها نامعتبر است');
      p.tags = (body.tags as unknown[]).map((t) => String(t));
    }
    if (body.specs !== undefined) {
      if (!body.specs || typeof body.specs !== 'object' || Array.isArray(body.specs)) {
        throw new HttpError(400, 'مشخصات نامعتبر است');
      }
      p.specs = body.specs as Record<string, string | number>;
    }
    {
      const tiers = sanitizeBulkTiers(body.bulkTiers);
      if (tiers !== undefined) p.bulkTiers = tiers;
    }

    // keep denormalized brand names in sync
    const brand = db.brands.find((b) => b.id === p.brandId);
    if (brand) {
      p.brandName = brand.name;
      p.brandNameEn = brand.nameEn;
    }

    p.updatedAt = nowISO();
    return p;
  });

  return json({ product });
}

export function adminDeleteProduct(store: Store, req: Request, id: string): Response {
  requireAdmin(store, req);
  store.transaction((db) => {
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new HttpError(404, 'محصول یافت نشد');
    db.products.splice(idx, 1);
  });
  return json({ ok: true });
}

/* ---------- orders ---------- */

export function adminListOrders(store: Store, req: Request, url: URL): Response {
  requireAdmin(store, req);
  const db = store.db;
  const status = url.searchParams.get('status');
  const q = normalizeQuery(url.searchParams.get('q'));
  let filtered = [...db.orders];
  if (status) {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new HttpError(400, 'وضعیت سفارش نامعتبر است');
    }
    filtered = filtered.filter((o) => o.status === status);
  }
  if (q) {
    const digits = q.replace(/\D/g, '');
    filtered = filtered.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        normalizeQuery(o.customer.name).includes(q) ||
        (digits.length > 0 && o.customer.phone.replace(/\D/g, '').includes(digits)) ||
        o.items.some((it) => normalizeQuery(it.name).includes(q)),
    );
  }
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const result = paginate(filtered, url.searchParams.get('page'), url.searchParams.get('perPage'), 20, 100);
  return json(result);
}

export async function adminPatchOrder(store: Store, req: Request, id: string): Promise<Response> {
  requireAdmin(store, req);
  const body = await readJson(req);
  const status = str(body.status).trim() as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'وضعیت سفارش نامعتبر است');

  const order = store.transaction<Order>((db) => {
    const o = db.orders.find((x) => x.id === id || x.code === id.toUpperCase());
    if (!o) throw new HttpError(404, 'سفارش یافت نشد');
    if (o.status === status) return o;

    if (status === 'canceled') {
      // restock
      for (const item of o.items) {
        const p = db.products.find((x) => x.id === item.id);
        if (p) {
          p.stock += item.qty;
          p.sold = Math.max(0, p.sold - item.qty);
          p.updatedAt = nowISO();
        }
      }
    } else if (o.status === 'canceled') {
      // leaving canceled → re-deduct stock, verifying availability first
      for (const item of o.items) {
        const p = db.products.find((x) => x.id === item.id);
        if (!p) throw new HttpError(400, `محصول ${item.id} دیگر موجود نیست`);
        if (p.stock < item.qty) {
          throw new HttpError(400, `موجودی «${p.name}» کافی نیست (موجودی: ${p.stock})`);
        }
      }
      for (const item of o.items) {
        const p = db.products.find((x) => x.id === item.id);
        if (p) {
          p.stock -= item.qty;
          p.sold += item.qty;
          p.updatedAt = nowISO();
        }
      }
    }

    o.status = status;
    // append to the audit trail (cap 20 entries)
    const history: OrderStatusEvent[] = Array.isArray(o.statusHistory) ? o.statusHistory : [];
    if (history.length === 0) history.push({ status: 'pending', at: o.createdAt }); // seed origin for old orders
    if (history[history.length - 1]?.status !== status) {
      history.push({ status, at: nowISO() });
    }
    o.statusHistory = history.slice(-20);
    return o;
  });

  return json({ order });
}

/* ---------- users ---------- */

export function adminListUsers(store: Store, req: Request): Response {
  requireAdmin(store, req);
  const users = store.db.users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    phone: u.phone,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));
  return json(users);
}
