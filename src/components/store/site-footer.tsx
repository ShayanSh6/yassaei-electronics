"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Phone, MapPin, Clock, Send, Instagram, Mail, ShieldCheck, Truck, BadgeCheck, CreditCard, Megaphone, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa } from "@/lib/store/router";
import type { StoreInfo } from "@/lib/store/types";
import { Button } from "@/components/ui/button";

const TRUST_ITEMS = [
  { icon: ShieldCheck, title: "ضمانت اصالت کالا", sub: "مرجوعی تا ۷ روز بدون پرسش" },
  { icon: Truck, title: "ارسال به سراسر ایران", sub: "رایگان برای سفارش‌های بالا" },
  { icon: BadgeCheck, title: "مهلت تست کالا", sub: "تست در محل فروشگاه" },
  { icon: CreditCard, title: "پرداخت در محل", sub: "ویژهٔ سفارش‌های تهران" },
];

export function SiteFooter() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 5 * 60 * 1000,
  });
  const store: StoreInfo | undefined = data?.store;
  const [nlValue, setNlValue] = useState("");

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const v = nlValue.trim();
    const isPhone = /^0\d{10}$/.test(v.replace(/\s/g, ""));
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!isPhone && !isEmail) {
      toast.error("ایمیل یا شماره موبایل معتبر وارد کنید");
      return;
    }
    try {
      const subs = JSON.parse(localStorage.getItem("yassaei.newsletter") ?? "[]") as string[];
      if (!subs.includes(v)) localStorage.setItem("yassaei.newsletter", JSON.stringify([...subs, v]));
    } catch {
      localStorage.setItem("yassaei.newsletter", JSON.stringify([v]));
    }
    toast.success("عضویت شما در خبرنامه ثبت شد", { description: "تخفیف‌ها را زودتر از همه می‌شنوید" });
    setNlValue("");
  };

  return (
    <footer className="mt-auto border-t border-border/50 bg-card/40 print:hidden">
      {/* trust bar */}
      <div className="border-b border-border/40 bg-background/60">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 lg:grid-cols-4 gap-3 py-5">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex items-center gap-3">
              <span className="grid place-items-center size-10 rounded-xl bg-brand/10 text-brand shrink-0">
                <t.icon className="size-5" />
              </span>
              <div className="leading-tight">
                <div className="text-xs font-bold">{t.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* newsletter strip */}
      <div className="border-b border-border/40 bg-gradient-to-l from-brand/10 via-transparent to-brand/10">
        <div className="mx-auto max-w-7xl px-4 py-5 flex flex-col lg:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 text-center lg:text-right">
            <span className="hidden sm:grid place-items-center size-11 rounded-xl bg-brand/15 text-brand shrink-0">
              <Megaphone className="size-5" />
            </span>
            <div>
              <div className="text-sm font-bold">عضویت در خبرنامهٔ یاسایی</div>
              <div className="text-[11px] text-muted-foreground">از تخفیف‌های هفتگی و کالاهای تازه باخبر شوید</div>
            </div>
          </div>
          <form onSubmit={subscribe} className="flex w-full max-w-md gap-2">
            <input
              value={nlValue}
              onChange={(e) => setNlValue(e.target.value)}
              placeholder="ایمیل یا شماره موبایل…"
              className="flex-1 h-10 rounded-xl bg-card border border-border/70 px-4 text-xs outline-none focus:border-brand/60 transition-colors"
              aria-label="ایمیل یا شماره موبایل برای خبرنامه"
            />
            <Button type="submit" size="sm" className="h-10 px-5 font-bold">عضویت</Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4 text-sm">
        {/* brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center size-9 rounded-xl bg-brand/15 text-brand">
              <Zap className="size-5" />
            </span>
            <div>
              <div className="font-extrabold">الکتریکی یاسایی تهران</div>
              <div className="text-[10px] text-muted-foreground">از سال {toFa(1396)} در نارمک، هفت‌حوض</div>
            </div>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            {store?.description ||
              "فروشگاه تخصصی قطعات الکترونیک و لوازم الکتریکی با ضمانت اصالت کالا، مهلت تست و ارسال به سراسر ایران."}
          </p>
          <div className="flex items-center gap-2">
            {store?.socials?.telegram && (
              <a href={store.socials.telegram} target="_blank" rel="noreferrer" aria-label="تلگرام"
                 className="grid place-items-center size-8 rounded-lg bg-secondary hover:bg-brand/20 hover:text-brand transition-colors">
                <Send className="size-4" />
              </a>
            )}
            {store?.socials?.instagram && (
              <a href={store.socials.instagram} target="_blank" rel="noreferrer" aria-label="اینستاگرام"
                 className="grid place-items-center size-8 rounded-lg bg-secondary hover:bg-brand/20 hover:text-brand transition-colors">
                <Instagram className="size-4" />
              </a>
            )}
            {store?.email && (
              <a href={`mailto:${store.email}`} aria-label="ایمیل"
                 className="grid place-items-center size-8 rounded-lg bg-secondary hover:bg-brand/20 hover:text-brand transition-colors">
                <Mail className="size-4" />
              </a>
            )}
          </div>
        </div>

        {/* quick links */}
        <div>
          <h4 className="font-bold text-sm mb-3">دسترسی سریع</h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><a className="hover:text-brand transition-colors" href="#/catalog">همهٔ محصولات</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?featured=1">پیشنهاد ویژه</a></li>
            <li>
              <a className="hover:text-brand transition-colors flex items-center gap-1.5" href="#/track">
                <PackageSearch className="size-3.5" /> پیگیری سفارش
              </a>
            </li>
            <li><a className="hover:text-brand transition-colors" href="#/page/about">دربارهٔ یاسایی</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/page/faq">پرسش‌های متداول</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/page/terms">قوانین فروشگاه</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/page/contact">تماس با ما</a></li>
          </ul>
        </div>

        {/* categories */}
        <div>
          <h4 className="font-bold text-sm mb-3">دسته‌های پرفروش</h4>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=parts">قطعات برد و الکترونیک</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=solder">لحیم‌کاری و ابزار</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=measure">ابزار اندازه‌گیری</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=power">برق، کلید و حفاظت</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=supply">تغذیه، شارژر و باتری</a></li>
            <li><a className="hover:text-brand transition-colors" href="#/catalog?cat=kits">کیت و ماژول آموزشی</a></li>
          </ul>
        </div>

        {/* contact */}
        <div>
          <h4 className="font-bold text-sm mb-3">تماس با فروشگاه</h4>
          <ul className="space-y-3 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <MapPin className="size-4 text-brand shrink-0 mt-0.5" />
              <span className="leading-5">{store?.address || "تهران، نارمک، خیابان مدنی، جانبازان غربی"}</span>
            </li>
            <li className="flex gap-2 items-center">
              <Phone className="size-4 text-brand shrink-0" />
              <span className="num" dir="ltr">{store?.phone || "02177906667"}</span>
            </li>
            <li className="flex gap-2 items-start">
              <Clock className="size-4 text-brand shrink-0 mt-0.5" />
              <div className="space-y-1">
                {store?.workingHours?.map((h) => (
                  <div key={h.day} className="flex gap-2">
                    <span>{h.fa}:</span>
                    <span className="text-foreground/80">{h.time}</span>
                  </div>
                )) || <span>هر روز ۹ تا ۲۱</span>}
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>© {toFa(1404)} یاسایی الکترونیک — نسخهٔ بازسازی‌شده با Next.js</span>
          <button onClick={() => navigate("/admin")} className="hover:text-brand transition-colors">
            ورود مدیران
          </button>
        </div>
      </div>
    </footer>
  );
}
