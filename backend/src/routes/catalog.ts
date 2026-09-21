/** Public catalog routes: settings, home, categories, brands, products, suggest, pages, reviews. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Brand, Category, DBState, Product } from '../types';
import { PUBLIC_DIR } from '../config';
import type { Store } from '../db';
import { HttpError, json, normalizeText, num, paginate } from '../util';

/* ---------- image resolution (frontend serves the actual files) ---------- */

function fileExists(relPath: string): boolean {
  return existsSync(path.join(PUBLIC_DIR, relPath));
}

export function categoryImage(db: DBState, cat: Category): string {
  const svg = `/uploads/cat-${cat.id}.svg`;
  if (fileExists(svg)) return svg;
  const firstProduct = db.products.find((p) => p.categoryId === cat.id && p.active !== false && p.images.length > 0);
  return firstProduct?.images[0] ?? '';
}

export function brandImage(brand: Brand): string {
  const svg = `/assets/img/brands/${brand.id}.svg`;
  if (fileExists(svg)) return svg;
  return '/assets/img/brands/no_name.svg';
}

export interface CategoryView {
  id: string;
  name: string;
  nameEn: string;
  glyph: string;
  image: string;
  count: number;
}

export function categoryView(db: DBState, cat: Category): CategoryView {
  const count = db.products.filter((p) => p.categoryId === cat.id && p.active !== false).length;
  return {
    id: cat.id,
    name: cat.name,
    nameEn: cat.nameEn,
    glyph: cat.glyph,
    image: categoryImage(db, cat),
    count,
  };
}

export interface BrandView {
  id: string;
  name: string;
  nameEn: string;
  image: string;
}

/* ---------- search & sort ---------- */

export function productHaystack(p: Product): string {
  return normalizeText(
    [p.name, p.nameEn, (p.tags ?? []).join(' '), p.sku, p.id].join(' '),
  );
}

export function matchesQuery(p: Product, qNorm: string): boolean {
  if (!qNorm) return true;
  const haystack = productHaystack(p);
  return qNorm.split(' ').every((token) => haystack.includes(token));
}

export function normalizeQuery(raw: string | null): string {
  return normalizeText(raw ?? '');
}

type Sorter = (a: Product, b: Product) => number;

const SORTERS: Record<string, Sorter> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  cheap: (a, b) => a.price - b.price || a.id.localeCompare(b.id),
  expensive: (a, b) => b.price - a.price || a.id.localeCompare(b.id),
  popular: (a, b) => b.sold - a.sold || b.views - a.views || a.id.localeCompare(b.id),
  rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || a.id.localeCompare(b.id),
};

/* ---------- handlers ---------- */

export function getSettings(store: Store): Response {
  const s = store.db.settings;
  return json({
    store: s.store ?? {},
    ui: s.ui ?? {},
    features: s.features ?? {},
  });
}

export function getHome(store: Store): Response {
  const db = store.db;
  const active = db.products.filter((p) => p.active !== false);

  const categories = db.categories
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))
    .map((c) => categoryView(db, c));

  const brands: BrandView[] = db.brands
    .filter((b) => b.active !== false)
    .map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn, image: brandImage(b) }));

  const featured = active
    .filter((p) => p.featured === true)
    .sort(SORTERS.newest)
    .slice(0, 8);

  const deals = active
    .filter((p): p is Product & { oldPrice: number } => p.oldPrice !== null && p.oldPrice > p.price)
    .sort((a, b) => (b.oldPrice - b.price) / b.oldPrice - (a.oldPrice - a.price) / a.oldPrice)
    .slice(0, 8);

  const newest = [...active].sort(SORTERS.newest).slice(0, 8);
  const bestSellers = [...active].sort(SORTERS.popular).slice(0, 8);

  const tickerItems = db.settings.ui?.['tickerItems'];
  const ticker = Array.isArray(tickerItems) ? tickerItems.map((t) => String(t)) : [];

  return json({
    categories,
    brands,
    featured,
    deals,
    newest,
    bestSellers,
    stats: {
      products: active.length,
      orders: db.orders.length,
      users: db.users.length,
    },
    ticker,
  });
}

export function getCategories(store: Store): Response {
  const db = store.db;
  const categories = db.categories
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))
    .map((c) => categoryView(db, c));
  return json(categories);
}

export function getBrands(store: Store): Response {
  const db = store.db;
  const brands = db.brands
    .filter((b) => b.active !== false)
    .map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn, image: brandImage(b), country: b.country }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return json(brands);
}

/** Shared product filtering for the public list (admin list reuses matchesQuery). */
export function filterProducts(db: DBState, url: URL): Product[] {
  const cat = url.searchParams.get('cat');
  const brand = url.searchParams.get('brand');
  const q = normalizeQuery(url.searchParams.get('q'));
  const min = num(url.searchParams.get('min'));
  const max = num(url.searchParams.get('max'));
  const inStock = url.searchParams.get('inStock') === '1';
  const featured = url.searchParams.get('featured') === '1';

  return db.products.filter((p) => {
    if (p.active === false) return false;
    if (cat && p.categoryId !== cat) return false;
    if (brand && p.brandId !== brand) return false;
    if (min !== undefined && p.price < min) return false;
    if (max !== undefined && p.price > max) return false;
    if (inStock && p.stock <= 0) return false;
    if (featured && p.featured !== true) return false;
    return matchesQuery(p, q);
  });
}

export function listProducts(store: Store, url: URL): Response {
  const db = store.db;
  const sortKey = url.searchParams.get('sort') ?? 'newest';
  const sorter = SORTERS[sortKey] ?? SORTERS.newest;
  const sorted = [...filterProducts(db, url)].sort(sorter);
  const result = paginate(sorted, url.searchParams.get('page'), url.searchParams.get('perPage'), 12, 100);
  return json(result);
}

export function getProduct(store: Store, id: string): Response {
  const db = store.db;
  const product = db.products.find((p) => p.id === id || p.sku === id.toUpperCase());
  if (!product || product.active === false) throw new HttpError(404, 'محصول یافت نشد');

  // count the view (persisted)
  store.transaction((d) => {
    const p = d.products.find((x) => x.id === product.id);
    if (p) p.views += 1;
  });

  const category = db.categories.find((c) => c.id === product.categoryId) ?? null;
  const brand = db.brands.find((b) => b.id === product.brandId) ?? null;
  const related = db.products
    .filter((p) => p.active !== false && p.id !== product.id && p.categoryId === product.categoryId)
    .sort((a, b) => b.sold - a.sold || b.ratingAvg - a.ratingAvg || a.id.localeCompare(b.id))
    .slice(0, 4);

  return json({
    product,
    category,
    brand,
    related,
  });
}

export function suggest(store: Store, url: URL): Response {
  const db = store.db;
  const q = normalizeQuery(url.searchParams.get('q'));
  if (!q) return json({ suggestions: [] });
  const suggestions = db.products
    .filter((p) => p.active !== false && matchesQuery(p, q))
    .sort((a, b) => b.sold - a.sold || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.images[0] ?? '',
      brand: p.brandName,
    }));
  return json({ suggestions });
}

export function getPage(store: Store, slug: string): Response {
  const page = store.db.pages[slug];
  if (!page) throw new HttpError(404, 'صفحه یافت نشد');
  return json(page);
}

export function getProductReviews(store: Store, id: string): Response {
  const db = store.db;
  const product = db.products.find((p) => p.id === id || p.sku === id.toUpperCase());
  if (!product) throw new HttpError(404, 'محصول یافت نشد');
  const reviews = db.reviews
    .filter((r) => r.productId === product.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      id: r.id,
      userName: r.userName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
  return json(reviews);
}
