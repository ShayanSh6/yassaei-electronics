"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Home, LayoutGrid, ShoppingCart, User2 } from "lucide-react";
import { api } from "@/lib/store/api";
import { navigate, useHashRoute, useQueryUpdater, toFa } from "@/lib/store/router";
import { useCart, useCompare, useRecentlyViewed } from "@/lib/store/cart-store";
import { useAuth } from "@/lib/store/auth-store";
import { SiteHeader } from "@/components/store/site-header";
import { SiteFooter } from "@/components/store/site-footer";
import { HomeView } from "@/components/store/views/home-view";
import { CatalogView } from "@/components/store/views/catalog-view";
import { ProductView } from "@/components/store/views/product-view";
import { CartView } from "@/components/store/views/cart-view";
import { CheckoutView } from "@/components/store/views/checkout-view";
import { AuthView } from "@/components/store/views/auth-view";
import { AccountView } from "@/components/store/views/account-view";
import { OrderView } from "@/components/store/views/order-view";
import { PageView } from "@/components/store/views/page-view";
import { NotFoundView } from "@/components/store/views/not-found-view";
import { AdminView } from "@/components/store/views/admin/admin-view";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Router({ route }: { route: ReturnType<typeof useHashRoute> }) {
  const updateCatalogQuery = useQueryUpdater("/catalog");
  const seg = route.segments;

  // /catalog?cat=parts&q=...&sort=...&page=...
  if (seg[0] === "catalog" || (seg.length === 0 && route.query.toString() && route.query.get("cat"))) {
    return (
      <CatalogView
        query={{
          cat: route.query.get("cat") ?? undefined,
          brand: route.query.get("brand") ?? undefined,
          q: route.query.get("q") ?? undefined,
          sort: route.query.get("sort") ?? undefined,
          page: Number(route.query.get("page")) || undefined,
          min: Number(route.query.get("min")) || undefined,
          max: Number(route.query.get("max")) || undefined,
          inStock: route.query.get("inStock") === "1",
          featured: route.query.get("featured") === "1",
          perPage: 12,
        }}
        onQuery={updateCatalogQuery}
      />
    );
  }
  if (seg[0] === "product" && seg[1]) return <ProductView key={seg[1]} id={seg[1]} />;
  if (seg[0] === "cart") return <CartView />;
  if (seg[0] === "checkout") return <CheckoutView />;
  if (seg[0] === "login") return <AuthView mode="login" />;
  if (seg[0] === "register") return <AuthView mode="register" />;
  if (seg[0] === "account") return <AccountView />;
  if (seg[0] === "order" && seg[1]) return <OrderView id={seg[1]} />;
  if (seg[0] === "page" && seg[1]) return <PageView slug={seg[1]} />;
  if (seg[0] === "admin")
    return <AdminView initialTab={route.query.get("tab") ?? "dashboard"} />;
  if (seg.length === 0) return <HomeView />;
  return <NotFoundView />;
}

function MobileBottomNav({ path }: { path: string }) {
  const cartCount = useCart((s) => s.lines.reduce((acc, l) => acc + l.qty, 0));
  const { user } = useAuth();

  const items = [
    { key: "/", icon: Home, label: "خانه" },
    { key: "/catalog", icon: LayoutGrid, label: "فروشگاه" },
    { key: "/cart", icon: ShoppingCart, label: "سبد خرید", badge: cartCount },
    { key: user ? "/account" : "/login", icon: User2, label: user ? "حساب من" : "ورود" },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border/60 bg-background/90 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ناوبری موبایل"
    >
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = path === it.key;
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.key)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                active ? "text-brand" : "text-muted-foreground",
              )}
              aria-label={it.label}
            >
              <span className="relative">
                <it.icon className="size-5" />
                {it.badge ? (
                  <span className="absolute -top-1.5 -left-2 grid place-items-center min-w-4 h-4 px-0.5 rounded-full bg-brand text-primary-foreground text-[9px] font-bold num">
                    {toFa(it.badge)}
                  </span>
                ) : null}
              </span>
              {it.label}
              {active && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function StoreApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StoreShell />
    </QueryClientProvider>
  );
}

function StoreShell() {
  const route = useHashRoute();
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/";
    // rehydrate persisted stores after hydration render (avoids SSR mismatch)
    useCart.persist.rehydrate();
    useAuth.persist.rehydrate();
    useCompare.persist.rehydrate();
    useRecentlyViewed.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader categories={categories ?? []} />

      <main className="flex-1 pb-16 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={route.path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Router route={route} />
          </motion.div>
        </AnimatePresence>
      </main>

      <SiteFooter />
      <MobileBottomNav path={route.path} />
    </div>
  );
}
