import { z } from "zod";
import { getCustomerUser } from "@/lib/auth/session";
import { newAccessToken } from "@/lib/checkout";
import { getProductsByIds } from "@/lib/data/catalog";
import { adminEmails, sendEmail } from "@/lib/email/send";
import { isDemoMode, siteUrl } from "@/lib/env";
import { PricingError, priceLine } from "@/lib/pricing";
import { limitOrResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

const schema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable(),
  quantity: z.number().int().min(1).max(50),
  selections: z.record(z.string(), z.union([z.string().max(1000), z.array(z.string().max(64))])),
  rush: z.boolean().default(false),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).nullish(),
});

/** Custom quote request: creates an unpaid order in "request_received"; staff issue a quote later. */
export async function POST(req: Request) {
  const limited = limitOrResponse(req, "custom-requests", 5);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please fill in your name, email, and the required options." }, { status: 400 });
  if (isDemoMode()) return Response.json({ error: "Custom requests are disabled in preview mode. Connect Supabase to start receiving requests." }, { status: 503 });

  const [product] = await getProductsByIds([parsed.data.productId]);
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
  const variant = parsed.data.variantId ? product.variants.find((v) => v.id === parsed.data.variantId) ?? null : product.variants[0] ?? null;
  let snapshot: Record<string, string | string[]>;
  try {
    snapshot = priceLine(product, variant, parsed.data.quantity, { customize: true, selections: parsed.data.selections, rush: parsed.data.rush }).snapshot;
  } catch (e) {
    return Response.json({ error: e instanceof PricingError ? e.message : "Invalid options" }, { status: 400 });
  }
  const user = await getCustomerUser();
  const db = supabaseAdmin();
  const { hash } = newAccessToken();
  const { data: order, error } = await db
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      guest_access_token_hash: hash,
      customer_name: parsed.data.name,
      customer_email: parsed.data.email,
      customer_phone: parsed.data.phone || null,
      delivery_method: "shipping",
      subtotal_cents: 0, total_cents: 0,
      payment_status: "unpaid",
      fulfillment_status: "request_received",
      is_custom_order: true,
      is_quote_request: true,
      rush: parsed.data.rush,
    })
    .select("id, order_number")
    .single();
  if (error || !order) return Response.json({ error: "We couldn't save your request." }, { status: 500 });
  await db.from("order_items").insert({
    order_id: order.id, product_id: product.id, variant_id: variant?.id ?? null, product_name: product.name, product_slug: product.slug,
    image_path: product.media[0]?.url ?? null, category_ids: product.categoryIds, quantity: parsed.data.quantity,
    unit_price_cents: 0, line_total_cents: 0, is_custom: true, customization: snapshot,
  });
  await db.from("notifications").insert({ kind: "custom_request", title: `Custom request ${order.order_number}`, order_id: order.id, link: "/admin/custom-orders" });
  for (const to of adminEmails())
    await sendEmail("admin_custom_request", to, { orderNumber: order.order_number, customerName: parsed.data.name, link: `${siteUrl()}/admin/custom-orders` }, { orderId: order.id, dedupeKey: `admin_custom_request:${order.id}:${to}` });
  return Response.json({ ok: true, orderNumber: order.order_number, message: `Request ${order.order_number} received! We'll email your quote soon.` });
}
