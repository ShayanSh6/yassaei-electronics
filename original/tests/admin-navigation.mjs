import assert from 'node:assert/strict';
import { makeClient, login } from './lib/demo.mjs';
import { ADMIN_SECTION_IDS, normalizeAdminNav, configuredAdminSections } from '../public/js/lib/admin-nav.mjs';

const base = process.env.BASE || 'http://127.0.0.1:3000';
const admin = makeClient(base), staff = makeClient(base), anon = makeClient(base);
await admin.get('/api/bootstrap');
assert.ok(await login(admin, 'admin', 'Yassaei@1404'));
await staff.get('/api/bootstrap');
assert.ok(await login(staff, 'staff', 'Staff@1404'));
await anon.get('/api/bootstrap');
const original = (await admin.get('/api/admin/settings')).json.settings;
try {
  const prefs = { order: ['chat', 'products', '', 'layout', 'chat', 'unknown'], hidden: ['barcode', 'layout', 'unknown'], customLabels: { chat: { fa: 'گفت‌وگوی تیم', en: 'Team room' }, '': { fa: 'خانه' }, products: { fa: '\u0001<img src=x onerror=alert(1)>\u0002' } }, customIcons: { chat: 'users', products: '\" onload=alert(1)', unknown: 'box' } };
  let r = await admin.patch('/api/admin/settings/adminNav', { value: prefs });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.value, normalizeAdminNav(prefs));
  assert.equal(r.json.value.order.length, ADMIN_SECTION_IDS.length);
  assert.equal(r.json.value.customIcons.products, undefined);
  assert.ok(!r.json.value.customLabels.products.fa.includes('\u0001'));
  const boot = (await admin.get('/api/bootstrap')).json;
  assert.deepEqual(boot.settings.adminNav, r.json.value);
  assert.deepEqual((await staff.get('/api/bootstrap')).json.settings.adminNav, r.json.value);
  assert.equal((await anon.get('/api/bootstrap')).json.settings.adminNav, undefined);
  assert.equal((await anon.patch('/api/admin/settings/adminNav', { value: prefs })).status, 401);
  assert.equal((await staff.patch('/api/admin/settings/adminNav', { value: prefs })).status, 403);
  assert.equal((await staff.patch('/api/admin/settings/products', { value: { lowStockTelegramAlertEnabled: true } })).status, 403);
  const entries = ADMIN_SECTION_IDS.map(id => ({ id, label: () => id || 'Dashboard', icon: 'box' }));
  assert.deepEqual(configuredAdminSections(entries, prefs, 'en').slice(0, 3).map(s => s.id), ['chat', 'products', '']);
  assert.equal(configuredAdminSections(entries, prefs, 'en')[0].label(), 'Team room');
  assert.equal(configuredAdminSections(entries, prefs)[0].label(), 'گفت‌وگوی تیم');
  assert.equal(configuredAdminSections(entries, { hidden: ADMIN_SECTION_IDS }).length, 0);
  assert.deepEqual(configuredAdminSections(entries.filter(s => s.id === 'products'), prefs).map(s => s.id), ['products']);
  for (const value of [0, -1, 100001, 'nonsense']) {
    assert.equal((await admin.patch('/api/admin/settings/products', { value: { lowStockTelegramAlertThreshold: value } })).status, 400);
  }
  r = await admin.patch('/api/admin/settings/products', { value: { lowStockTelegramAlertEnabled: false, lowStockTelegramAlertThreshold: 5 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.value.lowStockTelegramAlertEnabled, false);
  assert.equal(r.json.value.lowStockTelegramAlertThreshold, 5);
  // Parallel saves of different sections must not race on custom-settings.json.tmp.
  const saves = await Promise.all([
    admin.patch('/api/admin/settings/adminNav', { value: normalizeAdminNav() }),
    admin.patch('/api/admin/settings/products', { value: { lowStockTelegramAlertThreshold: 3 } }),
  ]);
  assert.ok(saves.every(r => r.status === 200));
  console.log('✔ admin-navigation: permissions, sanitization, bootstrap, defaults, all items, languages, validation and concurrent saves');
} finally {
  await admin.patch('/api/admin/settings/adminNav', { value: original.adminNav || normalizeAdminNav() });
  await admin.patch('/api/admin/settings/products', { value: original.products || { lowStockTelegramAlertEnabled: false, lowStockTelegramAlertThreshold: 3 } });
}
