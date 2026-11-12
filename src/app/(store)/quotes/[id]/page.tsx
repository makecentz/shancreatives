import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcceptQuoteButton } from "@/components/store/accept-quote";
import { Container } from "@/components/store/section";
import { tokenMatches } from "@/lib/checkout";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your custom quote", robots: { index: false, follow: false } };

export default async function QuotePage({ params, searchParams }: PageProps<"/quotes/[id]">) {
  if (isDemoMode()) notFound();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const { data: o } = await supabaseAdmin().from("orders").select("id, order_number, quote_cents, quote_message, fulfillment_status, payment_status, guest_access_token_hash, order_items(product_name, quantity, customization)").eq("id", id).maybeSingle();
  if (!o || !tokenMatches(token, o.guest_access_token_hash)) notFound();
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl rounded-3xl border border-store-border p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-store-tan-deep">Custom quote</p>
        <h1 className="mt-2 font-heading text-3xl font-bold">{o.order_number}</h1>
        {o.order_items.map((i: { product_name: string; quantity: number; customization: Record<string, string | string[]> }, k: number) => (
          <div key={k} className="mt-5 rounded-2xl bg-store-cream p-4 text-sm">
            <p className="font-semibold">{i.product_name} × {i.quantity}</p>
            {Object.entries(i.customization).map(([a, b]) => <p key={a} className="text-store-muted">{a}: {Array.isArray(b) ? b.join(", ") : b}</p>)}
          </div>
        ))}
        {o.quote_message ? <p className="mt-5 text-sm">{o.quote_message}</p> : null}
        <p className="mt-6 text-2xl font-bold">{o.quote_cents ? formatMoney(Number(o.quote_cents)) : "Quote pending"}</p>
        {o.fulfillment_status === "quote_pending" && o.quote_cents ? (
          <AcceptQuoteButton orderId={o.id} token={token} />
        ) : (
          <p className="mt-4 text-sm text-store-muted">{o.payment_status === "paid" ? "This quote has been accepted and paid. Thank you!" : "This quote isn't ready for payment yet."}</p>
        )}
      </div>
    </Container>
  );
}
