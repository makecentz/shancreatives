import { z } from "zod";
import { CheckoutError, startPaymentAttempt, tokenMatches } from "@/lib/checkout";
import { isDemoMode } from "@/lib/env";
import { limitOrResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

const body = z.object({ orderId: z.string().uuid(), token: z.string().min(10).max(100), provider: z.enum(["stripe", "square"]) });

/**
 * Customer-initiated retry or switch to the backup processor. Called only when
 * the customer explicitly clicks a button — never automatically. The state
 * machine refuses Square while any Stripe attempt is pending or unknown.
 */
export async function POST(req: Request) {
  const limited = limitOrResponse(req, "checkout-fallback", 6);
  if (limited) return limited;
  if (isDemoMode()) return Response.json({ error: "Checkout is disabled in preview mode." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { data: order } = await supabaseAdmin().from("orders").select("id, guest_access_token_hash").eq("id", parsed.data.orderId).maybeSingle();
  if (!order || !tokenMatches(parsed.data.token, order.guest_access_token_hash)) return Response.json({ error: "Order not found" }, { status: 404 });
  try {
    const { url } = await startPaymentAttempt(order.id, parsed.data.provider, parsed.data.token);
    return Response.json({ url });
  } catch (e) {
    if (e instanceof CheckoutError) return Response.json({ error: e.message, details: e.details }, { status: e.status });
    console.error("checkout/fallback failed", e);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
