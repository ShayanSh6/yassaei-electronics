// ─────────────────────────────────────────────────────────────
//  races: تست‌های شرایط رقابتی (فروش هم‌زمان، کیف پول هم‌زمان، کوپن سقف-۱)
// ─────────────────────────────────────────────────────────────
import {
  makeClient,
  login,
  ensureDemoAccounts,
  DEMO_PASSWORD,
} from './lib/demo.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ [${pass}] ${name}`);
  } else {
    fail++;
    console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`);
  }
}

console.log(`\n═══ races: تست‌های شرایط رقابتی و هم‌زمانی · ${BASE} ═══\n`);

await ensureDemoAccounts(BASE);
const admin = makeClient(BASE);
await admin.get('/api/bootstrap');
await login(admin, 'admin', 'Yassaei@1404').catch(async () => {
  await login(admin, 'admin', 'Demo@1404');
});
await admin.patch('/api/admin/settings/features', { captcha: false });

// 1. فروش هم‌زمان (کالای با موجودی تک ۱ عددی)
console.log('▌ ۱) فروش هم‌زمان کالای تک‌موجودی');
const newProd = await admin.post('/api/admin/products', {
  name: 'کالای تست رقابتی ' + Date.now(),
  price: 20000,
  cost: 15000,
  stock: 1,
  active: true,
});
const racePid = newProd.json?.product?.id;

const buyers = [];
for (let i = 0; i < 4; i++) {
  const c = makeClient(BASE);
  await c.get('/api/bootstrap');
  const uname = `rc_${Date.now().toString().slice(-6)}_${i}`;
  await c.post('/api/auth/register', {
    mode: 'username',
    username: uname,
    name: 'خریدار رقابتی ' + i,
    password: 'Race@12345',
    acceptTerms: true,
  });
  await c.post('/api/cart/add', { productId: racePid, qty: 1 });
  buyers.push(c);
}

const raceResults = await Promise.all(
  buyers.map((b) =>
    b.post('/api/checkout', {
      delivery: 'pickup',
      paymentMethod: 'gateway',
      acceptTerms: true,
    })
  )
);
const successes = raceResults.filter((r) => r.status === 200);
const stockFails = raceResults.filter((r) => r.status === 409);
ok(
  'فقط یک درخواست در رقابت هم‌زمان روی موجودی ۱ موفق شد',
  successes.length === 1 && stockFails.length === buyers.length - 1,
  `موفق: ${successes.length}، ناموفق: ${stockFails.length}`
);

// 2. کیف پول هم‌زمان (عدم اجازهٔ اضافه برداشت در تراکنش‌های موازی)
console.log('\n▌ ۲) کیف پول هم‌زمان');
const walletUser = makeClient(BASE);
await walletUser.get('/api/bootstrap');
const wUname = `w_${Date.now().toString().slice(-6)}`;
const regW = await walletUser.post('/api/auth/register', {
  mode: 'username',
  username: wUname,
  name: 'کاربر کیف پول',
  password: 'Wallet@12345',
  acceptTerms: true,
});
const wUserId = regW.json?.me?.id;

// شارژ کیف پول دقیقا به اندازه ۱ سفارش (20,000 تومان) از طریق PATCH /api/admin/users/:id
await admin.patch(`/api/admin/users/${wUserId}`, {
  walletAdjust: 20000,
  walletReason: 'شارژ آزمایشی رقابتی',
});

// ایجاد کالایی با موجودی کافی
const pWallet = await admin.post('/api/admin/products', {
  name: 'کالای خرید کیف پول ' + Date.now(),
  price: 20000,
  cost: 15000,
  stock: 10,
  active: true,
});
const pWalletId = pWallet.json?.product?.id;

// ۲ کلاینت با همان سشن کیف پول یا ۲ فراخوانی موازی روی سبد یکسان
await walletUser.post('/api/cart/add', { productId: pWalletId, qty: 1 });

const walletReqs = await Promise.all([
  walletUser.post('/api/checkout', {
    delivery: 'pickup',
    paymentMethod: 'wallet',
    useWallet: true,
    acceptTerms: true,
  }),
  walletUser.post('/api/checkout', {
    delivery: 'pickup',
    paymentMethod: 'wallet',
    useWallet: true,
    acceptTerms: true,
  }),
]);

const wSuccess = walletReqs.filter((r) => r.status === 200);
ok(
  'کیف پول هم‌زمان: فقط یک پرداخت از موجودی کسر شد و اضافه برداشت رخ نداد',
  wSuccess.length === 1,
  `موفق: ${wSuccess.length}، وضعیت‌ها: ${walletReqs.map((r) => r.status).join(',')}`
);

// 3. کوپن سقف-۱ هم‌زمان (usageLimit = 1)
console.log('\n▌ ۳) کوپن سقف-۱ هم‌زمان');
const raceCouponCode = 'RACE_CP_' + Math.floor(Math.random() * 10000);
await admin.post('/api/admin/coupons', {
  code: raceCouponCode,
  type: 'amount',
  value: 5000,
  minOrder: 10000,
  usageLimit: 1,
  perUser: 1,
  active: true,
  startAt: new Date(Date.now() - 60000).toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
});

const cpBuyers = buyers.slice(0, 3);
for (const b of cpBuyers) {
  await b.post('/api/cart/clear');
  await b.post('/api/cart/add', { productId: pWalletId, qty: 1 });
  await b.post('/api/cart/coupon', { code: raceCouponCode });
}

const cpRaceResults = await Promise.all(
  cpBuyers.map((b) =>
    b.post('/api/checkout', {
      delivery: 'pickup',
      paymentMethod: 'gateway',
      acceptTerms: true,
    })
  )
);

const cpSuccess = cpRaceResults.filter((r) => r.status === 200);
ok(
  'کوپن سقف-۱ هم‌زمان: فقط ۱ کاربر توانست از کوپن با سقف کلی ۱ استفاده کند',
  cpSuccess.length === 1,
  `موفق: ${cpSuccess.length} [${cpRaceResults.map((r) => r.status).join(',')}]`
);

console.log(`\n═══ نتیجه races: ${pass} موفق · ${fail} ناموفق ═══\n`);

try {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.join(process.cwd(), 'public/assets/img/products');
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('p12') || f.startsWith('p13')) {
      fs.unlinkSync(path.join(dir, f));
    }
  }
} catch { /* noop */ }

if (fail) process.exit(1);
