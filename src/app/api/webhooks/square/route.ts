import { isSquareConfigured } from "@/lib/env";
import { handlePaymentFailed, handlePaymentSucceeded, handleRefundUpdate, markWebhookProcessed, recordWebhookEvent } from "@/lib/payments/events";
import { verifySquareWebhook } from "@/lib/payments/square";
import { supabaseAdmin } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Square webhook (fallback processor). HMAC-SHA256 signature verified first. */
export async function POST(req: Request) {
  if (!isSquareConfigured()) return new Response("Square not configured", { status: 503 });
  const raw = await req.text();
  const ok = await verifySquareWebhook(raw, req.headers.get("x-square-hmacsha256-signature"));
  if (!ok) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(raw) as any;
  const { fresh } = await recordWebhookEvent("square", event.event_id, event.type, event);
  if (!fresh) return Response.json({ received: true, duplicate: true });

  try {
    if (event.type === "payment.created" || event.type === "payment.updated") {
      const p = event.data?.object?.payment;
      if (p?.order_id) {
        const { data: attempt } = await supabaseAdmin().from("payment_attempts").select("id").eq("provider", "square").eq("provider_order_id", p.order_id).maybeSingle();
        if (attempt) {
          if (p.status === "COMPLETED") {
            await handlePaymentSucceeded(attempt.id, p.id, Number(p.amount_money?.amount ?? 0), { brand: p.card_details?.card?.card_brand, last4: p.card_details?.card?.last_4, receiptUrl: p.receipt_url });
          } else if (p.status === "FAILED") {
            await handlePaymentFailed(attempt.id, "failed", "square_payment_failed");
          } else if (p.status === "CANCELED") {
            await handlePaymentFailed(attempt.id, "canceled", "square_payment_canceled");
          }
        }
      }
    } else if (event.type === "refund.created" || event.type === "refund.updated") {
      const r = event.data?.object?.refund;
      if (r?.id) {
        const status = r.status === "COMPLETED" ? "succeeded" : r.status === "FAILED" || r.status === "REJECTED" ? "failed" : "pending";
        await handleRefundUpdate("square", r.id, status);
      }
    }
    await markWebhookProcessed("square", event.event_id);
    return Response.json({ received: true });
  } catch (e) {
    await markWebhookProcessed("square", event.event_id, (e as Error).message);
    return new Response("Processing error", { status: 500 });
  }
}
