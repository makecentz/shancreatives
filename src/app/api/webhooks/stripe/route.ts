import type Stripe from "stripe";
import { isStripeConfigured } from "@/lib/env";
import { handlePaymentFailed, handlePaymentSucceeded, handleRefundUpdate, markWebhookProcessed, recordWebhookEvent } from "@/lib/payments/events";
import { verifyStripeWebhook } from "@/lib/payments/stripe";

/**
 * Stripe webhook. Signature is verified against the raw body before anything
 * else; events are stored once and processed idempotently, so a re-delivered
 * event can never create a second paid order.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) return new Response("Stripe not configured", { status: 503 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { fresh } = await recordWebhookEvent("stripe", event.id, event.type, event);
  if (!fresh) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        const attemptId = s.metadata?.attempt_id;
        // "completed" with payment_status "unpaid" = async method still processing; wait for the async event.
        if (attemptId && s.payment_status === "paid") {
          await handlePaymentSucceeded(attemptId, String(s.payment_intent), s.amount_total ?? 0);
        }
        break;
      }
      case "checkout.session.async_payment_failed": {
        const s = event.data.object;
        if (s.metadata?.attempt_id) await handlePaymentFailed(s.metadata.attempt_id, "failed", "async_payment_failed");
        break;
      }
      case "checkout.session.expired": {
        const s = event.data.object;
        if (s.metadata?.attempt_id) await handlePaymentFailed(s.metadata.attempt_id, "expired", "session_expired");
        break;
      }
      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        const r = event.data.object;
        const status = r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : r.status === "canceled" ? "canceled" : "pending";
        await handleRefundUpdate("stripe", r.id, status, r.metadata?.refund_id);
        break;
      }
      default:
        break;
    }
    await markWebhookProcessed("stripe", event.id);
    return Response.json({ received: true });
  } catch (e) {
    await markWebhookProcessed("stripe", event.id, (e as Error).message);
    // 500 so Stripe retries; processing is idempotent.
    return new Response("Processing error", { status: 500 });
  }
}
