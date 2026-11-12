import "server-only";
import Stripe from "stripe";
import { siteUrl } from "../env";
import { idempotencyKey } from "./state-machine";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
  return client;
}

export interface HostedCheckoutInput {
  attemptId: string;
  orderId: string;
  orderNumber: string;
  amountCents: number;
  email: string;
  description: string;
  accessToken: string; // guest token so the success page can show the order
}

/**
 * Creates a Stripe-hosted Checkout Session for the server-computed order total.
 * Card data never touches our servers (PCI SAQ-A). The idempotency key is tied
 * to the attempt so a retried request can't create a second session.
 */
export async function createStripeCheckout(input: HostedCheckoutInput) {
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // Stripe minimum is 30 minutes
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.email,
      client_reference_id: input.orderId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: input.amountCents,
            product_data: { name: `Shagannan Shenanigans order ${input.orderNumber}`, description: input.description.slice(0, 500) },
          },
        },
      ],
      metadata: { order_id: input.orderId, attempt_id: input.attemptId },
      payment_intent_data: { metadata: { order_id: input.orderId, attempt_id: input.attemptId } },
      expires_at: expiresAt,
      success_url: `${siteUrl()}/checkout/success?order=${input.orderId}&t=${input.accessToken}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/checkout?cancelled=${input.orderId}&t=${input.accessToken}`,
    },
    { idempotencyKey: idempotencyKey(input.attemptId, "create_session") },
  );
  return { sessionId: session.id, url: session.url!, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

/** Errors where we know no charge could have happened (request never accepted). */
export function isDefinitiveStripeFailure(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeError) {
    return ["StripeInvalidRequestError", "StripeAuthenticationError", "StripePermissionError", "StripeConnectionError", "StripeAPIError", "StripeRateLimitError"].includes(err.type);
  }
  return false;
}

export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new Error("Missing stripe-signature header");
  return stripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
}

export async function refundStripe(paymentIntentId: string, amountCents: number, refundId: string) {
  return stripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents, metadata: { refund_id: refundId } },
    { idempotencyKey: idempotencyKey(refundId, "refund") },
  );
}
