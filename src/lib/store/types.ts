// ── Yassaei Electronics — shared types (mirror of backend contract) ──

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  glyph: string;
  parentId: string | null;
  order: number;
  active: boolean;
  image?: string;
  count?: number;
}

export interface Brand {
  id: string;
  name: string;
  nameEn: string;
  active: boolean;
  country: string;
  image?: string;
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
  stock: number;
  reserved: number;
  authenticity: string;
  warrantyMonths: number;
  images: string[];
  specs: Record<string, string>;
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
  condition: string;
  createdAt: string;
  updatedAt: string;
  /** Per-product wholesale tier override (null/undefined → global tiers). */
  bulkTiers?: BulkTier[] | null;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  unitPrice?: number;
  bulkPercent?: number;
}

/** Quantity-tier wholesale discount (mirror of backend BulkTier). */
export interface BulkTier {
  minQty: number;
  percent: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "done" | "canceled";

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
  shipping: string;
  payment: string;
  couponCode?: string;
  userId: string | null;
  bulkDiscount?: number;
  statusHistory?: OrderStatusEvent[];
  createdAt: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface StoreInfo {
  name: string;
  nameEn: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  workingHours: { day: string; fa: string; en: string; time: string; timeEn: string }[];
  socials: Record<string, string>;
  established: number;
  description: string;
  hours: string;
}

export interface HomePayload {
  categories: (Category & { image: string; count: number })[];
  brands: (Brand & { image: string })[];
  featured: Product[];
  deals: Product[];
  newest: Product[];
  bestSellers: Product[];
  stats: { products: number; orders: number; users: number };
  ticker: string[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
}

export interface ProductQuery {
  cat?: string;
  brand?: string;
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  min?: number;
  max?: number;
  inStock?: boolean;
  featured?: boolean;
}

export interface CartValidatedItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  qty: number;
  image: string;
  active: boolean;
  unitPrice?: number;
  bulkPercent?: number;
}

/** Product Q&A: guests ask, staff answers (mirror of backend). */
export interface QAQuestion {
  id: string;
  productId: string;
  name: string;
  question: string;
  answer?: string;
  answeredAt?: string | null;
  helpful?: number;
  createdAt: string;
}

/** One order status transition (mirror of backend). */
export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}
