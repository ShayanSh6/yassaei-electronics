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

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function run() {
  const p = db.products.find(x => x.id === 'p006'); // هویه
  if(!p) return;
  const text = `🔥 <b>پیشنهاد ویژه و پرفروش</b>\n\n📦 <b>${p.name}</b>\n\n🔹 برند: ${p.brandName || 'متفرقه'}\n${p.condition === 'used' ? '⚠️ وضعیت: دست دوم' : (p.condition === 'refurbished' ? '⚠️ وضعیت: تعمیر شده' : '✨ وضعیت: نو (آکبند)')}\n💰 قیمت: <b>${Number(p.price).toLocaleString('fa-IR')} تومان</b>\n\n⚡️ تضمین اصالت و ارسال سریع به سراسر ایران`;
  const kb = { inline_keyboard: [[{ text: '🛒 مشاهده و خرید مستقیم از سایت', url: `https://yassaei-electronics.onrender.com/#/product/${p.id}` }]] };
  
  const pRes = await api('sendMessage', { chat_id: channel, text, parse_mode: 'HTML', reply_markup: kb });
  console.log(`Product ${p.id} Post:`, pRes);
}

run();
