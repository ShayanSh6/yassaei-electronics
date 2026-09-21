"use client";

import { useQuery } from "@tanstack/react-query";
import { Package, User2, LogOut, ChevronLeft, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman, timeAgo, ORDER_STATUS_FA } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  processing: "bg-brand/15 text-brand",
  shipped: "bg-violet-500/15 text-violet-400",
  done: "bg-emerald-500/15 text-emerald-400",
  canceled: "bg-red-500/15 text-red-400",
};

export function AccountView() {
  const { user, logout, ready } = useAuth();

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: api.myOrders,
    enabled: !!user,
  });

  if (ready && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
        <User2 className="size-14 mx-auto text-muted-foreground" />
        <p className="font-bold">ابتدا وارد حساب خود شوید</p>
        <Button onClick={() => navigate("/login")}>ورود / ثبت‌نام</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* profile card */}
      <div className="glass rounded-2xl p-5 flex items-center gap-4">
        <span className="grid place-items-center size-14 rounded-2xl bg-brand/15 text-brand text-xl font-extrabold">
          {user?.name?.[0] || "؟"}
        </span>
        <div className="flex-1">
          <h1 className="font-extrabold">{user?.name}</h1>
          <p className="text-xs text-muted-foreground" dir="ltr">@{user?.username}</p>
        </div>
        <Button
          variant="outline" size="sm" className="gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/10"
          onClick={() => { logout(); toast.success("از حساب خارج شدید"); navigate("/"); }}
        >
          <LogOut className="size-4" /> خروج
        </Button>
      </div>

      {/* orders */}
      <div className="space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <ReceiptText className="size-4 text-brand" /> سفارش‌های من
        </h2>
        {!orders || orders.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center space-y-3">
            <Package className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نکرده‌اید.</p>
            <Button size="sm" onClick={() => navigate("/catalog")}>شروع خرید</Button>
          </div>
        ) : (
          orders.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/order/${o.id}`)}
              className="w-full glass rounded-xl p-4 text-right hover:border-brand/40 transition-colors"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold num" dir="ltr">{o.code}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLOR[o.status])}>
                    {ORDER_STATUS_FA[o.status]}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(o.createdAt)}</span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {o.items.slice(0, 4).map((it, i) => (
                     
                    <img key={i} src={it.image} alt="" className="size-9 rounded-lg bg-secondary/40 object-contain" />
                  ))}
                  {o.items.length > 4 && (
                    <span className="text-[10px] text-muted-foreground num">+{toFa(o.items.length - 4)}</span>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-muted-foreground">مبلغ کل</div>
                  <div className="text-xs font-bold num text-brand">{formatToman(o.total)}</div>
                </div>
                <ChevronLeft className="size-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
