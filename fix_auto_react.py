import os

file = '/home/user/yassaei/server/api-admin.mjs'
with open(file, 'r') as f:
    src = f.read()

target = "sendJson(ctx.res, 200, { ok: true });"
replacement = """      if (j.result?.message_id) {
        const emojis = ['🔥', '⚡', '❤️', '👍', '🎉', '🤩'];
        const e = emojis[Math.floor(Math.random() * emojis.length)];
        fetch(`https://api.telegram.org/bot${tg.token}/setMessageReaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: channel, message_id: j.result.message_id, reaction: [{ type: 'emoji', emoji: e }] })
        }).catch(() => {});
      }
      sendJson(ctx.res, 200, { ok: true });"""

if "setMessageReaction" not in src:
    src = src.replace(target, replacement)
    with open(file, 'w') as f:
        f.write(src)
    print("Auto-react patched.")
