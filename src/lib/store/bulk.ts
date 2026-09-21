// ── Bulk quantity-tier discount helpers (mirror of backend/src/routes/shop.ts) ──
import { useQuery } from "@tanstack/react-query";
import { get } from "./api";
import type { BulkTier, Product } from "./types";

/**
 * Fallback tiers used for instant client-side preview (buy box) and as a
 * resilience fallback if the tiers endpoint is unreachable. The authoritative
 * source is GET /api/bulk-tiers; cart/checkout/order pricing is always
 * computed server-side.
 */
export const BULK_TIERS_FALLBACK: BulkTier[] = [
  { minQty: 5, percent: 3 },
  { minQty: 10, percent: 7 },
  { minQty: 25, percent: 12 },
];

/** Fetch tiers from the backend (staleTime ∞ — tiers rarely change). */
export function useBulkTiers(): BulkTier[] {
  const { data } = useQuery({
    queryKey: ["bulk-tiers"],
    queryFn: async () => {
      try {
        const res = await get<{ tiers: BulkTier[] }>("/api/bulk-tiers");
        return res.tiers?.length ? res.tiers : BULK_TIERS_FALLBACK;
      } catch {
        return BULK_TIERS_FALLBACK;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ?? BULK_TIERS_FALLBACK;
}

/** Highest tier reached for a quantity (null when below the first tier). */
export function tierForQty(qty: number, tiers: BulkTier[] = BULK_TIERS_FALLBACK): BulkTier | null {
  let hit: BulkTier | null = null;
  for (const t of tiers) {
    if (qty >= t.minQty) hit = t;
  }
  return hit;
}

/** Effective unit price after the highest reached tier (whole Tomans). */
export function discountedUnit(
  price: number,
  qty: number,
  tiers: BulkTier[] = BULK_TIERS_FALLBACK,
): { unitPrice: number; percent: number } {
  const tier = tierForQty(qty, tiers);
  if (!tier) return { unitPrice: price, percent: 0 };
  return { unitPrice: Math.floor((price * (100 - tier.percent)) / 100), percent: tier.percent };
}

/** Next (unreached) tier — used to nudge "add N more to save X%". */
export function nextTier(qty: number, tiers: BulkTier[] = BULK_TIERS_FALLBACK): BulkTier | null {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  return sorted.find((t) => t.minQty > qty) ?? null;
}

/** Effective tiers for a specific product: its per-product override when valid,
 *  otherwise the store-wide tiers. Hooks must be unconditional, so this accepts
 *  an undefined product (while loading) and falls back to the global query. */
export function useProductTiers(product: Product | null | undefined): BulkTier[] {
  const globalTiers = useBulkTiers();
  const override = product?.bulkTiers;
  if (
    Array.isArray(override) &&
    override.length > 0 &&
    override.every(
      (t) =>
        t && typeof t === "object" && typeof t.minQty === "number" && Number.isFinite(t.minQty) &&
        typeof t.percent === "number" && Number.isFinite(t.percent),
    )
  ) {
    return override;
  }
  return globalTiers;
}
