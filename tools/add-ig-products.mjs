// افزودن محصولات اینستاگرام (@jam.yassaei) به دیتابیس موجود
// اجرا: node tools/add-ig-products.mjs   (سرور باید خاموش باشد)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ean13 } from '../server/seed.mjs';
import { IG_BRANDS, IG_CATEGORIES, IG_RAW } from '../server/ig-products.mjs';
import { writeProductImages } from '../server/art.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DB = path.join(ROOT, 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const now = new Date();

for (const b of IG_BRANDS) if (!db.brands.some((x) => x.id === b.id)) {
  db.brands.push({ id: b.id, name: b.fa, nameEn: b.en, active: true, country: '', createdAt: now.toISOString() });
}
for (const c of IG_CATEGORIES) if (!db.categories.some((x) => x.id === c.id)) {
  db.categories.push({ id: c.id, name: c.fa, nameEn: c.en, glyph: c.glyph, parentId: null, order: c.order, active: true, description: '', descriptionEn: '', createdAt: now.toISOString() });
}
const brandMap = new Map(db.brands.map((b) => [b.id, b]));
let added = 0;
for (const r of IG_RAW) {
  const [name, nameEn, categoryId, brandId, price, oldPrice, stock, authenticity, warrantyMonths, glyph, specs, description, descriptionEn, tags] = r;
  const probe = db.products.find((p) => p.name === name);
  if (probe) continue;
  const i = db.products.length;
  const id = `p${String(i + 1).padStart(3, '0')}`;
  const brand = brandMap.get(brandId) || brandMap.get('no_name');
  db.products.push({
    id, sku: `BM-${1000 + i}`, barcode: ean13(`200${String(100000000 + i * 7919).slice(0, 9)}`),
    name, nameEn, categoryId, brandId, brandName: brand.name, brandNameEn: brand.nameEn,
    glyph: glyph === 'watch' ? 'wearable' : glyph,
    price, oldPrice: oldPrice || 0, cost: Math.round(price * 0.72),
    stock, reserved: 0, authenticity, warrantyMonths,
    images: [`/assets/img/products/${id}.svg`],
    specs, description, descriptionEn, tags: tags || [],
    featured: i % 7 === 0, active: true,
    weight: 120 + (i * 37) % 900, views: 0, sold: 0, ratingAvg: 0, ratingCount: 0,
    createdAt: new Date(now.getTime() - i * 3600_000).toISOString(), updatedAt: now.toISOString(),
  });
  added++;
}
const n = writeProductImages(db.products.map((p) => ({ ...p, brandEn: p.brandNameEn })), db.categories);
fs.writeFileSync(DB, JSON.stringify(db));
console.log(`✔ افزودم: ${added} محصول · ${IG_BRANDS.length} برند · ${IG_CATEGORIES.length} دسته · svg جدید: ${n} · کل محصولات: ${db.products.length}`);
