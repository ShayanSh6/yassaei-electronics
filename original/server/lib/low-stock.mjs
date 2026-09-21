// Detect transitions, not reads/price edits. Restocking above the threshold rearms
// naturally, including across restarts: no in-memory deduplication flag is needed.
export function stockSnapshot(state) {
  if (state.settings?.products?.lowStockTelegramAlertEnabled !== true) return null;
  return new Map(state.products.map(p => [p.id, Number(p.stock || 0)]));
}

export function lowStockMessages(before, state) {
  if (!before || state.settings?.products?.lowStockTelegramAlertEnabled !== true) return [];
  const configured = state.settings.products.lowStockTelegramAlertThreshold;
  const threshold = Number.isInteger(configured) && configured >= 1 && configured <= 100000 ? configured : 3;
  const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return state.products.filter(p => before.has(p.id) && before.get(p.id) >= threshold &&
    Number(p.stock) >= 0 && Number(p.stock) < threshold).map(p =>
    `⚠️ هشدار کسری موجودی قطعه!\nکالا: ${escape(p.name)}\nموجودی فعلی: ${p.stock} عدد\nلطفاً جهت شارژ مجدد قفسه‌ها اقدام نمایید.`);
}

let deliveries = Promise.resolve();
export function dispatchLowStockAlerts(messages) {
  if (!messages.length) return deliveries;
  // Run outside the DB transaction queue. A Telegram outage must not fail a sale.
  deliveries = deliveries.then(async () => {
    const { telegramEnabled, tgBroadcast } = await import('./telegram.mjs');
    if (!telegramEnabled()) return;
    for (const message of messages) {
      const result = await tgBroadcast(message);
      if (result.fail) console.warn('[low-stock] Telegram delivery failures:', result.fail);
    }
  }).catch(() => { console.warn('[low-stock] Telegram alert delivery failed'); });
  return deliveries;
}
