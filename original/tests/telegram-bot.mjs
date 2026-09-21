// ─────────────────────────────────────────────────────────────
//  تست‌های ربات تلگرام و اعلان سفارش
// ─────────────────────────────────────────────────────────────
import { db } from '../server/lib/db.mjs';
import { DEFAULT_SETTINGS } from '../server/defaults.mjs';
import {
  handleUpdate,
  tgNotifyOrder,
  ensureWebhook,
  tgWebhookState,
  tgSecret,
  startTelegramBot,
} from '../server/lib/telegram.mjs';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.error(`  ✘ ${name}${extra ? ` → ${extra}` : ''}`);
  }
}

console.log('\n═══ تست ربات تلگرام و اعلان سفارش ═══');

// Fake Telegram API calls
const sentMessages = [];
const webhookCalls = [];
const editedMessages = [];
const callbackAnswers = [];
// پاسخ getChatMember را می‌توان برای هر سناریو عوض کرد:
//   آبجکت = پاسخ تلگرام · null = پاسخ نامعتبر · 'throw' = خطای شبکه
let chatMemberResponse = { ok: true, result: { status: 'member' } };
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('/sendMessage')) {
    const body = JSON.parse(opts.body || '{}');
    sentMessages.push(body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: sentMessages.length } }),
    };
  }
  if (u.includes('/editMessageText')) {
    const body = JSON.parse(opts.body || '{}');
    editedMessages.push(body);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: body }) };
  }
  if (u.includes('/answerCallbackQuery')) {
    const body = JSON.parse(opts.body || '{}');
    callbackAnswers.push(body);
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  }
  if (u.includes('/setWebhook')) {
    const body = JSON.parse(opts.body || '{}');
    webhookCalls.push({ url: u, body });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, description: 'Webhook was set' }),
    };
  }
  if (u.includes('/getChatMember')) {
    if (chatMemberResponse === 'throw') throw new Error('network unreachable');
    return {
      ok: chatMemberResponse?.ok !== false,
      status: chatMemberResponse?.ok === false ? 400 : 200,
      json: async () => chatMemberResponse,
    };
  }
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};

// 1. عدم کرش «name is not defined» در handleUpdate
db.raw.settings = db.raw.settings || {};
db.raw.settings.telegram = {
  enabled: true,
  token: '123456:ABC-DEF',
  channel: '',
  welcome: 'خوش آمدید سفارشی به یاسایی',
  adminChats: '1001, 1002',
};

sentMessages.length = 0;
try {
  await handleUpdate({
    update_id: 101,
    message: {
      chat: { id: 99999, first_name: 'رضا' },
      from: { id: 99999, first_name: 'رضا', username: 'reza' },
      text: 'سلام چطوری؟',
    },
  });
  ok('رفع باگ کرش name is not defined در پیام متفرقه', true);
} catch (e) {
  ok('رفع باگ کرش name is not defined در پیام متفرقه', false, e.message);
}

// 2. پیام /start باید settings.telegram.welcome را بخواند
sentMessages.length = 0;
await handleUpdate({
  update_id: 102,
  message: {
    chat: { id: 99999, first_name: 'رضا' },
    from: { id: 99999, first_name: 'رضا' },
    text: '/start',
  },
});
const startReply = sentMessages.find((m) => m.chat_id === '99999');
ok('/start متن خوش‌آمد settings.telegram.welcome را می‌خواند', startReply?.text?.includes('خوش آمدید سفارشی به یاسایی'), JSON.stringify(startReply));

// 3. منوی دکمه‌ای شامل دکمه‌های لازم (مینی‌اپ، محصولات، دسته‌بندی‌ها، پیگیری سفارش، سوالات پرتکرار، تماس، تبلیغات)
const kb = startReply?.reply_markup?.keyboard || [];
const allButtons = kb.flat().map((b) => b.text);
ok('منوی دکمه‌ای شامل باز کردن مینی‌اپ', allButtons.some((b) => b.includes('مینی‌اپ')));
ok('منوی دکمه‌ای شامل محصولات', allButtons.includes('🛍 محصولات'));
ok('منوی دکمه‌ای شامل دسته‌بندی‌ها', allButtons.includes('🗂 دسته‌بندی‌ها'));
ok('منوی دکمه‌ای شامل پیگیری سفارش', allButtons.includes('📦 پیگیری سفارش'));
ok('منوی دکمه‌ای شامل سوالات پرتکرار', allButtons.includes('❓ سوالات پرتکرار'));
ok('منوی دکمه‌ای شامل تماس و پشتیبانی', allButtons.includes('📞 تماس و پشتیبانی'));
ok('منوی دکمه‌ای شامل تبلیغات', allButtons.includes('📢 تبلیغات در ربات'));

// 4. دکمهٔ سوالات پرتکرار (FAQ) اطلاعات تنظیمات را جواب دهد
sentMessages.length = 0;
await handleUpdate({
  update_id: 103,
  message: {
    chat: { id: 99999, first_name: 'رضا' },
    from: { id: 99999, first_name: 'رضا' },
    text: '❓ سوالات پرتکرار',
  },
});
const faqReply = sentMessages.find((m) => m.chat_id === '99999');
const faqText = faqReply?.text || '';
ok('پاسخ سوالات پرتکرار: زمان و هزینه ارسال', faqText.includes('هزینه و زمان ارسال'));
ok('پاسخ سوالات پرتکرار: ارسال رایگان', faqText.includes('ارسال رایگان'));
ok('پاسخ سوالات پرتکرار: روش‌های پرداخت', faqText.includes('روش‌های پرداخت') && faqText.includes('اقساطی'));
ok('پاسخ سوالات پرتکرار: مرجوعی ۷ روزه', faqText.includes('۷ روز'));
ok('پاسخ سوالات پرتکرار: آدرس و ساعت کاری', faqText.includes('آدرس فروشگاه حضوری') && faqText.includes('ساعت کاری'));

// 5. پیگیری سفارش بدون BM- هم کار کند
db.raw.orders = db.raw.orders || [];
db.raw.orders.push({
  id: 'ord_test_tg_1',
  code: 'BM-20260918-9999',
  status: 'confirmed',
  total: 450000,
  userName: 'تست پیگیری',
});
sentMessages.length = 0;
await handleUpdate({
  update_id: 104,
  message: {
    chat: { id: 99999, first_name: 'رضا' },
    from: { id: 99999, first_name: 'رضا' },
    text: '20260918-9999',
  },
});
const statusReply = sentMessages.find((m) => m.chat_id === '99999');
ok('پیگیری سفارش با کد ساده بدون پیشوند BM-', statusReply?.text?.includes('BM-20260918-9999') && statusReply?.text?.includes('تأییدشده'), JSON.stringify(statusReply));

// 6. تعویض توکن باعث setWebhook دوباره می‌شود (webhookState توکن را هم نگه می‌دارد)
webhookCalls.length = 0;
const ok1 = await ensureWebhook('1111:TOKEN_A');
ok('ست شدن وب‌هوک با توکن A', ok1 && webhookCalls.length === 1 && webhookCalls[0].url.includes('1111:TOKEN_A'));
const ok1Again = await ensureWebhook('1111:TOKEN_A');
ok('عدم فراخوانی تکراری وب‌هوک برای توکن یکسان', ok1Again && webhookCalls.length === 1);
const ok2 = await ensureWebhook('2222:TOKEN_B');
ok('تعویض توکن به توکن B باعث فراخوانی مجدد setWebhook شد', ok2 && webhookCalls.length === 2 && webhookCalls[1].url.includes('2222:TOKEN_B'));
ok('رمز وب‌هوک مشتق از توکن جدید است', webhookCalls[1].body.secret_token === tgSecret('2222:TOKEN_B'));

// 7. اعلان سفارش جدید (tgNotifyOrder)
sentMessages.length = 0;
db.raw.settings.telegram.adminChats = '7771, 7772';
const sampleOrder = {
  id: 'ord_sample_notif',
  code: 'BM-20260918-5555',
  userName: 'علی احمدی',
  userPhone: '09121112233',
  items: [{ name: 'کابل تایپ سی انکر', qty: 2 }],
  total: 360000,
  status: 'confirmed',
  delivery: 'courier',
};
await tgNotifyOrder(sampleOrder);
ok('اعلان سفارش به شناسهٔ چت اول مدیر ارسال شد', sentMessages.some((m) => m.chat_id === '7771' && m.text.includes('BM-20260918-5555')));
ok('اعلان سفارش به شناسهٔ چت دوم مدیر ارسال شد', sentMessages.some((m) => m.chat_id === '7772' && m.text.includes('علی احمدی')));
ok('متن اعلان شامل اقلام، مبلغ و وضعیت است', sentMessages[0]?.text?.includes('کابل تایپ سی انکر') && sentMessages[0]?.text?.includes('۳۶۰٬۰۰۰') && sentMessages[0]?.text?.includes('تأییدشده'));

// 8. اعلان سفارش در صورت خالی بودن adminChats کاملاً بی‌صداست
sentMessages.length = 0;
db.raw.settings.telegram.adminChats = '';
await tgNotifyOrder(sampleOrder);
ok('اعلان سفارش بدون تنظیم شناسهٔ چت کاملاً بی‌صداست', sentMessages.length === 0);

// 9. دکمهٔ «عضو شدم» در عضویت اجباری کانال تلگرام
chatMemberResponse = { ok: true, result: { status: 'member' } };
sentMessages.length = 0;
editedMessages.length = 0;
callbackAnswers.length = 0;
await handleUpdate({
  update_id: 105,
  callback_query: {
    id: 'cb_join_1',
    from: { id: 99999, first_name: 'رضا' },
    message: { message_id: 42, chat: { id: 99999, first_name: 'رضا' } },
    data: 'check_join',
  },
});
const joinAnswer = callbackAnswers.find((c) => c.callback_query_id === 'cb_join_1');
ok('«عضو شدم»: اعلان تایید عضویت به کاربر داده می‌شود',
  !!joinAnswer && String(joinAnswer.text || '').includes('عضویت شما در کانال تایید شد'), JSON.stringify(joinAnswer));
const joinEdit = editedMessages.find((e) => e.message_id === 42);
ok('«عضو شدم»: پیام قبلی با متن تایید ویرایش می‌شود',
  joinEdit?.text === '✅ عضویت شما در کانال تایید شد. خوش آمدید! ⚡', JSON.stringify(joinEdit));
ok('«عضو شدم»: کیبورد نامعتبر به editMessageText پاس داده نمی‌شود', !!joinEdit && !joinEdit.reply_markup);
const menuMsg = sentMessages.find((m) => String(m.chat_id) === '99999' && m.reply_markup?.keyboard?.length);
ok('«عضو شدم»: منوی اصلی در پیامی مجزا ارسال می‌شود', !!menuMsg, JSON.stringify(sentMessages).slice(0, 200));
const menuBtns = (menuMsg?.reply_markup?.keyboard || []).flat().map((b) => b.text);
ok('منوی ارسالی شامل مینی‌اپ و پیگیری سفارش است',
  menuBtns.some((b) => b.includes('مینی‌اپ')) && menuBtns.includes('📦 پیگیری سفارش'));

// 10. اگر ربات ادمین کانال نباشد یا خطا بگیرد، کاربر مسدود نشود
for (const [label, resp] of [
  ['ربات ادمین کانال نیست', { ok: false, error_code: 400, description: 'Bad Request: bot is not a member of the supergroup chat' }],
  ['پاسخ تلگرام نامعتبر است', null],
  ['خطای شبکه در بررسی عضویت رخ می‌دهد', 'throw'],
]) {
  chatMemberResponse = resp;
  sentMessages.length = 0;
  await handleUpdate({
    update_id: 106,
    message: { chat: { id: 99999, first_name: 'رضا' }, from: { id: 99999, first_name: 'رضا' }, text: '❓ سوالات پرتکرار' },
  });
  const reply = sentMessages.find((m) => String(m.chat_id) === '99999');
  ok(`عدم مسدودسازی کاربر وقتی ${label}`,
    !!reply && !String(reply.text || '').includes('عضویت اجباری'), String(reply?.text || '').slice(0, 80));
}

// 11. کاربر واقعاً عضو‌نشده همچنان پیام عضویت اجباری می‌گیرد
chatMemberResponse = { ok: true, result: { status: 'left' } };
sentMessages.length = 0;
await handleUpdate({
  update_id: 107,
  message: { chat: { id: 99999, first_name: 'رضا' }, from: { id: 99999, first_name: 'رضا' }, text: 'سلام' },
});
const forceJoin = sentMessages.find((m) => String(m.chat_id) === '99999');
ok('کاربر عضو‌نشده پیام عضویت اجباری و دکمهٔ «عضو شدم» می‌گیرد',
  !!forceJoin && String(forceJoin.text || '').includes('عضویت اجباری') &&
  (forceJoin.reply_markup?.inline_keyboard || []).flat().some((b) => b.callback_data === 'check_join'),
  JSON.stringify(forceJoin?.reply_markup || {}).slice(0, 200));

// 12. در حالت عضو‌نبودن، «عضو شدم» فقط هشدار می‌دهد (منو ارسال/ویرایش نمی‌شود)
sentMessages.length = 0;
editedMessages.length = 0;
callbackAnswers.length = 0;
await handleUpdate({
  update_id: 108,
  callback_query: { id: 'cb_join_2', from: { id: 99999 }, message: { message_id: 43, chat: { id: 99999 } }, data: 'check_join' },
});
const notYet = callbackAnswers.find((c) => c.callback_query_id === 'cb_join_2');
ok('«عضو شدم» در صورت عضو نبودن فقط هشدار می‌دهد',
  notYet?.text === 'هنوز در کانال عضو نشده‌اید!' && notYet?.show_alert === true &&
  sentMessages.length === 0 && editedMessages.length === 0,
  JSON.stringify({ notYet, sent: sentMessages.length, edited: editedMessages.length }));

// بازگرداندن حالت پیش‌فرض برای بقیهٔ تست‌ها
chatMemberResponse = { ok: true, result: { status: 'member' } };

// 13. پایداری تنظیمات تلگرام: بخش telegram باید در DEFAULT_SETTINGS باشد
ok('DEFAULT_SETTINGS.telegram با enabled: true تعریف شده است', DEFAULT_SETTINGS.telegram?.enabled === true);
ok('توکن پیش‌فرض تلگرام از BM_TG_TOKEN خوانده می‌شود (بدون راز هاردکد)',
  DEFAULT_SETTINGS.telegram?.token === (process.env.BM_TG_TOKEN || ''));

// 14. تیک فوری در بدو راه‌اندازی: بات نباید ۲۰ ثانیه برای اولین بررسی صبر کند
const savedEnv = {
  BM_TG: process.env.BM_TG,
  BM_TG_TOKEN: process.env.BM_TG_TOKEN,
  RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME,
};
delete process.env.BM_TG;
delete process.env.BM_TG_TOKEN;
delete process.env.RENDER_SERVICE_NAME;
webhookCalls.length = 0;
db.raw.settings.telegram.token = '3333:TOKEN_C';
startTelegramBot();
await new Promise((r) => setTimeout(r, 60));
ok('تیک فوری: وب‌هوک بلافاصله در بدو راه‌اندازی ست می‌شود',
  webhookCalls.some((c) => c.url.includes('3333:TOKEN_C')), JSON.stringify(webhookCalls.map((c) => c.url)));
for (const [k, v] of Object.entries(savedEnv)) {
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

console.log(`\n═══ نتیجه تست ربات تلگرام: ${pass} موفق · ${fail} ناموفق ═══\n`);
if (fail) process.exit(1);
