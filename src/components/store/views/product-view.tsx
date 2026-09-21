"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ShieldCheck, RotateCcw, Truck, Star, Minus, Plus, ShoppingCart,
  GitCompareArrows, Check, Store, Wrench, PackageSearch,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/store/api";
import { navigate, toFa, timeAgo } from "@/lib/store/router";
import { useCart, useCompare, useRecentlyViewed } from "@/lib/store/cart-store";
import { useAuth } from "@/lib/store/auth-store";
import type { Product } from "@/lib/store/types";
import { PriceTag, StockBadge } from "../price";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ProductCard } from "../product-card";
import { cn } from "@/lib/utils";

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 grid lg:grid-cols-2 gap-8 animate-pulse">
      <div className="aspect-square rounded-2xl bg-secondary/50" />
      <div className="space-y-4">
        <div className="h-7 w-3/4 bg-secondary rounded" />
        <div className="h-4 w-1/3 bg-secondary rounded" />
        <div className="h-24 bg-secondary rounded" />
        <div className="h-12 w-48 bg-secondary rounded" />
      </div>
    </div>
  );
}

export function ProductView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.product(id),
  });
  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => api.reviews(id),
  });

  const add = useCart((s) => s.add);
  const compareIds = useCompare((s) => s.ids);
  const toggleCompare = useCompare((s) => s.toggle);
  const pushRecent = useRecentlyViewed((s) => s.push);
  const { user } = useAuth();

  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (id) pushRecent(id);
  }, [id, pushRecent]);

  const product = data?.product;

  const warrantyLabel = useMemo(() => {
    if (!product) return "";
    return product.warrantyMonths > 0 ? `${toFa(product.warrantyMonths)} ماه گارانتی` : "مهلت تست ۷ روزه";
  }, [product]);

  if (isLoading) return <ProductSkeleton />;
  if (error || !product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 flex flex-col items-center gap-4 text-center">
        <PackageSearch className="size-14 text-muted-foreground" />
        <p className="font-bold text-lg">کالای مورد نظر یافت نشد</p>
        <Button variant="outline" onClick={() => navigate("/catalog")}>بازگشت به فروشگاه</Button>
      </div>
    );
  }

  const images = product.images?.length ? product.images : ["/assets/img/products/p001.svg"];

  const submitReview = async () => {
    if (!user) {
      toast.error("برای ثبت دیدگاه ابتدا وارد شوید");
      navigate("/login");
      return;
    }
    if (comment.trim().length < 3) {
      toast.error("متن دیدگاه خیلی کوتاه است");
      return;
    }
    try {
      await api.addReview({ productId: id, rating, comment: comment.trim() });
      toast.success("دیدگاه شما ثبت شد؛ سپاسگزاریم");
      setComment("");
      qc.invalidateQueries({ queryKey: ["reviews", id] });
      qc.invalidateQueries({ queryKey: ["product", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت دیدگاه");
    }
  };

  return (
    <div className="pb-10">
      {/* breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 pt-5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <a href="#/" className="hover:text-brand">خانه</a>
        <ChevronLeft className="size-3.5" />
        <a href="#/catalog" className="hover:text-brand">محصولات</a>
        {data.category && (
          <>
            <ChevronLeft className="size-3.5" />
            <a href={`#/catalog?cat=${data.category.id}`} className="hover:text-brand">{data.category.name}</a>
          </>
        )}
        <ChevronLeft className="size-3.5" />
        <span className="text-foreground/90 clamp-2 max-w-md">{product.name}</span>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-5 grid lg:grid-cols-[1fr_1.1fr] gap-8">
        {/* gallery */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="glass rounded-2xl img-tile aspect-square grid place-items-center relative overflow-hidden">
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="absolute top-3 right-3 rounded-full bg-red-500/90 text-white text-xs font-bold px-2.5 py-1 num">
                ٪{toFa(Math.round((1 - product.price / product.oldPrice) * 100))} تخفیف
              </span>
            )}
            { }
            <img
              src={images[imgIdx]}
              alt={product.name}
              className="size-full object-contain p-8"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 justify-center">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={cn(
                    "size-16 rounded-xl overflow-hidden border-2 transition-colors bg-secondary/40",
                    i === imgIdx ? "border-brand" : "border-transparent hover:border-border",
                  )}
                  aria-label={`تصویر ${i + 1}`}
                >
                  { }
                  <img src={img} alt="" className="size-full object-contain p-1.5" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="rounded-lg bg-secondary px-2 py-1">{product.brandName}</span>
              <span className="rounded-lg bg-secondary px-2 py-1 num" dir="ltr">{product.sku}</span>
              {product.condition === "used" && (
                <span className="rounded-lg bg-amber-500/15 text-amber-400 px-2 py-1">در حد نو / استوک</span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold leading-9">{product.name}</h1>
            {product.ratingCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span className="font-bold num">{toFa(product.ratingAvg.toFixed(1))}</span>
                <span className="text-muted-foreground">({toFa(product.ratingCount)} دیدگاه)</span>
              </div>
            )}
          </div>

          <Separator />

          <p className="text-sm leading-7 text-muted-foreground">{product.description}</p>

          {/* trust row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ShieldCheck, label: "ضمانت اصالت" },
              { icon: RotateCcw, label: warrantyLabel },
              { icon: Truck, label: "ارسال سراسر ایران" },
            ].map((t, i) => (
              <div key={i} className="glass rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center">
                <t.icon className="size-5 text-brand" />
                <span className="text-[10px] text-muted-foreground leading-4">{t.label}</span>
              </div>
            ))}
          </div>

          {/* specs quick */}
          {Object.keys(product.specs || {}).length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-sm font-bold mb-2.5 flex items-center gap-1.5">
                <Wrench className="size-4 text-brand" /> مشخصات فنی
              </h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-border/30">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* buy box */}
          <div className="glass rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <PriceTag price={product.price} oldPrice={product.oldPrice} size="lg" />
              <StockBadge stock={product.stock} />
            </div>

            {product.stock > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-border/70 overflow-hidden">
                  <button
                    onClick={() => setQty((v) => Math.min(product.stock, v + 1))}
                    className="grid place-items-center size-10 hover:bg-secondary/70 transition-colors"
                    aria-label="افزایش"
                  >
                    <Plus className="size-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-bold num">{toFa(qty)}</span>
                  <button
                    onClick={() => setQty((v) => Math.max(1, v - 1))}
                    className="grid place-items-center size-10 hover:bg-secondary/70 transition-colors"
                    aria-label="کاهش"
                  >
                    <Minus className="size-4" />
                  </button>
                </div>
                <Button
                  size="lg"
                  className="flex-1 gap-2 font-bold h-12"
                  onClick={() => {
                    add(product.id, qty);
                    toast.success("به سبد خرید اضافه شد", {
                      description: `${product.name} × ${toFa(qty)}`,
                      action: { label: "سبد خرید", onClick: () => navigate("/cart") },
                    });
                  }}
                >
                  <ShoppingCart className="size-5" /> افزودن به سبد خرید
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline" size="sm" className="gap-1.5 flex-1"
                onClick={() => {
                  toggleCompare(product.id);
                  toast.success(compareIds.includes(product.id) ? "از مقایسه حذف شد" : "به مقایسه اضافه شد");
                }}
              >
                <GitCompareArrows className={cn("size-4", compareIds.includes(product.id) && "text-brand")} />
                مقایسه
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => navigate("/cart")}>
                <Check className="size-4" /> مشاهده سبد
              </Button>
            </div>
          </div>

          {/* store info strip */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Store className="size-4 text-brand shrink-0" />
            <span>قیمت در فروشگاه حضوری (نارمک، هفت‌حوض) و آنلاین یکسان است — مهلت تست هفت‌روزه.</span>
          </div>
        </motion.div>
      </div>

      {/* reviews */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <h2 className="text-lg font-extrabold mb-4">دیدگاه کاربران</h2>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            {!reviews || reviews.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
                هنوز دیدگاهی ثبت نشده؛ اولین نفر باشید.
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="glass rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center size-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                        {r.userName?.[0] || "؟"}
                      </span>
                      <span className="text-xs font-bold">{r.userName}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn("size-3.5", i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">{r.comment}</p>
                  <span className="text-[10px] text-muted-foreground/70">{timeAgo(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>

          {/* write review */}
          <div className="glass rounded-xl p-4 space-y-3 h-fit">
            <h3 className="text-sm font-bold">ثبت دیدگاه شما</h3>
            <div className="flex items-center gap-1" dir="ltr">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} onClick={() => setRating(i + 1)} aria-label={`امتیاز ${i + 1}`}>
                  <Star className={cn("size-6 transition-colors", i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300")} />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="تجربه‌تان از این کالا را بنویسید…"
              className="min-h-24 text-xs"
            />
            <Button className="w-full" onClick={submitReview}>ارسال دیدگاه</Button>
            {!user && <p className="text-[10px] text-muted-foreground text-center">برای ثبت دیدگاه باید وارد حساب شوید.</p>}
          </div>
        </div>
      </section>

      {/* related */}
      {data.related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <h2 className="text-lg font-extrabold mb-4">کالاهای مشابه</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {data.related.map((p: Product) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
