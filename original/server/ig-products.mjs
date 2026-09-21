// ─────────────────────────────────────────────────────────────
//  محصولات صفحهٔ اینستاگرام فروشگاه: @jam.yassaei
//  این ماژول هم توسط seed (استقرار تازه) و هم توسط ابزار
//  افزودن به دیتابیس موجود استفاده می‌شود تا هر دو یکسان بمانند.
// ─────────────────────────────────────────────────────────────

export const IG_BRANDS = [
  { id: 'huawei', fa: 'هواوی', en: 'Huawei' },
  { id: 'realme', fa: 'ریلمی', en: 'Realme' },
  { id: 'sandisk', fa: 'سن‌دیسک', en: 'SanDisk' },
  { id: 'philips', fa: 'فیلیپس', en: 'Philips' },
  { id: 'lenovo', fa: 'لنوو', en: 'Lenovo' },
  { id: 'dji', fa: 'دی‌جی‌آی', en: 'DJI' },
  { id: 'soundcore', fa: 'ساندکور', en: 'Soundcore' },
  { id: 'porodo', fa: 'پورودو', en: 'Porodo' },
];

export const IG_CATEGORIES = [
  { id: 'modem', fa: 'مودم و اینترنت', en: 'Modems & Internet', glyph: 'adapter', order: 23 },
];

// name, nameEn, cat, brand, price, oldPrice, stock, authenticity, warranty, glyph, specs, desc, descEn, tags
export const IG_RAW = [
  ['گیمبال هوشمند گرین لاین Auto Track', 'Green Lion Auto Track Gimbal', 'content', 'greenlion', 12900000, 14500000, 6, 'original', 12, 'content',
    { 'ردیابی': 'خودکار سوژه', 'چرخش': '۳۶۰ درجه', 'فیلم‌برداری': 'دوگانه تا ۱۸۰ درجه', 'نورپردازی': 'RGB', 'باتری': 'تا ۴ ساعت', 'نصب': 'پایهٔ مغناطیسی' },
    'گیمبال هوشمند گرین لاین با ردیابی خودکار سوژه؛ دیگر نگران فیلم‌برداری تنهایی نباشید. چرخش ۳۶۰ درجه، فیلم‌برداری دوگانه تا ۱۸۰ درجه، نورپردازی RGB و پایهٔ مغناطیسی با نصب آسان. جمع‌وجور و قابل حمل؛ مناسب تولید محتوا، ریلز، ولاگ و آموزش.',
    'Green Lion smart gimbal with auto subject tracking, 360° rotation, dual 180° shooting, RGB lighting and magnetic mount — perfect for reels, vlogs and teaching.',
    ['گیمبال', 'تولید محتوا', 'ردیابی خودکار', 'گرین لاین']],

  ['گیمبال DJI Osmo Mobile 8', 'DJI Osmo Mobile 8 Gimbal', 'content', 'dji', 18900000, 21000000, 4, 'original', 12, 'content',
    { 'تثبیت': 'سه‌محوره نسل هفتم', 'چرخش': '۳۶۰ درجه', 'ردیابی': 'سه روش ردیابی سوژه', 'سازگاری': 'Apple DockKit', 'ماژول': 'چندکاره با نور و میکروفون', 'وزن': '۳۷۰ گرم', 'باتری': 'تا ۱۰ ساعت' },
    'جدیدترین گیمبال DJI با تثبیت سه‌محوره نسل هفتم، سه روش ردیابی سوژه، پشتیبانی از Apple DockKit و ماژول چندکاره با نور و میکروفون. مونوپاد و سه‌پایه یکپارچه، وزن ۳۷۰ گرم و تا ۱۰ ساعت کارکرد؛ یک آپگرید جدی برای کیفیت بهتر محتوای موبایلی.',
    'The newest DJI gimbal with 7th-gen 3-axis stabilization, three tracking modes, Apple DockKit support, multifunction module with light and mic, built-in monopod tripod, 370g and up to 10h battery.',
    ['گیمبال', 'DJI', 'تولید محتوا', 'لرزشگیر']],

  ['هدفون ساندکور Soundcore Life Q20 نسخه ارتقایافته', 'Soundcore Life Q20 Upgraded Headphones', 'earbuds', 'soundcore', 4850000, 5600000, 10, 'original', 18, 'audio',
    { 'نویزکنسلینگ': 'ANC قدرتمند', 'درایور': '۴۰ میلی‌متری Hi-Res', 'بیس': 'فناوری BassUp', 'حالت': 'شفافیت (Transparency)', 'باتری': 'تا ۵۰ ساعت', 'شارژ سریع': '۵ دقیقه = ۴ ساعت پخش' },
    'هدفون بی‌سیم ساندکور با نویزکنسلینگ فعال ANC که صدای ترافیک و محیط را تا حد زیادی حذف می‌کند. درایورهای ۴۰ میلی‌متری Hi-Res، تقویت بیس BassUp، حالت شفافیت، تا ۵۰ ساعت پخش و شارژ سریع؛ فقط ۵ دقیقه شارژ برابر ۴ ساعت پخش. گوشی‌های نرم با فوم حافظه‌دار برای استفادهٔ طولانی.',
    'Soundcore Life Q20 (Upgraded) wireless headphones with powerful ANC, 40mm Hi-Res drivers, BassUp, transparency mode, 50h playtime and fast charge (5min = 4h).',
    ['هدفون', 'نویزکنسلینگ', 'انکر', 'ساندکور', 'بلوتوثی']],

  ['اسپیکر بلوتوثی JBL Clip 5', 'JBL Clip 5 Bluetooth Speaker', 'speakers', 'jbl', 3980000, 4400000, 8, 'original', 12, 'speaker',
    { 'توان': '۷ وات', 'مقاومت': 'ضدآب و ضدگردوغبار IP67', 'باتری': 'تا ۱۲ ساعت پخش', 'بلوتوث': 'نسخهٔ ۵.', 'طراحی': 'گیرهٔ آویز کاربردی' },
    'کوچیکه ولی صداش اصلاً کوچیک نیست! اسپیکر جمع‌وجور JBL Clip 5 با صدای قدرتمند ۷ وات، مقاومت ضدآب و ضدگردوغبار IP67، تا ۱۲ ساعت پخش موسیقی و بلوتوث ۵.۳. گیرهٔ کاربردی برای آویختن به کوله و کیف؛ همراهِ سفر، باشگاه، طبیعت و استفادهٔ روزمره.',
    'Compact JBL Clip 5 speaker with punchy 7W sound, IP67 water and dust resistance, 12h playtime, Bluetooth 5.3 and a handy carabiner clip for bag, gym and outdoors.',
    ['اسپیکر', 'بلوتوثی', 'ضدآب', 'JBL', 'قابل حمل']],

  ['مودم جیبی پورودو 4G LTE', 'Porodo Pocket 4G LTE Modem', 'modem', 'porodo', 6450000, 7200000, 5, 'original', 12, 'adapter',
    { 'اینترنت': '4G LTE پرسرعت', 'وای‌فای': 'فناوری WiFi 6', 'اتصال': 'چند دستگاه هم‌زمان', 'نصب': 'فقط قراردادن سیم‌کارت', 'باتری': 'داخلی با شارژ USB-C' },
    'مودم جیبی پورودو با پشتیبانی از اینترنت پرسرعت 4G LTE و فناوری WiFi 6 برای سرعت و پایداری بیشتر. امکان اتصال هم‌زمان چندین دستگاه (گوشی، لپ‌تاپ، تبلت)، نصب آسان بدون تجهیزات پیچیده و باتری داخلی قدرتمند با شارژ USB-C؛ مناسب استفادهٔ شخصی، کاری و سفر.',
    'Porodo pocket modem with fast 4G LTE, WiFi 6 for speed and stability, multi-device connection, easy SIM-only setup and a built-in USB-C rechargeable battery — great for personal, work and travel use.',
    ['مودم', 'جیبی', 'WiFi 6', 'سیم‌کارت', 'سفر']],

  ['مودم روتر پرسرعت نسل جدید (سری محدود)', 'Next-Gen High-Speed Modem Router (Limited)', 'modem', 'no_name', 9800000, 0, 3, 'original', 6, 'adapter',
    { 'کاربری': 'اینترنت پرسرعت خانگی و کاری', 'ویژگی': 'سرعت دانلود و آپلود بالا', 'تعداد': 'سری به‌شدت محدود' },
    'این فقط یک روتر ساده نیست؛ مودمی که می‌تواند پرسرعت‌ترین اینترنت را در اختیارتان بگذارد و سرعت دانلود و آپلودی که تا الان برایتان قفل بود باز می‌کند. تعداد این سری به‌شدت محدود است.',
    'A limited-run next-gen modem router unlocking download and upload speeds far beyond ordinary routers.',
    ['مودم', 'روتر', 'پرسرعت', 'سری محدود']],

  ['شارژر شارژکش ۱۴۰ وات کابل جمع‌شو', '140W Retractable-Cable Fast Charger', 'adapters', 'no_name', 2380000, 2750000, 12, 'original', 6, 'adapter',
    { 'توان': '۱۴۰ وات', 'کابل': 'جمع‌شو داخلی', 'محافظت': 'کاهش حرارت در شارژ طولانی', 'سازگاری': 'گوشی، تبلت و لپ‌تاپ' },
    'باحال‌ترین گجت شارژ: شارژکش ۱۴۰ وات با کابل جمع‌شو که هر چیزی را با آن می‌شود شارژ کرد. چون بدترین دشمن باتری حرارت است، این گجت با مدیریت گرما برای شارژهای شبانه و طولانی طراحی شده؛ تست شده و واقعاً کار می‌کند.',
    'A 140W retractable-cable charger gadget that manages heat during long overnight charging — tested and proven.',
    ['شارژر', 'گجت', '۱۴۰ وات', 'کابل جمع‌شو']],

  ['ولت چرمی مگسیف دو کارت', 'MagSafe Leather Wallet (2 Cards)', 'misc', 'no_name', 890000, 1100000, 15, 'original', 3, 'case',
    { 'مگنت': 'فوق‌العاده قوی', 'ظرفیت': '۲ کارت', 'جنس': 'چرم با کیفیت چاپ عالی', 'طرح': 'گلچین ترندترین طرح‌های امسال' },
    'ولت چرمی طرحدار با مگنت فوق‌العاده قوی و جای دو کارت؛ کیفیت چاپ عالی و گلچینی از ترندترین طرح‌های امسال. به پشت گوشی‌های دارای مگ‌سیف می‌چسبد و کارت‌هایتان را همیشه همراه نگه می‌دارد.',
    'Patterned leather MagSafe wallet with ultra-strong magnet, room for 2 cards and premium print quality.',
    ['ولت', 'جاکارتی', 'چرم', 'مگسیف']],

  ['هولدر بطری مگنتی گوشی (فلاسک مگنتی)', 'Magnetic Bottle Phone Holder Flask', 'stands', 'no_name', 1150000, 1350000, 9, 'original', 3, 'adapter',
    { 'ظرفیت': '۱ لیتر نوشیدنی', 'نگهدارنده': 'حلقهٔ مگنتی گوشی', 'کاربری': 'کار، باشگاه، سفر و کمپینگ' },
    'اول فکر می‌کنی یک فلاسک است… ولی وقتی حلقهٔ مگنتی‌اش را می‌بینی نظرت عوض می‌شود! یک لیتر نوشیدنی همراهت است و گوشی‌ات هم همیشه جلوی چشم؛ یک وسیله برای چند کار در کار، باشگاه، سفر و کمپینگ.',
    'A 1-litre flask with a built-in magnetic ring that holds your phone in sight — one gadget for work, gym, travel and camping.',
    ['هولدر', 'مگنتی', 'فلاسک', 'گجت']],

  ['قاب سیلیکونی پاستلی مگ‌سیف آیفون سری ۱۷', 'Pastel Silicone MagSafe Case for iPhone 17', 'cases', 'apple', 1250000, 1480000, 14, 'original', 3, 'case',
    { 'جنس': 'سیلیکون پاک‌کنی اورجینال', 'رنگ': 'پاستلی خاص و کم‌یاب', 'مگ‌سیف': 'فعال', 'سازگاری': 'سری ۱۷ آیفون', 'ثبات رنگ': 'بدون تغییر رنگ' },
    'رنگ‌هایی که تا حالا ندیده بودید؛ قاب‌های سیلیکونی پاستلی مگ‌سیف فعال برای آیفون سری ۱۷ با جنس سیلیکون پاک‌کنی اورجینال، بدون تغییر رنگ و با مگنت فعال برای لوازم مگ‌سیف.',
    'Rare pastel silicone MagSafe cases for iPhone 17 series — original eraser-feel silicone, active MagSafe, no colour fading.',
    ['قاب', 'سیلیکونی', 'مگسیف', 'آیفون ۱۷', 'پاستلی']],
];
