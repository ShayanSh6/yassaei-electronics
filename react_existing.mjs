// توکن را از متغیر محیطی بگیر (هیچ رمزی در کد نمی‌ماند): BM_TG_TOKEN=... node react_existing.mjs
const token = String(process.env.BM_TG_TOKEN || '').trim();
if (!token) {
  console.error('✘ BM_TG_TOKEN را ست کن:  BM_TG_TOKEN=123:ABC node react_existing.mjs');
  process.exit(1);
}
const channel = String(process.env.BM_TG_CHANNEL || '@yassaei_shop');
const msgIds = [4, 5, 6, 7, 8, 9, 10]; 
const emojis = ['🔥', '⚡', '❤️', '👍', '🎉', '🤩'];

async function react() {
  for (const mid of msgIds) {
    const e = emojis[Math.floor(Math.random() * emojis.length)];
    const res = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: channel, 
        message_id: mid, 
        reaction: [{ type: 'emoji', emoji: e }] 
      })
    });
    const j = await res.json();
    console.log(`Reacted to ${mid} with ${e}:`, j.ok);
    await new Promise(r => setTimeout(r, 500));
  }
}

react();
