// ─────────────────────────────────────────────────────────────
//  صفحهٔ ۴۰۴: آدرس پیدا نشد
// ─────────────────────────────────────────────────────────────
import { html as h, icon, applyDyn } from '../lib/dom.mjs';
import { t } from '../i18n.mjs';
import { S } from '../state.mjs';
import { emptyState } from '../components.mjs';

export async function render() {
  const path = decodeURIComponent((location.hash || '#/').slice(1));
  return h`
    <div class="center col mt-l nf-wrap">
      <div class="nf-code">۴۰۴</div>
      ${emptyState({
        icon: 'search',
        title: t('err.notFound'),
        text: `${t('err.notFoundText')} — ${path}`,
        action: { href: '#/', label: t('err.goHome') },
      })}
      <div class="row row-wrap center">
        <a class="btn btn-ghost btn-sm" href="#/products">${icon('grid')} ${t('nav.products')}</a>
        <a class="btn btn-ghost btn-sm" href="#/pages/faq">${icon('info')} ${t('footer.faq')}</a>
        <a class="btn btn-ghost btn-sm" href="#/pages/contact">${icon('phone')} ${t('contact.title')}</a>
        <a class="btn btn-ghost btn-sm" href="#/search/image">${icon('camera')} ${t('search.byImage')}</a>
      </div>
      ${S.recent?.length ? h`<p class="muted small">${t('misc.recentlyViewed')}: ${S.recent.length}</p>` : ''}
    </div>`;
}

export function mount(root) {
  applyDyn(root);
  return null;
}
