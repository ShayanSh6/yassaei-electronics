// ─────────────────────────────────────────────────────────────
//  اثرانگشت تصویر: dHash (۶۴ بیت) + هیستوگرام رنگ ۴×۴×۴
//  همه‌چیز در مرورگر محاسبه می‌شود؛ تصویر باید هم‌ریشه (same-origin) باشد
// ─────────────────────────────────────────────────────────────
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load'));
    img.src = src;
  });
}

export async function fingerprints(dataUrl) {
  const img = await loadImage(dataUrl);
  // dHash: 9x8 خاکستری
  const c9 = document.createElement('canvas');
  c9.width = 9; c9.height = 8;
  const x9 = c9.getContext('2d', { willReadFrequently: true });
  x9.drawImage(img, 0, 0, 9, 8);
  const g9 = x9.getImageData(0, 0, 9, 8).data;
  const gray = (i) => 0.299 * g9[i] + 0.587 * g9[i + 1] + 0.114 * g9[i + 2];
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = gray((y * 9 + x) * 4);
      const b = gray((y * 9 + x + 1) * 4);
      bits += a > b ? '1' : '0';
    }
  }
  let dhash = '';
  for (let i = 0; i < 64; i += 4) dhash += parseInt(bits.slice(i, i + 4), 2).toString(16);

  // هیستوگرام 4x4x4 = 64 خانه از تصویر 8x8
  const c8 = document.createElement('canvas');
  c8.width = 8; c8.height = 8;
  const x8 = c8.getContext('2d', { willReadFrequently: true });
  x8.drawImage(img, 0, 0, 8, 8);
  const d8 = x8.getImageData(0, 0, 8, 8).data;
  const hist = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const r = d8[i * 4] >> 6; const g = d8[i * 4 + 1] >> 6; const b = d8[i * 4 + 2] >> 6;
    hist[(r << 4) | (g << 2) | b]++;
  }
  const total = hist.reduce((a, b) => a + b, 0) || 1;
  return { dhash, hist: hist.map((v) => Math.round((v / total) * 1000) / 1000) };
}

