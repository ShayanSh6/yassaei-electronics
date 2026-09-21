"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Search, PackageSearch, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/store/api";
import { navigate, formatToman } from "@/lib/store/router";
import type { Order } from "@/lib/store/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetails } from "./order-details";

function fmtCode(v: string) {
  // allow latin/persian digits, uppercase latin letters, dashes
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).toUpperCase();
}

export function TrackView() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Order | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.trackOrder(fmtCode(code.trim()), phone.trim()),
    onSuccess: (res) => {
      setFound(res.order);
      toast.success("سفارش شما پیدا شد");
    },
    onError: (e) => {
      setFound(null);
      toast.error(e instanceof Error ? e.message : "خطا در پیگیری سفارش");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !phone.trim()) {
      toast.error("کد سفارش و شماره تماس را وارد کنید");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      {/* form */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-11 rounded-xl bg-brand/15 text-brand shrink-0">
            <Search className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold">پیگیری سفارش</h1>
            <p className="text-xs text-muted-foreground leading-5">
              کد پیگیری (مثل YS-00001) و شماره تماسی که هنگام ثبت سفارش وارد کردید را بنویسید.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2.5">
          <div className="relative">
            <ReceiptText className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="کد سفارش — YS-00001"
              dir="ltr"
              className="pr-9 text-left placeholder:text-right"
              aria-label="کد سفارش"
            />
          </div>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="شماره تماس — ۰۹۱۲…"
            inputMode="tel"
            aria-label="شماره تماس"
          />
          <Button type="submit" className="gap-1.5 font-bold" disabled={mutation.isPending}>
            {mutation.isPending ? "در حال جست‌وجو…" : "پیگیری"}
            {!mutation.isPending && <Search className="size-4" />}
          </Button>
        </form>
      </motion.div>

      {/* loading */}
      {mutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {/* result */}
      {!mutation.isPending && found && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="glass rounded-2xl p-5 text-center space-y-1.5 border-emerald-500/30">
            <CheckCircle2 className="size-10 mx-auto text-emerald-400" />
            <p className="font-extrabold">سفارش پیدا شد</p>
            <p className="text-xs text-muted-foreground">
              کد پیگیری: <span className="font-bold text-foreground num" dir="ltr">{found.code}</span>
              {" · "}
              جمع: <span className="font-bold text-brand num">{formatToman(found.total)} تومان</span>
            </p>
          </div>
          <OrderDetails order={found} />
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/catalog")}>ادامهٔ خرید</Button>
            <Button variant="ghost" onClick={() => { setFound(null); setCode(""); setPhone(""); }}>
              پیگیری سفارش دیگر
            </Button>
          </div>
        </motion.div>
      )}

      {/* hint */}
      {!mutation.isPending && !found && (
        <div className="glass rounded-xl p-5 flex items-start gap-3 text-xs text-muted-foreground leading-6">
          <PackageSearch className="size-5 text-brand shrink-0 mt-0.5" />
          <p>
            کد پیگیری را در صفحهٔ تأیید سفارش یا پیامک تأییدیه می‌توانید ببینید.
            سفارش‌های ثبت‌شده در حساب کاربری، بدون کد هم در <button onClick={() => navigate("/account")} className="text-brand hover:underline">سفارش‌های من</button> قابل مشاهده‌اند.
          </p>
        </div>
      )}
    </div>
  );
}
