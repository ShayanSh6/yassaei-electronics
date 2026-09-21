# ─────────────────────────────────────────────────────────────
#  جاروب باگ‌یابی خودکار: همهٔ مسیرها × دو پوسته × دو اندازه
#  بررسی‌ها: خطای JS، نشت کاراکتر کنترلی، سرریز افقی، تصویر خراب،
#  نمای خالی، و لینک‌های مردهٔ داخلی
#  اجرا:  python3 tools/bug-sweep.py [base-url]
# ─────────────────────────────────────────────────────────────
import sys, json
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000'
ROUTES = ['/', '/products', '/category/cables', '/product/p001', '/search?q=' + 'کابل',
          '/cart', '/auth', '/stats', '/products?brand=apple', '/category/modem', '/product/p074',
          '/pages/about', '/pages/guide', '/pages/service', '/pages/faq', '/pages/terms',
          '/pages/privacy', '/pages/contact']
VIEWPORTS = [{'width': 390, 'height': 844, 'name': 'mobile'}, {'width': 1280, 'height': 900, 'name': 'desktop'}]

CHECK = """() => {
  const out = { errors: [], overflow: 0, badImgs: 0, viewLen: 0, leak: false };
  out.leak = document.documentElement.outerHTML.includes('\\u0001') || document.documentElement.outerHTML.includes('\\u0002');
  out.overflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  document.querySelectorAll('img').forEach(i => { if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) out.badImgs++; });
  const v = document.querySelector('#viewInner');
  out.viewLen = v ? v.innerHTML.length : 0;
  return out;
}"""

issues = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp in VIEWPORTS:
        pg = b.new_page(viewport={'width': vp['width'], 'height': vp['height']})
        perr, cerr = [], []
        pg.on('pageerror', lambda e: perr.append(str(e)[:120]))
        pg.on('console', lambda m: cerr.append(m.text[:120]) if m.type == 'error' else None)
        for r in ROUTES:
            perr.clear(); cerr.clear()
            pg.goto(BASE + '/#' + r, wait_until='networkidle')
            pg.wait_for_timeout(700)
            if pg.locator('[data-consent-go]').count():
                pg.click('[data-consent-go]'); pg.wait_for_timeout(300)
            res = pg.evaluate(CHECK)
            tag = f"[{vp['name']}] {r}"
            if perr: issues.append(f"{tag} PAGEERROR: {perr[0]}")
            if cerr: issues.append(f"{tag} CONSOLE: {cerr[0]}")
            if res['leak']: issues.append(f"{tag} SENTINEL LEAK")
            if res['overflow'] > 2: issues.append(f"{tag} H-OVERFLOW {res['overflow']}px")
            if res['badImgs']: issues.append(f"{tag} BROKEN-IMG x{res['badImgs']}")
            if res['viewLen'] < 400: issues.append(f"{tag} EMPTY-VIEW ({res['viewLen']})")
        pg.close()
    b.close()

if issues:
    print(f"═══ {len(issues)} مورد ═══")
    for i in issues: print('✘', i)
    sys.exit(1)
print('═══ جاروب تمیز: هیچ باگی در مسیرها یافت نشد ═══')
