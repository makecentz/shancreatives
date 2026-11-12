import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cartSchema, orderTotals, shippingFor, validateCart, type CartValidation } from "./cart-validation";
import { getProductsByIds } from "./data/catalog";
import { getDiscountByCode, getPickupLocations, getShippingRates, getTaxSettings } from "./data/settings";
import { isSquareConfigured, isStripeConfigured } from "./env";
import { canStartAttempt, type AttemptSummary } from "./payments/state-machine";
import { createSquareCheckout } from "./payments/square";
import { createStripeCheckout, stripe } from "./payments/stripe";
import { supabaseAdmin } from "./supabase/server";
import type { PaymentProvider } from "./types";

export const addressSchema = z.object({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  postal_code: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/),
  country: z.string().trim().length(2).default("US"),
});

export const checkoutSchema = cartSchema.extend({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  delivery: z.discriminatedUnion("method", [
    z.object({ method: z.literal("shipping"), rateId: z.string().min(1), address: addressSchema }),
    z.object({ method: z.literal("pickup"), locationId: z.string().min(1), window: z.string().max(80).optional() }),
  ]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function newAccessToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: sha256(token) };
}
export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}
export function tokenMatches(token: string | null | undefined, hash: string | null | undefined) {
  if (!token || !hash) return false;
  const a = Buffer.from(sha256(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class CheckoutError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export async function priceCheckout(input: CheckoutInput) {
  const products = await getProductsByIds([...new Set(input.lines.map((l) => l.productId))]);
  const discount = await getDiscountByCode(input.discountCode);
  const v: CartValidation = validateCart(input, products, discount);
  if (v.errors.length) throw new CheckoutError("Some items in your cart need attention.", 409, v.errors);
  let shippingCents = 0;
  if (input.delivery.method === "shipping") {
    const rateId = input.delivery.rateId;
    const rate = (await getShippingRates()).find((r) => r.id === rateId);
    if (!rate) throw new CheckoutError("Please choose a shipping option.");
    shippingCents = shippingFor(rate, v.subtotalCents - v.discountCents);
  } else {
    const locationId = input.delivery.locationId;
    if (!(await getPickupLocations()).some((l) => l.id === locationId)) throw new CheckoutError("Please choose a pickup location.");
  }
  const tax = await getTaxSettings();
  return { validation: v, totals: orderTotals(v, shippingCents, tax) };
}

/**
 * Creates the internal pending order (immutable item snapshots), reserves
 * stock atomically, and links the customer's private uploads to the order.
 */
export async function createPendingOrder(input: CheckoutInput, userId: string | null, uploadOwner: { userId: string | null; guestHash: string | null }) {
  const { validation, totals } = await priceCheckout(input);
  const db = supabaseAdmin();
  const access = newAccessToken();

  const allUploads = validation.lines.flatMap((l) => l.uploadIds);
  if (allUploads.length) {
    const q = db.from("custom_uploads").select("id").in("id", allUploads).is("order_id", null);
    const { data } = uploadOwner.userId ? await q.eq("owner_user_id", uploadOwner.userId) : await q.eq("guest_token_hash", uploadOwner.guestHash ?? "-");
    if ((data ?? []).length !== new Set(allUploads).size) throw new CheckoutError("One of your uploaded images couldn't be found. Please upload it again.");
  }

  const { data: order, error } = await db
    .from("orders")
    .insert({
      user_id: userId,
      guest_access_token_hash: access.hash,
      customer_name: input.name,
      customer_email: input.email,
      customer_phone: input.phone || null,
      delivery_method: input.delivery.method,
      shipping_address: input.delivery.method === "shipping" ? input.delivery.address : null,
      pickup_location_id: input.delivery.method === "pickup" ? input.delivery.locationId : null,
      subtotal_cents: totals.subtotalCents,
      discount_cents: totals.discountCents,
      discount_code: validation.discountCode,
      shipping_cents: totals.shippingCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents,
      payment_status: "pending",
      fulfillment_status: "awaiting_payment",
      is_custom_order: validation.lines.some((l) => l.isCustom),
      rush: validation.lines.some((l) => l.rushCents > 0),
      customer_notes: input.notes || null,
    })
    .select("id, order_number")
    .single();
  if (error || !order) throw new CheckoutError("We couldn't create your order. Please try again.", 500);

  const { data: items, error: itemErr } = await db
    .from("order_items")
    .insert(
      validation.lines.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        variant_id: l.variantId,
        product_name: l.product.name,
        product_slug: l.product.slug,
        image_path: l.product.media[0]?.url ?? null,
        sku: l.sku,
        size: l.size,
        color: l.color,
        category_ids: l.product.categoryIds,
        quantity: l.quantity,
        unit_price_cents: l.unitPriceCents,
        customization_cents: l.customizationCents,
        rush_cents: l.rushCents,
        line_total_cents: l.lineTotalCents,
        is_custom: l.isCustom,
        customization: l.snapshot,
      })),
    )
    .select("id");
  if (itemErr || !items) throw new CheckoutError("We couldn't save your order items.", 500);

  for (const [i, l] of validation.lines.entries()) {
    if (l.uploadIds.length) await db.from("custom_uploads").update({ order_id: order.id, order_item_id: items[i].id }).in("id", l.uploadIds);
  }
  if (input.delivery.method === "pickup") {
    await db.from("pickup_details").insert({ order_id: order.id, pickup_location_id: input.delivery.locationId, scheduled_window: input.delivery.window ?? null });
  }

  // Reserve finished stock for ready-made lines (and capacity for limited made-to-order lines).
  const reservations = validation.lines.filter((l) => l.variantId).map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));
  if (reservations.length) {
    const { error: resErr } = await db.rpc("reserve_inventory", { p_order_id: order.id, p_items: reservations });
    if (resErr) {
      await db.from("orders").update({ payment_status: "failed", fulfillment_status: "cancelled" }).eq("id", order.id);
      throw new CheckoutError(resErr.message.includes("insufficient_stock") ? "Something in your cart just sold out. Please review your cart." : "We couldn't reserve your items.", 409);
    }
  }
  return { orderId: order.id as string, orderNumber: order.order_number as string, accessToken: access.token, totals, validation };
}

export function providerAvailability() {
  return { stripe: isStripeConfigured(), square: isSquareConfigured() };
}

async function loadAttempts(orderId: string): Promise<(AttemptSummary & { provider_session_id: string | null })[]> {
  const { data } = await supabaseAdmin().from("payment_attempts").select("id, provider, status, provider_session_id").eq("order_id", orderId);
  return (data ?? []).map((a) => ({ id: a.id, provider: a.provider, status: a.status, provider_session_id: a.provider_session_id }));
}

/**
 * Before deciding on a fallback, reconcile any in-flight Stripe attempt with
 * Stripe itself: a completed session means the order is paid; an open session
 * is expired explicitly (so it can no longer be paid) before Square is offered.
 */
async function reconcileStripeAttempts(orderId: string) {
  const db = supabaseAdmin();
  for (const a of await loadAttempts(orderId)) {
    if (a.provider !== "stripe" || !["created", "pending", "unknown"].includes(a.status) || !a.provider_session_id) continue;
    const s = await stripe().checkout.sessions.retrieve(a.provider_session_id);
    if (s.status === "complete" && s.payment_status === "paid") {
      await db.rpc("record_payment_success", { p_attempt_id: a.id, p_provider_payment_id: String(s.payment_intent), p_amount_cents: s.amount_total });
    } else if (s.status === "expired") {
      await db.rpc("record_payment_failure", { p_attempt_id: a.id, p_status: "expired", p_reason: "session_expired" });
    } else if (s.status === "open") {
      const expired = await stripe().checkout.sessions.expire(s.id);
      if (expired.status === "expired") await db.rpc("record_payment_failure", { p_attempt_id: a.id, p_status: "canceled", p_reason: "customer_switched_to_fallback" });
    }
    // status "complete" with payment_status "unpaid" (async methods) stays pending: Square is not offered.
  }
}

export async function startPaymentAttempt(orderId: string, provider: PaymentProvider, accessToken: string) {
  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("id, order_number, total_cents, customer_email, payment_status").eq("id", orderId).single();
  if (!order) throw new CheckoutError("Order not found", 404);
  if (provider === "square") await reconcileStripeAttempts(orderId);
  const decision = canStartAttempt(await loadAttempts(orderId), provider, providerAvailability());
  if (!decision.allowed) {
    const msg = {
      already_paid: "This order has already been paid.",
      attempt_in_flight: "A payment for this order is still being processed. Please wait a moment before trying again.",
      no_verified_failure: "Card checkout is available. The backup checkout is only offered if card checkout fails.",
      provider_unavailable: "That payment method isn't available right now.",
    }[decision.reason];
    throw new CheckoutError(msg, 409, { reason: decision.reason });
  }
  // Retry after a failed/expired attempt: re-reserve stock (no-op if still reserved).
  const { data: items } = await db.from("order_items").select("variant_id, quantity").eq("order_id", orderId).not("variant_id", "is", null);
  if (items?.length) {
    const { error: resErr } = await db.rpc("reserve_inventory", { p_order_id: orderId, p_items: items });
    if (resErr) throw new CheckoutError("Something in this order has sold out since you started checkout.", 409);
  }
  await db.from("orders").update({ payment_status: "pending" }).eq("id", orderId).in("payment_status", ["failed", "unpaid"]);

  const { data: attempt, error } = await db
    .from("payment_attempts")
    .insert({ order_id: orderId, provider, amount_cents: order.total_cents, idempotency_key: `${provider}_${orderId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` })
    .select("id")
    .single();
  if (error || !attempt) throw new CheckoutError("A payment is already in progress for this order.", 409);

  const input = { attemptId: attempt.id, orderId, orderNumber: order.order_number, amountCents: Number(order.total_cents), email: order.customer_email, description: `Order ${order.order_number}`, accessToken };
  try {
    if (provider === "stripe") {
      const s = await createStripeCheckout(input);
      await db.from("payment_attempts").update({ status: "pending", provider_session_id: s.sessionId, checkout_url: s.url, expires_at: s.expiresAt }).eq("id", attempt.id);
      return { url: s.url, attemptId: attempt.id };
    }
    const s = await createSquareCheckout(input);
    await db.from("payment_attempts").update({ status: "pending", provider_session_id: s.linkId, provider_order_id: s.squareOrderId, checkout_url: s.url }).eq("id", attempt.id);
    return { url: s.url, attemptId: attempt.id };
  } catch (e) {
    // The hosted session was never handed to the customer, so no charge can
    // exist for this attempt: it is safe to mark it failed.
    await db.rpc("record_payment_failure", { p_attempt_id: attempt.id, p_status: "failed", p_reason: `session_create_failed: ${(e as Error).message}`.slice(0, 300) });
    throw new CheckoutError(provider === "stripe" ? "Card checkout is temporarily unavailable." : "The backup checkout is temporarily unavailable.", 503, { providerFailed: provider });
  }
}
