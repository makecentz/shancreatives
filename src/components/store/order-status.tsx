import type { FulfillmentStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  request_received: "Request Received",
  quote_pending: "Quote Pending",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  design_review: "Design Review",
  approved: "Approved",
  in_production: "In Production",
  ready_for_shipping: "Ready for Shipping",
  ready_for_pickup: "Ready for Pickup",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  requires_reconciliation: "Under review",
};

export function StoreStatusPill({ status }: { status: FulfillmentStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", status === "cancelled" ? "bg-store-border text-store-muted" : status === "completed" || status === "shipped" ? "bg-store-ink text-white" : "bg-store-tan/30 text-store-ink")}>
      {FULFILLMENT_LABELS[status]}
    </span>
  );
}
