// ─────────────────────────────────────────────────────────────
//  کلاینت SMTP حداقلی (بدون وابستگی): 465/TLS مستقیم یا 587/STARTTLS
//  تنظیمات ادمین: settings.mail = { enabled, host, port, user, pass, from, tls }
// ─────────────────────────────────────────────────────────────
import net from 'node:net';
import tls from 'node:tls';
import { db } from './db.mjs';

export function mailConfigured() {
  const m = db.raw.settings?.mail;
  return !!(m?.enabled && m?.host && m?.user);
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const full = (b) => /(^|\r\n)\d{3}[ \r\n]/.test(b) && b.includes('\n');

export function sendMail({ to, subject, body }) {
  const m = db.raw.settings?.mail;
  if (!mailConfigured()) return Promise.reject(new Error('mail not configured'));
  const from = m.from || m.user;
  const port = Number(m.port || 465);
  const needStarttls = m.tls !== false && port !== 465;

  return new Promise((resolve, reject) => {
    let ended = false;
    let sock = null;
    let buf = '';
    let phase = 'greet';
    let queue = [];
    const timer = setTimeout(() => fail(new Error('smtp timeout')), 25000);
    const fail = (e) => { if (ended) return; ended = true; clearTimeout(timer); try { sock?.destroy(); } catch { /* noop */ } reject(e); };
    const done = () => { if (ended) return; ended = true; clearTimeout(timer); try { sock?.end(); } catch { /* noop */ } resolve({ ok: true }); };
    const send = (s) => { try { sock.write(`${s}\r\n`); } catch (e) { fail(e); } };

    const buildQueue = () => {
      queue = [
        ...(m.user ? [{ e: [334], f: () => send('AUTH LOGIN') }, { e: [334], f: () => send(b64(m.user)) }, { e: [235, 250], f: () => send(b64(m.pass || '')) }] : []),
        { e: [250], f: () => send(`MAIL FROM:<${from}>`) },
        { e: [250, 251], f: () => send(`RCPT TO:<${to}>`) },
        { e: [354], f: () => send('DATA') },
        { e: [250], f: () => sock.write(`From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${b64(subject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${String(body).replace(/\r?\n/g, '\r\n')}\r\n.\r\n`) },
        { e: [221, 250], f: () => done() },
      ];
    };
    const runNext = () => { const it = queue.shift(); if (!it) return done(); it.f(); };

    const onData = (chunk) => {
      buf += chunk.toString('utf8');
      if (!full(buf)) return;
      const code = Number(buf.slice(0, 3));
      buf = '';
      if (phase === 'greet') {
        if (code !== 220) return fail(new Error(`smtp greet ${code}`));
        phase = 'ehlo'; send('EHLO shop'); return;
      }
      if (phase === 'ehlo') {
        if (code !== 250) return fail(new Error(`smtp ehlo ${code}`));
        if (needStarttls) { phase = 'starttls'; send('STARTTLS'); return; }
        phase = 'cmd'; buildQueue(); runNext(); return;
      }
      if (phase === 'starttls') {
        if (code !== 220) return fail(new Error(`smtp starttls ${code}`));
        sock.removeAllListeners('data');
        sock = tls.connect({ socket: sock, servername: m.host }, () => { phase = 'ehlo'; buf = ''; send('EHLO shop'); });
        sock.on('data', onData);
        sock.on('error', fail);
        return;
      }
      // phase cmd: پاسخ گام جاری OK بود؛ گام بعدی را بفرست
      if (code >= 400) return fail(new Error(`smtp error ${code}`));
      runNext();
    };

    const runNext0 = runNext;
    void runNext0;

    sock = port === 465 && !needStarttls ? tls.connect({ host: m.host, port, servername: m.host }) : net.connect({ host: m.host, port });
    sock.on('data', onData);
    sock.on('error', fail);
  });
}
