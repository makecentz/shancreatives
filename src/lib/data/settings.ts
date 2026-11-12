import "server-only";
import type { ShippingRate } from "../cart-validation";
import type { Discount } from "../discounts";
import { isDemoMode } from "../env";
import { supabaseAdmin, supabaseServer } from "../supabase/server";

export interface PickupLocation {
  id: string;
  name: string;
  addressLines: string[];
  instructions: string;
  schedulingNote: string | null;
  windows: string[];
}

/* Demo values are labelled and only used when Supabase isn't configured. */
const DEMO_RATES: ShippingRate[] = [
  { id: "demo-standard", name: "Standard shipping (demo rate)", amountCents: 695, freeOverCents: 7500, minDays: 3, maxDays: 6 },
  { id: "demo-priority", name: "Priority shipping (demo rate)", amountCents: 1295, freeOverCents: null, minDays: 1, maxDays: 3 },
];
const DEMO_PICKUP: PickupLocation[] = [
  { id: "demo-pickup", name: "Studio pickup (demo)", addressLines: ["Pickup address is set by the owner in Admin > Shipping & Pickup"], instructions: "We'll email you when your order is ready to collect.", schedulingNote: "Choose a preferred window; we'll confirm by email.", windows: ["Weekday evenings", "Saturday mornings"] },
];

export async function getShippingRates(): Promise<ShippingRate[]> {
  if (isDemoMode()) return DEMO_RATES;
  const sb = await supabaseServer();
  const { data } = await sb.from("shipping_rates").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, amountCents: Number(r.amount_cents), freeOverCents: r.free_over_cents == null ? null : Number(r.free_over_cents), minDays: r.min_days, maxDays: r.max_days }));
}

export async function getPickupLocations(): Promise<PickupLocation[]> {
  if (isDemoMode()) return DEMO_PICKUP;
  const sb = await supabaseServer();
  const { data } = await sb.from("pickup_locations").select("*").eq("is_active", true);
  return (data ?? []).map((r) => {
    const a = (r.address ?? {}) as Record<string, string>;
    return {
      id: r.id,
      name: r.name,
      addressLines: [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(", ")].filter(Boolean),
      instructions: r.instructions ?? "",
      schedulingNote: r.scheduling_note,
      windows: (r.available_windows as string[]) ?? [],
    };
  });
}

export async function getTaxSettings(): Promise<{ rateBps: number; taxShipping: boolean; configured: boolean }> {
  if (isDemoMode()) return { rateBps: 0, taxShipping: false, configured: false };
  const sb = await supabaseServer();
  const { data } = await sb.from("tax_settings").select("*").eq("id", 1).maybeSingle();
  return { rateBps: data?.default_rate_bps ?? 0, taxShipping: data?.tax_shipping ?? false, configured: (data?.default_rate_bps ?? 0) > 0 };
}

/** Discounts are not publicly readable (RLS); look them up with the service role on the server. */
export async function getDiscountByCode(code: string | null | undefined): Promise<Discount | undefined> {
  if (!code || isDemoMode()) return undefined;
  const { data } = await supabaseAdmin().from("discounts").select("*").ilike("code", code.trim()).maybeSingle();
  if (!data) return undefined;
  return {
    id: data.id,
    code: data.code,
    kind: data.kind,
    value: Number(data.value),
    productIds: data.product_ids,
    minSubtotalCents: Number(data.min_subtotal_cents),
    usageLimit: data.usage_limit,
    usageCount: data.usage_count,
    perCustomerLimit: data.per_customer_limit,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    isActive: data.is_active,
  };
}
