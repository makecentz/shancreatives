import { z } from "zod";
import { CheckoutError, providerAvailability, startPaymentAttempt, tokenMatches } from "@/lib/checkout";
import { isDemoMode } from "@/lib/env";
import { limitOrResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Customer accepts a quote → order moves to awaiting_payment → hosted checkout. */
export async function POST(req: Request) {
  const limited = limitOrResponse(req, "quote-accept", 6);
  if (limited) return limited;
  if (isDemoMode()) return Response.json({ error: "Disabled in preview mode." }, { status: 503 });
  const parsed = z.object({ orderId: z.string().uuid(), token: z.string().min(10) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: o } = await db.from("orders").select("id, fulfillment_status, quote_cents, guest_access_token_hash").eq("id", parsed.data.orderId).maybeSingle();
  if (!o || !tokenMatches(parsed.data.token, o.guest_access_token_hash)) return Response.json({ error: "Quote not found" }, { status: 404 });
  if (!o.quote_cents) return Response.json({ error: "This quote isn't ready yet." }, { status: 409 });
  if (o.fulfillment_status === "quote_pending") {
    await db.from("orders").update({ fulfillment_status: "awaiting_payment", quote_accepted_at: new Date().toISOString(), payment_status: "pending" }).eq("id", o.id).eq("fulfillment_status", "quote_pending");
  }
  const avail = providerAvailability();
  try {
    const { url } = await startPaymentAttempt(o.id, avail.stripe ? "stripe" : "square", parsed.data.token);
    return Response.json({ url });
  } catch (e) {
    if (e instanceof CheckoutError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Couldn't start payment." }, { status: 500 });
  }
}
