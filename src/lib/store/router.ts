// ── Hash router: parse `#/path?query` into route + params ──
import { useCallback, useEffect, useSyncExternalStore } from "react";

export interface RouteInfo {
  path: string;          // e.g. "/product/ys-001"
  segments: string[];    // ["product", "ys-001"]
  query: URLSearchParams;
  full: string;          // raw hash
}

const EMPTY_ROUTE: RouteInfo = {
  path: "/",
  segments: [],
  query: new URLSearchParams(),
  full: "#/",
};

function parseHashFrom(raw: string): RouteInfo {
  const hash = raw.startsWith("#") ? raw.slice(1) : raw;
  const [pathPart, queryPart] = hash.split("?");
  const path = pathPart && pathPart.startsWith("/") ? pathPart : `/${pathPart || ""}`;
  return {
    path: path.replace(/\/+$/, "") || "/",
    segments: path.split("/").filter(Boolean),
    query: new URLSearchParams(queryPart || ""),
    full: raw,
  };
}

function parseHash(): RouteInfo {
  if (typeof window === "undefined") return EMPTY_ROUTE;
  return parseHashFrom(window.location.hash || "#/");
}

// getSnapshot must be referentially stable between hash changes
let lastRaw = "";
let cachedRoute: RouteInfo = EMPTY_ROUTE;

function getSnapshot(): RouteInfo {
  const raw = window.location.hash || "#/";
  if (raw !== lastRaw) {
    lastRaw = raw;
    cachedRoute = parseHashFrom(raw);
  }
  return cachedRoute;
}

function getServerSnapshot(): RouteInfo {
  return EMPTY_ROUTE;
}

function subscribeHashChange(callback: () => void): () => void {
  const handler = () => {
    window.scrollTo({ top: 0 });
    callback();
  };
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}

export function navigate(to: string, replace = false) {
  const target = to.startsWith("#") ? to : `#${to.startsWith("/") ? to : `/${to}`}`;
  if (replace) window.history.replaceState(null, "", target);
  else window.location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useHashRoute(): RouteInfo {
  return useSyncExternalStore(subscribeHashChange, getSnapshot, getServerSnapshot);
}

export function useQueryUpdater(path: string) {
  return useCallback(
    (updates: Record<string, string | number | undefined>, replace = false) => {
      const raw = window.location.hash || "#/";
      const hash = raw.startsWith("#") ? raw.slice(1) : raw;
      const [pathPart, queryPart] = hash.split("?");
      const q = new URLSearchParams(queryPart || "");
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === "") q.delete(k);
        else q.set(k, String(v));
      }
      const s = q.toString();
      navigate(`${pathPart || path}${s ? `?${s}` : ""}`, replace);
    },
    [path],
  );
}

// ── Persian digit helpers ──
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

const BASE_TITLE = "یاسایی | فروشگاه قطعات الکترونیک و لوازم الکتریکی تهران";

/** Set the browser tab title for the current view (SSR-safe, no-op until mount). */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = title ? `${title} | یاسایی الکترونیک` : BASE_TITLE;
  }, [title]);
}

export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function formatToman(n: number): string {
  return toFa(n.toLocaleString("en-US"));
}

export function formatPrice(n: number): string {
  return `${formatToman(n)} تومان`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "لحظه‌ای پیش";
  if (mins < 60) return `${toFa(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFa(days)} روز پیش`;
  return new Date(iso).toLocaleDateString("fa-IR");
}

export const ORDER_STATUS_FA: Record<string, string> = {
  pending: "در انتظار بررسی",
  processing: "در حال پردازش",
  shipped: "ارسال شده",
  done: "تحویل شده",
  canceled: "لغو شده",
};

export const SHIPPING_FA: Record<string, string> = {
  post: "پست پیشتاز",
  peyk: "پیک موتوری (تهران)",
  pickup: "تحویل حضوری در فروشگاه",
};

export const PAYMENT_FA: Record<string, string> = {
  online: "پرداخت آنلاین",
  cod: "پرداخت در محل",
};
