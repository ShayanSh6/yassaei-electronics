// ─────────────────────────────────────────────────────────────
//  داده‌های اولیه‌ی فروشگاه: دسته‌ها، برندها، محصولات، کاربران نمونه
// ─────────────────────────────────────────────────────────────
import { DEFAULT_PAGES, DEFAULT_SETTINGS, ORDER_STATUSES, TICKET_CATEGORIES } from './defaults.mjs';
import { hashPassword, generateTotpSecret, PERMISSIONS } from './lib/auth.mjs';
import { nowISO, uid, sha256 } from './lib/util.mjs';
import { writeProductImages } from './art.mjs';
import { IG_BRANDS, IG_CATEGORIES, IG_RAW } from './ig-products.mjs';

// ── بارکد EAN-13 با رقم کنترلی ──────────────────────────────
export function ean13(digits12) {
  const d = String(digits12).replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return d + String((10 - (sum % 10)) % 10);
}

const CATEGORIES = [
  { id: 'cables', fa: 'کابل شارژ', en: 'Charging Cables', glyph: 'cable', order: 1 },
  { id: 'adapters', fa: 'آداپتور و شارژر', en: 'Adapters & Chargers', glyph: 'adapter', order: 2 },
  { id: 'cases', fa: 'قاب گوشی', en: 'Phone Cases', glyph: 'case', order: 3 },
  { id: 'glass', fa: 'گلس و محافظ صفحه', en: 'Screen Protectors', glyph: 'glass', order: 4 },
  { id: 'powerbank', fa: 'پاوربانک', en: 'Power Banks', glyph: 'powerbank', order: 5 },
  { id: 'audio', fa: 'صوتی', en: 'Audio', glyph: 'audio', order: 6 },
  { id: 'speakers', fa: 'اسپیکر', en: 'Speakers', glyph: 'speaker', parent: 'audio', order: 1 },
  { id: 'earbuds', fa: 'هندزفری و هدفون', en: 'Earbuds & Headphones', glyph: 'audio', parent: 'audio', order: 2 },
  { id: 'headsets', fa: 'هدست گیمینگ', en: 'Gaming Headsets', glyph: 'headsets', parent: 'audio', order: 3 },
  { id: 'mics', fa: 'میکروفون', en: 'Microphones', glyph: 'mics', parent: 'audio', order: 4 },
  { id: 'wearables', fa: 'پوشیدنی هوشمند', en: 'Smart Wearables', glyph: 'wearable', order: 7 },
  { id: 'smartwatch', fa: 'ساعت هوشمند', en: 'Smart Watches', glyph: 'wearable', parent: 'wearables', order: 1 },
  { id: 'smartglass', fa: 'عینک هوشمند', en: 'Smart Glasses', glyph: 'wearable', parent: 'wearables', order: 2 },
  { id: 'content', fa: 'تولید محتوا', en: 'Content Creation', glyph: 'content', order: 8 },
  { id: 'ringlight', fa: 'رینگ لایت', en: 'Ring Lights', glyph: 'content', parent: 'content', order: 1 },
  { id: 'stands', fa: 'پایه و نگه‌دارنده', en: 'Stands & Holders', glyph: 'content', parent: 'content', order: 2 },
  { id: 'dongles', fa: 'دانگل و مبدل', en: 'Dongles & Adapters', glyph: 'dongle', order: 9 },
  { id: 'batteries', fa: 'باتری', en: 'Batteries', glyph: 'battery', order: 10 },
  { id: 'gaming', fa: 'لوازم گیمینگ', en: 'Gaming Gear', glyph: 'gaming', order: 11 },
  { id: 'car', fa: 'لوازم خودرو', en: 'Car Accessories', glyph: 'car', order: 12 },
  { id: 'lighting', fa: 'چراغ‌قوه و روشنایی', en: 'Flashlights', glyph: 'light', order: 13 },
  { id: 'misc', fa: 'متفرقه', en: 'Miscellaneous', glyph: 'misc', order: 14 },
];

const GLYPH_MAP = { headsets: 'audio', mics: 'content', stands: 'content' };

const BRANDS = [
  { id: 'apple', fa: 'اپل', en: 'Apple' },
  { id: 'samsung', fa: 'سامسونگ', en: 'Samsung' },
  { id: 'anker', fa: 'انکر', en: 'Anker' },
  { id: 'baseus', fa: 'بیسوس', en: 'Baseus' },
  { id: 'xiaomi', fa: 'شیائومی', en: 'Xiaomi' },
  { id: 'jbl', fa: 'جی‌بی‌ال', en: 'JBL' },
  { id: 'sony', fa: 'سونی', en: 'Sony' },
  { id: 'haylou', fa: 'هایلو', en: 'Haylou' },
  { id: 'qcy', fa: 'کیو‌سی‌وای', en: 'QCY' },
  { id: 'hoco', fa: 'هوکو', en: 'Hoco' },
  { id: 'remax', fa: 'ریمکس', en: 'Remax' },
  { id: 'mcdodo', fa: 'مک‌دیدو', en: 'McDodo' },
  { id: 'greenlion', fa: 'گرین لاین', en: 'Green Lion' },
  { id: 'nillkin', fa: 'نیلکین', en: 'Nillkin' },
  { id: 'spigen', fa: 'اسپیگن', en: 'Spigen' },
  { id: 'tesco', fa: 'تسکو', en: 'TSCO' },
  { id: 'farassoo', fa: 'فاراسو', en: 'Farassoo' },
  { id: 'rav_power', fa: 'راوپاور', en: 'RAVPower' },
  { id: 'oraimo', fa: 'اورایمو', en: 'Oraimo' },
  { id: 'no_name', fa: 'متفرقه', en: 'Generic' },
];

// name, nameEn, cat, brand, price, oldPrice, stock, authenticity, warranty, glyph, specs, desc, descEn, tags
const RAW = [
  ['کابل شارژ تایپ‌سی به تایپ‌سی ۱۰۰ وات بیسوس', 'Baseus USB-C to USB-C 100W Cable', 'cables', 'baseus', 245000, 310000, 14, 'original', 6, 'cable',
    { 'طول': '۱ متر', 'توان': '۱۰۰ وات (PD)', 'روکش': 'کنف بافته', 'سرعت انتقال داده': '۴۸۰ مگابیت بر ثانیه' },
    'کابل بافته‌ی مقاوم با قابلیت شارژ فوق‌سریع PD تا ۱۰۰ وات؛ مناسب مک‌بوک، گوشی‌های تایپ‌سی و پاوربانک. روکش کنفی در برابر گره و پارگی مقاوم است.',
    'Braided 100W PD cable for laptops, phones and power banks with a tangle-resistant nylon jacket.',
    ['شارژ سریع', 'تایپ سی', 'کابل بافته']],

  ['کابل لایتنینگ به تایپ‌سی اپل اصل', 'Apple Lightning to USB-C Cable (Original)', 'cables', 'apple', 1180000, 1350000, 5, 'original', 3, 'cable',
    { 'طول': '۱ متر', 'نوع': 'لایتنینگ به تایپ‌سی', 'سازگاری': 'آیفون ۵ تا ۱۴', 'اصل': 'بله' },
    'کابل اورجینال اپل برای شارژ سریع آیفون با آداپتور تایپ‌سی. دارای تراشه‌ی MFi و سازگاری کامل با iOS.',
    'Genuine Apple Lightning to USB-C cable with MFi chip for fast iPhone charging.',
    ['اپل اصل', 'لایتنینگ', 'شارژ سریع']],

  ['کابل میکرو یو‌اس‌بی هوکو U27', 'Hoco U27 Micro USB Cable', 'cables', 'hoco', 125000, 160000, 22, 'original', 3, 'cable',
    { 'طول': '۱ متر', 'جریان': '۲.۴ آمپر', 'روکش': 'TPE مقاوم' },
    'کابل میکرو مناسب گوشی‌های اندرویدی قدیمی‌تر، هندزفری، اسپیکر و پاوربانک‌های میکرو.',
    'Micro USB cable for older Android phones, speakers and power banks.',
    ['میکرو', 'ارزان', 'مقاوم']],

  ['کابل سه سر (تایپ‌سی/لایتنینگ/میکرو) ریمکس', 'Remax 3-in-1 Multi Cable', 'cables', 'remax', 195000, 0, 9, 'original', 3, 'cable',
    { 'طول': '۱.۲ متر', 'سرعت': '۳ آمپر', 'سرهای خروجی': 'تایپ‌سی، لایتنینگ، میکرو' },
    'یک کابل با سه سر خروجی؛ گزینه‌ی عالی برای ماشین و مسافرت که همه‌ی گوشی‌ها را پوشش می‌دهد.',
    'A single cable with three connectors — perfect for the car and travel.',
    ['سه سر', 'مسافرتی']],

  ['کابل HDMI به HDMI ورژن ۲.۱ تسکو', 'TSCO HDMI 2.1 Cable 4K', 'cables', 'tesco', 285000, 340000, 7, 'original', 6, 'cable',
    { 'طول': '۲ متر', 'نسخه': 'HDMI 2.1', 'رزولوشن': '4K@120Hz / 8K@60Hz' },
    'کابل HDMI پرسرعت برای اتصال گوشی، لپ‌تاپ یا کنسول به تلویزیون و ویدیو پروژکتور.',
    'High-speed HDMI 2.1 cable for phones, laptops and consoles.',
    ['اچ دی ام ای', 'تلویزیون', '4K']],

  ['کابل پاور سه‌رشته‌ای ۱.۵ متری', 'Power Cord 3-Core 1.5m', 'cables', 'no_name', 95000, 0, 18, 'generic', 1, 'cable',
    { 'طول': '۱.۵ متر', 'جریان': '۱۰ آمپر', 'کاربرد': 'سه‌راهی، آداپتور، مانیتور' },
    'کابل برق سه‌رشته با روکش مقاوم، مناسب انواع سه‌راهی و دستگاه‌های برقی سبک.',
    '3-core power cord for power strips and light appliances.',
    ['کابل برق', 'پاور']],

  ['آداپتور شارژر ۲۰ وات اپل اصل', 'Apple 20W USB-C Power Adapter (Original)', 'adapters', 'apple', 1290000, 1490000, 4, 'original', 6, 'adapter',
    { 'توان': '۲۰ وات', 'پورت': 'USB-C', 'فناوری': 'Power Delivery', 'اصل': 'بله' },
    'آداپتور اورجینال اپل برای شارژ سریع آیفون و آیپد؛ تا ۵۰٪ شارژ در ۳۰ دقیقه.',
    'Original Apple 20W PD adapter — 50% charge in 30 minutes.',
    ['اپل اصل', 'شارژ سریع', 'PD']],

  ['آداپتور ۲۵ وات سامسونگ اصل', 'Samsung 25W EP-TA800 Charger', 'adapters', 'samsung', 780000, 890000, 6, 'original', 6, 'adapter',
    { 'توان': '۲۵ وات', 'پورت': 'USB-C', 'فناوری': 'Super Fast Charging' },
    'شارژر اصلی سامسونگ با پشتیبانی از Super Fast Charging؛ مناسب سری A و S.',
    'Genuine Samsung 25W super fast charger for Galaxy A and S series.',
    ['سامسونگ اصل', '25 وات']],

  ['آداپتور ۶۵ وات گن انکر GaN', 'Anker 65W GaN Charger 3-Port', 'adapters', 'anker', 2350000, 2650000, 3, 'original', 12, 'adapter',
    { 'توان': '۶۵ وات', 'پورت': '۲ تایپ‌سی + ۱ USB-A', 'فناوری': 'GaN II', 'وزن': '۱۳۰ گرم' },
    'یک شارژر کوچک برای همه‌چیز: لپ‌تاپ، گوشی و تبلت را هم‌زمان شارژ کن. فناوری GaN باعث ابعاد کوچک و گرمای کمتر می‌شود.',
    'One tiny charger for laptop, phone and tablet at once, thanks to GaN II technology.',
    ['گن', '۶۵ وات', 'چندپورت']],

  ['شارژر فندکی ماشین ۳۰ وات بیسوس', 'Baseus 30W Car Charger', 'adapters', 'baseus', 320000, 390000, 11, 'original', 6, 'adapter',
    { 'توان': '۳۰ وات', 'پورت': 'تایپ‌سی + USB-A', 'ورودی': '۱۲ تا ۲۴ ولت' },
    'شارژر فندکی جمع‌وجور با نمایشگر ولتاژ باتری ماشین و دو پورت خروجی.',
    'Compact car charger with battery voltage display and dual ports.',
    ['ماشین', 'فندکی']],

  ['شارژر وایرلس ۱۵ وات مک‌سیف', 'MagSafe-Compatible 15W Wireless Charger', 'adapters', 'greenlion', 690000, 850000, 8, 'highcopy', 6, 'adapter',
    { 'توان': '۱۵ وات', 'استاندارد': 'Qi / MagSafe', 'طول کابل': '۱ متر' },
    'شارژر بی‌سیم مگنتی مناسب آیفون‌های سری ۱۲ به بالا و گوشی‌های دارای Qi.',
    'Magnetic wireless charger for iPhone 12+ and Qi-enabled phones.',
    ['وایرلس', 'مگ سیف']],

  ['قاب سیلیکونی آیفون ۱۳ پرو مکس', 'Silicone Case iPhone 13 Pro Max', 'cases', 'apple', 385000, 460000, 12, 'highcopy', 1, 'case',
    { 'سازگاری': 'iPhone 13 Pro Max', 'جنس': 'سیلیکون مایع', 'ویژگی': 'پوشش کامل دکمه‌ها' },
    'قاب سیلیکونی نرم با پوشش داخلی مخملی و لبه‌ی بلند برای محافظت از دوربین.',
    'Soft liquid-silicone case with microfiber lining and raised camera lip.',
    ['آیفون ۱۳', 'سیلیکونی']],

  ['قاب شفاف ضدضربه آیفون ۱۵', 'Clear Shockproof Case iPhone 15', 'cases', 'spigen', 520000, 620000, 7, 'original', 3, 'case',
    { 'سازگاری': 'iPhone 15', 'جنس': 'TPU + پلی‌کربنات', 'استاندارد': 'ضد ضربه نظامی' },
    'قاب شفاف با گوشه‌های ضربه‌گیر هوایی؛ زرد نمی‌شود و دکمه‌ها خوش‌فشار باقی می‌مانند.',
    'Crystal-clear case with air-cushion corners that will not yellow.',
    ['آیفون ۱۵', 'شفاف', 'ضدضربه']],

  ['قاب نیلکین سامسونگ Galaxy S23 Ultra', 'Nillkin Case Samsung Galaxy S23 Ultra', 'cases', 'nillkin', 610000, 0, 5, 'original', 3, 'case',
    { 'سازگاری': 'Galaxy S23 Ultra', 'جنس': 'پلی‌کربنات', 'ویژگی': 'لنز کشویی محافظ دوربین' },
    'قاب سخت با درپوش کشویی محافظ لنز دوربین؛ انتخاب محبوب عکاس‌های موبایلی.',
    'Hard case with a sliding camera-lens shutter, a favourite of mobile photographers.',
    ['سامسونگ', 'نیلکین', 'محافظ لنز']],

  ['قاب ضدضربه سامسونگ Galaxy A54', 'Rugged Case Samsung Galaxy A54', 'cases', 'greenlion', 340000, 420000, 10, 'highcopy', 1, 'case',
    { 'سازگاری': 'Galaxy A54 5G', 'جنس': 'TPU دوبل', 'رنگ‌بندی': 'مشکی، سرمه‌ای' },
    'قاب دولایه با ضربه‌گیر گوشه، مناسب استفاده‌ی روزمره و کارگاهی.',
    'Dual-layer case with corner bumpers for daily and workshop use.',
    ['سامسونگ', 'ضدضربه']],

  ['گلس حریم خصوصی آیفون ۱۴ پرو', 'Privacy Tempered Glass iPhone 14 Pro', 'glass', 'nillkin', 420000, 520000, 9, 'original', 1, 'glass',
    { 'سازگاری': 'iPhone 14 Pro', 'ضخامت': '۰.۳ میلی‌متر', 'ویژگی': 'حریم خصوصی ۲۸ درجه' },
    'گلس پرایوسی که از کنار صفحه چیزی دیده نمی‌شود؛ سختی 9H و پوشش کامل.',
    'Privacy glass with 28-degree viewing angle, 9H hardness, full coverage.',
    ['آیفون ۱۴', 'پرایوسی']],

  ['گلس شیشه‌ای سامسونگ Galaxy S24', 'Tempered Glass Samsung Galaxy S24', 'glass', 'greenlion', 265000, 0, 15, 'highcopy', 1, 'glass',
    { 'سازگاری': 'Galaxy S24', 'سختی': '9H', 'پوشش': 'تمام‌صفحه' },
    'گلس شفاف با چسبندگی کامل و لبه‌ی 2.5D؛ نصب آسان بدون حباب.',
    'Clear full-cover glass with 2.5D edges and bubble-free installation.',
    ['سامسونگ', 'گلس']],

  ['گلس مات ضدبازتاب آیفون ۱۵ پرو', 'Matte Anti-Glare Glass iPhone 15 Pro', 'glass', 'spigen', 480000, 560000, 6, 'original', 1, 'glass',
    { 'سازگاری': 'iPhone 15 Pro', 'نوع': 'مات ضد اثر انگشت', 'سختی': '9H' },
    'برای کسانی که زیر نور آفتاب تهران کار می‌کنند: بدون بازتاب و بدون اثر انگشت.',
    'For those working under strong sun: no glare, no fingerprints.',
    ['آیفون ۱۵', 'مات']],

  ['محافظ دوربین آیفون ۱۳ (۳ عددی)', 'Camera Lens Protector iPhone 13 (3-pack)', 'glass', 'no_name', 145000, 190000, 20, 'generic', 1, 'glass',
    { 'سازگاری': 'iPhone 13 / 13 Pro', 'تعداد': '۳ عدد', 'جنس': 'شیشه + حلقه فلزی' },
    'سه عدد محافظ لنز دوربین با حلقه‌ی فلزی؛ ارزان‌ترین بیمه برای دوربین گوشی.',
    'Three metal-ring lens protectors — the cheapest insurance for your camera.',
    ['محافظ لنز', 'آیفون ۱۳']],

  ['پاوربانک ۱۰۰۰۰ انکر PowerCore', 'Anker PowerCore 10000mAh', 'powerbank', 'anker', 1890000, 2150000, 6, 'original', 18, 'powerbank',
    { 'ظرفیت': '۱۰۰۰۰ میلی‌آمپر ساعت', 'خروجی': '۲۲.۵ وات', 'پورت': 'تایپ‌سی + USB-A', 'وزن': '۲۲۰ گرم' },
    'پاوربانک باریک با ظرفیت واقعی بالا؛ یک بار شارژ کامل گوشی پرچم‌دار و نیم.',
    'Slim power bank with real high capacity — one and a half full flagship charges.',
    ['انکر', '۱۰۰۰۰', 'فوق سریع']],

  ['پاوربانک ۲۰۰۰۰ شیائومی ۳۳ وات', 'Xiaomi 20000mAh 33W Power Bank', 'powerbank', 'xiaomi', 1450000, 1650000, 8, 'original', 12, 'powerbank',
    { 'ظرفیت': '۲۰۰۰۰ میلی‌آمپر ساعت', 'خروجی': '۳۳ وات', 'نمایشگر': 'درصد دیجیتال' },
    'ظرفیت بالا با نمایشگر درصد و شارژ سریع دوطرفه؛ همراه خوب سفرهای طولانی.',
    'High capacity with digital display and two-way fast charging.',
    ['شیائومی', '۲۰۰۰۰', 'سفری']],

  ['پاوربانک مگنتی ۵۰۰۰ بیسوس', 'Baseus Magnetic 5000mAh Power Bank', 'powerbank', 'baseus', 1250000, 0, 4, 'original', 12, 'powerbank',
    { 'ظرفیت': '۵۰۰۰ میلی‌آمپر ساعت', 'خروجی': '۱۵ وات وایرلس', 'ویژگی': 'چسبان مگنتی به پشت گوشی' },
    'بدون کابل به پشت آیفون می‌چسبد و شارژ می‌کند؛ پایه‌ی تاشو هم دارد.',
    'Snaps to the back of your iPhone with a foldable kickstand.',
    ['مگنتی', 'وایرلس']],

  ['پاوربانک خورشیدی ۳۰۰۰۰ ضدآب', 'Solar 30000mAh Waterproof Power Bank', 'powerbank', 'oraimo', 1150000, 1350000, 3, 'highcopy', 6, 'powerbank',
    { 'ظرفیت': '۳۰۰۰۰ میلی‌آمپر ساعت', 'پنل خورشیدی': 'دارد', 'چراغ': 'LED دو حالته', 'مقاومت': 'ضد پاشش آب' },
    'مناسب کمپ، لنج و سفرهای جنوبی؛ با پنل خورشیدی و چراغ قوه‌ی داخلی.',
    'Ideal for camping and boats, with a solar panel and built-in torch.',
    ['خورشیدی', 'کمپ', 'ضدآب']],

  ['باتری قلمی آلکالاین (۴ عددی)', 'Alkaline AA Batteries (4-pack)', 'batteries', 'no_name', 78000, 0, 40, 'generic', 0, 'battery',
    { 'نوع': 'آلکالاین AA', 'تعداد': '۴ عدد', 'ولتاژ': '۱.۵ ولت' },
    'باتری قلمی برای کنترل، چراغ‌قوه، ماوس و اسباب‌بازی.',
    'AA alkaline cells for remotes, torches and mice.',
    ['باتری', 'قلمی']],

  ['باتری نیم‌قلمی آلکالاین (۴ عددی)', 'Alkaline AAA Batteries (4-pack)', 'batteries', 'no_name', 65000, 0, 35, 'generic', 0, 'battery',
    { 'نوع': 'آلکالاین AAA', 'تعداد': '۴ عدد', 'ولتاژ': '۱.۵ ولت' },
    'نیم‌قلمی برای کنترل کولر، تلویزیون و ساعت دیواری.',
    'AAA cells for AC remotes, TVs and clocks.',
    ['باتری', 'نیم‌قلمی']],

  ['باتری سکه‌ای CR2032 (۵ عددی)', 'CR2032 Coin Cells (5-pack)', 'batteries', 'no_name', 95000, 120000, 18, 'generic', 0, 'battery',
    { 'نوع': 'لیتیوم CR2032', 'تعداد': '۵ عدد', 'ولتاژ': '۳ ولت' },
    'برای ترازو، ریموت ماشین، مادربرد و ایرتگ.',
    'For scales, car remotes, motherboards and trackers.',
    ['باتری سکه‌ای', 'لیتیوم']],

  ['باتری گوشی آیفون ۱۱ (تعویضی)', 'iPhone 11 Replacement Battery', 'batteries', 'no_name', 780000, 0, 2, 'highcopy', 6, 'battery',
    { 'سازگاری': 'iPhone 11', 'ظرفیت': '۳۱۱۰ میلی‌آمپر ساعت', 'نصب': 'رایگان در فروشگاه' },
    'باتری تعویضی با کیفیت درجه یک؛ نصب رایگان در مغازه انجام می‌شود.',
    'Grade-A replacement battery with free in-store installation.',
    ['باتری گوشی', 'تعویض']],

  ['دانگل OTG تایپ‌سی به USB', 'USB-C to USB OTG Adapter', 'dongles', 'hoco', 85000, 110000, 25, 'original', 1, 'dongle',
    { 'ورودی': 'تایپ‌سی', 'خروجی': 'USB-A 3.0', 'جنس': 'آلومینیوم' },
    'فلش، ماوس یا کیبورد را به گوشی وصل کن؛ بدنه‌ی آلومینیومی و انتقال پرسرعت.',
    'Connect flash drives, mice or keyboards to your phone.',
    ['OTG', 'تایپ سی']],

  ['مبدل HDMI به تایپ‌سی (خروجی تصویر)', 'USB-C to HDMI Adapter', 'dongles', 'baseus', 540000, 0, 6, 'original', 6, 'dongle',
    { 'ورودی': 'تایپ‌سی (DP Alt Mode)', 'خروجی': 'HDMI 4K@30Hz', 'پورت اضافه': 'تایپ‌سی PD' },
    'تصویر گوشی یا لپ‌تاپ را روی تلویزیون بینداز؛ هم‌زمان هم شارژ می‌شود.',
    'Mirror your phone or laptop to a TV while charging at the same time.',
    ['تصویر', 'تلویزیون', 'مبدل']],

  ['دانگل بلوتوث ۵.۳ USB', 'Bluetooth 5.3 USB Dongle', 'dongles', 'tesco', 245000, 0, 10, 'original', 6, 'dongle',
    { 'نسخه': 'بلوتوث ۵.۳', 'برد': '۲۰ متر', 'سازگاری': 'ویندوز ۱۰ و ۱۱' },
    'برای کیس‌های قدیمی که بلوتوث ندارند؛ اتصال هندزفری، ماوس و کیبورد بی‌سیم.',
    'Add wireless to an old PC: earbuds, mouse and keyboard.',
    ['بلوتوث', 'کامپیوتر']],

  ['اسپیکر بلوتوثی JBL Go 3', 'JBL Go 3 Bluetooth Speaker', 'speakers', 'jbl', 2450000, 2750000, 4, 'original', 12, 'speaker',
    { 'توان': '۴.۲ وات', 'باتری': '۵ ساعت پخش', 'مقاومت': 'IP67 ضدآب و گرد و غبار', 'وزن': '۲۰۹ گرم' },
    'کوچک، ضدآب و با صدای شفاف؛ مناسب ساحل، استخر و سفر.',
    'Tiny, waterproof and crisp — perfect for the beach and travel.',
    ['JBL', 'ضدآب', 'قابل حمل']],

  ['اسپیکر بلوتوثی انکر Soundcore Mini 3', 'Anker Soundcore Mini 3', 'speakers', 'anker', 1850000, 0, 3, 'original', 12, 'speaker',
    { 'توان': '۶ وات', 'باتری': '۱۵ ساعت', 'ویژگی': 'بیس تقویت‌شده BassUp', 'مقاومت': 'IPX7' },
    'باتری ۱۵ ساعته و بیس قوی در ابعادی که در جیب جا می‌شود.',
    '15-hour battery and deep bass in a pocket-size body.',
    ['انکر', 'باتری قوی']],

  ['اسپیکر قابل حمل شیائومی', 'Xiaomi Portable Bluetooth Speaker', 'speakers', 'xiaomi', 1250000, 1420000, 7, 'original', 12, 'speaker',
    { 'توان': '۵ وات', 'باتری': '۱۳ ساعت', 'ویژگی': 'اتصال دوگانه استریو' },
    'دو اسپیکر را به هم وصل کن و صدای استریو بساز؛ بدنه‌ی فلزی و بند آویز.',
    'Pair two for stereo; metal body with a carry strap.',
    ['شیائومی', 'استریو']],

  ['هندزفری بلوتوثی QCY T13', 'QCY T13 True Wireless Earbuds', 'earbuds', 'qcy', 890000, 1050000, 13, 'original', 6, 'audio',
    { 'باتری': '۸ ساعت + کیس ۳۲ ساعت', 'نویز کنسلینگ': 'ENC هنگام مکالمه', 'بلوتوث': '۵.۱', 'مقاومت': 'IPX5' },
    'پرفروش‌ترین هندزفری اقتصادی با کیفیت صدای بسیار خوب نسبت به قیمت و حذف نویز مکالمه.',
    'Best-selling budget earbuds with great sound-for-price and ENC calling.',
    ['هندزفری', 'بی‌سیم', 'اقتصادی']],

  ['هندزفری Haylou GT7 Neo', 'Haylou GT7 Neo Earbuds', 'earbuds', 'haylou', 720000, 830000, 9, 'original', 6, 'audio',
    { 'باتری': '۷ ساعت', 'درایور': '۱۳ میلی‌متری', 'ویژگی': 'حالت گیمینگ با تأخیر کم' },
    'حالت گیمینگ با تأخیر کم برای پابجی و کالاف دیوتی موبایل.',
    'Low-latency game mode for PUBG and CoD Mobile.',
    ['گیمینگ', 'تأخیر کم']],

  ['هدفون بی‌سیم سونی WH-CH520', 'Sony WH-CH520 Wireless Headphones', 'earbuds', 'sony', 3450000, 3850000, 2, 'original', 12, 'audio',
    { 'باتری': '۵۰ ساعت', 'درایور': '۳۰ میلی‌متر', 'ویژگی': 'شارژ سریع ۳ دقیقه = ۱.۵ ساعت' },
    'سبک، با باتری ۵۰ ساعته و صدای متعادل سونی؛ مناسب استفاده‌ی طولانی.',
    'Lightweight with 50-hour battery and balanced Sony sound.',
    ['سونی', 'هدفون', 'باتری ۵۰ ساعت']],

  ['هندزفری سیمی تایپ‌سی با میکروفون', 'USB-C Wired Earphones with Mic', 'earbuds', 'hoco', 285000, 0, 16, 'original', 1, 'audio',
    { 'رابط': 'تایپ‌سی (DAC داخلی)', 'میکروفون': 'دارد', 'کنترل': 'دکمه‌ی پاسخ و ولوم' },
    'برای گوشی‌های بدون جک ۳.۵؛ بدون نیاز به تبدیل و با کیفیت صدای پایدار.',
    'For phones without a headphone jack — no adapter needed.',
    ['سیمی', 'تایپ سی']],

  ['هدست گیمینگ بی‌سیم با نورپردازی', 'Wireless Gaming Headset with RGB', 'headsets', 'tesco', 1450000, 1720000, 5, 'highcopy', 3, 'audio',
    { 'اتصال': 'بلوتوث ۵.۳ + دانگل ۲.۴ گیگاهرتز', 'باتری': '۲۰ ساعت', 'میکروفون': 'جداشونده با نویز کنسلینگ', 'سازگاری': 'موبایل، PC، PS5' },
    'هدست گیمینگ با پد گوشی نرم، نورپردازی RGB و میکروفون واضح برای ویس چت.',
    'Gaming headset with soft pads, RGB lighting and a clear voice mic.',
    ['گیمینگ', 'هدست', 'RGB']],

  ['میکروفون یقه‌ای بی‌سیم دو کاناله', 'Dual-Channel Wireless Lavalier Microphone', 'mics', 'no_name', 890000, 1080000, 8, 'highcopy', 3, 'mics',
    { 'کانال': '۲ فرستنده + ۱ گیرنده', 'برد': '۲۰ متر', 'رابط': 'تایپ‌سی و لایتنینگ', 'باتری': '۶ ساعت' },
    'مخصوص ولاگ، اینستاگرام و مصاحبه؛ دو نفر هم‌زمان صحبت کنند بدون نویز محیط.',
    'For vlogs and interviews — two speakers at once with noise reduction.',
    ['میکروفون یقه‌ای', 'ولاگ']],

  ['میکروفون استودیویی USB کاندنسور', 'USB Condenser Studio Microphone', 'mics', 'tesco', 1650000, 0, 4, 'original', 6, 'mics',
    { 'نوع': 'کاندنسور کاردیوید', 'رابط': 'USB-C', 'ویژگی': 'خروجی هدفون برای مانیتورینگ', 'اقلام همراه': 'شوک‌مونت و پاپ‌فیلتر' },
    'برای پادکست، استریم و ضبط وکال با کیفیت استودیویی.',
    'For podcasts, streaming and vocals with studio-quality results.',
    ['پادکست', 'استودیو']],

  ['پایه‌ی میکروفون رومیزی بوم', 'Desktop Boom Microphone Stand', 'stands', 'no_name', 480000, 560000, 6, 'generic', 1, 'mics',
    { 'نوع': 'بوم رومیزی با گیره', 'ارتفاع': 'تا ۷۰ سانتی‌متر', 'جنس': 'فلز' },
    'بازوی متحرک با گیره‌ی محکم برای میکروفون‌های استودیویی؛ میز را خلوت نگه می‌دارد.',
    'Adjustable boom arm with a strong clamp for studio mics.',
    ['پایه میکروفون', 'استودیو']],

  ['رینگ لایت ۲۶ سانت با سه‌پایه', '26cm Ring Light with Tripod', 'ringlight', 'farassoo', 780000, 920000, 9, 'original', 3, 'content',
    { 'قطر': '۲۶ سانتی‌متر', 'نور': 'سه حالت رنگی با ۱۰ سطح روشنایی', 'ارتفاع سه‌پایه': 'تا ۲.۱ متر', 'منبع تغذیه': 'USB' },
    'نور یکنواخت برای لایو، عکاسی محصول و آرایش؛ گیره‌ی موبایل و ریموت بلوتوثی همراه دارد.',
    'Even light for lives, product shots and makeup, with phone holder and Bluetooth remote.',
    ['رینگ لایت', 'لایو', 'عکاسی']],

  ['رینگ لایت جیبی LED', 'Pocket LED Ring Light', 'ringlight', 'no_name', 265000, 0, 12, 'generic', 1, 'content',
    { 'توان': '۵ وات', 'نور': 'دو دمای رنگ', 'باتری': '۲۰۰۰ میلی‌آمپر داخلی' },
    'کوچک و شارژی؛ همیشه در کیف عکاس موبایل جا می‌شود.',
    'Tiny and rechargeable — always fits in your bag.',
    ['رینگ لایت جیبی', 'شارژی']],

  ['سه‌پایه‌ی موبایل تاشو ۱.۶ متری', 'Foldable 1.6m Phone Tripod', 'stands', 'tesco', 540000, 0, 7, 'original', 3, 'content',
    { 'ارتفاع': '۴۵ تا ۱۶۰ سانتی‌متر', 'هد': 'چرخش ۳۶۰ درجه', 'ریموت': 'بلوتوثی جداشونده' },
    'سبک و تاشو برای ولاگ، تایم‌لپس و عکس دسته‌جمعی.',
    'Light and foldable for vlogs, timelapse and group photos.',
    ['سه پایه', 'ولاگ']],

  ['ساعت هوشمند Haylou RS5', 'Haylou RS5 Smart Watch', 'smartwatch', 'haylou', 1450000, 1690000, 6, 'original', 12, 'wearable',
    { 'صفحه': 'AMOLED ۱.۹ اینچ', 'باتری': '۱۰ روز', 'مقاومت': 'IP68', 'سنسور': 'ضربان قلب، اکسیژن خون، خواب' },
    'صفحه‌ی AMOLED روشن حتی زیر آفتاب، تماس بلوتوثی و بیش از ۱۰۰ حالت ورزشی.',
    'Bright AMOLED display, Bluetooth calling and 100+ sport modes.',
    ['ساعت هوشمند', 'AMOLED', 'تماس']],

  ['ساعت هوشمند سامسونگ Galaxy Watch 6', 'Samsung Galaxy Watch 6', 'smartwatch', 'samsung', 9800000, 10500000, 2, 'original', 12, 'wearable',
    { 'سایز': '۴۴ میلی‌متر', 'صفحه': 'Super AMOLED', 'باتری': '۴۰ ساعت', 'ویژگی': 'ECG و فشار خون' },
    'ساعت پرچم‌دار سامسونگ با سنسورهای سلامتی پیشرفته و اتصال به اکوسیستم گلکسی.',
    'Samsung flagship watch with advanced health sensors.',
    ['سامسونگ', 'پرچم‌دار', 'سلامتی']],

  ['ساعت هوشمند شیائومی Redmi Watch 4', 'Xiaomi Redmi Watch 4', 'smartwatch', 'xiaomi', 2850000, 3150000, 5, 'original', 12, 'wearable',
    { 'صفحه': 'AMOLED ۱.۹۷ اینچ', 'باتری': '۲۰ روز', 'بدنه': 'آلومینیوم', 'GPS': 'دارد' },
    'بدنه‌ی آلومینیومی، GPS داخلی و باتری سه هفته‌ای؛ بهترین انتخاب میان‌رده.',
    'Aluminium body, built-in GPS and a three-week battery.',
    ['شیائومی', 'GPS', 'باتری ۲۰ روز']],

  ['عینک هوشمند صوتی با اسپیکر باز', 'Smart Audio Glasses with Open-Ear Speakers', 'smartglass', 'no_name', 7900000, 8900000, 1, 'original', 6, 'wearable',
    { 'اسپیکر': 'دوگانه باز (Open-Ear)', 'میکروفون': '۴ عدد با حذف نویز', 'باتری': '۶ ساعت مکالمه', 'لنز': 'قابل تعویض با prescription' },
    'موزیک و تماس بدون گوشی در گوش؛ مناسب رانندگی، دوچرخه‌سواری و ساحل.',
    'Music and calls without earbuds — great for driving, cycling and the beach.',
    ['عینک هوشمند', 'صوتی']],

  ['دستکش گیمینگ موبایل (۲ جفت)', 'Mobile Gaming Finger Sleeves (2 pairs)', 'gaming', 'no_name', 75000, 95000, 30, 'generic', 0, 'gaming',
    { 'جنس': 'الیاف کربنی ضدتعریق', 'تعداد': '۲ جفت', 'کاربرد': 'پابجی، کالاف دیوتی موبایل' },
    'انگشتت روی صفحه سُر می‌خورد بدون عرق کردن؛ ضخامت نازک و حساسیت بالا.',
    'Smooth, sweat-free fingertips for mobile shooters.',
    ['گیمینگ', 'پابجی', 'دستکش']],

  ['دسته‌ی بازی موبایل با فن خنک‌کننده', 'Mobile Game Controller with Cooling Fan', 'gaming', 'tesco', 980000, 1150000, 4, 'highcopy', 3, 'gaming',
    { 'اتصال': 'بلوتوث ۵.۰', 'خنک‌کننده': 'فن نیمه‌هادی', 'باتری': '۳۰۰۰ میلی‌آمپر', 'سازگاری': 'اندروید و iOS' },
    'گیم‌پد کشویی با فن خنک‌کننده؛ گوشی در بازی طولانی داغ نمی‌کند.',
    'Clip-on gamepad with a semiconductor cooling fan.',
    ['دسته بازی', 'خنک کننده']],

  ['هولدر موبایل ماشین دریچه‌ای', 'Car Air-Vent Phone Holder', 'car', 'baseus', 285000, 340000, 14, 'original', 3, 'car',
    { 'نصب': 'دریچه‌ی کولر', 'چرخش': '۳۶۰ درجه', 'بازو': 'فلزی با پد سیلیکونی' },
    'نصب یک‌دستی، بدون لرزش در جاده‌ی ساحلی؛ مناسب ناوبری.',
    'One-hand mount, no vibration on coastal roads.',
    ['هولدر', 'ماشین']],

  ['هولدر موبایل رومیزی آلومینیومی', 'Aluminium Desk Phone Stand', 'car', 'greenlion', 195000, 0, 19, 'original', 1, 'content',
    { 'جنس': 'آلومینیوم', 'زاویه': 'قابل تنظیم', 'سازگاری': 'موبایل و تبلت تا ۱۱ اینچ' },
    'پایه‌ی رومیزی محکم برای تماشای فیلم، کلاس آنلاین و آشپزخانه.',
    'Sturdy desk stand for videos, online classes and the kitchen.',
    ['پایه رومیزی', 'آلومینیوم']],

  ['فندکی شارژر ماشین دو پورت ۴۵ وات', 'Dual-Port 45W Car Charger', 'car', 'mcdodo', 420000, 490000, 8, 'original', 6, 'car',
    { 'توان کل': '۴۵ وات', 'پورت': 'تایپ‌سی PD + USB-A QC3', 'ویژگی': 'نمایشگر ولتاژ' },
    'هم گوشی را سریع شارژ می‌کند هم ولتاژ باتری ماشین را نشان می‌دهد.',
    'Fast-charges your phone and shows your car battery voltage.',
    ['ماشین', 'شارژ سریع']],

  ['چراغ‌قوه شارژی ضدآب ۱۰۰۰ لومن', 'Rechargeable Waterproof 1000lm Flashlight', 'lighting', 'tesco', 385000, 450000, 11, 'original', 6, 'light',
    { 'روشنایی': '۱۰۰۰ لومن', 'باتری': '۱۸۶۵۰ قابل تعویض', 'مقاومت': 'IPX6', 'حالت‌ها': '۵ حالت نور + SOS' },
    'بدنه‌ی آلومینیومی، زوم قابل تنظیم و بند مچی؛ همراه خوب قطعی برق و کمپ.',
    'Aluminium body, adjustable zoom and wrist strap — great for outages and camping.',
    ['چراغ قوه', 'ضدآب', 'شارژی']],

  ['چراغ‌قوه‌ی جیبی مینی تایپ‌سی', 'Mini USB-C Pocket Flashlight', 'lighting', 'hoco', 145000, 0, 22, 'original', 3, 'light',
    { 'روشنایی': '۳۰۰ لومن', 'شارژ': 'تایپ‌سی', 'وزن': '۶۰ گرم' },
    'کوچک‌تر از یک سوییچ ماشین، اما به‌اندازه‌ی کافی پرنور برای جعبه‌ی ابزار.',
    'Smaller than a car key, bright enough for your toolbox.',
    ['چراغ قوه مینی', 'جیبی']],

  ['پرینتر عکس جیبی بدون جوهر', 'Inkless Pocket Photo Printer', 'misc', 'xiaomi', 2650000, 2950000, 3, 'original', 12, 'misc',
    { 'فناوری': 'ZINK بدون جوهر', 'اندازه چاپ': '۵×۷.۶ سانتی‌متر', 'اتصال': 'بلوتوث ۵.۰', 'کاغذ': 'چسب‌دار پشت‌دار' },
    'عکس‌های گوشی را همان لحظه چاپ کن و به یخچال یا دفتر خاطرات بچسبان.',
    'Print phone photos instantly and stick them on your fridge or journal.',
    ['پرینتر جیبی', 'عکس']],

  ['پمپ بادی شارژی هوشمند', 'Smart Rechargeable Air Pump', 'misc', 'xiaomi', 1450000, 1650000, 5, 'original', 12, 'misc',
    { 'فشار حداکثر': '۱۵۰ PSI', 'نمایشگر': 'دیجیتال با قطع خودکار', 'باتری': '۲۰۰۰ میلی‌آمپر', 'کاربرد': 'توپ، دوچرخه، لاستیک ماشین و تشک بادی' },
    'فشار را تنظیم کن و بگذار خودش قطع کند؛ پاوربانک اضطراری هم هست.',
    'Set the pressure and let it auto-stop; doubles as an emergency power bank.',
    ['پمپ بادی', 'شارژی', 'چندکاره']],

  ['سه‌راهی برق با کلید و محافظ نوسان', '3-Way Power Strip with Surge Protection', 'misc', 'tesco', 320000, 0, 9, 'original', 6, 'misc',
    { 'پریز': '۳ عدد', 'پورت USB': '۲ عدد', 'محافظ': 'نوسان‌گیر', 'طول سیم': '۱.۸ متر' },
    'با پورت USB داخلی و کلید جداگانه برای هر پریز؛ محافظ دستگاه‌های حساس.',
    'With built-in USB ports and individual switches for each socket.',
    ['سه راهی', 'محافظ نوسان']],

  ['کارت حافظه microSD 64GB کلاس 10', '64GB microSD Card Class 10', 'misc', 'no_name', 285000, 340000, 12, 'highcopy', 6, 'misc',
    { 'ظرفیت': '۶۴ گیگابایت', 'سرعت': 'کلاس ۱۰ / U1', 'رابط': 'microSD با آداپتور SD' },
    'برای گوشی، دوربین ورزشی و ضبط ویدیو Full HD.',
    'For phones, action cams and Full HD recording.',
    ['مموری', 'حافظه']],

  ['رم ریدر چندکاره ۴ در ۱', '4-in-1 Multi Card Reader', 'misc', 'hoco', 165000, 0, 15, 'original', 3, 'misc',
    { 'پورت‌ها': 'SD، microSD، USB-A، تایپ‌سی', 'سرعت': 'USB 3.0' },
    'همه‌ی کارت‌های حافظه را با یک مبدل کوچک بخوان.',
    'Read every memory card with one tiny adapter.',
    ['رم ریدر', 'مبدل']],

  ['محافظ کابل فانتزی (ست ۶ عددی)', 'Cable Protector Set (6 pcs)', 'misc', 'no_name', 65000, 85000, 28, 'generic', 0, 'misc',
    { 'تعداد': '۶ عدد', 'جنس': 'سیلیکون', 'کاربرد': 'محافظت از محل اتصال کابل' },
    'از شکستن سر کابل شارژ جلوگیری می‌کند؛ ارزان و کاربردی.',
    'Stops cables breaking at the connector — cheap and useful.',
    ['محافظ کابل', 'سیلیکونی']],

  ['بند ساعت هوشمند سیلیکونی (سایز ۲۲)', 'Silicone Smartwatch Strap 22mm', 'misc', 'no_name', 145000, 0, 20, 'generic', 0, 'watch',
    { 'عرض': '۲۲ میلی‌متر', 'جنس': 'سیلیکون ضدحساسیت', 'رنگ‌بندی': 'مشکی، سرمه‌ای، سبز' },
    'بند نرم و قابل شست‌وشو برای ساعت‌های هوشمند با پین استاندارد.',
    'Soft washable strap for standard-pin smartwatches.',
    ['بند ساعت', 'سیلیکونی']],

  ['کیف کمری ضدآب موبایل', 'Waterproof Phone Waist Pouch', 'misc', 'no_name', 220000, 0, 10, 'generic', 0, 'misc',
    { 'سایز': 'تا ۷ اینچ', 'مقاومت': 'ضد پاشش آب', 'جیب': '۳ عدد' },
    'برای ماهیگیری، لنج‌سواری و پیاده‌روی ساحلی؛ گوشی و کارت بانکی خشک می‌مانند.',
    'For fishing, boats and beach walks — keeps phone and cards dry.',
    ['ضدآب', 'ساحل']],

  ['پایه‌ی عکاسی هشت‌پا (Octopus)', 'Flexible Octopus Tripod', 'stands', 'no_name', 195000, 240000, 13, 'generic', 1, 'content',
    { 'ارتفاع': '۳۰ سانتی‌متر', 'انعطاف': 'پاهای قابل خم شدن', 'حمل بار': 'تا ۱ کیلوگرم' },
    'به نرده، شاخه یا لبه‌ی میز می‌پیچد؛ خلاقیت در عکاسی موبایل.',
    'Wraps around rails and branches for creative mobile photography.',
    ['هشت پا', 'عکاسی']],

  ['شارژر رومیزی ۴ پورت ۶۰ وات', '60W 4-Port Desktop Charger', 'adapters', 'greenlion', 890000, 1050000, 5, 'original', 12, 'adapter',
    { 'توان کل': '۶۰ وات', 'پورت': '۳ تایپ‌سی + ۱ USB-A', 'طول کابل': '۱.۵ متر' },
    'همه‌ی دستگاه‌های خانواده یا همکاران را با یک شارژر تغذیه کن.',
    'Power every device in the family or office from one charger.',
    ['چندپورت', 'رومیزی']],

  ['قاب کیف‌دار چرمی سامسونگ Galaxy A34', 'Leather Flip Case Samsung Galaxy A34', 'cases', 'remax', 420000, 0, 8, 'original', 3, 'case',
    { 'سازگاری': 'Galaxy A34', 'جنس': 'چرم مصنوعی', 'ویژگی': 'جای کارت و پایه‌ی تاشو' },
    'کیف پول و قاب در یک وسیله؛ با پایه‌ی تاشو برای تماشای فیلم.',
    'Wallet and case in one, with a folding kickstand.',
    ['سامسونگ', 'کیف دار']],

  ['گلس نانو مایع (محافظ نامرئی)', 'Liquid Nano Screen Protector', 'glass', 'no_name', 165000, 210000, 16, 'generic', 1, 'glass',
    { 'نوع': 'پوشش نانو مایع', 'سختی': '۹ اچ پس از خشک شدن', 'کاربرد': 'هر صفحه‌ی شیشه‌ای' },
    'برای صفحه‌های منحنی که گلس معمولی نمی‌چسبد؛ نصب در فروشگاه انجام می‌شود.',
    'For curved screens where regular glass fails; applied in-store.',
    ['نانو', 'منحنی']],

  ['اسپیکر بلوتوثی ضدآب ساحلی', 'Waterproof Beach Bluetooth Speaker', 'speakers', 'oraimo', 690000, 0, 8, 'highcopy', 3, 'speaker',
    { 'مقاومت': 'IPX7 شناور روی آب', 'باتری': '۱۰ ساعت', 'ویژگی': 'بند آویز و بدنه‌ی ضربه‌گیر' },
    'روی آب شناور می‌ماند؛ انتخاب محبوب مشتریان ساحلی ما.',
    'Floats on water — a favourite of our beach customers.',
    ['ضدآب', 'ساحل', 'شناور']],

  ['کابل شارژ تایپ‌سی ۲ متری بافته', '2m Braided USB-C Cable', 'cables', 'mcdodo', 195000, 0, 17, 'original', 6, 'cable',
    { 'طول': '۲ متر', 'جریان': '۳ آمپر', 'روکش': 'بافته‌ی دوبل' },
    'وقتی پریز دور است، دو متر کابل نجاتت می‌دهد.',
    'When the socket is far away, two metres save you.',
    ['دو متری', 'بافته']],

  ['آداپتور شارژر دیواری ۱۸ وات QC 3.0', '18W QC 3.0 Wall Charger', 'adapters', 'hoco', 185000, 230000, 20, 'original', 6, 'adapter',
    { 'توان': '۱۸ وات', 'فناوری': 'Quick Charge 3.0', 'پورت': 'USB-A' },
    'شارژر اقتصادی و قابل اعتماد برای گوشی‌های اندرویدی میان‌رده.',
    'An affordable, reliable charger for mid-range Android phones.',
    ['اقتصادی', 'QC 3.0']],

  ['کیس پاوربانک آیفون (قاب شارژی)', 'iPhone Battery Charging Case', 'powerbank', 'no_name', 950000, 1150000, 2, 'highcopy', 3, 'powerbank',
    { 'سازگاری': 'iPhone 12 / 12 Pro', 'ظرفیت': '۳۵۰۰ میلی‌آمپر ساعت', 'شارژ': 'وایرلس و کابلی' },
    'قاب و پاوربانک با هم؛ عمر باتری گوشی را دو برابر می‌کند.',
    'Case and power bank in one — doubles your phone battery life.',
    ['قاب شارژی', 'آیفون']],

  ['هندزفری تک‌گوش بلوتوثی مکالمه', 'Single-Ear Bluetooth Headset', 'earbuds', 'hoco', 340000, 0, 14, 'original', 3, 'audio',
    { 'باتری': '۶ ساعت مکالمه', 'میکروفون': 'حذف نویز', 'کاربرد': 'رانندگی و فروشندگی' },
    'برای راننده‌ها و فروشندگانی که باید همیشه در دسترس باشند.',
    'For drivers and shopkeepers who must stay reachable.',
    ['تک گوش', 'رانندگی']],

  ['ساعت هوشمند کودکان با سیم‌کارت', 'Kids Smart Watch with SIM', 'smartwatch', 'no_name', 1250000, 1450000, 6, 'highcopy', 6, 'wearable',
    { 'سیم‌کارت': 'پشتیبانی 4G', 'ویژگی': 'تماس دوطرفه، موقعیت‌یاب، SOS', 'مقاومت': 'ضد پاشش' },
    'با فرزندت تماس بگیر و موقعیتش را ببین؛ دکمه‌ی SOS برای مواقع اضطراری.',
    'Call your child and see their location, with an SOS button.',
    ['کودک', 'سیم کارت', 'SOS']],
];

// محصولات صفحهٔ اینستاگرام فروشگاه (@jam.yassaei)
IG_CATEGORIES.forEach((c) => { if (!CATEGORIES.some((x) => x.id === c.id)) CATEGORIES.push(c); });
IG_BRANDS.forEach((b) => { if (!BRANDS.some((x) => x.id === b.id)) BRANDS.push(b); });
RAW.push(...IG_RAW);

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
}

export function buildSeed(state) {
  const t = new Date();
  const cats = CATEGORIES.map((c) => ({
    id: c.id, name: c.fa, nameEn: c.en, glyph: GLYPH_MAP[c.glyph] || c.glyph,
    parentId: c.parent || null, order: c.order || 99, active: true,
    description: '', descriptionEn: '', createdAt: t.toISOString(),
  }));

  const brands = BRANDS.map((b) => ({
    id: b.id, name: b.fa, nameEn: b.en, active: true, country: '', createdAt: t.toISOString(),
  }));
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  const products = RAW.map((r, i) => {
    const [name, nameEn, categoryId, brandId, price, oldPrice, stock, authenticity, warrantyMonths, glyph, specs, description, descriptionEn, tags] = r;
    const id = `p${String(i + 1).padStart(3, '0')}`;
    const brand = brandMap.get(brandId) || brandMap.get('no_name');
    return {
      id,
      sku: `BM-${String(1000 + i)}`,
      barcode: ean13(`200${String(100000000 + i * 7919).slice(0, 9)}`),
      name, nameEn,
      categoryId, brandId, brandName: brand.name, brandNameEn: brand.nameEn,
      glyph: glyph === 'watch' ? 'wearable' : glyph,
      price, oldPrice: oldPrice || 0, cost: Math.round(price * 0.72),
      stock, reserved: 0,
      authenticity, warrantyMonths,
      images: [`/assets/img/products/${id}.svg`],
      specs, description, descriptionEn,
      tags: tags || [],
      featured: i % 7 === 0,
      active: true,
      weight: 120 + (i * 37) % 900,
      views: 0,
      sold: 0,
      ratingAvg: 0, ratingCount: 0,
      createdAt: new Date(t.getTime() - i * 3600_000).toISOString(),
      updatedAt: t.toISOString(),
    };
  });

  // کاربران
  const allPerms = Object.fromEntries(PERMISSIONS.map((p) => [p.key, true]));
  const mkWallet = () => ({ balance: 0, transactions: [] });
  const users = [
    {
      id: 'u_owner', username: 'admin', name: 'مدیر فروشگاه', nameEn: 'Store Owner',
      phone: '09120000000', email: 'admin@yassaei-electronics.ir',
      passwordHash: hashPassword('Yassaei@1404'), mustChangePassword: true,
      role: 'owner', permissions: allPerms,
      twoFA: { enabled: false, method: null, secret: generateTotpSecret(), backupCodes: [] },
      wallet: { ...mkWallet(), balance: 250000 },
      plus: { active: true, startedAt: t.toISOString(), until: new Date(t.getTime() + 30 * 86400000).toISOString() },
      addresses: [{
        id: uid('adr'), title: 'مغازه', receiver: 'مدیر فروشگاه', phone: '09120000000',
        province: 'تهران', city: 'تهران', zone: 'city', street: 'خیابان ساحلی، پاساژ مروارید خلیج، همکف، پلاک ۱۲',
        postal: '7516812345', isDefault: true, note: '',
      }],
      wishlist: [], compare: [], prefs: { theme: 'dark', locale: 'fa', density: 'normal' },
      consent: { termsAt: t.toISOString(), privacyAt: t.toISOString() },
      notificationsPrefs: { marketing: true, orders: true, restock: true },
      referralCode: 'ADMIN01', referredBy: null, points: 320,
      status: 'active', createdAt: t.toISOString(), lastLoginAt: null, loginCount: 0,
    },
    {
      id: 'u_staff', username: 'staff', name: 'کارمند فروشگاه', nameEn: 'Staff',
      phone: '09121112233', email: 'staff@yassaei-electronics.ir',
      passwordHash: hashPassword('Staff@1404'), mustChangePassword: false,
      role: 'staff',
      permissions: {
        ...Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])),
        'dashboard.view': true, 'products.view': true, 'products.create': true, 'products.edit': true,
        'products.price': true, 'products.stock': true, 'orders.view': true, 'orders.manage': true,
        'reviews.moderate': true, 'reviews.reply': true, 'tickets.manage': true, 'feedback.manage': true,
        'barcode.print': true, 'barcode.scan': true, 'settings.edit': false, 'users.permissions': false,
        'audit.view': false, 'data.export': false, 'wallet.manage': false, 'refunds.manage': true,
      },
      twoFA: { enabled: false, method: null, secret: generateTotpSecret(), backupCodes: [] },
      wallet: mkWallet(), plus: { active: false, until: null },
      addresses: [], wishlist: [], compare: [], prefs: { theme: 'dark', locale: 'fa' },
      consent: { termsAt: t.toISOString() }, notificationsPrefs: { marketing: false, orders: true, restock: true },
      referralCode: 'STAFF01', referredBy: null, points: 0,
      status: 'active', createdAt: t.toISOString(), lastLoginAt: null, loginCount: 0,
    },
  ];

  const demoCustomers = [
    { id: 'u_demo1', username: 'maryam', name: 'مریم احمدی', phone: '09171234567', email: 'maryam@example.com', city: 'تهران' },
    { id: 'u_demo2', username: 'reza', name: 'رضا دریانورد', phone: '09173456789', email: 'reza@example.com', city: 'گناوه' },
    { id: 'u_demo3', username: 'sina', name: 'سینا مرادی', phone: '09127654321', email: 'sina@example.com', city: 'شیراز' },
  ];
  for (const c of demoCustomers) {
    users.push({
      id: c.id, username: c.username, name: c.name, nameEn: '',
      phone: c.phone, email: c.email,
      passwordHash: hashPassword('Demo@1404'), mustChangePassword: false,
      role: 'user', permissions: {},
      twoFA: { enabled: false, method: null, secret: generateTotpSecret(), backupCodes: [] },
      wallet: { balance: c.id === 'u_demo1' ? 180000 : 0, transactions: c.id === 'u_demo1' ? [{ id: uid('tx'), at: t.toISOString(), type: 'deposit', amount: 180000, status: 'done', note: 'شارژ اولیه', ref: '' }] : [] },
      plus: { active: c.id === 'u_demo2', startedAt: t.toISOString(), until: new Date(t.getTime() + 21 * 86400000).toISOString() },
      addresses: [{
        id: uid('adr'), title: 'خانه', receiver: c.name, phone: c.phone,
        province: 'تهران', city: c.city, zone: c.city === 'تهران' ? 'city' : 'province',
        street: 'خیابان نمونه، کوچه‌ی شماره‌ی ۳، پلاک ۱۲', postal: '7512345678', isDefault: true, note: '',
      }],
      wishlist: [], compare: [], prefs: { theme: 'dark', locale: 'fa' },
      consent: { termsAt: t.toISOString(), privacyAt: t.toISOString() },
      notificationsPrefs: { marketing: true, orders: true, restock: true },
      referralCode: c.username.toUpperCase().slice(0, 6), referredBy: null, points: 40,
      status: 'active', createdAt: new Date(t.getTime() - 86400000 * 5).toISOString(), lastLoginAt: null, loginCount: 0,
    });
  }

  // نظرات نمونه (تأییدشده + در انتظار تأیید)
  const reviews = [
    { pid: 0, uid: 'u_demo1', rating: 5, title: 'کیفیت عالی', body: 'کابل رو برای مک‌بوکم گرفتم، واقعاً اصله و سریع شارژ می‌کنه. بسته‌بندی هم تمیز بود. از مغازه هم حضوری خرید کردم، نصب گلس رایگان انجام شد.', type: 'review', status: 'approved', purchased: true },
    { pid: 0, uid: 'u_demo2', rating: 4, title: 'خوب ولی کوتاه', body: 'کیفیت ساخت خوبه، فقط کاش ۲ متری هم داشت.', type: 'review', status: 'approved', purchased: true },
    { pid: 6, uid: 'u_demo3', rating: 5, title: 'اصل اپل', body: 'با کد رهگیری چک کردم، اورجینال بود. شارژ سریع آیفون ۱۳ رو کامل پشتیبانی می‌کنه.', type: 'review', status: 'approved', purchased: true },
    { pid: 19, uid: 'u_demo1', rating: 5, title: 'ظرفیت واقعی', body: 'پاوربانک انکر واقعاً ظرفیتش درسته؛ گوشیم دو بار کامل شارژ شد. وزنش هم سبکه.', type: 'review', status: 'approved', purchased: true },
    { pid: 30, uid: 'u_demo2', rating: 4, title: 'صدای خوب نسبت به قیمت', body: 'برای قیمتش صدای خیلی خوبی داره، بیسش قویه. فقط دفترچه‌اش فارسی نیست.', type: 'review', status: 'approved', purchased: true },
    { pid: 34, uid: 'u_demo3', rating: 5, title: 'برای پابجی عالیه', body: 'تأخیر صدا توی بازی خیلی کمه، باتریش هم یک هفته کافیه.', type: 'review', status: 'pending', purchased: true },
    { pid: 11, uid: 'u_demo1', rating: 0, title: 'سؤال', body: 'سلام، این قاب برای آیفون ۱۳ پرو مکس نسخه‌ی ۲۵۶ گیگ هم فرقی می‌کنه؟', type: 'question', status: 'approved', purchased: false,
      reply: 'سلام، خیر؛ ابعاد گوشی در همه‌ی نسخه‌های حافظه یکسان است و همین قاب مناسب است.', replyAt: t.toISOString() },
    { pid: 47, uid: 'u_demo2', rating: 0, title: 'سؤال', body: 'سلام، شارژر ساعت سامسونگ هم داخل جعبه هست؟', type: 'question', status: 'pending', purchased: false },
  ];

  const reviewRecs = reviews.map((r) => {
    const u = users.find((x) => x.id === r.uid);
    const p = products[r.pid];
    return {
      id: uid('rev'), productId: p.id, productName: p.name, userId: u.id, userName: u.name,
      userBadge: r.purchased ? 'buyer' : 'visitor',
      type: r.type || 'review', rating: r.rating || 0, title: r.title, body: r.body,
      status: r.status, reply: r.reply || '', replyAt: r.replyAt || null,
      likes: 0, createdAt: new Date(t.getTime() - Math.random() * 86400000 * 6).toISOString(),
    };
  });

  // محاسبه‌ی میانگین امتیاز
  for (const p of products) {
    const rs = reviewRecs.filter((r) => r.productId === p.id && r.type === 'review' && r.status === 'approved' && r.rating > 0);
    p.ratingCount = rs.length;
    p.ratingAvg = rs.length ? Math.round((rs.reduce((a, b) => a + b.rating, 0) / rs.length) * 10) / 10 : 0;
  }

  // سفارش‌های نمونه برای آمار و تاریخچه
  const orders = [];
  const mkOrder = (userId, items, status, delivery, daysAgo) => {
    const u = users.find((x) => x.id === userId);
    const orderItems = items.map(([pi, qty]) => {
      const p = products[pi];
      return { productId: p.id, name: p.name, nameEn: p.nameEn, image: p.images[0], price: p.price, qty, brand: p.brandName };
    });
    const subtotal = orderItems.reduce((a, b) => a + b.price * b.qty, 0);
    const shipping = delivery === 'pickup' ? 0 : 89000;
    const insurance = delivery === 'pickup' ? 0 : Math.max(20000, Math.round(subtotal * 0.015));
    const total = subtotal + shipping + (delivery === 'pickup' ? 0 : insurance);
    const created = new Date(t.getTime() - daysAgo * 86400000);
    const code = `BM-${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(1000 + orders.length)}`;
    const addr = u.addresses[0] || null;
    return {
      id: uid('ord'), code, userId: u.id, userName: u.name, userPhone: u.phone,
      items: orderItems, subtotal, discount: 0, couponCode: '', shipping, insuranceFee: delivery === 'pickup' ? 0 : insurance,
      insured: delivery !== 'pickup', total, walletUsed: 0,
      status, delivery,
      address: addr ? { ...addr } : null,
      payment: { method: delivery === 'pickup' ? 'wallet' : 'gateway', status: status === 'pending_payment' ? 'unpaid' : 'paid', ref: status === 'pending_payment' ? '' : `SIM-${Math.floor(Math.random() * 1e9)}` },
      timeline: [{ status: 'pending_payment', at: created.toISOString(), note: 'ثبت سفارش', by: u.name }],
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      note: '',
    };
  };

  orders.push(mkOrder('u_demo1', [[0, 1], [16, 1]], 'delivered', 'courier', 9));
  orders.push(mkOrder('u_demo2', [[30, 1], [48, 2]], 'delivered', 'pickup', 6));
  orders.push(mkOrder('u_demo3', [[19, 1]], 'shipped', 'courier', 2));
  orders.push(mkOrder('u_demo1', [[56, 1], [60, 1]], 'preparing', 'courier', 1));
  orders.push(mkOrder('u_demo2', [[45, 1]], 'pending_review', 'pickup', 0));
  for (const o of orders) {
    if (['shipped', 'delivered', 'preparing'].includes(o.status)) {
      o.timeline.push({ status: 'confirmed', at: o.createdAt, note: 'تأیید سفارش توسط فروشگاه', by: 'مدیر فروشگاه' });
    }
    if (['shipped', 'delivered'].includes(o.status)) {
      o.timeline.push({ status: 'preparing', at: o.createdAt, note: 'شروع بسته‌بندی', by: 'کارمند فروشگاه' });
      o.timeline.push({ status: 'shipped', at: o.createdAt, note: 'تحویل به پیک / کد رهگیری: T' + Math.floor(Math.random() * 1e8), by: 'کارمند فروشگاه' });
    }
    if (o.status === 'delivered') o.timeline.push({ status: 'delivered', at: o.createdAt, note: 'تحویل به مشتری', by: 'پیک' });
    const p0 = products.find((p) => p.id === o.items[0].productId);
    if (p0 && o.status === 'delivered') p0.sold += o.items[0].qty;
  }

  // بازدیدهای ۳۰ روز اخیر (داده‌ی نمونه برای آمار عمومی)
  const visits = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(t.getTime() - i * 86400000).toISOString().slice(0, 10);
    const base = 38 + ((i * 37) % 45);
    visits[d] = { visits: base, unique: Math.round(base * 0.72), orders: i % 5 === 0 ? 2 : (i % 3 === 0 ? 1 : 0) };
  }
  const today = t.toISOString().slice(0, 10);
  visits[today] = { visits: 27, unique: 19, orders: 1 };

  // کوپن تخفیف
  const coupons = [
    { id: 'cp_welcome', code: 'WELCOME10', type: 'percent', value: 10, maxDiscount: 200000, minOrder: 300000, usageLimit: 200, used: 12, perUser: 1, active: true, startAt: t.toISOString(), endAt: new Date(t.getTime() + 60 * 86400000).toISOString(), note: 'تخفیف خوش‌آمدگویی' },
    { id: 'cp_port', code: 'BANDAR250', type: 'amount', value: 250000, maxDiscount: 250000, minOrder: 1500000, usageLimit: 50, used: 3, perUser: 1, active: true, startAt: t.toISOString(), endAt: new Date(t.getTime() + 30 * 86400000).toISOString(), note: 'جشنواره‌ی تهران' },
  ];

  // تبلیغات
  const ads = [
    {
      id: uid('ad'), slot: 'home_hero', title: 'جشنواره‌ی لوازم جانبی آیفون', titleEn: 'iPhone Accessories Festival',
      text: 'تا ۲۰٪ تخفیف روی قاب، گلس و کابل‌های اصل اپل — فقط تا پایان هفته',
      textEn: 'Up to 20% off genuine Apple cases, glass and cables — this week only',
      link: '#/products?cat=cases&brand=apple', cta: 'مشاهده‌ی تخفیف‌ها', ctaEn: 'See deals',
      image: '', active: true, startAt: t.toISOString(), endAt: new Date(t.getTime() + 30 * 86400000).toISOString(), clicks: 0, views: 0,
    },
    {
      id: uid('ad'), slot: 'sidebar', title: 'اشتراک پلاس', titleEn: 'Plus Membership',
      text: 'ارسال رایگان + بیمه‌ی خودکار مرسوله + ۳٪ تخفیف دائمی',
      textEn: 'Free shipping, automatic insurance and 3% off, always',
      link: '#/account/plus', cta: 'عضویت در پلاس', ctaEn: 'Join Plus', image: '', active: true,
      startAt: t.toISOString(), endAt: new Date(t.getTime() + 90 * 86400000).toISOString(), clicks: 0, views: 0,
    },
    {
      id: uid('ad'), slot: 'product_page', title: 'بیمه‌ی مرسوله را فراموش نکن', titleEn: 'Do not forget transit insurance',
      text: 'با پرداخت مبلغی اندک، کالای گران‌قیمتت در مسیر بیمه می‌شود.',
      textEn: 'For a small fee your valuable order is insured in transit.',
      link: '#/pages/insurance', cta: 'قوانین بیمه', ctaEn: 'Insurance rules', image: '', active: true,
      startAt: t.toISOString(), endAt: new Date(t.getTime() + 90 * 86400000).toISOString(), clicks: 0, views: 0,
    },
  ];

  // تیکت و پیام پشتیبانی نمونه
  const tickets = [
    {
      id: uid('tk'), code: 'TK-1001', userId: 'u_demo2', userName: 'رضا دریانورد',
      subject: 'تأخیر در ارسال سفارش', category: 'order', priority: 'high',
      body: 'سلام، سفارش BM-1002 دو روزه وضعیتش «ارسال شده» مانده. لطفاً کد رهگیری پستی را بفرستید.',
      rulesAccepted: true, status: 'open',
      messages: [{ from: 'user', userId: 'u_demo2', name: 'رضا دریانورد', body: 'سلام، سفارش BM-1002 دو روزه وضعیتش «ارسال شده» مانده.', at: new Date(t.getTime() - 86400000).toISOString() },
        { from: 'staff', userId: 'u_owner', name: 'مدیر فروشگاه', body: 'سلام و وقت بخیر، کد رهگیری پستی برای شما ارسال شد. امروز در مسیر توزیع است.', at: new Date(t.getTime() - 82800000).toISOString() }],
      createdAt: new Date(t.getTime() - 86400000).toISOString(), updatedAt: new Date(t.getTime() - 82800000).toISOString(),
    },
  ];

  const notifications = [
    { id: uid('nt'), userId: null, type: 'announcement', title: 'به فروشگاه اینترنتی یاسایی خوش آمدید', titleEn: 'Welcome to Yassaei Electronics Online Store', body: 'حالا می‌توانی همه‌ی اجناس مغازه را آنلاین ببینی، سفارش بدهی و حضوری یا با پیک تحویل بگیری.', bodyEn: 'Browse the whole shop online and get it delivered or pick it up in store.', link: '#/products', createdAt: t.toISOString(), level: 'info' },
  ];

  const feedback = [
    {
      id: uid('fb'), userId: 'u_demo1', userName: 'مریم احمدی', type: 'suggestion',
      title: 'افزودن برچسب اصالت کالا', body: 'پیشنهاد می‌کنم روی صفحه‌ی هر کالا، لینک استعلام اصالت برند هم گذاشته شود.',
      contact: 'maryam@example.com', status: 'new', page: 'products', createdAt: new Date(t.getTime() - 2 * 86400000).toISOString(),
    },
  ];

  const supportMessages = [];

  state.categories = cats;
  state.brands = brands;
  state.products = products;
  state.users = users;
  state.reviews = reviewRecs;
  state.orders = orders;
  state.coupons = coupons;
  state.ads = ads;
  state.tickets = tickets;
  state.notifications = notifications;
  state.feedback = feedback;
  state.supportMessages = supportMessages;
  state.pages = structuredClone(DEFAULT_PAGES);
  state.visits = visits;
  state.settings = structuredClone(DEFAULT_SETTINGS);
  state.stats = {
    ordersTotal: orders.length + 214,
    revenueTotal: orders.reduce((a, b) => a + (['delivered', 'shipped', 'preparing'].includes(b.status) ? b.total : 0), 0) + 486_300_000,
  };
  state.audit = [{
    id: uid('log'), at: t.toISOString(), actorId: 'system', actorName: 'سامانه', actorRole: 'system',
    action: 'seed.initial', target: 'database', meta: { products: products.length, categories: cats.length, brands: brands.length },
  }];
  state.seeded = true;

  // تولید تصاویر SVG محصولات
  const withBrand = products.map((p) => ({ ...p, brandEn: (brandMap.get(p.brandId) || {}).nameEn || '' }));
  writeProductImages(withBrand, cats);
  return state;
}

export { ORDER_STATUSES, TICKET_CATEGORIES };
