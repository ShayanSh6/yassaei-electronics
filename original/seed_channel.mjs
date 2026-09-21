import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Save channel to DB settings
if (!db.settings.telegram) db.settings.telegram = {};
db.settings.telegram.channel = '@yassaei_shop';
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

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
const channel = db.settings.telegram.channel || '@yassaei_shop';

async function send(text, kb = null) {
  const body = { chat_id: channel, text, parse_mode: 'HTML' };
  if (kb) body.reply_markup = kb;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    console.log(j);
  } catch (e) {
    console.error(e);
  }
}

async function run() {
  await send(`🎉 <b>به کانال رسمی الکتریکی یاسایی خوش آمدید!</b> ⚡️\n\nدر این کانال، جدیدترین محصولات، قطعات الکترونیک، ابزار لحیم‌کاری و تخفیف‌های ویژه فروشگاه قرار می‌گیرد.\n\n📍 <b>آدرس ما:</b> تهران، نارمک، میدان هفت‌حوض\n🌐 <b>سایت ما:</b> yassaei-electronics.onrender.com\n\n👇 برای جستجوی سریع کالاها، دسته‌بندی‌ها و پیگیری سفارشات، ربات هوشمند ما را استارت کنید:\n🤖 @yassaei_electronics_shop_bot`);
  
  const prods = db.products.filter(p => p.active && p.price > 0).slice(0, 3);
  for (const p of prods) {
    const text = `📦 <b>${p.name}</b>\n\n🔹 برند: ${p.brandName || 'متفرقه'}\n💰 قیمت: ${Number(p.price).toLocaleString('fa-IR')} تومان\n\n${p.description ? p.description.slice(0, 150) + '...' : ''}\n\n⚡️ ارسال سریع به سراسر ایران`;
    const kb = { inline_keyboard: [[{ text: '🛒 مشاهده و خرید مستقیم', url: `https://yassaei-electronics.onrender.com/#/product/${p.id}` }]] };
    await send(text, kb);
  }
}

run();
