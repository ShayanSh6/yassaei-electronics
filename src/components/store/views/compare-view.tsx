"use client";

import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, X, ShoppingCart, PackageSearch, Star } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/store/api";
import { navigate, toFa } from "@/lib/store/router";
import type { Product } from "@/lib/store/types";
import { useCart, useCompare } from "@/lib/store/cart-store";
import { PriceTag, StockBadge } from "../price";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function EmptyCompare() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 flex flex-col items-center gap-4 text-center">
      <span className="grid place-items-center size-20 rounded-2xl bg-brand/10">
        <GitCompareArrows className="size-9 text-brand/70" />
      </span>
      <p className="font-bold text-lg">مقایسه‌ای انتخاب نشده است</p>
      <p className="text-sm text-muted-foreground max-w-md leading-7">
        تا ۴ کالا را با آیکون مقایسه انتخاب کنید تا مشخصات فنی، قیمت و امتیاز آن‌ها را
        کنار هم ببینید.
      </p>
      <Button className="mt-2" onClick={() => navigate("/catalog")}>
        انتخاب کالاها
      </Button>
    </div>
  );
}

function CompareSkeleton({ n }: { n: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
      <Skeleton className="h-10 w-56 rounded-xl" />
      <div className="glass rounded-2xl p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-4 w-24 shrink-0" />
            {Array.from({ length: n }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareView() {
  const ids = useCompare((s) => s.ids);
  const remove = useCompare((s) => s.toggle);
  const clear = useCompare((s) => s.clear);
  const add = useCart((s) => s.add);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", ids.join(",")],
    queryFn: () => api.productsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories,
    staleTime: 5 * 60_000,
  });
  const catName = (id: string) => categories?.find((c) => c.id === id)?.name ?? id;

  if (ids.length === 0) return <EmptyCompare />;

  const products = data ?? [];

  // union of spec keys across compared products (stable order: first-seen)
  const specKeys: string[] = [];
  for (const p of products) {
    for (const k of Object.keys(p.specs || {})) {
      if (!specKeys.includes(k)) specKeys.push(k);
    }
  }

  const rows: { label: string; render: (p: Product) => React.ReactNode }[] = [
    {
      label: "قیمت",
      render: (p) => <PriceTag price={p.price} oldPrice={p.oldPrice} size="sm" />,
    },
    {
      label: "موجودی",
      render: (p) => <StockBadge stock={p.stock} />,
    },
    {
      label: "برند",
      render: (p) => <span className="text-xs">{p.brandName}</span>,
    },
    {
      label: "دسته‌بندی",
      render: (p) => <span className="text-xs">{catName(p.categoryId)}</span>,
    },
    {
      label: "امتیاز",
      render: (p) =>
        p.ratingCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-amber-400 num">
            <Star className="size-3.5 fill-amber-400" />
            {toFa(p.ratingAvg.toFixed(1))}{" "}
            <span className="text-muted-foreground">({toFa(p.ratingCount)})</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      label: "فروش کل",
      render: (p) => <span className="text-xs num">{toFa(p.sold)} عدد</span>,
    },
    {
      label: "گارانتی",
      render: (p) => (
        <span className="text-xs">{p.warrantyMonths > 0 ? `${toFa(p.warrantyMonths)} ماه` : "مهلت تست ۷ روزه"}</span>
      ),
    },
    {
      label: "وضعیت",
      render: (p) => (
        <span className={cn("text-xs", p.condition === "used" ? "text-amber-400" : "text-emerald-400")}>
          {p.condition === "used" ? "در حد نو (استوک)" : "نو / آکبند"}
        </span>
      ),
    },
    ...specKeys.map((k) => ({
      label: k,
      render: (p: Product) => (
        <span className="text-xs">{(p.specs as Record<string, string> | undefined)?.[k] ?? "—"}</span>
      ),
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="flex items-center gap-2.5 text-xl font-extrabold">
          <span className="grid place-items-center size-10 rounded-xl bg-brand/15 text-brand">
            <GitCompareArrows className="size-5" />
          </span>
          مقایسه کالاها
          <span className="text-xs font-medium text-muted-foreground num">
            ({toFa(ids.length)} از ۴)
          </span>
        </h1>
        <Button
          variant="ghost" size="sm"
          className="gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => { clear(); toast.success("مقایسه پاک شد"); }}
        >
          <X className="size-4" /> پاک کردن همه
        </Button>
      </div>

      {isLoading ? (
        <CompareSkeleton n={ids.length} />
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <PackageSearch className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">کالاهای انتخاب‌شده دیگر موجود نیستند.</p>
        </div>
      ) : (
        <ScrollArea className="glass rounded-2xl w-full whitespace-nowrap">
          <div className="min-w-[640px]">
            {/* product header row */}
            <div
              className="grid gap-x-4 border-b border-border/50"
              style={{ gridTemplateColumns: `96px repeat(${products.length}, minmax(150px, 1fr))` }}
            >
              <div className="p-3 text-[11px] text-muted-foreground flex items-end">کالا</div>
              {products.map((p) => (
                <div key={p.id} className="p-3 flex flex-col items-center gap-2 text-center border-r border-border/30">
                  <button
                    onClick={() => remove(p.id)}
                    className="self-end grid place-items-center size-6 rounded-md bg-secondary/70 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                    aria-label={`حذف ${p.name} از مقایسه`}
                  >
                    <X className="size-3.5" />
                  </button>
                  <img
                    src={p.images?.[0] || "/assets/img/products/p001.svg"}
                    alt={p.name}
                    className="size-20 object-contain cursor-pointer"
                    onClick={() => navigate(`/product/${p.id}`)}
                  />
                  <span
                    className="text-[11px] font-medium leading-5 clamp-2 cursor-pointer hover:text-brand transition-colors"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    {p.name}
                  </span>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-[11px] gap-1"
                    disabled={p.stock <= 0}
                    onClick={() => {
                      add(p.id);
                      toast.success("به سبد خرید اضافه شد", {
                        description: p.name,
                        action: { label: "سبد خرید", onClick: () => navigate("/cart") },
                      });
                    }}
                  >
                    <ShoppingCart className="size-3" /> افزودن به سبد
                  </Button>
                </div>
              ))}
            </div>

            {/* attribute rows */}
            {rows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid gap-x-4 border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors"
                style={{ gridTemplateColumns: `96px repeat(${products.length}, minmax(150px, 1fr))` }}
              >
                <div className="p-3 text-[11px] font-bold text-muted-foreground flex items-center">
                  {row.label}
                </div>
                {products.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-center text-center border-r border-border/20 min-h-11">
                    {row.render(p)}
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
