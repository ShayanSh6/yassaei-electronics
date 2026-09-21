"use client";

import { memo } from "react";
import { ShoppingCart, GitCompareArrows, Star, Eye } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/store/types";
import { navigate, toFa } from "@/lib/store/router";
import { PriceTag, StockBadge } from "./price";
import { useCart, useCompare } from "@/lib/store/cart-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function ProductCardBase({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const compareIds = useCompare((s) => s.ids);
  const toggleCompare = useCompare((s) => s.toggle);
  const img = product.images?.[0] || "/assets/img/products/p001.svg";
  const inCompare = compareIds.includes(product.id);

  const open = () => navigate(`/product/${product.id}`);

  return (
    <div
      className="group relative glass rounded-xl overflow-hidden hover:border-brand/50 hover:shadow-[0_8px_30px_-8px_#3dabff40] transition-all duration-300 flex flex-col cursor-pointer"
      onClick={open}
      role="link"
      aria-label={product.name}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      {/* discount corner */}
      {product.oldPrice && product.oldPrice > product.price && (
        <span className="absolute top-2 right-2 z-10 rounded-full bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 num">
          ٪{toFa(Math.round((1 - product.price / product.oldPrice) * 100))}
        </span>
      )}

      {/* quick actions */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="secondary"
          className="size-7 rounded-lg"
          aria-label="افزودن به مقایسه"
          onClick={(e) => {
            e.stopPropagation();
            toggleCompare(product.id);
            toast.success(inCompare ? "از مقایسه حذف شد" : "به مقایسه اضافه شد");
          }}
        >
          <GitCompareArrows className={cn("size-3.5", inCompare && "text-brand")} />
        </Button>
      </div>

      {/* image */}
      <div className="img-tile aspect-square overflow-hidden bg-secondary/40" onClick={open}>
        { }
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

        <h3 className="text-[13px] font-medium leading-6 clamp-2 min-h-12" onClick={open}>
          {product.name}
        </h3>

        <div className="mt-auto flex flex-col gap-2">
          <StockBadge stock={product.stock} />
          <div className="flex items-end justify-between gap-2">
            <PriceTag price={product.price} oldPrice={product.oldPrice} size="sm" />
            <Button
              size="icon"
              className="size-8 rounded-lg shrink-0"
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
        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-muted-foreground/70 num opacity-0 group-hover:opacity-100 transition-opacity">
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
