"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, ShoppingCart, User2, Menu, Phone, LayoutDashboard, LogOut, Package, X, Zap,
} from "lucide-react";
import { formatToman, navigate, toFa } from "@/lib/store/router";
import { api } from "@/lib/store/api";
import { useCart } from "@/lib/store/cart-store";
import { useAuth } from "@/lib/store/auth-store";
import type { Category } from "@/lib/store/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  name: string;
  price: number;
  images: string[];
}

export function SiteHeader({ categories }: { categories: Category[] }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const cartCount = useCart((s) => s.lines.reduce((acc, l) => acc + l.qty, 0));
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const t = setTimeout(async () => {
      try {
        const res = await api.suggest(trimmed);
        setSuggestions(res.suggestions);
        setOpenSuggest(true);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenSuggest(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submitSearch = () => {
    if (!q.trim()) return;
    setOpenSuggest(false);
    navigate(`/catalog?q=${encodeURIComponent(q.trim())}`);
  };

  const topCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 8);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "glass shadow-[0_4px_24px_-8px_#0006]"
          : "bg-background/80 backdrop-blur-md border-transparent",
      )}
    >
      {/* top strip */}
      <div className="hidden md:flex items-center justify-center gap-6 bg-brand-soft text-[11px] text-brand py-1.5 px-4">
        <span className="flex items-center gap-1">
          <Phone className="size-3" /> ۰۲۱-{toFa("77906667")}
        </span>
        <span>ارسال رایگان سفارش‌های بالای {formatToman(2000000)} تومان</span>
        <span>ضمانت اصالت کالا؛ مرجوع تا ۷ روز</span>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 flex items-center gap-2 sm:gap-4 h-14 sm:h-16">
        {/* logo */}
        <a
          href="#/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="فروشگاه یاسایی"
        >
          <span className="grid place-items-center size-9 sm:size-10 rounded-xl bg-brand/15 text-brand group-hover:bg-brand/25 transition-colors">
            <Zap className="size-5 sm:size-6" />
          </span>
          <span className="hidden sm:block leading-tight">
            <span className="block font-extrabold text-base">یاسایی</span>
            <span className="block text-[10px] text-muted-foreground">قطعات الکترونیک تهران</span>
          </span>
        </a>

        {/* search */}
        <div ref={boxRef} className="relative flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) {
                  setSuggestions([]);
                  setOpenSuggest(false);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              onFocus={() => suggestions.length && setOpenSuggest(true)}
              placeholder="جست‌وجوی قطعه، برند یا کد فنی…"
              className="w-full h-10 rounded-xl bg-secondary/60 border border-border/60 pr-9 pl-9 text-sm outline-none focus:border-brand/60 focus:bg-secondary transition-colors placeholder:text-muted-foreground/70"
              aria-label="جست‌وجو در محصولات"
            />
            {q && (
              <button
                onClick={() => { setQ(""); setSuggestions([]); }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="پاک کردن"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {openSuggest && suggestions.length > 0 && (
            <div className="absolute top-12 inset-x-0 glass rounded-xl shadow-xl overflow-hidden z-50">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setOpenSuggest(false); setQ(""); navigate(`/product/${s.id}`); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/70 text-right transition-colors"
                >
                  { }
                  <img
                    src={s.images?.[0] || "/assets/img/products/p001.svg"}
                    alt=""
                    className="size-9 object-contain rounded-lg bg-secondary/50 shrink-0"
                  />
                  <span className="flex-1 text-xs clamp-2 leading-5">{s.name}</span>
                  <span className="text-[11px] text-brand font-bold num shrink-0">
                    {formatToman(s.price)}
                  </span>
                </button>
              ))}
              <button
                onClick={submitSearch}
                className="w-full py-2 text-[11px] text-brand border-t border-border/50 hover:bg-brand/10 transition-colors"
              >
                مشاهده همهٔ نتایج «{q}»
              </button>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {user?.role === "owner" || user?.role === "staff" ? (
            <Button
              variant="ghost" size="sm"
              className="hidden sm:flex gap-1.5 text-amber-400 hover:text-amber-300"
              onClick={() => navigate("/admin")}
            >
              <LayoutDashboard className="size-4" /> پنل مدیریت
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2">
                <User2 className="size-4" />
                <span className="hidden sm:inline text-xs">{user ? user.name.split(" ")[0] : "ورود"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {user ? (
                <>
                  <DropdownMenuLabel>
                    <div className="font-bold text-sm">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground font-normal" dir="ltr">@{user.username}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <Package className="size-4 ml-2" /> حساب کاربری و سفارش‌ها
                  </DropdownMenuItem>
                  {(user.role === "owner" || user.role === "staff") && (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      <LayoutDashboard className="size-4 ml-2" /> پنل مدیریت
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); toast.success("از حساب خارج شدید"); navigate("/"); }}
                    className="text-red-400 focus:text-red-300"
                  >
                    <LogOut className="size-4 ml-2" /> خروج از حساب
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate("/login")}>
                    <User2 className="size-4 ml-2" /> ورود به حساب
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/register")}>
                    <User2 className="size-4 ml-2" /> ساخت حساب جدید
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline" size="sm"
            className="relative gap-1.5 border-brand/40 hover:bg-brand/10 hover:text-brand"
            onClick={() => navigate("/cart")}
            aria-label="سبد خرید"
          >
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline text-xs">سبد خرید</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid place-items-center size-5 rounded-full bg-brand text-primary-foreground text-[10px] font-bold num">
                {toFa(cartCount)}
              </span>
            )}
          </Button>

          {/* mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="منو">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto">
              <SheetTitle className="text-right">دسته‌بندی‌ها</SheetTitle>
              <nav className="mt-2 flex flex-col gap-0.5">
                {topCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setMobileOpen(false); navigate(`/catalog?cat=${c.id}`); }}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-secondary/70 transition-colors"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-muted-foreground num">{toFa(c.count ?? 0)} کالا</span>
                  </button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* category nav */}
      <nav className="hidden md:block border-t border-border/40" aria-label="دسته‌بندی محصولات">
        <div className="mx-auto max-w-7xl px-4 flex items-center gap-1 overflow-x-auto scroll-slim h-10">
          {topCategories.map((c) => (
            <a
              key={c.id}
              href={`#/catalog?cat=${c.id}`}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
            >
              {c.name}
            </a>
          ))}
          <a
            href="#/catalog"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-brand hover:bg-brand/10 transition-colors mr-auto"
          >
            همهٔ محصولات ←
          </a>
        </div>
      </nav>
    </header>
  );
}
