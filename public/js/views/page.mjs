// ─────────────────────────────────────────────────────────────
//  صفحه‌های محتوایی: دربارهٔ ما، راهنمای خرید، خدمات، سؤالات متداول،
//  قوانین، حریم خصوصی، بیمه، قوانین تیکت، گزارش باگ و تماس با ما
// ─────────────────────────────────────────────────────────────
import { html as h, raw, icon, esc, fmtNum, applyDyn, fmtTel, safeHref } from '../lib/dom.mjs';
import { t, isFa } from '../i18n.mjs';
import { api } from '../lib/api.mjs';
import { S, feat, store, hasConsent } from '../state.mjs';
import { emptyState, field, textareaField, minimapSvg, statCard } from '../components.mjs';
import { toastSuccess, toastApiError, withBusy, wireAccordions } from '../ui.mjs';
import { act } from '../actions.mjs';

const fa = (o, k) => (isFa() ? (o?.[k] ?? '') : (o?.[`${k}En`] ?? o?.[k] ?? ''));
const list = (o, k) => (isFa() ? (o?.[k] || []) : (o?.[`${k}En`] || o?.[k] || []));

function hero(page, extra = '') {
  if (!page?.hero) return '';
  return h`
    <div class="page-hero mb">
      <h1 class="page-title">${esc(fa(page.hero, 'title'))}</h1>
      ${fa(page.hero, 'subtitle') ? h`<p class="page-sub">${esc(fa(page.hero, 'subtitle'))}</p>` : ''}
      ${extra}
    </div>`;
}

const bullets = (arr, cls = 'dot-list') => (arr?.length ? h`<ul class="${cls}">${arr.map((x) => h`<li>${typeof x === 'string' ? esc(x) : esc(fa(x, 'fa') || x.title || '')}</li>`)}</ul>` : '');

function sectionCards(sections) {
  if (!sections?.length) return '';
  return sections.map((s) => h`
    <div class="card mt">
      <h2 class="page-h2">${esc(fa(s, 'title'))}</h2>
      ${s.body || s.bodyEn ? h`<div class="page-body">${raw(fa(s, 'body'))}</div>` : ''}
      ${bullets(list(s, 'list').length ? list(s, 'list') : (s.list || []))}
    </div>`).join('');
}

export async function render(ctx) {
  const key = String(ctx.params.key || '');
  // ── نگهبان ویژگی‌ها: اگر قرعه‌کشی یا اقساط خاموش است، مستقیم هم باز نشود ──
  if (key === 'installments' && S.settings?.features?.installments === false) {
    return emptyState({ icon: 'card', title: t('err.notFound'), text: t('err.notFoundText'), action: { href: '#/', label: t('err.goHome') } });
  }
  let data = null;
  try { data = await api.get(`/api/pages/${key}`); } catch { /* noop */ }
  if (!data?.page) return emptyState({ icon: 'file', title: t('err.notFound'), text: t('err.notFoundText'), action: { href: '#/', label: t('err.goHome') } });
  const page = data.page;

  if (Array.isArray(page)) return faqHtml(page);
  switch (key) {
    case 'about': return aboutHtml(page);
    case 'guide': return guideHtml(page);
    case 'service': return serviceHtml(page);
    case 'contact': return contactHtml(page);
    case 'bugReport': return bugHtml(page);
    default: return textHtml(page);
  }
}

// ── دربارهٔ ما ──────────────────────────────────────────────
async function aboutHtml(page) {
  let stats = null;
  if (feat('publicStats')) {
    try { stats = (await api.get('/api/stats/public')).stats; } catch { /* noop */ }
  }
  return h`
    ${hero(page)}
    ${stats && page.stats?.length ? h`
      <div class="section-head"><div><h2 class="section-title">${icon('chart')} ${t('page.statsTitle')}</h2></div></div>
      <div class="stats-grid">
        ${page.stats.map((s) => statCard({
          icon: statIcon(s.key),
          label: isFa() ? s.fa : (s.en || s.fa),
          value: fmtNum(Number(stats[s.key] || 0)),
        }))}
      </div>` : ''}
    ${sectionCards(page.sections)}
    <div class="card mt t-center">
      <strong>${icon('heart')} ${t('page.aboutCta')}</strong>
      <div class="row center row-wrap mt-s">
        <a class="btn btn-primary" href="#/products">${icon('cart')} ${t('cart.goShopping')}</a>
        <a class="btn btn-ghost" href="#/pages/contact">${icon('phone')} ${t('contact.title')}</a>
        <a class="btn btn-ghost" href="#/pages/guide">${icon('file')} ${t('footer.guide')}</a>
      </div>
    </div>`;
}
function statIcon(key) {
  return { years: 'clock', products: 'box', orders: 'package-check', customers: 'users', visits: 'eye' }[key] || 'chart';
}

// ── راهنمای خرید ────────────────────────────────────────────
function guideHtml(page) {
  return h`
    ${hero(page)}
    ${page.steps?.length ? h`
      <div class="section-head"><div><h2 class="section-title">${icon('list')} ${t('page.stepsTitle')}</h2></div></div>
      <ol class="steps-list">
        ${page.steps.map((s) => h`
          <li class="card step-item">
            <div class="grow">
              <strong>${esc(fa(s, 'title'))}</strong>
              <p class="muted small mt-s">${esc(fa(s, 'body'))}</p>
              ${bullets(list(s, 'list').length ? list(s, 'list') : (s.list || []))}
            </div>
          </li>`)}
      </ol>` : ''}
    ${page.tips?.length ? h`
      <div class="card mt">
        <h2 class="page-h2">${icon('zap')} ${t('page.tipsTitle')}</h2>
        ${bullets((isFa() ? page.tips : page.tips).map((x) => (isFa() ? x.fa : (x.en || x.fa))))}
      </div>` : ''}
    <div class="row row-wrap mt">
      <a class="btn btn-primary" href="#/products">${t('cart.goShopping')}</a>
      <a class="btn btn-ghost" href="#/pages/faq">${icon('info')} ${t('footer.faq')}</a>
    </div>`;
}

// ── خدمات ───────────────────────────────────────────────────
function serviceHtml(page) {
  return h`
    ${hero(page)}
    <div class="pwa-grid">
      ${(page.items || []).map((it) => h`
        <div class="pwa-card">
          <span class="pwa-ic">${icon(it.icon || 'check')}</span>
          <div>
            <strong>${esc(fa(it, 'title'))}</strong>
            <p class="muted small mt-s">${esc(fa(it, 'body'))}</p>
            ${bullets(list(it, 'list').length ? list(it, 'list') : (it.list || []))}
          </div>
        </div>`)}
    </div>
    ${sectionCards(page.sections)}`;
}

// ── متن‌های قانونی (قوانین، حریم خصوصی، بیمه، قوانین تیکت) ─
function textHtml(page) {
  return h`
    ${hero(page)}
    ${page.intro || page.introEn ? h`<p class="page-lead">${esc(isFa() ? page.intro : (page.introEn || page.intro))}</p>` : ''}
    ${page.body || page.bodyEn ? h`<div class="card"><div class="page-body">${raw(isFa() ? page.body : (page.bodyEn || page.body))}</div></div>` : ''}
    ${page.rules?.length || page.rulesEn?.length ? h`
      <div class="card mt">
        <h2 class="page-h2">${icon('check')} ${t('page.rulesTitle')}</h2>
        ${bullets(isFa() ? page.rules : (page.rulesEn || page.rules))}
      </div>` : ''}
    ${sectionCards(page.sections)}
    ${page.notice || page.noticeEn ? h`<p class="notice notice-warn mt">${icon('info')}<span>${esc(isFa() ? page.notice : (page.noticeEn || page.notice))}</span></p>` : ''}
    <div class="row row-wrap mt">
      <a class="btn btn-ghost" href="#/pages/terms">${icon('file')} ${t('footer.terms')}</a>
      <a class="btn btn-ghost" href="#/pages/privacy">${icon('shield')} ${t('footer.privacy')}</a>
      <a class="btn btn-ghost" href="#/pages/insurance">${icon('truck')} ${t('footer.insurance')}</a>
      <a class="btn btn-ghost" href="#/pages/ticketRules">${icon('ticket')} ${t('acc.ticketViewRules')}</a>
    </div>
    ${(page.id === 'terms' || page.id === 'privacy') && !hasConsent() ? h`
      <div class="card mt bg-shade">
        <p class="mb-s b">${isFa() ? 'آیا قوانین را مطالعه کردید؟' : 'Have you read the terms?'}</p>
        <button type="button" class="btn btn-primary" data-act="accept-consent-now">${icon('check')} ${t('consent.accept')}</button>
      </div>
    ` : ''}
    `;
}

// ── گزارش باگ ───────────────────────────────────────────────
function bugHtml(page) {
  return h`
    ${hero(page)}
    ${page.body || page.bodyEn ? h`<p class="page-lead">${esc(isFa() ? page.body : (page.bodyEn || page.body))}</p>` : ''}
    ${page.hints?.length ? h`
      <div class="card">
        <h2 class="page-h2">${icon('info')} ${t('page.hintsTitle')}</h2>
        ${bullets(isFa() ? page.hints : (page.hintsEn || page.hints))}
      </div>` : ''}
    <form class="card mt" data-act="page-feedback">
      <input type="hidden" name="type" value="bug">
      <h2 class="page-h2">${icon('bug')} ${t('page.bugTitle')}</h2>
      ${field({ label: t('common.title'), name: 'title', required: true })}
      ${textareaField({ label: t('common.body'), name: 'body', required: true, rows: 6 })}
      ${field({ label: t('acc.feedbackContact'), name: 'contact', hint: t('acc.feedbackContactHint'), value: S.me?.phone || S.me?.email || '' })}
      <button class="btn btn-primary" type="submit">${icon('send')} ${t('common.submit')}</button>
    </form>`;
}

act('page-feedback', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/feedback', {
        type: fd.get('type') || 'suggestion',
        title: fd.get('title'), body: fd.get('body'), contact: fd.get('contact') || '',
      });
      toastSuccess(t('acc.feedbackSent'));
      form.reset();
    } catch (err) { toastApiError(err); }
  });
});

// ── تماس با ما ──────────────────────────────────────────────
function contactHtml(page) {
  const st = store();
  const socials = st.socials || {};
  const fallbackInstagram = 'https://instagram.com/jam.yassaei';
  const socialList = [
    { key: 'instagram', icon: 'camera', url: safeHref(socials.instagram || fallbackInstagram) },
    { key: 'telegram', icon: 'send', url: safeHref(socials.telegram) },
    { key: 'eitaa', icon: 'message', url: safeHref(socials.eitaa)},
    { key: 'whatsapp', icon: 'chat', url: st.whatsapp ? `https://wa.me/${String(st.whatsapp).replace(/\D/g, '')}` : '' },
  ].filter((x) => x.url);

  return h`
    ${hero(page)}
    <div class="acc-grid">
      <div class="col">
        <div class="card">
          <h2 class="page-h2">${icon('pin')} ${t('contact.addressUs')}</h2>
          <p class="page-body">${esc(isFa() ? st.address : (st.addressEn || st.address))}</p>
          <div class="row row-wrap mt-s">
            <button class="btn btn-ghost btn-sm" data-act="copy" data-text="${esc(isFa() ? st.address : (st.addressEn || st.address))}">${icon('copy')} ${t('contact.copyAddress')}</button>
            ${st.phone ? h`<a class="btn btn-primary btn-sm" href="tel:${st.phone}">${icon('phone')} ${t('contact.callNow')}</a>` : ''}
            ${st.email ? h`<a class="btn btn-ghost btn-sm" href="mailto:${st.email}">${icon('mail')} ${t('contact.emailUs')}</a>` : ''}
          </div>
          <div class="contact-list mt">
            ${st.phone ? h`<div class="row"><span class="muted small">${t('contact.phone')}</span><a class="mono" href="tel:${st.phone}">${fmtTel(st.phone)}</a></div>` : ''}
            ${st.phone2 ? h`<div class="row"><span class="muted small">${t('contact.mobile')}</span><a class="mono" href="tel:${st.phone2}">${fmtTel(st.phone2)}</a></div>` : ''}
            ${st.phone3 ? h`<div class="row"><span class="muted small">${t('contact.phone3')}</span><a class="mono" href="tel:${st.phone3}">${fmtTel(st.phone3)}</a></div>` : ''}
            ${st.whatsapp ? h`<div class="row"><span class="muted small">${t('contact.whatsapp')}</span><span class="mono">${fmtTel(st.whatsapp)}</span></div>` : ''}
            ${st.email ? h`<div class="row"><span class="muted small">${t('common.email')}</span><span class="mono small">${esc(st.email)}</span></div>` : ''}
          </div>
          ${socialList.length ? h`<div class="row row-wrap mt-s">${socialList.map((s) => h`<a class="btn btn-ghost btn-sm" href="${esc(s.url)}" target="_blank" rel="noopener">${icon(s.icon)} ${t('social.' + s.key)}</a>`)}</div>` : ''}
        </div>

        <div class="card mt">
          <h2 class="page-h2">${icon('clock')} ${t('footer.workingHours')}</h2>
          ${(st.workingHours || []).map((w) => h`
            <div class="row row-between mt-s">
              <span class="small">${esc(isFa() ? (w.fa || w.day) : (w.en || w.day))}</span>
              <span class="small b mono">${esc(isFa() ? w.time : (w.timeEn || w.time))}</span>
            </div>`)}
        </div>

        <form class="card mt" data-act="page-feedback">
          <input type="hidden" name="type" value="suggestion">
          <h2 class="page-h2">${icon('chat')} ${t('contact.formTitle')}</h2>
          <p class="muted small mb-s">${t('contact.formText')}</p>
          ${field({ label: t('common.title'), name: 'title', required: true })}
          ${textareaField({ label: t('common.message'), name: 'body', required: true, rows: 5 })}
          ${field({ label: t('acc.feedbackContact'), name: 'contact', value: S.me?.phone || S.me?.email || '' })}
          <button class="btn btn-primary" type="submit">${icon('send')} ${t('common.send')}</button>
        </form>
      </div>

      <aside class="col">
        ${safeHref(socials.instagram || fallbackInstagram) || safeHref(socials.telegram) ? h`
        <div class="card">
          <h2 class="page-h2">${icon('globe')} ${t('contact.socials')}</h2>
          <p class="muted small">${t('contact.socialsDesc', { default: 'ما را در شبکه‌های اجتماعی دنبال کنید.' })}</p>
          <div class="row row-wrap mt-s" style="gap: 12px;">
            ${safeHref(socials.instagram || fallbackInstagram) ? h`<a class="btn btn-outline btn-sm" href="${esc(safeHref(socials.instagram || fallbackInstagram))}" target="_blank" rel="noopener">${icon('camera')} ${t('social.instagram')}</a>` : ''}
            ${safeHref(socials.telegram) ? h`<a class="btn btn-primary btn-sm" href="${esc(safeHref(socials.telegram))}" target="_blank" rel="noopener">${icon('send')} ${t('contact.tgBotBtn')}</a>` : ''}
          </div>
        </div>` : ''}

        <div class="card ${safeHref(socials.telegram) || safeHref(socials.instagram || fallbackInstagram) ? 'mt' : ''}">
          <h2 class="page-h2">${icon('map')} ${t('contact.mapTitle')}</h2>
          <div class="minimap" data-act="open-map" role="button" tabindex="0" aria-label="${t('contact.mapTitle')}">
            ${raw(minimapSvg())}
            <span class="minimap-hint">${icon('pin')} ${t('contact.mapHint')}</span>
          </div>
          <p class="hint mt-s">${t('contact.mapAsk')}</p>
          <button class="btn btn-outline btn-block mt-s" data-act="open-map">${icon('map')} ${t('contact.openMaps')}</button>
        </div>

        ${feat('liveSupport') ? h`
        <div class="card mt">
          <h2 class="page-h2">${icon('headset')} ${t('common.support')}</h2>
          <p class="muted small">${t('acc.chatTitle')}</p>
          <div class="row row-wrap mt-s">
            ${S.me ? h`<button class="btn btn-primary btn-sm" data-act="chat-open">${icon('headset')} ${t('acc.chatTitle')}</button>` : h`<a class="btn btn-primary btn-sm" href="#/auth">${icon('user')} ${t('nav.login')}</a>`}
            ${feat('tickets') ? h`<a class="btn btn-ghost btn-sm" href="#/account/tickets">${icon('ticket')} ${t('common.ticket')}</a>` : ''}
          </div>
        </div>` : ''}

        <div class="card mt">
          <h2 class="page-h2">${icon('info')} ${t('footer.faq')}</h2>
          <p class="muted small">${t('faq.askText')}</p>
          <a class="btn btn-ghost btn-sm mt-s" href="#/pages/faq">${t('footer.faq')}</a>
        </div>
      </aside>
    </div>`;
}

// ── سؤالات متداول ───────────────────────────────────────────
function faqHtml(items) {
  const cats = [...new Set(items.map((x) => x.cat || 'other'))];
  return h`
    <div class="page-hero mb">
      <h1 class="page-title">${icon('info')} ${t('footer.faq')}</h1>
      <p class="page-sub">${t('faq.askText')}</p>
    </div>
    <div class="field mb">
      <input class="input" type="search" id="faq-q" placeholder="${t('faq.search')}" data-faq-q autocomplete="off">
    </div>
    <div class="row row-wrap mb" data-faq-cats>
      <button type="button" class="chip active" data-act="faq-cat" data-cat="">${t('faq.all')}</button>
      ${cats.map((c) => h`<button type="button" class="chip" data-act="faq-cat" data-cat="${c}">${t(`faq.cat.${c}`)}</button>`)}
    </div>
    <p class="muted small mb-s" data-faq-count>${t('faq.results', { n: fmtNum(items.length) })}</p>
    <div class="accordion" data-faq-list>
      ${items.map((f, i) => h`
        <div class="acc-item" data-cat="${f.cat || 'other'}" data-text="${esc(((isFa() ? f.q : f.qEn) + ' ' + (isFa() ? f.a : f.aEn)).toLowerCase())}">
          <button class="acc-h" type="button" aria-expanded="false">
            <span class="b">${esc(isFa() ? f.q : (f.qEn || f.q))}</span>
            ${icon('chevron-down')}
          </button>
          <div class="acc-b" hidden><div class="page-body"><p>${esc(isFa() ? f.a : (f.aEn || f.a))}</p></div></div>
        </div>`)}
    </div>
    <div class="card mt t-center" data-faq-empty hidden>
      <p class="muted">${t('faq.notFound')}</p>
      <div class="row center row-wrap mt-s">
        ${S.me && feat('liveSupport') ? h`<button class="btn btn-primary btn-sm" data-act="chat-open">${icon('headset')} ${t('acc.chatTitle')}</button>` : ''}
        ${feat('tickets') ? h`<a class="btn btn-ghost btn-sm" href="#/account/tickets">${icon('ticket')} ${t('acc.ticketNew')}</a>` : ''}
      </div>
    </div>`;
}

act('faq-cat', (e, el) => {
  const wrap = el.closest('[data-faq-cats]');
  wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === el));
  filterFaq();
});

function filterFaq() {
  const root = document.querySelector('[data-faq-list]');
  if (!root) return;
  const q = (document.querySelector('[data-faq-q]')?.value || '').trim().toLowerCase();
  const cat = document.querySelector('[data-faq-cats] .chip.active')?.dataset.cat || '';
  let shown = 0;
  root.querySelectorAll('.acc-item').forEach((it) => {
    const okCat = !cat || it.dataset.cat === cat;
    const okQ = !q || (it.dataset.text || '').includes(q);
    const show = okCat && okQ;
    it.hidden = !show;
    if (show) shown += 1;
  });
  const count = document.querySelector('[data-faq-count]');
  if (count) count.textContent = t('faq.results', { n: fmtNum(shown) });
  const empty = document.querySelector('[data-faq-empty]');
  if (empty) empty.hidden = shown !== 0;
}

export function mount(root, ctx) {
  applyDyn(root);
  wireAccordions(root);
  const q = root.querySelector('[data-faq-q]');
  if (q) {
    let timer = 0;
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(filterFaq, 160); });
  }
  void ctx;
  return null;
}

export const title = () => t('common.page');
