"use client";

import { memo } from "react";
import { ShoppingCart, GitCompareArrows, Star, Eye, Heart } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/store/types";
import { navigate, toFa } from "@/lib/store/router";
import { PriceTag, StockBadge } from "./price";
import { useCart, useCompare, useWishlist } from "@/lib/store/cart-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function ProductCardBase({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const compareIds = useCompare((s) => s.ids);
  const toggleCompare = useCompare((s) => s.toggle);
  const wishIds = useWishlist((s) => s.ids);
  const toggleWish = useWishlist((s) => s.toggle);
  const img = product.images?.[0] || "/assets/img/products/p001.svg";
  const inCompare = compareIds.includes(product.id);
  const inWish = wishIds.includes(product.id);

  const open = () => navigate(`/product/${product.id}`);

  return (
    <div
      className="group relative glass rounded-xl overflow-hidden hover:border-brand/50 hover:shadow-[0_8px_30px_-8px_#3dabff40] focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/25 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* stretched link — real anchor: keyboard focus, middle-click, new tab */}
      <a
        href={`#/product/${product.id}`}
        className="absolute inset-0 z-0 rounded-xl outline-none"
        aria-label={`مشاهده ${product.name}`}
        onClick={(e) => {
          e.preventDefault();
          open();
        }}
      />

      {/* discount corner */}
      {product.oldPrice && product.oldPrice > product.price && (
        <span className="absolute top-2 right-2 z-10 rounded-full bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 num">
          ٪{toFa(Math.round((1 - product.price / product.oldPrice) * 100))}
        </span>
      )}

      {/* quick actions */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="secondary"
          className={cn("size-7 rounded-lg", inWish && "text-red-400 hover:text-red-300")}
          aria-label={inWish ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          aria-pressed={inWish}
          onClick={(e) => {
            e.stopPropagation();
            const now = toggleWish(product.id);
            toast.success(now ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد", {
              action: now ? { label: "مشاهده", onClick: () => navigate("/wishlist") } : undefined,
            });
          }}
        >
          <Heart className={cn("size-3.5", inWish && "fill-red-400 text-red-400")} />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="size-7 rounded-lg"
          aria-label="افزودن به مقایسه"
          onClick={(e) => {
            e.stopPropagation();
            toggleCompare(product.id);
            toast.success(inCompare ? "از مقایسه حذف شد" : "به مقایسه اضافه شد", {
              action: !inCompare ? { label: "مقایسه", onClick: () => navigate("/compare") } : undefined,
            });
          }}
        >
          <GitCompareArrows className={cn("size-3.5", inCompare && "text-brand")} />
        </Button>
      </div>

      {/* image */}
      <div className="img-tile aspect-square overflow-hidden bg-secondary/40">
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className="size-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{product.brandName}</span>
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400 num">
              <Star className="size-3 fill-amber-400" /> {toFa(product.ratingAvg.toFixed(1))}
            </span>
          )}
        </div>

        <h3 className="text-[13px] font-medium leading-6 clamp-2 min-h-12">
          {product.name}
        </h3>

        <div className="mt-auto flex flex-col gap-2">
          <StockBadge stock={product.stock} />
          <div className="flex items-end justify-between gap-2">
            <PriceTag price={product.price} oldPrice={product.oldPrice} size="sm" />
            <Button
              size="icon"
              className="relative size-8 rounded-lg shrink-0"
              disabled={product.stock <= 0}
              aria-label="افزودن به سبد خرید"
              onClick={(e) => {
                e.stopPropagation();
                if (product.stock <= 0) return;
                add(product.id);
                toast.success("به سبد خرید اضافه شد", {
                  description: product.name,
                  action: { label: "سبد خرید", onClick: () => navigate("/cart") },
                });
              }}
            >
              <ShoppingCart className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {product.views > 20 && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-muted-foreground/70 num opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <Eye className="size-3" /> {toFa(product.views)}
        </span>
      )}
    </div>
  );
}

export const ProductCard = memo(ProductCardBase);

export function ProductCardSkeleton() {
  return (
    <div className="glass rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-secondary/50" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 w-1/3 bg-secondary rounded" />
        <div className="h-3 w-full bg-secondary rounded" />
        <div className="h-3 w-2/3 bg-secondary rounded" />
        <div className="h-6 w-1/2 bg-secondary rounded mt-2" />
      </div>
    </div>
  );
}
