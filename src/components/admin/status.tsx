import { FULFILLMENT_LABELS, PAYMENT_LABELS } from "@/components/store/order-status";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function fulfillmentTone(s: FulfillmentStatus) {
  if (s === "completed" || s === "shipped") return "text-admin-success";
  if (s === "cancelled") return "text-admin-danger";
  if (s === "ready_for_pickup" || s === "ready_for_shipping") return "text-admin-info";
  if (s === "request_received" || s === "quote_pending") return "text-admin-purple";
  return "text-admin-warning";
}

export function paymentTone(s: PaymentStatus) {
  if (s === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "failed" || s === "requires_reconciliation") return "bg-red-50 text-red-600 ring-red-200";
  if (s === "refunded" || s === "partially_refunded") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

/** Fulfilment status as coloured text, matching the reference table. */
export function FulfillmentText({ status, className }: { status: FulfillmentStatus; className?: string }) {
  const label = ["paid", "design_review", "approved", "in_production", "awaiting_payment"].includes(status) && status !== "awaiting_payment"
    ? status === "paid" ? "Processing" : FULFILLMENT_LABELS[status]
    : FULFILLMENT_LABELS[status];
  return <span className={cn("font-medium", fulfillmentTone(status), className)}>{label}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", paymentTone(status))}>{PAYMENT_LABELS[status]}</span>;
}
