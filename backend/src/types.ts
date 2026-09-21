/**
 * Domain types for the Yassaei Electronics backend.
 * Mirrors the shape of backend/data/db.json (seeded from the original repo).
 */

export type Role = 'owner' | 'staff' | 'customer';

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  glyph: string;
  parentId: string | null;
  order: number;
  active: boolean;
  description: string;
  descriptionEn: string;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  nameEn: string;
  active: boolean;
  country: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  nameEn: string;
  categoryId: string;
  brandId: string;
  brandName: string;
  brandNameEn: string;
  glyph: string;
  price: number;
  oldPrice: number | null;
  cost: number;
  stock: number;
  reserved: number;
  authenticity: string;
  warrantyMonths: number;
  images: string[];
  specs: Record<string, string | number>;
  description: string;
  descriptionEn: string;
  tags: string[];
  featured: boolean;
  active: boolean;
  weight: number;
  views: number;
  sold: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  condition: string;
}

export interface Coupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  active: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  phone: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Public user shape (never expose passwordHash). */
export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  phone: string;
}

export interface Session {
  token: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'done' | 'canceled';
export type ShippingMethod = 'post' | 'peyk' | 'pickup';
export type PaymentMethod = 'online' | 'cod';

export interface Order {
  id: string;
  code: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  customer: OrderCustomer;
  shipping: ShippingMethod;
  payment: PaymentMethod;
  createdAt: string;
  userId: string | null;
  couponCode?: string | null;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface DBStats {
  ordersTotal: number;
  revenueTotal: number;
}

/** Page content dicts are free-form (hero/sections/stats/...). */
export type PageDict = Record<string, unknown>;

export interface Settings {
  store?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  features?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
  plus?: Record<string, unknown>;
  orders?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  currency?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  partners?: Record<string, unknown>;
  security?: Record<string, unknown>;
  telegram?: Record<string, unknown>;
  translations?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DBState {
  version: number;
  seededAt: string;
  settings: Settings;
  categories: Category[];
  brands: Brand[];
  products: Product[];
  pages: Record<string, PageDict>;
  coupons: Coupon[];
  users: User[];
  sessions: Session[];
  orders: Order[];
  reviews: Review[];
  stats: DBStats;
}

/* ---------- request context / router ---------- */

export interface RouteCtx {
  req: Request;
  url: URL;
  params: Record<string, string>;
}

export type RouteHandler = (ctx: RouteCtx) => Response | Promise<Response>;

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  pattern: RegExp;
  handler: RouteHandler;
}
