import "server-only";
import { adminEmails, sendEmail } from "../email/send";
import { siteUrl } from "../env";
import { supabaseAdmin } from "../supabase/server";

/**
 * Durable webhook intake: stores every verified event once (unique on
 * provider + event id). Returns false if this event was already processed,
 * so replays are acknowledged without side effects.
 */
export async function recordWebhookEvent(provider: "stripe" | "square", eventId: string, type: string, payload: unknown) {
  const db = supabaseAdmin();
  const { error } = await db.from("webhook_events").insert({ provider, event_id: eventId, event_type: type, payload, signature_verified: true });
  if (error) {
    if (error.code === "23505") {
      const { data } = await db.from("webhook_events").select("processed_at").eq("provider", provider).eq("event_id", eventId).single();
      return { fresh: !data?.processed_at };
    }
    throw error;
  }
  return { fresh: true };
}

export async function markWebhookProcessed(provider: "stripe" | "square", eventId: string, err?: string) {
  await supabaseAdmin()
    .from("webhook_events")
    .update(err ? { processing_error: err } : { processed_at: new Date().toISOString(), processing_error: null })
    .eq("provider", provider)
    .eq("event_id", eventId);
}

/** Called after a verified success. record_payment_success is idempotent in SQL. */
export async function handlePaymentSucceeded(attemptId: string, providerPaymentId: string, amountCents: number, card?: { brand?: string | null; last4?: string | null; receiptUrl?: string | null }) {
  const db = supabaseAdmin();
  const { data: firstTime, error } = await db.rpc("record_payment_success", {
    p_attempt_id: attemptId,
    p_provider_payment_id: providerPaymentId,
    p_amount_cents: amountCents,
    p_card_brand: card?.brand ?? null,
    p_card_last4: card?.last4 ?? null,
    p_receipt_url: card?.receiptUrl ?? null,
  });
  if (error) throw error;
  if (!firstTime) return;
  const { data: attempt } = await db.from("payment_attempts").select("order_id").eq("id", attemptId).single();
  const { data: o } = await db.from("orders").select("id, order_number, customer_name, customer_email, total_cents").eq("id", attempt!.order_id).single();
  if (!o) return;
  const link = `${siteUrl()}/account/orders/${o.id}`;
  // Emails are best-effort and logged; failures never touch payment state.
  await sendEmail("order_confirmation", o.customer_email, { orderNumber: o.order_number, customerName: o.customer_name, totalCents: Number(o.total_cents), link }, { orderId: o.id, dedupeKey: `order_confirmation:${o.id}` });
  for (const to of adminEmails())
    await sendEmail("admin_new_order", to, { orderNumber: o.order_number, customerName: o.customer_name, totalCents: Number(o.total_cents), link: `${siteUrl()}/admin/orders/${o.id}` }, { orderId: o.id, dedupeKey: `admin_new_order:${o.id}:${to}` });
}

export async function handlePaymentFailed(attemptId: string, status: "failed" | "canceled" | "expired", reason: string) {
  const { error } = await supabaseAdmin().rpc("record_payment_failure", { p_attempt_id: attemptId, p_status: status, p_reason: reason });
  if (error) throw error;
}

export async function handleRefundUpdate(provider: "stripe" | "square", providerRefundId: string, status: "succeeded" | "failed" | "canceled" | "pending", refundIdHint?: string) {
  const db = supabaseAdmin();
  let q = db.from("refunds").select("id").eq("provider", provider);
  q = refundIdHint ? q.eq("id", refundIdHint) : q.eq("provider_refund_id", providerRefundId);
  const { data: refund } = await q.maybeSingle();
  if (!refund) return; // refunds initiated outside the dashboard are surfaced via reconciliation
  await db.rpc("record_refund_result", { p_refund_id: refund.id, p_status: status, p_provider_refund_id: providerRefundId });
}
