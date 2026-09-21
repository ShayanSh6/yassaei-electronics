#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────
#  سازندهٔ «فرم تعهدنامه و احراز هویت مشتریان یاسایی» (PDF فارسی)
#
#  خروجی: public/assets/docs/yassaei-kyc.pdf
#
#  نیازمندی‌ها (یک‌بار):
#      python3 -m venv .venv-pdf && .venv-pdf/bin/pip install fpdf2 uharfbuzz
#  فونت وزیرمتن (TTF) باید در مسیر FONT_DIR باشد؛ اگر نبود، از بستهٔ npm
#  وزیرمتن گرفته می‌شود:
#      npm pack vazirmatn && tar -xzf vazirmatn-*.tgz package/fonts/ttf
#
#  اجرا:
#      python3 tools/gen-kyc-pdf.py
# ─────────────────────────────────────────────────────────────
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "docs" / "yassaei-kyc.pdf"

# مسیر فونت: متغیر محیطی YS_FONT_DIR یا پوشهٔ پیش‌فرض
FONT_DIR = Path(os.environ.get("YS_FONT_DIR", "/tmp/ysfonts"))
REGULAR = FONT_DIR / "Vazirmatn-Regular.ttf"
BOLD = FONT_DIR / "Vazirmatn-Bold.ttf"
EXTRA = FONT_DIR / "Vazirmatn-ExtraBold.ttf"

from fpdf import FPDF  # noqa: E402  (بعد از تنظیم مسیرها)

# ── پالت رنگ اداری ───────────────────────────────────────────
INK = (17, 24, 39)          # متن اصلی
MUTED = (100, 116, 139)     # متن کم‌رنگ
BRAND = (30, 90, 170)       # آبی یاسایی
BRAND_D = (15, 52, 110)     # آبی تیره
LINE = (148, 163, 184)      # خط جدول
SOFT = (241, 245, 249)      # پس‌زمینهٔ سرفصل
WATER = (224, 231, 240)     # واترمارک

# ── ابعاد صفحه (میلی‌متر) ────────────────────────────────────
PW, PH = 210.0, 297.0
M = 16.0                     # حاشیهٔ محتوا
CW = PW - 2 * M              # پهنای محتوا


class Form(FPDF):
    def header(self):
        pass

    def footer(self):
        pass


def frame(pdf):
    """کادر اداری دولبهٔ دور صفحه"""
    pdf.set_draw_color(*BRAND_D)
    pdf.set_line_width(1.0)
    pdf.rect(8, 8, PW - 16, PH - 16)
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.3)
    pdf.rect(10.5, 10.5, PW - 21, PH - 21)
    # گوشه‌های تزئینی
    pdf.set_line_width(0.8)
    for (x, y) in ((10.5, 10.5), (PW - 10.5, 10.5), (10.5, PH - 10.5), (PW - 10.5, PH - 10.5)):
        pdf.line(x - 0, y, x + (4 if x < PW / 2 else -4), y)
        pdf.line(x, y, x, y + (4 if y < PH / 2 else -4))


def watermark(pdf, text="یاسایی  |  Yassaei Electronics"):
    """واترمارک کج و کم‌رنگ در پس‌زمینهٔ صفحه"""
    pdf.set_text_shaping(False)
    pdf.set_font("Vazir", "", 26)
    pdf.set_text_color(*WATER)
    for row, y in enumerate(range(34, 280, 46)):
        for col, x in enumerate(range(-10, 220, 74)):
            pdf.set_xy(x + (18 if row % 2 else 0), y)
            with pdf.rotation(-32, x, y):
                pdf.cell(70, 10, text, align="C")
    pdf.set_text_shaping(True, direction="RTL")
    pdf.set_text_color(*INK)


def lightning(pdf, cx, cy, size=7.0, color=(255, 196, 0)):
    """نشان صاعقهٔ یاسایی (بردار، بدون وابستگی به گلیف فونت)"""
    s = size
    pts = [
        (cx + 0.10 * s, cy - 0.50 * s),
        (cx - 0.34 * s, cy + 0.06 * s),
        (cx - 0.02 * s, cy + 0.06 * s),
        (cx - 0.14 * s, cy + 0.52 * s),
        (cx + 0.34 * s, cy - 0.10 * s),
        (cx + 0.02 * s, cy - 0.10 * s),
    ]
    pdf.set_fill_color(*color)
    pdf.set_draw_color(*color)
    pdf.set_line_width(0.2)
    pdf.polygon(pts, style="DF")


def rtl(pdf, text, x, y, w, h, size=10, style="", align="R", color=INK):
    pdf.set_font("Vazir", style, size)
    pdf.set_text_color(*color)
    pdf.set_xy(x, y)
    pdf.cell(w, h, text, align=align)


def en(pdf, text, x, y, w, h, size=8, style="", align="C", color=MUTED):
    pdf.set_text_shaping(False)
    pdf.set_font("Vazir", style, size)
    pdf.set_text_color(*color)
    pdf.set_xy(x, y)
    pdf.cell(w, h, text, align=align)
    pdf.set_text_shaping(True, direction="RTL")


def header(pdf):
    y = 14.0
    bw, bh = 44.0, 13.5          # پهنای نشان برند
    mw = 40.0                     # پهنای جعبهٔ شناسنامهٔ فرم
    mid_x = M + bw + 2.0          # شروع فضای عنوان
    mid_w = (PW - M - mw - 2.0) - mid_x
    # ── نشان برند (چپ صفحه در نمای RTL) ──
    pdf.set_fill_color(*BRAND_D)
    pdf.set_draw_color(*BRAND_D)
    pdf.set_line_width(0.4)
    pdf.rect(M, y, bw, bh, style="DF", round_corners=True, corner_radius=2.5)
    lightning(pdf, M + bw - 7, y + bh / 2.0, 8.5)
    en(pdf, "YASSAEI ELECTRONICS", M + 2, y + 2.4, bw - 12, 4, size=6.2, style="B", align="C", color=(255, 255, 255))
    en(pdf, "Tehran · Since 1396", M + 2, y + 7.6, bw - 12, 4, size=5.8, align="C", color=(191, 219, 254))

    # ── عنوان فرم (بین نشان و جعبهٔ شناسنامه) ──
    rtl(pdf, "فرم تعهدنامه و احراز هویت مشتریان", mid_x, y + 0.6, mid_w, 6.6, size=15, style="B", align="C", color=BRAND_D)
    rtl(pdf, "فروشگاه الکتریکی و الکترونیک یاسایی", mid_x, y + 7.4, mid_w, 5.4, size=10, style="", align="C", color=MUTED)

    # ── شناسنامهٔ فرم (سمت راست) ──
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.3)
    pdf.rect(PW - M - mw, y, mw, bh)
    rtl(pdf, "شمارهٔ فرم: YS-KYC-01", PW - M - mw + 1, y + 1.0, mw - 2, 4.0, size=7.4, color=MUTED)
    rtl(pdf, "نسخهٔ فرم: ۱٫۰", PW - M - mw + 1, y + 4.8, mw - 2, 4.0, size=7.4, color=MUTED)
    rtl(pdf, "تاریخ دریافت: ..... / ..... / .....", PW - M - mw + 1, y + 8.6, mw - 2, 4.0, size=7.4, color=MUTED)

    # خط جداکنندهٔ سربرگ
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.7)
    pdf.line(M, y + bh + 2.2, PW - M, y + bh + 2.2)
    pdf.set_line_width(0.25)
    pdf.line(M, y + bh + 3.6, PW - M, y + bh + 3.6)
    return y + bh + 6.6


def section_title(pdf, y, text, note=""):
    pdf.set_fill_color(*SOFT)
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.4)
    pdf.rect(M, y, CW, 8, style="DF")
    pdf.set_fill_color(*BRAND)
    pdf.rect(PW - M - 3.2, y, 3.2, 8, style="F")
    rtl(pdf, text, M + 4, y + 1.1, CW - 12, 6, size=11, style="B", color=BRAND_D)
    if note:
        rtl(pdf, note, M + 4, y + 1.6, CW - 60, 5, size=7.4, align="L", color=MUTED)
    return y + 8


def id_table(pdf, y):
    """جدول مشخصات هویتی: دو جفت «عنوان | جای نوشتن» در هر ردیف"""
    rows = [
        ("نام و نام خانوادگی", "نام پدر"),
        ("شمارهٔ ملی", "شمارهٔ شناسنامه"),
        ("تاریخ تولد (روز / ماه / سال)", "شمارهٔ تلفن همراه بنام متقاضی"),
        ("تلفن ثابت", "کد پستی ۱۰ رقمی"),
        ("شمارهٔ شبا (IR) بنام متقاضی", "شمارهٔ کارت بانکی بنام متقاضی"),
    ]
    lh = 9.0
    lw = 40.0                      # پهنای ستون عنوان
    vw = (CW - 2 * lw) / 2.0       # پهنای ستون نوشتن
    pdf.set_font("Vazir", "", 9)
    pdf.set_line_width(0.3)

    def cell(x, yy, w, h, text="", fill=False, bold=False, color=INK, size=9):
        if fill:
            pdf.set_fill_color(248, 250, 252)
            pdf.set_draw_color(*LINE)
            pdf.rect(x, yy, w, h, style="DF")
        else:
            pdf.set_draw_color(*LINE)
            pdf.rect(x, yy, w, h, style="D")
        if text:
            pdf.set_font("Vazir", "B" if bold else "", size)
            pdf.set_text_color(*color)
            pdf.set_xy(x, yy)
            pdf.cell(w, h, text, align="C")

    for (right_label, left_label) in rows:
        # راست: عنوان + جای نوشتن · چپ: عنوان + جای نوشتن
        cell(PW - M - lw, y, lw, lh, right_label, fill=True, bold=True, size=8.6, color=BRAND_D)
        cell(PW - M - lw - vw, y, vw, lh)
        cell(M + lw + vw, y, lw, lh, left_label, fill=True, bold=True, size=8.6, color=BRAND_D)
        cell(M, y, vw, lh)
        y += lh

    # ردیف بلند آدرس (تمام‌پهنا)
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(*LINE)
    pdf.rect(PW - M - lw, y, lw, 14, style="DF")
    pdf.rect(M, y, CW - lw, 14, style="D")
    pdf.set_font("Vazir", "B", 8.6)
    pdf.set_text_color(*BRAND_D)
    pdf.set_xy(PW - M - lw, y + 4.0)
    pdf.cell(lw, 6, "آدرس دقیق پستی", align="C")
    y += 14
    return y


def terms(pdf, y, items):
    pdf.set_font("Vazir", "", 8.7)
    pdf.set_text_color(*INK)
    pdf.set_line_width(0.25)
    pdf.set_draw_color(*LINE)
    lh = 4.9
    for idx, text in enumerate(items, start=1):
        pdf.set_font("Vazir", "B", 8.7)
        num = f"{idx}."
        pdf.set_xy(PW - M - 7, y)
        pdf.cell(7, lh, num, align="C")
        pdf.set_font("Vazir", "", 8.7)
        pdf.set_xy(M, y)
        h = pdf.multi_cell(CW - 9, lh, text, align="J", new_x="LMARGIN", new_y="NEXT",
                           dry_run=True, output="HEIGHT")
        pdf.set_xy(M, y)
        pdf.multi_cell(CW - 9, lh, text, align="J", new_x="LMARGIN", new_y="NEXT")
        y += h + 1.2
    return y


def signature(pdf, y):
    h = 22.0
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.35)
    cols = [
        ("امضا و اثر انگشت متقاضی", ""),
        ("تاریخ (روز / ماه / سال)", ""),
        ("مهر و امضای فروشگاه یاسایی", "یاسایی"),
    ]
    w = CW / 3.0
    for i, (title, mark) in enumerate(cols):
        x = M + i * w
        pdf.set_fill_color(248, 250, 252)
        pdf.rect(x, y, w, 6.4, style="DF")
        pdf.rect(x, y, w, h, style="D")
        pdf.set_font("Vazir", "B", 8.6)
        pdf.set_text_color(*BRAND_D)
        pdf.set_xy(x, y + 1.2)
        pdf.cell(w, 4.2, title, align="C")
        if mark == "یاسایی":
            lightning(pdf, x + w / 2.0, y + 14.5, 11)
    return y + h


def footer(pdf, y):
    pdf.set_draw_color(*BRAND)
    pdf.set_line_width(0.5)
    pdf.line(M, y, PW - M, y)
    rtl(pdf, "فروشگاه الکتریکی و الکترونیک یاسایی · تهران، نارمک، میدان هفت‌حوض، بورس لوازم الکترونیک و الکتریکی",
        M, y + 1.6, CW, 4.2, size=7.8, align="C", color=MUTED)
    en(pdf, "021-77906667  ·  0912-000-0000  ·  info@yassaei.ir  ·  yassaei.ir", M, y + 5.6, CW, 4.0, size=7.0, align="C", color=MUTED)
    rtl(pdf, "این فرم در دو نسخه تنظیم می‌شود؛ یک نسخه نزد فروشگاه یاسایی و یک نسخه نزد متقاضی نگهداری می‌گردد.",
        M, y + 9.4, CW, 4.0, size=7.2, align="C", color=MUTED)


TERMS = [
    "اینجانب گواهی می‌دهم کلیهٔ اطلاعات مندرج در این فرم، شامل مشخصات هویتی، نشانی پستی، شماره‌های تماس و اطلاعات بانکی، صحیح، کامل و متعلق به خود اینجانب است و در صورت کشف هرگونه مغایرت یا اطلاعات نادرست، مسئولیت کامل پیامدهای حقوقی و کیفری آن بر عهدهٔ اینجانب خواهد بود.",
    "کلیهٔ خریدهای اینجانب از فروشگاه یاسایی صرفاً با کارت‌های بانکی و حساب‌هایی انجام شده و خواهد شد که به نام اینجانب نزد بانک‌های معتبر کشور افتتاح شده است. اینجانب اعلام می‌دارم هیچ کارت بانکی، حساب بانکی یا درگاه پرداختی را در اختیار شخص ثالث قرار نداده‌ام و از آن برای دریافت یا انتقال وجه به نیابت از دیگران استفاده نکرده‌ام.",
    "اینجانب آگاهم که استفاده از کارت بانکی شخص ثالث، «اجارهٔ کارت» و انجام تراکنش به نیابت از دیگران، مصداق پولشویی و کلاهبرداری محسوب می‌شود؛ لذا فروشگاه یاسایی در چنین مواردی حق لغو سفارش، مسدودسازی حساب کاربری، خودداری از ارائهٔ خدمات اقساطی و اعلام موضوع به مراجع قضایی و انتظامی را برای خود محفوظ می‌دارد.",
    "اینجانب متعهد به رعایت «قانون تجارت الکترونیک»، «قانون حمایت از حقوق مصرف‌کنندگان» و کلیهٔ قوانین و مقررات جمهوری اسلامی ایران در خریدهای اینترنتی هستم و مقررات فروشگاه یاسایی شامل شرایط ثبت سفارش، ارسال، مهلت تست، مرجوعی و ضمانت کالا را مطالعه و بدون قید و شرط پذیرفته‌ام.",
    "اینجانب با آگاهی کامل از ماهیت فنی کالاها، مسئولیت کامل خرید قطعات الکتریکی و الکترونیکی را بر عهده می‌گیرم؛ از جمله انتخاب درست مشخصات فنی (ولتاژ، جریان، توان، پایه‌چینی و سازگاری قطعه با برد یا دستگاه مورد نظر). بدیهی است آسیب‌های ناشی از نصب نادرست، لحیم‌کاری غیراصولی، اتصال اشتباه قطب‌ها و استفادهٔ خارج از مشخصات فنی، مشمول ضمانت و مرجوعی نخواهد بود.",
    "اینجانب می‌پذیرم که مدارک ارسالی (تصویر کارت ملی یا شناسنامه، تصویر سلفی و این فرم امضاشده) صرفاً جهت احراز هویت، پیشگیری از تقلب و سوءاستفاده نزد فروشگاه یاسایی نگهداری شود و جز در موارد حکم مراجع قانونی در اختیار شخص ثالث قرار نگیرد.",
    "اینجانب می‌پذیرم که فروشگاه یاسایی در صورت نیاز جهت تأیید نهایی هویت با اینجانب تماس بگیرد و در صورت عدم احراز هویت، از ثبت سفارش، فعال‌سازی خرید اقساطی (اسنپ‌پی، ازکی‌وام و دیجی‌پی) یا شرکت در قرعه‌کشی‌ها خودداری نماید.",
]

INTRO = ("اینجانب ................................. فرزند ...................... به شمارهٔ ملی ................................. "
         "با مراجعه به سامانهٔ فروشگاه یاسایی و تکمیل این فرم، ضمن مطالعهٔ دقیق موارد مندرج، صحت اطلاعات هویتی و بانکی خود را تأیید "
         "نموده و تعهدات مشروحهٔ بخش دوم را می‌پذیرم.")


def build(out_path=OUT):
    for p in (REGULAR, BOLD, EXTRA):
        if not p.exists():
            sys.exit(f"✘ فونت پیدا نشد: {p}\n  ابتدا فونت وزیرمتن را در {FONT_DIR} قرار بده (npm pack vazirmatn).")

    pdf = Form(orientation="P", unit="mm", format="A4")
    pdf.set_author("Yassaei Electronics")
    pdf.set_creator("Yassaei Electronics — yassaei.ir")
    pdf.set_title("فرم تعهدنامه و احراز هویت مشتریان — فروشگاه یاسایی")
    pdf.set_subject("KYC commitment form")
    pdf.set_margin(M)
    pdf.add_font("Vazir", "", str(REGULAR))
    pdf.add_font("Vazir", "B", str(BOLD))
    pdf.add_page()
    pdf.set_text_shaping(True, direction="RTL")
    pdf.set_auto_page_break(False)

    watermark(pdf)
    frame(pdf)

    y = header(pdf)

    # مقدمه
    pdf.set_font("Vazir", "", 9.2)
    pdf.set_text_color(*INK)
    pdf.set_xy(M, y)
    pdf.multi_cell(CW, 5.0, INTRO, align="J", new_x="LMARGIN", new_y="NEXT")
    y = pdf.get_y() + 3.5

    # ۱) جدول مشخصات هویتی
    y = section_title(pdf, y, "۱. جدول مشخصات هویتی متقاضی", "تکمیل همهٔ خانه‌ها الزامی است")
    y = id_table(pdf, y) + 4

    # ۲) تعهدات
    y = section_title(pdf, y, "۲. تعهدات و شرایط قانونی", "مطالعهٔ کامل پیش از امضا الزامی است")
    y = terms(pdf, y + 2, TERMS) + 3

    # ۳) امضا
    y = section_title(pdf, y, "۳. امضا، اثر انگشت و تأیید فروشگاه")
    y = signature(pdf, y + 1) + 4

    footer(pdf, y)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out_path))
    return out_path


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    p = build(target)
    print(f"✔ ساخته شد: {p} ({p.stat().st_size / 1024:.0f} KB)")
