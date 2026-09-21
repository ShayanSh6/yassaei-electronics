# ─────────────────────────────────────────────────────────────
#  جاروی تعاملی: سناریوهای واقعی کاربر با مرورگر واقعی
#  اجرا: python3 tools/interaction-sweep.py [base]
# ─────────────────────────────────────────────────────────────
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000'
issues = []

def probe(pg, tag):
    r = pg.evaluate("""() => ({
      leak: document.documentElement.outerHTML.includes('\\u0001'),
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      viewLen: (document.querySelector('#viewInner')||{innerHTML:''}).innerHTML.length })""")
    if r['leak']: issues.append(f"{tag}: SENTINEL LEAK")
    if r['overflow'] > 2: issues.append(f"{tag}: H-OVERFLOW {r['overflow']}px")
    return r

class Watch:
    def __init__(self, pg):
        self.pg = pg; self.perr = []; self.cerr = []
        pg.on('pageerror', lambda e: self.perr.append(str(e)[:110]))
        pg.on('console', lambda m: self.cerr.append(m.text[:110]) if m.type == 'error' else None)
    def flush(self, tag):
        for e in self.perr: issues.append(f"{tag}: PAGEERROR {e}")
        for e in self.cerr:
            if 'favicon' in e or 'Failed to load resource' in e: continue
            issues.append(f"{tag}: CONSOLE {e}")
        self.perr.clear(); self.cerr.clear()


def clk(pg, sel, tag, nth=0):
    loc = pg.locator(sel).nth(nth)
    try:
        loc.evaluate("el => el.scrollIntoView({block:'center', behavior:'instant'})")
        pg.wait_for_timeout(150)
        loc.click(timeout=3500)
    except Exception:
        try:
            loc.click(force=True, timeout=2000)
        except Exception:
            loc.evaluate("el => el.click()")
        pg.wait_for_timeout(150)

def step(tag, fn):
    print('·', tag, flush=True)
    try: fn()
    except Exception as ex: issues.append(f"{tag}: EXCEPTION {str(ex)[:110]}")
    print('  ✔', tag, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch()

    # ── مهمان: جست‌وجو، سبد، کوپن، ۴۰۴ ─────────────────────────
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); pg.set_default_timeout(9000); w = Watch(pg)
    pg.goto(BASE + '/#/', wait_until='networkidle'); pg.wait_for_timeout(800)
    if pg.locator('[data-consent-go]').count(): pg.click('[data-consent-go]'); pg.wait_for_timeout(300)
    w.flush('home')

    def suggest():
        pg.fill('#searchInput', 'کابل')
        pg.wait_for_selector('#suggestBox:not([hidden]) .sg-item', timeout=6000)
        pg.click('#suggestBox .sg-item >> nth=0')
        pg.wait_for_timeout(900)
        assert any(x in pg.url for x in ['/product/','/search','/category/']), pg.url
        probe(pg, 'suggest-nav')
    step('suggest', suggest)

    def empty_search():
        pg.goto(BASE + '/#/search?q=zzzqqqxx', wait_until='networkidle'); pg.wait_for_timeout(800)
        r = probe(pg, 'search-empty')
        assert r['viewLen'] > 300
        w.flush('search-empty')
    step('search-empty', empty_search)

    def voice():
        pg.goto(BASE + '/#/', wait_until='networkidle'); pg.wait_for_timeout(500)
        pg.click('#btnVoiceSearch'); pg.wait_for_timeout(1200)
        w.flush('voice')
    step('voice', voice)

    def imgsearch():
        pg.click('#btnImageSearch'); pg.wait_for_timeout(900)
        assert '/search/image' in pg.url, pg.url
        r = probe(pg, 'imgsearch-view'); assert r['viewLen'] > 300
        w.flush('imgsearch')
    step('imgsearch', imgsearch)

    def addcart():
        pid = pg.evaluate("() => fetch('/api/products?inStock=1&limit=1').then(r=>r.json()).then(d=>d.items[0].id)")
        pg.goto(BASE + '/#/product/' + pid, wait_until='networkidle'); pg.wait_for_timeout(800)
        pg.wait_for_selector('[data-act=pdp-add]', timeout=6000)
        clk(pg, '[data-act=pdp-add]', 'addcart'); pg.wait_for_timeout(400)
        clk(pg, '[data-act=pdp-add]', 'addcart'); pg.wait_for_timeout(600)
        badge = pg.locator('#cartBadge').inner_text()
        assert badge.strip() in ('2', '۲'), f'badge={badge}'
        w.flush('addcart')
    step('addcart', addcart)

    def cartflow():
        pg.goto(BASE + '/#/cart', wait_until='networkidle'); pg.wait_for_timeout(700)
        pg.locator('.qty input').evaluate("el => el.scrollIntoView({block:'center', behavior:'instant'})")
        pg.fill('.qty input', '3'); pg.locator('.qty input').dispatch_event('change'); pg.wait_for_timeout(700)
        pg.fill('form[data-act=coupon-apply] input', 'WRONGCODE')
        clk(pg, 'form[data-act=coupon-apply] button', 'cart'); pg.wait_for_timeout(900)
        probe(pg, 'cart-coupon')
        clk(pg, '[data-act=cart-remove]', 'cart'); pg.wait_for_timeout(700)
        r = probe(pg, 'cart-empty')
        assert r['viewLen'] > 300
        w.flush('cart')
    step('cartflow', cartflow)

    def guest_checkout():
        pg.goto(BASE + '/#/checkout', wait_until='networkidle'); pg.wait_for_timeout(800)
        r = probe(pg, 'checkout-guest')
        assert r['viewLen'] > 300
        w.flush('checkout-guest')
    step('guest_checkout', guest_checkout)

    def notfound():
        for u in ['/product/pxyz', '/category/cxyz', '/pages/nope']:
            pg.goto(BASE + '/#' + u, wait_until='networkidle'); pg.wait_for_timeout(600)
            r = probe(pg, '404' + u)
            assert r['viewLen'] > 250, u
        w.flush('404s')
    step('notfound', notfound)

    def login_user():
        pg.goto(BASE + '/#/auth', wait_until='networkidle'); pg.wait_for_timeout(600)
        pg.fill('input[name=identifier]', 'maryam'); pg.fill('input[name=password]', 'Demo@1404')
        pg.click('form[data-act=login-pass] button[type=submit]'); pg.wait_for_timeout(1400)
        if pg.locator('[data-act=pwd-later]').count(): pg.click('[data-act=pwd-later]'); pg.wait_for_timeout(400)
        assert pg.locator('.um-btn, .um-name').count(), 'login failed'
        w.flush('login')
    step('login', login_user)

    def checkout_user():
        pid = pg.evaluate("() => fetch('/api/products?inStock=1&limit=1').then(r=>r.json()).then(d=>d.items[0].id)")
        pg.goto(BASE + '/#/product/' + pid, wait_until='networkidle'); pg.wait_for_timeout(700)
        clk(pg, '[data-act=pdp-add]', 'checkout-user'); pg.wait_for_timeout(500)
        pg.goto(BASE + '/#/checkout', wait_until='networkidle'); pg.wait_for_timeout(900)
        r = probe(pg, 'checkout-user'); assert r['viewLen'] > 400, r['viewLen']
        w.flush('checkout-user')
    step('checkout_user', checkout_user)

    def ticket():
        pg.goto(BASE + '/#/account/tickets', wait_until='networkidle'); pg.wait_for_timeout(800)
        clk(pg, '[data-act=ticket-new]', 'ticket'); pg.wait_for_timeout(600)
        f = pg.locator('form[data-act=ticket-create]')
        f.locator('input[name=subject]').fill('تست جاروب')
        f.locator('textarea').first.fill('پیام تست خودکار جاروب تعاملی.')
        f.locator('label.check:has(input[name=rules]) .box').click()
        f.locator('button[type=submit]').evaluate("el => el.scrollIntoView({block:'center', behavior:'instant'})")
        f.locator('button[type=submit]').click(timeout=5000); pg.wait_for_timeout(1200)
        assert pg.locator('.overlay:not([hidden])').count() == 0, 'modal ticket should close after success'
        probe(pg, 'ticket-create'); w.flush('ticket')
    step('ticket', ticket)

    def chat():
        # توست‌ها موقتاً hidden تا هندسهٔ fab تمیز تست شود
        pg.evaluate("() => { const r = document.querySelector('.toast-root'); if (r) r.style.display = 'none'; }")
        pg.locator('#fabSupport').click(timeout=6000); pg.wait_for_timeout(900)
        if not pg.locator('.chat-win').count():
            pg.locator('#fabSupport').click(timeout=6000); pg.wait_for_timeout(900)
        assert pg.locator('.chat-win').is_visible()
        pg.fill('.chat-f input, .chat-f textarea', 'سلام، تست چت')
        clk(pg, '.chat-f button', 'chat'); pg.wait_for_timeout(900)
        pg.evaluate("() => { const r = document.querySelector('.toast-root'); if (r) r.style.display = ''; }")
        w.flush('chat')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    step('chat', chat)


    def theme_lang():
        clk(pg, '#btnTheme', 'theme'); pg.wait_for_timeout(600)
        for u in ['/', '/products', '/cart']:
            pg.goto(BASE + '/#' + u, wait_until='networkidle'); pg.wait_for_timeout(500)
            probe(pg, 'light' + u)
        w.flush('light')
        clk(pg, '#btnLang', 'lang'); pg.wait_for_timeout(800)
        for u in ['/', '/products', '/cart']:
            pg.goto(BASE + '/#' + u, wait_until='networkidle'); pg.wait_for_timeout(500)
            probe(pg, 'en' + u)
        w.flush('en')
        clk(pg, '#btnLang', 'lang2'); pg.wait_for_timeout(400); clk(pg, '#btnTheme', 'theme2'); pg.wait_for_timeout(400)
    step('theme_lang', theme_lang)

    def rapid():
        for u in ['/', '/products', '/category/cables', '/product/p002', '/stats', '/pages/faq', '/cart', '/account']:
            pg.goto(BASE + '/#' + u); pg.wait_for_timeout(220)
        pg.go_back(); pg.go_back(); pg.go_forward(); pg.wait_for_timeout(700)
        probe(pg, 'rapid'); w.flush('rapid')
    step('rapid', rapid)
    ctx.close()

    # ── مدیر دسکتاپ: تب‌های تنظیمات ───────────────────────────
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page(); pg.set_default_timeout(9000); w = Watch(pg)
    def admin_tabs():
        pg.goto(BASE + '/#/auth', wait_until='networkidle'); pg.wait_for_timeout(600)
        if pg.locator('[data-consent-go]').count(): pg.click('[data-consent-go]'); pg.wait_for_timeout(300)
        pg.fill('input[name=identifier]', 'admin'); pg.fill('input[name=password]', 'Yassaei@1404')
        pg.click('form[data-act=login-pass] button[type=submit]'); pg.wait_for_timeout(1400)
        if pg.locator('[data-act=pwd-later]').count(): pg.click('[data-act=pwd-later]'); pg.wait_for_timeout(400)
        for tab in ['settings', 'theme', 'features']:
            pg.goto(BASE + '/#/admin/' + tab, wait_until='networkidle'); pg.wait_for_timeout(700)
            probe(pg, 'admin-' + tab)
        w.flush('admin-tabs')
    step('admin_tabs', admin_tabs)
    ctx.close()
    b.close()

if issues:
    print(f'═══ {len(issues)} مورد ═══')
    for i in issues: print('✘', i)
    sys.exit(1)
print('═══ جاروی تعاملی تمیز: همهٔ سناریوها بدون خطا ═══')
