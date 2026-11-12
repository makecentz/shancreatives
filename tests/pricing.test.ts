import { describe, expect, it } from "vitest";
import { percentOf } from "@/lib/money";
import { PricingError, priceLine, startingPrice, variantUnitPrice } from "@/lib/pricing";
import { product, variant } from "./fixtures";

describe("money", () => {
  it("computes basis-point percentages in integer cents", () => {
    expect(percentOf(1999, 1000)).toBe(200);
    expect(percentOf(333, 825)).toBe(27);
    expect(Number.isInteger(percentOf(12345, 725))).toBe(true);
  });
});

describe("variant pricing", () => {
  it("falls back to base price and prefers sale prices", () => {
    const p = product({ salePriceCents: 2000 });
    expect(variantUnitPrice(p, variant())).toBe(2000);
    expect(variantUnitPrice(p, variant({ priceCents: 3000 }))).toBe(3000);
    expect(variantUnitPrice(p, variant({ priceCents: 3000, salePriceCents: 2700 }))).toBe(2700);
  });
  it("starting price ignores inactive variants", () => {
    const p = product({ variants: [variant({ id: "a", priceCents: 1000, isActive: false }), variant({ id: "b", priceCents: 1800 })] });
    expect(startingPrice(p)).toBe(1800);
  });
});

describe("priceLine (server-authoritative)", () => {
  const p = product();
  const v = p.variants[0];

  it("prices a ready-made line without customization", () => {
    const r = priceLine(p, v, 2, { customize: false });
    expect(r).toMatchObject({ unitPriceCents: 2500, customizationCents: 0, lineTotalCents: 5000, isCustom: false });
  });

  it("adds field, option and multi-select surcharges, times quantity", () => {
    const r = priceLine(p, v, 3, { customize: true, selections: { text: "MAMA", color: "gold", extras: ["back", "sleeve"] } });
    expect(r.customizationCents).toBe(500 + 300 + 700 + 400);
    expect(r.lineTotalCents).toBe((2500 + 1900) * 3);
    expect(r.snapshot["Ink"]).toBe("Gold");
  });

  it("counts a duplicated multi-select option once", () => {
    const r = priceLine(p, v, 1, { customize: true, selections: { text: "A", extras: ["back", "back"] } });
    expect(r.customizationCents).toBe(500 + 700);
  });

  it("adds rush only for custom items that allow it", () => {
    expect(priceLine(p, v, 1, { customize: true, selections: { text: "A" }, rush: true }).rushCents).toBe(1000);
    expect(() => priceLine(p, v, 1, { customize: false, rush: true })).toThrow(PricingError);
  });

  it("rejects tampered input", () => {
    expect(() => priceLine(p, v, 1, { customize: true, selections: { text: "A", color: "platinum" } })).toThrow(/not an option/);
    expect(() => priceLine(p, v, 1, { customize: true, selections: { text: "A", price: "0" } })).toThrow(/Unknown option/);
    expect(() => priceLine(p, v, 1, { customize: true, selections: {} })).toThrow(/required/);
    expect(() => priceLine(p, v, 1, { customize: true, selections: { text: "way too long text" } })).toThrow(/characters/);
    expect(() => priceLine(p, v, 0, { customize: false })).toThrow(/Quantity/);
    expect(() => priceLine(p, v, 1.5, { customize: false })).toThrow(/Quantity/);
    expect(() => priceLine(p, v, 51, { customize: false })).toThrow(/Quantity/);
  });

  it("refuses draft/archived products and inactive variants", () => {
    expect(() => priceLine(product({ status: "draft" }), v, 1, { customize: false })).toThrow(/not available/);
    expect(() => priceLine(p, variant({ isActive: false }), 1, { customize: false })).toThrow(/no longer available/);
    expect(() => priceLine(p, null, 1, { customize: false })).toThrow(/choose an option/);
  });

  it("refuses customization on ready-made-only products", () => {
    expect(() => priceLine(product({ fulfillmentType: "ready_made" }), v, 1, { customize: true })).toThrow(/cannot be customized/);
  });
});
