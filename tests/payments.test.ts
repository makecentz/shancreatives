import { describe, expect, it } from "vitest";
import { canStartAttempt, canTransition, idempotencyKey, InvalidTransitionError, orderPaymentStatus, transition, type AttemptSummary } from "@/lib/payments/state-machine";

const both = { stripe: true, square: true };
const a = (provider: "stripe" | "square", status: AttemptSummary["status"], id = Math.random().toString()): AttemptSummary => ({ id, provider, status });

describe("payment attempt state machine", () => {
  it("allows the documented happy path", () => {
    expect(transition("created", "pending").changed).toBe(true);
    expect(transition("pending", "succeeded").changed).toBe(true);
    expect(transition("succeeded", "partially_refunded").changed).toBe(true);
    expect(transition("partially_refunded", "refunded").changed).toBe(true);
  });
  it("treats a repeated webhook as a no-op", () => {
    expect(transition("succeeded", "succeeded")).toEqual({ status: "succeeded", changed: false });
  });
  it("never moves a terminal failure to success, or success back to pending", () => {
    expect(() => transition("failed", "succeeded")).toThrow(InvalidTransitionError);
    expect(() => transition("expired", "succeeded")).toThrow(InvalidTransitionError);
    expect(() => transition("succeeded", "pending")).toThrow(InvalidTransitionError);
    expect(() => transition("succeeded", "failed")).toThrow(InvalidTransitionError);
    expect(canTransition("created", "succeeded")).toBe(false);
  });
  it("routes a late success on a closed attempt to reconciliation", () => {
    expect(canTransition("expired", "unknown")).toBe(true);
    expect(canTransition("failed", "unknown")).toBe(true);
  });
  it("lets unknown attempts resolve only to final states", () => {
    expect(canTransition("unknown", "succeeded")).toBe(true);
    expect(canTransition("unknown", "pending")).toBe(false);
  });
});

describe("canStartAttempt", () => {
  it("allows a first Stripe attempt", () => {
    expect(canStartAttempt([], "stripe", both)).toEqual({ allowed: true });
  });
  it("blocks any new attempt once paid (no second paid order)", () => {
    expect(canStartAttempt([a("stripe", "succeeded")], "square", both)).toMatchObject({ allowed: false, reason: "already_paid" });
    expect(canStartAttempt([a("stripe", "succeeded")], "stripe", both)).toMatchObject({ allowed: false, reason: "already_paid" });
  });
  it("blocks Square while a Stripe attempt is pending or unknown", () => {
    expect(canStartAttempt([a("stripe", "pending")], "square", both)).toMatchObject({ allowed: false, reason: "attempt_in_flight" });
    expect(canStartAttempt([a("stripe", "unknown")], "square", both)).toMatchObject({ allowed: false, reason: "attempt_in_flight" });
    expect(canStartAttempt([a("stripe", "failed"), a("stripe", "unknown")], "square", both)).toMatchObject({ allowed: false });
  });
  it("requires a verified Stripe failure before Square fallback", () => {
    expect(canStartAttempt([], "square", both)).toMatchObject({ allowed: false, reason: "no_verified_failure" });
    expect(canStartAttempt([a("stripe", "failed")], "square", both)).toEqual({ allowed: true });
    expect(canStartAttempt([a("stripe", "expired")], "square", both)).toEqual({ allowed: true });
  });
  it("allows Square directly when Stripe is unavailable", () => {
    expect(canStartAttempt([], "square", { stripe: false, square: true })).toEqual({ allowed: true });
  });
  it("refuses an unconfigured provider", () => {
    expect(canStartAttempt([], "square", { stripe: true, square: false })).toMatchObject({ allowed: false, reason: "provider_unavailable" });
  });
});

describe("orderPaymentStatus", () => {
  it("derives order status from attempts", () => {
    expect(orderPaymentStatus([])).toBe("unpaid");
    expect(orderPaymentStatus([a("stripe", "failed")])).toBe("failed");
    expect(orderPaymentStatus([a("stripe", "unknown")])).toBe("requires_reconciliation");
    expect(orderPaymentStatus([a("stripe", "failed"), a("square", "succeeded")])).toBe("paid");
    expect(orderPaymentStatus([a("stripe", "refunded")])).toBe("refunded");
  });
  it("uses stable idempotency keys per attempt", () => {
    expect(idempotencyKey("abc", "create_session")).toBe(idempotencyKey("abc", "create_session"));
    expect(idempotencyKey("abc", "refund", "1")).not.toBe(idempotencyKey("abc", "refund", "2"));
  });
});
