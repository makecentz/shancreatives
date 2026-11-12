import { CheckCircle2, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnPaid } from "@/components/store/clear-cart";
import { Container } from "@/components/store/section";
import { tokenMatches } from "@/lib/checkout";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order status", robots: { index: false, follow: false } };

/**
 * The success page never marks anything paid. It only READS the order; payment
 * status changes exclusively through verified webhooks. If the webhook hasn't
 * landed yet the page says so and offers a refresh.
 */
export default async function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const sp = await searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : null;
  const token = typeof sp.t === "string" ? sp.t : null;
  let order: { order_number: string; payment_status: string; total_cents: number; customer_email: string; delivery_method: string } | null = null;
  if (!isDemoMode() && orderId && token && /^[0-9a-f-]{36}$/.test(orderId)) {
    const { data } = await supabaseAdmin().from("orders").select("order_number, payment_status, total_cents, customer_email, delivery_method, guest_access_token_hash").eq("id", orderId).maybeSingle();
    if (data && tokenMatches(token, data.guest_access_token_hash)) order = data;
  }
  const paid = order?.payment_status === "paid";
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg rounded-3xl bg-store-cream p-10 text-center">
        {order ? (
          <>
            {paid ? <CheckCircle2 className="mx-auto size-12 text-store-success" /> : <Clock className="mx-auto size-12 text-store-tan-deep" />}
            <h1 className="mt-5 font-heading text-3xl font-bold">{paid ? "Thank you for your order!" : "We're confirming your payment"}</h1>
            <p className="mt-3 text-store-muted">
              {paid
                ? `Order ${order.order_number} is confirmed. A confirmation is on its way to ${order.customer_email}.`
                : `Order ${order.order_number} is waiting for confirmation from the payment processor. This usually takes a few seconds.`}
            </p>
            {paid ? <p className="mt-2 font-semibold">{formatMoney(Number(order.total_cents))}</p> : null}
            {paid ? <ClearCartOnPaid /> : null}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {!paid ? <Link href={`/checkout/success?order=${orderId}&t=${token}`} className="inline-flex h-11 items-center justify-center rounded-full bg-store-ink px-6 text-sm text-white">Refresh status</Link> : null}
              <Link href="/account/orders" className="inline-flex h-11 items-center justify-center rounded-full border border-store-ink px-6 text-sm">View my orders</Link>
              <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm text-store-muted">Keep shopping</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-bold">Order not found</h1>
            <p className="mt-3 text-store-muted">We couldn&rsquo;t find that order. If you just paid, check your email for a confirmation.</p>
            <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-store-ink px-6 text-sm text-white">Back home</Link>
          </>
        )}
      </div>
    </Container>
  );
}
