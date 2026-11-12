import type { PaymentProvider } from "../types";

/**
 * Durable payment-attempt state machine.
 *
 *   created ──► pending ──► succeeded
 *      │           ├──────► failed      (definitive decline / error)
 *      │           ├──────► canceled    (customer abandoned hosted checkout)
 *      │           ├──────► expired     (hosted session expired)
 *      │           └──────► unknown     (no definitive answer; needs reconciliation)
 *      └──────────► failed  (could not create the hosted session)
 *   unknown ──► succeeded | failed | canceled | expired   (via reconciliation only)
 *   succeeded ──► refunded | partially_refunded
 *   failed | canceled | expired ──► unknown   (processor later reports money taken:
 *                                             flagged for owner review, never auto-fulfilled)
 *
 * Terminal "safe to retry" states: failed, canceled, expired.
 */
export type AttemptStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "canceled"
  | "expired"
  | "unknown"
  | "refunded"
  | "partially_refunded";

const TRANSITIONS: Record<AttemptStatus, AttemptStatus[]> = {
  created: ["pending", "failed"],
  pending: ["succeeded", "failed", "canceled", "expired", "unknown"],
  unknown: ["succeeded", "failed", "canceled", "expired"],
  succeeded: ["refunded", "partially_refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  failed: ["unknown"],
  canceled: ["unknown"],
  expired: ["unknown"],
  refunded: [],
};

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: AttemptStatus, to: AttemptStatus) {
    super(`Illegal payment attempt transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Applies a provider event to an attempt. Re-delivery of the same terminal
 * status is a no-op (idempotent); anything else illegal throws.
 */
export function transition(from: AttemptStatus, to: AttemptStatus): { status: AttemptStatus; changed: boolean } {
  if (from === to) return { status: from, changed: false };
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return { status: to, changed: true };
}

export interface AttemptSummary {
  id: string;
  provider: PaymentProvider;
  status: AttemptStatus;
}

const IN_FLIGHT: AttemptStatus[] = ["created", "pending", "unknown"];
const PAID: AttemptStatus[] = ["succeeded", "partially_refunded", "refunded"];
const SAFE_FAILED: AttemptStatus[] = ["failed", "canceled", "expired"];

export type CheckoutDecision =
  | { allowed: true }
  | { allowed: false; reason: "already_paid" | "attempt_in_flight" | "no_verified_failure" | "provider_unavailable" };

/**
 * Decides whether a NEW attempt may be started with `provider` for an order.
 * Enforces: never two paid attempts; never charge via Square while a Stripe
 * attempt is pending/unknown; Square only after a verified Stripe failure or
 * when Stripe is unavailable. The customer must explicitly choose the
 * fallback — this function is only called from a customer-initiated request.
 */
export function canStartAttempt(
  attempts: AttemptSummary[],
  provider: PaymentProvider,
  availability: { stripe: boolean; square: boolean },
): CheckoutDecision {
  if (!availability[provider]) return { allowed: false, reason: "provider_unavailable" };
  if (attempts.some((a) => PAID.includes(a.status))) return { allowed: false, reason: "already_paid" };
  if (attempts.some((a) => IN_FLIGHT.includes(a.status))) return { allowed: false, reason: "attempt_in_flight" };
  if (provider === "square" && availability.stripe) {
    const stripeFailed = attempts.some((a) => a.provider === "stripe" && SAFE_FAILED.includes(a.status));
    if (!stripeFailed) return { allowed: false, reason: "no_verified_failure" };
  }
  return { allowed: true };
}

/** Order-level payment status derived from its attempts. */
export function orderPaymentStatus(attempts: AttemptSummary[]) {
  if (attempts.some((a) => a.status === "refunded")) return "refunded" as const;
  if (attempts.some((a) => a.status === "partially_refunded")) return "partially_refunded" as const;
  if (attempts.some((a) => a.status === "succeeded")) return "paid" as const;
  if (attempts.some((a) => a.status === "unknown")) return "requires_reconciliation" as const;
  if (attempts.some((a) => a.status === "pending" || a.status === "created")) return "pending" as const;
  if (attempts.length && attempts.every((a) => SAFE_FAILED.includes(a.status))) return "failed" as const;
  return "unpaid" as const;
}

/** Idempotency key for a provider call: one per attempt, stable across retries. */
export function idempotencyKey(attemptId: string, operation: "create_session" | "refund", suffix = "") {
  return `ss_${operation}_${attemptId}${suffix ? `_${suffix}` : ""}`;
}
