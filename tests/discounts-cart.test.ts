import { describe, expect, it } from "vitest";
import { orderTotals, shippingFor, validateCart } from "@/lib/cart-validation";
import { applyDiscount, type Discount } from "@/lib/discounts";
import { product, variant } from "./fixtures";

const base: Discount = { id: "d1", code: "SAVE10", kind: "percentage", value: 1000, productIds: null, minSubtotalCents: 0, usageLimit: null, usageCount: 0, perCustomerLimit: null, startsAt: null, endsAt: null, isActive: true };
const now = new Date("2026-11-12T12:00:00Z");

describe("applyDiscount", () => {
  it("applies percentage and fixed discounts", () => {
    expect(applyDiscount(base, [{ productId: "p1", lineTotalCents: 5000 }], { now })).toMatchObject({ ok: true, amountCents: 500 });
    expect(applyDiscount({ ...base, kind: "fixed", value: 700 }, [{ productId: "p1", lineTotalCents: 5000 }], { now })).toMatchObject({ ok: true, amountCents: 700 });
  });
  it("never discounts more than the eligible total", () => {
    expect(applyDiscount({ ...base, kind: "fixed", value: 99999 }, [{ productId: "p1", lineTotalCents: 1200 }], { now })).toMatchObject({ ok: true, amountCents: 1200 });
    expect(applyDiscount({ ...base, value: 50000 }, [{ productId: "p1", lineTotalCents: 1200 }], { now })).toMatchObject({ ok: true, amountCents: 1200 });
  });
  it("limits product-scoped codes to eligible lines", () => {
    const r = applyDiscount({ ...base, productIds: ["p2"] }, [{ productId: "p1", lineTotalCents: 5000 }, { productId: "p2", lineTotalCents: 2000 }], { now });
    expect(r).toMatchObject({ ok: true, amountCents: 200 });
    expect(applyDiscount({ ...base, productIds: ["p9"] }, [{ productId: "p1", lineTotalCents: 5000 }], { now }).ok).toBe(false);
  });
  it("enforces active, schedule, usage and minimum rules", () => {
    const lines = [{ productId: "p1", lineTotalCents: 3000 }];
    expect(applyDiscount(undefined, lines, { now }).ok).toBe(false);
    expect(applyDiscount({ ...base, isActive: false }, lines, { now }).ok).toBe(false);
    expect(applyDiscount({ ...base, startsAt: "2026-12-01T00:00:00Z" }, lines, { now }).ok).toBe(false);
    expect(applyDiscount({ ...base, endsAt: "2026-11-01T00:00:00Z" }, lines, { now }).ok).toBe(false);
    expect(applyDiscount({ ...base, usageLimit: 5, usageCount: 5 }, lines, { now }).ok).toBe(false);
    expect(applyDiscount({ ...base, perCustomerLimit: 1 }, lines, { now, customerUses: 1 }).ok).toBe(false);
    expect(applyDiscount({ ...base, minSubtotalCents: 5000 }, lines, { now }).ok).toBe(false);
  });
});

describe("validateCart", () => {
  const p = product({ variants: [variant({ stockQuantity: 3, reservedQuantity: 1 })] });

  it("ignores any client price and recomputes from the catalogue", () => {
    const input = { lines: [{ productId: "p1", variantId: "v1", quantity: 1, customize: false, rush: false, selections: {}, priceCents: 1 } as never], discountCode: null };
    const r = validateCart(input, [p], undefined);
    expect(r.subtotalCents).toBe(2500);
  });

  it("rejects quantities above available stock, summed across lines", () => {
    const line = { productId: "p1", variantId: "v1", quantity: 1, customize: false, rush: false, selections: {} };
    const r = validateCart({ lines: [line, { ...line }, { ...line }], discountCode: null }, [p], undefined);
    expect(r.lines).toHaveLength(2);
    expect(r.errors[0].message).toMatch(/Only 2/);
  });

  it("does not stock-check custom made-to-order lines", () => {
    const r = validateCart({ lines: [{ productId: "p1", variantId: "v1", quantity: 10, customize: true, rush: false, selections: { text: "HI" } }], discountCode: null }, [p], undefined);
    expect(r.errors).toHaveLength(0);
  });

  it("flags quote-only items and unknown products", () => {
    const r = validateCart({ lines: [{ productId: "p1", variantId: "v1", quantity: 1, customize: false, rush: false, selections: {} }, { productId: "nope", variantId: null, quantity: 1, customize: false, rush: false, selections: {} }], discountCode: null }, [product({ quoteOnly: true })], undefined);
    expect(r.requiresQuote).toBe(true);
    expect(r.errors).toHaveLength(2);
  });

  it("reports an invalid discount code without failing the cart", () => {
    const r = validateCart({ lines: [{ productId: "p1", variantId: "v1", quantity: 1, customize: false, rush: false, selections: {} }], discountCode: "BOGUS" }, [p], undefined);
    expect(r.discountCents).toBe(0);
    expect(r.discountMessage).toBeTruthy();
  });
});

describe("shipping and totals", () => {
  const rate = { id: "r", name: "Std", amountCents: 695, freeOverCents: 7500, minDays: 3, maxDays: 5 };
  it("applies free-shipping thresholds", () => {
    expect(shippingFor(rate, 7499)).toBe(695);
    expect(shippingFor(rate, 7500)).toBe(0);
    expect(shippingFor(null, 100)).toBe(0);
  });
  it("taxes after discounts, optionally including shipping", () => {
    expect(orderTotals({ subtotalCents: 10000, discountCents: 1000 }, 500, { rateBps: 800, taxShipping: false })).toEqual({ subtotalCents: 10000, discountCents: 1000, shippingCents: 500, taxCents: 720, totalCents: 10220 });
    expect(orderTotals({ subtotalCents: 10000, discountCents: 1000 }, 500, { rateBps: 800, taxShipping: true }).taxCents).toBe(760);
    expect(orderTotals({ subtotalCents: 10000, discountCents: 0 }, 0, { rateBps: 0, taxShipping: false }).taxCents).toBe(0);
  });
});
