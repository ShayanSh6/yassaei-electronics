import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
// توکن ربات: اول متغیر محیطی BM_TG_TOKEN، بعد تنظیمات پنل (data/db.json)
function tgToken() {
  const env = String(process.env.BM_TG_TOKEN || '').trim();
  const fromPanel = String(db?.settings?.telegram?.token || '').trim();
  const token = env || fromPanel;
  if (!token) {
    console.error('✘ توکن ربات پیدا نشد. BM_TG_TOKEN را ست کن یا در پنل → تنظیمات → تلگرام ذخیره کن.');
    process.exit(1);
  }
  return token;
}

const token = tgToken();
const channel = db.settings.telegram?.channel || '@yassaei_shop';

// Telegram cannot fetch SVGs easily or Render blocks it? Wait, SVG is not supported by Telegram sendPhoto!
// Telegram supports: JPG, JPEG, PNG, WEBP, HEIC, GIF.
// Let's use sendMessage for SVG or sendDocument. We should just stick to sendMessage if image is SVG.

async function run() {
  const p = db.products.find(x => x.active && x.price > 0 && x.images && x.images.length > 0 && !x.images[0].endsWith('.svg'));
  if(!p) {
    console.log("No product with JPG/PNG image found.");
    return;
  }
  
  const text = `🌟 <b>محصول ویژه (همراه با تصویر)</b>\n\n📦 <b>${p.name}</b>\n\n🔹 برند: ${p.brandName || 'متفرقه'}\n💰 قیمت: <b>${Number(p.price).toLocaleString('fa-IR')} تومان</b>\n\n⚡️ ارسال سریع به سراسر ایران`;
  const kb = { inline_keyboard: [[{ text: '🛒 خرید مستقیم از سایت', url: `https://yassaei-electronics.onrender.com/#/product/${p.id}` }]] };
  const image = `https://yassaei-electronics.onrender.com${p.images[0]}`;
  
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channel, photo: image, caption: text, parse_mode: 'HTML', reply_markup: kb })
  });
  console.log(await r.json());
}
run();
