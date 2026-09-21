"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  SlidersHorizontal, X, ChevronRight, ChevronLeft, Search, PackageX, ArrowUpDown, Check,
} from "lucide-react";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman, toEnDigits } from "@/lib/store/router";
import type { Brand, Category, ProductQuery } from "@/lib/store/types";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SORTS: { value: string; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "cheap", label: "ارزان‌ترین" },
  { value: "expensive", label: "گران‌ترین" },
  { value: "popular", label: "پرفروش‌ترین" },
  { value: "rating", label: "بهترین امتیاز" },
];

function FilterPanel({
  categories, brands, query, onCat, onBrand, onInStock, onPrice, activeCat, activeBrand,
}: {
  categories: (Category & { count?: number })[];
  brands: Brand[];
  query: ProductQuery;
  onCat: (id: string | undefined) => void;
  onBrand: (id: string | undefined) => void;
  onInStock: (v: boolean) => void;
  onPrice: (min?: number, max?: number) => void;
  activeCat?: string;
  activeBrand?: string;
}) {
  const [min, setMin] = useState(query.min ? String(query.min) : "");
  const [max, setMax] = useState(query.max ? String(query.max) : "");

  return (
    <div className="space-y-6">
      {/* categories */}
      <div>
        <h4 className="text-sm font-bold mb-3">دسته‌بندی</h4>
        <div className="max-h-64 overflow-y-auto scroll-slim space-y-0.5 pl-1">
          <button
            onClick={() => onCat(undefined)}
            className={cn(
              "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors",
              !activeCat ? "bg-brand/15 text-brand font-bold" : "hover:bg-secondary/70",
            )}
          >
            <span>همهٔ دسته‌ها</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onCat(c.id === activeCat ? undefined : c.id)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors",
                c.id === activeCat ? "bg-brand/15 text-brand font-bold" : "hover:bg-secondary/70",
              )}
            >
              <span className="truncate">{c.name}</span>
              <span className="text-[10px] text-muted-foreground num">{toFa(c.count ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* brands */}
      <div>
        <h4 className="text-sm font-bold mb-3">برند</h4>
        <div className="max-h-48 overflow-y-auto scroll-slim space-y-2 pl-1">
          {brands.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <Checkbox
                id={`brand-${b.id}`}
                checked={activeBrand === b.id}
                onCheckedChange={(v) => onBrand(v ? b.id : undefined)}
              />
              <Label htmlFor={`brand-${b.id}`} className="text-xs cursor-pointer flex-1">
                {b.name} <span className="text-muted-foreground text-[10px]">({b.nameEn})</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* price range */}
      <div>
        <h4 className="text-sm font-bold mb-3">محدودهٔ قیمت (تومان)</h4>
        <div className="flex items-center gap-2">
          <input
            value={min}
            onChange={(e) => setMin(toEnDigits(e.target.value).replace(/\D/g, ""))}
            placeholder="از"
            inputMode="numeric"
            className="w-full h-9 rounded-lg bg-secondary/60 border border-border/60 px-2.5 text-xs outline-none focus:border-brand/60 num no-spinner"
          />
          <span className="text-muted-foreground">—</span>
          <input
            value={max}
            onChange={(e) => setMax(toEnDigits(e.target.value).replace(/\D/g, ""))}
            placeholder="تا"
            inputMode="numeric"
            className="w-full h-9 rounded-lg bg-secondary/60 border border-border/60 px-2.5 text-xs outline-none focus:border-brand/60 num no-spinner"
          />
        </div>
        <Button
          size="sm" variant="secondary"
          className="w-full mt-2 text-xs"
          onClick={() => onPrice(min ? Number(min) : undefined, max ? Number(max) : undefined)}
        >
          اعمال محدودهٔ قیمت
        </Button>
      </div>

      {/* in stock */}
      <div className="flex items-center gap-2">
        <Checkbox id="in-stock" checked={!!query.inStock} onCheckedChange={(v) => onInStock(!!v)} />
        <Label htmlFor="in-stock" className="text-xs cursor-pointer">فقط کالاهای موجود</Label>
      </div>
    </div>
  );
}

export function CatalogView({ query, onQuery }: { query: ProductQuery; onQuery: (u: Record<string, string | number | undefined>, replace?: boolean) => void }) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: api.categories, staleTime: 5 * 60_000 });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: api.brands, staleTime: 5 * 60_000 });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", query],
    queryFn: () => api.products({ ...query, perPage: query.perPage ?? 12 }),
    placeholderData: keepPreviousData,
  });

  const activeCategory = useMemo(
    () => categories?.find((c) => c.id === query.cat),
    [categories, query.cat],
  );

  const setParam = (updates: Record<string, string | number | undefined>) => {
    onQuery({ ...updates, page: updates.page !== undefined ? updates.page : undefined }, true);
  };

  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;

  const chips: { label: string; clear: Record<string, undefined> }[] = [];
  if (activeCategory) chips.push({ label: activeCategory.name, clear: { cat: undefined } });
  if (query.brand) chips.push({ label: brands?.find((b) => b.id === query.brand)?.name ?? query.brand, clear: { brand: undefined } });
  if (query.q) chips.push({ label: `جست‌وجو: ${query.q}`, clear: { q: undefined } });
  if (query.min || query.max)
    chips.push({
      label: `قیمت: ${query.min ? formatToman(Number(query.min)) : "۰"} تا ${query.max ? formatToman(Number(query.max)) : "∞"}`,
      clear: { min: undefined, max: undefined },
    });
  if (query.featured) chips.push({ label: "فقط ویژه", clear: { featured: undefined } });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* breadcrumb + title */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <a href="#/" className="hover:text-brand">خانه</a>
        <ChevronLeft className="size-3.5" />
        <span className="text-foreground">{activeCategory ? activeCategory.name : "همهٔ محصولات"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl sm:text-2xl font-extrabold">
          {activeCategory ? activeCategory.name : query.q ? `نتایج «${query.q}»` : "همهٔ محصولات"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground num hidden sm:block">
            {toFa(data?.total ?? 0)} کالا
          </span>
          <ArrowUpDown className="size-3.5 text-muted-foreground hidden sm:block" />
          <Select value={query.sort ?? "newest"} onValueChange={(v) => setParam({ sort: v })}>
            <SelectTrigger className="w-36 h-9 text-xs" aria-label="ترتیب نمایش">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* mobile filters */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden gap-1.5">
                <SlidersHorizontal className="size-4" /> فیلترها
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto scroll-slim">
              <SheetTitle>فیلتر محصولات</SheetTitle>
              <div className="mt-4">
                <FilterPanel
                  categories={categories ?? []}
                  brands={brands ?? []}
                  query={query}
                  activeCat={query.cat}
                  activeBrand={query.brand}
                  onCat={(id) => { setParam({ cat: id }); setFiltersOpen(false); }}
                  onBrand={(id) => { setParam({ brand: id }); setFiltersOpen(false); }}
                  onInStock={(v) => setParam({ inStock: v ? 1 : undefined })}
                  onPrice={(mn, mx) => { setParam({ min: mn, max: mx }); setFiltersOpen(false); }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {chips.map((chip, i) => (
            <button
              key={i}
              onClick={() => onQuery(chip.clear, true)}
              className="flex items-center gap-1.5 rounded-full bg-brand/10 text-brand text-[11px] px-3 py-1.5 hover:bg-brand/20 transition-colors"
            >
              {chip.label} <X className="size-3" />
            </button>
          ))}
          <button
            onClick={() => navigate("/catalog")}
            className="flex items-center gap-1.5 rounded-full bg-secondary text-muted-foreground text-[11px] px-3 py-1.5 hover:text-foreground transition-colors"
          >
            حذف همه
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="glass rounded-xl p-4 sticky top-32 max-h-[calc(100vh-10rem)] overflow-y-auto scroll-slim">
            <h3 className="flex items-center gap-2 font-bold text-sm mb-4">
              <SlidersHorizontal className="size-4 text-brand" /> فیلترها
            </h3>
            <FilterPanel
              categories={categories ?? []}
              brands={brands ?? []}
              query={query}
              activeCat={query.cat}
              activeBrand={query.brand}
              onCat={(id) => setParam({ cat: id })}
              onBrand={(id) => setParam({ brand: id })}
              onInStock={(v) => setParam({ inStock: v ? 1 : undefined })}
              onPrice={(mn, mx) => setParam({ min: mn, max: mx })}
            />
          </div>
        </aside>

        {/* grid */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="glass rounded-2xl py-20 flex flex-col items-center gap-4 text-center">
              <span className="grid place-items-center size-16 rounded-full bg-secondary text-muted-foreground">
                <PackageX className="size-8" />
              </span>
              <div>
                <p className="font-bold">کالایی یافت نشد</p>
                <p className="text-xs text-muted-foreground mt-1">فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/catalog")}>حذف فیلترها</Button>
            </div>
          ) : (
            <>
              <div className={cn("grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 transition-opacity", isFetching && "opacity-60")}>
                {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>

              {/* pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-8" dir="ltr">
                  <Button
                    variant="outline" size="icon" className="size-9"
                    disabled={page <= 1}
                    onClick={() => onQuery({ page: page - 1 })}
                    aria-label="صفحه قبل"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  {Array.from({ length: Math.min(pages, 7) }).map((_, i) => {
                    const p = i + 1;
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="icon"
                        className={cn("size-9 num text-xs", p === page && "font-bold")}
                        onClick={() => onQuery({ page: p })}
                      >
                        {toFa(p)}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline" size="icon" className="size-9"
                    disabled={page >= pages}
                    onClick={() => onQuery({ page: page + 1 })}
                    aria-label="صفحه بعد"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
