/** Shared helpers: responses, errors, validation, normalization, pagination. */

/** Error with an HTTP status and a (Persian) message — caught by the global handler. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Parse a JSON body; any failure → 400 with a Persian message. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await req.json();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('not an object');
    }
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'بدنهٔ درخواست نامعتبر است');
  }
}

/* ---------- scalar validators (hand-rolled, no zod) ---------- */

export function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

/** Require a non-empty string after trimming. */
export function requireStr(v: unknown, message: string, minLen = 1): string {
  const s = str(v).trim();
  if (s.length < minLen) throw new HttpError(400, message);
  return s;
}

export function optStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return str(v);
}

/** Parse a finite number, or undefined when absent/blank. */
export function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(str(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

export function requireNum(v: unknown, message: string): number {
  const n = num(v);
  if (n === undefined) throw new HttpError(400, message);
  return n;
}

/** Parse an integer, or undefined when absent/blank. */
export function int(v: unknown): number | undefined {
  const n = num(v);
  return n === undefined ? undefined : Math.trunc(n);
}

/** Non-negative integer (for stock / qty). */
export function requireInt(v: unknown, message: string, min = 0): number {
  const n = int(v);
  if (n === undefined || n < min) throw new HttpError(400, message);
  return n;
}

export function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return undefined;
}

/* ---------- Persian-aware text normalization for search ---------- */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian/Arabic digits → Latin digits. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) {
      out += String(fa);
      continue;
    }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar >= 0) {
      out += String(ar);
      continue;
    }
    out += ch;
  }
  return out;
}

/** Lowercase, unify Arabic glyphs, strip ZWNJ, collapse whitespace. */
export function normalizeText(input: string): string {
  return normalizeDigits(input)
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- pagination ---------- */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
}

export function paginate<T>(
  arr: T[],
  pageRaw: string | null,
  perPageRaw: string | null,
  defaultPerPage = 12,
  maxPerPage = 100,
): Paginated<T> {
  const requested = int(perPageRaw) ?? defaultPerPage;
  const perPage = Math.min(Math.max(requested, 1), maxPerPage);
  const total = arr.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(int(pageRaw) ?? 1, 1), pages);
  return {
    items: arr.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    pages,
    perPage,
  };
}

/* ---------- misc ---------- */

export function nowISO(): string {
  return new Date().toISOString();
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
