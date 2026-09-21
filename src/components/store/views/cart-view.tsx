"use client";

import { useQuery } from "@tanstack/react-query";
import { Trash2, Minus, Plus, ShoppingCart, ArrowLeft, TicketPercent, BadgePercent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman } from "@/lib/store/router";
import { useCart } from "@/lib/store/cart-store";
import type { CartValidatedItem } from "@/lib/store/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

export function CartView() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cart-validate", lines],
    queryFn: () => api.validateCart(lines.map((l) => ({ id: l.id, qty: l.qty }))),
    enabled: lines.length > 0,
  });

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 flex flex-col items-center gap-4 text-center">
        <span className="grid place-items-center size-20 rounded-full bg-secondary text-muted-foreground">
          <ShoppingCart className="size-9" />
        </span>
        <p className="font-bold text-lg">سبد خرید شما خالی است</p>
        <p className="text-xs text-muted-foreground">از میان {toFa(121)} کالای فروشگاه، خریدتان را شروع کنید.</p>
        <Button onClick={() => navigate("/catalog")} className="gap-2">
          رفتن به فروشگاه <ArrowLeft className="size-4" />
        </Button>
      </div>
    );
  }

  const items: CartValidatedItem[] = data?.items ?? [];
  const subtotal = data?.subtotal ?? 0;
  const bulkDiscount = data?.bulkDiscount ?? 0;
  const freeShipping = subtotal >= 2_000_000;
  const shipping = freeShipping ? 0 : 120_000;
  const total = Math.max(0, subtotal - discount + shipping);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setCheckingCoupon(true);
    try {
      const res = await api.validateCoupon(coupon.trim(), subtotal);
      setDiscount(res.discount);
      setCouponCode(res.code);
      toast.success(`کد تخفیف اعمال شد (${formatToman(res.discount)} تومان تخفیف)`);
    } catch (e) {
      setDiscount(0);
      setCouponCode(null);
      toast.error(e instanceof Error ? e.message : "کد تخفیف نامعتبر است");
    } finally {
      setCheckingCoupon(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-extrabold mb-6">سبد خرید</h1>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* lines */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: lines.length }).map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 flex gap-4 animate-pulse">
                <div className="size-20 rounded-lg bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-secondary rounded" />
                  <div className="h-4 w-1/3 bg-secondary rounded" />
                </div>
              </div>
            ))
          ) : (
            items.map((item) => {
              const line = lines.find((l) => l.id === item.id);
              if (!line) return null;
              return (
                <div key={item.id} className="glass rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                  { }
                  <img
                    src={item.image}
                    alt={item.name}
                    className="size-16 sm:size-20 object-contain rounded-lg bg-secondary/40 shrink-0 cursor-pointer"
                    onClick={() => navigate(`/product/${item.id}`)}
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/product/${item.id}`)}
                      className="text-xs sm:text-sm font-medium clamp-2 leading-6 hover:text-brand transition-colors text-right"
                    >
                      {item.name}
                    </button>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] text-brand font-bold num">
                        {formatToman(item.unitPrice ?? item.price)} تومان
                      </span>
                      {(item.bulkPercent ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5">
                          <BadgePercent className="size-3" />
                          ٪{toFa(item.bulkPercent)} عمده
                        </span>
                      )}
                      {(item.bulkPercent ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground line-through num">
                          {formatToman(item.price)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 shrink-0">
                    <div className="flex items-center rounded-lg border border-border/70 overflow-hidden">
                      <button
                        onClick={() => setQty(item.id, line.qty + 1)}
                        disabled={line.qty >= item.stock}
                        className="grid place-items-center size-8 hover:bg-secondary/70 disabled:opacity-40 transition-colors"
                        aria-label="افزایش"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center text-xs font-bold num">{toFa(line.qty)}</span>
                      <button
                        onClick={() => setQty(item.id, line.qty - 1)}
                        className="grid place-items-center size-8 hover:bg-secondary/70 transition-colors"
                        aria-label="کاهش"
                      >
                        <Minus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => { remove(item.id); toast("از سبد حذف شد"); }}
                      className="grid place-items-center size-8 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={clear}>
              خالی کردن سبد
            </Button>
            <Button variant="ghost" size="sm" className="text-brand text-xs gap-1" onClick={() => navigate("/catalog")}>
              ادامهٔ خرید <ArrowLeft className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* summary */}
        <div className="glass rounded-2xl p-5 space-y-4 sticky top-32">
          <h2 className="font-bold text-sm">خلاصهٔ سفارش</h2>

          {/* coupon */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TicketPercent className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="کد تخفیف (مثلاً YASSEI10)"
                className="h-9 pr-8 text-xs"
                dir="ltr"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={applyCoupon} disabled={checkingCoupon}>
              {checkingCoupon ? "…" : "اعمال"}
            </Button>
          </div>

          <Separator />
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">جمع کالاها</span>
              <span className="num">{formatToman(subtotal)}</span>
            </div>
            {bulkDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1">
                  <BadgePercent className="size-3.5" /> تخفیف خرید عمده
                </span>
                <span className="num">−{formatToman(bulkDiscount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>کد تخفیف ({couponCode})</span>
                <span className="num">−{formatToman(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">هزینهٔ ارسال (پست)</span>
              <span className={freeShipping ? "text-emerald-400 font-bold" : "num"}>
                {freeShipping ? "رایگان" : formatToman(shipping)}
              </span>
            </div>
            {!freeShipping && subtotal > 0 && (
              <p className="text-[10px] text-amber-400/90 leading-4">
                با {formatToman(2_000_000 - subtotal)} تومان خرید بیشتر، ارسال رایگان می‌شود.
              </p>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-bold">مبلغ نهایی</span>
              <span className="font-extrabold text-brand num text-base">
                {formatToman(total)} <span className="text-[10px] text-muted-foreground">تومان</span>
              </span>
            </div>
          </div>

          <Button size="lg" className="w-full font-bold" onClick={() => navigate("/checkout")}>
            ادامهٔ فرآیند خرید
          </Button>
        </div>
      </div>
    </div>
  );
}
