from playwright.sync_api import sync_playwright
import json
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:3000/', wait_until='networkidle'); pg.wait_for_timeout(900)
    if pg.locator('[data-consent-go]').count(): pg.click('[data-consent-go]'); pg.wait_for_timeout(400)
    leak=pg.evaluate("()=>document.documentElement.outerHTML.includes('\\u0001')||document.documentElement.outerHTML.includes('\\u0002')")
    print('sentinel leak:', leak)
    pg.screenshot(path='shots/m-dark-top.png', clip={'x':0,'y':0,'width':390,'height':210})
    pg.click('#btnTheme'); pg.wait_for_timeout(600)
    pg.screenshot(path='shots/m-light-top.png', clip={'x':0,'y':0,'width':390,'height':210})
    pg.screenshot(path='shots/m-light-full.png', full_page=True)
    pg.click('#btnTheme'); pg.wait_for_timeout(400)
    pg.screenshot(path='shots/m-dark-full.png', full_page=True)
    # صفحه محصول و سبد و ادمین هم سریع
    pg.goto('http://127.0.0.1:3000/#/product/p001', wait_until='networkidle'); pg.wait_for_timeout(700)
    pg.screenshot(path='shots/m-pdp.png', full_page=False)
    b.close()
print('pageerrors:', json.dumps(errs[:6], ensure_ascii=False))
