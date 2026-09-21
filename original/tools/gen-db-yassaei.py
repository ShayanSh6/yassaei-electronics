#!/usr/bin/env python3
# تولید db.json اولیهٔ «قطعات الکترونیک یاسایی» از روی ساختار موتور (پروژه ۱)
import json, copy, datetime, os

SRC = 'data/db.json'
HASH = 'scrypt$16384$8$1$jQCtOXSk2HPLR_CtXD08fQ$Fqj5OUYGzhxu5b02_XP5I7q4OJ6NCa3PgLjMggWXTjajXETxW76lZLoMU1s3ZQ8GsIvIaJNd9vyspfkgN3fyCA'  # Yassaei@1404

MAP = [('گرین اپل','یاسایی'),('گرین‌اپل','یاسایی'),('Green Apple','Yassaei'),('بوشهر','تهران'),('بندر','تهران'),
       ('خلیج فارس','تهران'),('ساحلی','نارمک'),('لنج','الکترونیک'),('جم','نارمک')]

def remap(v):
    if isinstance(v, str):
        for a,b in MAP: v = v.replace(a,b)
        return v
    if isinstance(v, list): return [remap(x) for x in v]
    if isinstance(v, dict): return {k: remap(x) for k,x in v.items()}
    return v

d = json.load(open(SRC))
now = '2026-09-10T12:00:00.000Z'

# ── تنظیمات ──
s = d['settings']
s['store'].update({
  'name':'یاسایی','nameEn':'Yassaei Electronics',
  'tagline':'قطعات الکترونیک و لوازم الکتریکی؛ تنوعی به وسعت یک بورسِ تمام‌عیار',
  'taglineEn':'Electronics & electrical parts — a whole bazaar under one roof',
  'phone':'','phone2':'','whatsapp':'',
  'email':'info@yassaei.ir',
  'address':'تهران، نارمک، میدان هفت‌حوض، بورس لوازم الکترونیک و الکتریکی، فروشگاه یاسایی',
  'addressEn':'Tehran, Narmak, Haft-Hoz sq., Electronics bourse, Yassaei Store',
  'hours':'هر روز ۹ تا ۲۱', 'hoursEn':'Daily 9:00-21:00',
})
s['theme'].update({'accent':'#f59e0b','accentEn':'#f59e0b','portTheme':False,'bgStyle':'grid'})
s['seo'] = {'title':'یاسایی | قطعات الکترونیک و لوازم الکتریکی در تهران',
  'description':'خرید آنلاین قطعات برد، ابزار لحیم‌کاری، کابل و سیم، روشنایی، شبکه، صوتی و تصویر از فروشگاه یاسایی تهران (نارمک، هفت‌حوض) با ضمانت اصالت و ارسال به سراسر ایران.',
  'keywords':['قطعات الکترونیک','لوازم الکتریکی','تهران','نارمک','هفت حوض','یاسایی','مقاومت','خازن','آی سی','هویه','کابل','ریسه ال ای دی']}
s['contact'] = {'supportNote':'پاسخ‌گویی تلفنی و حضوری هر روز از ساعت ۹ تا ۲۱',
  'socials':[{'id':'ig','label':'اینستاگرام','url':'https://www.instagram.com/yassaei_electronics/'}]}
s['partners'] = {'items':[{'fa':'تسکو','en':'TSCO'},{'fa':'پاناسونیک','en':'Panasonic'},{'fa':'شیائومی','en':'Xiaomi'},
  {'fa':'بیسوس','en':'Baseus'},{'fa':'انکر','en':'Anker'},{'fa':'لوجیتک','en':'Logitech'},{'fa':'سامسونگ','en':'Samsung'},
  {'fa':'ال‌جی','en':'LG'},{'fa':'خراسان افشان','en':'Khorasan Afshan'},{'fa':'سیمیا','en':'Simia'}]}
# توکن ربات از محیط خوانده می‌شود (هیچ رازی در کد نمی‌ماند): BM_TG_TOKEN=...
s['telegram'] = {'enabled':True, 'token': os.environ.get('BM_TG_TOKEN',''),
  'welcome':'سلام! ⚡ من ربات پشتیبانی یاسایی هستم.\n/status کدسفارش → پیگیری سفارش\n/products عبارت → جستجوی کالا\n/contact → راه‌های تماس\nهر پیام دیگر را به پشتیبانی انسانی می‌رسانم.'}
d['settings'] = remap(s)

# ── دسته‌ها ──
CATS = [
 ('parts','قطعات برد و الکترونیک','Board components','chip'),
 ('solder','لحیم‌کاری و ابزار آن','Soldering & tools','solder'),
 ('hand','ابزار دستی برق‌کاری','Hand tools','tools'),
 ('measure','ابزار اندازه‌گیری','Measurement tools','measure'),
 ('computer','کیبورد، موس و جانبی کامپیوتر','PC peripherals','keyboard'),
 ('audio','صوت و تصویر','Audio & video','audio'),
 ('network','شبکه و ارتباطات','Networking','network'),
 ('cables','کابل و سیم','Cables & wires','cable'),
 ('light','روشنایی و نورپردازی','Lighting','light'),
 ('power','برق، کلید و حفاظت','Power & protection','zap'),
 ('supply','تغذیه، شارژر و باتری','Power supply & batteries','battery'),
 ('cool','خنک‌کننده و حرارتی','Cooling & thermal','fan'),
 ('tv','تلویزیون، آنتن و گیرنده','TV & antenna','tv'),
 ('mobile','جانبی موبایل و خودرو','Mobile & car accessories','phone'),
 ('home','لوازم خانگی کوچک','Small home appliances','fan'),
 ('office','اداره، آموزش و سرگرمی','Office & education','measure'),
 ('repair','خدمات تعمیر و قطعات یدکی','Repair services & spare parts','tools'),
 ('kits','کیت و ماژول آموزشی','Educational kits & modules','chip'),
]
d['categories'] = [{'id':c[0],'name':c[1],'nameEn':c[2],'glyph':c[3],'parentId':None,'order':i+1,'active':True,
  'description':'','descriptionEn':'','createdAt':now} for i,c in enumerate(CATS)]

BRANDS = [('tsco','تسکو','TSCO','ایران'),('panasonic','پاناسونیک','Panasonic','ژاپن'),('xiaomi','شیائومی','Xiaomi','چین'),
 ('baseus','بیسوس','Baseus','چین'),('anker','انکر','Anker','چین'),('logitech','لوجیتک','Logitech','سوئیس'),
 ('samsung','سامسونگ','Samsung','کره'),('lg','ال‌جی','LG','کره'),('khorasan','خراسان افشان','Khorasan Afshan','ایران'),
 ('simia','سیمیا','Simia','ایران'),('gen','جنرال','Generic','—'),('schneider','اشنایدر','Schneider','فرانسه'),
 ('arduino','آردوینو','Arduino','ایتالیا'),('hyundai','هیوندای','Hyundai','کره')]
d['brands'] = [{'id':b[0],'name':b[1],'nameEn':b[2],'active':True,'country':b[3],'createdAt':now} for b in BRANDS]

# ── محصولات: (cat, name, nameEn, brand, price, oldPrice, stock) ──
P = [
 ('parts','مقاومت کربنی ۱/۴ وات (بسته ۱۰ عددی)','Carbon resistor 1/4W (10pk)','gen',20000,None,300),
 ('parts','خازن الکترولیتی 470uF 25V','Electrolytic capacitor 470uF 25V','gen',35000,None,250),
 ('parts','دیود یک‌سوساز 1N4007','Rectifier diode 1N4007','gen',5000,None,400),
 ('parts','آی‌سی تایمر NE555','Timer IC NE555','gen',25000,None,180),
 ('parts','ترانزیستور NPN مدل 2N2222','NPN transistor 2N2222','gen',15000,None,220),
 ('parts','رگولاتور ولتاژ 7805','Voltage regulator 7805','gen',35000,None,150),
 ('parts','رله ۱۲ ولت تک‌کنتاکت','12V relay single-pole','gen',145000,None,120),
 ('parts','فیوز شیشه‌ای (بسته ۲۰ عددی)','Glass fuse set (20pk)','gen',55000,None,140),
 ('parts','میکروسوییچ فشاری (بسته ۱۰ عددی)','Micro switch (10pk)','gen',85000,None,130),
 ('parts','کنتاکتور ۳۲ آمپر','Contactor 32A','schneider',2850000,3100000,25),
 ('solder','هویه قلمی ۴۰ وات','Soldering iron 40W','gen',450000,520000,60),
 ('solder','سیم قلع ۵۰ گرمی ۶۰/۴۰','Solder wire 50g 60/40','gen',850000,None,70),
 ('solder','روغن لحیم (فلکس)','Soldering flux','gen',120000,None,90),
 ('solder','قلع‌کش پمپی','Desoldering pump','gen',180000,None,55),
 ('solder','پایه هویه فنری','Soldering iron stand','gen',160000,None,40),
 ('solder','نوک هویه ۹۰۰M (بسته ۵ عددی)','Soldering tip 900M (5pk)','gen',220000,None,65),
 ('solder','اسپری تمیزکننده برد','PCB cleaner spray','gen',220000,None,80),
 ('solder','اسپری چرب‌کننده کنتاکت','Contact lubricant spray','gen',240000,None,60),
 ('hand','سیم‌چین ۶ اینچی','Diagonal cutter 6"','gen',280000,None,70),
 ('hand','سیم‌لخت‌کن اتوماتیک','Automatic wire stripper','gen',320000,None,55),
 ('hand','دستگاه سوکت‌زن شبکه','Crimping tool RJ45','gen',680000,750000,40),
 ('hand','انبردست ۸ اینچی','Combination pliers 8"','gen',350000,None,60),
 ('hand','دم‌باریک ۶ اینچی','Long-nose pliers 6"','gen',310000,None,58),
 ('hand','ست پیچ‌گوشتی دقیق ۳۲ پارچه','Precision screwdriver set 32pc','gen',420000,None,50),
 ('hand','فازمتر نئونی','Neon phase tester','gen',45000,None,200),
 ('hand','چسب برق نواری (بسته ۵)','Electrical tape (5pk)','gen',95000,None,150),
 ('measure','مولتی‌متر دیجیتال DT830','Digital multimeter DT830','gen',620000,690000,45),
 ('measure','مولتی‌متر کلمپی دیجیتال','Clamp multimeter','gen',1250000,None,30),
 ('measure','اهم‌تر رومیزی','Bench ohmmeter','gen',980000,None,20),
 ('measure','سیم اهم‌تر با گیره','Ohmmeter test leads','gen',380000,None,50),
 ('measure','کالیبراتور دما؟ نه — دماسنج لیزری','Laser thermometer','gen',890000,None,25),
 ('computer','کیبورد گیمینگ تسکو TK 8124 GA','TSCO keyboard TK 8124 GA','tsco',1150000,1290000,35),
 ('computer','ست کیبورد و موس بی‌سیم تسکو TKM 7019W','TSCO wireless combo TKM 7019W','tsco',1850000,None,28),
 ('computer','کیبورد باسیم تسکو TK 8045','TSCO keyboard TK 8045','tsco',980000,None,32),
 ('computer','کیبورد بی‌سیم تسکو TK-7005W','TSCO wireless keyboard TK-7005W','tsco',1450000,None,22),
 ('computer','موس پد ژله‌ای','Gel mouse pad','gen',120000,None,100),
 ('computer','فلش مموری ۳۲ گیگ USB3','Flash drive 32GB USB3','xiaomi',620000,None,60),
 ('computer','هاب ۴ پورت USB','4-port USB hub','baseus',620000,None,45),
 ('audio','هدست بی‌سیم شیائومی','Xiaomi wireless headset','xiaomi',780000,860000,40),
 ('audio','هندزفری باسیم تایپ‌سی','Wired earphones USB-C','baseus',650000,None,55),
 ('audio','بلندگوی بلوتوثی قابل حمل','Portable BT speaker','anker',1650000,None,30),
 ('audio','میکروفون یقه‌ای سیمی','Lavalier microphone','gen',540000,None,35),
 ('audio','رادیو رومیزی FM','FM table radio','panasonic',890000,None,18),
 ('audio','کابل AUX نری به نری ۱ متری','AUX cable 1m','baseus',180000,None,90),
 ('audio','سوکت AUX (بسته ۵ عددی)','AUX jack (5pk)','gen',120000,None,70),
 ('network','مودم 4G جیبی','4G pocket modem','xiaomi',2850000,None,20),
 ('network','مودم رومیزی VDSL','VDSL desktop modem','lg',3450000,None,15),
 ('network','سوییچ شبکه ۵ پورت','5-port network switch','gen',1150000,None,25),
 ('network','کارت شبکه بی‌سیم تسکو TW 1010','TSCO wireless adapter TW 1010','tsco',720000,None,30),
 ('network','کارت شبکه USB بی‌سیم تسکو TW1015','TSCO USB wireless TW1015','tsco',850000,None,28),
 ('network','دانگل بلوتوث USB','USB Bluetooth dongle','baseus',380000,None,60),
 ('network','کابل شبکه cat6 (متری)','Cat6 network cable (per m)','simia',25000,None,500),
 ('network','سوکت RJ45 (بسته ۱۰ عددی)','RJ45 connector (10pk)','gen',95000,None,120),
 ('cables','سیم دورشته ۲×۱.۵ (حلقه ۱۰۰ متری)','2x1.5 twin wire (100m)','khorasan',2850000,None,40),
 ('cables','کابل برق ۳×۲.۵ (حلقه ۵۰ متری)','3x2.5 power cable (50m)','khorasan',3400000,None,25),
 ('cables','سیم آنتن کوآکسیال (متری)','Coax antenna wire (per m)','simia',15000,None,600),
 ('cables','سیم تلفن ۴ رشته (متری)','4-core telephone wire (per m)','simia',12000,None,600),
 ('cables','کابل HDMI دو متری','HDMI cable 2m','baseus',480000,None,55),
 ('cables','وارنیش حرارتی (ست ۴۰ عددی)','Heat shrink set 40pc','gen',140000,None,85),
 ('cables','سرسیم کابل (بسته ۵۰ عددی)','Cable lugs (50pk)','gen',60000,None,110),
 ('cables','کابل برق دوشاخه به C13','Power cord C13','gen',95000,None,130),
 ('light','لامپ LED دوازده وات','LED bulb 12W','gen',145000,None,200),
 ('light','ریسه ال‌ای‌دی ۵ متری رنگی','LED strip 5m RGB','gen',850000,940000,60),
 ('light','چراغ قوه شارژی LED','Rechargeable LED flashlight','gen',420000,None,70),
 ('light','چراغ مطالعه کلیمپی','Clip desk lamp','gen',680000,None,40),
 ('light','چراغ خواب سنسوردار','Sensor night light','gen',190000,None,90),
 ('light','پروژکتور LED سی وات','LED projector 30W','gen',1450000,None,30),
 ('light','پروژکتور LED صد وات','LED projector 100W','gen',3200000,None,15),
 ('power','سه‌راهی برق کلیددار ۱.۵ متری','3-outlet power strip 1.5m','gen',350000,None,80),
 ('power','محافظ برق یخچال/کامپیوتر','Surge protector','gen',480000,None,65),
 ('power','کلید مینیاتوری ۱۶ آمپر','MCB 16A','schneider',185000,None,100),
 ('power','کلید مینیاتوری ۲۵ آمپر','MCB 25A','schneider',195000,None,90),
 ('power','محافظ جان (RCD) ۴۰ آمپر','RCD 40A','schneider',1850000,None,20),
 ('power','کلید و پریز توکار سفید','Wall switch & socket','gen',220000,None,120),
 ('power','کلید کولر چهارپل','Cooler switch 4-pole','gen',60000,None,100),
 ('power','دوشاخه نری ۱۶ آمپر','16A plug male','gen',85000,None,150),
 ('power','پریز مادگی روکار','Surface socket female','gen',95000,None,140),
 ('power','داکت شیاردار ۲ متری','Slotted duct 2m','gen',95000,None,200),
 ('supply','پاوربانک ۱۰ هزار میلی‌آمپر','Power bank 10000mAh','xiaomi',1150000,1280000,45),
 ('supply','شارژر دیواری ۲ آمپر تایپ‌سی','Wall charger 2A USB-C','baseus',380000,None,80),
 ('supply','شارژر فندکی دو پورت','Car charger dual-port','baseus',290000,None,70),
 ('supply','آداپتور ۱۲ ولت ۲ آمپر','Adapter 12V 2A','gen',420000,None,75),
 ('supply','منبع تغذیه ۱۲ ولت ۵ آمپر صنعتی','Industrial PSU 12V 5A','gen',980000,None,35),
 ('supply','باتری قلمی آلکالاین (بسته ۴)','AA alkaline (4pk)','panasonic',95000,None,200),
 ('supply','باتری کتابی ۹ ولت','9V battery','panasonic',65000,None,150),
 ('cool','فن ۱۲ ولت ۸ سانتی‌متر','Fan 12V 8cm','gen',185000,None,90),
 ('cool','فن ۲۲۰ ولت ۱۲ سانتی‌متر','Fan 220V 12cm','gen',320000,None,60),
 ('cool','هیت‌سینک آلومینیومی','Aluminum heat sink','gen',95000,None,120),
 ('cool','خمیر سیلیکون رسانا','Thermal paste','gen',120000,None,110),
 ('cool','واشر عایق ترانزیستور (بسته ۲۰)','Insulator washers (20pk)','gen',45000,None,140),
 ('tv','کنترل تلویزیون universale','Universal TV remote','gen',320000,None,60),
 ('tv','کنترل کولر آبی','Cooler remote','gen',280000,None,40),
 ('tv','آنتن رومیزی دیجیتال','Digital table antenna','gen',380000,None,45),
 ('tv','آنتن هوایی یاقویی','Roof antenna','gen',620000,None,30),
 ('tv','پایه دیواری تلویزیون ۳۲-۵۵ اینچ','TV wall mount 32-55"','gen',780000,None,35),
 ('tv','رک دیواری ۹ یونیت','Wall rack 9U','gen',2400000,None,12),
 ('tv','اندروید باکس ۴ گیگ','Android box 4GB','xiaomi',3200000,None,20),
 ('tv','ریسیور دیجیتال زمینی','Digital terrestrial receiver','gen',890000,None,25),
 ('mobile','هولدر موبایل خودرو مگناطیسی','Magnetic car phone holder','baseus',380000,None,60),
 ('mobile','هولدر رومیزی تاشو','Foldable desk holder','gen',290000,None,70),
 ('mobile','مونوپاد سه‌پایه بلوتوثی','BT selfie stick tripod','xiaomi',450000,None,40),
 ('mobile','دسته بازی بی‌سیم','Wireless gamepad','logitech',1250000,None,25),
 ('mobile','مبدل USB-C به HDMI','USB-C to HDMI adapter','baseus',420000,None,50),
 ('home','پنکه رومیزی ۱۲ اینچی','Table fan 12"','gen',890000,None,30),
 ('home','پنکه شارژی قابل حمل','Rechargeable portable fan','xiaomi',1450000,None,35),
 ('home','حشره‌کش برقی دو لامپ','Electric insect killer','gen',520000,None,28),
 ('home','ترازوی آشپزخانه دیجیتال','Digital kitchen scale','gen',680000,None,30),
 ('office','ماشین‌حساب ۱۲ رقمی','12-digit calculator','gen',450000,None,40),
 ('office','کیت آموزشی آردوینو Uno','Arduino Uno starter kit','arduino',1850000,1990000,30),
 ('office','کیت رباتیک کودک','Kids robotics kit','arduino',2400000,None,15),
 ('repair','تعمیر تلفن بی‌سیم پاناسونیک','Panasonic cordless phone repair','panasonic',0,None,999),
 ('repair','تعمیر تلویزیون LCD','LCD TV repair service','gen',0,None,999),
 ('repair','صفحه‌کلید یدکی تلفن پاناسونیک','Panasonic phone keypad spare','panasonic',280000,None,25),
 ('repair','تلفن رومیزی پاناسونیک','Panasonic desk phone','panasonic',3200000,None,18),
 ('repair','تلفن بی‌سیم پاناسونیک تک‌گوشی','Panasonic cordless phone','panasonic',4800000,None,12),
 ('kits','ماژول رله تک‌کاناله','Single relay module','gen',185000,None,80),
 ('kits','ماژول بلوتوث HC-05','Bluetooth module HC-05','gen',220000,None,70),
 ('kits','ماژول سنسور دما DHT11','DHT11 sensor module','gen',160000,None,75),
 ('kits','برد تست ۸۳۰ سوراخ','Breadboard 830 ties','gen',140000,None,90),
 ('kits','ست جامپر وایر','Jumper wires set','gen',110000,None,95),
 ('kits','شاسی مینیاتوری فشاری','Mini push-button chassis','gen',95000,None,130),
]
prods=[]
for i,(c,n,en,b,pr,op,st) in enumerate(P):
    pid=f'ys-{i+1:03d}'
    desc = f'{n} با گارانتی اصالت و مهلت تست ۷ روزهٔ فروشگاه یاسایی؛ موجود در فروشگاه تهران، نارمک (هفت‌حوض) و آمادهٔ ارسال به سراسر ایران.'
    prods.append({'id':pid,'sku':pid.upper(),'barcode':'','name':n,'nameEn':en,'categoryId':c,'brandId':b,
      'brandName':next(x[1] for x in BRANDS if x[0]==b),'brandNameEn':next(x[2] for x in BRANDS if x[0]==b),
      'glyph':next(x[3] for x in CATS if x[0]==c),'price':pr,'oldPrice':op,'cost':int(pr*0.78) if pr else 0,
      'stock':st,'reserved':0,'authenticity':'original','warrantyMonths':6,'images':[],'specs':{},
      'description':desc,'descriptionEn':en+' — genuine parts with 7-day test window, shipping across Iran.',
      'tags':[n.split()[0],'یاسایی','تهران'],'featured':i<12,'active':True,'weight':0,'views':0,'sold':0,
      'ratingAvg':0,'ratingCount':0,'createdAt':now,'updatedAt':now})
d['products']=prods

# ── کاربران/سفارش‌ها/صفحات ──
d['users']=[{'id':'u-admin','username':'admin','passwordHash':HASH,'role':'owner','mustChangePassword':True,
  'name':'مدیر یاسایی','email':'','phone':'','createdAt':now,'lastSeenAt':None,'active':True}]
for k in ('sessions','otps','carts','orders','reviews','tickets','supportMessages','feedback','coupons','ads',
          'priceAlerts','visits','visitSessions','audit','telegramInbox','outbox','clientErrors','bans','visitors','lotteries'):
    if k in d: d[k]=[] if isinstance(d[k],list) else {}
d['stats']={}; d['imageHashes']={}; d['telegramSubs']={}
d['pages']=remap(d['pages'])
d['pages']['about']['hero']={'title':'دربارهٔ یاسایی','titleEn':'About Yassaei',
  'subtitle':'فروشگاهی ۲۰۰ متری در نارمک تهران، با تنوعی که از مقاومت یک هزار تومانی تا کنتاکتور صنعتی را یک‌جا جلویت می‌گذارد',
  'subtitleEn':'A 200m² store in Narmak, Tehran — from a tiny resistor to industrial contactors, all under one roof'}
d['pages']['terms']['hero']['subtitle']='آخرین به‌روزرسانی: شهریور ۱۴۰۴'
d['pages']['terms']['hero']['subtitleEn']='Last updated: Sept 2026'
d['seeded']=True
d['meta']={'brand':'yassaei','seed':'v1'}
json.dump(d, open('data/db.json','w'), ensure_ascii=False, indent=1)
print('db yassaei ready: cats',len(d['categories']),'brands',len(d['brands']),'products',len(d['products']))
