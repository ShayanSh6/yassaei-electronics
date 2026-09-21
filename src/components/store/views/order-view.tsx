"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, ReceiptText, PackageCheck, Truck, Home } from "lucide-react";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman, SHIPPING_FA, PAYMENT_FA, ORDER_STATUS_FA } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS: { key: string; label: string; icon: typeof Truck }[] = [
  { key: "pending", label: "ثبت سفارش", icon: ReceiptText },
  { key: "processing", label: "آماده‌سازی", icon: PackageCheck },
  { key: "shipped", label: "ارسال", icon: Truck },
  { key: "done", label: "تحویل", icon: Home },
];

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
        <Button variant="outline" onClick={() => navigate("/catalog")}>بازگشت به فروشگاه</Button>
      </div>
    );
  }

  const stepIdx = STEPS.findIndex((s) => s.key === order.status);
  const canceled = order.status === "canceled";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* success banner */}
      <div className={cn("glass rounded-2xl p-6 text-center space-y-2", !canceled && "border-emerald-500/30")}>
        <CheckCircle2 className={cn("size-12 mx-auto", canceled ? "text-red-400" : "text-emerald-400")} />
        <h1 className="text-lg font-extrabold">
          {canceled ? "این سفارش لغو شده است" : "سفارش شما با موفقیت ثبت شد!"}
        </h1>
        <p className="text-xs text-muted-foreground">
          کد پیگیری: <span className="font-bold text-foreground num" dir="ltr">{order.code}</span>
        </p>
        {!canceled && (
          <p className="text-[11px] text-muted-foreground">
            همکاران ما به‌زودی برای هماهنگی ارسال با شما تماس می‌گیرند.
          </p>
        )}
      </div>

      {/* steps */}
      {!canceled && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between" dir="rtl">
            {STEPS.map((s, i) => {
              const done = stepIdx >= i;
              return (
                <div key={s.key} className="flex-1 flex items-center" data-step={i}>
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "grid place-items-center size-10 rounded-full border-2 transition-colors",
                        done ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground",
                      )}
                    >
                      <s.icon className="size-4.5" />
                    </span>
                    <span className={cn("text-[10px]", done ? "text-brand font-bold" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-1 rounded", stepIdx > i ? "bg-brand" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* details */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div><span className="text-muted-foreground">وضعیت: </span><span className="font-bold">{ORDER_STATUS_FA[order.status]}</span></div>
          <div><span className="text-muted-foreground">روش ارسال: </span><span className="font-bold">{SHIPPING_FA[order.shipping]}</span></div>
          <div><span className="text-muted-foreground">پرداخت: </span><span className="font-bold">{PAYMENT_FA[order.payment]}</span></div>
          <div><span className="text-muted-foreground">خریدار: </span><span className="font-bold">{order.customer.name}</span></div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">نشانی: </span>
            <span className="leading-5">{order.customer.address}</span>
          </div>
          {order.customer.note && (
            <div className="sm:col-span-2"><span className="text-muted-foreground">یادداشت: </span>{order.customer.note}</div>
          )}
        </div>

        <Separator />

        <div className="space-y-2.5">
          {order.items.map((it, i) => (
            <button
              key={i}
              onClick={() => navigate(`/product/${it.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-right"
            >
              { }
              <img src={it.image} alt="" className="size-12 rounded-lg bg-secondary/40 object-contain shrink-0" />
              <span className="flex-1 text-xs clamp-2 leading-5">{it.name}</span>
              <span className="text-[11px] text-muted-foreground num">×{toFa(it.qty)}</span>
              <span className="text-xs font-bold num">{formatToman(it.price * it.qty)}</span>
            </button>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span className="num">{formatToman(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-emerald-400"><span>تخفیف</span><span className="num">−{formatToman(order.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">ارسال</span><span className={order.shippingCost === 0 ? "text-emerald-400" : "num"}>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span></div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-bold">مبلغ کل</span>
            <span className="font-extrabold text-brand num text-base">{formatToman(order.total)} <span className="text-[10px] text-muted-foreground">تومان</span></span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate("/catalog")}>ادامهٔ خرید</Button>
        {user && <Button variant="ghost" onClick={() => navigate("/account")}>سفارش‌های من</Button>}
      </div>
    </div>
  );
}
