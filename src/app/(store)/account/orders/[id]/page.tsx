import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/store/section";
import { FULFILLMENT_LABELS, PAYMENT_LABELS, StoreStatusPill } from "@/components/store/order-status";
import { getCustomerUser } from "@/lib/auth/session";
import { mapOrder, ORDER_SELECT } from "@/lib/data/mappers";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import type { FulfillmentStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false } };

const CUSTOM_FLOW: FulfillmentStatus[] = ["request_received", "quote_pending", "awaiting_payment", "paid", "design_review", "approved", "in_production", "ready_for_shipping", "shipped", "completed"];
const READY_FLOW: FulfillmentStatus[] = ["awaiting_payment", "paid", "ready_for_shipping", "shipped", "completed"];

export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[id]">) {
  if (isDemoMode()) redirect("/account");
  const user = await getCustomerUser();
  if (!user) redirect("/account");
  const { id } = await params;
  const sb = await supabaseServer();
  // RLS restricts this to the signed-in customer's own order.
  const { data } = await sb.from("orders").select(`${ORDER_SELECT}, shipments(*), pickup_details(*, pickup_locations(*))`).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) notFound();
  const order = mapOrder(data);
  const { data: uploads } = await sb.from("custom_uploads").select("id, storage_path, original_name").eq("order_id", id);
  // Signed, short-lived URLs for the customer's own private reference images.
  const signed = await Promise.all(
    (uploads ?? []).map(async (u) => ({ name: u.original_name, url: (await supabaseAdmin().storage.from("customer-uploads").createSignedUrl(u.storage_path, 600)).data?.signedUrl })),
  );
  let flow = order.isCustomOrder ? CUSTOM_FLOW : READY_FLOW;
  if (order.deliveryMethod === "pickup") flow = flow.map((s) => (s === "ready_for_shipping" ? "ready_for_pickup" : s)).filter((s) => s !== "shipped");
  const currentIdx = flow.indexOf(order.fulfillmentStatus);
  const pickup = (data as { pickup_details?: { scheduled_window?: string; pickup_locations?: { name: string; instructions: string } } }).pickup_details;
  const shipments = ((data as { shipments?: { tracking_number?: string; tracking_url?: string; carrier?: string }[] }).shipments) ?? [];

  return (
    <Container className="py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-store-muted">Placed {formatDate(order.createdAt)} &middot; Payment: {PAYMENT_LABELS[order.paymentStatus]}</p>
        </div>
        <StoreStatusPill status={order.fulfillmentStatus} />
      </div>
      {order.fulfillmentStatus !== "cancelled" ? (
        <ol className="mt-10 grid gap-2 sm:grid-flow-col" aria-label="Order progress">
          {flow.map((s, i) => (
            <li key={s} className={cn("rounded-xl px-3 py-2 text-xs", i <= currentIdx ? "bg-store-ink text-white" : "bg-store-cream text-store-muted")} aria-current={i === currentIdx ? "step" : undefined}>{FULFILLMENT_LABELS[s]}</li>
          ))}
        </ol>
      ) : null}
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-store-border border-y border-store-border">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-5">
              <div className="size-20 shrink-0 rounded-xl bg-store-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-full w-full object-contain p-1.5" /> : null}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{i.productName} &times; {i.quantity}</p>
                <p className="text-store-muted">{[i.color, i.size].filter(Boolean).join(" / ")}</p>
                {Object.entries(i.customization).map(([k, v]) => <p key={k} className="text-xs text-store-muted">{k}: {Array.isArray(v) ? v.join(", ") : v}</p>)}
              </div>
              <p className="text-sm font-semibold">{formatMoney(i.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
        <aside className="space-y-5">
          <div className="rounded-3xl bg-store-cream p-6 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-store-muted">Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>
              {order.discountCents ? <div className="flex justify-between"><dt className="text-store-muted">Discount</dt><dd>−{formatMoney(order.discountCents)}</dd></div> : null}
              <div className="flex justify-between"><dt className="text-store-muted">Shipping</dt><dd>{formatMoney(order.shippingCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-store-muted">Tax</dt><dd>{formatMoney(order.taxCents)}</dd></div>
              <div className="flex justify-between border-t border-store-border pt-2 font-semibold"><dt>Total</dt><dd>{formatMoney(order.totalCents)}</dd></div>
              {order.refundedCents ? <div className="flex justify-between text-store-muted"><dt>Refunded</dt><dd>{formatMoney(order.refundedCents)}</dd></div> : null}
            </dl>
          </div>
          {order.deliveryMethod === "pickup" && pickup ? (
            <div className="rounded-3xl border border-store-border p-6 text-sm">
              <p className="font-semibold">Pickup: {pickup.pickup_locations?.name}</p>
              {pickup.scheduled_window ? <p className="text-store-muted">Preferred window: {pickup.scheduled_window}</p> : null}
              <p className="mt-2 text-store-muted">{pickup.pickup_locations?.instructions}</p>
            </div>
          ) : null}
          {shipments.map((s, i) => (
            <div key={i} className="rounded-3xl border border-store-border p-6 text-sm">
              <p className="font-semibold">Shipped{s.carrier ? ` via ${s.carrier}` : ""}</p>
              {s.tracking_url ? <a href={s.tracking_url} className="underline" target="_blank" rel="noopener noreferrer">Track: {s.tracking_number}</a> : <p>{s.tracking_number}</p>}
            </div>
          ))}
          {signed.length ? (
            <div className="rounded-3xl border border-store-border p-6 text-sm">
              <p className="mb-3 font-semibold">Your uploaded references</p>
              <div className="grid grid-cols-3 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {signed.map((s, i) => (s.url ? <img key={i} src={s.url} alt={s.name ?? "Uploaded reference"} className="aspect-square rounded-lg object-cover" /> : null))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </Container>
  );
}
