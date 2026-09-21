# راهنمای ساختار پروژه یاسایی (STRUCTURE.md)

این سند برای توسعه‌دهندگان بعدی نوشته شده تا بدون گم‌شدن در کد، بداند هر فایل کجاست،
سرور و فرانت‌اند چطور به هم وصل می‌شوند و برای هر تغییر رایج باید دست به کدام فایل بزند.

> **الکتریکی و قطعات الکترونیک یاسایی تهران** (نارمک، هفت‌حوض) — سرور Node.js **بدون هیچ وابستگی
> خارجی در زمان اجرا** (فقط `esbuild` برای بیلد و `jsdom` برای تست‌ها) + یک SPA وانیلا با مسیریاب هش‌محور.
> نسخهٔ رسمی فعلی: `v1.0.0` (تگ GitHub Release) با تگ ساخت `ys-v138` — تاریخ رسمی: **شهریور ۱۴۰۵ هجری شمسی (1405 SH)**.

---

## ۱) نمای کلی

```
yassaei-electronics/
├── server/               ← بک‌اند (Node خالص، ESM، بدون فریم‌ورک)
│   ├── main.mjs          ← نقطهٔ ورود: createServer + ترتیب میدلورها + استاتیک + SPA fallback
│   ├── api-catalog.mjs   ← API عمومی: bootstrap، محصولات، جست‌وجو، دسته‌ها، برندها
│   ├── api-auth.mjs      ← API احراز هویت: ورود/ثبت‌نام OTP، نشست، CSRF، پروفایل (/api/me)
│   ├── api-shop.mjs      ← API خرید: سبد، سفارش، پرداخت، کیف پول، تیکت، نظرات
│   ├── api-admin.mjs     ← API مدیریت: تنظیمات، محصولات، سفارش‌ها، کاربران، بکاپ، بات تلگرام
│   ├── defaults.mjs      ← DEFAULT_SETTINGS و DEFAULT_PAGES (مقادیر اولیهٔ تنظیمات و محتوا)
│   ├── seed.mjs          ← دادهٔ اولیه (دسته‌ها، برندها، محصولات نمونه)
│   ├── art.mjs           ← تولید تصویر SVG برای کالاها/هیرو
│   ├── ig-products.mjs   ← همگام‌سازی محصولات از اینستاگرام
│   └── lib/              ← زیرساخت (جدول پایین)
├── public/               ← فرانت‌اند (SPA وانیلا) + استاتیک‌ها
│   ├── index.html        ← اسکلت سایت: هدر، فوتر، نوار موبایل، اسپرایت آیکون‌ها
│   ├── css/app.css       ← تمام استایل‌ها (متغیرهای CSS پوسته در ':root' و '[data-theme=…]')
│   ├── bundle/main.js    ← خروجی esbuild (تولیدشده با npm run build — دستی ویرایش نکنید)
│   ├── js/               ← سورس SPA (جدول پایین)
│   ├── assets/img/       ← لوگوها، نشان‌ها، برندها، تصاویر محصولات
│   ├── assets/fonts/     ← فونت Vazirmatn (woff2)
│   ├── assets/docs/      ← اسناد عمومی (مثل فرم KYC)
│   └── sw.js             ← سرویس‌ورکر PWA (پیش‌کش با tools/gen-sw-precache.mjs)
├── data/                 ← دیتابیس JSON زنده (db.json) و بکاپ‌ها — در گیت قرار نگیرد جز seed اولیه
├── tests/                ← تست‌های بدون وابستگی (node tests/xxx.mjs) — ۲۳ سوئیت در verify
├── tools/                ← اسکریپت‌های کمکی:
│   ├── standalone-build.mjs  ← ساخت yassaei-offline.html (نسخهٔ تک‌فایلی آفلاین)
│   ├── standalone/api-browser.mjs ← شیم API نسخهٔ آفلاین (به‌جای lib/api.mjs)
│   ├── offline-seed.mjs      ← پاک‌سازی بذر آفلاین (حذف راز/داده شخصی)
│   ├── secret-scan.mjs       ← جاروب رازها در فایل‌های عمومی
│   ├── gen-sw-precache.mjs   ← تولید فهرست پیش‌کش سرویس‌ورکر
│   ├── bump-build.mjs        ← همگام‌سازی تگ BUILD در ۵ نقطه + بازسازی باندل/آفلاین
│   └── unban-owner.mjs       ← 🧯 ابزار نجات مالک: رفع بن اضطراری (node tools/unban-owner.mjs <phone_or_username>)
├── render.yaml           ← تنظیمات استقرار روی Render
├── package.json          ← اسکریپت‌ها: start / build / verify / test / bump
├── yassaei-offline.html  ← نسخهٔ تک‌فایلی آفلاین (خروجی build — در Release رسمی ضمیمه)
└── STRUCTURE.md          ← همین فایل
```

---

## ۲) سمت سرور (`server/`)

### ترتیب اجرای درخواست در `main.mjs` (مهم — دست نزنید):
`بن IP → سنجهٔ بار → محدودساز نرخ → CSRF → نشست → اتاق انتظار (queue) → مسیریاب API → فایل استاتیک → SPA fallback`

### ماژول‌های `server/lib/`

| فایل | مسئولیت |
|---|---|
| `db.mjs` | ذخیره‌ساز JSON اتمیک (`data/db.json`) + تراکنش سریال `db.tx()` + ذخیرهٔ خودکار |
| `http.mjs` | لایهٔ HTTP: gzip، کوکی، هدرهای امنیتی، سرو استاتیک امن |
| `auth.mjs` | رمز scrypt، نشست کوکی‌محور، CSRF، TOTP دومرحله‌ای |
| `router.mjs` | مسیریاب سبک با الگوی `:param` — `router.get/post/patch/delete` |
| `util.mjs` | اعتبارسنجی ورودی `V` (str/int/num/bool/oneOf/arr…)، `HttpError`، محدودساز نرخ |
| `queue.mjs` | اتاق انتظار ضد-DDoS با گذرنامهٔ HMAC (در تست با `BM_QUEUE=off` خاموش می‌شود) |
| `telegram.mjs` | بات پشتیبانی تلگرام: وب‌هوک + فال‌بک long-polling، عضویت اجباری کانال، منوی اصلی |
| `backup.mjs` | پشتیبان‌گیری/بازیابی خودکار و دستی |
| `mail.mjs` / `sms.mjs` / `captcha.mjs` | ارسال ایمیل/پیامک و کپچا |
| `helpers.mjs` | آمار عمومی، اعلان‌ها، heartbeat |

### جریان داده

- همهٔ داده‌ها در **یک فایل JSON** (`db.json`) است؛ خواندن با `db.raw` و نوشتن **همیشه** با
  `db.tx((st) => { … })` تا اتمیک بماند.
- تنظیمات در `st.settings` به تفکیک بخش ذخیره می‌شود: `store`, `theme`, `ui`, `features`,
  `shipping`, `salesTools`, `plus`, `orders`, `seo`, `currency`, `auth`, `contact`, `partners`,
  `telegram`, `layout`, `nav`, `notifications`, `media`, `careers`, `oldPrice`, `adminNav`, …
- مقادیر پیش‌فرض از `server/defaults.mjs` (`DEFAULT_SETTINGS`) می‌آید؛ پس از اولین ذخیره،
  تنظیمات در `db.json` می‌ماند و **بین دیپلوی‌ها پایدار است** (مثل توکن بات تلگرام).

### افزودن اندپوینت جدید

1. حوزهٔ API را پیدا کن (`api-catalog` عمومی، `api-shop` کاربر لاگین‌شده، `api-admin` مدیریت).
2. با الگوی موجود ثبتش کن:
   `A('PATCH', '/api/admin/settings/:section', 'settings.edit', async (ctx) => { … })`
   (آرگومان سوم مجوز لازم از `PERMISSIONS` است.)
3. ورودی‌ها را **حتماً** با `V.*` اعتبارسنجی کن و خطا را با `badRequest()/notFound()/…` بده.

> برای تنظیمات: هر فیلد تازه باید در `sanitizeSection()` (انتهای `api-admin.mjs`)
> اعتبارسنجی و در `DEFAULT_SETTINGS` (اگر مقدار اولیه لازم است) تعریف شود؛
> در صورت عمومی‌بودن، از `/api/bootstrap` به کلاینت هم می‌رسد.

---

## ۳) سمت فرانت‌اند (`public/js/`)

| فایل | مسئولیت |
|---|---|
| `main.mjs` | نقطهٔ ورود SPA: `init()`، اسکلت سایت (`renderChrome/renderFooter/renderNav`)، جست‌وجو، پالت فرمان، کنترل‌های ثابت |
| `state.mjs` | وضعیت سراسری `S`، بوت‌استرپ از `/api/bootstrap`، اعمال پوسته و ترجیحات (`applyPrefs`)، سبد/علاقه‌مندی |
| `router.mjs` | مسیریاب **هش‌محور**؛ جدول `routes` با بارگذاری تنبل نماها + گاردهای `auth/admin/perm/feature` |
| `actions.mjs` | ثبت یک‌جای هندلرهای `data-act` (کلیک/submit) با `act('name', fn)` |
| `ui.mjs` | توست، مودال، دراور، دیالوگ تأیید، نوار بارگذاری |
| `i18n.mjs` | دیکشنری فارسی/انگلیسی + `t()` و `applyI18n()` |
| `components.mjs` | اجزای مشترک: `field`, `switchField`, `bannerHtml`, … |
| `lib/sales.mjs` | 🧰 ابزار فروش سمت کلاینت: واتساپ (`whatsappLink`)، پیش‌فاکتور (`proformaNumber`)، کارت/شبا، نوار ارسال رایگان، تاریخ شمسی |
| `lib/anti-inspect.mjs` | 🛡️ محافظت سمت کاربر: بستن کلیک راست (به‌جز فیلدهای ورودی)، مسدودسازی میان‌برهای DevTools، هشدار امنیتی کنسول (`SECURITY_WARNING_FA`)، `draggable="false"` روی تصاویر — با `initAntiInspect()` از `main.mjs` و همگام با رویداد `settings` |
| `chat.mjs`, `map.mjs` | چت پشتیبانی (مشتری↔تیم) و نقشه |
| `lib/api.mjs` | کلاینت fetch با CSRF، تلاش مجدد و صف انتظار |
| `lib/dom.mjs` | تگ‌کمک‌های امن: `html` (هربخشی خودکار escape)، `esc`, `qs`, `icon`, … |
| `views/*.mjs` | هر صفحه یک ماژول با `render(ctx)` و اختیاری `mount(ctx)`/`title`/`metaDesc` |
| `views/careers.mjs` | 🧑‍💼 صفحهٔ عمومی فرصت‌های شغلی + فرم درخواست استخدام |
| `views/invoice-print.mjs` | چاپگر مستقل فاکتور/پیش‌فاکتور (لایهٔ جدا از SPA) |
| `views/admin/*.mjs` | صفحات پنل مدیریت (تنظیمات: `views/admin/settings.mjs` — schema-driven) |
| `views/admin/layout.mjs` | 🎛️ مدیر چیدمان: Drag&Drop بخش‌های خانه + مخفی‌سازی + ویرایشگر منوهای پنل/کاربری/موبایل |
| `views/admin/chat.mjs` | 💬 چت داخلی تیم (فقط owner/staff) با SSE، mention و ارجاع `#order/#product/#ticket/#user` |
| `views/admin/careers.mjs` | مدیریت فرصت‌های شغلی و درخواست‌های استخدام |

### چرخهٔ رندر

1. `main.mjs → init()`: بوت (`state.boot()`) → `renderChrome()` (اسکلت هدر/فوتر) → `initRouter()`.
2. `router.start()`: هش (`#/products?q=…`) را تجزیه می‌کند، از جدول `routes` مسیر را می‌یابد،
   گارد را چک می‌کند و نمای تنبل را بار می‌کند.
3. نمای بارگیری‌شده `render(ctx)` → HTML برمی‌گرداند → روتر داخل `#viewInner` می‌گذارد →
   `mount()` برای سیم‌کشی‌های خاص صفحه صدا زده می‌شود.
4. تغییر تنظیمات سراسری با رویداد `on('settings', …)` → `applyPrefs() + renderChrome()`.

### افزودن صفحه جدید

1. فایل `public/js/views/my-page.mjs` با `export async function render(ctx)` بساز.
2. در جدول `routes` در `router.mjs` ثبتش کن:
   `{ pattern: '/my-page', load: () => import('./views/my-page.mjs'), title: () => t('nav.myPage') }`.
3. کلیدهای ترجمهٔ تازه را در هر دو زبانِ `i18n.mjs` اضافه کن.

### اتصال سرور و فرانت‌اند

- فرانت همه‌چیز را از **`GET /api/bootstrap`** می‌گیرد: `settings` (شامل `store`, `theme`, `ui`, `features`, …)،
  دسته‌ها، برندها، کاربر جاری، تبلیغات و تیکر. پس هر فیلد تازهٔ تنظیمات که در `sanitizeSection`
  ذخیره و در `bootstrap` منتشر شود، بدون تغییر فرانت‌اندهای دیگر در دسترس است.
- تغییرات تنظیمات از پنل: `PATCH /api/admin/settings/:section` → `refreshBootstrap()` →
  رویداد `settings` → `applyPrefs()` (پوسته) و `renderChrome()` (هدر/فوتر) دوباره رندر می‌شوند.
- پنل تنظیمات (settings.mjs) **schema-driven** است: فیلدها از `FIELDS.{section}` ساخته می‌شوند؛
  برای فیلد تازه فقط یک آیتم به `FIELDS` اضافه کنید (+ اعتبارسنجی سرور).

### لوگوها و پوسته

- **لوگوی سربرگ**: `settings.store.logo` — اگر ست شده باشد `<img>` وگرنه SVG درون‌خطی پیش‌فرض
  (رنگش با متغیرهای پوسته همگام است). منطق در `renderChrome()` در `main.mjs`.
- **لوگوی پانویس**: `settings.store.footerLogo` — پیش‌فرض نشان باکیفیت
  `public/assets/img/yassaei-poster-badge.svg`. منطق در `renderFooter()` + `#fLogoBox` در `index.html`.
- **رنگ‌های پوسته**: `settings.theme.accent` (اصلی)، `accent2` (رنگ دوم) و `bgColor` (پس‌زمینه).
  `applyPrefs()` در `state.mjs` این‌ها را روی متغیرهای CSS `--accent*` و `--bg` می‌گذارد؛
  پیش‌نمایش زندهٔ پنل مدیریت هم همان متغیرها را موقتاً بازنویسی می‌کند و با خروج از نما
  (`cleanup` → `applyPrefs()`) به مقدار ذخیره‌شده برمی‌گردد.

### ربات تلگرام (`server/lib/telegram.mjs`)

- توکن به این ترتیب خوانده می‌شود: متغیر محیطی `BM_TG_TOKEN` ← `settings.telegram.token`
  (تابع `tgWithEnv`)؛ پس توکن بین دیپلوی‌ها از دست نمی‌رود و در پنل همیشه دیده می‌شود.
- دکمهٔ «عضو شدم» (`check_join`): اول `tgAnswerCallbackQuery` با متن تأیید، بعد ویرایش پیام،
  و در پایان پیام مجزا همراه `getMainMenu()` تا کیبورد دکمه‌های ربات باز شود.
- بررسی عضویت (`checkMembership`) اگر ربات به کانال دسترسی ادمینی نداشته باشد یا خطا رخ دهد،
  **کاربر را پشت در نگه نمی‌دارد** (برمی‌گرداند `true`) تا کل بات قفل نشود.

---

## ۳٫۵) نقشهٔ قابلیت‌های کلیدی (کجا هر چیزی زندگی می‌کند)

| قابلیت | سرور | فرانت | تنظیمات/کلید |
|---|---|---|---|
| **سقف خرید غلتان هوشمند** (فقط خریدهای موفقِ ۴۸ ساعت شمارش؛ محرومیت دائم ندارد) | `api-shop.mjs`: `rollingCeilingCfg` / `rollingPastSpent` / `ceilingStatus` / `enforceRollingCeiling` + سقف روزانهٔ اثرانگشتی `enforceOrderCeiling` | `views/checkout.mjs` و `views/cart.mjs` (پیام سهمیهٔ باقی‌مانده) | `settings.orders`: `orderCeilingEnabled/Amount/Hours` + `orderMaxCeilingEnabled/orderMaxAmount` — پنل ← تنظیمات ← سفارش و پرداخت؛ تست `tests/order-ceiling.mjs` |
| **واتساپ (مشاوره + فیش پرداخت)** | — | `lib/sales.mjs`: `whatsappNumber/whatsappLink` (اولویت: شمارهٔ اختصاصی ← واتساپ فروشگاه ← socials ← phone2 ← phone)؛ دکمه در `views/product` و `views/pay.mjs` | `settings.salesTools.whatsappConsultEnabled` + `whatsappPhone` — پنل ← تنظیمات ← ابزارهای فروش؛ تست `tests/sales-tools.mjs` |
| **پیش‌فاکتور رسمی (Proforma)** | تأیید/ذخیره در همان مسیرهای سبد و فاکتور | `lib/sales.mjs: proformaNumber()` → `PF-۱۴۰۵۰۶۲۸-XXXXX` (تاریخ شمسی + دنبالهٔ یکتا) + `views/invoice-print.mjs` برای چاپ | `settings.salesTools.proformaInvoiceEnabled` (دکمهٔ سبد خرید) |
| **استخدام (Careers)** | `api-catalog.mjs`: `GET /api/careers`، `POST /api/careers/:id/apply` (ضدتکرار، rate-limit، رزومه فقط `/uploads/`)؛ `api-admin.mjs`: CRUD فرصت‌ها + وضعیت درخواست‌ها + اعلان به تیم | `views/careers.mjs` عمومی + `views/admin/careers.mjs` | `settings.features.careers` + `settings.careers.navShowInNav`؛ تست `tests/careers.mjs` |
| **چت داخلی تیم** | `api-admin.mjs`: `GET/POST /api/admin/chat` (فقط owner/staff؛ پیوست محدود به `/uploads/`؛ سقف ۱۰۰۰ پیام) + استریم SSE | `views/admin/chat.mjs` (mention، پیل ارجاع، زندهٔ SSE) | `settings.features.adminChat`؛ تست `tests/admin-chat.mjs` |
| **مدیر چیدمان ادمین (Layout Manager)** | `api-admin.mjs → sanitizeSection('layout')` (ذخیره در `settings.layout`) | `views/admin/layout.mjs`: Drag&Drop ترتیب `layout.homeOrder` + `layout.homeHidden` برای ۱۹ بخش خانه (هیرو، شگفت‌انگیز، دست‌دوم، چرا ما، آمار زنده، بنر پلاس، خرید دست‌دوم، نقشهٔ فروشگاه …) + تب «مدیریت منوهای پنل» (`#/admin/layout/adminNav` با `lib/admin-nav.mjs`) | `settings.layout`، `settings.adminNav` |
| **بازیابی اضطراری بن مالک** | `tools/unban-owner.mjs`: پاک‌کردن بن‌های منسوب به شناسه‌های مالک (کاربر/IP/توکن بازدید) + بازگرداندن `role=owner/status=active` + `logAudit('owner.emergency_unban')` — بدون حذف هیچ داده‌ای | — | اجرا از خط فرمان: `node tools/unban-owner.mjs <phone_or_username>` |
| **محافظت در برابر Inspect و برداشت کد** | `api-admin.mjs → sanitizeSection('security')` کلید `antiInspectEnabled` (bool، پیش‌فرض `true`) · `api-catalog.mjs: /api/bootstrap` فقط `{ security: { antiInspectEnabled } }` را عمومی می‌کند (پارامترهای صف/نرخ لو نمی‌رود) | `lib/anti-inspect.mjs` (`initAntiInspect`/`refreshAntiInspect`) + فراخوانی در `main.mjs` و اشتراک رویداد `settings`؛ تب پنل در `views/admin/settings.mjs` (`#/admin/settings/security`) | `settings.security.antiInspectEnabled` + همان فیلدهای صف (`queueEnabled/maxConcurrent/triggerRps/passTtlMin/pollSec/floodBanPerMin/floodBanMin`) — تست `tests/anti-inspect.mjs` |

> قانون «پیش‌فرض روشن» در ابزار فروش: کلیدهای `*Enabled` با `!== false` خوانده می‌شوند تا
> بذرهای قدیمی بدون کلید، قابلیت را خاموش نکنند (بدون رگرسیون). نسخهٔ آفلاین هم همین منطق
> را دارد: `tools/standalone/api-browser.mjs` همان `settings.salesTools` را از `localStorage` می‌خواند.

---

## ۴) داده و استقرار

- **دیتابیس**: `data/db.json` (در Render روی دیسک پایدار یا از طریق بکاپ‌های `/api/admin/dump`).
  مسیر با `BM_DATA_DIR` و آپلودها با `BM_UPLOAD_DIR` قابل جابه‌جایی است.
- **متغیرهای محیطی مهم**: `PORT`, `HOST`, `BM_TG_TOKEN` (توکن بات), `BM_DATA_DIR`, `BM_UPLOAD_DIR`,
  `BM_QUEUE=off` و `BM_RATE_SCALE` (برای تست).
- **استقرار**: `render.yaml` → دستور `npm start` = `npm run build && node server/main.mjs`
  (پس هر تغییر فرانت‌اند در استقرار خودکار باندل می‌شود؛ با این حال `public/bundle/main.js`
  کامیت می‌شود تا verify همگامی باندل/سورس را کنترل کند).

## ۵) بیلد و تست‌ها

```bash
npm run build     # باندل esbuild از public/js/main.mjs → public/bundle/main.js
npm run verify    # سرور آزمایشی موقت + همهٔ سوئیت‌ها + اسکن رازها؛ «همه‌چیز سبز؟» با یک دستور
npm test          # فقط tests/api.mjs
```

سوئیت‌های `verify` (فهرست کامل در `tests/verify.mjs`): `api`, `endpoints`, `http-smoke`,
`telegram-bot`, `bughunt`, `races`, `exports`, `kyc`, `sales-tools`, `careers`, `old-price`,
`admin-chat`, `admin-navigation`, `low-stock`, `admin-nav-ui`, `anti-inspect`, `order-ceiling`,
`sleep-ui`, `client-parse`, `render-admin`, `render-store`, `offline-views3`, `standalone-smoke`
به‌علاوهٔ جاروب رازها (`tools/secret-scan.mjs`). سوئیت‌های نیازمند مرورگر/محیط در سرور CI
با پرچم `false` «اختیاری» علامت خورده‌اند و در صورت نبود شرایط skip سبز می‌شوند.
نسخهٔ آفلاین هم با `node tools/standalone-build.mjs` بازسازی و با `tests/standalone-smoke.mjs`
دودکش می‌شود؛ تگ نسخه با `npm run bump` در ۵ نقطه همگام می‌شود.

- تست‌ها Node خالص‌اند (`node tests/xxx.mjs`) و با `BASE=http://…` روی سرور در حال اجرا هم می‌چرخند.
- ⚠️ بعد از هر تغییر در `public/js/**` حتماً `npm run build` بزنید؛ وگرنه `verify` عدم‌همگامی
  باندل را گزارش می‌کند.

## ۶) قراردادهای کدنویسی

- ماژول‌های ESM با پسوند `.mjs`؛ کامنت‌گذاری فارسی بالای هر بخش با جداکنندهٔ `──`.
- در فرانت‌اند هرگز HTML با رشتهٔ خام به DOM ندهید؛ از `html` (تگ‌د تمپلیت امن `lib/dom.mjs`)
  یا `esc()` استفاده کنید.
- رویدادهای دکمه‌ها با `data-act` + `act()` در `actions.mjs` ثبت می‌شوند، نه `addEventListener` پراکنده.
- متن‌های دوزبانه با الگوی `L('فارسی', 'English')` یا کلید `i18n`.
- در سرور، هر ورودی کاربر با `V.*` اعتبارسنجی می‌شود؛ خطاها `HttpError` با کد و پیام فارسی.
