// Sidebar preferences only: never used to grant route/API permissions.
import { NAV_ICON_NAMES } from './nav-icons.mjs';
export { NAV_ICON_NAMES };
export const ADMIN_SECTION_IDS = ['', 'products', 'categories', 'orders', 'invoice', 'reviews', 'tickets', 'support', 'feedback', 'users', 'kyc', 'careers', 'presence', 'tasks', 'visitors', 'coupons', 'settings/partners', 'ads', 'notifications', 'lottery', 'finance', 'chat', 'telegram', 'settings', 'translations', 'layout', 'templates', 'media', 'theme', 'features', 'pages', 'barcode', 'imageSearch', 'audit', 'stats', 'data'];

export function normalizeAdminNav(value = {}) {
  const v = value && typeof value === 'object' ? value : {};
  const ids = (xs) => [...new Set((Array.isArray(xs) ? xs : []).filter(id => ADMIN_SECTION_IDS.includes(id)))];
  const order = ids(v.order);
  const customLabels = {}, customIcons = {};
  for (const id of ADMIN_SECTION_IDS) {
    const labels = v.customLabels?.[id];
    const clean = x => typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '';
    customLabels[id] = { fa: clean(typeof labels === 'string' ? labels : labels?.fa), en: clean(labels?.en) };
    if (NAV_ICON_NAMES.includes(v.customIcons?.[id])) customIcons[id] = v.customIcons[id];
  }
  return { order: [...order, ...ADMIN_SECTION_IDS.filter(id => !order.includes(id))], hidden: ids(v.hidden), customLabels, customIcons };
}

export function configuredAdminSections(sections, value, language = 'fa', includeHidden = false) {
  const prefs = normalizeAdminNav(value);
  const entries = new Map(sections.map(s => [s.id, s]));
  return prefs.order.filter(id => entries.has(id) && (includeHidden || !prefs.hidden.includes(id))).map(id => {
    const entry = entries.get(id);
    return { ...entry, icon: prefs.customIcons[id] || entry.icon,
      label: () => prefs.customLabels[id]?.[language] || entry.label() };
  });
}
