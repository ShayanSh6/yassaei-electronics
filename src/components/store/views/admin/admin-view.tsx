"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, ShoppingCart, Users, TrendingUp, AlertTriangle,
  ChevronLeft, Pencil, Trash2, Plus, Store, BarChart3, PieChart, Download,
  CircleHelp, PackagePlus, BadgePercent, Search, SlidersHorizontal, Check, Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman, timeAgo, ORDER_STATUS_FA } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import type { Order, Product } from "@/lib/store/types";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusTimeline } from "../order-details";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  processing: "bg-brand/15 text-brand",
  shipped: "bg-violet-500/15 text-violet-400",
  done: "bg-emerald-500/15 text-emerald-400",
  canceled: "bg-red-500/15 text-red-400",
};

const STATUS_BAR: Record<string, string> = {
  pending: "bg-amber-400",
  processing: "bg-brand",
  shipped: "bg-violet-400",
  done: "bg-emerald-400",
  canceled: "bg-red-400",
};

/** 14-day revenue bar chart — pure CSS, no chart lib. */
function SalesChart({ data }: { data: { day: string; label: string; total: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const hasAny = data.some((d) => d.total > 0);
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-bold text-sm">
          <span className="grid place-items-center size-8 rounded-lg bg-brand/15 text-brand">
            <BarChart3 className="size-4" />
          </span>
          فروش ۱۴ روز اخیر
        </h3>
        {hasAny && (
          <span className="text-[10px] text-muted-foreground num">
            بیشترین: {formatToman(max)} تومان
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5 h-36" dir="ltr">
        {data.map((d) => {
          const h = Math.max(2, Math.round((d.total / max) * 100));
          const isToday = d.day === data[data.length - 1]?.day;
          return (
            <div key={d.day} className="flex-1 h-full flex flex-col items-center gap-1 group/bar min-w-0">
              {/* definite-height track so the % bar height actually resolves */}
              <div className="w-full flex-1 min-h-0 flex items-end bg-secondary/35 rounded-md">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-300 group-hover/bar:brightness-125 relative",
                    d.total > 0 ? "bg-brand/70" : "bg-secondary/70",
                    isToday && d.total > 0 && "bg-brand",
                  )}
                  style={{ height: `${h}%` }}
                  title={`${d.label} — ${d.total > 0 ? `${formatToman(d.total)} تومان (${toFa(d.count)} سفارش)` : "بدون فروش"}`}
                >
                  {d.total > 0 && (
                    <span className="absolute -top-5 right-1/2 translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity text-[9px] font-bold text-brand num whitespace-nowrap">
                      {formatToman(d.total)}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn("text-[8px] num", isToday ? "text-brand font-bold" : "text-muted-foreground/60")}>
                {d.label.split("/")[1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Order status distribution with proportional bars. */
function StatusDistribution({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="flex items-center gap-2 font-bold text-sm mb-3">
        <span className="grid place-items-center size-8 rounded-lg bg-violet-500/15 text-violet-400">
          <PieChart className="size-4" />
        </span>
          وضعیت سفارش‌ها
      </h3>
      {/* stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5" dir="ltr">
        {Object.entries(byStatus).map(([k, v]) =>
          v > 0 ? <div key={k} className={cn("h-full", STATUS_BAR[k])} style={{ width: `${(v / total) * 100}%` }} /> : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {Object.entries(byStatus).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("size-2 rounded-full", STATUS_BAR[k])} />
            {ORDER_STATUS_FA[k]}: <span className="font-bold text-foreground num">{toFa(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (ready && (!user || (user.role !== "owner" && user.role !== "staff"))) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
        <LayoutDashboard className="size-12 mx-auto text-muted-foreground" />
        <p className="font-bold">این بخش ویژهٔ مدیران فروشگاه است</p>
        <p className="text-xs text-muted-foreground">با حساب مدیریتی خود وارد شوید.</p>
        <Button onClick={() => navigate("/login")}>ورود مدیر</Button>
      </div>
    );
  }
  return <>{children}</>;
}

/** Pending-Q&A widget for the dashboard — links to the questions tab. */
function PendingQuestionsWidget() {
  const { data } = useQuery({
    queryKey: ["admin-questions", "widget"],
    queryFn: () => api.adminQuestions({ status: "pending", page: 1, perPage: 3 }),
    refetchInterval: 60_000,
  });
  const pending = data?.pending ?? 0;
  if (pending === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-sm flex items-center gap-1.5 text-amber-400">
          <CircleHelp className="size-4" />
          پرسش‌های در انتظار پاسخ
        </h3>
        <span className="rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold num px-2 py-0.5">
          {toFa(pending)} پرسش
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        {(data?.items ?? []).map((q) => (
          <button
            key={q.id}
            onClick={() => navigate("/admin?tab=questions")}
            className="w-full text-right rounded-lg px-2.5 py-2 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold clamp-1">{q.productName ?? "—"}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(q.createdAt)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground clamp-1 mt-0.5">{q.question}</p>
          </button>
        ))}
      </div>
      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => navigate("/admin?tab=questions")}>
        پاسخ به پرسش‌ها <ChevronLeft className="size-3.5" />
      </Button>
    </div>
  );
}

/** Storage status chip: PostgreSQL (emerald) or JSON-file fallback (amber). */
function DatabaseStatus() {
  const { data } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 60_000 });
  const isPg = data?.store === "postgres";
  const db = data?.db;

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap rounded-xl border px-4 py-3 text-xs",
        isPg
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
          : "border-amber-500/30 bg-amber-500/5 text-amber-400",
      )}
      role="status"
      aria-label="وضعیت پایگاه داده"
    >
      <span className="relative flex size-2 shrink-0" aria-hidden="true">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", isPg ? "bg-emerald-400" : "bg-amber-400")} />
        <span className={cn("relative inline-flex size-2 rounded-full", isPg ? "bg-emerald-500" : "bg-amber-500")} />
      </span>
      <Database className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-bold">{isPg ? "پایگاه دادهٔ PostgreSQL" : "ذخیره‌سازی فایل JSON"}</span>
      {db?.server && <span className="text-[10px] opacity-80 num" dir="ltr">{db.server}</span>}
      {db?.database && (
        <span className="text-[10px] opacity-80" dir="ltr">
          db: <span className="num">{db.database}</span>
        </span>
      )}
      {typeof db?.latencyMs === "number" && (
        <span className="text-[10px] opacity-80 num">{toFa(db.latencyMs)}ms</span>
      )}
      <span className="flex-1 min-w-2" />
      {typeof db?.products === "number" && <span className="text-[10px] opacity-80">{toFa(db.products)} کالا</span>}
      {typeof db?.orders === "number" && <span className="text-[10px] opacity-80">{toFa(db.orders)} سفارش</span>}
      {typeof db?.users === "number" && <span className="text-[10px] opacity-80">{toFa(db.users)} کاربر</span>}
    </div>
  );
}

function DashboardTab() {
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats, refetchInterval: 30_000 });

  if (!stats) return <div className="animate-pulse grid sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 glass rounded-xl" />)}</div>;

  const threshold = stats.lowStockThreshold ?? 5;

  const cards = [
    { icon: Package, label: "کالاها", value: toFa(stats.products), sub: `${toFa(stats.lowStock)} کمتر از ${toFa(threshold)} موجود`, accent: "text-brand bg-brand/15" },
    { icon: ShoppingCart, label: "سفارش‌ها", value: toFa(stats.orders), sub: `درآمد: ${formatToman(stats.revenueTotal)}`, accent: "text-emerald-400 bg-emerald-500/15" },
    { icon: Users, label: "کاربران", value: toFa(stats.users), sub: "ثبت‌نام‌شده", accent: "text-violet-400 bg-violet-500/15" },
    { icon: TrendingUp, label: "گردش مالی", value: formatToman(stats.ordersTotal), sub: "همهٔ سفارش‌ها", accent: "text-amber-400 bg-amber-500/15" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-xl p-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">{c.label}</div>
              <div className="text-lg font-extrabold num">{c.value}</div>
              <div className="text-[10px] text-muted-foreground/80">{c.sub}</div>
            </div>
            <span className={cn("grid place-items-center size-9 rounded-lg", c.accent)}>
              <c.icon className="size-4.5" />
            </span>
          </div>
        ))}
      </div>

      <DatabaseStatus />

      {stats.lowStock > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs px-4 py-3">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1 min-w-40">
            {toFa(stats.lowStock)} کالا کمتر از {toFa(threshold)} عدد موجودی دارد؛ برای جلوگیری از از‌دست‌رفتن فروش، موجودی را شارژ کنید.
          </span>
          <Button
            size="sm" variant="outline"
            className="h-7 gap-1 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/15"
            onClick={() => navigate("/admin?tab=products")}
          >
            <PackagePlus className="size-3.5" /> شارژ موجودی
          </Button>
        </div>
      )}

      <PendingQuestionsWidget />

      {/* charts */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <SalesChart data={stats.dailyRevenue} />
        <StatusDistribution byStatus={stats.ordersByStatus} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* recent orders */}
        <div className="glass rounded-xl p-4">
          <h3 className="font-bold text-sm mb-3">سفارش‌های اخیر</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto scroll-slim">
            {stats.recentOrders.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">هنوز سفارشی ثبت نشده است.</p>}
            {stats.recentOrders.map((o: Order) => (
              <button
                key={o.id}
                onClick={() => navigate("/admin?tab=orders")}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-secondary/60 transition-colors text-right"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold num" dir="ltr">{o.code}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px]", STATUS_COLOR[o.status])}>
                    {ORDER_STATUS_FA[o.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">{timeAgo(o.createdAt)}</span>
                  <span className="text-xs font-bold num text-brand">{formatToman(o.total)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* top products */}
        <div className="glass rounded-xl p-4">
          <h3 className="font-bold text-sm mb-3">پرفروش‌ترین کالاها</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto scroll-slim">
            {stats.topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-1 py-1.5">
                <span className="grid place-items-center size-6 rounded-md bg-brand/15 text-brand text-[10px] font-extrabold num shrink-0">
                  {toFa(i + 1)}
                </span>
                <span className="flex-1 text-xs clamp-2">{p.name}</span>
                <span className="text-[10px] text-muted-foreground num shrink-0">{toFa(p.sold)} فروش</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", stock: "", categoryId: "" });
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [exporting, setExporting] = useState(false);
  const [useCustomTiers, setUseCustomTiers] = useState(false);
  const [tierRows, setTierRows] = useState<Array<{ minQty: string; percent: string }>>([
    { minQty: "", percent: "" },
  ]);
  // shared admin-stats cache → low-stock threshold (server default 5)
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats });
  const threshold = stats?.lowStockThreshold ?? 5;
  const [thOpen, setThOpen] = useState(false);
  const [thValue, setThValue] = useState<string>("");

  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const { data } = useQuery({
    queryKey: ["admin-products", q, page],
    queryFn: () => api.adminProducts({ q, page, perPage: 12 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["home"] });
  };

  /** One-click restock: adds `add` units to the current stock. */
  const restock = async (p: Product, add: number) => {
    try {
      const next = p.stock + add;
      await api.adminUpdateProduct(p.id, { stock: next });
      toast.success(`موجودی «${p.name}» به ${toFa(next)} رسید`, {
        description: `+${toFa(add)} عدد شارژ سریع`,
      });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در شارژ موجودی");
    }
  };

  /** Save the configurable low-stock threshold. */
  const saveThreshold = async () => {
    const n = Number(thValue);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast.error("آستانه باید عددی بین ۱ تا ۱۰۰ باشد");
      return;
    }
    try {
      const res = await api.adminUpdateSettings({ inventory: { lowStockThreshold: Math.round(n) } });
      toast.success(`آستانهٔ کم‌موجودی روی ${toFa(res.inventory.lowStockThreshold)} تنظیم شد`);
      setThOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیرهٔ تنظیمات");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.adminUpdateProduct(editing.id, {
        name: editing.name,
        price: Number(editing.price) || 0,
        oldPrice: editing.oldPrice ? Number(editing.oldPrice) : null,
        stock: Number(editing.stock) || 0,
        featured: editing.featured,
        active: editing.active,
        bulkTiers: useCustomTiers
          ? tierRows
              .map((r) => ({ minQty: Number(r.minQty), percent: Number(r.percent) }))
              .filter((r) => r.minQty > 0 && r.percent > 0)
          : null,
      });
      toast.success("کالا به‌روزرسانی شد");
      setEditing(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    }
  };

  const createProduct = async () => {
    if (!form.name.trim() || !form.price || !form.categoryId) {
      return toast.error("نام، قیمت و دسته‌بندی الزامی است");
    }
    try {
      await api.adminCreateProduct({
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        categoryId: form.categoryId,
      });
      toast.success("کالای جدید ساخته شد");
      setCreating(false);
      setForm({ name: "", price: "", stock: "", categoryId: "" });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت کالا");
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await api.adminDeleteProduct(deleting.id);
      toast.success(`«${deleting.name}» حذف شد`);
      setDeleting(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف");
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      // fetch all pages (inactive included)
      const all: Product[] = [];
      let p = 1;
      for (;;) {
        const res = await api.adminProducts({ page: p, perPage: 100 });
        all.push(...res.items);
        if (p >= res.pages || res.items.length === 0) break;
        p++;
      }
      const catName = (id: string) => categories?.find((c) => c.id === id)?.name ?? id;
      const headers = ["شناسه", "کد کالا", "نام", "دسته‌بندی", "برند", "قیمت", "قیمت قبل", "موجودی", "فروش", "امتیاز", "فعال", "ویژه"];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = all.map((x) =>
        [x.id, x.sku, x.name, catName(x.categoryId), x.brandName, x.price, x.oldPrice ?? "", x.stock, x.sold, x.ratingAvg, x.active ? "بله" : "خیر", x.featured ? "بله" : "خیر"].map(esc).join(","),
      );
      const csv = "\ufeff" + [headers.map(esc).join(","), ...rows].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `yassaei-products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`خروجی CSV با ${toFa(all.length)} کالا دانلود شد`);
    } catch {
      toast.error("خطا در ساخت خروجی CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="جست‌وجوی کالا…"
          className="h-9 max-w-56 text-xs"
        />
        <Button
          size="sm" variant="outline"
          className="gap-1.5 mr-auto"
          disabled={exporting}
          onClick={exportCsv}
        >
          <Download className="size-4" /> {exporting ? "در حال آماده‌سازی…" : "خروجی CSV"}
        </Button>
        <Popover
          open={thOpen}
          onOpenChange={(v) => {
            setThOpen(v);
            if (v) setThValue(String(threshold));
          }}
        >
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" aria-label="تنظیم آستانهٔ کم‌موجودی">
              <SlidersHorizontal className="size-3.5" /> آستانه: {toFa(threshold)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3 space-y-2.5">
            <div className="space-y-1">
              <p className="text-xs font-bold">آستانهٔ کالای کم‌موجود</p>
              <p className="text-[10px] text-muted-foreground leading-4">
                کالاهایی با موجودی کمتر از این عدد با رنگ هشدار نمایش داده می‌شوند و شمارندهٔ «شارژ موجودی» را پر می‌کنند.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                value={thValue}
                onChange={(e) => setThValue(e.target.value.replace(/\D/g, ""))}
                className="h-8 text-xs num text-center" dir="ltr"
                inputMode="numeric"
                aria-label="عدد آستانهٔ کم‌موجودی"
              />
              <Button size="sm" className="h-8 gap-1 px-3" onClick={saveThreshold}>
                <Check className="size-3.5" /> ذخیره
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> کالای جدید
        </Button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-right text-[11px]">کالا</TableHead>
              <TableHead className="text-right text-[11px]">قیمت (تومان)</TableHead>
              <TableHead className="text-right text-[11px]">موجودی</TableHead>
              <TableHead className="text-center text-[11px]">فعال</TableHead>
              <TableHead className="text-center text-[11px]">ویژه</TableHead>
              <TableHead className="text-center text-[11px]">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-56">
                  <div className="flex items-center gap-2">
                    { }
                    <img src={p.images?.[0]} alt="" className="size-9 rounded-lg bg-secondary/40 object-contain shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground num" dir="ltr">{p.sku}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs num">{formatToman(p.price)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs num font-bold", p.stock === 0 ? "text-red-400" : p.stock < threshold ? "text-amber-400" : "text-emerald-400")}>
                      {toFa(p.stock)}
                    </span>
                    {p.stock < threshold && (
                      <Button
                        size="sm" variant="outline"
                        className="h-6 px-1.5 text-[10px] gap-0.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300"
                        disabled={p.stock >= 95}
                        onClick={() => restock(p, 10)}
                        aria-label={`شارژ سریع ۱۰ عدد به ${p.name}`}
                        title="شارژ سریع +۱۰"
                      >
                        <Plus className="size-3" /> شارژ ۱۰
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={p.active}
                    onCheckedChange={async (v) => {
                      await api.adminUpdateProduct(p.id, { active: v });
                      invalidate();
                    }}
                    aria-label="فعال/غیرفعال"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={p.featured}
                    onCheckedChange={async (v) => {
                      await api.adminUpdateProduct(p.id, { featured: v });
                      invalidate();
                    }}
                    aria-label="ویژه"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => {
                      setEditing(p);
                      const custom = p.bulkTiers?.length ? p.bulkTiers : null;
                      setUseCustomTiers(!!custom);
                      setTierRows(custom ? custom.map((t) => ({ minQty: String(t.minQty), percent: String(t.percent) })) : [{ minQty: "", percent: "" }]);
                    }} aria-label="ویرایش">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-red-400 hover:text-red-300" onClick={() => setDeleting(p)} aria-label="حذف">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: data.pages }).map((_, i) => (
            <Button key={i} size="icon" variant={i + 1 === data.page ? "default" : "outline"} className="size-8 text-xs num" onClick={() => setPage(i + 1)}>
              {toFa(i + 1)}
            </Button>
          ))}
        </div>
      )}

      {/* edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">ویرایش کالا</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نام کالا</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">قیمت</Label>
                  <Input
                    value={String(editing.price)}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="h-9 text-xs num" dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">موجودی</Label>
                  <Input
                    value={String(editing.stock)}
                    onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="h-9 text-xs num" dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">قیمت قبل</Label>
                  <Input
                    value={editing.oldPrice ? String(editing.oldPrice) : ""}
                    onChange={(e) => setEditing({ ...editing, oldPrice: Number(e.target.value.replace(/\D/g, "")) || null })}
                    className="h-9 text-xs num" dir="ltr"
                  />
                </div>
              </div>

              {/* per-product bulk-tier override */}
              <Separator />
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs">تخفیف عمده اختصاصی</Label>
                    <p className="text-[10px] text-muted-foreground leading-4">
                      پیش‌فرض: نرخ سراسری فروشگاه — ٪۳ از ۵ عدد، ٪۷ از ۱۰ عدد، ٪۱۲ از ۲۵ عدد
                    </p>
                  </div>
                  <Switch
                    checked={useCustomTiers}
                    onCheckedChange={(v) => {
                      setUseCustomTiers(v);
                      if (v && tierRows.length === 0) setTierRows([{ minQty: "", percent: "" }]);
                    }}
                    aria-label="فعال‌سازی نرخ عمده اختصاصی"
                  />
                </div>
                {useCustomTiers && (
                  <div className="space-y-1.5 rounded-xl border border-border/60 bg-secondary/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="flex-1">حداقل تعداد</span>
                      <span className="flex-1">درصد تخفیف</span>
                      <span className="size-7" aria-hidden />
                    </div>
                    {tierRows.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          value={row.minQty}
                          onChange={(e) => {
                            const next = [...tierRows];
                            next[i] = { ...next[i], minQty: e.target.value.replace(/\D/g, "") };
                            setTierRows(next);
                          }}
                          className="h-8 flex-1 text-xs num" dir="ltr"
                          placeholder="۵"
                          aria-label={`حداقل تعداد پله ${i + 1}`}
                        />
                        <span className="text-[10px] text-muted-foreground shrink-0">٪</span>
                        <Input
                          value={row.percent}
                          onChange={(e) => {
                            const next = [...tierRows];
                            next[i] = { ...next[i], percent: e.target.value.replace(/\D/g, "") };
                            setTierRows(next);
                          }}
                          className="h-8 flex-1 text-xs num" dir="ltr"
                          placeholder="۷"
                          aria-label={`درصد تخفیف پله ${i + 1}`}
                        />
                        <Button
                          size="icon" variant="ghost"
                          className="size-7 text-red-400 hover:text-red-300 shrink-0"
                          disabled={tierRows.length <= 1}
                          onClick={() => setTierRows(tierRows.filter((_, j) => j !== i))}
                          aria-label={`حذف پله ${i + 1}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm" variant="outline"
                      className="w-full gap-1.5 h-7 text-[11px]"
                      disabled={tierRows.length >= 4}
                      onClick={() => setTierRows([...tierRows, { minQty: "", percent: "" }])}
                    >
                      <Plus className="size-3" /> افزودن پله
                    </Button>

                    {/* live wholesale-price preview (mirrors backend rounding) */}
                    {(() => {
                      const price = Number(editing?.price) || 0;
                      const rows = tierRows
                        .map((r) => ({ minQty: Number(r.minQty), percent: Number(r.percent) }))
                        .filter((r) => r.minQty >= 2 && r.percent > 0)
                        .sort((a, b) => a.minQty - b.minQty);
                      if (!rows.length || price <= 0) return null;
                      return (
                        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-2 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <BadgePercent className="size-3" />
                            پیش‌نمایش قیمت عمده برای «{editing?.name}»
                          </div>
                          {rows.map((r, i) => {
                            const unit = Math.floor((price * (100 - r.percent)) / 100);
                            return (
                              <div key={i} className="flex items-center justify-between text-[10px] num">
                                <span className="text-muted-foreground">
                                  از {toFa(r.minQty)} عدد (٪{toFa(r.percent)})
                                </span>
                                <span className="font-bold text-emerald-300">
                                  {formatToman(unit)} <span className="text-muted-foreground font-normal">تومان / عدد</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>انصراف</Button>
            <Button size="sm" onClick={saveEdit}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">کالای جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">نام کالا *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-xs" placeholder="مثلاً خازن سرامیکی ۱۰۰nF" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">قیمت (تومان) *</Label>
                <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })} className="h-9 text-xs num" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">موجودی</Label>
                <Input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })} className="h-9 text-xs num" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">دسته‌بندی *</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="انتخاب دسته" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>انصراف</Button>
            <Button size="sm" onClick={createProduct}>ساخت کالا</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">حذف کالا</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-6">
            «{deleting?.name}» برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>انصراف</Button>
            <Button size="sm" variant="destructive" onClick={doDelete}>حذف قطعی</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-orders", status, q],
    queryFn: () => api.adminOrders(status === "all" ? { q } : { status, q }),
  });

  const setStatusOf = async (id: string, st: string) => {
    try {
      await api.adminUpdateOrder(id, st);
      toast.success(`وضعیت سفارش به «${ORDER_STATUS_FA[st]}» تغییر کرد`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">همهٔ وضعیت‌ها</SelectItem>
            {Object.entries(ORDER_STATUS_FA).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 right-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="کد سفارش، نام، تلفن یا کالا…"
            className="h-9 w-56 pr-8 text-xs"
            aria-label="جست‌وجوی سفارش"
          />
        </div>
        {q && (
          <span className="text-[10px] text-muted-foreground num">
            {toFa(data?.total ?? 0)} نتیجه
          </span>
        )}
      </div>

      <div className="space-y-3">
        {data?.items.length === 0 && (
          <div className="glass rounded-xl p-10 text-center text-xs text-muted-foreground">
            {q ? `سفارشی برای «${q}» پیدا نشد.` : "سفارشی با این وضعیت نیست."}
          </div>
        )}
        {data?.items.map((o) => (
          <div key={o.id} className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold num" dir="ltr">{o.code}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLOR[o.status])}>
                  {ORDER_STATUS_FA[o.status]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{timeAgo(o.createdAt)}</span>
                <span>{o.customer.name}</span>
                <span className="text-xs font-bold text-brand num">{formatToman(o.total)}</span>
              </div>
            </div>
            <StatusTimeline history={o.statusHistory} status={o.status} />
            <Separator />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {o.items.length} قلم کالا — {o.customer.phone}
              </div>
              <div className="flex items-center gap-1.5">
                {["pending", "processing", "shipped", "done", "canceled"].map((st) => (
                  <Button
                    key={st}
                    size="sm" variant={o.status === st ? "default" : "outline"}
                    className="h-7 px-2.5 text-[10px]"
                    disabled={o.status === st}
                    onClick={() => setStatusOf(o.id, st)}
                  >
                    {ORDER_STATUS_FA[st]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Q&A moderation: answer, edit, delete, CSV export. */
function QuestionsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-questions", status],
    queryFn: () => api.adminQuestions(status === "all" ? { perPage: 50 } : { status, perPage: 50 }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-questions-count"] });
  };

  const answer = async (id: string) => {
    const text = (answers[id] ?? "").trim();
    if (text.length < 2) {
      toast.error("متن پاسخ را وارد کنید");
      return;
    }
    setBusy(true);
    try {
      await api.adminAnswerQuestion(id, text);
      toast.success("پاسخ ثبت شد و در صفحهٔ محصول نمایش داده می‌شود");
      setAnswers((s) => ({ ...s, [id]: "" }));
      setEditing((s) => ({ ...s, [id]: false }));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((v) => (v === id ? null : v)), 3000);
      return;
    }
    setConfirmDel(null);
    try {
      await api.adminDeleteQuestion(id);
      toast.success("پرسش حذف شد");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      // fetch all pages regardless of the active filter
      const items: Array<Record<string, unknown>> = [];
      let p = 1;
      for (;;) {
        const res = await api.adminQuestions({ page: p, perPage: 100 });
        items.push(...(res.items as unknown as Array<Record<string, unknown>>));
        if (p >= res.pages || res.items.length === 0) break;
        p++;
      }
      const headers = ["شناسه", "کالا", "پرسش‌دهنده", "پرسش", "پاسخ", "رأی مفید", "تاریخ پرسش", "تاریخ پاسخ"];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = items.map((x) =>
        [x.id, x.productName, x.name, x.question, x.answer ?? "", x.helpful ?? 0, x.createdAt, x.answeredAt ?? ""]
          .map(esc)
          .join(","),
      );
      const csv = "\ufeff" + [headers.map(esc).join(","), ...rows].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `yassaei-questions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`خروجی CSV با ${toFa(items.length)} پرسش دانلود شد`);
    } catch {
      toast.error("خطا در ساخت خروجی CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending" className="text-xs">در انتظار پاسخ</SelectItem>
              <SelectItem value="answered" className="text-xs">پاسخ‌داده‌شده</SelectItem>
              <SelectItem value="all" className="text-xs">همه</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" disabled={exporting} onClick={exportCsv}>
            <Download className="size-3.5" /> {exporting ? "در حال آماده‌سازی…" : "خروجی CSV"}
          </Button>
        </div>
        {data && (
          <span className="text-[10px] text-muted-foreground num">
            {toFa(data.total)} پرسش — {toFa(data.pending)} بی‌پاسخ
          </span>
        )}
      </div>

      {data?.items.length === 0 && (
        <div className="glass rounded-xl p-10 text-center text-xs text-muted-foreground">
          پرسشی در این وضعیت نیست.
        </div>
      )}

      <div className="space-y-3">
        {data?.items.map((q) => {
          const isOpen = editing[q.id] || (status === "pending" && !q.answer);
          return (
            <div key={q.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid place-items-center size-8 rounded-full bg-brand/15 text-brand text-xs font-bold shrink-0">
                    {q.name?.[0] || "؟"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{q.name}</div>
                    <a
                      href={`#/product/${q.productId}`}
                      className="text-[10px] text-brand hover:underline truncate block max-w-52"
                    >
                      {q.productName}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    q.answer ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400",
                  )}>
                    {q.answer ? "پاسخ‌داده" : "در انتظار پاسخ"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(q.createdAt)}</span>
                </div>
              </div>

              <p className="text-xs leading-6 rounded-lg bg-secondary/40 p-3">{q.question}</p>

              {q.answer && !editing[q.id] && (
                <div className="rounded-lg border border-brand/25 bg-brand/5 p-3 text-xs leading-6">
                  <span className="text-[10px] font-bold text-brand block mb-0.5">پاسخ ثبت‌شده</span>
                  {q.answer}
                  <div className="text-[9px] text-muted-foreground mt-1">
                    {q.answeredAt ? timeAgo(q.answeredAt) : ""}
                  </div>
                </div>
              )}

              {isOpen ? (
                <div className="space-y-2">
                  <Textarea
                    value={answers[q.id] ?? q.answer ?? ""}
                    onChange={(e) => setAnswers((s) => ({ ...s, [q.id]: e.target.value }))}
                    placeholder="پاسخ کارشناس فروشگاه…"
                    className="min-h-20 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy} onClick={() => answer(q.id)}>ثبت پاسخ</Button>
                    {q.answer && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEditing((s) => ({ ...s, [q.id]: false }))}>
                        انصراف
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setEditing((s) => ({ ...s, [q.id]: true }))}>
                    <Pencil className="size-3" /> ویرایش پاسخ
                  </Button>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn("h-7 text-[10px] gap-1", confirmDel === q.id ? "text-red-400 bg-red-500/10" : "text-muted-foreground")}
                  onClick={() => remove(q.id)}
                >
                  <Trash2 className="size-3" />
                  {confirmDel === q.id ? "تأیید حذف؟" : "حذف"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Admin panel: dashboard / products / orders / Q&A tabs ── */
export function AdminView({ initialTab }: { initialTab?: string }) {
  const [lastInitial, setLastInitial] = useState(initialTab);
  const [tab, setTab] = useState(initialTab ?? "dashboard");

  // pending-questions badge (polled lightly so the tab stays fresh)
  const { data: qCount } = useQuery({
    queryKey: ["admin-questions-count"],
    queryFn: api.adminQuestionsCount,
    refetchInterval: 60_000,
  });
  const pendingCount = qCount?.pending ?? 0;

  // query-only route changes (e.g. /admin → /admin?tab=orders) don't remount this view;
  // adjust state during render when the initialTab prop changes (React-recommended pattern)
  if (lastInitial !== initialTab) {
    setLastInitial(initialTab);
    setTab(initialTab ?? "dashboard");
  }

  return (
    <Guard>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <a href="#/" className="hover:text-brand">خانه</a>
          <ChevronLeft className="size-3.5" />
          <span className="text-foreground">پنل مدیریت</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="grid place-items-center size-11 rounded-xl bg-amber-500/15 text-amber-400">
            <Store className="size-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">پنل مدیریت یاسایی</h1>
            <p className="text-[11px] text-muted-foreground">مدیریت کالاها، سفارش‌ها و فروش</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full max-w-xl grid-cols-4">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5"><LayoutDashboard className="size-3.5" /> داشبورد</TabsTrigger>
            <TabsTrigger value="products" className="text-xs gap-1.5"><Package className="size-3.5" /> کالاها</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs gap-1.5"><ShoppingCart className="size-3.5" /> سفارش‌ها</TabsTrigger>
            <TabsTrigger value="questions" className="text-xs gap-1.5 relative">
              <CircleHelp className="size-3.5" /> پرسش‌ها
              {pendingCount > 0 && (
                <span className="grid place-items-center min-w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-amber-950 px-1 num">
                  {toFa(pendingCount)}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-5"><DashboardTab /></TabsContent>
          <TabsContent value="products" className="mt-5"><ProductsTab /></TabsContent>
          <TabsContent value="orders" className="mt-5"><OrdersTab /></TabsContent>
          <TabsContent value="questions" className="mt-5"><QuestionsTab /></TabsContent>
        </Tabs>
      </div>
    </Guard>
  );
}
