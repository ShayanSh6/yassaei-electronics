"use client";

// ── Shared order rendering: status steps + timeline + details + items + totals ──
import { ReceiptText, PackageCheck, Truck, Home, BadgePercent, History } from "lucide-react";
import { navigate, toFa, formatToman, timeAgo, SHIPPING_FA, PAYMENT_FA, ORDER_STATUS_FA } from "@/lib/store/router";
import type { Order, OrderStatusEvent } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export const ORDER_STEPS: { key: string; label: string; icon: typeof Truck }[] = [
  { key: "pending", label: "ثبت سفارش", icon: ReceiptText },
  { key: "processing", label: "آماده‌سازی", icon: PackageCheck },
  { key: "shipped", label: "ارسال", icon: Truck },
  { key: "done", label: "تحویل", icon: Home },
];

export function OrderSteps({ status }: { status: string }) {
  const stepIdx = ORDER_STEPS.findIndex((s) => s.key === status);
  const canceled = status === "canceled";
  if (canceled) return null;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between" dir="rtl">
        {ORDER_STEPS.map((s, i) => {
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
              {i < ORDER_STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1 rounded", stepIdx > i ? "bg-brand" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  processing: "bg-brand",
  shipped: "bg-violet-400",
  done: "bg-emerald-400",
  canceled: "bg-red-400",
};

/** Compact audit-trail strip: one chip per status transition with relative time. */
export function StatusTimeline({ history, status }: { history?: OrderStatusEvent[]; status: string }) {
  const raw: OrderStatusEvent[] =
    history && history.length > 0
      ? history
      : [{ status: "pending", at: "" }, { status, at: "" }]; // legacy orders: derive from current status
  const events = raw.filter((e, i) => i === 0 || e.status !== raw[i - 1].status);
  return (
    <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
      <History className="size-3.5 text-muted-foreground shrink-0" />
      {events.map((e, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="h-px w-3.5 bg-border" />}
          <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2 py-1">
            <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT[e.status] ?? "bg-border")} />
            <span className="font-bold">{ORDER_STATUS_FA[e.status] ?? e.status}</span>
            {e.at && <span className="text-muted-foreground/70">· {timeAgo(e.at)}</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

export function OrderDetails({ order }: { order: Order }) {
  return (
    <>
      <OrderSteps status={order.status} />

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

        <StatusTimeline history={order.statusHistory} status={order.status} />

        <Separator />

        <div className="space-y-2.5">
          {order.items.map((it, i) => (
            <button
              key={i}
              onClick={() => navigate(`/product/${it.id}`)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors text-right"
            >
              <img src={it.image} alt="" className="size-12 rounded-lg bg-secondary/40 object-contain shrink-0" />
              <span className="flex-1 text-xs clamp-2 leading-5">{it.name}</span>
              <span className="text-[11px] text-muted-foreground num">×{toFa(it.qty)}</span>
              <span className="text-xs font-bold num">{formatToman((it.unitPrice ?? it.price) * it.qty)}</span>
            </button>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span className="num">{formatToman(order.subtotal)}</span></div>
          {(order.bulkDiscount ?? 0) > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span className="flex items-center gap-1"><BadgePercent className="size-3.5" /> تخفیف خرید عمده</span>
              <span className="num">−{formatToman(order.bulkDiscount!)}</span>
            </div>
          )}
          {order.discount > 0 && <div className="flex justify-between text-emerald-400"><span>تخفیف{order.couponCode ? ` (${order.couponCode})` : ""}</span><span className="num">−{formatToman(order.discount)}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">ارسال</span><span className={order.shippingCost === 0 ? "text-emerald-400" : "num"}>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span></div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-bold">مبلغ کل</span>
            <span className="font-extrabold text-brand num text-base">{formatToman(order.total)} <span className="text-[10px] text-muted-foreground">تومان</span></span>
          </div>
        </div>
      </div>
    </>
  );
}
