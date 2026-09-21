# بررسی PWA آفلاین با لاگ مرحله‌به‌مرحله
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); pg.set_default_timeout(10000)
    pg.goto(BASE + '/#/', wait_until='networkidle'); print('1 load ok', flush=True)
    if pg.locator('[data-consent-go]').count(): pg.click('[data-consent-go]')
    st = pg.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r ? r.active?.state || r.installing?.state : 'none')")
    print('2 sw state:', st, flush=True)
    pg.wait_for_timeout(2000)
    cached = pg.evaluate("() => caches.keys().then(k => k.join(','))")
    print('3 caches:', cached, flush=True)
    shell = pg.evaluate("() => caches.open('bm-shell').then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname).slice(0,6))").catch if False else pg.evaluate("() => caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys().then(x => x.length))))).then(n => n)")
    print('4 cache entries per store:', shell, flush=True)
    ctx.set_offline(True); print('5 offline set', flush=True)
    try:
        pg.reload(wait_until='commit', timeout=15000); print('6 reload commit ok', flush=True)
    except Exception as e:
        print('6 reload FAIL:', str(e)[:100], flush=True)
    pg.wait_for_timeout(2500)
    r = pg.evaluate("() => ({len:(document.querySelector('#viewInner')||{innerHTML:''}).innerHTML.length, txt:(document.body.innerText||'').slice(0,80)})")
    print('7 offline view:', r, flush=True)
    ctx.close(); b.close()
