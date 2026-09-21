"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Copy, Printer, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import { useCart } from "@/lib/store/cart-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetails } from "./order-details";

export function OrderView({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.order(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const order = data?.order;
  if (error || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
        <CircleDashed className="size-12 mx-auto text-muted-foreground" />
        <p className="font-bold">سفارش یافت نشد یا به آن دسترسی ندارید</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/catalog")}>بازگشت به فروشگاه</Button>
          <Button variant="ghost" onClick={() => navigate("/track")}>پیگیری با کد سفارش</Button>
        </div>
      </div>
    );
  }

  const canceled = order.status === "canceled";

  /** Reorder: put every still-available item of this order back into the cart. */
  const reorder = async () => {
    try {
      const available = await api.productsByIds(order.items.map((it) => it.id));
      const ok = new Set(available.map((p) => p.id));
      const wanted = new Map<string, number>();
      let skipped = 0;
      for (const it of order.items) {
        if (!ok.has(it.id)) {
          skipped++;
          continue;
        }
        wanted.set(it.id, Math.min(99, (wanted.get(it.id) ?? 0) + it.qty));
      }
      if (wanted.size === 0) {
        toast.error("کالاهای این سفارش دیگر قابل سفارش نیستند");
        return;
      }
      wanted.forEach((qty, id) => useCart.getState().add(id, qty));
      toast.success(`${toFa(wanted.size)} قلم کالا به سبد خرید اضافه شد`, {
        description:
          skipped > 0
            ? `${toFa(skipped)} قلم از این سفارش دیگر موجود نیست و کنار گذاشته شد`
            : `مطابق سفارش ${order.code} — اعمال تخفیف عمده در سبد`,
        action: { label: "مشاهدهٔ سبد", onClick: () => navigate("/cart") },
      });
    } catch {
      toast.error("خطا در افزودن مجدد سفارش؛ دوباره تلاش کنید");
    }
  };

  const copyCode = async () => {
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = order.code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("copy failed");
    };
    try {
      try {
        await navigator.clipboard?.writeText(order.code);
      } catch {
        legacyCopy(); // restricted context (http / headless) fallback
      }
      toast.success("کد پیگیری کپی شد", { description: order.code });
    } catch {
      toast.error("کپی خودکار ممکن نبود؛ کد را دستی یادداشت کنید");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* success banner */}
      <div className={cn("glass rounded-2xl p-6 text-center space-y-2", !canceled && "border-emerald-500/30")}>
        <CheckCircle2 className={cn("size-12 mx-auto", canceled ? "text-red-400" : "text-emerald-400")} />
        <h1 className="text-lg font-extrabold">
          {canceled ? "این سفارش لغو شده است" : "سفارش شما با موفقیت ثبت شد!"}
        </h1>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
          کد پیگیری:
          <span className="font-bold text-foreground num" dir="ltr">{order.code}</span>
          <button
            onClick={copyCode}
            className="grid place-items-center size-6 rounded-md bg-secondary/80 hover:bg-brand/20 hover:text-brand transition-colors"
            aria-label="کپی کد پیگیری"
          >
            <Copy className="size-3.5" />
          </button>
        </p>
        {!canceled && (
          <p className="text-[11px] text-muted-foreground">
            همکاران ما به‌زودی برای هماهنگی ارسال با شما تماس می‌گیرند.
          </p>
        )}
        <div className="pt-1 flex items-center justify-center gap-2 flex-wrap print:hidden">
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-900/20"
            onClick={reorder}
          >
            <RefreshCcw className="size-3.5" /> سفارش مجدد
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" /> چاپ فاکتور
          </Button>
        </div>
      </div>

      <OrderDetails order={order} />

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate("/catalog")}>ادامهٔ خرید</Button>
        {user && <Button variant="ghost" onClick={() => navigate("/account")}>سفارش‌های من</Button>}
      </div>
    </div>
  );
}
