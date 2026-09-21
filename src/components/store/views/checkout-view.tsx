"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, Truck, Store, Wallet, CreditCard, ChevronLeft, PartyPopper, BadgePercent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman } from "@/lib/store/router";
import { useCart } from "@/lib/store/cart-store";
import { useAuth } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SHIPPING_OPTIONS = [
  { value: "post", label: "پست پیشتاز", desc: "۳ تا ۵ روز کاری — سراسر ایران", cost: 120000, icon: Truck },
  { value: "peyk", label: "پیک موتوری", desc: "همان روز — ویژهٔ تهران", cost: 80000, icon: MapPin },
  { value: "pickup", label: "تحویل حضوری", desc: "فروشگاه نارمک، هفت‌حوض", cost: 0, icon: Store },
];

export function CheckoutView() {
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [shipping, setShipping] = useState("post");
  const [payment, setPayment] = useState("online");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data } = useQuery({
    queryKey: ["cart-validate", lines],
    queryFn: () => api.validateCart(lines.map((l) => ({ id: l.id, qty: l.qty }))),
    enabled: lines.length > 0,
  });

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 flex flex-col items-center gap-4 text-center">
        <PartyPopper className="size-14 text-brand" />
        <p className="font-bold text-lg">سبدی برای تسویه وجود ندارد</p>
        <Button onClick={() => navigate("/catalog")}>رفتن به فروشگاه</Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const subtotal = data?.subtotal ?? 0;
  const bulkDiscount = data?.bulkDiscount ?? 0;
  const shippingCost = SHIPPING_OPTIONS.find((s) => s.value === shipping)?.cost ?? 0;
  const freePost = shipping === "post" && subtotal >= 2_000_000;
  const ship = freePost ? 0 : shippingCost;
  const total = Math.max(0, subtotal - discount + ship);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("نام و نام خانوادگی را کامل وارد کنید");
    if (!/^0\d{10}$/.test(phone.trim())) return toast.error("شمارهٔ موبایل باید ۱۱ رقم و با ۰ شروع شود");
    if (shipping !== "pickup" && address.trim().length < 10) return toast.error("نشانی کامل پستی را وارد کنید");

    setSubmitting(true);
    try {
      const res = await api.placeOrder({
        items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        customer: { name: name.trim(), phone: phone.trim(), address: address.trim() || "تحویل حضوری", note: note.trim() || undefined },
        shipping,
        payment,
        couponCode: couponCode ?? undefined,
      });
      clear();
      toast.success("سفارش شما با موفقیت ثبت شد");
      navigate(`/order/${res.order.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
        <a href="#/cart" className="hover:text-brand">سبد خرید</a>
        <ChevronLeft className="size-3.5" />
        <span className="text-foreground">تسویه حساب</span>
      </div>
      <h1 className="text-xl sm:text-2xl font-extrabold mb-6">تسویه حساب</h1>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-5">
          {/* customer info */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <MapPin className="size-4 text-brand" /> اطلاعات خریدار
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">نام و نام خانوادگی *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی محمدی" className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">شمارهٔ موبایل *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09123456789"
                  inputMode="numeric"
                  dir="ltr"
                  className="h-10 text-sm text-right"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نشانی کامل پستی {shipping === "pickup" ? "(برای تحویل حضوری لازم نیست)" : "*"}</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="استان، شهر، خیابان، پلاک و کد پستی…"
                className="min-h-20 text-sm"
                disabled={shipping === "pickup"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">توضیحات سفارش (اختیاری)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: بعد از ساعت ۱۷ تماس بگیرید" className="min-h-16 text-sm" />
            </div>
          </div>

          {/* shipping */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Truck className="size-4 text-brand" /> روش ارسال
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {SHIPPING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setShipping(opt.value)}
                  className={cn(
                    "rounded-xl border p-3.5 text-right transition-all space-y-1",
                    shipping === opt.value
                      ? "border-brand bg-brand/10 shadow-[0_0_0_1px_var(--brand)]"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <opt.icon className={cn("size-5", shipping === opt.value ? "text-brand" : "text-muted-foreground")} />
                    <span className="text-[10px] num text-muted-foreground">
                      {opt.cost === 0 ? "رایگان" : formatToman(opt.cost)}
                    </span>
                  </div>
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-4">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* payment */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Wallet className="size-4 text-brand" /> روش پرداخت
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { value: "online", label: "پرداخت آنلاین", desc: "درگاه امن بانکی", icon: CreditCard },
                { value: "cod", label: "پرداخت در محل", desc: "نقدی یا کارتخوان سیار", icon: Wallet },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPayment(opt.value)}
                  className={cn(
                    "rounded-xl border p-3.5 flex items-center gap-3 text-right transition-all",
                    payment === opt.value ? "border-brand bg-brand/10 shadow-[0_0_0_1px_var(--brand)]" : "border-border/60 hover:border-border",
                  )}
                >
                  <opt.icon className={cn("size-5", payment === opt.value ? "text-brand" : "text-muted-foreground")} />
                  <div>
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* summary */}
        <div className="glass rounded-2xl p-5 space-y-4 sticky top-32">
          <h2 className="font-bold text-sm">سفارش شما</h2>
          <div className="max-h-44 overflow-y-auto scroll-slim space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2.5">
                { }
                <img src={it.image} alt="" className="size-9 rounded-lg bg-secondary/40 object-contain shrink-0" />
                <span className="flex-1 text-[11px] clamp-2 leading-4">{it.name}</span>
                <span className="text-[10px] text-muted-foreground num shrink-0">×{toFa(it.qty)}</span>
                <span className="text-[10px] num shrink-0">{formatToman((it.unitPrice ?? it.price) * it.qty)}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span className="num">{formatToman(subtotal)}</span></div>
            {bulkDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1"><BadgePercent className="size-3.5" /> تخفیف خرید عمده</span>
                <span className="num">−{formatToman(bulkDiscount)}</span>
              </div>
            )}
            {discount > 0 && <div className="flex justify-between text-emerald-400"><span>کد تخفیف</span><span className="num">−{formatToman(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">ارسال</span><span className={ship === 0 ? "text-emerald-400" : "num"}>{ship === 0 ? "رایگان" : formatToman(ship)}</span></div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-bold">مبلغ قابل پرداخت</span>
              <span className="font-extrabold text-brand num text-base">{formatToman(total)} <span className="text-[10px] text-muted-foreground">تومان</span></span>
            </div>
          </div>
          <Button size="lg" className="w-full font-bold" onClick={submit} disabled={submitting}>
            {submitting ? "در حال ثبت…" : "ثبت نهایی سفارش"}
          </Button>
          {!user && (
            <p className="text-[10px] text-muted-foreground leading-4 text-center">
              به‌عنوان مهمان خرید می‌کنید؛{" "}
              <a href="#/login" className="text-brand">ورود</a> برای پیگیری آسان‌تر سفارش‌ها.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
