import "server-only";
import { SquareClient, SquareEnvironment, WebhooksHelper } from "square";
import { siteUrl } from "../env";
import type { HostedCheckoutInput } from "./stripe";
import { idempotencyKey } from "./state-machine";

let client: SquareClient | null = null;
export function square(): SquareClient {
  if (!process.env.SQUARE_ACCESS_TOKEN) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  client ??= new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return client;
}

/** Square-hosted payment link (fallback processor). */
export async function createSquareCheckout(input: HostedCheckoutInput) {
  const res = await square().checkout.paymentLinks.create({
    idempotencyKey: idempotencyKey(input.attemptId, "create_session"),
    quickPay: {
      name: `Shagannan Shenanigans order ${input.orderNumber}`,
      priceMoney: { amount: BigInt(input.amountCents), currency: "USD" },
      locationId: process.env.SQUARE_LOCATION_ID!,
    },
    checkoutOptions: { redirectUrl: `${siteUrl()}/checkout/success?order=${input.orderId}&t=${input.accessToken}&provider=square` },
    prePopulatedData: { buyerEmail: input.email },
    paymentNote: `order:${input.orderId} attempt:${input.attemptId}`,
  });
  const link = res.paymentLink;
  if (!link?.url || !link.orderId) throw new Error("Square did not return a payment link");
  return { linkId: link.id!, url: link.url, squareOrderId: link.orderId };
}

export async function verifySquareWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  return WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader: signature,
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    notificationUrl: `${siteUrl()}/api/webhooks/square`,
  });
}

export async function refundSquare(paymentId: string, amountCents: number, refundId: string) {
  const res = await square().refunds.refundPayment({
    idempotencyKey: idempotencyKey(refundId, "refund"),
    paymentId,
    amountMoney: { amount: BigInt(amountCents), currency: "USD" },
    reason: "Refund issued by Shagannan Shenanigans",
  });
  return res.refund;
}
