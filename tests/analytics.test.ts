import { describe, expect, it } from "vitest";
import { dashboardStats, reportSummary, revenueSeries, topProducts } from "@/lib/analytics";
import { order } from "./fixtures";

const now = new Date("2026-11-12T18:00:00Z");

describe("analytics are computed from records", () => {
  const orders = [
    order({ totalCents: 5000, createdAt: "2026-11-10T10:00:00Z" }),
    order({ totalCents: 3000, refundedCents: 1000, paymentStatus: "partially_refunded", createdAt: "2026-11-11T10:00:00Z" }),
    order({ totalCents: 9999, paymentStatus: "failed", createdAt: "2026-11-11T11:00:00Z" }),
    order({ totalCents: 4000, paymentStatus: "pending", createdAt: "2026-11-11T12:00:00Z" }),
    order({ totalCents: 2000, createdAt: "2026-10-05T10:00:00Z" }),
  ];

  it("excludes unpaid and failed orders from revenue and subtracts refunds", () => {
    const s = reportSummary(orders, [], new Date("2026-11-01T00:00:00Z"), new Date("2026-11-13T00:00:00Z"));
    expect(s.grossCents).toBe(8000);
    expect(s.refundsCents).toBe(1000);
    expect(s.netCents).toBe(7000);
    expect(s.failedPayments).toBe(1);
    expect(s.averageOrderValueCents).toBe(4000);
  });

  it("produces zeroes, not invented numbers, with no data", () => {
    const st = dashboardStats([], [], now);
    for (const m of Object.values(st)) expect(m).toEqual({ value: 0, previous: 0, changePct: null });
    expect(revenueSeries([], "7d", now).every((p) => p.revenueCents === 0)).toBe(true);
    expect(topProducts([])).toEqual([]);
  });

  it("compares month-to-date against the same span last month", () => {
    const st = dashboardStats(orders, [], now);
    expect(st.monthlyRevenue.value).toBe(5000 + 2000); // net of the 1000 refund
    expect(st.monthlyRevenue.previous).toBe(2000);
    expect(st.monthlyRevenue.changePct).toBe(250);
    expect(st.totalOrders.value).toBe(2);
  });

  it("revenue series sums match paid orders in range", () => {
    const total = revenueSeries(orders, "30d", now).reduce((t, p) => t + p.revenueCents, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(5000 + 3000 + 2000);
  });
});
