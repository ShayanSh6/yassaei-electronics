import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stockSnapshot, lowStockMessages, dispatchLowStockAlerts } from '../server/lib/low-stock.mjs';
import { normalizeAdminNav } from '../public/js/lib/admin-nav.mjs';

const dir = mkdtempSync(join(tmpdir(), 'ys-stock-test-'));
process.env.BM_DATA_DIR = dir;
process.env.BM_UPLOAD_DIR = join(dir, 'uploads');
delete process.env.BM_TG_TOKEN;
const { db, load, saveCustomSettings } = await import('../server/lib/db.mjs');
await load(st => {
  st.settings = { products: { lowStockTelegramAlertEnabled: true, lowStockTelegramAlertThreshold: 3 }, telegram: { enabled: true, token: 'test-token' } };
  st.products = [{ id: 'p1', name: 'قطعه <A&B>', stock: 4 }];
  st.telegramSubs = { '123': 'Test' };
});
const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, init) => {
  assert.ok(url.includes('api.telegram.org/'));
  sent.push(JSON.parse(init.body));
  return { ok: true, json: async () => ({ ok: true }) };
};
const change = async stock => {
  await db.tx(st => { st.products[0].stock = stock; });
  await dispatchLowStockAlerts([]);
};
try {
  await change(3); assert.equal(sent.length, 0, 'equal to threshold must not alert');
  await change(2); assert.equal(sent.length, 1);
  assert.equal(sent[0].text, '⚠️ هشدار کسری موجودی قطعه!\nکالا: قطعه &lt;A&amp;B&gt;\nموجودی فعلی: 2 عدد\nلطفاً جهت شارژ مجدد قفسه‌ها اقدام نمایید.');
  await change(1); await change(0); assert.equal(sent.length, 1, 'no duplicate alerts below threshold');
  await db.tx(st => { st.products[0].price = 10; });
  assert.equal(sent.length, 1);
  await change(7); await change(2); assert.equal(sent.length, 2, 'restock rearms alert');
  db.raw.settings.products.lowStockTelegramAlertEnabled = false;
  await change(9); await change(0); assert.equal(sent.length, 2, 'master switch off');
  db.raw.settings.products.lowStockTelegramAlertEnabled = true;
  db.raw.settings.products.lowStockTelegramAlertThreshold = 6;
  await change(9); await change(5); assert.equal(sent.length, 3, 'custom threshold');
  db.raw.settings.telegram.enabled = false;
  await change(9); await change(5); assert.equal(sent.length, 3, 'Telegram disabled');
  db.raw.settings.telegram.enabled = true;
  globalThis.fetch = async () => { throw new Error('network failure'); };
  await change(9); await change(5); assert.equal(db.raw.products[0].stock, 5, 'delivery failure does not fail transaction');
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ ok: true }) }; };
  await change(9);
  await Promise.all([db.tx(st => { st.products[0].stock = 5; }), db.tx(st => { st.products[0].stock = 4; })]);
  await dispatchLowStockAlerts([]); assert.equal(sent.length, 4, 'concurrent transactions alert once');
  const before = stockSnapshot(db.raw);
  db.raw.products.push({ id: 'new', name: 'New product', stock: 0 });
  assert.deepEqual(lowStockMessages(before, db.raw), [], 'creation is not a stock decrease');
  await assert.rejects(db.tx(() => { throw new Error('rejected'); }));
  await dispatchLowStockAlerts([]); assert.equal(sent.length, 4);

  db.raw.settings.adminNav = normalizeAdminNav({ order: ['chat', ''], hidden: ['layout'], customLabels: { chat: { fa: 'تیم', en: 'Team' } }, customIcons: { chat: 'users' } });
  const expected = structuredClone(db.raw.settings);
  await Promise.all(Array.from({ length: 10 }, () => saveCustomSettings()));
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'custom-settings.json'))).settings, expected);
  await db.flush(true);
  // Simulate old DB contents: persistent preferences must win after a new process starts.
  const stale = JSON.parse(readFileSync(join(dir, 'db.json')));
  stale.settings.adminNav = normalizeAdminNav({ customIcons: { products: 'users' } });
  stale.settings.products.lowStockTelegramAlertThreshold = 99;
  writeFileSync(join(dir, 'db.json'), JSON.stringify(stale));
  const restart = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { load, db } from './server/lib/db.mjs';
    import assert from 'node:assert/strict';
    await load();
    assert.deepEqual(db.raw.settings, ${JSON.stringify(expected)});
  `], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  assert.equal(restart.status, 0, restart.stderr);
  console.log('✔ low-stock: transactions, thresholds, restocking, deduplication, escaping, outages, concurrency and restart persistence');
} finally {
  globalThis.fetch = realFetch;
  await db.flush(true);
  // Allow the existing delayed DB save to finish before removing its temporary directory.
  await new Promise(r => setTimeout(r, 350));
  rmSync(dir, { recursive: true, force: true });
}
