"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search, ChevronLeft, Package, ShoppingCart, Users, Zap, Sparkles, Flame, TrendingUp, Star, Timer, History,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman } from "@/lib/store/router";
import type { HomePayload, Product } from "@/lib/store/types";
import { useRecentlyViewed } from "@/lib/store/cart-store";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      <Skeleton className="h-72 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, href, accent, extra }: { icon: typeof Flame; title: string; href?: string; accent?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <h2 className="flex items-center gap-2 text-lg sm:text-xl font-extrabold">
        <span className={`grid place-items-center size-9 rounded-xl ${accent ?? "bg-brand/15 text-brand"}`}>
          <Icon className="size-5" />
        </span>
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {extra}
        {href && (
          <a href={href} className="flex items-center gap-1 text-xs text-brand hover:gap-2 transition-all">
            مشاهده همه <ChevronLeft className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Countdown to next midnight (deal window) — hydration-safe. */
function DealCountdown() {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      const diff = Math.max(0, end.getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setLeft(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-[11px] text-red-400 font-bold"
      dir="ltr"
      aria-label="زمان باقی‌مانده پیشنهاد ویژه"
    >
      <Timer className="size-3.5" />
      <span className="num tracking-wider">{left ?? "--:--:--"}</span>
    </span>
  );
}

/** Recently viewed strip (client store, renders only when history exists). */
function RecentlyViewed() {
  const ids = useRecentlyViewed((s) => s.ids);
  const { data } = useQuery({
    queryKey: ["recent", ids.join(",")],
    queryFn: () => api.productsByIds(ids.slice(0, 4)),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  if (ids.length === 0 || !data || data.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-12">
      <SectionHeader icon={History} title="بازدیدهای اخیر شما" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {data.map((p: Product) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export function HomeView() {
  const { data, isLoading } = useQuery({ queryKey: ["home"], queryFn: api.home, staleTime: 60 * 1000 });
  const [q, setQ] = useState("");

  if (isLoading || !data) return <HomeSkeleton />;

  const home = data as HomePayload;

  return (
    <div className="pb-10">
      {/* ticker */}
      <div className="bg-brand-soft border-b border-brand/20 overflow-hidden" dir="rtl">
        <div className="flex w-max ticker-track gap-10 py-1.5" style={{ "--ticker-speed": "38s" } as React.CSSProperties}>
          {[...home.ticker, ...home.ticker].map((t, i) => (
            <span key={i} className="whitespace-nowrap text-[11px] text-brand flex items-center gap-2">
              <Sparkles className="size-3 shrink-0" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-8 sm:pt-14">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div className="space-y-5 text-center lg:text-right">
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Badge variant="outline" className="border-brand/40 text-brand bg-brand/10 gap-1.5 py-1.5 px-3">
                  <Zap className="size-3.5" /> بورس قطعات الکترونیک تهران — از سال {toFa(1396)}
                </Badge>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.3]"
              >
                هر قطعه‌ای که لازم داری،
                <br />
                <span className="brand-text">یک‌جا در یاسایی</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }}
                className="text-sm sm:text-base text-muted-foreground leading-7 max-w-xl mx-auto lg:mx-0"
              >
                از مقاومت یک هزار تومانی تا کنتاکتور صنعتی؛ {toFa(home.stats.products)} کالای اصل با ضمانت اصالت،
                مهلت تست ۷ روزه و ارسال به سراسر ایران.
              </motion.p>

              {/* hero search */}
              <motion.form
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.24 }}
                className="flex max-w-lg mx-auto lg:mx-0 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (q.trim()) navigate(`/catalog?q=${encodeURIComponent(q.trim())}`);
                }}
              >
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="مثلاً: مقاومت، آی‌سی ۵۵۵، هویه…"
                    className="w-full h-12 rounded-xl bg-card border border-border/70 pr-10 pl-4 text-sm outline-none focus:border-brand/60 transition-colors"
                    aria-label="جست‌وجوی محصولات"
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 px-6 font-bold">جست‌وجو</Button>
              </motion.form>

              {/* stats */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="flex justify-center lg:justify-start gap-6 pt-2"
              >
                {[
                  { icon: Package, label: "کالای فعال", value: home.stats.products },
                  { icon: ShoppingCart, label: "سفارش موفق", value: Math.max(home.stats.orders, 1200) },
                  { icon: Users, label: "مشتری", value: Math.max(home.stats.users, 800) },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <s.icon className="size-4 text-brand" />
                    <div className="leading-tight">
                      <div className="font-extrabold num">{toFa(s.value.toLocaleString("en-US"))}+</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* hero art */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block relative"
            >
              <div className="absolute inset-0 bg-brand/20 blur-3xl rounded-full" />
              { }
              <img
                src="/assets/img/hero-circuit.svg"
                alt="مدار الکترونیک یاسایی"
                className="relative w-full drop-shadow-[0_20px_50px_#3dabff33]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="mx-auto max-w-7xl px-4">
        <SectionHeader icon={Package} title="دسته‌بندی‌ها" href="#/catalog" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {home.categories.slice(0, 12).map((c, i) => (
            <motion.a
              key={c.id}
              href={`#/catalog?cat=${c.id}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:border-brand/50 hover:-translate-y-0.5 transition-all group"
            >
              <span className="size-14 rounded-xl overflow-hidden bg-secondary/40 grid place-items-center group-hover:scale-105 transition-transform">
                { }
                <img src={c.image || "/uploads/cat-parts.svg"} alt={c.name} className="size-full object-contain p-1.5" loading="lazy" />
              </span>
              <span className="text-[11px] font-medium text-center leading-4 clamp-2">{c.name}</span>
              <span className="text-[10px] text-muted-foreground num">{toFa(c.count)} کالا</span>
            </motion.a>
          ))}
        </div>
      </section>

      {/* deals */}
      {home.deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <SectionHeader
            icon={Flame}
            title="پیشنهاد شگفت‌انگیز"
            href="#/catalog?sort=popular"
            accent="bg-red-500/15 text-red-400"
            extra={<DealCountdown />}
          />
          <Carousel opts={{ direction: "rtl", align: "start" }} className="w-full">
            <CarouselContent className="-ml-3">
              {home.deals.map((p) => (
                <CarouselItem key={p.id} className="pl-3 basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <ProductCard product={p} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:grid" />
            <CarouselNext className="hidden sm:grid" />
          </Carousel>
        </section>
      )}

      {/* featured */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <SectionHeader icon={Star} title="کالاهای ویژه" href="#/catalog?featured=1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {home.featured.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* best sellers + newest */}
      <section className="mx-auto max-w-7xl px-4 pt-12 grid lg:grid-cols-2 gap-8">
        <div>
          <SectionHeader icon={TrendingUp} title="پرفروش‌ترین‌ها" href="#/catalog?sort=popular" />
          <div className="space-y-2.5">
            {home.bestSellers.slice(0, 5).map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="w-full glass rounded-xl p-2.5 flex items-center gap-3 hover:border-brand/40 transition-colors text-right"
              >
                <span className="grid place-items-center size-7 rounded-lg bg-brand/15 text-brand text-xs font-extrabold num shrink-0">
                  {toFa(i + 1)}
                </span>
                { }
                <img src={p.images?.[0]} alt="" className="size-12 object-contain rounded-lg bg-secondary/40 shrink-0" loading="lazy" />
                <span className="flex-1 text-xs clamp-2 leading-5">{p.name}</span>
                <span className="text-[11px] text-brand font-bold num shrink-0">{formatToman(p.price)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionHeader icon={Sparkles} title="جدیدترین کالاها" href="#/catalog?sort=newest" />
          <div className="space-y-2.5">
            {home.newest.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="w-full glass rounded-xl p-2.5 flex items-center gap-3 hover:border-brand/40 transition-colors text-right"
              >
                { }
                <img src={p.images?.[0]} alt="" className="size-12 object-contain rounded-lg bg-secondary/40 shrink-0" loading="lazy" />
                <span className="flex-1 text-xs clamp-2 leading-5">{p.name}</span>
                <span className="text-[11px] text-brand font-bold num shrink-0">{formatToman(p.price)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* recently viewed */}
      <RecentlyViewed />

      {/* brands */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <SectionHeader icon={Zap} title="برندها" />
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {home.brands.slice(0, 14).map((b) => (
            <a
              key={b.id}
              href={`#/catalog?brand=${b.id}`}
              className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:border-brand/40 transition-all hover:-translate-y-0.5"
            >
              <span className="size-10 grid place-items-center">
                { }
                <img src={b.image || "/assets/img/brands/no_name.svg"} alt={b.nameEn} className="max-size-full max-h-9 object-contain" loading="lazy" />
              </span>
              <span className="text-[10px] text-muted-foreground">{b.name}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
