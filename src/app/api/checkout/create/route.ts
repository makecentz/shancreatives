import { getCustomerUser } from "@/lib/auth/session";
import { CheckoutError, checkoutSchema, createPendingOrder, providerAvailability, startPaymentAttempt } from "@/lib/checkout";
import { isDemoMode } from "@/lib/env";
import { guestTokenHash } from "@/lib/guest";
import { limitOrResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = limitOrResponse(req, "checkout-create", 10);
  if (limited) return limited;
  if (isDemoMode()) {
    return Response.json({ error: "Checkout is disabled in preview mode. Connect Supabase and Stripe to accept real orders." }, { status: 503 });
  }
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check your details.", issues: parsed.error.issues }, { status: 400 });

  const availability = providerAvailability();
  if (!availability.stripe && !availability.square) return Response.json({ error: "Online payments aren't configured yet." }, { status: 503 });

  try {
    const user = await getCustomerUser();
    const guestHash = user ? null : await guestTokenHash(false);
    const order = await createPendingOrder(parsed.data, user?.id ?? null, { userId: user?.id ?? null, guestHash });
    // Stripe is the default processor. Square is used directly only when Stripe isn't configured at all.
    const provider = availability.stripe ? "stripe" : "square";
    try {
      const { url } = await startPaymentAttempt(order.orderId, provider, order.accessToken);
      return Response.json({ url, orderId: order.orderId, token: order.accessToken });
    } catch (e) {
      if (e instanceof CheckoutError && provider === "stripe") {
        // Stripe verified-failed before the customer was sent anywhere. Offer Square; never auto-charge.
        return Response.json(
          { error: e.message, orderId: order.orderId, token: order.accessToken, fallbackAvailable: availability.square },
          { status: 503 },
        );
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof CheckoutError) return Response.json({ error: e.message, details: e.details }, { status: e.status });
    console.error("checkout/create failed", e);
    return Response.json({ error: "Something went wrong creating your order." }, { status: 500 });
  }
}
