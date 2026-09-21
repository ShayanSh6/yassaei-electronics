// ─────────────────────────────────────────────────────────────
//  تنظیمات فروشگاه: اطلاعات، پوسته، چیدمان رابط، امکانات، ارسال،
//  پلاس، سفارش/پرداخت، سئو، ارز، احراز هویت و پشتیبانی
//  فرم‌ها از روی ساختار تنظیمات ساخته می‌شوند (schema-driven)
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, esc, applyDyn, fmtNum, fmtDate } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { can, refreshBootstrap, applyPrefs, previewAccent, clearAccentPreview } from '../../state.mjs';
import { field, textareaField, selectField, switchField } from '../../components.mjs';
import { NAV_GROUP_IDS, NAV_GROUPS, NAV_ICON_NAMES, navAdminRows } from '../../lib/nav.mjs';
import { toastSuccess, toastError, toastApiError, withBusy, errorState, emptyState, confirmDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);

// ── تعریف فیلدها ────────────────────────────────────────────
const FIELDS = {
  products: [
    { k: 'lowStockTelegramAlertEnabled', label: () => L('هشدار کسری موجودی در تلگرام', 'Low-stock Telegram alerts'), type: 'bool', def: false, hint: () => L('نیازمند ربات فعال تلگرام است. با عبور موجودی از آستانه، پیام به مشترکان ربات ارسال می‌شود.', 'Requires an enabled Telegram bot. Alerts are broadcast to bot subscribers when stock crosses below the threshold.') },
    { k: 'lowStockTelegramAlertThreshold', label: () => L('آستانهٔ موجودی (کمتر از این تعداد)', 'Stock threshold (strictly below)'), type: 'number', min: 1, max: 100000, def: 3 },
  ],
  oldPrice: [
    { k: 'badgeText', label: () => t('adm.oldPriceBadgeText'), type: 'text' },
    { k: 'badgeTextEn', label: () => t('adm.oldPriceBadgeTextEn'), type: 'text' },
  ],
  mailsms: [
    { k: 'mail', label: () => t('adm.mailCfg'), type: 'group', fields: [
      { k: 'enabled', label: () => t('adm.mailEnabled'), type: 'bool' },
      { k: 'host', label: () => 'SMTP host', type: 'text' },
      { k: 'port', label: () => 'SMTP port', type: 'number', min: 1, max: 65535 },
      { k: 'user', label: () => t('common.username'), type: 'text' },
      { k: 'pass', label: () => t('common.password'), type: 'text' },
      { k: 'from', label: () => t('adm.mailFrom'), type: 'text' },
    ] },
    { k: 'sms', label: () => t('adm.smsCfg'), type: 'group', fields: [
      { k: 'enabled', label: () => t('adm.smsEnabled'), type: 'bool' },
      { k: 'apiKey', label: () => t('adm.smsKey'), type: 'text' },
      { k: 'sender', label: () => t('adm.smsSender'), type: 'text' },
    ] },
    { k: 'telegram', label: () => L('ربات و کانال تلگرام یاسایی', 'Telegram Bot & Channel'), type: 'group', fields: [
      { k: 'enabled', label: () => L('فعال‌سازی ربات تلگرام', 'Enable Telegram Bot'), type: 'bool' },
      { k: 'token', label: () => L('توکن ربات تلگرام (Bot Token)', 'Bot Token'), type: 'text' },
      { k: 'channel', label: () => L('آیدی کانال تلگرام برای انتشار کالا (@yassaei_shop)', 'Telegram Channel (@username)'), type: 'text' },
      { k: 'adminChats', label: () => L('شناسه چت تلگرام مدیران برای دریافت سفارش و تیکت', 'Admin Chat IDs'), type: 'text' },
    ] },
    { k: 'instagram', label: () => L('انتشار اینستاگرام یاسایی', 'Instagram Publishing'), type: 'group', fields: [
      { k: 'enabled', label: () => L('فعال‌سازی صف انتشار اینستاگرام', 'Enable Instagram Publishing'), type: 'bool' },
      { k: 'token', label: () => L('توکن صفحه اینستاگرام (Graph API Token)', 'Instagram Graph API Token'), type: 'text' },
      { k: 'accountId', label: () => L('شناسه تجاری اینستاگرام (Account ID)', 'Instagram Business Account ID'), type: 'text' },
    ] },
  ],
  store: [
    { k: 'name', label: () => L('نام فروشگاه', 'Store name'), type: 'text' },
    { k: 'nameEn', label: () => L('نام (انگلیسی)', 'Name (EN)'), type: 'text' },
    { k: 'logo', label: () => L('لوگوی سربرگ (آدرس تصویر)', 'Header logo (image URL)'), type: 'text', hint: () => L('مسیر تصویر مثل /uploads/… یا آدرس کامل http(s)؛ خالی = نشان پیش‌فرض SVG', 'Image path like /uploads/… or full http(s) URL; empty = default SVG mark') },
    { k: 'footerLogo', label: () => L('لوگوی پانویس (آدرس تصویر)', 'Footer logo (image URL)'), type: 'text', hint: () => L('خالی = نشان پیش‌فرض یاسایی در پانویس', 'Empty = default Yassaei badge in the footer') },
    { k: 'tagline', label: () => L('شعار', 'Tagline'), type: 'text' },
    { k: 'taglineEn', label: () => L('شعار (انگلیسی)', 'Tagline (EN)'), type: 'text' },
    { k: 'tabTitle', label: () => L('عنوان تب مرورگر', 'Browser tab title'), type: 'text', hint: () => L('متنی که بالای تب مرورگر دیده می‌شود؛ خالی = نام فروشگاه', 'Text shown in the browser tab; empty = store name') },
    { k: 'faviconUrl', label: () => L('آیکون تب مرورگر (آدرس تصویر)', 'Browser tab icon (image URL)'), type: 'text', hint: () => L('مسیر تصویر مثل /uploads/… یا آدرس کامل http(s)؛ خالی = آیکون پیش‌فرض یاسایی', 'Image path like /uploads/… or full http(s) URL; empty = default Yassaei icon') },
    { k: 'phone', label: () => t('contact.phone'), type: 'text' },
    { k: 'phone2', label: () => t('contact.mobile'), type: 'text' },
    { k: 'phone3', label: () => L('شمارهٔ سوم (اختیاری)', 'Third phone (optional)'), type: 'text' },
    { k: 'whatsapp', label: () => t('contact.whatsapp'), type: 'text' },
    { k: 'email', label: () => t('common.email'), type: 'text' },
    { k: 'city', label: () => t('common.city'), type: 'text' },
    { k: 'cityEn', label: () => L('شهر (انگلیسی)', 'City (EN)'), type: 'text' },
    { k: 'address', label: () => t('common.address'), type: 'textarea' },
    { k: 'addressEn', label: () => L('آدرس (انگلیسی)', 'Address (EN)'), type: 'textarea' },
    { k: 'description', label: () => t('common.description'), type: 'textarea' },
    { k: 'descriptionEn', label: () => L('توضیحات (انگلیسی)', 'Description (EN)'), type: 'textarea' },
    { k: 'enamad', label: () => L('کد نماد اعتماد', 'Trust symbol code'), type: 'text' },
    { k: 'established', label: () => L('سال تأسیس (شمسی)', 'Founded year (Solar)'), type: 'number', min: 1300, max: 1500 },
    { k: 'mapCoords', label: () => L('مختصات نقشه', 'Map coordinates'), type: 'coords' },
    { k: 'socials', label: () => L('شبکه‌های اجتماعی', 'Social links'), type: 'kv', keys: ['instagram', 'telegram', 'eitaa', 'whatsapp', 'website'] },
    { k: 'workingHours', label: () => t('footer.workingHours'), type: 'rows', cols: [
      { k: 'fa', label: () => L('روز', 'Day (FA)') }, { k: 'en', label: () => L('Day (EN)', 'Day (EN)') },
      { k: 'time', label: () => L('ساعت', 'Hours (FA)') }, { k: 'timeEn', label: () => L('Hours (EN)', 'Hours (EN)') },
    ] },
  ],
  theme: [
    { k: 'theme', label: () => L('قالب ظاهری (تم)', 'Design Theme'), type: 'select', options: () => [
      ['default', L('پیش‌فرض (یاسایی/فروشگاه)', 'Default')],
      ['tehran-nights', L('شب‌های تهران', 'Tehran Nights')],
      ['milad', L('برج میلاد', 'Milad Tower')],
      ['azadi', L('میدان آزادی', 'Azadi Square')],
      ['lalehzar', L('لاله‌زار', 'Lalehzar')],
      ['tochal', L('توچال', 'Tochal')],
      ['valiasr', L('ولیعصر', 'Valiasr')],
      ['bazaar', L('بازار بزرگ', 'Grand Bazaar')],
      ['chitgar', L('چیتگر', 'Chitgar')],
      ['tajrish', L('تجریش', 'Tajrish')],
      ['darband', L('دربند', 'Darband')],
      ['logo', L('لوگو یاسایی (آبی الکتریک و صاعقه)', 'Yassaei Logo (Electric blue & lightning)')]
    ] },
    { k: 'accent', label: () => t('adm.tAccent'), type: 'color' },
    { k: 'accent2', label: () => L('رنگ دوم (مکمل رنگ اصلی)', 'Secondary colour (accent 2)'), type: 'color', def: '#1e8ae8', hint: () => L('در گرادیان‌ها، نوار بالا و لوگو به کار می‌رود؛ خالی = خودکار از رنگ اصلی', 'Used in gradients, topbar and logo; empty = derived from accent') },
    { k: 'bgColor', label: () => L('رنگ پس‌زمینهٔ سایت', 'Background colour'), type: 'color', def: '#0b0a08', hint: () => L('رنگ پایهٔ پس‌زمینه در حالت تاریک؛ خالی = رنگ قالب فعلی', 'Base page background in dark mode; empty = current theme colour') },
    { k: 'mode', label: () => t('adm.tMode'), type: 'select', options: () => [['dark', t('theme.dark')], ['light', t('theme.light')]] },
    { k: 'bgStyle', label: () => t('adm.tBg'), type: 'select', options: () => [['waves', L('موج و تهران', 'Waves & port')], ['grid', L('شبکه‌ای', 'Grid')], ['plain', L('ساده', 'Plain')]] },
    { k: 'density', label: () => t('adm.tDensity'), type: 'select', options: () => [['compact', 'Compact'], ['normal', 'Normal'], ['comfy', 'Comfy']] },
    { k: 'contrast', label: () => t('adm.tContrast'), type: 'select', options: () => [['normal', 'Normal'], ['high', 'High']] },
    { k: 'radius', label: () => t('adm.tRadius'), type: 'number', min: 0, max: 32 },
    { k: 'portTheme', label: () => t('adm.tPort'), type: 'bool', hint: () => t('adm.tPortHint') },
    { k: 'animations', label: () => t('adm.tAnim'), type: 'bool' },
    { k: 'rotateDesigns', label: () => t('adm.tRotate'), type: 'bool', hint: () => t('adm.tRotateHint') },
    { k: 'designPool', label: () => t('adm.tPool'), type: 'multi', options: () => [
      ['default', L('پیش‌فرض (یاسایی/فروشگاه)', 'Default')],
      ['tehran-nights', L('شب‌های تهران', 'Tehran Nights')],
      ['milad', L('برج میلاد', 'Milad Tower')],
      ['azadi', L('میدان آزادی', 'Azadi Square')],
      ['lalehzar', L('لاله‌زار', 'Lalehzar')],
      ['tochal', L('توچال', 'Tochal')],
      ['valiasr', L('ولیعصر', 'Valiasr')],
      ['bazaar', L('بازار بزرگ', 'Grand Bazaar')],
      ['chitgar', L('چیتگر', 'Chitgar')],
      ['tajrish', L('تجریش', 'Tajrish')],
      ['darband', L('دربند', 'Darband')],
      ['logo', L('لوگو یاسایی (آبی الکتریک و صاعقه)', 'Yassaei Logo (Electric blue & lightning)')]
    ] },
  ],
  ui: [
    { k: 'searchPosition', label: () => t('adm.uSearchPos'), type: 'select', options: () => [['start', t('adm.uPosStart')], ['center', t('adm.uPosCenter')], ['end', t('adm.uPosEnd')]] },
    { k: 'headerLayout', label: () => t('adm.uHeader'), type: 'select', options: () => [['logoStart', t('adm.uLayoutLogoStart')], ['split', t('adm.uLayoutSplit')], ['centered', t('adm.uLayoutCentered')]] },
    { k: 'navStyle', label: () => t('adm.uNav'), type: 'select', options: () => [['pills', 'Pills'], ['underline', 'Underline']] },
    { k: 'cardStyle', label: () => t('adm.uCards'), type: 'select', options: () => [['grid', t('catalog.viewGrid')], ['list', t('catalog.viewList')]] },
    { k: 'stickyHeader', label: () => t('adm.uSticky'), type: 'bool' },
    { k: 'showTicker', label: () => t('adm.uTicker'), type: 'bool' },
    { k: 'tickerSpeed', label: () => t('adm.uTickerSpeed'), type: 'number', min: 10, max: 90 },
    { k: 'quickView', label: () => t('adm.uQuick'), type: 'bool' },
    { k: 'floatingChat', label: () => t('adm.uChat'), type: 'bool' },
    { k: 'showBreadcrumbs', label: () => t('adm.uCrumb'), type: 'bool' },
    { k: 'columns', label: () => t('adm.uCols'), type: 'kvnum', keys: ['mobile', 'tablet', 'desktop', 'wide'], min: 1, max: 8 },
    { k: 'productCardInfo', label: () => t('adm.uCardInfo'), type: 'multi', options: () => [['brand', t('common.brand')], ['stock', t('common.stock')], ['rating', t('common.rating')], ['warranty', t('pdp.warranty')], ['sold', t('pdp.sold')]] },
    { k: 'tickerItems', label: () => t('adm.uTickerItems'), type: 'rows', cols: [
      { k: 'text', label: () => L('متن', 'Text') }, { k: 'textEn', label: () => L('متن (انگلیسی)', 'Text (EN)') }, { k: 'link', label: () => L('لینک', 'Link') },
    ] },
  ],
  shipping: [
    { k: 'pickupEnabled', label: () => t('checkout.pickup'), type: 'bool' },
    { k: 'courierEnabled', label: () => t('checkout.courier'), type: 'bool' },
    { k: 'courierBase', label: () => L('هزینهٔ پایهٔ ارسال', 'Base shipping fee'), type: 'number', min: 0, max: 10000000 },
    { k: 'freeOver', label: () => L('ارسال رایگان از مبلغ', 'Free shipping over'), type: 'number', min: 0, max: 100000000 },
    { k: 'handlingHours', label: () => L('زمان آماده‌سازی (ساعت)', 'Handling hours'), type: 'number', min: 1, max: 720 },
    { k: 'expressEnabled', label: () => t('checkout.express'), type: 'bool' },
    { k: 'expressFee', label: () => L('هزینهٔ ارسال فوری', 'Express fee'), type: 'number', min: 0, max: 10000000 },
    { k: 'insuranceRatePct', label: () => L('نرخ بیمه (درصد)', 'Insurance rate (%)'), type: 'number', min: 0, max: 20, step: 0.1 },
    { k: 'insuranceMin', label: () => L('حداقل هزینهٔ بیمه', 'Insurance minimum'), type: 'number', min: 0, max: 10000000 },
    { k: 'zones', label: () => t('checkout.zone'), type: 'rows', cols: [
      { k: 'id', label: () => L('شناسه', 'ID'), type: 'select', options: () => [['city', L('داخل شهر', 'City')], ['province', L('استان', 'Province')], ['country', L('کشور', 'Country')], ['island', L('جزایر', 'Islands')]] },
      { k: 'name', label: () => L('نام', 'Name') }, { k: 'nameEn', label: () => L('نام (انگلیسی)', 'Name (EN)') },
      { k: 'fee', label: () => L('هزینه', 'Fee'), type: 'number' }, { k: 'eta', label: () => L('زمان تحویل', 'ETA') },
    ] },
  ],
  // ── ابزارهای فروش: هر قابلیت یک کلید اصلی روشن/خاموش دارد؛ خاموش = حذف فوری از سایت مشتری ──
  salesTools: [
    { k: 'stickyBuyBarEnabled', label: () => L('نوار خرید چسبان موبایل (صفحهٔ محصول)', 'Mobile sticky buy bar (product page)'), type: 'bool',
      hint: () => L('در موبایل، بعد از رد شدن از جعبهٔ خرید، نواری با عکس، نام، قیمت و دکمهٔ «افزودن به سبد» پایین صفحه می‌آید.', 'On mobile, after scrolling past the buy box, a bar with thumbnail, title, price and “Add to cart” slides in at the bottom.') },
    { k: 'whatsappConsultEnabled', label: () => L('دکمهٔ «مشاورهٔ فنی در واتساپ» (صفحهٔ محصول)', 'WhatsApp technical-advice button (product page)'), type: 'bool',
      hint: () => L('کنار دکمهٔ تماس با فروشگاه؛ متن پیام با نام و کد محصول از قبل پر می‌شود.', 'Next to the call button; the message is prefilled with the product name and code.') },
    { k: 'whatsappPhone', label: () => L('شمارهٔ واتساپ اختصاصی (اختیاری)', 'Dedicated WhatsApp number (optional)'), type: 'text',
      hint: () => L('مثلاً 09121234567 یا 989121234567. خالی = واتساپ / موبایل / تلفن فروشگاه از تب «فروشگاه».', 'e.g. 09121234567 or 989121234567. Empty = store WhatsApp / mobile / phone from the “Store” tab.') },
    { k: 'wholesaleInquiryEnabled', label: () => L('دکمهٔ «استعلام قیمت همکاری و خرید عمده» (صفحهٔ محصول)', '“Wholesale & contractor price inquiry” button (product page)'), type: 'bool',
      hint: () => L('برای برق‌کاران و پیمانکاران؛ مودال سریع با جزئیات محصول از پیش پر می‌شود و درخواست به‌صورت تیکت «همکاری» به تیم فروش می‌رسد.', 'For electricians and contractors; a quick modal prefilled with product details that reaches the sales team as a “partnership” ticket.') },
    { k: 'productWarrantyBadgeEnabled', label: () => L('نشان «⚡ ضمانت اصالت و سلامت فیزیکی قطعات الکتریکی یاسایی» (صفحهٔ محصول)', '“⚡ Yassaei authenticity & physical-integrity warranty” badge (product page)'), type: 'bool',
      hint: () => L('نشان اعتماد زیر عنوان محصول نمایش داده می‌شود.', 'A trust badge shown under the product title.') },
    { k: 'productWarrantyMonths', label: () => L('مدت گارانتی روی نشان (ماه)', 'Badge warranty duration (months)'), type: 'number', min: 0, max: 120,
      hint: () => L('پیش‌فرض ۱۲ ماه. اگر برای کالا در کارت کالا گارانتی جداگانه ثبت شده باشد، همان مقدم است. صفر = بدون ذکر مدت.', 'Default 12. A per-product warranty set on the product card wins. 0 = no duration shown.') },
    { k: 'skuFastSearchEnabled', label: () => L('جست‌وجوی سریع پارت‌نامبر / SKU / بارکد', 'Instant part-number / SKU / barcode search'), type: 'bool',
      hint: () => L('تطابق دقیق کد فنی (LM317، NE555، سیم 2.5 و…) همیشه بالای همهٔ نتایج جست‌وجو می‌نشیند.', 'Exact technical-code matches (LM317, NE555, سیم 2.5…) always rank on top of all results.') },
    { k: 'proformaInvoiceEnabled', label: () => L('دکمهٔ «دریافت پیش‌فاکتور رسمی» (سبد خرید)', '“Get official proforma invoice” button (cart)'), type: 'bool',
      hint: () => L('پیش‌فاکتور A4 با نشان یاسایی، تاریخ شمسی، شمارهٔ خودکار، جدول اقلام و محل مهر؛ قابل چاپ/ذخیرهٔ PDF.', 'A4 proforma with the Yassaei badge, Solar date, auto number, items table and stamp area; printable/PDF.') },
    { k: 'freeShippingBarEnabled', label: () => L('نوار پیشرفت «تا ارسال رایگان» (سبد خرید)', '“Free-shipping progress” bar (cart)'), type: 'bool',
      hint: () => L('«تنها … تا ارسال رایگان سفارش!» و پیام تبریک وقتی آستانه رد شود.', '“Only … away from free shipping!” and a celebration message once unlocked.') },
    { k: 'freeShippingThreshold', label: () => L('آستانهٔ نوار ارسال رایگان (تومان)', 'Free-shipping bar threshold (Toman)'), type: 'number', min: 0, max: 10000000000,
      hint: () => L('۰ = استفاده از «ارسال رایگان از مبلغ» در تب ارسال.', '0 = use “Free shipping over” from the Shipping tab.') },
    { k: 'bankDetailsEnabled', label: () => L('کارت‌به‌کارت / واریز بانکی (روش پرداخت + کادر کپی کارت و شبا)', 'Card-to-card / bank transfer (payment method + copy box)'), type: 'bool',
      hint: () => L('با روشن بودن و ثبت شمارهٔ کارت یا شبا، روش پرداخت «کارت به کارت» در تسویه‌حساب اضافه می‌شود و اطلاعات واریز در صفحهٔ پرداخت، پایان خرید، پیش‌فاکتور و فاکتور با دکمهٔ «کپی شد» نمایش داده می‌شود. خاموش = حذف کامل از سایت.', 'When on (and a card number or IBAN is set), a “Card-to-card” payment method is added at checkout and the details appear on the payment page, order confirmation, proforma and invoice with one-click copy. Off = removed from the site.') },
    { k: 'bankDetails', label: () => L('اطلاعات حساب فروشگاه', 'Store bank details'), type: 'group',
      hint: () => L('شمارهٔ کارت دقیقاً ۱۶ رقم؛ شبا با IR و ۲۴ رقم (فاصله و خط تیره مهم نیست).', 'Card number exactly 16 digits; IBAN as IR + 24 digits (spaces/dashes are ignored).'), fields: [
      { k: 'bankName', label: () => L('نام بانک', 'Bank name') },
      { k: 'cardNumber', label: () => L('شمارهٔ کارت (۱۶ رقم)', 'Card number (16 digits)') },
      { k: 'iban', label: () => L('شمارهٔ شبا (IR + ۲۴ رقم)', 'IBAN (IR + 24 digits)') },
      { k: 'owner', label: () => L('نام صاحب حساب', 'Account holder name') },
    ] },
  ],
  plus: [
    { k: 'enabled', label: () => t('feat.plus'), type: 'bool' },
    { k: 'price', label: () => L('مبلغ اشتراک', 'Price'), type: 'number', min: 0, max: 100000000 },
    { k: 'durationDays', label: () => L('مدت (روز)', 'Duration (days)'), type: 'number', min: 1, max: 365 },
    { k: 'discountPct', label: () => L('تخفیف دائمی (درصد)', 'Permanent discount (%)'), type: 'number', min: 0, max: 30, step: 0.5 },
    { k: 'freeShippingMin', label: () => L('ارسال رایگان از مبلغ', 'Free shipping over'), type: 'number', min: 0, max: 100000000 },
    { k: 'autoInsurance', label: () => L('بیمهٔ خودکار', 'Auto insurance'), type: 'bool' },
    { k: 'prioritySupport', label: () => L('پشتیبانی اولویت‌دار', 'Priority support'), type: 'bool' },
    { k: 'expressDiscountPct', label: () => L('تخفیف ارسال فوری (درصد)', 'Express discount (%)'), type: 'number', min: 0, max: 100 },
    { k: 'perks', label: () => t('acc.plusPerks'), type: 'rows', cols: [
      { k: 'id', label: () => 'id' }, { k: 'fa', label: () => L('مزیت', 'Perk (FA)') }, { k: 'en', label: () => L('Perk (EN)', 'Perk (EN)') },
    ] },
  ],
  orders: [
    { k: 'minOrder', label: () => L('حداقل مبلغ سفارش', 'Minimum order'), type: 'number', min: 0, max: 100000000 },
    { k: 'orderMaxCeilingEnabled', label: () => L('سقف هوشمند خرید فعال باشد', 'Enable smart purchase ceiling'), type: 'bool', hint: () => L('سقف تراکنش و مجموع خرید روزانه را برای هر دستگاه و کارت/شبا کنترل می‌کند؛ پیش‌فرض ۱۰۰ میلیون تومان است.', 'Checks the transaction and daily total for each device and card/IBAN; default is 100,000,000 Toman.') },
    { k: 'orderMaxAmount', label: () => L('مبلغ سقف خرید (تومان)', 'Purchase ceiling (Toman)'), type: 'number', min: 1, max: 10000000000, hint: () => L('برای خریدهای بالاتر از این مبلغ یا مجموع روزانه، سفارش متوقف می‌شود.', 'Orders above this amount or the daily total are stopped.') },
    { k: 'orderCeilingEnabled', label: () => L('سقف خرید غلتان «فقط خریدهای موفق» فعال باشد', 'Enable rolling ceiling (successful purchases only)'), type: 'bool',
      hint: () => L('مجموع خریدهای موفق (پرداخت‌شده) در بازهٔ زمانی از سقف کم می‌شود. هیچ کاربری به‌خاطر رسیدن به سقف یا تست، مسدود یا محروم نمی‌شود؛ با کم/حذف‌کردن اقلام سبد تا رسیدن زیر سهمیه، محدودیت بلافاصله رفع می‌شود. سفارش‌های پرداخت‌نشده، در انتظار یا لغوشده هرگز شمرده نمی‌شوند.', 'Successful (paid) orders inside the rolling window count toward the cap. No customer is ever banned or locked out — shrinking the cart below the remaining quota lifts the block instantly. Unpaid, pending or cancelled orders never count.') },
    { k: 'orderCeilingAmount', label: () => L('مبلغ سقف خرید غلتان (تومان)', 'Rolling ceiling amount (Toman)'), type: 'number', min: 1, max: 10000000000,
      hint: () => L('پیش‌فرض ۱۰۰٬۰۰۰٬۰۰۰ تومان؛ قابل تغییر به هر عددی.', 'Default 100,000,000 Toman; editable to any number.') },
    { k: 'orderCeilingHours', label: () => L('بازهٔ زمانی سقف غلتان (ساعت)', 'Rolling window (hours)'), type: 'number', min: 1, max: 8760,
      hint: () => L('پیش‌فرض ۴۸ ساعت؛ قابل تغییر به هر عددی (ساعت).', 'Default 48 hours; editable to any number of hours.') },
    { k: 'walletEnabled', label: () => t('feat.wallet'), type: 'bool' },
    { k: 'gatewayEnabled', label: () => t('pm.gateway'), type: 'bool' },
    { k: 'gatewayMode', label: () => L('حالت درگاه', 'Gateway mode'), type: 'select', options: () => [['demo', L('آزمایشی', 'Demo')], ['live', L('واقعی', 'Live')]] },
    { k: 'codEnabled', label: () => t('pm.cod'), type: 'bool' },
    { k: 'autoCancelHours', label: () => L('لغو خودکار پس از (ساعت)', 'Auto-cancel after (h)'), type: 'number', min: 1, max: 720 },
    { k: 'stockReserveMinutes', label: () => L('رزرو موجودی (دقیقه)', 'Stock reserve (min)'), type: 'number', min: 0, max: 1440 },
    { k: 'refundToWallet', label: () => L('بازگشت وجه به کیف پول', 'Refund to wallet'), type: 'bool' },
    { k: 'kyc', label: () => L('احراز هویت (KYC) هنگام ثبت سفارش', 'KYC at checkout'), type: 'group',
      hint: () => L('پیش‌فرض «غیرفعال» است؛ یعنی هیچ اجباری برای احراز هویت جهت ثبت سفارش وجود ندارد. برای فعال‌سازی، کلید «اجباری» را روشن کن و قاعده را انتخاب کن.',
        'Off by default: no KYC is required to place an order. To enforce it, turn the switch on and pick a rule.'),
      fields: [
        { k: 'enabled', def: true, label: () => L('سیستم احراز هویت فعال باشد (kycEnabled)', 'KYC system enabled (kycEnabled)'), type: 'bool',
          desc: () => L('خاموش = کل سیستم موقتاً غیرفعال می‌شود، ارسال مدارک بسته می‌شود و هیچ اجباری برای خرید نیست.', 'Off = the whole KYC system is paused, uploads are closed and no order requires verification.') },
        { k: 'showInNav', def: true, label: () => L('دکمهٔ احراز هویت در پنل کاربری دیده شود (kycShowInNav)', 'Show the KYC button in the user panel (kycShowInNav)'), type: 'bool',
          desc: () => L('خاموش = دکمهٔ احراز هویت از منوی کاربر و منوی کشویی سربرگ پنهان می‌شود (بخش همچنان از آدرس مستقیم باز می‌شود).', 'Off = hides the KYC button from the user panel and header dropdown (the page stays reachable by direct link).') },
        { k: 'required', def: false, label: () => L('احراز هویت اجباری باشد (kycRequired)', 'KYC required (kycRequired)'), type: 'bool',
          desc: () => L('خاموش = ثبت سفارش بدون احراز هویت آزاد است.', 'Off = customers can order without KYC.') },
        { k: 'condition', def: 'disabled', label: () => L('قاعدهٔ اجبار (kycCondition)', 'Rule (kycCondition)'), type: 'select', options: () => [
          ['disabled', L('غیرفعال — هیچ اجباری برای احراز هویت جهت ثبت سفارش وجود ندارد (پیش‌فرض)', 'Disabled — no requirement (default)')],
          ['all', L('اجباری برای تمام سفارش‌ها', 'Required for all orders')],
          ['amount', L('اجباری برای سفارش‌های بالای مبلغ مشخص', 'Required above a set amount')],
          ['installments', L('اجباری فقط برای پرداخت اقساطی (اسنپ‌پی، ازکی‌وام، دیجی‌پی)', 'Installments only (SnappPay, Azki, DigiPay)')],
          ['first_order', L('اجباری فقط برای اولین خرید کاربر', 'First order only')],
        ] },
        { k: 'minAmount', def: 50000000, min: 0, max: 1000000000, label: () => L('حداقل مبلغ اجبار (kycMinAmount) — تومان', 'Minimum amount (kycMinAmount) — Toman'), type: 'number',
          hint: () => L('فقط برای قاعدهٔ «بالای مبلغ مشخص» استفاده می‌شود؛ پیش‌فرض ۵۰٬۰۰۰٬۰۰۰ تومان.', 'Only used by the "above amount" rule; default 50,000,000 Toman.') },
        { k: 'message', label: () => L('پیام دلخواه هنگام مسدود شدن سفارش', 'Custom block message'), type: 'text',
          hint: () => L('خالی = پیام پیش‌فرض یاسایی نمایش داده می‌شود.', 'Empty = the default Yassaei message is shown.') },
      ] },
  ],
  seo: [
    { k: 'title', label: () => L('عنوان سایت', 'Site title'), type: 'text' },
    { k: 'description', label: () => L('توضیحات متا', 'Meta description'), type: 'textarea' },
    { k: 'keywords', label: () => L('کلیدواژه‌ها', 'Keywords'), type: 'text' },
    { k: 'googleSiteVerification', label: () => L('کد تأیید سرچ کنسول گوگل', 'Google Site Verification Code'), type: 'text' },
  ],
  currency: [
    { k: 'code', label: () => L('کد ارز', 'Currency code'), type: 'text' },
    { k: 'label', label: () => L('نام واحد', 'Unit label'), type: 'text' },
    { k: 'labelEn', label: () => L('Unit (EN)', 'Unit (EN)'), type: 'text' },
  ],
  auth: [
    { k: 'allowRegistration', label: () => L('ثبت‌نام باز باشد', 'Allow registration'), type: 'bool' },
    { k: 'otpMode', label: () => L('حالت ارسال کد', 'OTP mode'), type: 'select', options: () => [['demo', L('آزمایشی', 'Demo')], ['live', L('واقعی', 'Live')]] },
    { k: 'requirePhone', label: () => L('شمارهٔ موبایل الزامی', 'Require phone'), type: 'bool' },
    { k: 'force2faStaff', label: () => L('۲FA اجباری کارکنان', 'Force 2FA for staff'), type: 'bool' },
    { k: 'sessionDays', label: () => L('طول نشست (روز)', 'Session days'), type: 'number', min: 1, max: 90 },
  ],
  contact: [
    { k: 'supportNote', label: () => L('پیام بخش پشتیبانی', 'Support note'), type: 'textarea' },
    { k: 'supportNoteEn', label: () => L('Support note (EN)', 'Support note (EN)'), type: 'textarea' },
  ],
  // ── امنیت و محافظت از کد (‎#/admin/settings/security) ───────
  security: [
    { k: 'antiInspectEnabled', label: () => L('محافظت در برابر Inspect و برداشت کد', 'Anti-inspect & code protection'), type: 'bool', def: true,
      hint: () => L('با روشن‌بودن: کلیک راست روی عناصر صفحه بسته است، میان‌برهای DevTools (F12، Ctrl+Shift+I/J/C و Cmd+Opt+I/J/C، Ctrl+U) مسدود می‌شود، هشدار امنیتی در کنسول مرورگر چاپ می‌شود و تصاویر کالا کشیده نمی‌شوند. تایپ و انتخاب متن در فیلدهای ورودی، جست‌وجو، فرم‌ها و لمس موبایل کاملاً آزاد می‌ماند. اگر لازم شد، همین‌جا خاموشش کنید.', 'When on: right-click on page elements is blocked, DevTools shortcuts (F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C, Ctrl+U) are intercepted, a security notice is printed in the browser console and product images cannot be dragged. Typing/selecting inside inputs, search, forms and mobile touch stay untouched. Turn it off here if ever needed.') },
    { k: 'queueEnabled', label: () => t('adm.secQueueEnabled'), type: 'bool', def: true,
      hint: () => t('adm.secQueueDesc') },
    { k: 'maxConcurrent', label: () => L('سقف درخواست‌های همزمان (maxConcurrent)', 'Max concurrent requests (maxConcurrent)'), type: 'number', def: 80, min: 5, max: 5000 },
    { k: 'triggerRps', label: () => L('آستانهٔ فعال‌شدن صف — درخواست بر ثانیه (triggerRps)', 'Queue trigger — requests per second (triggerRps)'), type: 'number', def: 40, min: 5, max: 2000 },
    { k: 'passTtlMin', label: () => L('اعتبار گذرنامهٔ صف — دقیقه (passTtlMin)', 'Queue pass TTL — minutes (passTtlMin)'), type: 'number', def: 30, min: 5, max: 240 },
    { k: 'pollSec', label: () => L('فاصلهٔ بررسی نوبت — ثانیه (pollSec)', 'Queue poll interval — seconds (pollSec)'), type: 'number', def: 4, min: 2, max: 20 },
    { k: 'floodBanPerMin', label: () => L('سقف درخواست در دقیقهٔ هر IP (floodBanPerMin)', 'Requests per minute per IP (floodBanPerMin)'), type: 'number', def: 2500, min: 500, max: 100000 },
    { k: 'floodBanMin', label: () => L('مدت مسدودسازی خودکار — دقیقه (floodBanMin)', 'Auto-ban duration — minutes (floodBanMin)'), type: 'number', def: 15, min: 1, max: 1440 },
  ],
};

const TABS = {
  settings: [
    { id: 'store', icon: 'store', label: () => t('adm.sStore') },
    { id: 'products', icon: 'box', label: () => L('محصولات و کاتالوگ', 'Products & catalog') },
    { id: 'team', icon: 'chat', label: () => L('ارتباطات تیم', 'Team communication') },
    { id: 'shipping', icon: 'truck', label: () => t('adm.sShipping') },
    { id: 'salesTools', icon: 'tag', label: () => L('ابزارهای فروش', 'Sales tools') },
    { id: 'plus', icon: 'sparkles', label: () => t('adm.sPlus') },
    { id: 'orders', icon: 'card', label: () => t('adm.sOrders') },
    { id: 'auth', icon: 'key', label: () => t('adm.sAuth') },
    { id: 'security', icon: 'shield', label: () => L('امنیت و محافظت از کد', 'Security & code protection') },
    { id: 'seo', icon: 'search', label: () => t('adm.sSeo') },
    { id: 'currency', icon: 'wallet', label: () => L('واحد پول', 'Currency') },
    { id: 'partners', icon: 'star', label: () => t('adm.sPartners') },
    { id: 'contact', icon: 'headset', label: () => t('common.support') },
    { id: 'mailsms', icon: 'send', label: () => t('adm.mailsms') },
    { id: 'nav', icon: 'layout', label: () => t('adm.sNav') },
  ],
  theme: [
    { id: 'theme', icon: 'sun', label: () => t('adm.sTheme') },
    { id: 'ui', icon: 'grid', label: () => t('adm.sUi') },
  ],
  features: [
    { id: 'features', icon: 'zap', label: () => t('adm.sFeatures') },
    { id: 'backups', icon: 'download', label: () => t('adm.sBackups') },
  ],
};

let CFG = null;

export async function render(ctx) {
  const sec = ['settings', 'theme', 'features'].includes(ctx.params.section) ? ctx.params.section : 'settings';
  const tabs = TABS[sec].filter((x) => (sec === 'theme' ? can('theme.edit') : true));
  if (!tabs.length) return emptyState({ icon: 'lock', title: t('adm.noPermission') });
  const tab = tabs.find((x) => x.id === ctx.params.id) || tabs[0];

  try { CFG = await api.get('/api/admin/settings'); }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }

  const values = CFG.settings?.[tab.id] || {};
  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon(tab.icon)} ${tab.label()}</h2>
      <span class="badge-pill bp-info">${t('adm.liveView')}</span>
    </div>
    <div class="tabs mb" data-tabs>
      ${TABS[sec].filter((x) => (sec === 'theme' ? can('theme.edit') : true)).map((x) => h`
        <a class="tab ${x.id === tab.id ? 'active' : ''}" href="#/admin/${sec}/${x.id}">${icon(x.icon)} ${x.label()}</a>`)}
    </div>
    ${tab.id === 'products' ? h`
      <h3 class="mb">${t('adm.oldPriceBadge')}</h3>
      ${featureSwitchForm('oldPrice', t('adm.oldPriceEnabled'))}
      ${schemaForm('oldPrice', CFG.settings?.oldPrice || {})}
      <h3 class="mt mb">${L('هشدار موجودی', 'Stock alerts')}</h3>
      ${schemaForm('products', values)}`
      : tab.id === 'team' ? featureSwitchForm('adminChat', t('feat.adminChat'))
      : tab.id === 'features' ? featuresForm(CFG.settings?.features || {})
      : tab.id === 'backups' ? raw('<div data-backups-panel></div>')
      : tab.id === 'partners' ? partnersForm(CFG.settings?.partners?.items || [])
      : tab.id === 'nav' ? navManagerForm(CFG.settings || {})
      : schemaForm(tab.id, values)}
    <p class="hint mt">${L('تغییرها بلافاصله روی سایت اعمال می‌شود؛ برای دیدن نتیجه صفحه را تازه کن.', 'Changes apply to the site immediately; refresh the page to see them.')}</p>`;
}

function featureSwitchForm(key, label) {
  return h`<form class="card mb" data-act="adm-set-save" data-section="features">
    ${switchField({ label, name: `features.${key}`, checked: CFG.settings?.features?.[key] !== false })}
    <button class="btn btn-primary mt" type="submit">${icon('save')} ${t('common.save')}</button>
  </form>`;
}

function schemaForm(section, values) {
  const fields = FIELDS[section] || [];
  return h`
    <form class="card" data-act="adm-set-save" data-section="${section}">
      <div class="form-grid">
        ${fields.map((f) => renderField(f, values[f.k])).join('')}
      </div>
      <div class="row row-wrap mt">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
        <button class="btn btn-ghost" type="button" data-act="adm-set-reset">${icon('refresh')} ${t('common.reset')}</button>
      </div>
    </form>`;
}

function renderField(f, value) {
  const label = f.label();
  switch (f.type) {
    case 'bool':
      return h`<div class="span-2">${switchField({ label, desc: f.hint ? f.hint() : '', name: f.k, checked: (value ?? f.def ?? true) !== false })}</div>`;
    case 'select':
      return selectField({ label, name: f.k, value: value ?? '', options: f.options().map(([v, l]) => ({ value: v, label: l })) });
    case 'number':
      return field({ label, name: f.k, type: 'number', value: value ?? f.def ?? '', attrs: raw(`min="${f.min ?? 0}" max="${f.max ?? 999999999}" step="${f.step ?? 1}"`) });
    case 'textarea':
      return h`<div class="span-2">${textareaField({ label, name: f.k, value: value ?? '', rows: 3 })}</div>`;
    case 'color': {
      const val = String(value || '#3dabff');
      return h`
        <div class="color-field">
          <label class="field"><span class="label">${label}</span>
            <span class="row color-row">
              <input type="color" class="color-pick" name="${f.k}-pick" value="${esc(val)}" data-color-for="${f.k}">
              <input class="input mono" name="${f.k}" value="${esc(val)}" maxlength="7" data-fkey="${f.k}">
            </span>
          </label>
          <span class="row row-wrap mt-s color-live-row" data-color-livebox="${f.k}" data-saved="${esc(val)}" hidden>
            <span class="badge-pill bp-accent">${icon('eye')} ${t('adm.colorLive')}</span>
            <button type="button" class="btn btn-ghost btn-xs" data-act="adm-color-revert">${t('adm.colorRevert')}</button>
          </span>
          <span class="hint tiny muted mt-s">${h`${icon('eye')} ${t('adm.colorHint')}`}</span>
        </div>`;
    }
    case 'coords':
      return h`
        <div class="span-2"><span class="label">${label}</span>
          <div class="row">
            <input class="input mono" name="${f.k}.lat" value="${value?.lat ?? ''}" placeholder="lat" data-fnum="1">
            <input class="input mono" name="${f.k}.lng" value="${value?.lng ?? ''}" placeholder="lng" data-fnum="1">
            <button type="button" class="btn btn-ghost btn-sm" data-act="adm-set-geo" data-lat="${f.k}.lat" data-lng="${f.k}.lng">${icon('pin')} ${t('contact.allowLocation')}</button>
          </div>
        </div>`;
    case 'group':
      return h`
        <div class="span-2 group-box">
          <strong class="small">${label}</strong>
          ${f.hint ? h`<p class="hint mt-s">${f.hint()}</p>` : ''}
          <div class="form-grid mt-s">
            ${f.fields.map((sf) => sf.type === 'bool'
              ? h`<div class="span-2">${switchField({ label: sf.label(), desc: sf.desc ? sf.desc() : '', name: `${f.k}.${sf.k}`, checked: value?.[sf.k] === undefined ? sf.def !== false : value[sf.k] !== false })}</div>`
              : sf.type === 'select'
                ? selectField({ label: sf.label(), name: `${f.k}.${sf.k}`, value: value?.[sf.k] ?? sf.def ?? '', options: sf.options().map(([v, l]) => ({ value: v, label: l })), hint: sf.hint ? sf.hint() : '' })
                : sf.type === 'number'
                  ? field({ label: sf.label(), name: `${f.k}.${sf.k}`, type: 'number', value: value?.[sf.k] ?? sf.def ?? '', hint: sf.hint ? sf.hint() : '', attrs: `min="${sf.min ?? 0}" max="${sf.max ?? 999999999}"` })
                  : field({ label: sf.label(), name: `${f.k}.${sf.k}`, value: value?.[sf.k] ?? '', type: sf.k === 'pass' || sf.k === 'apiKey' ? 'password' : 'text', hint: sf.hint ? sf.hint() : '' })).join('')}
          </div>
        </div>`;
    case 'kv':
      return h`
        <div class="span-2"><span class="label">${label}</span>
          <div class="form-grid">
            ${f.keys.map((k) => h`<label class="field"><span class="label tiny muted mono">${k}</span>
              <input class="input" name="${f.k}.${k}" value="${esc(value?.[k] ?? '')}"></label>`)}
          </div>
        </div>`;
    case 'kvnum':
      return h`
        <div class="span-2"><span class="label">${label}</span>
          <div class="form-grid">
            ${f.keys.map((k) => h`<label class="field"><span class="label tiny muted">${t(`adm.uCols${k.charAt(0).toUpperCase()}${k.slice(1)}`)}</span>
              <input class="input" type="number" min="${f.min}" max="${f.max}" name="${f.k}.${k}" value="${value?.[k] ?? ''}"></label>`)}
          </div>
        </div>`;
    case 'multi':
      return h`
        <div class="span-2"><span class="label">${label}</span>
          <div class="row row-wrap">
            ${f.options().map(([v, l]) => h`<label class="check"><input type="checkbox" name="${f.k}[]" value="${v}" ${(value || []).includes(v) ? 'checked' : ''}><span class="box">${icon('check')}</span><span>${l}</span></label>`)}
          </div>
        </div>`;
    case 'rows':
      return h`
        <div class="span-2">
          <div class="row row-between">
            <span class="label">${label}</span>
            <button type="button" class="btn btn-ghost btn-xs" data-act="adm-row-add" data-row="${f.k}">${icon('plus')} ${t('common.add')}</button>
          </div>
          <div data-rows="${f.k}">
            ${(Array.isArray(value) ? value : []).map((row) => rowHtml(f, row)).join('')}
          </div>
          <template data-row-tpl="${f.k}">${rowHtml(f, null)}</template>
        </div>`;
    default:
      return field({ label, name: f.k, value: value ?? '', hint: f.hint ? f.hint() : '' });
  }
}

function rowHtml(f, row) {
  return h`
    <div class="spec-row" data-row="${f.k}">
      ${f.cols.map((c) => {
        const v = row?.[c.k] ?? '';
        return c.type === 'select'
          ? h`<select class="select" data-col="${c.k}">${c.options().map(([ov, ol]) => h`<option value="${ov}" ${String(v) === String(ov) ? 'selected' : ''}>${ol}</option>`)}</select>`
          : c.type === 'number'
            ? h`<input class="input" type="number" data-col="${c.k}" value="${esc(v)}" placeholder="${c.label ? c.label() : c.k}">`
            : h`<input class="input" data-col="${c.k}" value="${esc(v)}" placeholder="${c.label ? c.label() : c.k}">`;
      })}
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="adm-row-del">${icon('trash')}</button>
    </div>`;
}

function featuresForm(features) {
  const keys = Object.keys(features);
  return h`
    <form class="card" data-act="adm-set-save" data-section="features">
      <p class="notice notice-info mb">${icon('info')}<span>${t('adm.fHint')}</span></p>
      <div class="perm-grid">
        ${keys.map((k) => h`
          <label class="perm-item">
            <span class="switch"><input type="checkbox" name="features.${k}" ${features[k] !== false ? 'checked' : ''}><span class="track"></span></span>
            <span class="grow"><strong>${t(`feat.${k}`) || k}</strong><span class="hint tiny">${t(`feat.${k}.d`)}</span><span class="k mono">${k}</span></span>
          </label>`)}
      </div>
      <div class="row row-wrap mt">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
        <button class="btn btn-ghost" type="button" data-act="adm-set-reset">${icon('refresh')} ${t('common.reset')}</button>
      </div>
    </form>`;
}

function partnersForm(items) {
  const row = (it) => h`
    <div class="row pt-row" data-ptrow>
      <input class="input" name="fa" placeholder="${t('adm.ptFa')}" value="${it?.fa || ''}" maxlength="60">
      <input class="input" name="en" placeholder="${t('adm.ptEn')}" value="${it?.en || ''}" maxlength="60">
      <button type="button" class="btn btn-ghost btn-sm" data-act="adm-pt-del" aria-label="${t('misc.delete')}">${icon('trash')}</button>
    </div>`;
  return h`
    <form class="card" data-act="adm-set-save" data-section="partners">
      <p class="notice notice-info mb">${icon('info')}<span>${t('adm.ptHint')}</span></p>
      <div class="col" data-ptlist>${items.map((it) => row(it)).join('') || row(null)}</div>
      <div class="row row-wrap mt">
        <button type="button" class="btn btn-ghost" data-act="adm-pt-add">${icon('plus')} ${t('adm.ptAdd')}</button>
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
      </div>
    </form>`;
}
act('adm-pt-add', (e) => {
  const list = e.target.closest('form').querySelector('[data-ptlist]');
  list.insertAdjacentHTML('beforeend', `<div class="row pt-row" data-ptrow><input class="input" name="fa" placeholder="${t('adm.ptFa')}" value="" maxlength="60"><input class="input" name="en" placeholder="${t('adm.ptEn')}" value="" maxlength="60"><button type="button" class="btn btn-ghost btn-sm" data-act="adm-pt-del" aria-label="${t('misc.delete')}">${icon('trash')}</button></div>`);
});
act('adm-pt-del', (e) => {
  const form = e.target.closest('form');
  const rows = form.querySelectorAll('[data-ptrow]');
  if (rows.length > 1) e.target.closest('[data-ptrow]').remove();
  else form.querySelectorAll('[data-ptrow] input').forEach((i) => (i.value = ''));
});

// ── جمع‌آوری مقادیر ────────────────────────────────────────
function collect(form, section) {
  const out = {};
  if (section === 'features') {
    form.querySelectorAll('input[type=checkbox][name^="features."]').forEach((i) => { out[i.name.slice(9)] = i.checked; });
    return out;
  }
  if (section === 'partners') {
    out.items = [...form.querySelectorAll('[data-ptrow]')].map((r) => ({ fa: r.querySelector('[name=fa]').value.trim(), en: r.querySelector('[name=en]').value.trim() })).filter((x) => x.fa || x.en);
    return out;
  }
  for (const f of FIELDS[section] || []) {
    switch (f.type) {
      case 'bool': {
        const el = form.querySelector(`[name="${f.k}"]`);
        if (el) out[f.k] = el.checked;
        break;
      }
      case 'multi': {
        out[f.k] = [...form.querySelectorAll(`[name="${f.k}[]"]`)].filter((i) => i.checked).map((i) => i.value);
        break;
      }
      case 'rows': {
        out[f.k] = [...form.querySelectorAll(`[data-rows="${f.k}"] [data-row]`)].map((row) => {
          const o = {};
          for (const c of f.cols) {
            const el = row.querySelector(`[data-col="${c.k}"]`);
            o[c.k] = c.type === 'number' ? Number(el?.value || 0) : String(el?.value ?? '');
          }
          return o;
        });
        break;
      }
      case 'kv': {
        const o = {};
        for (const k of f.keys) o[k] = String(form.querySelector(`[name="${f.k}.${k}"]`)?.value ?? '');
        out[f.k] = o;
        break;
      }
      case 'group': {
        const o = {};
        for (const sf of f.fields) {
          const el = form.querySelector(`[name="${f.k}.${sf.k}"]`);
          if (!el) continue;
          o[sf.k] = sf.type === 'bool' ? el.checked : sf.type === 'number' ? Number(el.value || 0) : String(el.value ?? '');
        }
        out[f.k] = o;
        break;
      }
      case 'kvnum': {
        const o = {};
        for (const k of f.keys) o[k] = Number(form.querySelector(`[name="${f.k}.${k}"]`)?.value || 0);
        out[f.k] = o;
        break;
      }
      case 'coords': {
        const lat = form.querySelector(`[name="${f.k}.lat"]`)?.value;
        const lng = form.querySelector(`[name="${f.k}.lng"]`)?.value;
        if (lat !== '' && lng !== '' && lat !== undefined) out[f.k] = { lat: Number(lat), lng: Number(lng) };
        break;
      }
      case 'number': {
        const el = form.querySelector(`[name="${f.k}"]`);
        if (el && el.value !== '') out[f.k] = Number(el.value);
        break;
      }
      default: {
        const el = form.querySelector(`[name="${f.k}"]`);
        if (el) out[f.k] = String(el.value ?? '');
      }
    }
  }
  return out;
}


// ── کنش‌های «مدیریت منوها و بخش‌ها» ─────────────────────────
act('adm-nav-save', async (e, form) => {
  e.preventDefault();
  const value = collectNav(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch('/api/admin/settings/nav', { value });
      // تنظیمات سریع KYC هم اگر در همین صفحه تغییر کرده باشد ذخیره می‌شود
      const kycBox = form.querySelector('[data-kyc-quick]');
      if (kycBox) await saveKycQuick(kycBox);
      await refreshBootstrap({ silent: true });
      toastSuccess(t('adm.navSaved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

async function saveKycQuick(form) {
  const cond = String(form.querySelector('[name=kycCondition]')?.value || 'disabled');
  const minAmount = Number(form.querySelector('[name=kycMinAmount]')?.value || 50000000);
  const enabled = form.querySelector('[name=kycEnabled]')?.checked !== false;
  const showInNav = form.querySelector('[name=kycShowInNav]')?.checked !== false;
  await api.patch('/api/admin/settings/orders', { value: { kyc: { enabled, showInNav, condition: cond, minAmount, required: cond !== 'disabled' } } });
  await refreshBootstrap({ silent: true });
}

act('adm-kyc-only', async (e, el) => {
  const box = el.closest('[data-kyc-quick]') || document;
  await withBusy(el, async () => {
    try {
      await saveKycQuick(box);
      toastSuccess(t('adm.sSaved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

/** جابه‌جایی یک ردیف به بالا یا پایین */
function moveNavRow(el, dir) {
  const row = el.closest('[data-navrow]');
  if (!row) return;
  const list = row.parentElement;
  if (dir < 0 && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
  else if (dir > 0 && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
}
act('navmgr-up', (e, el) => moveNavRow(el, -1));
act('navmgr-down', (e, el) => moveNavRow(el, 1));

/** بازگردانی فرم به مقادیر پیش‌فرض (تا ذخیره نشود، روی سایت اثری ندارد) */
act('navmgr-reset', (e, el) => {
  const form = el.closest('form');
  if (!form) return;
  form.querySelectorAll('[data-navrow]').forEach((row) => {
    row.querySelectorAll('[data-navf="fa"],[data-navf="en"],[data-navf="emoji"]').forEach((i) => { i.value = ''; });
    row.querySelector('[data-navf="show"]').checked = true;
    row.querySelector('[data-navf="on"]').checked = true;
    const prev = row.querySelector('[data-navprev]');
    const ic = row.querySelector('[data-navf="icon"]');
    const def = row.dataset.navdef || 'box';
    if (ic) ic.value = def;
    if (prev) prev.innerHTML = h`${icon(def)}`;
  });
  toastSuccess(t('adm.navReset'));
});

// ── کنش‌ها ──────────────────────────────────────────────────
act('adm-set-save', async (e, form) => {
  e.preventDefault();
  const section = form.dataset.section;
  const value = collect(form, section);
  if (section === 'theme') {
    for (const k of ['accent', 'accent2', 'bgColor']) {
      if (value[k] && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value[k])) {
        toastError(isFa() ? 'رنگ باید با فرمت #RRGGBB باشد.' : 'Colour must be in #RRGGBB format.');
        return;
      }
    }
  }
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/settings/${section}`, { value });
      await refreshBootstrap({ silent: true });
      applyPrefs();
      toastSuccess(t('adm.sSaved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

act('adm-set-reset', () => {
  applyPrefs(); // بازنشانی هر پیش‌نمایش زنده‌ی رنگی که روی صفحه باشد
  refresh(true);
});

// بازگشت رنگ به مقدار ذخیره‌شده (حذف پیش‌نمایش) — شامل رنگ اصلی، رنگ دوم و پس‌زمینه
act('adm-color-revert', (e, el) => {
  const box = el.closest('[data-color-livebox]');
  const form = box?.closest('form');
  if (!box || !form) return;
  const key = box.dataset.colorLivebox;
  const saved = box.dataset.saved || '';
  const text = form.querySelector(`[name="${key}"]`);
  const pick = form.querySelector(`[data-color-for="${key}"]`);
  if (text) text.value = saved;
  if (pick && /^#[0-9a-f]{6}$/i.test(saved)) pick.value = saved;
  const previewVar = key === 'accent2' ? '--accent-2' : (key === 'bgColor' ? '--bg' : null);
  if (previewVar) document.documentElement.style.removeProperty?.(previewVar);
  clearAccentPreview();
  applyPrefs(); // رنگ‌های ذخیره‌شده دوباره اعمال می‌شود
  box.hidden = true;
});

act('adm-set-geo', (e, el) => {
  if (!navigator.geolocation) { toastError(t('contact.locationDenied')); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const form = el.closest('form');
      const lat = form.querySelector(`[name="${el.dataset.lat}"]`);
      const lng = form.querySelector(`[name="${el.dataset.lng}"]`);
      if (lat) lat.value = pos.coords.latitude.toFixed(5);
      if (lng) lng.value = pos.coords.longitude.toFixed(5);
      toastSuccess(t('contact.locationOn'));
    },
    () => toastError(t('contact.locationDenied')),
    { timeout: 9000 },
  );
});

act('adm-row-add', (e, el) => {
  const key = el.dataset.row;
  const form = el.closest('form');
  const tpl = form.querySelector(`[data-row-tpl="${key}"]`);
  const box = form.querySelector(`[data-rows="${key}"]`);
  if (!tpl || !box) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = tpl.innerHTML.trim();
  const node = wrap.firstElementChild;
  if (node) {
    node.querySelectorAll('input').forEach((i) => { i.value = ''; });
    box.appendChild(node);
  }
});

act('adm-row-del', (e, el) => { el.closest('[data-row]')?.remove(); });

export function mount(root, ctx) {
  applyDyn(root);
  if (ctx?.params?.id === 'backups') loadBackupsPanel(root);
  if (ctx?.params?.id === 'nav') wireNavManager(root);
  // همگام‌سازی قاعدهٔ احراز هویت: با انتخاب قاعده‌ای غیر از «غیرفعال»،
  // کلید «اجباری» خودکار روشن می‌شود تا مدیر مجبور به دو کلیک نباشد.
  {
    const cond = root.querySelector('[name="kyc.condition"]');
    const req = root.querySelector('[name="kyc.required"]');
    if (cond && req) {
      cond.addEventListener('change', () => { if (cond.value && cond.value !== 'disabled') req.checked = true; });
    }
  }
  // همگام‌سازی انتخابگر رنگ با فیلد متنی + پیش‌نمایش زندهٔ رنگ اصلی
  // روی کل سایت (بدون ذخیره). با رفتن از صفحه، رنگ ذخیره‌شده برمی‌گردد.
  root.querySelectorAll('[data-color-for]').forEach((pick) => {
    const key = pick.dataset.colorFor;
    const text = root.querySelector(`[name="${key}"]`);
    if (!text) return;
    const livebox = root.querySelector(`[data-color-livebox="${key}"]`);
    const saved = /^#[0-9a-f]{6}$/i.test(text.value) ? text.value.toLowerCase() : null;
    const setLive = (on) => { if (livebox) livebox.hidden = !on; };
    // پیش‌نمایش آنی روی متغیرهای CSS اعمال می‌شود تا مدیر همان لحظه رنگ را در سایت ببیند
    // accent → همهٔ توکن‌های رنگ اصلی · accent2 → --accent-2 · bgColor → --bg
    const previewVar = key === 'accent2' ? '--accent-2' : (key === 'bgColor' ? '--bg' : null);
    const resetPreview = () => {
      if (previewVar) document.documentElement.style.removeProperty?.(previewVar);
      applyPrefs(); // مقادیر ذخیره‌شده (شامل رنگ دوم و پس‌زمینه) دوباره اعمال می‌شود
    };
    const applyFrom = (hex) => {
      if (previewVar) {
        if (/^#[0-9a-f]{6}$/i.test(hex)) {
          document.documentElement.style.setProperty(previewVar, hex.toLowerCase());
          setLive(hex.toLowerCase() !== saved);
        } else resetPreview();
        return;
      }
      if (previewAccent(hex)) setLive(hex.toLowerCase() !== saved);
    };
    pick.addEventListener('input', () => {
      text.value = pick.value;
      applyFrom(pick.value);
    });
    text.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(text.value)) { pick.value = text.value; applyFrom(text.value); }
      else if (text.value === (saved || '')) { resetPreview(); setLive(false); }
    });
  });
  // پیش‌نمایش زندهٔ قالب: با تغییر انتخابگر تم، data-theme همان لحظه عوض می‌شود
  root.querySelectorAll('select[name="theme"]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const v = String(sel.value || '').trim();
      if (v) document.documentElement.setAttribute('data-theme', v);
    });
  });
  // با خروج از این نما، هر پیش‌نمایشی را بازنشانی کن و رنگ ذخیره‌شده را برگردان
  return () => { applyPrefs(); };
}


// ─────────────────────────────────────────────────────────────
//  «مدیریت منوها و بخش‌ها» — کنترل کامل همهٔ دکمه‌های سایت
//  برای هر بخش: نمایش/مخفی · فعال/غیرفعال · نام فارسی و انگلیسی ·
//  آیکون یا ایموجی · ترتیب (بالا/پایین یا کشیدن و رها کردن)
//  ذخیره در settings.nav از طریق PATCH /api/admin/settings/nav
// ─────────────────────────────────────────────────────────────
function navRow(group, it) {
  return h`
    <div class="navmgr-row" data-navrow data-nav-id="${it.id}" data-navdef="${it.defIcon}" draggable="true">
      <span class="navmgr-handle" title="${L('برای جابه‌جایی بکش', 'Drag to reorder')}">${icon('menu')}</span>
      <span class="navmgr-preview" data-navprev>${it.emoji ? h`<span class="em">${it.emoji}</span>` : icon(it.icon)}</span>
      <span class="navmgr-title">
        <b>${it.defaultFa || it.id}</b>
        <span class="tiny muted mono">${it.id}${it.feat ? ` · feat:${it.feat}` : ''}${it.kyc ? ' · KYC' : ''}</span>
      </span>
      <label class="field navmgr-f"><span class="label tiny">${t('adm.navFa')}</span>
        <input class="input" data-navf="fa" value="${esc(it.fa)}" placeholder="${esc(it.defaultFa)}" maxlength="60"></label>
      <label class="field navmgr-f"><span class="label tiny">${t('adm.navEn')}</span>
        <input class="input" data-navf="en" value="${esc(it.en)}" placeholder="${esc(it.defaultEn)}" maxlength="60" dir="ltr"></label>
      <label class="field navmgr-f"><span class="label tiny">${t('adm.navIcon')}</span>
        <input class="input mono" data-navf="icon" list="navIconList" value="${it.icon}" dir="ltr" autocomplete="off"></label>
      <label class="field navmgr-f navmgr-emoji"><span class="label tiny">${t('adm.navEmoji')}</span>
        <input class="input" data-navf="emoji" value="${esc(it.emoji)}" placeholder="📦" maxlength="6"></label>
      <span class="navmgr-sw" title="${t('adm.navShow')}">
        <span class="switch"><input type="checkbox" data-navf="show" ${it.show ? 'checked' : ''}><span class="track"></span></span>
        <span class="tiny">${t('adm.navShow')}</span>
      </span>
      <span class="navmgr-sw" title="${t('adm.navOn')}">
        <span class="switch"><input type="checkbox" data-navf="on" ${it.on ? 'checked' : ''}><span class="track"></span></span>
        <span class="tiny">${t('adm.navOn')}</span>
      </span>
      <span class="navmgr-move">
        <button type="button" class="btn btn-ghost btn-xs" data-act="navmgr-up" title="${t('adm.navUp')}">${icon('arrow-up')}</button>
        <button type="button" class="btn btn-ghost btn-xs" data-act="navmgr-down" title="${t('adm.navDown')}">${icon('arrow-down')}</button>
      </span>
    </div>`;
}

function navGroupCard(group, settings) {
  const rows = navAdminRows(group, settings);
  const g = NAV_GROUPS[group];
  return h`
    <div class="card mb" data-navgroup="${group}">
      <div class="row row-between row-wrap">
        <strong>${icon('layout')} ${L(g.fa, g.en)}</strong>
        <span class="badge-pill bp-info">${fmtNum(rows.length)} ${L('بخش', 'sections')}</span>
      </div>
      <p class="hint mt-s">${L(g.hintFa, g.hintEn)}</p>
      <div class="navmgr-list mt-s" data-navlist="${group}">
        ${rows.map((it) => navRow(group, it))}
      </div>
    </div>`;
}

function kycQuickForm(orders) {
  const kyc = orders?.kyc && typeof orders.kyc === 'object' ? orders.kyc : {};
  const cond = String(kyc.condition || 'disabled');
  const options = [
    ['disabled', t('adm.kycOptional')],
    ['all', L('اجباری برای تمام خریدها', 'Required for all orders')],
    ['amount', L('اجباری برای خریدهای بالای سقف مشخص', 'Required above a set amount')],
    ['installments', L('اجباری فقط برای خریدهای اقساطی (اسنپ‌پی / ازکی‌وام / دیجی‌پی)', 'Installments only (SnappPay / Azki / DigiPay)')],
    ['first_order', L('اجباری برای اولین خرید کاربر', 'First order only')],
  ];
  // نکته: این پنل داخل فرم اصلی «مدیریت منوها» است؛ عمداً از <form> تودرتو
  // استفاده نمی‌کنیم (HTML تودرتویی را نمی‌پذیرد) و دکمهٔ جداگانه دارد.
  return h`
    <div class="card mb" data-kyc-quick>
      <strong>${icon('shield-check')} ${t('adm.kycQuick')}</strong>
      <p class="hint mt-s">${t('adm.kycQuickHint')}</p>
      <div class="form-grid mt-s">
        <div class="span-2">${switchField({ label: t('adm.kycEnabled'), desc: L('خاموش = هیچ اجباری نیست و ارسال مدارک هم بسته می‌شود.', 'Off = no requirement and document upload is closed.'), name: 'kycEnabled', checked: kyc.enabled !== false })}</div>
        <div class="span-2">${switchField({ label: t('adm.kycShowInNav'), desc: L('خاموش = دکمهٔ احراز هویت در پنل کاربری دیده نمی‌شود.', 'Off = the KYC button is hidden from the user panel.'), name: 'kycShowInNav', checked: kyc.showInNav !== false })}</div>
        ${selectField({ label: t('adm.kycCondition'), name: 'kycCondition', value: cond, options: options.map(([v, l]) => ({ value: v, label: l })) })}
        ${field({ label: t('adm.kycMinAmount'), name: 'kycMinAmount', type: 'number', value: kyc.minAmount ?? 50000000, attrs: 'min="0" max="1000000000"' })}
      </div>
      <div class="row row-wrap mt">
        <button class="btn btn-ghost" type="button" data-act="adm-kyc-only">${icon('save')} ${L('ذخیرهٔ تنظیمات احراز هویت', 'Save KYC settings only')}</button>
      </div>
    </div>`;
}

function navManagerForm(settings) {
  return h`
    <form data-act="adm-nav-save" data-navgroups>
      <datalist id="navIconList">${NAV_ICON_NAMES.map((n) => h`<option value="${n}"></option>`)}</datalist>
      <div class="card mb">
        <strong>${icon('layout')} ${t('adm.navTitle')}</strong>
        <p class="hint mt-s">${t('adm.navHint')}</p>
        <p class="hint tiny muted mt-s">${icon('info')} ${t('adm.navOffNote')} ${t('adm.navHiddenNote')}</p>
      </div>
      ${NAV_GROUP_IDS.map((g) => navGroupCard(g, settings))}
      ${kycQuickForm(settings.orders || {})}
      <div class="row row-wrap">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
        <button class="btn btn-ghost" type="button" data-act="navmgr-reset">${icon('refresh')} ${t('adm.navReset')}</button>
      </div>
    </form>`;
}

// ── جمع‌آوری مقادیر «مدیریت منوها» از فرم ───────────────────
function collectNav(form) {
  const out = {};
  for (const box of form.querySelectorAll('[data-navlist]')) {
    const group = box.dataset.navlist;
    out[group] = [...box.querySelectorAll('[data-navrow]')].map((row) => ({
      id: row.dataset.navId,
      fa: String(row.querySelector('[data-navf="fa"]')?.value || '').trim(),
      en: String(row.querySelector('[data-navf="en"]')?.value || '').trim(),
      icon: String(row.querySelector('[data-navf="icon"]')?.value || '').trim(),
      emoji: String(row.querySelector('[data-navf="emoji"]')?.value || '').trim(),
      show: row.querySelector('[data-navf="show"]')?.checked !== false,
      on: row.querySelector('[data-navf="on"]')?.checked !== false,
    }));
  }
  return out;
}


/** پیش‌نمایش زندهٔ آیکون/ایموجی + کشیدن و رها کردن ردیف‌های منو */
function wireNavManager(root) {
  root.querySelectorAll('[data-navrow]').forEach((row) => {
    const prev = row.querySelector('[data-navprev]');
    const sel = row.querySelector('[data-navf="icon"]');
    const emo = row.querySelector('[data-navf="emoji"]');
    const paint = () => {
      if (!prev) return;
      const e = String(emo?.value || '').trim();
      if (e) { prev.innerHTML = h`<span class="em">${e.slice(0, 6)}</span>`; return; }
      const name = String(sel?.value || '').trim().toLowerCase();
      // فقط نام آیکون‌های موجود در سایت رسم می‌شوند؛ در غیر این صورت آیکون پیش‌فرض
      prev.innerHTML = h`${icon(NAV_ICON_NAMES.includes(name) ? name : 'box')}`;
    };
    sel?.addEventListener('change', paint);
    sel?.addEventListener('input', paint);
    emo?.addEventListener('input', paint);
  });
  root.querySelectorAll('[data-navlist]').forEach((list) => {
    let dragged = null;
    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('[data-navrow]');
      if (!row) return;
      dragged = row;
      row.classList.add('dragging');
    });
    list.addEventListener('dragend', () => { dragged?.classList.remove('dragging'); dragged = null; });
    list.addEventListener('dragover', (e) => {
      if (!dragged) return;
      e.preventDefault();
      const over = e.target.closest?.('[data-navrow]');
      if (!over || over === dragged) return;
      const r = over.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) list.insertBefore(dragged, over);
      else list.insertBefore(dragged, over.nextSibling);
    });
  });
}

async function loadBackupsPanel(root) {
  const box = root.querySelector('[data-backups-panel]');
  if (!box) return;
  box.innerHTML = '<div class="sk sk-line w70"></div>';
  try {
    const r = await api.get('/api/admin/backups');
    box.innerHTML = h`
      <div class="card">
        <div class="row row-between row-wrap">
          <strong>${icon('download')} ${t('adm.sBackups')}</strong>
          <div class="row row-wrap">
            <a class="btn btn-ghost btn-sm" href="/api/admin/dump" download>${icon('download')} ${t('adm.dumpFull')}</a>
            <button type="button" class="btn btn-primary btn-sm" data-act="adm-backup-now">${icon('plus')} ${t('adm.backupNow')}</button>
          </div>
        </div>
        <p class="muted small mt-s">${t('adm.backupsHint', { hours: fmtNum(r.everyHours || 12), keep: fmtNum(r.keep || 14) })}</p>
        ${r.items?.length ? h`<div class="table-wrap mt-s"><table class="table">
          <thead><tr><th>${t('common.date')}</th><th>${t('adm.backupSize')}</th><th></th></tr></thead>
          <tbody>${r.items.map((b) => h`<tr>
            <td class="tiny">${fmtDate(b.at)}</td>
            <td class="tiny muted">${fmtNum(Math.round(b.bytes / 1024))} KB</td>
            <td><div class="row row-end">
              <a class="btn btn-ghost btn-sm" href="/api/admin/backups/${b.id}/download" download>${icon('download')} ${t('common.download')}</a>
              <button type="button" class="btn btn-danger btn-sm" data-act="adm-backup-restore" data-id="${b.id}">${icon('refresh')} ${t('adm.backupRestore')}</button>
            </div></td>
          </tr>`)}</tbody></table></div>` : h`<p class="muted small mt-s">${t('adm.backupsEmpty')}</p>`}
      </div>`;
  } catch (err) { box.innerHTML = h`<div class="notice notice-error">${icon('alert')} ${err?.message || t('err.generic')}</div>`; }
}

act('adm-backup-now', async (e, el) => {
  await withBusy(el, async () => {
    try {
      await api.post('/api/admin/backups', {});
      toastSuccess(t('adm.backupDone'));
      await loadBackupsPanel(document.querySelector('#view') || el.closest('#view')?.parentNode || document);
    } catch (err) { toastApiError(err); }
  });
});

act('adm-backup-restore', async (e, el) => {
  const ok = await confirmDialog({ text: t('adm.backupRestoreWarn'), danger: true });
  if (!ok) return;
  await withBusy(el, async () => {
    try { await api.post('/api/admin/backups/restore', { id: el.dataset.id }); toastSuccess(t('adm.backupRestored')); setTimeout(() => location.reload(), 900); }
    catch (err) { toastApiError(err); }
  });
});
