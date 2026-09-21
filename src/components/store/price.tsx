"use client";

import { formatToman, toFa } from "@/lib/store/router";
import { cn } from "@/lib/utils";

export function PriceTag({
  price,
  oldPrice,
  size = "md",
  className,
}: {
  price: number;
  oldPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const off = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {off > 0 && (
        <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold px-2 py-0.5 num">
          {toFa(off)}٪ تخفیف
        </span>
      )}
      <div className="flex flex-col items-end leading-tight">
        {off > 0 && (
          <span className="text-muted-foreground/70 line-through text-xs num">
            {formatToman(oldPrice!)}
          </span>
        )}
        <span
          className={cn(
            "font-bold num",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-2xl",
          )}
        >
          {formatToman(price)}
          <span className="text-[10px] font-medium text-muted-foreground mr-1">تومان</span>
        </span>
      </div>
    </div>
  );
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
        <span className="size-1.5 rounded-full bg-red-400" /> ناموجود
      </span>
    );
  if (stock < 5)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" /> تنها {toFa(stock)} عدد در انبار
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-400" /> موجود در انبار
    </span>
  );
}
