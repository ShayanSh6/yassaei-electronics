import fs from 'fs';

const path = '/home/user/yassaei/server/lib/telegram.mjs';
let src = fs.readFileSync(path, 'utf8');

const getMainMenuRegex = /function getMainMenu\(\) \{[\s\S]*?return \{[\s\S]*?keyboard: \[[\s\S]*?\],[\s\S]*?resize_keyboard: true[\s\S]*?\}[\s\S]*?\};[\s\S]*?\}/;
const getMainMenuNew = `function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: '🌐 باز کردن فروشگاه (مینی‌اپ)', web_app: { url: CANON } }],
        [{ text: '🛍 محصولات' }, { text: '🗂 دسته‌بندی‌ها' }],
        [{ text: '📦 پیگیری سفارش' }, { text: '📞 تماس و پشتیبانی' }],
        [{ text: '📢 تبلیغات در ربات' }]
      ],
      resize_keyboard: true
    }
  };
}`;
src = src.replace(getMainMenuRegex, getMainMenuNew);

const handleUpdateRegex = /export async function handleUpdate\(up\) \{[\s\S]*?const st = db\.raw;/;
const handleUpdateNew = `export async function handleUpdate(up) {
  const st = db.raw;
  const tg = st.settings?.telegram || {};
  const channel = tg.channel || '@yassaei_shop';

  async function checkMembership(uid) {
    if (!channel || !tg.token) return true;
    try {
      const r = await fetch(\`\${API(tg.token)}/getChatMember?chat_id=\${channel}&user_id=\${uid}\`);
      const j = await r.json();
      return j.ok && ['member', 'administrator', 'creator'].includes(j.result.status);
    } catch(e) { return true; }
  }

  const forceJoinText = \`🛑 <b>عضویت اجباری در کانال</b>\n\nبرای استفاده از امکانات ربات، پیگیری سفارش، یا درخواست تبلیغات، لطفاً ابتدا در کانال رسمی ما عضو شوید:\n\n\${channel}\n\nسپس روی دکمه زیر کلیک کنید:\`;
  const forceJoinKb = { inline_keyboard: [[{text: 'عضویت در کانال 📢', url: \`https://t.me/\${channel.replace('@','')}\`}], [{text: '✅ عضو شدم', callback_data: 'check_join'}]] };

  if(up.callback_query) {
    const cb = up.callback_query;
    const uid = cb.from?.id;
    if (cb.data === 'check_join') {
      const isMem = await checkMembership(uid);
      if (isMem) {
        await tgEditMessageText(cb.message.chat.id, cb.message.message_id, '✅ عضویت شما تایید شد. حالا می‌توانید از ربات استفاده کنید.', getMainMenu());
        await tgAnswerCallbackQuery(cb.id);
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
  if (!msg || !msg.text) return;
  
  const chatId = String(msg.chat?.id || '');
  const uid = msg.from?.id;
  const isMem = await checkMembership(uid);
  
  if (!isMem && msg.text !== '/start') {
    try { await tgSend(chatId, forceJoinText, { reply_markup: forceJoinKb }); } catch(e){}
    return;
  }
`;
src = src.replace(/export async function handleUpdate\(up\) \{[\s\S]*?const st = db\.raw;/, handleUpdateNew);

// Insert handling for the "advertising" text
const textMatchRegex = /else if \(text === '\/start' \|\| text === 'شروع'\) \{/;
const textMatchNew = `else if (text === '/start' || text === 'شروع') {
    if (!isMem) {
       try { await tgSend(chatId, forceJoinText, { reply_markup: forceJoinKb }); } catch(e){}
       return;
    }
`;
src = src.replace(textMatchRegex, textMatchNew);

const advMatchRegex = /else if \(text === '📞 تماس و پشتیبانی' \|\| text === '\/contact'\) \{/;
const advMatchNew = `else if (text === '📢 تبلیغات در ربات') {
    reply = \`📢 <b>شرایط تبلیغات در ربات و کانال یاسایی</b>\n\nبرای درخواست تبلیغات، اسپانسری قرعه‌کشی‌ها، یا معرفی فروشگاه خود در کانال ما، لطفاً مستقیماً با مدیریت تماس بگیرید یا پیام خود را همینجا ارسال کنید تا بررسی شود.\n\n📞 تلفن: \${st.settings?.store?.phone || ''}\n✉️ ارتباط: @demonsp\`;
  } else if (text === '📞 تماس و پشتیبانی' || text === '/contact') {`;
src = src.replace(advMatchRegex, advMatchNew);

fs.writeFileSync(path, src);
console.log("Telegram Adv logic injected.");
