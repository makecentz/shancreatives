import type { Cents } from "./money";
import type { Customer, Order } from "./types";

/**
 * Pure analytics over stored order records. The same functions run against
 * Supabase rows in production and against labelled demo rows in demo mode,
 * so no figure on the dashboard is ever hardcoded.
 */

const DAY = 86400000;

/** Revenue-recognised orders: paid, partially refunded or refunded (net of refunds). */
export function isRevenueOrder(o: Order) {
  return o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded" || o.paymentStatus === "refunded";
}

export function netRevenue(o: Order): Cents {
  return isRevenueOrder(o) ? o.totalCents - o.refundedCents : 0;
}

export interface Metric {
  value: number;
  previous: number;
  /** percentage change vs previous period, null when previous is zero */
  changePct: number | null;
}

function metric(value: number, previous: number): Metric {
  return { value, previous, changePct: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10 };
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function monthStart(d: Date, offset = 0) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}

/**
 * Month-to-date vs the same span of the previous month, so a comparison on
 * the 12th compares days 1–12 with days 1–12 of last month.
 */
export function dashboardStats(orders: Order[], customers: Customer[], now = new Date()) {
  const curStart = monthStart(now);
  const prevStart = monthStart(now, -1);
  const elapsed = now.getTime() - curStart.getTime();
  const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, curStart.getTime()));

  const cur = orders.filter((o) => isRevenueOrder(o) && inRange(o.createdAt, curStart, now));
  const prev = orders.filter((o) => isRevenueOrder(o) && inRange(o.createdAt, prevStart, prevEnd));
  const rev = cur.reduce((s, o) => s + netRevenue(o), 0);
  const prevRev = prev.reduce((s, o) => s + netRevenue(o), 0);
  const aov = cur.length ? Math.round(cur.reduce((s, o) => s + o.totalCents, 0) / cur.length) : 0;
  const prevAov = prev.length ? Math.round(prev.reduce((s, o) => s + o.totalCents, 0) / prev.length) : 0;
  const newCust = customers.filter((c) => inRange(c.createdAt, curStart, now)).length;
  const prevNewCust = customers.filter((c) => inRange(c.createdAt, prevStart, prevEnd)).length;

  return {
    monthlyRevenue: metric(rev, prevRev),
    totalOrders: metric(cur.length, prev.length),
    averageOrderValue: metric(aov, prevAov),
    newCustomers: metric(newCust, prevNewCust),
  };
}

export type RangeKey = "1d" | "7d" | "30d" | "6m" | "max";

export interface RevenuePoint {
  key: string;
  label: string;
  revenueCents: Cents;
  orders: number;
}

/** Bucketed revenue series for the dashboard chart. */
export function revenueSeries(orders: Order[], range: RangeKey, now = new Date()): RevenuePoint[] {
  const paid = orders.filter(isRevenueOrder);
  const buckets: { key: string; label: string; start: number; end: number }[] = [];
  if (range === "1d") {
    const end = now.getTime();
    for (let h = 23; h >= 0; h -= 3) {
      const s = end - (h + 1) * 3600000;
      const e = end - (h - 2) * 3600000;
      const label = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" }).format(new Date(s));
      buckets.push({ key: String(s), label, start: s, end: Math.min(e, end) });
    }
  } else if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    for (let d = days - 1; d >= 0; d--) {
      const s = today - d * DAY;
      const fmt: Intl.DateTimeFormatOptions = range === "7d" ? { weekday: "short", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" };
      buckets.push({ key: String(s), label: new Intl.DateTimeFormat("en-US", fmt).format(new Date(s)), start: s, end: s + DAY });
    }
  } else {
    let months = 6;
    if (range === "max") {
      const first = paid.reduce((m, o) => Math.min(m, new Date(o.createdAt).getTime()), now.getTime());
      const f = new Date(first);
      months = (now.getUTCFullYear() - f.getUTCFullYear()) * 12 + (now.getUTCMonth() - f.getUTCMonth()) + 1;
      months = Math.max(1, months);
    }
    for (let m = months - 1; m >= 0; m--) {
      const s = monthStart(now, -m).getTime();
      const e = monthStart(now, -m + 1).getTime();
      buckets.push({ key: String(s), label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC", ...(months > 12 ? { year: "2-digit" } : {}) }).format(new Date(s)), start: s, end: e });
    }
  }
  return buckets.map((b) => {
    const inB = paid.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= b.start && t < b.end;
    });
    return { key: b.key, label: b.label, revenueCents: inB.reduce((s, o) => s + netRevenue(o), 0), orders: inB.length };
  });
}

export interface TopProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  units: number;
  revenueCents: Cents;
}

export function topProducts(orders: Order[], limit = 5): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const o of orders) {
    if (!isRevenueOrder(o) || o.paymentStatus === "refunded") continue;
    for (const i of o.items) {
      const cur = map.get(i.productId) ?? { productId: i.productId, name: i.productName, imageUrl: i.imageUrl, units: 0, revenueCents: 0 };
      cur.units += i.quantity;
      cur.revenueCents += i.lineTotalCents;
      map.set(i.productId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents).slice(0, limit);
}

export function revenueByCategory(orders: Order[], categoryName: (id: string) => string) {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!isRevenueOrder(o) || o.paymentStatus === "refunded") continue;
    for (const i of o.items) {
      const cat = i.categoryIds[0];
      if (!cat) continue;
      map.set(cat, (map.get(cat) ?? 0) + i.lineTotalCents);
    }
  }
  return [...map.entries()].map(([id, cents]) => ({ id, name: categoryName(id), revenueCents: cents })).sort((a, b) => b.revenueCents - a.revenueCents);
}

export function reportSummary(orders: Order[], customers: Customer[], start: Date, end: Date) {
  const inR = orders.filter((o) => inRange(o.createdAt, start, end));
  const paid = inR.filter(isRevenueOrder);
  const gross = paid.reduce((s, o) => s + o.totalCents, 0);
  const refunds = inR.reduce((s, o) => s + o.refundedCents, 0);
  const custOrders = new Map<string, number>();
  for (const o of orders) if (o.customerId && isRevenueOrder(o)) custOrders.set(o.customerId, (custOrders.get(o.customerId) ?? 0) + 1);
  const buyersInRange = new Set(paid.map((o) => o.customerId).filter(Boolean) as string[]);
  const returning = [...buyersInRange].filter((id) => (custOrders.get(id) ?? 0) > 1).length;
  return {
    grossCents: gross,
    refundsCents: refunds,
    netCents: gross - refunds,
    totalOrders: inR.length,
    pendingOrders: inR.filter((o) => !["completed", "cancelled", "shipped"].includes(o.fulfillmentStatus)).length,
    completedOrders: inR.filter((o) => o.fulfillmentStatus === "completed").length,
    cancelledOrders: inR.filter((o) => o.fulfillmentStatus === "cancelled").length,
    customOrders: inR.filter((o) => o.isCustomOrder).length,
    newCustomers: customers.filter((c) => inRange(c.createdAt, start, end)).length,
    returningCustomers: returning,
    averageOrderValueCents: paid.length ? Math.round(gross / paid.length) : 0,
    stripeCount: paid.filter((o) => o.paymentProvider === "stripe").length,
    squareCount: paid.filter((o) => o.paymentProvider === "square").length,
    failedPayments: inR.filter((o) => o.paymentStatus === "failed").length,
    refundCount: inR.filter((o) => o.refundedCents > 0).length,
  };
}
