// ─────────────────────────────────────────────────────────────
//  تولید تصویر SVG برای محصولات (بدون نیاز به اینترنت)
//  هر دسته یک آیکون خطی اختصاصی و پالت رنگی مخصوص دارد
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/db.mjs';
import { sha256 } from './lib/util.mjs';

const OUT_DIR = path.join(ROOT, 'public', 'assets', 'img', 'products');

const PALETTES = {
  cable: ['#0ea5e9', '#0369a1'],
  adapter: ['#22d3ee', '#0e7490'],
  case: ['#f472b6', '#9d174d'],
  glass: ['#60a5fa', '#1d4ed8'],
  powerbank: ['#34d399', '#065f46'],
  battery: ['#fbbf24', '#b45309'],
  dongle: ['#a78bfa', '#5b21b6'],
  speaker: ['#fb7185', '#9f1239'],
  audio: ['#2dd4bf', '#115e59'],
  wearable: ['#818cf8', '#3730a3'],
  content: ['#f97316', '#9a3412'],
  gaming: ['#4ade80', '#14532d'],
  car: ['#38bdf8', '#075985'],
  light: ['#facc15', '#854d0e'],
  misc: ['#94a3b8', '#334155'],
};

const GLYPHS = {
  cable: `<path d="M62 96h30a26 26 0 0 1 26 26v20a26 26 0 0 0 26 26h30" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
    <rect x="38" y="80" width="26" height="32" rx="7" fill="none" stroke="#fff" stroke-width="8"/>
    <rect x="196" y="146" width="26" height="32" rx="7" fill="none" stroke="#fff" stroke-width="8"/>
    <path d="M51 80V64M185 178v16" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  adapter: `<rect x="66" y="66" width="112" height="112" rx="24" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M104 66V38M140 66V38" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
    <path d="M122 100l-16 30h24l-14 28 34-38h-24l14-20z" fill="#fff"/>
    <path d="M94 178v28M150 178v28" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  case: `<rect x="78" y="34" width="88" height="176" rx="20" fill="none" stroke="#fff" stroke-width="9"/>
    <rect x="96" y="52" width="52" height="140" rx="10" fill="#fff" opacity=".22"/>
    <circle cx="146" cy="66" r="9" fill="#fff"/>
    <path d="M100 112h44" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".7"/>`,
  glass: `<rect x="72" y="30" width="100" height="184" rx="18" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M84 190L160 46" stroke="#fff" stroke-width="7" opacity=".45" stroke-linecap="round"/>
    <path d="M104 196L180 52" stroke="#fff" stroke-width="7" opacity=".25" stroke-linecap="round"/>
    <circle cx="122" cy="48" r="7" fill="#fff"/>`,
  powerbank: `<rect x="52" y="70" width="140" height="104" rx="20" fill="none" stroke="#fff" stroke-width="9"/>
    <rect x="72" y="90" width="70" height="14" rx="7" fill="#fff" opacity=".8"/>
    <rect x="72" y="114" width="46" height="14" rx="7" fill="#fff" opacity=".5"/>
    <circle cx="164" cy="122" r="16" fill="none" stroke="#fff" stroke-width="8"/>
    <path d="M164 112v20M156 122h16" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <path d="M192 106h24M192 138h24" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  battery: `<rect x="58" y="76" width="112" height="92" rx="16" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M170 104h18a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-18" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M112 96l-20 36h26l-8 22 30-40h-24z" fill="#fff"/>`,
  dongle: `<rect x="60" y="96" width="80" height="52" rx="14" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M140 112h44M140 132h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
    <rect x="44" y="112" width="18" height="20" rx="5" fill="#fff"/>
    <path d="M84 96V70a14 14 0 0 1 14-14h30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".7"/>`,
  speaker: `<rect x="70" y="46" width="104" height="152" rx="24" fill="none" stroke="#fff" stroke-width="9"/>
    <circle cx="122" cy="94" r="22" fill="none" stroke="#fff" stroke-width="8"/>
    <circle cx="122" cy="156" r="14" fill="#fff" opacity=".85"/>
    <path d="M96 46V34M148 46V34" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  audio: `<path d="M70 128v-14a52 52 0 0 1 104 0v14" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
    <rect x="52" y="122" width="30" height="52" rx="14" fill="#fff" opacity=".9"/>
    <rect x="162" y="122" width="30" height="52" rx="14" fill="#fff" opacity=".9"/>`,
  wearable: `<rect x="86" y="72" width="72" height="88" rx="20" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M104 72V44h36v28M104 160v28h36v-28" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
    <circle cx="122" cy="116" r="18" fill="none" stroke="#fff" stroke-width="7"/>
    <path d="M122 106v10l8 6" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  content: `<circle cx="122" cy="112" r="54" fill="none" stroke="#fff" stroke-width="9"/>
    <circle cx="122" cy="112" r="30" fill="none" stroke="#fff" stroke-width="7" opacity=".6"/>
    <circle cx="122" cy="112" r="10" fill="#fff"/>
    <path d="M122 166v44M100 210h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`,
  gaming: `<path d="M92 78l16-14h28l16 14 20 46a20 20 0 0 1-18 28H90a20 20 0 0 1-18-28z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
    <path d="M104 118h20M114 108v20" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <circle cx="152" cy="112" r="7" fill="#fff"/><circle cx="166" cy="126" r="7" fill="#fff"/>`,
  car: `<path d="M60 150l14-40a22 22 0 0 1 20-14h56a22 22 0 0 1 20 14l14 40" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>
    <rect x="52" y="150" width="140" height="34" rx="14" fill="none" stroke="#fff" stroke-width="9"/>
    <circle cx="84" cy="184" r="12" fill="#fff" opacity=".9"/><circle cx="160" cy="184" r="12" fill="#fff" opacity=".9"/>
    <path d="M122 128V96" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  light: `<rect x="92" y="96" width="60" height="104" rx="18" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M104 96V74a18 18 0 0 1 36 0v22" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M122 40V18M86 52L70 36M158 52l16-16" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <path d="M112 132h20" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>`,
  misc: `<rect x="64" y="64" width="116" height="116" rx="22" fill="none" stroke="#fff" stroke-width="9"/>
    <path d="M92 122h60M122 92v60" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".85"/>`,
};

export function productSvg(product, category) {
  const glyph = category?.glyph || 'misc';
  const [c1, c2] = PALETTES[glyph] || PALETTES.misc;
  const seed = parseInt(sha256(product.id || product.name).slice(0, 6), 16);
  const angle = seed % 360;
  const brand = String(product.brand?.nameEn || product.brandEn || '').toUpperCase().slice(0, 14);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 244" width="244" height="244" role="img" aria-label="product">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="s" cx=".3" cy=".2" r=".9">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="244" height="244" rx="30" fill="url(#g)"/>
  <rect width="244" height="244" rx="30" fill="url(#s)"/>
  <g opacity=".95">${GLYPHS[glyph] || GLYPHS.misc}</g>
  ${brand ? `<text x="122" y="228" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="15" font-weight="700" fill="#fff" opacity=".82" letter-spacing="1.4">${brand.replace(/[<>&]/g, '')}</text>` : ''}
</svg>`;
}

export function categorySvg(cat) {
  const glyph = cat.glyph || 'misc';
  const [c1, c2] = PALETTES[glyph] || PALETTES.misc;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 244" width="244" height="244" role="img">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="244" height="244" rx="34" fill="url(#g)"/>
  <g opacity=".95">${GLYPHS[glyph] || GLYPHS.misc}</g>
</svg>`;
}

export function writeProductImages(products, categories) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const catMap = new Map(categories.map((c) => [c.id, c]));
  let n = 0;
  for (const p of products) {
    const cat = catMap.get(p.categoryId) || { glyph: 'misc' };
    const file = path.join(OUT_DIR, `${p.id}.svg`);
    const svg = productSvg({ ...p, brandEn: p.brandEn }, cat);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== svg) {
      fs.writeFileSync(file, svg, 'utf8');
      n++;
    }
  }
  return n;
}

export { OUT_DIR };
