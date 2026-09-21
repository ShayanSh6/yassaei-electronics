// ─────────────────────────────────────────────────────────────
//  مقادیر پیش‌فرض تنظیمات فروشگاه و محتوای صفحه‌های متنی
// ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  store: {
    name: 'یاسایی',
    nameEn: 'Yassaei Electronics',
    tagline: 'قطعات الکترونیک و لوازم الکتریکی؛ تنوعی به وسعت یک بورسِ تمام‌عیار',
    taglineEn: 'Electronics & electrical parts — straight from Tehran to your hands',
    tabTitle: '',   // عنوان تب مرورگر (خالی = نام فروشگاه)
    faviconUrl: '', // آدرس آیکون تب مرورگر (خالی = آیکون پیش‌فرض یاسایی)
    phone: '02177906667',
    phone2: '09120000000',
    whatsapp: '09120000000',
    email: 'info@yassaei.ir',
    address: 'تهران، نارمک، میدان هفت‌حوض، بورس لوازم الکترونیک و الکتریکی، فروشگاه یاسایی',
    addressEn: 'Tehran, Narmak, Haft-Hoz sq., Electronics bourse, Yassaei Store',
    city: 'تهران',
    cityEn: 'Tehran',
    workingHours: [
      { day: 'شنبه تا چهارشنبه', fa: 'شنبه تا چهارشنبه', en: 'Sat – Wed', time: '۹:۰۰ تا ۲۱:۰۰', timeEn: '09:00 – 21:00' },
      { day: 'پنجشنبه', fa: 'پنجشنبه', en: 'Thursday', time: '۹:۰۰ تا ۲۲:۰۰', timeEn: '09:00 – 22:00' },
      { day: 'جمعه', fa: 'جمعه', en: 'Friday', time: '۱۶:۰۰ تا ۲۱:۰۰', timeEn: '16:00 – 21:00' },
    ],
    socials: { instagram: 'https://instagram.com/jam.yassaei', telegram: 'https://t.me/yassaei_shop_bot', eitaa: '', whatsapp: '' },
    mapCoords: { lat: 35.731026, lng: 51.488461 },
    enamad: '',
    established: 1396,
    description: 'فروشگاه تخصصی قطعات الکترونیک و لوازم الکتریکی یاسایی در تهران؛ با ضمانت اصالت کالا، مهلت تست و ارسال به سراسر ایران.',
    descriptionEn: 'Specialized electronics parts & electrical goods store in Tehran, with authenticity guarantee, test period and nationwide shipping.',
  },

  theme: {
    variant: 'fresh',        // 'fresh' = پوستهٔ تازه · 'classic' = پوستهٔ قبلی (کلید برگشت)
    theme: 'logo',           // قالب پیش‌فرض: لوگوی یاسایی (آبی الکتریک و صاعقه)
    accent: '#3dabff',       // آبی الکتریک یاسایی
    accentEn: '#3dabff',
    mode: 'dark',            // dark | light
    portTheme: true,         // پوسته‌ی امواج الکتریکی و مدار — برای فروشگاه یاسایی روشن
    animations: true,
    radius: 16,              // گردی گوشه‌ها
    density: 'normal',       // compact | normal | comfy
    bgStyle: 'waves',        // waves | grid | plain
    contrast: 'normal',      // normal | high
    rotateDesigns: false,    // چرخش خودکار دیزاین غیرفعال به‌صورت پیش‌فرض
    designPool: ['default', 'tehran-nights', 'azadi', 'valiasr', 'bazaar'], // حداکثر ۵ قالب
  },

  ui: {
    searchPosition: 'center',   // start | center | end
    headerLayout: 'split',      // logoStart | split | centered
    navStyle: 'pills',          // pills | underline
    cardStyle: 'grid',          // grid | list
    stickyHeader: true,
    showTicker: true,
    tickerSpeed: 30,
    tickerItems: [
      'ارسال رایگان سفارش‌های بالای ۲ میلیون تومان به سراسر ایران',
      'ضمانت اصالت کالا؛ مرجوع تا ۷ روز بدون پرسش',
      'پرداخت در محل برای سفارش‌های داخل تهران',
      'مشاورهٔ فنی رایگان برای انتخاب کلید، فیوز، رله و منبع تغذیه',
    ],
    quickView: true,
    floatingChat: true,
    showBreadcrumbs: true,
    productCardInfo: ['brand', 'stock', 'rating'],
    columns: { mobile: 2, tablet: 3, desktop: 4, wide: 5 },
  },

  features: {
    wallet: true,
    plus: true,
    lottery: false,
    installments: false,
    insurance: true,
    tickets: true,
    reviews: true,
    questions: true,
    ads: true,
    imageSearch: true,
    barcode: true,
    priceCheckDevice: true,
    publicStats: true,
    coupons: true,
    liveSupport: true,
    announcements: true,
    wishlist: true,
    compare: true,
    recentlyViewed: true,
    guestCheckout: false,
    priceAlerts: true,
    twoFactor: true,
    referrals: true,
    voiceSearch: true,
    offlineMode: true,
    captcha: true,
    consent: true,
    partners: true,
    // فرصت‌های شغلی و استخدام — کلید اصلی صفحهٔ عمومی + پنل مدیریت
    careers: true,
    // نشان «به قیمت خرید قبل» روی کالا + فیلتر اختصاصی کاتالوگ
    oldPrice: true,
    // چت داخلی تیم (فقط مدیر و کارمند)
    adminChat: true,
  },

  // فرصت‌های شغلی: نمایش دکمهٔ «فرصت‌های شغلی» در ناوبری سایت
  // (خاموش = خود صفحه باقی می‌ماند، فقط دکمهٔ منو پنهان می‌شود)
  careers: {
    navShowInNav: true,
  },

  // نشان «به قیمت خرید قبل»: متن دلخواه مدیر برای برچسب کالاهای قدیمی
  adminNav: { order: [], hidden: [], customLabels: {}, customIcons: {} },
  products: { lowStockTelegramAlertEnabled: false, lowStockTelegramAlertThreshold: 3 },

  oldPrice: {
    badgeText: '🔥 به قیمت خرید قبل',
    badgeTextEn: '🔥 At previous purchase price',
  },

  // ── مدیریت منوها و بخش‌ها — پیش‌فرض خاموش برای ۳ بخش حساس ──
  // این ۳ بخش تا زمانی که مدیر از پنل آن‌ها را روشن نکند، از دید مشتری پنهان هستند
  nav: {
    account: [
      { id: 'dashboard', show: true, on: true, enabled: true, showInNav: true },
      { id: 'orders', show: true, on: true, enabled: true, showInNav: true },
      { id: 'wishlist', show: true, on: true, enabled: true, showInNav: true },
      { id: 'wallet', show: true, on: true, enabled: true, showInNav: true },
      { id: 'plus', show: true, on: true, enabled: true, showInNav: true },
      { id: 'addresses', show: true, on: true, enabled: true, showInNav: true },
      { id: 'notifications', show: true, on: true, enabled: true, showInNav: true },
      { id: 'tickets', show: true, on: true, enabled: true, showInNav: true },
      { id: 'support', show: true, on: true, enabled: true, showInNav: true },
      { id: 'reviews', show: true, on: true, enabled: true, showInNav: true },
      { id: 'feedback', show: true, on: true, enabled: true, showInNav: true },
      { id: 'referrals', show: true, on: true, enabled: true, showInNav: true },
      { id: 'profile', show: true, on: true, enabled: true, showInNav: true },
      { id: 'kyc', show: false, on: false, enabled: false, showInNav: false },
      { id: 'lottery', show: false, on: false, enabled: false, showInNav: false },
      { id: 'installments', show: false, on: false, enabled: false, showInNav: false },
      { id: 'security', show: true, on: true, enabled: true, showInNav: true },
      { id: 'prefs', show: true, on: true, enabled: true, showInNav: true },
      { id: 'data', show: true, on: true, enabled: true, showInNav: true },
    ],
    header: [
      { id: 'home', show: true, on: true, enabled: true, showInNav: true },
      { id: 'products', show: true, on: true, enabled: true, showInNav: true },
      { id: 'deals', show: true, on: true, enabled: true, showInNav: true },
      { id: 'new', show: true, on: true, enabled: true, showInNav: true },
      { id: 'stats', show: true, on: true, enabled: true, showInNav: true },
      { id: 'priceCheck', show: true, on: true, enabled: true, showInNav: true },
      { id: 'lottery', show: false, on: false, enabled: false, showInNav: false },
      { id: 'installments', show: false, on: false, enabled: false, showInNav: false },
      { id: 'about', show: true, on: true, enabled: true, showInNav: true },
      { id: 'contact', show: true, on: true, enabled: true, showInNav: true },
    ],
    mobile: [
      { id: 'mHome', show: true, on: true, enabled: true, showInNav: true },
      { id: 'mProducts', show: true, on: true, enabled: true, showInNav: true },
      { id: 'mSearch', show: true, on: true, enabled: true, showInNav: true },
      { id: 'mCart', show: true, on: true, enabled: true, showInNav: true },
      { id: 'mAccount', show: true, on: true, enabled: true, showInNav: true },
    ],
  },

  shipping: {
    courierBase: 89000,          // تومان
    freeOver: 2500000,           // ارسال رایگان بالای این مبلغ
    insuranceRatePct: 1.5,       // درصد ارزش کالا
    insuranceMin: 20000,
    insuranceMaxCoverPct: 100,
    pickupEnabled: true,
    courierEnabled: true,
    expressEnabled: true,
    expressFee: 45000,
    handlingHours: 24,
    zones: [
      { id: 'city', name: 'داخل شهر تهران', nameEn: 'Within Tehran', fee: 35000, eta: '۲ تا ۶ ساعت' },
      { id: 'province', name: 'استان تهران', nameEn: 'Tehran Province', fee: 65000, eta: '۱ تا ۲ روز' },
      { id: 'country', name: 'سراسر ایران', nameEn: 'Nationwide', fee: 89000, eta: '۲ تا ۴ روز' },
    ],
  },

  // ── ابزارهای فروش و مشاوره (پنل مدیریت → تنظیمات → ابزارهای فروش) ──
  // هر قابلیت یک کلید اصلی روشن/خاموش دارد؛ با خاموش‌شدن، بلافاصله از سایت
  // مشتری حذف می‌شود. این بخش هم مثل بقیهٔ تنظیمات در data/custom-settings.json
  // پایدار می‌ماند و با ری‌استارت یا دیپلوی از بین نمی‌رود.
  salesTools: {
    stickyBuyBarEnabled: true,      // نوار خرید چسبان پایین صفحهٔ محصول (موبایل)
    whatsappConsultEnabled: true,   // دکمهٔ «مشاورهٔ فنی در واتساپ» در صفحهٔ محصول
    whatsappPhone: '',              // شمارهٔ واتساپ اختصاصی؛ خالی = واتساپ/موبایل/تلفن فروشگاه
    wholesaleInquiryEnabled: true,  // دکمهٔ «استعلام قیمت همکاری و خرید عمده» در صفحهٔ محصول (برق‌کار/پیمانکار)
    productWarrantyBadgeEnabled: true, // نشان «ضمانت اصالت و سلامت فیزیکی قطعات الکتریکی یاسایی»
    productWarrantyMonths: 12,      // مدت گارانتی نشان‌شده روی نشان (ماه)؛ صفر = بدون ذکر مدت
    skuFastSearchEnabled: true,     // اولویت حداکثری جست‌وجو برای SKU/بارکد/پارت‌نامبر (LM317، NE555، سیم 2.5…)
    proformaInvoiceEnabled: true,   // دکمهٔ «دریافت پیش‌فاکتور رسمی» در سبد خرید
    freeShippingBarEnabled: true,   // نوار پیشرفت «تا ارسال رایگان» در سبد خرید
    freeShippingThreshold: 0,       // آستانهٔ اختصاصی نوار (تومان)؛ ۰ = همان «ارسال رایگان از مبلغ» بخش ارسال
    bankDetailsEnabled: true,       // نمایش کادر کارت‌به‌کارت/شبا (صفحهٔ پرداخت و فاکتور) + روش پرداخت «کارت به کارت»
    bankDetails: {
      bankName: '',                 // نام بانک (اختیاری)
      cardNumber: '',               // شمارهٔ کارت ۱۶ رقمی
      iban: '',                     // شمارهٔ شبا (IR + ۲۴ رقم)
      owner: '',                    // نام صاحب حساب
    },
  },

  plus: {
    enabled: true,
    price: 79000,
    durationDays: 30,
    discountPct: 3,
    freeShippingMin: 0,
    autoInsurance: true,
    prioritySupport: true,
    expressDiscountPct: 50,
    perks: [
      { id: 'ship', fa: 'ارسال رایگان برای همه‌ی سفارش‌ها', en: 'Free shipping on all orders' },
      { id: 'express', fa: '۵۰٪ تخفیف روی ارسال فوری', en: '50% off express delivery' },
      { id: 'insurance', fa: 'بیمه‌ی خودکار و رایگان مرسوله', en: 'Automatic free shipment insurance' },
      { id: 'discount', fa: '۳٪ تخفیف روی قیمت کالاها', en: '3% off product prices' },
      { id: 'support', fa: 'پشتیبانی اولویت‌دار و پاسخ سریع‌تر تیکت', en: 'Priority support & faster ticket replies' },
      { id: 'reserve', fa: 'رزرو کالا تا ۴۸ ساعت قبل از خرید', en: 'Hold items for 48 hours' },
    ],
  },

  orders: {
    minOrder: 0,
    // سقف هوشمند خرید بر پایهٔ تراکنش روزانهٔ دستگاه و کارت/شبا؛
    // با خاموش‌کردن کلید، هیچ محدودیتی اعمال نمی‌شود.
    orderMaxCeilingEnabled: true,
    orderMaxAmount: 100000000,
    // ── سقف خرید غلتان بر پایهٔ خریدهای «موفق» (پرداخت‌شده) ──────
    // هیچ‌گاه کاربر را مسدود یا محروم نمی‌کند؛ فقط مبلغ خریدهای موفقِ
    // بازهٔ زمانی را از سقف کم می‌کند. سفارش‌های پرداخت‌نشده، در انتظار
    // یا لغوشده هرگز در این سقف شمرده نمی‌شوند. همهٔ مقادیر از پنل مدیریت
    // (تنظیمات → سفارش و پرداخت) قابل تغییر است.
    orderCeilingEnabled: true,      // کلید اصلی سقف غلتان (خاموش = قانون کاملاً غیرفعال)
    orderCeilingAmount: 100000000,  // مبلغ سقف (تومان) — پیش‌فرض ۱۰۰ میلیون
    orderCeilingHours: 48,          // بازهٔ زمانی غلتان (ساعت) — پیش‌فرض ۴۸ ساعت
    walletEnabled: true,
    codEnabled: true,
    gatewayEnabled: true,
    gatewayMode: 'demo',      // demo | live
    autoCancelHours: 72,
    stockReserveMinutes: 20,
    refundToWallet: true,
    // ── احراز هویت (KYC) هنگام ثبت سفارش ─────────────────────
    // پیش‌فرض: غیرفعال. یعنی هیچ اجباری برای احراز هویت جهت ثبت سفارش وجود
    // ندارد و فقط خرید اقساطی/قرعه‌کشی از آن سود می‌برد. مدیر فروشگاه از
    // «پنل مدیریت → تنظیمات → سفارش و پرداخت» قاعده را عوض می‌کند.
    // condition: disabled | all | amount | installments | first_order
    kyc: {
      enabled: false,         // کلید اصلی سیستم احراز هویت (kycEnabled) — پیش‌فرض خاموش
      showInNav: false,       // نمایش دکمهٔ احراز هویت در پنل کاربری (kycShowInNav) — پیش‌فرض مخفی
      required: false,        // کلید اصلی اجبار (kycRequired)
      condition: 'disabled',  // قاعدهٔ اجبار (kycCondition)
      minAmount: 50000000,    // آستانهٔ مبلغ برای قاعدهٔ amount (kycMinAmount)
      message: '',            // پیام دلخواه هنگام مسدود شدن سفارش
    },
  },

  seo: {
    title: 'یاسایی | فروشگاه لوازم الکترونیک و الکتریکی در تهران',
    description: 'خرید قطعات برد، ابزار لحیم‌کاری، کابل و سیم، روشنایی و لوازم الکتریکی با ضمانت اصالت و ارسال از تهران به سراسر ایران.',
    keywords: 'الکتریکی یاسایی, لوازم الکتریکی, قطعات الکترونیک, سیم و کابل, کلید و پریز, فیوز مینیاتوری, کنتاکتور, رله, نوار LED, منبع تغذیه, خازن, ابزار صنعتی, تهران, نارمک, هفت‌حوض',
  },

  currency: { code: 'IRT', label: 'تومان', labelEn: 'Toman' },
  contact: { supportNote: 'پاسخ‌گویی تلفنی هر روز از ساعت ۹ تا ۲۱' },
  partners: {
    items: [
      { fa: 'اشنایدر الکتریک', en: 'Schneider Electric' },
      { fa: 'زیمنس', en: 'Siemens' },
      { fa: 'ای‌بی‌بی', en: 'ABB' },
      { fa: 'ال‌اس', en: 'LS Electric' },
      { fa: 'اُمرون', en: 'Omron' },
      { fa: 'فینِدر', en: 'Finder' },
      { fa: 'مین‌ول', en: 'Mean Well' },
      { fa: 'لگراند', en: 'Legrand' },
      { fa: 'فیلیپس', en: 'Philips' },
      { fa: 'اسرام', en: 'OSRAM' },
      { fa: 'پارس‌فانال', en: 'Pars Fanal' },
      { fa: 'خیام الکتریک', en: 'Khayam Electric' },
      { fa: 'رونیکس', en: 'Ronix' },
      { fa: 'بوش', en: 'Bosch' },
    ],
  },
  // ── پدافند ترافیک و اتاق انتظار ──
  security: {
    queueEnabled: true,        // صف‌بندی بازدیدکنندگان هنگام شلوغی
    maxConcurrent: 80,         // سقف درخواست‌های همزمان در حال پردازش
    triggerRps: 40,            // آستانهٔ درخواست در ثانیه برای فعال شدن صف
    passTtlMin: 30,            // اعتبار گذرنامهٔ ورود (دقیقه)
    pollSec: 4,                // فاصلهٔ بررسی نوبت در صفحهٔ صف
    floodBanPerMin: 2500,      // بیش از این تعداد درخواست در دقیقه از یک IP → مسدودسازی خودکار
    floodBanMin: 15,           // مدت مسدودسازی خودکار (دقیقه)
    // محافظت سمت کاربر در برابر Inspect و برداشت کد (کلیک راست، میان‌برهای
    // DevTools، هشدار کنسول و جلوگیری از کشیدن تصاویر کالا).
    // پیش‌فرض روشن است و مدیر می‌تواند از #/admin/settings/security خاموشش کند.
    antiInspectEnabled: true,
  },

  // ── بات تلگرام ──────────────────────────────────────────
  // توکن از متغیر محیطی BM_TG_TOKEN خوانده می‌شود (هرگز به‌صورت متن در گیت
  // نوشته نمی‌شود) و این بخش پس از راه‌اندازی در data/db.json ذخیره می‌ماند تا
  // بات بعد از هر دیپلوی با توکن پایدار بالا بیاید و فیلد توکن در پنل مدیریت
  // خالی دیده نشود. برای ست‌کردن دستی: پنل مدیریت → بازاریابی → بات تلگرام.
  telegram: {
    enabled: true,
    token: process.env.BM_TG_TOKEN || '',
  },
  // ساختار جدید یکپارچه‌سازی‌ها؛ tgWithEnv هر دو مسیر را پشتیبانی می‌کند.
  integrations: {
    telegram: {
      // enabled عمداً وجود ندارد تا مقدار قدیمی telegram.enabled حفظ شود.
      botToken: process.env.BM_TG_TOKEN || '',
    },
  },
};

// ─────────────────────────────────────────────────────────────
//  محتوای صفحه‌ها (فارسی و انگلیسی)
// ─────────────────────────────────────────────────────────────
export const DEFAULT_PAGES = {
  about: {
    hero: {
      title: 'درباره‌ی یاسایی',
      titleEn: 'About Yassaei Electronics',
      subtitle: 'فروشگاهی ۲۰۰ متری در نارمک تهران، با تنوعی به وسعت یک بورس تمام‌عیار',
      subtitleEn: 'A 200m² store in Narmak, Tehran — a whole bazaar under one roof',
    },
    sections: [
      {
        title: 'داستان ما',
        titleEn: 'Our story',
        body: 'یاسایی از سال ۱۳۹۶ در میدان هفت‌حوض نارمک با یک ویترین کوچک قطعات الکترونیک شروع کرد؛ امروز همان مغازه بیش از ۲۰۰ متر است و از مقاومت یک‌هزارتومانی تا کنتاکتور صنعتی را یک‌جا جلویتان می‌گذارد. وسواس ما روی اصالت کالا و مشاورهٔ درست قبل از فروش است.',
        bodyEn: 'Yassaei Electronics started in 2017 at Haft-Hoz square in Narmak, Tehran, with a single showcase of electronic components. Today the same shop spans more than 200 m² and puts everything from a one-thousand-toman resistor to an industrial contactor in front of you. We obsess over genuine parts and honest advice before every sale.',
      },
      {
        title: 'چرا مشتریان ما را انتخاب می‌کنند؟',
        titleEn: 'Why customers choose us',
        list: [
          { icon: 'shield', fa: 'ضمانت اصالت کالا؛ همه‌ی اجناس از منابع معتبر و با فاکتور رسمی تأمین می‌شوند.', en: 'Authenticity guarantee; all items sourced from trusted suppliers with official invoices.' },
          { icon: 'clock', fa: 'مهلت تست ۷ روزه طبق ماده‌ی ۳۷ قانون تجارت الکترونیکی؛ اگر راضی نبودی، پس بده.', en: '7-day trial period per Article 37 of Iran E-Commerce Law.' },
          { icon: 'wallet', fa: 'قیمت بورس؛ به‌خاطر حضور در بورس لوازم الکتریکی هفت‌حوض، قیمت‌هایمان رقابتی‌تر از مغازه‌های پراکنده‌ی شهر است.', en: 'Bourse prices — being inside the Haft-Hoz electrical bourse means sharper prices than scattered shops.' },
          { icon: 'truck', fa: 'ارسال سریع به سراسر ایران + تحویل حضوری در مغازه با بسته‌بندی ضربه‌گیر برای قطعات حساس.', en: 'Fast nationwide shipping plus in-store pickup with protective packaging for sensitive parts.' },
          { icon: 'headset', fa: 'مشاوره‌ی فنی رایگان و صادقانه؛ اگر کلید یا رله‌ای برای کار تو مناسب نباشد، خودمان می‌گوییم نخر.', en: 'Free, honest technical advice — if a breaker or relay is not right for your job, we will tell you.' },
          { icon: 'tools', fa: 'خدمات پس از فروش: تست و تعویض کلید، رله و منبع تغذیه‌ی معیوب در مهلت گارانتی فروشگاه.', en: 'After-sales service: in-store testing and warranty replacement of faulty switches, relays and power supplies.' },
        ],
      },
      {
        title: 'چه چیزهایی در مغازه‌ی ما پیدا می‌شود؟',
        titleEn: 'What you will find in our shop',
        body: 'سیم و کابل برق در همه‌ی سایزها (افشان، مفتولی، شیلددار و کابل شبکه)، کلید و پریز، فیوز مینیاتوری و کلید محافظ جان، کنتاکتور و رله‌های صنعتی، بی‌متال و تایمر، منبع تغذیه‌ی سوئیچینگ، ترانس و آداپتور، نوار LED و درایور، لامپ و پروژکتور، خازن و مقاومت و انواع قطعات برد، ابزار لحیم‌کاری و هویه، مولتی‌متر و فازمتر، ابزار صنعتی و دستی، سینی و داکت کابل، ترمینال و سرسیم، و کلی قطعه‌ی ریز و درشت دیگر برای برق ساختمان و صنعتی.',
        bodyEn: 'Wires and cables in every gauge (flexible, solid, shielded and network cable), switches and sockets, miniature circuit breakers and RCDs, contactors and industrial relays, thermal overloads and timers, switching power supplies, transformers and adapters, LED strips and drivers, lamps and floodlights, capacitors, resistors and board components, soldering irons and tools, multimeters and voltage testers, industrial and hand tools, cable trays and trunking, terminals and lugs — plus countless small parts for building and industrial wiring.',
      },
      {
        title: 'تعهد ما به تو',
        titleEn: 'Our commitment',
        body: 'ما یک کسب‌وکار خانوادگی و محلی هستیم؛ اسم و اعتبارمان برایمان از سود یک فاکتور مهم‌تر است. هر کالایی که روی سایت می‌بینی، همان کالایی است که روی قفسه‌ی مغازه هست: موجودی واقعی، قیمت واقعی و عکس واقعی. اگر کالایی ناموجود شد، خودکار از سایت حذف یا «ناموجود» می‌شود تا وقتت تلف نشود.',
        bodyEn: 'We are a local family business; our name matters more than the profit of a single invoice. Every item on the website is exactly what sits on our shelves: real stock, real prices, real photos. Out-of-stock items are marked automatically so your time is never wasted.',
      },
    ],
    stats: [
      { fa: 'سال فعالیت', en: 'Years active', key: 'years' },
      { fa: 'قلم کالای فعال', en: 'Active products', key: 'products' },
      { fa: 'سفارش تحویل‌شده', en: 'Orders delivered', key: 'orders' },
      { fa: 'مشتری راضی', en: 'Happy customers', key: 'customers' },
    ],
  },

  guide: {
    hero: {
      title: 'راهنمای خرید',
      titleEn: 'Buying guide',
      subtitle: 'از انتخاب کالا تا تحویل درب خانه، قدم‌به‌قدم با تو هستیم',
      subtitleEn: 'From picking an item to doorstep delivery, we walk you through it',
    },
    steps: [
      { title: 'جست‌وجو یا انتخاب دسته‌بندی', titleEn: 'Search or browse', body: 'از نوار جست‌وجوی بالای سایت، فیلتر برند و قیمت، یا دسته‌بندی‌ها استفاده کن. با «جست‌وجوی تصویری» هم می‌توانی عکس کالا را بفرستی تا مشابهش را پیدا کنیم.', bodyEn: 'Use the search bar, brand and price filters, or categories. You can also upload a photo and let visual search find similar items.' },
      { title: 'بررسی صفحه‌ی محصول', titleEn: 'Check the product page', body: 'مشخصات فنی (ولتاژ، جریان، توان، سایز سیم)، موجودی واقعی، عکس‌ها، نظرات کاربران و سؤالات پاسخ‌داده‌شده را ببین. اگر سؤال فنی داشتی، همان‌جا بپرس یا با دکمه‌ی واتساپ مشاوره بگیر.', bodyEn: 'Review specs (voltage, current, power, wire gauge), real stock, photos, user reviews and answered questions. Ask a technical question right there or via the WhatsApp button.' },
      { title: 'افزودن به سبد یا ذخیره در لیست من', titleEn: 'Add to cart or wishlist', body: 'اگر هنوز مطمئن نیستی، کالا را به «لیست من» اضافه کن تا بعداً تصمیم بگیری. مقایسه‌ی کالاها هم برای انتخاب بهتر در دسترس است.', bodyEn: 'Not sure yet? Save it to My List for later, or use product comparison.' },
      { title: 'انتخاب روش تحویل', titleEn: 'Choose delivery', body: 'دو حالت داری: تحویل حضوری از مغازه (رایگان و فوری) یا ارسال با پیک و پست. برای ارسال، گزینه‌ی بیمه‌ی مرسوله هم وجود دارد.', bodyEn: 'Two options: free in-store pickup or courier/postal shipping, with optional shipment insurance.' },
      { title: 'پرداخت', titleEn: 'Payment', body: 'پرداخت از کیف پول، درگاه بانکی یا پرداخت در محل (برای سفارش‌های واجد شرایط) امکان‌پذیر است. کد تخفیف را هم در همین مرحله وارد کن.', bodyEn: 'Pay from your wallet, online gateway, or cash on delivery for eligible orders. Apply coupon codes here.' },
      { title: 'پیگیری سفارش', titleEn: 'Track your order', body: 'از بخش «سفارش‌های من» وضعیت لحظه‌ای را ببین. هر تغییر وضعیت با اعلان به تو اطلاع داده می‌شود.', bodyEn: 'Follow live status in My Orders; every change triggers a notification.' },
    ],
    tips: [
      { fa: 'برای سیم و کابل، سطح مقطع (مثلاً ۱.۵ یا ۲.۵ میلی‌متر مربع) را با جریان مصرفی و طول مسیر مطابقت بده.', en: 'For wires and cables, match the cross-section (e.g. 1.5 or 2.5 mm²) to the load current and run length.' },
      { fa: 'آمپر فیوز مینیاتوری و کلید محافظ جان را بر اساس بار مدار انتخاب کن، نه بزرگ‌ترین عدد موجود.', en: 'Pick breaker and RCD ratings from the circuit load, not the biggest number on the shelf.' },
      { fa: 'برای رله، کنتاکتور و منبع تغذیه، ولتاژ بوبین/ورودی و جریان مجاز کنتاکت‌ها را در مشخصات چک کن.', en: 'For relays, contactors and power supplies, check coil/input voltage and contact current rating in the specs.' },
      { fa: 'نوار LED را با درایور/منبع تغذیه‌ی هم‌ولتاژ (۱۲ یا ۲۴ ولت) و با حداقل ۲۰٪ توان اضافه بخر.', en: 'Buy LED strips with a matching 12 V or 24 V driver and at least 20% headroom in power.' },
      { fa: 'اگر کالا ناموجود بود، روی «خبرم کن» بزن تا به محض موجود شدن اعلان بگیری.', en: 'If an item is out of stock, hit Notify me to get an alert when it returns.' },
      { fa: 'برای خرید عمده یا همکاری، از بخش تیکت با موضوع «همکاری و تبلیغات» پیام بده.', en: 'For wholesale or partnership, open a ticket with the Partnership subject.' },
    ],
  },

  service: {
    hero: {
      title: 'خدمات مشتریان',
      titleEn: 'Customer services',
      subtitle: 'هر کاری که برای آرامش خیال تو انجام می‌دهیم',
      subtitleEn: 'Everything we do for your peace of mind',
    },
    items: [
      { icon: 'shield', title: 'ضمانت اصالت و سلامت فیزیکی', titleEn: 'Authenticity & physical integrity guarantee', body: 'همه‌ی کالاها قبل از ارسال بازبینی و تست می‌شوند. اگر کالای دریافتی با توضیحات سایت مطابقت نداشت یا آسیب فیزیکی داشت، بدون بحث تعویض یا بازگشت وجه انجام می‌شود.', bodyEn: 'All items are inspected and tested before dispatch. Mismatch or damage means replacement or refund, no argument.' },
      { icon: 'refresh', title: '۷ روز مهلت انصراف', titleEn: '7-day withdrawal', body: 'طبق ماده‌ی ۳۷ قانون تجارت الکترونیکی، تا ۷ روز کاری پس از تحویل می‌توانی بدون ذکر دلیل منصرف شوی. تنها هزینه‌ی بازگشت کالا بر عهده‌ی خریدار است و کالا باید در وضعیت نو و با بسته‌بندی سالم باشد.', bodyEn: 'Per Article 37 of the E-Commerce Law you have 7 working days to withdraw without giving a reason; return shipping is on the buyer and the item must be unused.' },
      { icon: 'tools', title: 'گارانتی فروشگاه', titleEn: 'Store warranty', body: 'کلید و پریز، رله، کنتاکتور، منبع تغذیه و ابزار برقی مشمول گارانتی تعویض فروشگاه (بین ۱ تا ۱۲ ماه بسته به برند) هستند. گارانتی شامل آسیب فیزیکی، آب‌خوردگی، اتصال اشتباه و نوسان شدید برق نمی‌شود.', bodyEn: 'Switches and sockets, relays, contactors, power supplies and power tools carry a 1–12 month store replacement warranty, excluding physical damage, liquids, wrong wiring and severe power surges.' },
      { icon: 'headset', title: 'پشتیبانی آنلاین و تیکت', titleEn: 'Live support & tickets', body: 'چت آنلاین در ساعات کاری، تیکت ۲۴ ساعته و پشتیبانی تلفنی. تیکت‌های دارای اولویت «بحرانی» در کمتر از ۲ ساعت بررسی می‌شوند.', bodyEn: 'Live chat during working hours, 24/7 tickets and phone support. Critical tickets are handled within 2 hours.' },
      { icon: 'truck', title: 'ارسال و بیمه‌ی مرسوله', titleEn: 'Shipping & insurance', body: 'ارسال با پیک شهری، تیپاکس و پست پیشتاز. امکان بیمه‌ی مرسوله برای پوشش خسارت و مفقودی در مسیر وجود دارد.', bodyEn: 'City courier, Tipax and postal shipping, with optional transit insurance covering damage and loss.' },
      { icon: 'gift', title: 'باشگاه مشتریان و اشتراک پلاس', titleEn: 'Loyalty club & Plus membership', body: 'با هر خرید امتیاز بگیر، کیف پولت را شارژ کن و با اشتراک پلاس از ارسال رایگان، بیمه‌ی خودکار و تخفیف دائمی بهره‌مند شو.', bodyEn: 'Earn points on every purchase, top up your wallet and enjoy free shipping, auto insurance and permanent discounts with Plus.' },
      { icon: 'scan', title: 'خدمات حضوری فروشگاه', titleEn: 'In-store services', body: 'تست رایگان کلید، رله و منبع تغذیه در مغازه، متراژ و برش سیم و کابل به اندازه‌ی دلخواه، چاپ برچسب و بارکد اختصاصی برای همکاران برق‌کار، و مشاوره‌ی خرید حضوری.', bodyEn: 'Free in-store testing of switches, relays and power supplies, wire and cable cut to length, custom barcode labels for electrician partners, and in-person advice.' },
      { icon: 'chat', title: 'مشاوره‌ی تخصصی', titleEn: 'Expert consultation', body: 'برای انتخاب سایز سیم و کابل، آمپر فیوز و کلید محافظ جان، کنتاکتور و رله‌ی مناسب تابلو، یا منبع تغذیه‌ی درست برای نوار LED، رایگان و از طریق واتساپ مشاوره بگیر.', bodyEn: 'Get free advice — also via WhatsApp — on wire gauge, breaker and RCD ratings, the right contactor or relay for your panel, or the correct power supply for LED strips.' },
    ],
  },

  faq: [
    { cat: 'orders', q: 'چطور سفارشم را پیگیری کنم؟', qEn: 'How do I track my order?', a: 'وارد حساب کاربری شو و به بخش «سفارش‌های من» برو. وضعیت هر سفارش (در انتظار پرداخت، تأیید شده، در حال آماده‌سازی، ارسال شده، تحویل شده) همراه با زمان دقیق و کد رهگیری نمایش داده می‌شود. هر تغییر وضعیت هم با اعلان در سایت به تو اطلاع داده می‌شود.', aEn: 'Sign in and open My Orders. Each order shows its exact status, timestamps and tracking code, and every change sends you a notification.' },
    { cat: 'orders', q: 'امکان پرداخت در محل وجود دارد؟', qEn: 'Is cash on delivery available?', a: 'بله، برای سفارش‌های داخل استان تهران تا سقف مبلغ تعیین‌شده امکان پرداخت در محل وجود دارد. برای مبالغ بالاتر، پرداخت آنلاین یا کیف پول پیشنهاد می‌شود.', aEn: 'Yes, within Tehran province up to a set limit. For higher amounts we suggest online payment or wallet.' },
    { cat: 'shipping', q: 'هزینه و زمان ارسال چقدر است؟', qEn: 'Shipping cost and time?', a: 'داخل شهر تهران با پیک: ۲ تا ۶ ساعت. داخل استان: ۱ تا ۲ روز. سایر نقاط ایران با پست پیشتاز یا تیپاکس: ۲ تا ۴ روز کاری. هزینه‌ی ارسال بر اساس منطقه در صفحه‌ی پرداخت محاسبه و شفاف نمایش داده می‌شود و بالای مبلغ تعیین‌شده رایگان است.', aEn: 'City courier 2–6 hours, province 1–2 days, nationwide 2–4 working days. Fees are calculated transparently at checkout and free above a threshold.' },
    { cat: 'shipping', q: 'تحویل حضوری چطور است؟', qEn: 'How does in-store pickup work?', a: 'در صفحه‌ی پرداخت گزینه‌ی «تحویل حضوری» را انتخاب کن. پس از تأیید سفارش، اعلان آماده‌سازی برایت ارسال می‌شود و می‌توانی در ساعات کاری با در دست داشتن کد سفارش به مغازه بیایی. تحویل حضوری رایگان است.', aEn: 'Pick "In-store pickup" at checkout. Once the order is confirmed you get a notification and can collect it during working hours with your order code. Free of charge.' },
    { cat: 'returns', q: 'اگر کالا را دوست نداشتم می‌توانم برگردانم؟', qEn: 'Can I return an item I do not like?', a: 'بله. تا ۷ روز کاری پس از تحویل، بدون نیاز به ذکر دلیل و بدون جریمه می‌توانی انصراف بدهی (ماده‌ی ۳۷ قانون تجارت الکترونیکی). کالا باید نو، با بسته‌بندی اصلی و لوازم همراه باشد. هزینه‌ی بازگرداندن کالا بر عهده‌ی خریدار است و مبلغ پس از رسیدن کالا و بررسی، حداکثر تا ۴۸ ساعت کاری به کیف پول یا حساب بانکی‌ات برمی‌گردد.', aEn: 'Yes — within 7 working days, without reason or penalty, as long as the item is unused with original packaging. Return shipping is on the buyer; refunds are processed within 48 working hours after inspection.' },
    { cat: 'returns', q: 'کدام کالاها قابل بازگشت نیستند؟', qEn: 'Which items are not returnable?', a: 'سیم و کابل متراژی که به اندازه‌ی سفارش شما بریده شده، قطعات الکترونیکی حساس به الکتریسیته‌ی ساکن که از بسته‌بندی ضدالکتریسیته خارج شده‌اند، کالاهای نصب‌شده یا سیم‌کشی‌شده (مثل کلید و پریز و رله‌ی نصب‌شده در تابلو)، کالاهای ساخته‌شده بر اساس سفارش شخصی، و کالاهای دیجیتال. این موارد طبق بند «د» ماده‌ی ۳۸ و آیین‌نامه‌ی اجرایی آن از حق انصراف مستثنا هستند.', aEn: 'Wire and cable cut to your ordered length, static-sensitive components removed from anti-static packaging, installed or wired items (e.g. switches, sockets and relays already fitted in a panel), custom-made goods and digital goods are exempt per Article 38(d).' },
    { cat: 'product', q: 'از کجا بدانم این کلید، رله یا منبع تغذیه برای کار من مناسب است؟', qEn: 'How do I know a breaker, relay or power supply fits my job?', a: 'در مشخصات هر محصول، ولتاژ، جریان، توان، تعداد پل و سایز سیم مجاز را نوشته‌ایم. اگر مطمئن نیستی، در بخش سؤالات همان محصول بپرس یا با دکمه‌ی واتساپ صفحه‌ی محصول مشاوره‌ی فنی بگیر؛ رایگان راهنمایی‌ات می‌کنیم.', aEn: 'Each product page lists voltage, current, power, pole count and allowed wire gauge. If unsure, ask in the Q&A section or use the WhatsApp button for free technical advice.' },
    { cat: 'product', q: 'کالاها اصل هستند یا کپی؟', qEn: 'Are the products original?', a: 'در صفحه‌ی هر کالا وضعیت «اصل (اورجینال)»، «های‌کپی درجه یک» یا «متفرقه» شفاف نوشته شده است. ما کالای بی‌کیفیت را به‌عنوان اصل نمی‌فروشیم و اگر جایی اشتباه شد، هزینه‌ی کامل برگشت داده می‌شود.', aEn: 'Each product page clearly states Original, High-copy or Generic. We never pass off low-quality goods as original; mistakes are fully refunded.' },
    { cat: 'account', q: 'کیف پول چیست و چطور شارژش کنم؟', qEn: 'What is the wallet and how do I top it up?', a: 'کیف پول یک موجودی ریالی داخل حساب توست. می‌توانی آن را شارژ کنی و هنگام خرید از آن پرداخت کنی. مبلغ بازگشتی سفارش‌های لغوشده یا مرجوعی هم به کیف پول برمی‌گردد و در خریدهای بعدی قابل استفاده است. همه‌ی تراکنش‌ها در بخش «تراکنش‌های کیف پول» ثبت می‌شود.', aEn: 'Your wallet holds an in-site balance. Top it up, pay with it, and refunds land there automatically. All transactions are logged.' },
    { cat: 'account', q: 'اشتراک پلاس چه فایده‌ای دارد؟', qEn: 'What are the benefits of Plus?', a: 'با پرداخت ماهانه‌ی اشتراک پلاس، ارسال همه‌ی سفارش‌هایت رایگان می‌شود، مرسوله‌ها به‌صورت خودکار بیمه می‌شوند، ۳٪ تخفیف روی کالاها می‌گیری، ارسال فوری نیم‌بها می‌شود و تیکت‌هایت در اولویت پاسخ‌گویی قرار می‌گیرند.', aEn: 'Plus gives free shipping on all orders, automatic insurance, 3% off products, half-price express delivery and priority support.' },
    { cat: 'account', q: 'ورود دو مرحله‌ای چیست و چطور فعالش کنم؟', qEn: 'What is 2FA and how do I enable it?', a: 'ورود دو مرحله‌ی ای امنیت حساب را چند برابر می‌کند: علاوه بر رمز عبور، یک کد ۶ رقمی هم لازم است. سه روش داری: اپ احراز هویت (TOTP مثل Google Authenticator)، کد پیامکی و کد ایمیل. از مسیر «حساب کاربری ← امنیت ← ورود دومرحله‌ای» فعالش کن و کدهای پشتیبان را حتماً در جای امن نگه دار.', aEn: '2FA adds a 6-digit code on top of your password. Choose authenticator app (TOTP), SMS or email codes from Account → Security → Two-factor.' },
    { cat: 'account', q: 'رمز عبورم را فراموش کرده‌ام.', qEn: 'I forgot my password.', a: 'در صفحه‌ی ورود روی «بازیابی رمز عبور» بزن، شماره‌ی موبایل یا ایمیل ثبت‌شده را وارد کن تا کد بازیابی برایت ارسال شود. اگر به هیچ‌کدام دسترسی نداری، از طریق تیکت با احراز هویت دستی کمکت می‌کنیم.', aEn: 'Use "Forgot password" on the login page with your registered phone or email. If you have no access, open a ticket for manual verification.' },
    { cat: 'store', q: 'ساعت کاری و آدرس مغازه کجاست؟', qEn: 'Working hours and address?', a: 'تهران، میدان هفت‌حوض، بورس لوازم الکترونیک و الکتریک هفت‌حوض، همکف، پلاک ۱۲. شنبه تا چهارشنبه ۹ تا ۲۱، پنجشنبه ۹ تا ۲۲ و جمعه ۱۶ تا ۲۱. در بخش «تماس با ما» کروکی گرافیکی محل و لینک نقشه‌های مختلف (نشان، بلد، گوگل مپ و اوپن‌استریت‌مپ) قرار دارد.', aEn: 'Tehran, Narmak, Haft-Hoz sq., Haft-Hoz Electronics Bourse. Sat–Wed 9–21, Thu 9–22, Fri 16–21. The contact page has a hand-drawn map and links to several map providers.' },
    { cat: 'store', q: 'برای خرید عمده یا همکاری چه کنم؟', qEn: 'What about wholesale or partnership?', a: 'یک تیکت با موضوع «همکاری و تبلیغات» ثبت کن و حجم تقریبی و نوع کالا را بنویس. قیمت همکاری و شرایط پرداخت جداگانه اعلام می‌شود. اگر بنر یا تبلیغی برای کسب‌وکار خودت می‌خواهی روی سایت ما نمایش داده شود، از همین بخش درخواست بده.', aEn: 'Open a ticket with the Partnership subject describing volume and product type. Ad placements can be requested through the same channel.' },
    { cat: 'security', q: 'اطلاعاتم پیش شما امن است؟', qEn: 'Is my data safe with you?', a: 'بله. رمز عبور به‌صورت هش‌شده با الگوریتم scrypt ذخیره می‌شود و هیچ‌کس (حتی ما) متن رمز را نمی‌بیند. اطلاعات بانکی اصلاً روی سرور ما ذخیره نمی‌شود و پرداخت از طریق درگاه معتبر انجام می‌گیرد. دسترسی کارکنان به بخش‌های مختلف با ماتریس دسترسی محدود شده و همه‌ی تغییرات در گزارش رویدادها ثبت می‌شود. جزئیات کامل در صفحه‌ی «حریم خصوصی» آمده است.', aEn: 'Yes. Passwords are scrypt-hashed, card data never touches our servers, staff access is limited by a permission matrix and every change is audit-logged. Details are in the Privacy page.' },
  ],

  terms: {
    hero: { title: 'قوانین و مقررات', titleEn: 'Terms & Conditions', subtitle: 'آخرین به‌روزرسانی: شهریور ۱۴۰۵', subtitleEn: 'Last updated: September 2026' },
    intro: 'کاربر گرامی، ورود به وب‌سایت «یاسایی» و ثبت سفارش به منزله‌ی پذیرش کامل قوانین و مقررات زیر است. خواهشمندیم پیش از خرید این متن را با دقت بخوانید. این قوانین بر اساس قانون تجارت الکترونیکی (مصوب ۱۳۸۲)، قانون حمایت از حقوق مصرف‌کنندگان (مصوب ۱۳۸۸)، آیین‌نامه‌ی اجرایی آن‌ها و سایر مقررات جاری جمهوری اسلامی ایران تنظیم شده است.',
    introEn: 'By using Yassaei Electronics and placing an order you fully accept the terms below, drafted in line with Iran\'s E-Commerce Law (2004) and Consumer Protection Law (2009) and their executive bylaws.',
    sections: [
      {
        title: '۱. تعاریف', titleEn: '1. Definitions',
        body: '«فروشگاه» یعنی کسب‌وکار یاسایی به نشانی و شماره‌ی تماس درج‌شده در سایت. «کاربر» یعنی هر شخصی که از سایت بازدید می‌کند. «مشتری» یعنی کاربری که در سایت ثبت‌نام کرده و سفارش ثبت می‌کند. «سفارش» یعنی درخواست خرید یک یا چند کالا که در سامانه ثبت و به مشتری کد رهگیری داده می‌شود.',
        bodyEn: '"Store" means Yassaei Electronics. "User" means any visitor. "Customer" means a registered user who places an order. "Order" means a purchase request registered in the system with a tracking code.',
      },
      {
        title: '۲. شرایط استفاده از سایت', titleEn: '2. Conditions of use',
        list: [
          'کاربر متعهد است اطلاعات صحیح و متعلق به خود را در هنگام ثبت‌نام وارد کند و مسئولیت هرگونه اطلاعات نادرست بر عهده‌ی اوست.',
          'حفظ محرمانگی نام کاربری، رمز عبور و کدهای ورود دومرحله‌ای بر عهده‌ی کاربر است؛ هر عملیاتی که با حساب او انجام شود به منزله‌ی اقدام خود اوست.',
          'هرگونه استفاده‌ی تجاری، رباتیک، خزیدن (Scraping)، ارسال درخواست انبوه، بارگذاری بدافزار یا تلاش برای نفوذ به سامانه ممنوع است و طبق قانون جرایم رایانه‌ای (مصوب ۱۳۸۸) پیگیری قانونی خواهد شد.',
          'کاربر حق ندارد محتوای سایت (عکس، متن، لوگو) را بدون اجازه‌ی کتبی فروشگاه بازتولید یا بازنشر کند.',
          'ثبت نظر، سؤال یا امتیاز باید مطابق ادب و قانون باشد؛ نشر افترا، توهین، محتوای مجرمانه یا تبلیغاتی منجر به حذف مطلب و در صورت تکرار، مسدودسازی حساب می‌شود.',
          'سن حداقل برای ثبت‌نام و خرید ۱۸ سال تمام یا داشتن اجازه‌ی ولیّ قانونی است.',
        ],
        listEn: [
          'Users must provide accurate personal information and are responsible for incorrect data.',
          'Keeping credentials and 2FA codes confidential is the user\'s duty; actions performed under an account are attributed to its owner.',
          'Commercial reuse, bots, scraping, mass requests, malware uploads and intrusion attempts are prohibited and pursued under the Computer Crimes Law (2009).',
          'Site content may not be reproduced or republished without written permission.',
          'Reviews and questions must comply with law and etiquette; defamation or spam leads to removal and possible account suspension.',
          'Minimum age is 18 or with legal guardian consent.',
        ],
      },
      {
        title: '۳. ثبت، تأیید و لغو سفارش', titleEn: '3. Order registration, confirmation and cancellation',
        list: [
          'سفارش پس از ثبت، در وضعیت «در انتظار پرداخت» یا «در انتظار تأیید» قرار می‌گیرد و تنها پس از پرداخت موفق یا تأیید فروشگاه نهایی می‌شود.',
          'ثبت سفارش در سامانه به تنهایی به معنای قطعی شدن معامله نیست؛ تأیید نهایی با پیامک/اعلان «سفارش تأیید شد» انجام می‌شود.',
          'مشتری می‌تواند تا پیش از مرحله‌ی «ارسال شده»، سفارش را از بخش «سفارش‌های من» لغو کند. در سفارش‌های پرداخت‌شده، مبلغ طبق بند ۶ همین صفحه مسترد می‌شود.',
          'در صورت عدم پرداخت طی ۷۲ ساعت، سفارش به‌صورت خودکار لغو و کالاهای رزروشده آزاد می‌شوند.',
          'فروشگاه در مواردی مانند ثبت اشتباه قیمت، اتمام موجودی، بروز خطای سامانه، یا سفارش‌های با نشانه‌های تقلب حق دارد سفارش را لغو و وجه را عیناً مسترد کند. این موضوع مطابق ماده‌ی ۳۹ قانون تجارت الکترونیکی است که تأمین‌کننده را در صورت ناتوانی از اجرای تعهد به استرداد فوری مبلغ ملزم می‌کند.',
        ],
        listEn: [
          'Orders start as pending payment/confirmation and become final only after successful payment or store approval.',
          'Registration alone does not conclude the contract; final confirmation is sent as a notification.',
          'Customers may cancel before the "shipped" stage; paid amounts are refunded per section 6.',
          'Unpaid orders are auto-cancelled after 72 hours and reserved stock is released.',
          'The store may cancel orders in cases of pricing error, stock-out, system fault or fraud indicators, refunding the full amount immediately, in line with Article 39 of the E-Commerce Law.',
        ],
      },
      {
        title: '۴. قیمت‌گذاری و مالیات', titleEn: '4. Pricing and taxes',
        body: 'همه‌ی قیمت‌ها به تومان و شامل مالیات بر ارزش افزوده (در موارد مشمول) است. فروشگاه تلاش می‌کند قیمت‌ها به‌روز باشند، اما به‌دلیل نوسان نرخ ارز و تغییر قیمت تأمین‌کننده، امکان خطای قیمت وجود دارد. چنانچه پس از ثبت سفارش مشخص شود قیمت درج‌شده اشتباه بوده، فروشگاه قبل از ارسال موضوع را اطلاع می‌دهد و مشتری می‌تواند سفارش را با قیمت اصلاح‌شده تأیید یا آن را بدون هیچ هزینه‌ای لغو کند.',
        bodyEn: 'All prices are in Toman and include applicable VAT. Due to currency fluctuations, pricing errors are possible; if detected after ordering, the customer is notified before dispatch and may accept the corrected price or cancel free of charge.',
      },
      {
        title: '۵. موجودی کالا و ثبت سفارش هم‌زمان', titleEn: '5. Stock and simultaneous orders',
        body: 'موجودی هر کالا به‌صورت لحظه‌ای در سامانه کنترل می‌شود و در فرآیند ثبت سفارش، موجودی داخل یک تراکنش قفل‌شده بررسی و کسر می‌گردد تا فروش بیش از موجودی رخ ندهد. با این حال در شرایط استثنایی (قطعی شبکه، اختلال سرویس، فروش هم‌زمان حضوری و اینترنتی از یک قفسه‌ی فیزیکی، یا خطای انسانی در شمارش موجودی) ممکن است کالایی پس از ثبت سفارش ناموجود شود. در این حالت فروشگاه بلافاصله و حداکثر تا ۲۴ ساعت کاری موضوع را اطلاع می‌دهد و مشتری یکی از این گزینه‌ها را انتخاب می‌کند: (الف) جایگزینی کالای مشابه با توافق طرفین، (ب) انتظار تا تأمین مجدد، (پ) لغو سفارش و استرداد کامل وجه. بدیهی است در چنین موارد نادری، فروشگاه بابت تأخیر یا لغو ناخواسته پوزش می‌خواهد و هیچ خسارت اضافه‌ای از مشتری دریافت نمی‌شود.',
        bodyEn: 'Stock is decremented inside a locked transaction to prevent overselling. In exceptional cases (network failure, simultaneous in-store and online sale from one physical shelf, or human counting error) an item may become unavailable after ordering. The store notifies the customer within 24 working hours, who may accept a substitute, wait for restock, or cancel with a full refund. We apologize for such rare cases and never charge extra fees.',
      },
      {
        title: '۶. پرداخت و بازگشت وجه', titleEn: '6. Payment and refunds',
        list: [
          'روش‌های پرداخت: درگاه بانکی معتبر، کیف پول داخلی سایت، و پرداخت در محل (محدود به مناطق و سقف مبلغ تعیین‌شده).',
          'اطلاعات کارت بانکی هرگز در سرور فروشگاه ذخیره نمی‌شود و فرآیند پرداخت تماماً روی درگاه بانک انجام می‌گیرد.',
          'بازگشت وجه سفارش‌های لغو یا مرجوع‌شده حداکثر ظرف ۴۸ ساعت کاری از زمان تأیید فروشگاه، به همان روش پرداخت (کیف پول یا حساب بانکی) انجام می‌شود. بازگشت به کیف پول آنی است.',
          'در پرداخت در محل، چنانچه مشتری بدون دلیل موجه از تحویل کالا خودداری کند، هزینه‌ی ارسال رفت و برگشت از مبلغ دریافتی کسر یا مطالبه می‌شود.',
          'امتیاز و تخفیف‌های مصرف‌شده در سفارش مرجوعی، طبق قوانین باشگاه مشتریان بازگردانده می‌شود.',
        ],
        listEn: [
          'Payment methods: trusted bank gateway, internal wallet, and cash on delivery within set limits.',
          'Card data is never stored on our servers; payment happens entirely on the bank gateway.',
          'Refunds are processed within 48 working hours of approval to the original method; wallet refunds are instant.',
          'Refusing a COD delivery without valid reason results in round-trip shipping costs being charged.',
          'Points and discounts used in a refunded order are restored per loyalty rules.',
        ],
      },
      {
        title: '۷. حق انصراف (۷ روز کاری)', titleEn: '7. Right of withdrawal (7 working days)',
        body: 'مطابق ماده‌ی ۳۷ قانون تجارت الکترونیکی، مشتری حداقل هفت روز کاری فرصت دارد بدون تحمل جریمه و بدون ارائه‌ی دلیل از خرید منصرف شود. مبدأ محاسبه‌ی این مهلت، تاریخ تسلیم کالا به مشتری است (ماده‌ی ۳۸). برای اعمال حق انصراف، کالا باید بدون استفاده، سالم و همراه بسته‌بندی اصلی، برچسب، لوازم جانبی و فاکتور باشد. هزینه‌ی بازگرداندن کالا در استفاده از حق انصراف بر عهده‌ی مشتری است. به محض اعلام انصراف و وصول کالا، فروشگاه بدون مطالبه‌ی هیچ وجهی، عین مبلغ دریافتی را در اسرع وقت مسترد می‌کند.',
        bodyEn: 'Under Article 37 of the E-Commerce Law the customer has at least seven working days to withdraw without penalty or reason, counted from delivery (Article 38). The item must be unused, complete with original packaging, labels, accessories and invoice. Return shipping is on the customer. Upon receipt, the exact amount is refunded promptly.',
      },
      {
        title: '۸. استثنائات حق انصراف', titleEn: '8. Exceptions to withdrawal',
        body: 'طبق بند «د» ماده‌ی ۳۸ قانون تجارت الکترونیکی و آیین‌نامه‌ی اجرایی مصوب ۱۳۸۳/۱۰/۰۹ هیأت وزیران، در موارد زیر حق انصراف وجود ندارد: کالاهایی که به‌دلیل ماهیت بهداشتی پس از باز شدن پلمپ قابل بازگشت نیستند (قطعات الکترونیکی حساس خارج‌شده از بسته‌بندی ضدالکتریسیته‌ی ساکن)؛ سیم و کابل متراژی بریده‌شده به اندازه‌ی سفارش؛ کلید، پریز و رله‌ی نصب‌شده یا سیم‌کشی‌شده؛ کالاهای ساخته‌شده بر اساس سفارش شخصی مشتری (چاپ یا حکاکی اختصاصی)؛ کالاهای سریع‌الفساد یا مصرف روزانه؛ محتوای دیجیتال و نرم‌افزار پس از فعال‌سازی؛ و کالاهایی که پلمپ کارخانه‌ای آن‌ها شکسته شده و امکان فروش مجدد به‌عنوان کالای نو را ندارند.',
        bodyEn: 'Per Article 38(d) and its 2004 executive bylaw, withdrawal does not apply to: static-sensitive components removed from anti-static packaging, wire and cable cut to ordered length, installed or wired switches, sockets and relays, custom-made goods, perishables, activated digital content, and factory-sealed items whose seal is broken and cannot be resold as new.',
      },
      {
        title: '۹. گارانتی و خدمات پس از فروش', titleEn: '9. Warranty and after-sales',
        body: 'مطابق ماده‌ی ۳ قانون حمایت از حقوق مصرف‌کنندگان، فاکتور فروش شامل قیمت، تاریخ و مشخصات کالا به مشتری ارائه می‌شود و مدت و نوع ضمانت در صفحه‌ی محصول و فاکتور درج می‌گردد. گارانتی فروشگاه صرفاً شامل ایرادهای ناشی از ساخت است و مواردی مانند ضربه، شکستگی، آب‌خوردگی، نوسان برق، استفاده‌ی نادرست، باز شدن غیرمجاز دستگاه و فرسودگی طبیعی را پوشش نمی‌دهد. در کالاهای دارای گارانتی شرکتی، مشتری به نمایندگی رسمی معرفی می‌شود.',
        bodyEn: 'Per Article 3 of the Consumer Protection Law an invoice with price, date and specs is issued and warranty terms appear on the product page. Store warranty covers manufacturing defects only — not impact, liquid, power surge, misuse, unauthorized opening or normal wear. Corporate-warranty items are referred to official service centers.',
      },
      {
        title: '۱۰. ارسال، تحویل و بیمه‌ی مرسوله', titleEn: '10. Shipping, delivery and transit insurance',
        list: [
          'مسئولیت سلامت کالا تا لحظه‌ی تحویل به مشتری یا نماینده‌ی او بر عهده‌ی فروشگاه است.',
          'مشتری موظف است هنگام تحویل، بسته را از نظر سلامت ظاهری بررسی کند؛ در صورت آسیب فیزیکی، از تحویل گرفتن خودداری کرده و مراتب را همان لحظه به پیک و پشتیبانی اطلاع دهد.',
          'بیمه‌ی مرسوله اختیاری است و با پرداخت هزینه‌ی جداگانه (حداقل مبلغ تعیین‌شده یا درصدی از ارزش کالا) فعال می‌شود. در صورت مفقودی، سرقت یا آسیب مرسوله در مسیر، فروشگاه پیگیری لازم را با شرکت حمل‌ونقل/بیمه انجام می‌دهد و معادل ارزش بیمه‌شده به مشتری بازگردانده می‌شود.',
          'در سفارش‌های بیمه‌نشده، فروشگاه صرفاً تا سقف مسئولیت قانونی شرکت حمل‌ونقل پیگیری می‌کند و جبران کامل ارزش کالا تضمین نمی‌شود؛ بنابراین برای کالاهای گران‌قیمت، بیمه اکیداً توصیه می‌شود.',
          'در اعضای اشتراک پلاس، بیمه‌ی مرسوله به‌صورت خودکار و رایگان اعمال می‌شود.',
          'تأخیر ناشی از شرایط فورس ماژور (سیل، زلزله، تعطیلی سراسری، اختلال گسترده‌ی شبکه) خارج از تعهد فروشگاه است و مبلغ سفارش در صورت درخواست مشتری مسترد می‌شود.',
        ],
        listEn: [
          'The store is responsible for item integrity until delivery to the customer or their representative.',
          'Customers must inspect the package on delivery and refuse damaged parcels, reporting the issue immediately.',
          'Transit insurance is optional (a minimum fee or a percentage of value). In case of loss, theft or damage in transit, the store pursues the carrier/insurer and refunds the insured value.',
          'Without insurance, liability is limited to the carrier\'s statutory cap, so insuring valuable orders is strongly recommended.',
          'Plus members get automatic free insurance.',
          'Force-majeure delays are outside store liability; refunds are issued on request.',
        ],
      },
      {
        title: '۱۱. کیف پول، امتیاز و اشتراک پلاس', titleEn: '11. Wallet, points and Plus membership',
        body: 'موجودی کیف پول فاقد سود و کارمزد است و فقط برای خرید از همین فروشگاه کاربرد دارد؛ امکان تبدیل آن به پول نقد وجود ندارد، مگر در موارد بازگشت وجه سفارش. اشتراک پلاس یک خدمت زمان‌دار است که مزایای آن در صفحه‌ی «پلاس» اعلام می‌شود و پس از انقضا به‌صورت خودکار تمدید نمی‌شود مگر با پرداخت مجدد. در صورت تغییر یا حذف مزایا، موضوع از طریق اعلان به کاربران فعال اطلاع داده می‌شود و کاربر می‌تواند تا پایان دوره‌ی باقی‌مانده از مزایای خریداری‌شده استفاده کند.',
        bodyEn: 'Wallet balance bears no interest and cannot be cashed out except for order refunds. Plus is a time-bound service whose benefits are listed on its page; it does not auto-renew. Benefit changes are announced to active members, who keep purchased benefits until expiry.',
      },
      {
        title: '۱۲. مسئولیت فروشگاه و محدودیت خسارت', titleEn: '12. Store liability and limitation',
        body: 'فروشگاه تلاش می‌کند اطلاعات، قیمت‌ها و موجودی دقیق باشد، اما در قبال خسارات غیرمستقیم، از دست رفتن سود یا داده‌ی کاربر مسئولیتی ندارد. حداکثر مسئولیت فروشگاه در هر سفارش معادل مبلغ پرداخت‌شده‌ی همان سفارش است. در صورت بروز اختلال فنی در سایت، سفارش‌های ثبت‌شده محفوظ می‌مانند و پس از رفع اختلال پردازش می‌شوند.',
        bodyEn: 'We strive for accurate information but are not liable for indirect losses or lost profits. Maximum liability per order equals the amount paid for that order. Orders placed during technical outages are preserved and processed after recovery.',
      },
      {
        title: '۱۳. حریم خصوصی و داده‌های شخصی', titleEn: '13. Privacy and personal data',
        body: 'فروشگاه متعهد به حفاظت از اطلاعات شخصی کاربران است و جز در موارد قانونی یا با رضایت کاربر، آن‌ها را در اختیار اشخاص ثالث قرار نمی‌دهد. جزئیات کامل در صفحه‌ی «حریم خصوصی» آمده که بخشی جدایی‌ناپذیر از این قوانین است.',
        bodyEn: 'The store protects personal data and shares it only with legal authority or user consent. Full details are in the Privacy page, an integral part of these terms.',
      },
      {
        title: '۱۴. حل اختلاف و مرجع رسیدگی', titleEn: '14. Dispute resolution',
        body: 'در صورت بروز هرگونه اختلاف، اولویت با حل مسالمت‌آمیز از طریق پشتیبانی، تیکت و مذاکره است. در صورت عدم حصول نتیجه، مراجع ذی‌صلاح شامل اتحادیه‌ی صنفی مربوط، سازمان صنعت، معدن و تجارت استان، مرکز توسعه‌ی تجارت الکترونیکی و در نهایت دادسرای جرایم رایانه‌ای و محاکم قضایی شهرستان تهران صالح به رسیدگی هستند. قوانین حاکم بر این توافق‌نامه، قوانین جاری جمهوری اسلامی ایران است.',
        bodyEn: 'Disputes are first handled amicably through support and tickets. Failing that, the relevant trade union, the provincial Industry & Trade Organization, the E-Commerce Development Center, the Computer Crimes Prosecution Office and the courts of Tehran have jurisdiction. Iranian law governs.',
      },
      {
        title: '۱۵. تغییرات قوانین', titleEn: '15. Amendments',
        body: 'فروشگاه ممکن است این قوانین را به‌روزرسانی کند. نسخه‌ی معتبر، همواره همان متنی است که در این صفحه منتشر شده و تاریخ به‌روزرسانی آن درج شده است. ادامه‌ی استفاده از سایت پس از انتشار تغییرات، به منزله‌ی پذیرش آن‌هاست.',
        bodyEn: 'These terms may be updated; the current version on this page with its update date is authoritative. Continued use constitutes acceptance.',
      },
    ],
    notice: 'این متن بر اساس قوانین عمومی تجارت الکترونیکی و حمایت از مصرف‌کننده‌ی ایران تنظیم شده و جنبه‌ی اطلاع‌رسانی دارد. در صورت نیاز به تطبیق دقیق‌تر با مجوزهای صنفی، توصیه می‌شود توسط مشاور حقوقی بازبینی شود.',
    noticeEn: 'This text is based on Iranian e-commerce and consumer-protection law for informational purposes; a legal advisor review is recommended for exact compliance.',
  },

  privacy: {
    hero: { title: 'حریم خصوصی', titleEn: 'Privacy Policy', subtitle: 'داده‌های تو امانت ماست', subtitleEn: 'Your data is our trust' },
    intro: 'ما در یاسایی باور داریم اعتماد مشتری از هر دارایی‌ای ارزشمندتر است. این صفحه توضیح می‌دهد چه اطلاعاتی جمع‌آوری می‌شود، چرا، چگونه نگهداری می‌شود و تو چه حقوقی داری.',
    introEn: 'At Yassaei Electronics we believe customer trust is our most valuable asset. This page explains what we collect, why, how it is protected and what rights you have.',
    sections: [
      {
        title: 'چه اطلاعاتی جمع‌آوری می‌کنیم؟', titleEn: 'What we collect',
        list: [
          'اطلاعات هویتی: نام و نام خانوادگی، نام کاربری، شماره‌ی موبایل و ایمیل.',
          'اطلاعات ارسال: آدرس پستی، کد پستی و شماره‌ی تماس گیرنده.',
          'اطلاعات سفارش: اقلام خریداری‌شده، مبلغ، روش پرداخت و وضعیت تحویل.',
          'اطلاعات فنی: نشانی IP، نوع مرورگر و دستگاه، زمان بازدید و صفحات مشاهده‌شده (برای آمار و امنیت).',
          'محتوای ارسالی تو: نظرات، سؤالات، تیکت‌ها، گزارش خطا و فایل‌هایی که بارگذاری می‌کنی.',
        ],
        listEn: [
          'Identity: name, username, phone, email.',
          'Shipping: postal address, ZIP, recipient phone.',
          'Orders: items, amount, payment method, delivery status.',
          'Technical: IP, browser/device, timestamps, visited pages (analytics and security).',
          'Your content: reviews, questions, tickets, bug reports, uploaded files.',
        ],
      },
      {
        title: 'چرا این اطلاعات را می‌خواهیم؟', titleEn: 'Why we need it',
        list: [
          'پردازش و ارسال سفارش و صدور فاکتور رسمی.',
          'احراز هویت، ورود امن و ورود دومرحله‌ای.',
          'پاسخ به سؤالات، تیکت‌ها و پشتیبانی پس از فروش.',
          'اعلام موجود شدن کالای ناموجود و تغییر وضعیت سفارش.',
          'بهبود تجربه‌ی کاربری، شخصی‌سازی پیشنهادها و جلوگیری از تقلب.',
        ],
        listEn: [
          'Order processing, shipping and invoicing.',
          'Authentication, secure login and 2FA.',
          'Support, tickets and after-sales service.',
          'Back-in-stock and order-status notifications.',
          'UX improvement, personalization and fraud prevention.',
        ],
      },
      {
        title: 'چگونه از داده‌ها محافظت می‌کنیم؟', titleEn: 'How we protect data',
        list: [
          'رمز عبور با الگوریتم scrypt به‌همراه نمک اختصاصی هش می‌شود و به‌صورت متن ساده ذخیره نمی‌گردد.',
          'نشست‌ها با توکن تصادفی ۲۵۶ بیتی و کوکی HttpOnly با سیاست SameSite مدیریت می‌شوند.',
          'همه‌ی درخواست‌های تغییردهنده با توکن CSRF و محدودسازی نرخ (Rate Limit) محافظت می‌شوند.',
          'اطلاعات کارت بانکی هرگز در سرور ما ذخیره یا ثبت نمی‌شود.',
          'دسترسی کارکنان به داده‌ها بر اساس ماتریس دسترسی (Permission) محدود و همه‌ی اقدامات در گزارش رویدادها ثبت می‌شود.',
          'فایل‌های بارگذاری‌شده از نظر نوع و اندازه اعتبارسنجی و با نام تصادفی ذخیره می‌شوند.',
        ],
        listEn: [
          'Passwords are scrypt-hashed with a unique salt, never stored in plaintext.',
          'Sessions use 256-bit random tokens in HttpOnly cookies with SameSite.',
          'All mutating requests are CSRF-protected and rate-limited.',
          'Card data is never stored or logged.',
          'Staff access follows a permission matrix and every action is audit-logged.',
          'Uploads are type/size validated and stored under random names.',
        ],
      },
      {
        title: 'اشتراک‌گذاری با اشخاص ثالث', titleEn: 'Third-party sharing',
        body: 'اطلاعات تو تنها در حد ضرورت و برای اجرای تعهدات در اختیار اشخاص زیر قرار می‌گیرد: شرکت‌های حمل‌ونقل و پیک (نام، آدرس، شماره‌ی تماس)، درگاه‌های پرداخت بانکی (شماره‌ی سفارش و مبلغ)، و مراجع قانونی در صورت وجود حکم معتبر قضایی. ما اطلاعات کاربران را برای مقاصد تبلیغاتی به اشخاص ثالث نمی‌فروشیم.',
        bodyEn: 'Data is shared only as necessary: carriers (name, address, phone), payment gateways (order number and amount), and legal authorities upon valid order. We never sell user data for advertising.',
      },
      {
        title: 'کوکی‌ها و ذخیره‌سازی محلی', titleEn: 'Cookies and local storage',
        body: 'از کوکی برای نگهداری نشست ورود و توکن امنیتی CSRF استفاده می‌شود. ترجیحات ظاهری (حالت روشن/تاریک، زبان، چیدمان) در حافظه‌ی محلی مرورگر تو ذخیره می‌شود و به سرور ارسال نمی‌گردد. می‌توانی هر زمان کوکی‌ها را از تنظیمات مرورگر پاک کنی؛ در این صورت نیاز به ورود مجدد خواهی داشت.',
        bodyEn: 'Cookies hold your session and CSRF token. UI preferences (theme, language, layout) live in your browser local storage only. Clearing cookies signs you out.',
      },
      {
        title: 'حقوق تو', titleEn: 'Your rights',
        list: [
          'دسترسی: می‌توانی همه‌ی داده‌های ثبت‌شده‌ی خود را در پروفایل ببینی و خروجی بگیری.',
          'اصلاح: ویرایش مشخصات، آدرس‌ها و شماره‌ی تماس در هر زمان ممکن است.',
          'حذف: می‌توانی درخواست حذف حساب و داده‌های شخصی بدهی؛ داده‌های لازم برای نگهداریٔ اسناد مالی طبق قانون تا مدت مقرر نگه داشته می‌شوند.',
          'لغو اشتراک: دریافت اعلان‌های تبلیغاتی اختیاری است و با یک کلیک غیرفعال می‌شود.',
          'اعتراض: در صورت بروز هرگونه سوءاستفاده از داده‌ها، از بخش «گزارش خطا» یا تیکت اعلام کن تا بررسی و نتیجه اطلاع داده شود.',
        ],
        listEn: [
          'Access: view and export your stored data from your profile.',
          'Rectification: edit details and addresses anytime.',
          'Erasure: request account and data deletion; financial records are kept as legally required.',
          'Opt-out: marketing notifications are optional and one-click disable-able.',
          'Objection: report any misuse via Bug report or tickets.',
        ],
      },
      {
        title: 'نگهداری داده‌ها', titleEn: 'Data retention',
        body: 'داده‌های حساب تا زمانی که حساب فعال است نگه داشته می‌شود. سوابق سفارش و فاکتورها به‌دلایل مالیاتی و قانونی تا ۱۰ سال بایگانی می‌شوند. گزارش رویدادهای فنی پس از ۹۰ روز به‌صورت خودکار پاک‌سازی می‌شوند و کدهای یک‌بارمصرف پس از مصرف یا انقضا بی‌اثر می‌گردند.',
        bodyEn: 'Account data is kept while the account is active. Invoices are archived up to 10 years for legal reasons. Technical audit logs are pruned after 90 days and OTPs expire after use.',
      },
      {
        title: 'حفاظت از کودکان', titleEn: 'Children',
        body: 'خدمات ما برای افراد زیر ۱۸ سال بدون نظارت ولیّ قانونی در نظر گرفته نشده و ما آگاهانه داده‌ی کودکان را جمع‌آوری نمی‌کنیم.',
        bodyEn: 'Our services are not intended for minors without guardian supervision; we do not knowingly collect children\'s data.',
      },
      {
        title: 'تماس درباره‌ی حریم خصوصی', titleEn: 'Privacy contact',
        body: 'برای هر سؤال یا درخواست مرتبط با حریم خصوصی، از بخش «تماس با ما»، تیکت یا ایمیل پشتیبانی با ما در ارتباط باش. درخواست‌ها حداکثر ظرف ۷ روز کاری بررسی و پاسخ داده می‌شوند.',
        bodyEn: 'For privacy questions or requests, contact us via the contact page, tickets or support email. Requests are answered within 7 working days.',
      },
    ],
  },

  insurance: {
    hero: { title: 'بیمه‌ی مرسوله', titleEn: 'Shipment insurance', subtitle: 'خیالت از مسیر راحت باشد', subtitleEn: 'Peace of mind in transit' },
    body: 'حمل کالای الکترونیکی همیشه با اندکی ریسک همراه است. به همین دلیل امکان «بیمه‌ی مرسوله» را در مرحله‌ی پرداخت اضافه کرده‌ایم تا در صورت آسیب دیدن، مفقود شدن یا سرقت بسته در مسیر، ارزش کالای تو جبران شود.',
    bodyEn: 'Shipping electronics always carries some risk, so we offer shipment insurance at checkout to cover damage, loss or theft in transit.',
    rules: [
      'هزینه‌ی بیمه بر اساس ارزش کالای سفارش محاسبه می‌شود: درصدی از مبلغ کالا با حداقل مبلغ ثابت. نرخ دقیق در صفحه‌ی پرداخت شفاف نمایش داده می‌شود.',
      'بیمه فقط برای سفارش‌های ارسال با پیک/پست فعال است و برای تحویل حضوری کاربرد ندارد.',
      'پوشش بیمه از لحظه‌ی تحویل بسته به شرکت حمل‌ونقل تا لحظه‌ی تحویل به مشتری (یا نماینده‌ی او) اعتبار دارد.',
      'سقف جبران خسارت، معادل ارزش بیمه‌شده‌ی کالا (تا سقف ارزش واقعی سفارش) است و شامل هزینه‌ی ارسال نمی‌شود مگر آنکه بیمه‌ی کامل انتخاب شده باشد.',
      'آسیب‌های ناشی از بسته‌بندی نامناسب توسط مشتری در مرجوعی، استفاده‌ی نادرست پس از تحویل، و موارد فورس ماژور مانند جنگ و بلایای طبیعی گسترده تحت پوشش نیست.',
      'مشتری موظف است بسته را در حضور پیک بررسی کند و در صورت مشاهده‌ی آسیب، صورت‌جلسه‌ی تحویل را امضا نکند و بلافاصله به پشتیبانی اطلاع دهد. اعلام خسارت بیش از ۴۸ ساعت پس از تحویل قابل پذیرش نیست.',
      'پس از تأیید خسارت، معادل مبلغ بیمه‌شده حداکثر ظرف ۵ روز کاری به کیف پول یا حساب مشتری بازگردانده می‌شود و پیگیری با شرکت حمل‌ونقل بر عهده‌ی فروشگاه است.',
      'برای اعضای اشتراک پلاس، بیمه‌ی مرسوله به‌صورت خودکار و رایگان روی همه‌ی سفارش‌ها اعمال می‌شود.',
    ],
    rulesEn: [
      'The fee is a percentage of the goods value with a minimum flat fee, shown transparently at checkout.',
      'Insurance applies to courier/postal orders only, not in-store pickup.',
      'Coverage runs from handing the parcel to the carrier until delivery to the customer.',
      'Compensation is capped at the insured value of the goods.',
      'Damage from customer packaging on returns, misuse after delivery, and major force-majeure events are excluded.',
      'Inspect the parcel in the courier\'s presence; do not sign a damaged delivery and report within 48 hours.',
      'Approved claims are refunded within 5 working days; carrier follow-up is on us.',
      'Plus members get automatic free insurance on every order.',
    ],
  },

  ticketRules: {
    hero: { title: 'قوانین تیکت و پشتیبانی', titleEn: 'Ticket rules', subtitle: 'برای پاسخ سریع‌تر، این نکات را رعایت کن', subtitleEn: 'For faster answers, follow these points' },
    rules: [
      'هر تیکت باید یک موضوع مشخص داشته باشد؛ چند درخواست متفاوت را در تیکت‌های جداگانه ثبت کن.',
      'شماره‌ی سفارش، نام کالا و زمان وقوع مشکل را دقیق بنویس تا بررسی سریع‌تر انجام شود.',
      'از ارسال متن توهین‌آمیز، تهمت یا محتوای غیرقانونی خودداری کن؛ چنین تیکت‌هایی بسته می‌شوند.',
      'ارسال فایل مخرب، لینک‌های مشکوک یا درخواست دسترسی به حساب دیگران ممنوع است.',
      'تیکت‌ها بر اساس اولویت (بحرانی، زیاد، معمولی، کم) در صف قرار می‌گیرند. زمان پاسخ‌گویی: بحرانی تا ۲ ساعت، زیاد تا ۶ ساعت، معمولی تا ۲۴ ساعت و کم تا ۴۸ ساعت (در ساعات کاری).',
      'اعضای پلاس در صف اولویت پاسخ‌گویی قرار می‌گیرند.',
      'تیکت‌های بی‌پاسخ از سوی کاربر پس از ۷ روز به‌صورت خودکار بسته می‌شوند و امکان بازکردن مجدد تا ۳۰ روز وجود دارد.',
      'درخواست‌های تبلیغ و همکاری از مسیر تیکت با موضوع «همکاری و تبلیغات» بررسی می‌شوند.',
      'محتوای تیکت‌ها محرمانه است و فقط در اختیار کارکنان دارای دسترسی پشتیبانی قرار می‌گیرد.',
    ],
    rulesEn: [
      'One topic per ticket.',
      'Include order number, product name and time of the issue.',
      'No insults, defamation or illegal content; such tickets are closed.',
      'No malicious files, suspicious links or access requests for other accounts.',
      'Priority-based SLA: critical 2h, high 6h, normal 24h, low 48h during working hours.',
      'Plus members get priority queueing.',
      'Unanswered tickets auto-close after 7 days and can be reopened within 30 days.',
      'Advertising and partnership requests use the Partnership subject.',
      'Ticket content is confidential and visible only to authorized staff.',
    ],
  },

  bugReport: {
    hero: { title: 'گزارش خطا و باگ', titleEn: 'Bug report', subtitle: 'اگر جایی از سایت درست کار نکرد، به ما بگو', subtitleEn: 'If something is broken, tell us' },
    body: 'هیچ سایتی بی‌نقص نیست. اگر قیمت اشتباه، خطای صفحه، مشکل ورود، باگ موبایل یا هر مشکل دیگری دیدی، از این فرم گزارش بده. گزارش‌های دقیق و قابل تکرار، با اولویت بالا بررسی می‌شوند و در صورت صحت، نتیجه به اطلاع تو می‌رسد.',
    bodyEn: 'No site is perfect. If you see a wrong price, a broken page, a login issue or any other bug, report it here. Precise reproducible reports get high priority and you will be informed of the outcome.',
    hints: [
      'دقیقاً چه کاری انجام می‌دادی؟ (مثلاً: افزودن کلید مینیاتوری ۲۵ آمپر به سبد)',
      'چه چیزی انتظار داشتی و چه چیزی دیدی؟',
      'با چه دستگاه و مرورگری؟ (اندروید/آیفون/ویندوز، کروم/سافاری)',
      'اگر پیام خطایی روی صفحه آمد، متن کامل آن را بنویس.',
      'در صورت امکان عکس از صفحه اضافه کن.',
    ],
    hintsEn: [
      'What exactly were you doing?',
      'What did you expect versus what happened?',
      'Which device and browser?',
      'Include the full error message if any.',
      'Attach a screenshot if possible.',
    ],
  },

  contact: {
    hero: { title: 'تماس با ما', titleEn: 'Contact us', subtitle: 'نارمک، میدان هفت‌حوض، بورس لوازم الکترونیک و الکتریک هفت‌حوض', subtitleEn: 'By the dock, Haft-Hoz Electronics Bourse' },
  },
};

export const ORDER_STATUSES = [
  { id: 'pending_payment', fa: 'در انتظار پرداخت', en: 'Pending payment', color: '#f0a500' },
  { id: 'pending_review', fa: 'در انتظار بررسی', en: 'Pending review', color: '#5b8def' },
  { id: 'confirmed', fa: 'تأیید شده', en: 'Confirmed', color: '#f59e0b' },
  { id: 'preparing', fa: 'در حال آماده‌سازی', en: 'Preparing', color: '#8b5cf6' },
  { id: 'ready_pickup', fa: 'آماده‌ی تحویل حضوری', en: 'Ready for pickup', color: '#14b8a6' },
  { id: 'shipped', fa: 'ارسال شده', en: 'Shipped', color: '#f97316' },
  { id: 'delivered', fa: 'تحویل شده', en: 'Delivered', color: '#22c55e' },
  { id: 'cancelled', fa: 'لغو شده', en: 'Cancelled', color: '#ef4444' },
  { id: 'refunded', fa: 'بازگشت وجه شده', en: 'Refunded', color: '#94a3b8' },
  { id: 'returned', fa: 'مرجوع شده', en: 'Returned', color: '#a855f7' },
];

// ── قاعده‌های اجبار احراز هویت هنگام ثبت سفارش ──────────────
// این فهرست هم در سرور (اعتبارسنجی تنظیمات) و هم در پنل مدیریت
// (ساخت فهرست کشویی) استفاده می‌شود.
export const KYC_CONDITIONS = [
  { id: 'disabled', fa: 'غیرفعال (بدون اجبار)', en: 'Disabled (no requirement)' },
  { id: 'all', fa: 'اجباری برای تمام سفارش‌ها', en: 'Required for all orders' },
  { id: 'amount', fa: 'اجباری برای سفارش‌های بالای مبلغ مشخص', en: 'Required above a set amount' },
  { id: 'installments', fa: 'اجباری فقط برای پرداخت اقساطی', en: 'Installment payments only' },
  { id: 'first_order', fa: 'اجباری فقط برای اولین خرید کاربر', en: 'First order only' },
];

export const TICKET_CATEGORIES = [
  { id: 'order', fa: 'پیگیری سفارش', en: 'Order tracking' },
  { id: 'return', fa: 'مرجوعی و بازگشت وجه', en: 'Return & refund' },
  { id: 'product', fa: 'سؤال درباره‌ی کالا', en: 'Product question' },
  { id: 'technical', fa: 'مشکل فنی سایت', en: 'Technical issue' },
  { id: 'complaint', fa: 'شکایت', en: 'Complaint' },
  { id: 'partnership', fa: 'همکاری و تبلیغات', en: 'Partnership & advertising' },
  { id: 'account', fa: 'حساب کاربری و امنیت', en: 'Account & security' },
  { id: 'other', fa: 'سایر موارد', en: 'Other' },
];

export const TICKET_PRIORITIES = [
  { id: 'critical', fa: 'بحرانی', en: 'Critical', slaHours: 2 },
  { id: 'high', fa: 'زیاد', en: 'High', slaHours: 6 },
  { id: 'normal', fa: 'معمولی', en: 'Normal', slaHours: 24 },
  { id: 'low', fa: 'کم', en: 'Low', slaHours: 48 },
];
