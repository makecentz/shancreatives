import type { DeliveryMethod, FulfillmentStatus, PaymentStatus } from "./types";

/**
 * Allowed fulfilment transitions. Production and shipping steps require a
 * verified payment; nothing here can change payment status.
 */
const NEXT: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  request_received: ["quote_pending", "cancelled"],
  quote_pending: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["cancelled"], // moves to paid only through a verified payment event
  paid: ["design_review", "in_production", "ready_for_shipping", "ready_for_pickup", "cancelled"],
  design_review: ["approved", "cancelled"],
  approved: ["in_production", "cancelled"],
  in_production: ["ready_for_shipping", "ready_for_pickup"],
  ready_for_shipping: ["shipped"],
  ready_for_pickup: ["completed"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

const NEEDS_PAYMENT: FulfillmentStatus[] = ["design_review", "approved", "in_production", "ready_for_shipping", "ready_for_pickup", "shipped", "completed"];

export function allowedNextStatuses(current: FulfillmentStatus, payment: PaymentStatus, delivery: DeliveryMethod): FulfillmentStatus[] {
  return NEXT[current].filter((s) => {
    if (NEEDS_PAYMENT.includes(s) && payment !== "paid" && payment !== "partially_refunded") return false;
    if (s === "ready_for_pickup" && delivery !== "pickup") return false;
    if ((s === "ready_for_shipping" || s === "shipped") && delivery !== "shipping") return false;
    // A paid order can only be cancelled after it has been refunded.
    if (s === "cancelled" && (payment === "paid" || payment === "partially_refunded" || payment === "pending" || payment === "requires_reconciliation")) return false;
    return true;
  });
}

export function canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus, payment: PaymentStatus, delivery: DeliveryMethod) {
  return allowedNextStatuses(from, payment, delivery).includes(to);
}

/** Email template to send when an order enters a status (if any). */
const STATUS_EMAIL: Partial<Record<FulfillmentStatus, "custom_approved" | "production_started" | "order_shipped" | "ready_for_pickup">> = {
  approved: "custom_approved",
  in_production: "production_started",
  shipped: "order_shipped",
  ready_for_pickup: "ready_for_pickup",
};

export function emailForStatus(s: FulfillmentStatus) {
  return STATUS_EMAIL[s] ?? null;
}
