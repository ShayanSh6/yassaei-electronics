"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ShieldCheck, RotateCcw, Truck, Star, Minus, Plus, ShoppingCart,
  GitCompareArrows, Check, Store, Wrench, PackageSearch, Heart, ZoomIn,
  BadgePercent, MessagesSquare, Send, CircleHelp, ThumbsUp, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/store/api";
import { navigate, toFa, timeAgo, formatToman, usePageTitle } from "@/lib/store/router";
import { discountedUnit, nextTier, useProductTiers } from "@/lib/store/bulk";
import { useCart, useCompare, useRecentlyViewed, useWishlist } from "@/lib/store/cart-store";
import { useAuth } from "@/lib/store/auth-store";
import type { Product, QAQuestion } from "@/lib/store/types";
import { PriceTag, StockBadge } from "../price";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ProductCard } from "../product-card";
import { Lightbox } from "../lightbox";
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
  const product = data?.product;
  const tiers = useProductTiers(product);
  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => api.reviews(id),
  });
  const { data: qa } = useQuery({
    queryKey: ["questions", id],
    queryFn: () => api.questions(id),
  });

  const add = useCart((s) => s.add);
  const compareIds = useCompare((s) => s.ids);
  const toggleCompare = useCompare((s) => s.toggle);
  const wishIds = useWishlist((s) => s.ids);
  const toggleWish = useWishlist((s) => s.toggle);
  const pushRecent = useRecentlyViewed((s) => s.push);
  const { user } = useAuth();

  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [qName, setQName] = useState("");
  const [qText, setQText] = useState("");
  const [asking, setAsking] = useState(false);
  const [qaVotes, setQaVotes] = useState<string[]>([]);
  const [zooming, setZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (id) pushRecent(id);
  }, [id, pushRecent]);

  useEffect(() => {
    // hydration-safe: load local vote state after mount
    try {
      setQaVotes(JSON.parse(localStorage.getItem("yassaei.qa-votes") ?? "[]"));
    } catch {
      /* ignore malformed */
    }
  }, []);

  usePageTitle(product?.name ?? "محصول");

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

  const submitQuestion = async () => {
    const name = (user?.name ?? qName).trim();
    if (name.length < 2) {
      toast.error("نام خود را وارد کنید");
      return;
    }
    if (qText.trim().length < 5) {
      toast.error("پرسش خیلی کوتاه است");
      return;
    }
    setAsking(true);
    try {
      await api.askQuestion(id, { name, question: qText.trim() });
      toast.success("پرسش شما ثبت شد؛ پاسخ کارشناسان به‌زودی نمایش داده می‌شود");
      setQText("");
      qc.invalidateQueries({ queryKey: ["questions", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت پرسش");
    } finally {
      setAsking(false);
    }
  };

  const toggleVote = async (qid: string) => {
    const voted = qaVotes.includes(qid);
    const next = voted ? qaVotes.filter((x) => x !== qid) : [...qaVotes, qid];
    setQaVotes(next);
    localStorage.setItem("yassaei.qa-votes", JSON.stringify(next));
    // optimistic count update
    qc.setQueryData<{ questions: QAQuestion[]; total: number; answered: number }>(
      ["questions", id],
      (old) =>
        old
          ? {
              ...old,
              questions: old.questions.map((q) =>
                q.id === qid
                  ? { ...q, helpful: Math.max(0, (q.helpful ?? 0) + (voted ? -1 : 1)) }
                  : q,
              ),
            }
          : old,
    );
    try {
      await api.voteQuestion(qid, voted ? "down" : "up");
    } catch {
      setQaVotes(qaVotes);
      localStorage.setItem("yassaei.qa-votes", JSON.stringify(qaVotes));
      qc.invalidateQueries({ queryKey: ["questions", id] });
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
          <div
            className="glass rounded-2xl img-tile aspect-square grid place-items-center relative overflow-hidden cursor-zoom-in"
            onClick={() => setLightbox(imgIdx)}
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - r.left) / r.width) * 100;
              const y = ((e.clientY - r.top) / r.height) * 100;
              setZoomOrigin(`${x}% ${y}%`);
            }}
            role="button"
            tabIndex={0}
            aria-label="باز کردن تصویر تمام‌صفحه"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightbox(imgIdx);
              }
            }}
          >
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="absolute top-3 right-3 z-10 rounded-full bg-red-500/90 text-white text-xs font-bold px-2.5 py-1 num">
                ٪{toFa(Math.round((1 - product.price / product.oldPrice) * 100))} تخفیف
              </span>
            )}
            { }
            <img
              src={images[imgIdx]}
              alt={product.name}
              className="size-full object-contain p-8 transition-transform duration-200 ease-out"
              style={{
                transform: zooming ? "scale(1.9)" : "scale(1)",
                transformOrigin: zoomOrigin,
              }}
            />
            <span
              className={cn(
                "absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-[10px] text-muted-foreground transition-opacity",
                zooming ? "opacity-0" : "opacity-100",
              )}
            >
              <ZoomIn className="size-3.5" /> برای بزرگ‌نمایی کلیک کنید
            </span>
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

            {/* bulk tier chips */}
            {product.stock > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <BadgePercent className="size-3.5 text-emerald-400 shrink-0" />
                {tiers.map((t) => {
                  const active = qty >= t.minQty;
                  return (
                    <span
                      key={t.minQty}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[10px] font-bold num border transition-all duration-200",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_-6px] shadow-emerald-500/50"
                          : "border-border/60 text-muted-foreground/80",
                      )}
                    >
                      {toFa(t.minQty)}+ عدد ٪{toFa(t.percent)}
                    </span>
                  );
                })}
                <span className="text-[10px] text-muted-foreground">تخفیف خرید عمده</span>
              </div>
            )}

            {product.stock > 0 && (
              <div className="space-y-2">
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

                {/* live line total / tier nudge */}
                {(() => {
                  const { unitPrice, percent } = discountedUnit(product.price, qty, tiers);
                  const next = nextTier(qty, tiers);
                  if (percent > 0) {
                    const total = unitPrice * qty;
                    const save = product.price * qty - total;
                    return (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">
                          قیمت {toFa(qty)} عدد: {" "}
                          <b className="num text-foreground">{formatToman(total)}</b> تومان
                        </span>
                        <span className="font-bold text-emerald-400 num">
                          سود شما {formatToman(save)} تومان (٪{toFa(percent)})
                        </span>
                      </div>
                    );
                  }
                  if (next && next.minQty <= product.stock) {
                    return (
                      <div className="rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
                        با {toFa(next.minQty - qty)} عدد بیشتر، ٪{toFa(next.percent)} تخفیف خرید عمده می‌گیرید.
                      </div>
                    );
                  }
                  return null;
                })()}
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
              <Button
                variant="outline" size="sm"
                className={cn("gap-1.5 flex-1", wishIds.includes(product.id) && "border-red-500/40 text-red-400 hover:text-red-300 hover:bg-red-500/10")}
                aria-pressed={wishIds.includes(product.id)}
                onClick={() => {
                  const now = toggleWish(product.id);
                  toast.success(now ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد", {
                    action: now ? { label: "مشاهده", onClick: () => navigate("/wishlist") } : undefined,
                  });
                }}
              >
                <Heart className={cn("size-4", wishIds.includes(product.id) && "fill-red-400 text-red-400")} />
                {wishIds.includes(product.id) ? "در علاقه‌مندی‌ها" : "علاقه‌مندی"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => navigate("/cart")}>
                <Check className="size-4" /> مشاهده سبد
              </Button>
              <Button
                variant="outline" size="sm"
                className="gap-1.5 flex-1"
                aria-label="اشتراک‌گذاری محصول"
                onClick={async () => {
                  const url = window.location.href;
                  const shareData = { title: product.name, text: `${product.name} — فروشگاه یاسایی`, url };
                  try {
                    if (typeof navigator.share === "function") {
                      await navigator.share(shareData);
                      return;
                    }
                    await navigator.clipboard.writeText(url);
                    toast.success("نشانی کالا کپی شد", { description: "می‌توانید آن را برای دوستانتان بفرستید" });
                  } catch (err) {
                    if (err instanceof Error && err.name === "AbortError") return; // user closed share sheet
                    // clipboard fallback for non-secure contexts
                    try {
                      const ta = document.createElement("textarea");
                      ta.value = url;
                      ta.style.position = "fixed";
                      ta.style.opacity = "0";
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand("copy");
                      document.body.removeChild(ta);
                      toast.success("نشانی کالا کپی شد");
                    } catch {
                      toast.error("کپی نشد؛ نشانی را از نوار مرورگر کپی کنید");
                    }
                  }
                }}
              >
                <Share2 className="size-4" /> اشتراک
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

      {/* Q&A */}
      <section className="mx-auto max-w-7xl px-4 pt-12">
        <h2 className="text-lg font-extrabold mb-4 flex items-center gap-2">
          <MessagesSquare className="size-5 text-brand" />
          پرسش و پاسخ
          {qa && qa.total > 0 && (
            <span className="rounded-lg bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground num">
              {toFa(qa.total)} پرسش
            </span>
          )}
        </h2>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            {!qa || qa.questions.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
                هنوز پرسشی ثبت نشده؛ اولین پرسش را بپرسید.
              </div>
            ) : (
              qa.questions.map((q) => (
                <div key={q.id} className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center size-8 rounded-full bg-brand/15 text-brand text-xs font-bold">
                        {q.name?.[0] || "؟"}
                      </span>
                      <span className="text-xs font-bold">{q.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {q.answer ? (
                        <span className="rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                          پاسخ داده شد
                        </span>
                      ) : (
                        <span className="rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-bold px-2 py-0.5">
                          در انتظار پاسخ
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/70">{timeAgo(q.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs leading-6">
                    <CircleHelp className="size-4 text-muted-foreground shrink-0 mt-1" />
                    <p>{q.question}</p>
                  </div>
                  {q.answer && (
                    <div className="rounded-xl border border-brand/25 bg-brand/5 p-3 flex items-start gap-2.5">
                      <span className="grid place-items-center size-7 rounded-lg bg-brand/15 text-brand shrink-0">
                        <Store className="size-4" />
                      </span>
                      <div className="flex-1 space-y-1.5">
                        <span className="text-[10px] font-bold text-brand">پاسخ فروشگاه یاسایی</span>
                        <p className="text-xs leading-6">{q.answer}</p>
                        <button
                          onClick={() => toggleVote(q.id)}
                          aria-pressed={qaVotes.includes(q.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors",
                            qaVotes.includes(q.id)
                              ? "bg-brand/15 text-brand"
                              : "bg-secondary/60 text-muted-foreground hover:text-brand hover:bg-brand/10",
                          )}
                        >
                          <ThumbsUp className={cn("size-3", qaVotes.includes(q.id) && "fill-current")} />
                          {qaVotes.includes(q.id) ? "مفید بود" : "مفید بود؟"}
                          {(q.helpful ?? 0) > 0 && <span className="num">({toFa(q.helpful!)})</span>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ask form */}
          <div className="glass rounded-xl p-4 space-y-3 h-fit">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <MessagesSquare className="size-4 text-brand" /> پرسش خود را بپرسید
            </h3>
            {!user && (
              <div className="space-y-1.5">
                <label htmlFor="qa-name" className="text-[11px] text-muted-foreground">نام شما</label>
                <input
                  id="qa-name"
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  placeholder="مثلاً سارا احمدی"
                  className="w-full h-9 rounded-lg border border-border/70 bg-transparent px-3 text-xs outline-none focus:border-brand transition-colors"
                />
              </div>
            )}
            <Textarea
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="سؤال خود را دربارهٔ این کالا بنویسید…"
              className="min-h-24 text-xs"
            />
            <Button className="w-full gap-2" onClick={submitQuestion} disabled={asking}>
              <Send className="size-4" /> {asking ? "در حال ارسال…" : "ارسال پرسش"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-4">
              بدون نیاز به ورود — پاسخ کارشناسان تا ۲۴ ساعت کاری.
            </p>
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

      {/* fullscreen image lightbox */}
      <Lightbox
        images={images}
        index={lightbox}
        alt={product.name}
        onClose={() => setLightbox(null)}
        onIndexChange={(i) => {
          setLightbox(i);
          setImgIdx(i);
        }}
      />
    </div>
  );
}
