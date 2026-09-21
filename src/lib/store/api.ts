// ── Yassaei Electronics — API client (same-origin /api → Next rewrite → backend:4000) ──
import type {
  Brand, Category, CartValidatedItem, HomePayload, Order, Paged,
  Product, ProductQuery, Review, StoreInfo, User,
} from "./types";

const TOKEN_KEY = "yassaei.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) ||
      `خطای ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== false && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

// ── Catalog ──
export const api = {
  home: () => get<HomePayload>("/api/home"),
  settings: () => get<{ store: StoreInfo; ui: Record<string, unknown>; features: Record<string, unknown> }>("/api/settings"),
  categories: () => get<(Category & { image: string; count: number })[]>("/api/categories"),
  brands: () => get<Brand[]>("/api/brands"),
  products: (q: ProductQuery) =>
    get<Paged<Product>>(
      `/api/products${qs({
        cat: q.cat, brand: q.brand, q: q.q, sort: q.sort, page: q.page,
        perPage: q.perPage, min: q.min, max: q.max,
        inStock: q.inStock ? 1 : undefined, featured: q.featured ? 1 : undefined,
      })}`,
    ),
  product: (id: string) => get<{ product: Product; category: Category | null; brand: Brand | null; related: Product[] }>(`/api/products/${id}`),
  suggest: (q: string) => get<{ suggestions: Pick<Product, "id" | "name" | "price" | "images">[] }>(`/api/search/suggest${qs({ q })}`),
  page: (slug: string) => get<Record<string, unknown>>(`/api/pages/${slug}`),
  reviews: (productId: string) => get<Review[]>(`/api/products/${productId}/reviews`),

  // Auth
  login: (username: string, password: string) => post<{ token: string; user: User }>("/api/auth/login", { username, password }),
  register: (payload: { name: string; username: string; phone: string; password: string }) =>
    post<{ token: string; user: User }>("/api/auth/register", payload),
  me: () => get<{ user: User }>("/api/auth/me"),

  // Shop
  validateCart: (items: { id: string; qty: number }[]) =>
    post<{ items: CartValidatedItem[]; subtotal: number }>("/api/cart/validate", { items }),
  validateCoupon: (code: string, subtotal: number) =>
    post<{ ok: boolean; code: string; type: string; value: number; discount: number }>("/api/coupon/validate", { code, subtotal }),
  placeOrder: (payload: {
    items: { id: string; qty: number }[];
    customer: { name: string; phone: string; address: string; note?: string };
    shipping: string;
    payment: string;
    couponCode?: string;
  }) => post<{ order: Order }>("/api/orders", payload),
  myOrders: () => get<Order[]>("/api/orders"),
  order: (id: string) => get<{ order: Order }>(`/api/orders/${id}`),
  addReview: (payload: { productId: string; rating: number; comment: string }) => post<Review>("/api/reviews", payload),

  // Admin
  adminStats: () =>
    get<{
      products: number; lowStock: number; orders: number; ordersTotal: number;
      revenueTotal: number; users: number; ordersByStatus: Record<string, number>;
      recentOrders: Order[]; topProducts: Pick<Product, "id" | "name" | "sold" | "price">[];
    }>("/api/admin/stats"),
  adminProducts: (q: { page?: number; perPage?: number; q?: string; cat?: string }) =>
    get<Paged<Product>>(`/api/admin/products${qs({ perPage: 12, ...q })}`),
  adminCreateProduct: (payload: Partial<Product> & { name: string; price: number; categoryId: string; stock: number }) =>
    post<{ product: Product }>("/api/admin/products", payload),
  adminUpdateProduct: (id: string, patchBody: Partial<Product>) => patch<{ product: Product }>(`/api/admin/products/${id}`, patchBody),
  adminDeleteProduct: (id: string) => del<{ ok: boolean }>(`/api/admin/products/${id}`),
  adminOrders: (q: { page?: number; status?: string }) => get<Paged<Order>>(`/api/admin/orders${qs(q)}`),
  adminUpdateOrder: (id: string, status: string) => patch<{ order: Order }>(`/api/admin/orders/${id}`, { status }),
  adminUsers: () => get<User[]>("/api/admin/users"),
};
