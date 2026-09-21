// ─────────────────────────────────────────────────────────────
//  لایهٔ HTTP بدون وابستگی خارجی
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, UPLOAD_DIR } from './db.mjs';
import { HttpError, clientIp, parseCookie } from './util.mjs';

export const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.xml': 'application/xml; charset=utf-8',
};

export function mimeOf(file) { return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'; }

export function sendJson(res, status, data, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(data ?? null), 'utf8');
  const accept = res.req?.headers?.['accept-encoding'] || '';
  const compressible = body.length > 1024 && /\bgzip\b/.test(accept);
  const out = compressible ? zlib.gzipSync(body, { level: 6 }) : body;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': out.length,
    'Cache-Control': 'no-store',
    ...(compressible ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
    ...extraHeaders,
  });
  res.end(out);
}

export function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  const body = Buffer.from(String(text), 'utf8');
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
}

export async function readBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'payload_too_large', 'حجم داده ارسالی بیش از حد مجاز است.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJsonBody(req, limitBytes = 512 * 1024) {
  const raw = await readBody(req, limitBytes);
  if (!raw.length) return {};
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'invalid_json', 'بدنهٔ درخواست باید یک آبجکت JSON باشد.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'invalid_json', 'JSON نامعتبر است.');
  }
}

export function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${new Date(opts.expires).toUTCString()}`);
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  parts.push(opts.httpOnly === false ? '' : 'HttpOnly');
  if (opts.secure) parts.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  list.push(parts.filter(Boolean).join('; '));
  res.setHeader('Set-Cookie', list);
}

export function clearCookie(res, name, opts = {}) {
  setCookie(res, name, '', { ...opts, maxAge: 0 });
}

export function getQuery(url) {
  const i = url.indexOf('?');
  return new URLSearchParams(i >= 0 ? url.slice(i + 1) : '');
}

// ── سرویس فایل استاتیک (محافظت‌شده در برابر path traversal) ──
const staticCache = new Map();   // path -> {buf, mtime, mime}
export async function serveStatic(req, res, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return false; }
  if (decoded.includes('\0')) return false;
  let rel = decoded.replace(/^\/+/, '');
  // فاوآیکون: درخواست /favicon.ico به نشان وکتوری یاسایی هدایت می‌شود
  if (rel === 'favicon.ico') rel = 'assets/img/favicon.svg';
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  let abs = path.resolve(PUBLIC_DIR, rel);
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + path.sep)) return false;   // traversal

  let stat;
  try { stat = await fsp.stat(abs); } catch {
    // حالت داده/آپلود جداشده (BM_UPLOAD_DIR): فایل‌های /uploads را از آن پوشه سرو کن
    if (!rel.startsWith('uploads/')) return false;
    const alt = path.resolve(UPLOAD_DIR, rel.slice('uploads/'.length));
    if (alt !== UPLOAD_DIR && !alt.startsWith(UPLOAD_DIR + path.sep)) return false;
    try { stat = await fsp.stat(alt); abs = alt; } catch { return false; }
  }
  if (stat.isDirectory()) {
    const idx = path.join(abs, 'index.html');
    try { stat = await fsp.stat(idx); } catch { return false; }
    return serveFile(req, res, idx, stat);
  }
  return serveFile(req, res, abs, stat);
}

function serveFile(req, res, abs, stat) {
  const cached = staticCache.get(abs);
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cachePolicy(abs) });
    res.end();
    return true;
  }
  let buf = cached && cached.mtime === stat.mtimeMs ? cached.buf : null;
  let gzBuf = cached && cached.mtime === stat.mtimeMs ? cached.gzBuf : null;
  if (!buf) {
    try { buf = fs.readFileSync(abs); } catch { return false; }
    if (staticCache.size > 300) staticCache.clear();
    staticCache.set(abs, { buf, gzBuf: null, mtime: stat.mtimeMs, mime: mimeOf(abs) });
  }
  const mime = mimeOf(abs);
  const accept = req.headers['accept-encoding'] || '';
  const compressible = buf.length > 1400 && /^(text\/|application\/(json|javascript|manifest|xml))/.test(mime) && /\bgzip\b/.test(accept);
  let out = buf;
  if (compressible) {
    if (!gzBuf) {
      gzBuf = zlib.gzipSync(buf, { level: 6 });
      const c = staticCache.get(abs);
      if (c) c.gzBuf = gzBuf;
    }
    out = gzBuf;
  }
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': out.length,
    ETag: etag,
    'Last-Modified': stat.mtime.toUTCString(),
    'Cache-Control': cachePolicy(abs),
    ...(compressible ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
  });
  if (req.method === 'HEAD') { res.end(); return true; }
  res.end(out);
  return true;
}

function cachePolicy(abs) {
  // همیشه بازاعتبارسازی با ETag: پس از هر استقرار، هیچ مرورگری فایل کهنه نگه نمی‌دارد
  return 'no-cache';
}

export const securityHeaders = (req) => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=(self), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

export { clientIp, parseCookie };
