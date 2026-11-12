import { describe, expect, it } from "vitest";
import { hasPermission, permissionsFor } from "@/lib/auth/roles";
import { allowedNextStatuses, canTransitionFulfillment } from "@/lib/fulfillment";
import { commit, InsufficientStockError, release, reserve, type StockRow } from "@/lib/inventory";

const rows = () => new Map<string, StockRow>([["v1", { variantId: "v1", stock: 3, reserved: 0 }], ["v2", { variantId: "v2", stock: null, reserved: 0 }]]);

describe("inventory", () => {
  it("reserves, then commits on verified payment", () => {
    let r = reserve(rows(), [{ variantId: "v1", quantity: 2 }]);
    expect(r.get("v1")).toMatchObject({ stock: 3, reserved: 2 });
    r = commit(r, [{ variantId: "v1", quantity: 2 }]);
    expect(r.get("v1")).toMatchObject({ stock: 1, reserved: 0 });
  });
  it("releases on failure or expiry without touching stock", () => {
    const r = release(reserve(rows(), [{ variantId: "v1", quantity: 3 }]), [{ variantId: "v1", quantity: 3 }]);
    expect(r.get("v1")).toMatchObject({ stock: 3, reserved: 0 });
  });
  it("prevents overselling and is all-or-nothing", () => {
    const start = reserve(rows(), [{ variantId: "v1", quantity: 2 }]);
    expect(() => reserve(start, [{ variantId: "v2", quantity: 1 }, { variantId: "v1", quantity: 2 }])).toThrow(InsufficientStockError);
    expect(start.get("v2")!.reserved).toBe(0);
    expect(start.get("v1")!.reserved).toBe(2);
  });
  it("doesn't limit made-to-order variants unless capacity is set", () => {
    expect(reserve(rows(), [{ variantId: "v2", quantity: 40 }]).get("v2")!.reserved).toBe(40);
    const cap = new Map<string, StockRow>([["v3", { variantId: "v3", stock: null, reserved: 0, capacity: 2 }]]);
    expect(() => reserve(cap, [{ variantId: "v3", quantity: 3 }])).toThrow(InsufficientStockError);
  });
  it("never goes negative", () => {
    expect(release(rows(), [{ variantId: "v1", quantity: 5 }]).get("v1")!.reserved).toBe(0);
  });
});

describe("roles", () => {
  it("only owners can refund, manage staff or settings", () => {
    expect(hasPermission("owner", "orders.refund")).toBe(true);
    expect(hasPermission("manager", "orders.refund")).toBe(false);
    expect(hasPermission("manager", "staff.manage")).toBe(false);
    expect(hasPermission("manager", "settings.manage")).toBe(false);
  });
  it("fulfillment staff can't see finances", () => {
    expect(permissionsFor("fulfillment").sort()).toEqual(["fulfillment.update", "orders.view"]);
    for (const p of ["dashboard.view", "analytics.view", "payments.view", "orders.refund", "products.manage"] as const) expect(hasPermission("fulfillment", p)).toBe(false);
  });
  it("denies unknown or missing roles", () => {
    expect(hasPermission(null, "orders.view")).toBe(false);
    expect(hasPermission(undefined, "orders.view")).toBe(false);
  });
});

describe("fulfillment transitions", () => {
  it("can't start production before payment", () => {
    expect(canTransitionFulfillment("paid", "in_production", "pending", "shipping")).toBe(false);
    expect(canTransitionFulfillment("paid", "in_production", "paid", "shipping")).toBe(true);
  });
  it("never marks awaiting_payment as paid by hand", () => {
    expect(allowedNextStatuses("awaiting_payment", "paid", "shipping")).not.toContain("paid");
  });
  it("respects delivery method", () => {
    expect(canTransitionFulfillment("in_production", "ready_for_pickup", "paid", "shipping")).toBe(false);
    expect(canTransitionFulfillment("in_production", "ready_for_pickup", "paid", "pickup")).toBe(true);
    expect(canTransitionFulfillment("ready_for_shipping", "shipped", "paid", "pickup")).toBe(false);
  });
  it("won't cancel a paid order until it is refunded", () => {
    expect(canTransitionFulfillment("paid", "cancelled", "paid", "shipping")).toBe(false);
    expect(canTransitionFulfillment("paid", "cancelled", "refunded", "shipping")).toBe(true);
  });
});
