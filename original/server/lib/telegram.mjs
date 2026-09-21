// ─────────────────────────────────────────────────────────────
//  بات پشتیبانی تلگرام — حالت وب‌هوک (اولویت) با فال‌بک long-polling
//  توکن: BM_TG_TOKEN، settings.integrations.telegram.botToken یا settings.telegram.token
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import { db, logAudit } from './db.mjs';

const CANON = 'https://yassaei-electronics.onrender.com';
export const TG_WEBHOOK_PATH = '/api/tg/webhook';
/**
 * توکن ربات: اول متغیر محیطی BM_TG_TOKEN، بعد settings.integrations.telegram.botToken
 * و در نهایت مسیر قدیمی settings.telegram.token؛ بنابراین استقرارهای قدیمی هم سازگار می‌مانند.
 */
export function tgWithEnv(tg) {
  const env = String(process.env.BM_TG_TOKEN || '').trim();
  const integrated = db.raw?.settings?.integrations?.telegram || {};
  const token = env || String(integrated.botToken || '').trim() || String(tg?.token || '').trim();
  const enabled = env ? true : (integrated.enabled !== undefined ? !!integrated.enabled : !!tg?.enabled);
  return { ...(tg || {}), ...integrated, token, enabled };
}

export const tgSecret = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex').slice(0, 24);
let webhookState = { url: '', token: '', ok: false, err: '' };
export const tgWebhookState = () => ({ ...webhookState });

const API = (token) => `https://api.telegram.org/bot${token}`;
let polling = false;
let currentToken = '';
let loopSeq = 0;
let activeLoop = 0;

export function telegramEnabled() {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  return !!(tg?.enabled && tg?.token);
}

export async function tgSend(chatId, text, extra = {}) {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.token) throw new Error('telegram token missing');
  
  const payload = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };
  const r = await fetch(`${API(tg.token)}/sendMessage`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j?.description || 'telegram send failed');
  return j;
}

export async function tgPing() {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.token) throw new Error('telegram token missing');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${API(tg.token)}/getMe`, { signal: controller.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j?.description || 'telegram ping failed');
    return j;
  } finally { clearTimeout(timer); }
}

export async function tgSendPhoto(chatId, photoUrl, caption = '', extra = {}) {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.token) throw new Error('telegram token missing');

  const payload = { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...extra };
  const r = await fetch(`${API(tg.token)}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j?.description || 'telegram sendPhoto failed');
  return j;
}

export async function tgEditMessageText(chatId, messageId, text, extra = {}) {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.token) return;
  // تلگرام در editMessageText فقط «کیبورد اینلاین» را می‌پذیرد؛ اگر کیبورد معمولی
  // (مثل منوی اصلی) پاس داده شود، پاسخ Bad Request می‌گیرد. پس کیبورد نامعتبر را
  // قبل از ارسال حذف می‌کنیم تا پیام بدون خطا ویرایش شود.
  const safeExtra = { ...extra };
  if (safeExtra.reply_markup && !safeExtra.reply_markup.inline_keyboard) delete safeExtra.reply_markup;
  const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...safeExtra };
  await fetch(`${API(tg.token)}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function tgAnswerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.token) return;
  await fetch(`${API(tg.token)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
  });
}

export async function tgBroadcast(text) {
  const subs = db.raw.telegramSubs || {};
  let ok = 0; let fail = 0;
  for (const chatId of Object.keys(subs)) {
    try { 
      await tgSend(chatId, text); 
      ok++; 
      // Anti-Spam: Telegram limits bots to 30 msgs/sec globally. We sleep 50ms (~20/sec)
      await new Promise(r => setTimeout(r, 50));
    } catch (e) { 
      fail++; 
      // Protect Bot Health: If user blocked the bot, remove them immediately to prevent Telegram Spam penalties
      const errStr = String(e?.message || '').toLowerCase();
      if (errStr.includes('blocked') || errStr.includes('chat not found') || errStr.includes('deleted') || errStr.includes('deactivated')) {
        delete db.raw.telegramSubs[chatId];
      }
    }
  }
  return { ok, fail, total: Object.keys(subs).length };
}

const escT = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '🌐 باز کردن فروشگاه (مینی‌اپ)', web_app: { url: CANON } }],
        [{ text: '🛍 محصولات' }, { text: '🗂 دسته‌بندی‌ها' }],
        [{ text: '📦 پیگیری سفارش' }, { text: '❓ سوالات پرتکرار' }],
        [{ text: '📞 تماس و پشتیبانی' }, { text: '📢 تبلیغات در ربات' }]
      ],
      resize_keyboard: true
    }
  };
}

function answerFaq() {
  const st = db.raw;
  const s = st.settings || {};
  const ship = s.shipping || {};
  const store = s.store || {};
  
  const zonesText = (ship.zones || []).map((z) => `• ${z.name}: ${Number(z.fee || 0).toLocaleString('fa-IR')} تومان (${z.eta})`).join('\n');
  const freeOverText = ship.freeOver ? `ارسال رایگان برای خریدهای بالای ${Number(ship.freeOver).toLocaleString('fa-IR')} تومان به سراسر کشور.` : 'ارسال رایگان در جشنواره‌ها اعلام می‌شود.';
  const hoursText = (store.workingHours || []).map((w) => `• ${w.fa || w.day}: ${w.time || ''}`).join('\n');

  return `❓ <b>سوالات پرتکرار مشتریان یاسایی:</b>\n\n` +
    `🚚 <b>هزینه و زمان ارسال:</b>\n${zonesText || '• ارسال سریع پستی و پیک به سراسر کشور'}\n\n` +
    `✨ <b>ارسال رایگان:</b>\n${freeOverText}\n\n` +
    `💳 <b>روش‌های پرداخت:</b>\n` +
    `• پرداخت اینترنتی امن از تمامی کارت‌های عضو شتاب\n` +
    `• پرداخت از اعتبار کیف پول\n` +
    `• پرداخت در محل (COD) برای سفارش‌های شهر تهران\n` +
    `• پرداخت اقساطی ۴ ماهه بدون کارمزد (اسنپ‌پی، ازکی‌وام، دیجی‌پی)\n\n` +
    `🔄 <b>مهلت تست و مرجوعی:</b>\n` +
    `• ۷ روز ضمانت بازگشت وجه طبق قانون تجارت الکترونیک در صورت عدم رضایت یا ایراد کالا (با حفظ بسته‌بندی اولیه).\n\n` +
    `📍 <b>آدرس فروشگاه حضوری:</b>\n${store.address || 'تهران، نارمک، میدان هفت‌حوض'}\n\n` +
    `🕘 <b>ساعت کاری:</b>\n${hoursText || 'هر روز ۹:۰۰ تا ۲۱:۰۰'}`;
}

function answerStatus(code) {
  const c = String(code || '').trim();
  if (!c) return '📦 برای پیگیری سفارش، کد سفارش را ارسال کنید.\n\nمثال: <code>YS-123456</code> یا <code>123456</code>\nکد سفارش برای شما پیامک شده است.';
  const st = db.raw;
  const norm = c.toUpperCase();
  const stripped = norm.replace(/^(YS|BM)-?/i, '');
  const o = (st.orders || []).find((x) => {
    const ox = String(x.code || '').toUpperCase();
    const oxStripped = ox.replace(/^(YS|BM)-?/i, '');
    return ox === norm || ox === `YS-${norm}` || oxStripped === stripped || ox === stripped || oxStripped === norm;
  });
  if (!o) return `سفارشی با کد «${escT(c)}» پیدا نشد. 😕\nلطفاً کد سفارش را با دقت بررسی و مجدداً ارسال کنید.`;
  const fa = {
    pending_payment: 'در انتظار پرداخت',
    pending_review: 'در انتظار بررسی',
    confirmed: 'تأییدشده',
    preparing: 'در حال آماده‌سازی',
    ready_pickup: 'آماده تحویل حضوری',
    shipped: 'ارسال‌شده',
    delivered: 'تحویل‌شده',
    cancelled: 'لغوشده',
    refunded: 'مرجوع‌شده',
    returned: 'مرجوع‌شده',
  };
  const next = {
    pending_payment: 'هنوز پرداخت نشده؛ می‌توانید از سایت اقدام کنید.',
    pending_review: 'سفارش در انتظار بررسی و تأیید فروشگاه است.',
    confirmed: 'پرداخت انجام شده و سفارش تأیید گردید.',
    preparing: 'بسته‌بندی در حال انجام است و به‌زودی تحویل پست/پیک می‌شود.',
    ready_pickup: 'سفارش آماده است؛ می‌توانید حضوری تحویل بگیرید.',
    shipped: 'سفارش تحویل پست/پیک شده است.',
    delivered: 'تحویل داده شده است. ⚡️',
    cancelled: 'لغو شده.',
    refunded: 'مرجوع شده.',
    returned: 'مرجوع شده.',
  };
  return `📦 سفارش: <b>${o.code}</b>\n\nوضعیت: <b>${fa[o.status] || o.status}</b>\n${next[o.status] ? `💡 ${next[o.status]}\n` : ''}💰 مجموع: ${Number(o.total || 0).toLocaleString('fa-IR')} تومان`;
}

function answerProducts(q) {
  const st = db.raw;
  const s = String(q || '').trim().toLowerCase();
  const all = (st.products || []).filter((p) => p.active !== false);
  const items = all.filter((p) => (!s || `${p.name} ${p.nameEn || ''} ${p.brandName || ''} ${p.brandNameEn || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(s))).slice(0, 5);
  
  if (!items.length) return `کالایی مطابق «${escT(q)}» پیدا نشد. 🙁\nعبارت دیگری را امتحان کنید.`;
  
  const head = s ? `🔍 نتیجه جستجوی «${escT(q)}»:` : '🛍 چند کالای جدید فروشگاه:';
  
  const keyboard = {
    inline_keyboard: items.map(p => ([{ text: `🛒 ${p.name} - ${Number(p.price).toLocaleString('fa-IR')} تومان`, url: `${CANON}/#/product/${p.id}` }]))
  };
  
  return { text: `${head}\n\nبرای مشاهده هر کالا روی دکمه‌های زیر کلیک کنید:`, extra: { reply_markup: keyboard } };
}

function answerCategories() {
  const st = db.raw;
  const cats = (st.categories || []).filter(c => !c.parentId && c.active !== false).slice(0, 10);
  if(!cats.length) return { text: "دسته‌بندی یافت نشد." };
  
  const kb = [];
  for(let i=0; i < cats.length; i+=2) {
    const row = [];
    row.push({ text: cats[i].name, callback_data: `cat_${cats[i].id}` });
    if(cats[i+1]) row.push({ text: cats[i+1].name, callback_data: `cat_${cats[i+1].id}` });
    kb.push(row);
  }
  
  return { text: "🗂 یکی از دسته‌بندی‌های زیر را انتخاب کنید:", extra: { reply_markup: { inline_keyboard: kb } } };
}

function handleCallback(up) {
  const cb = up.callback_query;
  const data = cb.data;
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  if(!chatId) return;
  
  try {
    if(data.startsWith('cat_')) {
      const catId = data.slice(4);
      const st = db.raw;
      const cat = (st.categories || []).find(c => c.id === catId);
      if(!cat) {
        tgAnswerCallbackQuery(cb.id, 'دسته یافت نشد!', true);
        return;
      }
      
      const prods = (st.products || []).filter(p => p.categoryId === catId && p.active !== false).slice(0, 5);
      if(!prods.length) {
         tgAnswerCallbackQuery(cb.id, 'فعلاً کالایی در این دسته نداریم.', true);
         return;
      }
      
      const keyboard = {
        inline_keyboard: prods.map(p => ([{ text: `${p.name} (${Number(p.price).toLocaleString('fa-IR')} ت)`, url: `${CANON}/#/product/${p.id}` }]))
      };
      
      tgEditMessageText(chatId, msgId, `📂 دسته: <b>${escT(cat.name)}</b>\nمحصولات موجود:`, { reply_markup: keyboard });
      tgAnswerCallbackQuery(cb.id);
    }
  } catch(e) {}
}

export async function handleUpdate(up) {

  if(up.inline_query) {
    const q = up.inline_query;
    const query = q.query.toLowerCase().trim();
    const st = db.raw;
    const tg = tgWithEnv(st.settings?.telegram);
    const all = (st.products || []).filter(p => p.active !== false);
    const matches = all.filter(p => !query || `${p.name} ${p.brandName || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(query)).slice(0, 15);
    
    const results = matches.map(p => ({
      type: 'article',
      id: p.id,
      title: p.name,
      description: `${Number(p.price || 0).toLocaleString('fa-IR')} تومان`,
      thumbnail_url: p.images?.[0] ? `${CANON}${p.images[0]}` : undefined,
      input_message_content: {
        message_text: `📦 <b>${p.name}</b>\n\n💰 قیمت: ${Number(p.price || 0).toLocaleString('fa-IR')} تومان\n\n⚡️ لینک خرید:\n${CANON}/#/product/${p.id}`,
        parse_mode: 'HTML'
      },
      reply_markup: {
        inline_keyboard: [[{ text: '🛒 مشاهده و خرید', url: `${CANON}/#/product/${p.id}` }]]
      }
    }));
    
    try {
      await fetch(`https://api.telegram.org/bot${tg.token}/answerInlineQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inline_query_id: q.id, results, cache_time: 10 })
      });
    } catch(e) {}
    return;
  }

  const st = db.raw;
  const tg = tgWithEnv(st.settings?.telegram);
  const channel = tg.channel || '@yassaei_shop';

  async function checkMembership(uid) {
    if (!channel || !tg.token || !uid) return true;
    try {
      const r = await fetch(
        `${API(tg.token)}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${encodeURIComponent(uid)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const j = await r.json().catch(() => null);
      // اگر ربات ادمین/عضو کانال نباشد، کانال در دسترس نباشد یا تلگرام خطا بدهد
      // (j.ok === false / پاسخ نامعتبر)، کاربر را پشت در نگه نمی‌داریم و اجازهٔ
      // استفاده از ربات داده می‌شود تا کل بات به‌خاطر یک خطای بررسی قفل نشود.
      if (!j?.ok || !j.result?.status) return true;
      const status = j.result.status;
      if (status === 'restricted') return j.result.is_member !== false;
      return ['member', 'administrator', 'creator'].includes(status);
    } catch(e) { return true; }
  }

  const forceJoinText = `🛑 <b>عضویت اجباری در کانال</b>\n\nبرای استفاده از امکانات ربات، پیگیری سفارش، یا درخواست تبلیغات، لطفاً ابتدا در کانال رسمی ما عضو شوید:\n\n${channel}\n\nسپس روی دکمه زیر کلیک کنید:`;
  const forceJoinKb = { inline_keyboard: [[{text: 'عضویت در کانال 📢', url: `https://t.me/${channel.replace('@','')}`}], [{text: '✅ عضو شدم', callback_data: 'check_join'}]] };

  if(up.callback_query) {
    const cb = up.callback_query;
    const uid = cb.from?.id;
    if (cb.data === 'check_join') {
      const cbChatId = cb.message?.chat?.id;
      const cbMsgId = cb.message?.message_id;
      const isMem = await checkMembership(uid);
      if (isMem) {
        const confirmText = '✅ عضویت شما در کانال تایید شد. خوش آمدید! ⚡';
        // ۱) اول خودِ دکمه پاسخ می‌گیرد تا اعلان تایید عضویت به کاربر نشان داده شود
        try { await tgAnswerCallbackQuery(cb.id, confirmText); } catch (e) {}
        // ۲) پیام قبلی فقط با «متن» ویرایش می‌شود (بدون reply_markup): پاس‌دادن
        //    کیبورد معمولی به editMessageText از سمت تلگرام خطای Bad Request می‌گیرد
        if (cbChatId && cbMsgId) {
          try { await tgEditMessageText(cbChatId, cbMsgId, confirmText); } catch (e) {}
        }
        // ۳) منوی اصلی در پیامی مجزا ارسال می‌شود تا دکمه‌های مینی‌اپ و پیگیری
        //    سفارش بلافاصله برای کاربر باز شود
        if (cbChatId) {
          const shopName = escT(st.settings?.store?.name || 'یاسایی');
          try {
            await tgSend(cbChatId, `⚡ به ربات فروشگاه <b>${shopName}</b> خوش آمدی!\nاز منوی زیر استفاده کن:`, getMainMenu());
          } catch (e) {}
        }
      } else {
        await tgAnswerCallbackQuery(cb.id, 'هنوز در کانال عضو نشده‌اید!', true);
      }
      return;
    }
    const isMem = await checkMembership(uid);
    if (!isMem) {
      await tgAnswerCallbackQuery(cb.id, 'ابتدا در کانال عضو شوید!', true);
      return;
    }
    return handleCallback(up);
  }

  const msg = up.message;
  if (!msg) return;
  const text = String(msg.text || msg.caption || '').trim();
  if (!text && !msg.photo && !msg.voice) return;
  
  const chatId = String(msg.chat?.id || '');
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || msg.chat?.first_name || 'کاربر تلگرام';
  const uid = msg.from?.id;
  const isMem = await checkMembership(uid);
  
  if (!isMem && msg.text !== '/start') {
    try { await tgSend(chatId, forceJoinText, { reply_markup: forceJoinKb }); } catch(e){}
    return;
  }

  st.telegramSubs = st.telegramSubs || {};
  
  let reply = '';
  let extra = getMainMenu();

  // آیا پیام با کد سفارش تطابق دارد؟
  const trimmedUpper = text.toUpperCase();
  const strippedCode = trimmedUpper.replace(/^(YS|BM)-?/i, '');
  const matchedOrder = (trimmedUpper.length >= 3 && /^[A-Z0-9-]+$/.test(trimmedUpper)) && (st.orders || []).find((x) => {
    const ox = String(x.code || '').toUpperCase();
    const oxStripped = ox.replace(/^(YS|BM)-?/i, '');
    return ox === trimmedUpper || ox === `YS-${trimmedUpper}` || oxStripped === strippedCode || ox === strippedCode || oxStripped === trimmedUpper;
  });

  if (text === '/start' || text === 'شروع') {
    st.telegramSubs[chatId] = name;
    const w = st.settings?.telegram?.welcome;
    reply = w ? String(w) : `سلام <b>${escT(msg.chat?.first_name || 'دوست عزیز')}</b> 👋\nبه ربات رسمی فروشگاه الکتریکی <b>یاسایی</b> خوش آمدی!\n\nاز طریق منوی زیر می‌توانید به راحتی محصولات را پیدا کنید یا سفارش خود را پیگیری کنید. ⚡️`;
  } else if (text === '/help' || text === 'راهنما') {
    reply = '💡 <b>راهنمای ربات یاسایی</b>:\n\nبرای جستجوی کالا نام آن را ارسال کنید، مثلا: <code>کابل شارژ</code>\nبرای پیگیری سفارش، کد سفارش را ارسال کنید.\nهمچنین هر سوالی داشتید بپرسید تا پشتیبانان ما پاسخ دهند.';
  } else if (text === '🛍 محصولات' || text === '/products') {
    const res = answerProducts('');
    reply = res.text;
    if(res.extra) extra = res.extra;
  } else if (text.startsWith('/search ') || text.startsWith('/products ')) {
    const q = text.replace(/^\/search\s+/, '').replace(/^\/products\s+/, '');
    const res = answerProducts(q);
    reply = res.text;
    if(res.extra) extra = res.extra;
  } else if (text === '🗂 دسته‌بندی‌ها' || text === '/categories') {
    const res = answerCategories();
    reply = res.text;
    if(res.extra) extra = res.extra;
  } else if (text === '📦 پیگیری سفارش' || text === '/status') {
    reply = 'لطفاً کد سفارش خود (مثل YS-1234 یا 1234) را ارسال کنید:';
  } else if (text === '❓ سوالات پرتکرار' || text === 'سوالات پرتکرار' || text === '/faq') {
    reply = answerFaq();
  } else if (text.toUpperCase().startsWith('YS-') || text.toUpperCase().startsWith('BM-')) {
    reply = answerStatus(text);
  } else if (text.startsWith('/status ')) {
    reply = answerStatus(text.slice(8));
  } else if (matchedOrder) {
    reply = answerStatus(text);
  } else if (text === '📢 تبلیغات در ربات') {
    reply = `📢 <b>شرایط تبلیغات در ربات و کانال یاسایی</b>\n\nبرای درخواست تبلیغات، اسپانسری قرعه‌کشی‌ها، یا معرفی فروشگاه خود در کانال ما، لطفاً مستقیماً با مدیریت تماس بگیرید یا پیام خود را همینجا ارسال کنید تا بررسی شود.\n\n📞 تلفن: ${st.settings?.store?.phone || ''}\n✉️ ارتباط: @demonsp`;
  } else if (text === '📞 تماس و پشتیبانی' || text === '/contact') {
    const s = st.settings?.store || {};
    reply = `📞 <b>تلفن تماس:</b> ${s.phone || ''}\n📱 <b>موبایل/واتساپ:</b> ${s.phone2 || ''}\n\n📍 <b>آدرس فروشگاه:</b>\n${s.address || ''}\n\n🕘 <b>ساعت کاری:</b>\n${(s.workingHours || []).map((w) => `${w.fa || w.day} ${w.time || ''}`).join('\n')}\n\n✉️ پیام خود را بفرستید تا پشتیبانی پاسخ دهد.`;
  } else {
    // Check if it's a search term
    const s = text.toLowerCase();
    const all = (st.products || []).filter((p) => p.active !== false);
    const matches = all.filter((p) => (`${p.name} ${p.brandName || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(s))).slice(0, 5);
    
    if(matches.length > 0) {
      const res = answerProducts(text);
      reply = res.text;
      if(res.extra) extra = res.extra;
    } else {
      // It's a support message
      st.telegramInbox = st.telegramInbox || [];
      st.telegramInbox.unshift({ id: `tg${up.update_id}`, chatId, name, text, at: new Date().toISOString(), replied: false });
      if (st.telegramInbox.length > 300) st.telegramInbox.length = 300;
      reply = '✅ پیام شما با موفقیت به تیم پشتیبانی <b>یاسایی</b> ارسال شد.\nبه زودی در همین چت به شما پاسخ خواهیم داد.';
    }
  }

  if (reply && chatId) {
    try { await tgSend(chatId, String(reply), extra); }
    catch (e) {
      st.meta = { ...(st.meta || {}), tgLastError: `${new Date().toISOString()} send→${chatId}: ${e?.message || e}` };
    }
  }
}

/** اعلان سفارش جدید به مدیران در تلگرام (کاملاً بی‌صدا و بدون توقف فرآیند در صورت عدم تنظیم) */
export async function tgNotifyOrder(order) {
  if (!order) return;
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.enabled || !tg?.token) return;
  const adminChatsRaw = String(tg.adminChats || '').trim();
  if (!adminChatsRaw) return;
  const chatIds = adminChatsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (!chatIds.length) return;

  const faStatus = {
    pending_payment: 'در انتظار پرداخت',
    pending_review: 'در انتظار بررسی',
    confirmed: 'تأییدشده',
    preparing: 'در حال آماده‌سازی',
    ready_pickup: 'آماده تحویل حضوری',
    shipped: 'ارسال‌شده',
    delivered: 'تحویل‌شده',
    cancelled: 'لغوشده',
    refunded: 'مرجوع‌شده',
    returned: 'مرجوع‌شده',
  };
  const itemsText = (order.items || []).map((i) => `• ${escT(i.name)} × ${Number(i.qty || 1).toLocaleString('fa-IR')}`).join('\n');
  const msgText = `🔔 <b>سفارش جدید ثبت شد!</b>\n\n` +
    `📦 <b>کد سفارش:</b> <code>${escT(order.code)}</code>\n` +
    `👤 <b>مشتری:</b> ${escT(order.userName || 'مهمان')}${order.userPhone ? ` (<code>${escT(order.userPhone)}</code>)` : ''}\n` +
    `🛍 <b>اقلام:</b>\n${itemsText || '—'}\n` +
    `💰 <b>مبلغ کل:</b> ${Number(order.total || 0).toLocaleString('fa-IR')} تومان\n` +
    `📋 <b>وضعیت:</b> ${escT(faStatus[order.status] || order.status)}\n` +
    `🚚 <b>روش تحویل:</b> ${order.delivery === 'pickup' ? 'تحویل حضوری' : 'ارسال پیک/پست'}`;

  for (const cid of chatIds) {
    try {
      await tgSend(cid, msgText);
    } catch {
      // کاملاً بی‌صدا در خطاهای احتمالی
    }
  }
}

/** اعلان تیکت جدید / پاسخ کاربر به مدیران در تلگرام (بی‌صدا در صورت عدم تنظیم) */
export async function tgNotifyTicket(ticket, msgText = '') {
  if (!ticket) return;
  const tg = tgWithEnv(db.raw.settings?.telegram);
  if (!tg?.enabled || !tg?.token) return;
  const adminChatsRaw = String(tg.adminChats || '').trim();
  if (!adminChatsRaw) return;
  const chatIds = adminChatsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (!chatIds.length) return;

  const faPriority = { critical: 'بحرانی', high: 'بالا', normal: 'عادی', low: 'پایین' };
  const isNew = (ticket.messages || []).length <= 1;
  const text = `🎫 <b>${isNew ? 'تیکت جدید ثبت شد!' : `پاسخ جدید کاربر در تیکت`}</b>\n\n` +
    `🔖 <b>کد تیکت:</b> <code>${escT(ticket.code)}</code>\n` +
    `📌 <b>موضوع:</b> ${escT(ticket.subject || '')}\n` +
    `👤 <b>کاربر:</b> ${escT(ticket.userName || '')}${ticket.userPhone ? ` (<code>${escT(ticket.userPhone)}</code>)` : ''}\n` +
    `⚡️ <b>اولویت:</b> ${escT(faPriority[ticket.priority] || ticket.priority || 'عادی')}\n` +
    (msgText ? `\n💬 ${escT(String(msgText).slice(0, 600))}` : '');

  for (const cid of chatIds) {
    try {
      await tgSend(cid, text);
    } catch {
      // بی‌صدا
    }
  }
}

async function pollOnce(token) {
  const st = db.raw;
  const off = st.meta?.tgOffset || 0;
  const r = await fetch(`${API(token)}/getUpdates?timeout=20&offset=${off}`, { signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(j?.description || 'getUpdates failed');
  st.meta = { ...(st.meta || {}), tgLastPoll: new Date().toISOString(), tgLastError: '' };
  for (const up of j.result || []) {
    st.meta = { ...(st.meta || {}), tgOffset: up.update_id + 1 };
    await handleUpdate(up).catch((e) => {
      st.meta = { ...(st.meta || {}), tgLastError: `${new Date().toISOString()} handle: ${e?.message || e}` };
    });
  }
}

export async function ensureWebhook(token) {
  if (!token) return false;
  const url = `${CANON}${TG_WEBHOOK_PATH}`;
  if (webhookState.ok && webhookState.url === url && webhookState.token === token) return true;
  const r = await fetch(`${API(token)}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'], secret_token: tgSecret(token) }),
  });
  const j = await r.json().catch(() => null);
  if (r.ok && j?.ok) { webhookState = { url, token, ok: true, err: '' }; return true; }
  webhookState = { url, token, ok: false, err: j?.description || 'setWebhook failed' };
  return false;
}

export function startTelegramBot() {
  // یک «تیک» کامل: تصمیم دربارهٔ فعال بودن بات، ست‌کردن وب‌هوک و در صورت
  // شکست، راه‌اندازی حلقهٔ long-polling.
  const tick = async () => {
    const tg = tgWithEnv(db.raw.settings?.telegram);
    const svc = String(process.env.RENDER_SERVICE_NAME || '');
    const want = !!(tg?.enabled && tg?.token) && process.env.BM_TG !== 'off' && !/-legacy$/i.test(svc) && !/^bander-mobile$/i.test(svc);
    if (!want) { polling = false; currentToken = ''; activeLoop++; return; }

    const wok = await ensureWebhook(tg.token).catch(() => false);
    if (wok) { polling = false; currentToken = tg.token; activeLoop++; return; }
    if (polling && currentToken === tg.token) return;
    polling = true; currentToken = tg.token;
    const id = ++loopSeq;
    activeLoop = id;
    (async function loop() {
      while (polling && activeLoop === id && tgWithEnv(db.raw.settings?.telegram).token === currentToken) {
        try { await pollOnce(currentToken); }
        catch (e) {
          db.raw.meta = { ...(db.raw.meta || {}), tgLastError: `${new Date().toISOString()} poll: ${e?.message || e}` };
          await new Promise((r) => setTimeout(r, 8000));
        }
      }
    })();
  };

  const recordErr = (e) => {
    db.raw.meta = { ...(db.raw.meta || {}), tgLastError: `${new Date().toISOString()} start: ${e?.message || e}` };
  };

  // تیک فوری در بدو راه‌اندازی: بات بلافاصله پس از بالاآمدن سرور (دیپلوی/ری‌استارت)
  // وب‌هوک یا پولینگ را ست می‌کند و ۲۰ ثانیه معطل اولین تیک زمان‌دار نمی‌ماند،
  // بنابراین بعد از هر دیپلوی قطعی دریافت پیام نخواهیم داشت.
  tick().catch(recordErr);

  setInterval(() => { tick().catch(recordErr); }, 20000).unref?.();
}
