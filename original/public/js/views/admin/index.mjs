// ─────────────────────────────────────────────────────────────
//  پوستهٔ پنل مدیریت: منوی کناری بر اساس دسترسی‌ها + بارگذاری بخش‌ها
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, applyDyn, fmtNum } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { S, can, feat, refreshBootstrap } from '../../state.mjs';
import { notice, toastSuccess, toastApiError, withBusy, promptDialog } from '../../ui.mjs';
import { api } from '../../lib/api.mjs';
import { act } from '../../actions.mjs';
import { configuredAdminSections } from '../../lib/admin-nav.mjs';
import { refresh } from '../../router.mjs';

export const SECTIONS = [
  { grp: 'shop', id: '', perm: 'dashboard.view', icon: 'chart', label: () => t('adm.dashboard'), mod: () => import('./dashboard.mjs') },
  { grp: 'shop', id: 'products', perm: 'products.view', icon: 'box', label: () => t('adm.products'), mod: () => import('./products.mjs') },
  { grp: 'shop', id: 'categories', perm: 'categories.manage', icon: 'layers', label: () => t('adm.categories'), mod: () => import('./catalog.mjs') },
  { grp: 'shop', id: 'orders', perm: 'orders.view', icon: 'package-check', label: () => t('adm.orders'), mod: () => import('./orders.mjs') },
  { grp: 'shop', id: 'invoice', perm: 'orders.manage', icon: 'printer', label: () => { const l = t('adm.instantInvoice'); return l === 'adm.instantInvoice' ? 'فاکتورساز' : l; }, mod: () => import('./invoice.mjs') },
  { grp: 'people', id: 'reviews', perm: 'reviews.moderate', icon: 'star', label: () => t('adm.reviews'), mod: () => import('./reviews.mjs') },
  { grp: 'people', id: 'tickets', perm: 'tickets.manage', icon: 'ticket', label: () => t('adm.tickets'), mod: () => import('./tickets.mjs'), feat: 'tickets' },
  { grp: 'people', id: 'support', perm: 'tickets.manage', icon: 'headset', label: () => t('adm.supportChat'), mod: () => import('./tickets.mjs'), feat: 'liveSupport' },
  { grp: 'people', id: 'feedback', perm: 'feedback.manage', icon: 'flag', label: () => t('adm.feedback'), mod: () => import('./feedback.mjs') },
  { grp: 'people', id: 'users', perm: 'users.view', icon: 'users', label: () => t('adm.users'), mod: () => import('./users.mjs') },
  { grp: 'people', id: 'kyc', perm: 'users.view', icon: 'shield-check', label: () => (isFa() ? 'احراز هویت (KYC)' : 'KYC Review'), mod: () => import('./kyc.mjs') },
  { grp: 'people', id: 'careers', roles: ['owner', 'staff'], icon: 'users', label: () => t('adm.careers'), mod: () => import('./careers.mjs'), feat: 'careers' },
  { grp: 'people', id: 'presence', perm: 'users.view', icon: 'clock', label: () => (isFa() ? 'حضور کارکنان' : 'Staff Presence'), mod: () => import('./tasks.mjs') },
  { grp: 'people', id: 'tasks', perm: 'users.view', icon: 'check-circle', label: () => (isFa() ? 'وظایف کارکنان' : 'Staff Tasks'), mod: () => import('./tasks.mjs') },
  { grp: 'people', id: 'visitors', perm: 'users.view', icon: 'eye', label: () => t('adm.visitors'), mod: () => import('./insights.mjs') },
  { grp: 'growth', id: 'coupons', perm: 'coupons.manage', icon: 'percent', label: () => t('adm.coupons'), mod: () => import('./marketing.mjs'), feat: 'coupons' },
  { grp: 'growth', id: 'settings/partners', perm: 'settings.edit', icon: 'store', label: () => t('adm.sPartners'), mod: () => import('./settings.mjs'), feat: 'partners' },
  { grp: 'growth', id: 'ads', perm: 'ads.manage', icon: 'tag', label: () => t('adm.ads'), mod: () => import('./marketing.mjs'), feat: 'ads' },
  { grp: 'growth', id: 'notifications', perm: 'notifications.send', icon: 'bell', label: () => t('adm.notifications'), mod: () => import('./marketing.mjs'), feat: 'announcements' },
  { grp: 'growth', id: 'lottery', perm: 'settings.edit', icon: 'gift2', label: () => t('adm.lottery'), mod: () => import('./marketing.mjs'), feat: 'lottery' },
  { grp: 'system', id: 'finance', perm: 'stats.view', icon: 'dollar', label: () => (isFa() ? 'سود و زیان (مالی)' : 'Finance / P&L'), mod: () => import('./finance.mjs') },
  { grp: 'system', id: 'chat', roles: ['owner', 'staff'], icon: 'chat', label: () => t('adm.chat'), mod: () => import('./chat.mjs'), feat: 'adminChat' },
  { grp: 'system', id: 'telegram', perm: 'settings.edit', icon: 'send', label: () => t('adm.telegram'), mod: () => import('./marketing.mjs') },
  { grp: 'system', id: 'settings', perm: 'settings.edit', icon: 'settings', label: () => t('adm.settings'), mod: () => import('./settings.mjs') },
  { grp: 'system', id: 'translations', perm: 'settings.edit', icon: 'globe', label: () => isFa() ? 'زبان و ترجمه‌ها' : 'Translations', mod: () => import('./translations.mjs') },
  { grp: 'system', id: 'layout', perm: 'theme.edit', icon: 'layout', label: () => isFa() ? 'چیدمان و منوها' : 'Layout & Menus', mod: () => import('./layout.mjs') },
  { grp: 'system', id: 'templates', perm: 'settings.edit', icon: 'mail', label: () => isFa() ? 'قالب پیام‌ها' : 'Message Templates', mod: () => import('./templates.mjs') },
  { grp: 'system', id: 'media', perm: 'settings.edit', icon: 'image', label: () => isFa() ? 'رسانه‌ها و بنرها' : 'Media Manager', mod: () => import('./media.mjs') },
  { grp: 'system', id: 'theme', perm: 'theme.edit', icon: 'sun', label: () => t('adm.theme'), mod: () => import('./settings.mjs') },
  { grp: 'system', id: 'features', perm: 'settings.edit', icon: 'zap', label: () => t('adm.features'), mod: () => import('./settings.mjs') },
  { grp: 'system', id: 'pages', perm: 'pages.edit', icon: 'file', label: () => t('adm.pages'), mod: () => import('./pages.mjs') },
  { grp: 'system', id: 'barcode', perm: 'barcode.print', icon: 'barcode', label: () => t('adm.barcode'), mod: () => import('./devices.mjs'), feat: 'barcode' },
  { grp: 'system', id: 'imageSearch', perm: 'imagesearch.index', icon: 'camera', label: () => t('adm.imageSearch'), mod: () => import('./devices.mjs'), feat: 'imageSearch' },
  { grp: 'system', id: 'audit', perm: 'audit.view', icon: 'history', label: () => t('adm.audit'), mod: () => import('./insights.mjs') },
  { grp: 'system', id: 'stats', perm: 'stats.view', icon: 'chart', label: () => t('adm.stats'), mod: () => import('./insights.mjs') },
  { grp: 'system', id: 'data', perm: 'data.export', icon: 'download', label: () => t('adm.export'), mod: () => import('./insights.mjs') },
];

const GROUPS = { shop: 'فروشگاه', people: 'مشتری‌ها', growth: 'رشد و تبلیغات', system: 'سامانه' };
const GROUPS_EN = { shop: 'Store', people: 'Customers', growth: 'Growth & ads', system: 'System' };

// دسترسی بخش‌ها: هر کدوم با «اجازه» (perm) یا «نقش» (roles = مدیر/کارمند) کنترل می‌شود
export const allowedSections = () => SECTIONS.filter((s) =>
  (!s.perm || can(s.perm)) &&
  (!s.roles || (S.me && s.roles.includes(S.me.role))) &&
  (!s.feat || feat(s.feat)));
const findEntry = (sec) => allowedSections().find((s) => s.id === sec) || null;

export async function render(ctx) {
  const sec = ctx.params.section || '';
  const entry = findEntry(sec);
  // شمارندهٔ «در انتظار بررسی» برای منوی احراز هویت (KYC)
  let kycPending = 0;
  if (can('users.view')) {
    try {
      const r = await api.get(api.url('/api/admin/kyc', { status: 'pending', limit: 1 }));
      kycPending = Number(r?.counts?.pending || 0);
    } catch { /* نبود دسترسی یا خطای شبکه: نشان نمایش داده نمی‌شود */ }
  }
  const nav = configuredAdminSections(allowedSections(), S.settings?.adminNav, isFa() ? 'fa' : 'en').map((s) => (s.id === 'kyc' && kycPending ? { ...s, count: kycPending } : s));
  let content = '';
  if (!entry) {
    content = notice('warn', sec ? t('adm.noPermission') : t('err.forbidden'))
      + h`<div class="card mt"><strong>${t('adm.title')}</strong><p class="muted small mt-s">${t('adm.noPermission')}</p></div>`;
  } else {
    try {
      const mod = await entry.mod();
      content = await mod.render({ ...ctx, params: { ...ctx.params, section: entry.id }, admNav: nav });
    } catch (err) {
      console.error('[admin] section render failed', err);
      content = notice('danger', `${t('err.generic')} (${esc(err?.message || '')})`);
    }
  }

  return h`
    <div class="row row-between row-wrap mb">
      <div class="row">
        <h1 class="section-title">${icon('settings')} ${t('adm.title')}</h1>
        <span class="badge-pill bp-accent">${esc(S.me?.role === 'owner' ? (isFa() ? 'مالک' : 'Owner') : (isFa() ? 'کارمند' : 'Staff'))}</span>
      </div>
      <div class="row row-wrap">
        ${can('settings.edit') ? h`
          <button class="btn btn-sm ${S.sleeping ? 'btn-success' : 'btn-ghost'}" data-act="adm-sleep-toggle" title="${S.sleeping ? t('sys.turnOn') : t('sys.turnOff')}">
            ${icon(S.sleeping ? 'zap' : 'moon')} ${S.sleeping ? t('sys.turnOn') : t('sys.turnOff')}
          </button>` : ''}
        ${can('theme.edit') && can('settings.edit') ? h`<a class="btn btn-ghost btn-sm" href="#/admin/layout/adminNav">${icon('layout')} ${isFa() ? 'مدیریت منوهای پنل مدیریت' : 'Admin navigation'}</a>` : ''}
        <a class="btn btn-ghost btn-sm" href="#/">${icon('arrow-right')} ${t('adm.backToSite')}</a>
      </div>
    </div>
    ${S.sleeping ? notice('warn', t('sys.sleepBanner')) : ''}
    <div class="adm-grid">
      <aside class="adm-side">
        ${nav.map((s, i) => h`
          ${i === 0 || nav[i - 1].grp !== s.grp ? h`<div class="grp">${esc(isFa() ? GROUPS[s.grp] : GROUPS_EN[s.grp])}</div>` : ''}
          <a href="#/admin${s.id ? `/${s.id}` : ''}" class="${s.id === sec ? 'active' : ''}">
            ${icon(s.icon)} <span>${s.label()}</span>
            ${s.count ? h`<span class="cnt">${fmtNum(s.count)}</span>` : ''}
          </a>`).join('')}
      </aside>
      <div data-admbody>${content}</div>
    </div>`;
}

export async function mount(root, ctx) {
  applyDyn(root);
  // در موبایل منوی ادمین به‌صورت چیپ افقی است؛ آیتم فعال باید داخل نوار دیده شود
  // (block:'nearest' یعنی اسکرول عمودی صفحه به‌هم نمی‌خورد — بدون پرش اسکرول)
  try {
    const active = root.querySelector('.adm-side a.active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
    }
  } catch { /* noop */ }
  const sec = ctx.params.section || '';
  const entry = findEntry(sec);
  if (!entry) return null;
  try {
    const mod = await entry.mod();
    if (typeof mod.mount === 'function') return mod.mount(root.querySelector('[data-admbody]') || root, ctx);
  } catch (err) { console.error('[admin] section mount failed', err); }
  return null;
}

export const title = () => t('adm.title');


// ── کلید خاموش/روشن فروشگاه ─────────────────────────────────
act('adm-sleep-toggle', async (e, el) => {
  const turnOff = !S.sleeping;
  let minutes = 0;
  if (turnOff) {
    const answer = await promptDialog({
      title: t('sys.turnOff'),
      text: t('sys.offConfirm'),
      label: t('sys.autoWakeMins'),
      value: '0',
      type: 'number',
    });
    if (answer === null) return;
    minutes = Math.max(0, Number(answer) || 0);
  }
  await withBusy(el, async () => {
    try {
      await api.post(turnOff ? '/api/system/sleep' : '/api/system/wake', turnOff ? { minutes } : {});
      await refreshBootstrap({ silent: true });
      document.dispatchEvent(new CustomEvent('sleep:changed'));
      toastSuccess(turnOff ? (minutes ? t('sys.asleepTimed', { n: minutes }) : t('sys.asleep')) : t('sys.awake'));
      refresh(true);
    } catch (err) { toastApiError(err); }
  });
});
