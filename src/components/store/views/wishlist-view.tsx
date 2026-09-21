"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, ShoppingCart, Trash2, PackageSearch, Share2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman } from "@/lib/store/router";
import { useCart, useWishlist } from "@/lib/store/cart-store";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function EmptyWishlist() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 flex flex-col items-center gap-4 text-center">
      <span className="grid place-items-center size-20 rounded-2xl bg-red-500/10">
        <Heart className="size-9 text-red-400/70" />
      </span>
      <p className="font-bold text-lg">لیست علاقه‌مندی‌های شما خالی است</p>
      <p className="text-sm text-muted-foreground max-w-sm leading-7">
        روی آیکون قلب هر کالا بزنید تا برای خرید بعدی اینجا ذخیره شود.
      </p>
      <Button className="mt-2" onClick={() => navigate("/catalog")}>
        رفتن به فروشگاه
      </Button>
    </div>
  );
}

export function WishlistView() {
  const ids = useWishlist((s) => s.ids);
  const remove = useWishlist((s) => s.remove);
  const clear = useWishlist((s) => s.clear);
  const add = useCart((s) => s.add);
  const [shareText, setShareText] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist", ids.join(",")],
    queryFn: () => api.productsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  if (ids.length === 0) return <EmptyWishlist />;

  const products = data ?? [];

  const addAllToCart = () => {
    const inStock = products.filter((p) => p.stock > 0);
    if (inStock.length === 0) {
      toast.error("هیچ‌کدام از کالاهای علاقه‌مندی موجود نیست");
      return;
    }
    for (const p of inStock) add(p.id);
    toast.success(`${toFa(inStock.length)} کالا به سبد خرید اضافه شد`, {
      action: { label: "سبد خرید", onClick: () => navigate("/cart") },
    });
  };

  /** Share the wishlist as a formatted text list (native share → clipboard fallback). */
  const shareList = async () => {
    const lines = products.map(
      (p, i) => `${toFa(i + 1)}. ${p.name} — ${formatToman(p.price)} تومان`,
    );
    const total = products.reduce((acc, p) => acc + p.price, 0);
    const text =
      `❤️ لیست علاقه‌مندی‌های من از فروشگاه یاسایی (${toFa(products.length)} کالا):\n\n` +
      lines.join("\n") +
      `\n\nجمع تقریبی: ${formatToman(total)} تومان`;
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("copy failed");
    };
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "لیست علاقه‌مندی‌های من — یاسایی", text });
          return; // shared — no toast needed
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return; // user closed the sheet
        }
      }
      try {
        await navigator.clipboard?.writeText(text);
        toast.success("لیست علاقه‌مندی‌ها کپی شد", {
          description: "حالا می‌توانید آن را برای دوستان‌تان بفرستید",
        });
      } catch {
        legacyCopy();
        toast.success("لیست علاقه‌مندی‌ها کپی شد");
      }
    } catch {
      // every automatic path failed — show the list so it can be copied manually
      setShareText(text);
    }
  };

  const copyFromDialog = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard?.writeText(shareText);
      toast.success("کپی شد");
    } catch {
      // select-all so a manual Ctrl+C works
      const ta = document.querySelector<HTMLTextAreaElement>("textarea[aria-label=\"متن لیست علاقه‌مندی‌ها\"]");
      ta?.focus();
      ta?.select();
      if (!document.execCommand("copy")) {
        toast.error("لطفاً با Ctrl+C کپی کنید");
      }
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-extrabold">
          <span className="grid place-items-center size-10 rounded-xl bg-red-500/15 text-red-400">
            <Heart className="size-5" />
          </span>
          علاقه‌مندی‌های من
          <span className="text-xs font-medium text-muted-foreground num">
            ({toFa(ids.length)} کالا)
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addAllToCart} disabled={isLoading}>
            <ShoppingCart className="size-4" /> افزودن همهٔ موجودها به سبد
          </Button>
          <Button
            variant="outline" size="sm"
            className="gap-1.5 border-violet-500/40 text-violet-400 hover:bg-violet-500/15 hover:text-violet-300"
            onClick={shareList}
            disabled={isLoading}
            aria-label="اشتراک‌گذاری لیست علاقه‌مندی‌ها"
          >
            <Share2 className="size-4" /> اشتراک‌گذاری
          </Button>
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={() => { clear(); toast.success("لیست علاقه‌مندی‌ها خالی شد"); }}
          >
            <Trash2 className="size-4" /> پاک کردن لیست
          </Button>
        </div>
      </div>

      {/* manual-copy fallback dialog */}
      <Dialog open={!!shareText} onOpenChange={(v) => !v && setShareText(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">اشتراک‌گذاری لیست علاقه‌مندی‌ها</DialogTitle>
          </DialogHeader>
          <Textarea
            readOnly
            value={shareText ?? ""}
            aria-label="متن لیست علاقه‌مندی‌ها"
            className="min-h-44 text-[11px] leading-6"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShareText(null)}>بستن</Button>
            <Button size="sm" onClick={copyFromDialog}>کپی متن</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {ids.slice(0, 8).map((id) => <ProductCardSkeleton key={id} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <PackageSearch className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            کالاهای نشان‌شده دیگر در فروشگاه موجود نیستند.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/catalog")}>
            مشاهده فروشگاه
          </Button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="relative">
              <ProductCard product={p} />
              <button
                onClick={() => { remove(p.id); toast.success("از علاقه‌مندی‌ها حذف شد"); }}
                className="absolute bottom-3 left-3 z-10 grid place-items-center size-8 rounded-lg bg-secondary/80 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                aria-label={`حذف ${p.name} از علاقه‌مندی‌ها`}
              >
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
