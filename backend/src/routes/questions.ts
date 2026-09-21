/** Product Q&A routes: guests ask, staff answers. Public GET/POST + admin manage. */
import type { QAQuestion } from '../types';
import type { Store } from '../db';
import { requireAdmin } from '../auth';
import {
  HttpError,
  json,
  nowISO,
  paginate,
  readJson,
  requireStr,
  str,
} from '../util';

const MAX_NAME = 60;
const MAX_QUESTION = 500;
const MAX_ANSWER = 1500;

/** Public: list Q&A for a product (newest first). Unanswered included with status badge. */
export function getProductQuestions(store: Store, id: string): Response {
  const productId = id.trim();
  const product = store.db.products.find((p) => p.id === productId || p.sku === productId.toUpperCase());
  if (!product) throw new HttpError(404, 'محصول یافت نشد');

  const questions = store.db.questions
    .filter((q) => q.productId === product.id)
    .sort((a, b) => {
      // answered first, then newest
      const aDone = a.answer ? 1 : 0;
      const bDone = b.answer ? 1 : 0;
      if (aDone !== bDone) return bDone - aDone;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((q) => ({ ...q, productActive: product.active !== false }));

  return json({ questions, total: questions.length, answered: questions.filter((q) => q.answer).length });
}

/** Public: ask a question about a product (no login required). */
export async function createQuestion(store: Store, req: Request, id: string): Promise<Response> {
  const body = await readJson(req);
  const productId = id.trim();

  const name = requireStr(body.name, 'نام خود را وارد کنید', 2).slice(0, MAX_NAME);
  const question = requireStr(body.question, 'متن پرسش الزامی است', 5).slice(0, MAX_QUESTION);

  const saved = store.transaction<QAQuestion>((db) => {
    const product = db.products.find((p) => p.id === productId || p.sku === productId.toUpperCase());
    if (!product || product.active === false) throw new HttpError(404, 'محصول یافت نشد');

    // light flood-guard: max 3 open questions per name per product within 10 minutes
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const recent = db.questions.filter(
      (q) =>
        q.productId === product.id &&
        q.name === name &&
        !q.answer &&
        Date.parse(q.createdAt) > tenMinAgo,
    );
    if (recent.length >= 3) {
      throw new HttpError(429, 'پرسش‌های شما در صف بررسی است؛ کمی صبر کنید');
    }

    const q: QAQuestion = {
      id: `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      productId: product.id,
      name,
      question,
      createdAt: nowISO(),
    };
    db.questions.push(q);
    return q;
  });

  return json({ question: saved }, 201);
}

/** Admin: list all questions (filter status=pending|answered, optional product id). */
export function adminListQuestions(store: Store, req: Request, url: URL): Response {
  requireAdmin(store, req);
  const status = url.searchParams.get('status');
  const productId = url.searchParams.get('productId');

  const items = store.db.questions
    .filter((q) => {
      if (status === 'pending' && q.answer) return false;
      if (status === 'answered' && !q.answer) return false;
      if (productId && q.productId !== productId) return false;
      return true;
    })
    .sort((a, b) => {
      const aDone = a.answer ? 1 : 0;
      const bDone = b.answer ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone; // pending first for admins
      return b.createdAt.localeCompare(a.createdAt);
    });

  // embed product names so the admin UI needs no extra lookups
  const nameById = new Map(store.db.products.map((p) => [p.id, p.name]));
  const withNames = items.map((q) => ({ ...q, productName: nameById.get(q.productId) ?? q.productId }));

  const result = paginate(withNames, url.searchParams.get('page'), url.searchParams.get('perPage'), 20, 100);
  const pending = store.db.questions.filter((q) => !q.answer).length;
  return json({ ...result, pending });
}

/** Admin: answer (or replace the answer of) a question. */
export async function adminAnswerQuestion(store: Store, req: Request, id: string): Promise<Response> {
  requireAdmin(store, req);
  const body = await readJson(req);
  const answer = requireStr(body.answer, 'متن پاسخ الزامی است', 2).slice(0, MAX_ANSWER);

  const question = store.transaction<QAQuestion>((db) => {
    const q = db.questions.find((x) => x.id === id);
    if (!q) throw new HttpError(404, 'پرسش یافت نشد');
    q.answer = answer;
    q.answeredAt = nowISO();
    return q;
  });

  return json({ question });
}

/** Admin: delete a question. */
export function adminDeleteQuestion(store: Store, req: Request, id: string): Response {
  requireAdmin(store, req);
  store.transaction((db) => {
    const idx = db.questions.findIndex((x) => x.id === id);
    if (idx === -1) throw new HttpError(404, 'پرسش یافت نشد');
    db.questions.splice(idx, 1);
  });
  return json({ ok: true });
}

/** Public: vote an answer helpful (up) or retract (down). Never goes below 0. */
export async function voteQuestion(store: Store, req: Request, id: string): Promise<Response> {
  const body = await readJson(req);
  const vote = str(body.vote).trim();
  if (vote !== 'up' && vote !== 'down') throw new HttpError(400, 'رأی نامعتبر است');

  const delta = vote === 'up' ? 1 : -1;
  const question = store.transaction<QAQuestion>((db) => {
    const q = db.questions.find((x) => x.id === id);
    if (!q) throw new HttpError(404, 'پرسش یافت نشد');
    if (!q.answer) throw new HttpError(400, 'این پرسش هنوز پاسخی ندارد');
    q.helpful = Math.max(0, (q.helpful ?? 0) + delta);
    return q;
  });

  return json({ helpful: question.helpful ?? 0 });
}

/** Admin: quick stats for the questions tab badge. */
export function adminQuestionsCount(store: Store, req: Request): Response {
  requireAdmin(store, req);
  const pending = store.db.questions.filter((q) => !q.answer).length;
  return json({ pending, total: store.db.questions.length });
}
