// ─────────────────────────────────────────────────────────────
//  ویرایشگر صفحات: دربارهٔ ما، راهنمای خرید، خدمات، سؤالات متداول،
//  قوانین، حریم خصوصی، بیمه، قوانین تیکت، گزارش خطا و تماس
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { field, textareaField, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);

const PAGES = [
  { key: 'about', icon: 'store', blocks: ['hero', 'sections', 'stats'] },
  { key: 'guide', icon: 'info', blocks: ['hero', 'steps', 'tips'] },
  { key: 'service', icon: 'headset', blocks: ['hero', 'items'] },
  { key: 'faq', icon: 'help', blocks: ['faq'] },
  { key: 'terms', icon: 'file', blocks: ['hero', 'intro', 'notice', 'sections'] },
  { key: 'privacy', icon: 'shield', blocks: ['hero', 'intro', 'sections'] },
  { key: 'insurance', icon: 'package-check', blocks: ['hero', 'body', 'rules'] },
  { key: 'ticketRules', icon: 'ticket', blocks: ['hero', 'rules'] },
  { key: 'bugReport', icon: 'bug', blocks: ['hero', 'body', 'hints'] },
  { key: 'contact', icon: 'phone', blocks: ['hero'] },
  { key: 'installments', icon: 'card', blocks: ['hero', 'body', 'rules', 'sections'] },
];

let DATA = {};

export async function render(ctx) {
  try { DATA = (await api.get('/api/admin/pages')).pages || {}; }
  catch (err) { return errorState({ title: err?.message || t('err.generic') }); }

  const key = PAGES.find((p) => p.key === ctx.params.id) ? ctx.params.id : '';
  return h`
    <div class="row row-between row-wrap mb">
      <h2 class="section-title">${icon('file')} ${t('adm.pages')}</h2>
      <span class="badge-pill bp-muted">${fmtNum(PAGES.length)} ${L('صفحه', 'pages')}</span>
    </div>

    <div class="page-grid">
      <div class="card page-nav">
        ${PAGES.map((p) => h`
          <a class="pg-item ${p.key === key ? 'active' : ''}" href="#/admin/pages/${p.key}">
            ${icon(p.icon)}<span class="grow">${pageLabel(p.key)}</span>
          </a>`).join('')}
      </div>
      <div>${key ? editor(PAGES.find((p) => p.key === key)) : emptyState({ icon: 'file', title: t('adm.pagesPick'), text: t('adm.pagesPickHint') })}</div>
    </div>`;
}

function pageLabel(key) {
  const map = {
    about: t('footer.about'), guide: t('footer.guide'), service: t('footer.service'), faq: t('footer.faq'),
    terms: t('footer.terms'), privacy: t('footer.privacy'), insurance: t('footer.insurance'),
    ticketRules: t('acc.ticketRules'), bugReport: t('feedback.bug'), contact: t('footer.contact'),
    installments: L('خرید اقساطی', 'Installments')
  };
  return map[key] || key;
}

function editor(p) {
  const page = DATA[p.key] || (p.key === 'faq' ? [] : {});
  return h`
    <form class="card" data-act="adm-pg-save" data-key="${p.key}">
      <div class="row row-between row-wrap mb-s">
        <strong>${icon(p.icon)} ${pageLabel(p.key)}</strong>
        <a class="btn btn-ghost btn-xs" href="#/pages/${p.key}" target="_blank" rel="noopener">${icon('external')} ${t('adm.view')}</a>
      </div>
      <p class="notice notice-info mb">${icon('info')}<span>${t('adm.pgHint')}</span></p>
      ${p.blocks.map((b) => blockHtml(b, page)).join('')}
      <div class="row row-wrap mt">
        <button class="btn btn-primary" type="submit">${icon('save')} ${t('common.save')}</button>
        <a class="btn btn-ghost" href="#/admin/pages/${p.key}">${t('common.reset')}</a>
      </div>
    </form>`;
}

function blockHtml(block, page) {
  switch (block) {
    case 'hero': {
      const hr = page.hero || {};
      return h`
        <fieldset class="pg-block">
          <legend>${icon('sparkles')} ${L('سربرگ صفحه', 'Page hero')}</legend>
          <div class="form-grid">
            ${field({ label: t('common.title'), name: 'hero.title', value: hr.title || '', span2: true })}
            ${field({ label: L('عنوان (انگلیسی)', 'Title (EN)'), name: 'hero.titleEn', value: hr.titleEn || '', span2: true })}
            ${textareaField({ label: L('زیرعنوان', 'Subtitle'), name: 'hero.subtitle', value: hr.subtitle || '', rows: 2, span2: true })}
            ${textareaField({ label: L('زیرعنوان (انگلیسی)', 'Subtitle (EN)'), name: 'hero.subtitleEn', value: hr.subtitleEn || '', rows: 2, span2: true })}
          </div>
        </fieldset>`;
    }
    case 'intro':
      return textBlock('intro', L('مقدمه', 'Intro'), page.intro || '', page.introEn || '');
    case 'body':
      return textBlock('body', L('متن اصلی', 'Body text'), page.body || '', page.bodyEn || '');
    case 'notice':
      return textBlock('notice', L('هشدار/نکته', 'Notice'), page.notice || '', page.noticeEn || '', 2);
    case 'rules':
      return linesBlock('rules', L('بندها (هر خط یک بند)', 'Clauses (one per line)'), page.rules || [], page.rulesEn || []);
    case 'hints':
      return linesBlock('hints', L('راهنمایی‌ها (هر خط یکی)', 'Hints (one per line)'), page.hints || [], page.hintsEn || []);
    case 'sections':
      return sectionsBlock(page.sections || []);
    case 'steps':
      return blocksList('steps', L('گام‌ها', 'Steps'), page.steps || [], ['title', 'titleEn', 'body', 'bodyEn'], 'list');
    case 'items':
      return blocksList('items', L('موارد خدمات', 'Service items'), page.items || [], ['icon', 'title', 'titleEn', 'body', 'bodyEn'], 'grid');
    case 'tips':
      return blocksList('tips', L('نکته‌ها', 'Tips'), page.tips || [], ['fa', 'en'], 'grid');
    case 'stats':
      return blocksList('stats', L('آمارهای صفحهٔ دربارهٔ ما', 'About-page stats'), page.stats || [], ['fa', 'en', 'key'], 'grid');
    case 'faq':
      return faqBlock(Array.isArray(page) ? page : []);
    default:
      return '';
  }
}

function textBlock(name, label, fa, en, rows = 4) {
  return h`
    <fieldset class="pg-block">
      <legend>${icon('edit')} ${label}</legend>
      <div class="form-grid">
        ${textareaField({ label: L('فارسی', 'Persian'), name: `${name}`, value: fa, rows, span2: true })}
        ${textareaField({ label: L('انگلیسی', 'English'), name: `${name}En`, value: en, rows, span2: true })}
      </div>
    </fieldset>`;
}

function linesBlock(name, label, fa, en) {
  return h`
    <fieldset class="pg-block">
      <legend>${icon('list')} ${label}</legend>
      <div class="form-grid">
        <label class="field span-2"><span class="label">${L('فارسی', 'Persian')}</span>
          <textarea class="textarea" name="${name}" rows="6" data-lines="1">${esc((fa || []).join('\n'))}</textarea></label>
        <label class="field span-2"><span class="label">${L('انگلیسی', 'English')}</span>
          <textarea class="textarea" name="${name}En" rows="6" data-lines="1">${esc((en || []).join('\n'))}</textarea></label>
      </div>
    </fieldset>`;
}

function sectionsBlock(sections) {
  return h`
    <fieldset class="pg-block">
      <legend class="row row-between">
        <span>${icon('layers')} ${L('بخش‌ها', 'Sections')}</span>
        <button type="button" class="btn btn-ghost btn-xs" data-act="adm-pg-add" data-kind="sections">${icon('plus')} ${t('common.add')}</button>
      </legend>
      <div data-blocks="sections">
        ${sections.map((s, i) => sectionHtml(s, i)).join('')}
      </div>
      <template data-tpl="sections">${sectionHtml(emptySection(), 0)}</template>
    </fieldset>`;
}

const emptySection = () => ({ title: '', titleEn: '', body: '', bodyEn: '', list: [], listEn: [] });

function sectionHtml(s, i) {
  const objList = Array.isArray(s.list) && s.list.some((x) => x && typeof x === 'object');
  return h`
    <div class="pg-item" data-block="sections" data-objlist="${objList ? '1' : ''}">
      <div class="row row-between">
        <strong class="tiny">${L('بخش', 'Section')} ${i + 1}</strong>
        <span class="act">${moveBtns()}${delBtn()}</span>
      </div>
      <div class="form-grid mt-s">
        ${field({ label: t('common.title'), name: 'title', value: s.title || '' })}
        ${field({ label: L('عنوان (انگلیسی)', 'Title (EN)'), name: 'titleEn', value: s.titleEn || '' })}
        ${textareaField({ label: L('متن', 'Body'), name: 'body', value: s.body || '', rows: 4, span2: true })}
        ${textareaField({ label: L('متن (انگلیسی)', 'Body (EN)'), name: 'bodyEn', value: s.bodyEn || '', rows: 3, span2: true })}
        ${listPart(s, objList)}
      </div>
    </div>`;
}

function listPart(s, objList) {
  if (objList) {
    return h`
      <div class="span-2">
        <div class="row row-between">
          <span class="label">${L('فهرست موردی', 'Bullet list')}</span>
          <button type="button" class="btn btn-ghost btn-xs" data-act="adm-pg-li-add">${icon('plus')}</button>
        </div>
        <div data-li>${(s.list || []).map((x) => liRow(x)).join('')}</div>
        <template data-li-tpl>${liRow({ icon: 'check', fa: '', en: '' })}</template>
      </div>`;
  }
  const faLines = (s.list || []).map((x) => (typeof x === 'string' ? x : (x?.fa || ''))).join('\n');
  const enLines = (s.listEn || []).join('\n');
  if (faLines || enLines) {
    return h`
      <label class="field span-2"><span class="label">${L('فهرست (هر خط یک مورد)', 'List (one per line)')}</span>
        <textarea class="textarea" name="list" rows="4" data-lines="1">${esc(faLines)}</textarea></label>
      <label class="field span-2"><span class="label">${L('فهرست انگلیسی (هر خط یک مورد)', 'List EN (one per line)')}</span>
        <textarea class="textarea" name="listEn" rows="4" data-lines="1">${esc(enLines)}</textarea></label>`;
  }
  return h`
    <div class="span-2">
      <button type="button" class="btn btn-ghost btn-xs" data-act="adm-pg-list-toggle">${icon('plus')} ${L('افزودن فهرست موردی', 'Add bullet list')}</button>
      <div data-listbox hidden>
        <label class="field span-2"><span class="label">${L('فهرست (هر خط یک مورد)', 'List (one per line)')}</span>
          <textarea class="textarea" name="list" rows="3" data-lines="1"></textarea></label>
      </div>
    </div>`;
}

function liRow(x) {
  return h`
    <div class="spec-row" data-lir>
      <input class="input li-ic" name="icon" value="${esc(x?.icon || 'check')}" placeholder="icon">
      <input class="input" name="fa" value="${esc(x?.fa || '')}" placeholder="${L('فارسی', 'FA')}">
      <input class="input" name="en" value="${esc(x?.en || '')}" placeholder="${L('انگلیسی', 'EN')}">
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="adm-pg-lidel">${icon('trash')}</button>
    </div>`;
}

function blocksList(name, label, items, cols, layout) {
  return h`
    <fieldset class="pg-block">
      <legend class="row row-between">
        <span>${icon('grid')} ${label}</span>
        <button type="button" class="btn btn-ghost btn-xs" data-act="adm-pg-add" data-kind="${name}">${icon('plus')} ${t('common.add')}</button>
      </legend>
      <div class="${layout === 'grid' ? 'perm-grid' : ''}" data-blocks="${name}">
        ${items.map((it, i) => h`
          <div class="pg-item ${layout === 'grid' ? 'tight' : ''}" data-block="${name}">
            <div class="row row-between">
              <strong class="tiny">${fmtNum(i + 1)}</strong>
              <span class="act">${moveBtns()}${delBtn()}</span>
            </div>
            <div class="form-grid mt-s">
              ${cols.map((c) => (c === 'body' || c === 'bodyEn'
                ? textareaField({ label: colLabel(c), name: c, value: it[c] || '', rows: 2, span2: true })
                : field({ label: colLabel(c), name: c, value: it[c] || '' })))}
            </div>
          </div>`).join('')}
      </div>
      <template data-tpl="${name}">
        <div class="pg-item ${layout === 'grid' ? 'tight' : ''}" data-block="${name}">
          <div class="row row-between"><strong class="tiny">+</strong><span class="act">${moveBtns()}${delBtn()}</span></div>
          <div class="form-grid mt-s">
            ${cols.map((c) => (c === 'body' || c === 'bodyEn'
              ? textareaField({ label: colLabel(c), name: c, value: '', rows: 2, span2: true })
              : field({ label: colLabel(c), name: c, value: '' })))}
          </div>
        </div>
      </template>
    </fieldset>`;
}

function colLabel(c) {
  return {
    title: t('common.title'), titleEn: L('عنوان (انگلیسی)', 'Title (EN)'),
    body: L('متن', 'Body'), bodyEn: L('متن (انگلیسی)', 'Body (EN)'),
    icon: L('آیکون', 'Icon'), fa: L('فارسی', 'Persian'), en: L('انگلیسی', 'English'),
    key: L('کلید آماری', 'Stat key'),
  }[c] || c;
}

function faqBlock(items) {
  const cats = ['orders', 'shipping', 'returns', 'product', 'account', 'security', 'store', 'other'];
  return h`
    <fieldset class="pg-block">
      <legend class="row row-between">
        <span>${icon('help')} ${L('سؤالات متداول', 'FAQ')} (${fmtNum(items.length)})</span>
        <button type="button" class="btn btn-ghost btn-xs" data-act="adm-pg-add" data-kind="faq">${icon('plus')} ${t('common.add')}</button>
      </legend>
      <div data-blocks="faq">
        ${items.map((it, i) => faqItem(it, i, cats)).join('')}
      </div>
      <template data-tpl="faq">${faqItem({ cat: 'general', q: '', qEn: '', a: '', aEn: '' }, 0, cats)}</template>
    </fieldset>`;
}

function faqItem(it, i, cats) {
  return h`
    <div class="pg-item" data-block="faq">
      <div class="row row-between">
        <strong class="tiny">${L('سؤال', 'Q')} ${i + 1}</strong>
        <span class="act">${moveBtns()}${delBtn()}</span>
      </div>
      <div class="form-grid mt-s">
        <label class="field"><span class="label">${L('دسته', 'Category')}</span>
          <select class="select" name="cat">${cats.map((c) => h`<option value="${c}" ${it.cat === c ? 'selected' : ''}>${t(`faq.cat.${c}`)}</option>`)}</select></label>
        ${field({ label: L('سؤال', 'Question'), name: 'q', value: it.q || '' })}
        ${field({ label: L('سؤال (انگلیسی)', 'Question (EN)'), name: 'qEn', value: it.qEn || '', span2: true })}
        ${textareaField({ label: L('پاسخ', 'Answer'), name: 'a', value: it.a || '', rows: 3, span2: true })}
        ${textareaField({ label: L('پاسخ (انگلیسی)', 'Answer (EN)'), name: 'aEn', value: it.aEn || '', rows: 2, span2: true })}
      </div>
    </div>`;
}

const moveBtns = () => h`
  <button type="button" class="btn btn-ghost btn-icon btn-xs" data-act="adm-pg-up" aria-label="up">${icon('arrow-up')}</button>
  <button type="button" class="btn btn-ghost btn-icon btn-xs" data-act="adm-pg-down" aria-label="down">${icon('chevron-down')}</button>`;
const delBtn = () => h`<button type="button" class="btn btn-ghost btn-icon btn-xs" data-act="adm-pg-del" aria-label="delete">${icon('trash')}</button>`;

// ── جمع‌آوری ────────────────────────────────────────────────
function readBlock(form, name, block) {
  const ta = form.querySelector(`[name="${name}"]`);
  if (!ta) return undefined;
  if (ta.dataset.lines === '1') return ta.value.split('\n').map((x) => x.trim()).filter(Boolean);
  return ta.value;
}

function collect(form, p) {
  const patch = {};
  for (const block of p.blocks) {
    if (block === 'hero') {
      const g = (n) => form.querySelector(`[name="hero.${n}"]`)?.value ?? '';
      patch.hero = { title: g('title'), titleEn: g('titleEn'), subtitle: g('subtitle'), subtitleEn: g('subtitleEn') };
    } else if (['intro', 'body', 'notice'].includes(block)) {
      patch[block] = readBlock(form, block) ?? '';
      patch[`${block}En`] = readBlock(form, `${block}En`) ?? '';
    } else if (['rules', 'hints'].includes(block)) {
      patch[block] = readBlock(form, block) || [];
      patch[`${block}En`] = readBlock(form, `${block}En`) || [];
    } else if (block === 'faq') {
      patch.faq = [...form.querySelectorAll('[data-block="faq"]')].map((row) => ({
        cat: row.querySelector('[name=cat]')?.value || 'general',
        q: row.querySelector('[name=q]')?.value || '',
        qEn: row.querySelector('[name=qEn]')?.value || '',
        a: row.querySelector('[name=a]')?.value || '',
        aEn: row.querySelector('[name=aEn]')?.value || '',
      }));
    } else {
      const cols = { sections: ['title', 'titleEn', 'body', 'bodyEn'], steps: ['title', 'titleEn', 'body', 'bodyEn'], items: ['icon', 'title', 'titleEn', 'body', 'bodyEn'], tips: ['fa', 'en'], stats: ['fa', 'en', 'key'] }[block] || [];
      patch[block] = [...form.querySelectorAll(`[data-block="${block}"]`)].map((row) => {
        const o = {};
        for (const c of cols) o[c] = row.querySelector(`[name="${c}"]`)?.value ?? '';
        if (block === 'sections') {
          if (row.dataset.objlist === '1') {
            o.list = [...row.querySelectorAll('[data-lir]')].map((li) => ({
              icon: li.querySelector('[name=icon]')?.value || 'check',
              fa: li.querySelector('[name=fa]')?.value || '',
              en: li.querySelector('[name=en]')?.value || '',
            }));
          } else {
            const li = row.querySelector('[name=list]');
            if (li) o.list = li.value.split('\n').map((x) => x.trim()).filter(Boolean);
            const liEn = row.querySelector('[name=listEn]');
            if (liEn) o.listEn = liEn.value.split('\n').map((x) => x.trim()).filter(Boolean);
          }
        }
        return o;
      });
    }
  }
  return patch;
}

// ── کنش‌ها ──────────────────────────────────────────────────
act('adm-pg-save', async (e, form) => {
  e.preventDefault();
  const key = form.dataset.key;
  const p = PAGES.find((x) => x.key === key);
  const value = collect(form, p);
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.patch(`/api/admin/pages/${key}`, { value });
      toastSuccess(t('misc.saved'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});

act('adm-pg-add', (e, el) => {
  const kind = el.dataset.kind;
  const form = el.closest('form');
  const tpl = form.querySelector(`[data-tpl="${kind}"]`);
  const box = form.querySelector(`[data-blocks="${kind}"]`);
  if (!tpl || !box) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = tpl.innerHTML.trim();
  const node = wrap.firstElementChild;
  if (!node) return;
  node.querySelectorAll('input, textarea').forEach((i) => { i.value = ''; });
  const n = box.children.length + 1;
  const label = node.querySelector('.row strong');
  if (label) label.textContent = `${kind === 'faq' ? (isFa() ? 'سؤال' : 'Q') : (isFa() ? 'مورد' : 'Item')} ${n}`;
  box.appendChild(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

act('adm-pg-del', (e, el) => { el.closest('[data-block]')?.remove(); });
act('adm-pg-up', (e, el) => {
  const node = el.closest('[data-block]');
  if (node?.previousElementSibling) node.parentNode.insertBefore(node, node.previousElementSibling);
});
act('adm-pg-down', (e, el) => {
  const node = el.closest('[data-block]');
  if (node?.nextElementSibling) node.parentNode.insertBefore(node.nextElementSibling, node);
});

act('adm-pg-li-add', (e, el) => {
  const box = el.closest('.span-2');
  const list = box.querySelector('[data-li]');
  const tpl = box.querySelector('[data-li-tpl]');
  if (!list || !tpl) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = tpl.innerHTML.trim();
  if (wrap.firstElementChild) list.appendChild(wrap.firstElementChild);
});

act('adm-pg-list-toggle', (e, el) => {
  const box = el.closest('.span-2')?.querySelector('[data-listbox]');
  if (box) box.hidden = !box.hidden;
});

act('adm-pg-lidel', (e, el) => { el.closest('[data-lir]')?.remove(); });

export function mount(root) {
  applyDyn(root);
  return null;
}
