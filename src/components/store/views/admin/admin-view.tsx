"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, ShoppingCart, Users, TrendingUp, AlertTriangle,
  ChevronLeft, Pencil, Trash2, Plus, Store,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/store/api";
import { navigate, toFa, formatToman, timeAgo, ORDER_STATUS_FA } from "@/lib/store/router";
import { useAuth } from "@/lib/store/auth-store";
import type { Order, Product } from "@/lib/store/types";
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

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  processing: "bg-brand/15 text-brand",
  shipped: "bg-violet-500/15 text-violet-400",
  done: "bg-emerald-500/15 text-emerald-400",
  canceled: "bg-red-500/15 text-red-400",
};

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

function DashboardTab() {
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats, refetchInterval: 30_000 });

  if (!stats) return <div className="animate-pulse grid sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 glass rounded-xl" />)}</div>;

  const cards = [
    { icon: Package, label: "کالاها", value: toFa(stats.products), sub: `${toFa(stats.lowStock)} کم‌موجود`, accent: "text-brand bg-brand/15" },
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

      {stats.lowStock > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs px-4 py-3">
          <AlertTriangle className="size-4 shrink-0" />
          {toFa(stats.lowStock)} کالا کمتر از ۵ عدد موجودی دارد؛ برای جلوگیری از از‌دست‌رفتن فروش، موجودی را شارژ کنید.
        </div>
      )}

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="جست‌وجوی کالا…"
          className="h-9 max-w-56 text-xs"
        />
        <Button size="sm" className="gap-1.5 mr-auto" onClick={() => setCreating(true)}>
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
                  <span className={cn("text-xs num font-bold", p.stock === 0 ? "text-red-400" : p.stock < 5 ? "text-amber-400" : "text-emerald-400")}>
                    {toFa(p.stock)}
                  </span>
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
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(p)} aria-label="ویرایش">
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
  const { data } = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: () => api.adminOrders(status === "all" ? {} : { status }),
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

      <div className="space-y-3">
        {data?.items.length === 0 && (
          <div className="glass rounded-xl p-10 text-center text-xs text-muted-foreground">سفارشی با این وضعیت نیست.</div>
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

export function AdminView({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "dashboard");

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
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5"><LayoutDashboard className="size-3.5" /> داشبورد</TabsTrigger>
            <TabsTrigger value="products" className="text-xs gap-1.5"><Package className="size-3.5" /> کالاها</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs gap-1.5"><ShoppingCart className="size-3.5" /> سفارش‌ها</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-5"><DashboardTab /></TabsContent>
          <TabsContent value="products" className="mt-5"><ProductsTab /></TabsContent>
          <TabsContent value="orders" className="mt-5"><OrdersTab /></TabsContent>
        </Tabs>
      </div>
    </Guard>
  );
}
