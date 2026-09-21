// ── Yassaei Electronics — API client (same-origin /api → Next rewrite → backend:4000) ──
import type {
  Brand, BulkTier, Category, CartValidatedItem, HomePayload, Order, Paged,
  Product, ProductQuery, QAQuestion, Review, StoreInfo, User,
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
  /** Fetch active products by explicit ids (wishlist / compare / recently-viewed). */
  productsByIds: async (ids: string[]): Promise<Product[]> => {
    if (ids.length === 0) return [];
    const res = await get<Paged<Product>>(
      `/api/products${qs({ ids: ids.join(","), perPage: 100 })}`,
    );
    // keep the caller's ordering, skip missing ids
    const byId = new Map(res.items.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  },
  product: (id: string) => get<{ product: Product; category: Category | null; brand: Brand | null; related: Product[] }>(`/api/products/${id}`),
  suggest: (q: string) => get<{ suggestions: Pick<Product, "id" | "name" | "price" | "images">[] }>(`/api/search/suggest${qs({ q })}`),
  page: (slug: string) => get<Record<string, unknown>>(`/api/pages/${slug}`),
  reviews: (productId: string) => get<Review[]>(`/api/products/${productId}/reviews`),
  /** Public product Q&A (answered first, newest first). */
  questions: (productId: string) =>
    get<{ questions: QAQuestion[]; total: number; answered: number }>(`/api/products/${productId}/questions`),
  /** Guest-friendly: ask a question about a product (no login required). */
  askQuestion: (productId: string, payload: { name: string; question: string }) =>
    post<{ question: QAQuestion }>(`/api/products/${productId}/questions`, payload),
  /** Vote an answer helpful (up) or retract (down) — localStorage-guarded on the client. */
  voteQuestion: (id: string, vote: "up" | "down") =>
    post<{ helpful: number }>(`/api/questions/${id}/vote`, { vote }),
  /** Quantity-tier wholesale discount tiers. */
  bulkTiers: () => get<{ tiers: BulkTier[] }>("/api/bulk-tiers"),
  /** Backend storage health — PostgreSQL when connected, JSON-file fallback otherwise. */
  health: () =>
    get<{
      ok: boolean;
      store: "postgres" | "json";
      db: {
        store?: string; database?: string; server?: string; latencyMs?: number;
        products?: number; orders?: number; users?: number; reviews?: number; questions?: number;
        file?: string; sizeKB?: number; error?: string;
      };
    }>("/api/health"),

  // Auth
  login: (username: string, password: string) => post<{ token: string; user: User }>("/api/auth/login", { username, password }),
  register: (payload: { name: string; username: string; phone: string; password: string }) =>
    post<{ token: string; user: User }>("/api/auth/register", payload),
  me: () => get<{ user: User }>("/api/auth/me"),

  // Shop
  validateCart: (items: { id: string; qty: number }[]) =>
    post<{ items: CartValidatedItem[]; subtotal: number; bulkDiscount: number }>("/api/cart/validate", { items }),
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
  /** Guest order tracking: code + checkout phone must match. */
  trackOrder: (code: string, phone: string) => post<{ order: Order }>("/api/orders/track", { code, phone }),
  addReview: (payload: { productId: string; rating: number; comment: string }) => post<Review>("/api/reviews", payload),

  // Admin
  adminStats: () =>
    get<{
      products: number; lowStock: number; lowStockThreshold?: number; orders: number; ordersTotal: number;
      revenueTotal: number; users: number; ordersByStatus: Record<string, number>;
      recentOrders: Order[]; topProducts: Pick<Product, "id" | "name" | "sold" | "price">[];
      dailyRevenue: { day: string; label: string; total: number; count: number }[];
    }>("/api/admin/stats"),
  adminSettings: () => get<{ inventory: { lowStockThreshold: number } }>("/api/admin/settings"),
  adminUpdateSettings: (patchBody: { inventory?: { lowStockThreshold?: number } }) =>
    patch<{ inventory: { lowStockThreshold: number } }>("/api/admin/settings", patchBody),
  adminProducts: (q: { page?: number; perPage?: number; q?: string; cat?: string }) =>
    get<Paged<Product>>(`/api/admin/products${qs({ perPage: 12, ...q })}`),
  adminCreateProduct: (payload: Partial<Product> & { name: string; price: number; categoryId: string; stock: number }) =>
    post<{ product: Product }>("/api/admin/products", payload),
  adminUpdateProduct: (id: string, patchBody: Partial<Product>) => patch<{ product: Product }>(`/api/admin/products/${id}`, patchBody),
  adminDeleteProduct: (id: string) => del<{ ok: boolean }>(`/api/admin/products/${id}`),
  adminOrders: (q: { page?: number; status?: string; q?: string }) => get<Paged<Order>>(`/api/admin/orders${qs(q)}`),
  adminUpdateOrder: (id: string, status: string) => patch<{ order: Order }>(`/api/admin/orders/${id}`, { status }),
  adminUsers: () => get<User[]>("/api/admin/users"),
  adminQuestions: (q?: { status?: string; page?: number; perPage?: number }) =>
    get<Paged<QAQuestion & { productName?: string }> & { pending: number }>(`/api/admin/questions${qs(q ?? {})}`),
  adminQuestionsCount: () => get<{ pending: number; total: number }>("/api/admin/questions/count"),
  adminAnswerQuestion: (id: string, answer: string) =>
    patch<{ question: QAQuestion }>(`/api/admin/questions/${id}`, { answer }),
  adminDeleteQuestion: (id: string) => del<{ ok: boolean }>(`/api/admin/questions/${id}`),
};
