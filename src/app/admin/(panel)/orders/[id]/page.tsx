import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addInternalNote, addTracking, issueRefund, updateFulfillmentFromForm } from "@/app/admin/actions/orders";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { FulfillmentText, PaymentBadge } from "@/components/admin/status";
import { adminInput, Card, Field } from "@/components/admin/ui";
import { FULFILLMENT_LABELS } from "@/components/store/order-status";
import { hasPermission } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getOrderById } from "@/lib/data/admin";
import { isDemoMode } from "@/lib/env";
import { allowedNextStatuses } from "@/lib/fulfillment";
import { formatMoney } from "@/lib/money";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Order details" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const session = await requirePermission("orders.view");
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  type Extra = { internal_notes: { by: string; at: string; note: string }[]; customer_phone: string | null; shipping_address: Record<string, string> | null; customer_notes: string | null; shipments: { carrier: string | null; tracking_number: string; tracking_url: string | null; shipped_at: string }[]; payment_attempts: { id: string; provider: string; status: string; amount_cents: number; created_at: string; failure_reason: string | null }[]; refunds: { amount_cents: number; status: string; created_at: string; reason: string | null }[]; pickup_details: { scheduled_window: string | null; collected_at: string | null } | null };
  let extra: Extra | null = null;
  let uploads: { name: string | null; url?: string }[] = [];
  if (!isDemoMode()) {
    const sb = await supabaseServer();
    const { data } = await sb.from("orders").select("internal_notes, customer_phone, shipping_address, customer_notes, shipments(*), payment_attempts(*), refunds(*), pickup_details(*)").eq("id", id).single();
    extra = data as unknown as Extra;
    const { data: ups } = await sb.from("custom_uploads").select("storage_path, original_name").eq("order_id", id);
    uploads = await Promise.all((ups ?? []).map(async (u) => ({ name: u.original_name, url: (await supabaseAdmin().storage.from("customer-uploads").createSignedUrl(u.storage_path, 600)).data?.signedUrl })));
  }
  const next = allowedNextStatuses(order.fulfillmentStatus, order.paymentStatus, order.deliveryMethod);
  const canRefund = hasPermission(session.role, "orders.refund") && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded");
  const canUpdate = hasPermission(session.role, "fulfillment.update");
  const showCustomer = hasPermission(session.role, "customers.view") || hasPermission(session.role, "orders.manage");

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 pl-12 text-sm text-admin-muted hover:text-admin-ink md:pl-0"><ArrowLeft className="size-4" /> All orders</Link>
      <AdminHeader title={`Order #${order.orderNumber.replace(/^SS-/, "")}`} subtitle={`Placed ${formatDate(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}`} />
      <div className="flex flex-wrap items-center gap-3">
        <PaymentBadge status={order.paymentStatus} />
        <span className="text-sm">Fulfillment: <FulfillmentText status={order.fulfillmentStatus} /></span>
        <span className="text-sm capitalize text-admin-muted">{order.deliveryMethod} · {order.paymentProvider ?? "no processor yet"}</span>
        <Link href={`/admin/orders/${order.id}/packing-slip`} target="_blank" className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-admin-border px-3 text-sm hover:bg-admin-lavender"><Printer className="size-4" />Packing slip</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-admin-border">
              {order.items.map((i) => (
                <li key={i.id} className="flex gap-4 py-4 first:pt-0">
                  <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-admin-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-full w-full object-contain p-1" /> : null}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{i.productName} × {i.quantity} {i.isCustom ? <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-admin-purple">Custom</span> : null}</p>
                    <p className="text-admin-muted">{[i.sku, i.color, i.size].filter(Boolean).join(" · ")}</p>
                    {Object.entries(i.customization).length ? (
                      <dl className="mt-2 grid gap-x-4 gap-y-0.5 rounded-lg bg-white p-3 text-xs sm:grid-cols-2">
                        {Object.entries(i.customization).map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline text-admin-muted">{Array.isArray(v) ? v.join(", ") : v}</dd></div>)}
                      </dl>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(i.lineTotalCents)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-admin-border pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>
              {order.discountCents ? <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(order.discountCents)}</dd></div> : null}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.shippingCents)}</dd></div>
              <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.taxCents)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatMoney(order.totalCents)}</dd></div>
              {order.refundedCents ? <div className="flex justify-between text-admin-danger"><dt>Refunded</dt><dd>−{formatMoney(order.refundedCents)}</dd></div> : null}
            </dl>
          </Card>

          {uploads.length ? (
            <Card title="Customer uploads (private)">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {uploads.map((u, i) => (u.url ? <a key={i} href={u.url} target="_blank" rel="noopener noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u.url} alt={u.name ?? "Customer upload"} className="aspect-square rounded-lg object-cover ring-1 ring-admin-border" /></a> : null))}
              </div>
              <p className="mt-2 text-xs text-admin-muted">Links expire after 10 minutes.</p>
            </Card>
          ) : null}

          <Card title="Payment history">
            {extra?.payment_attempts?.length ? (
              <ul className="space-y-2 text-sm">
                {extra.payment_attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-3">
                    <span className="capitalize">{a.provider} · {a.status}{a.failure_reason ? <span className="text-admin-muted"> ({a.failure_reason})</span> : null}</span>
                    <span>{formatMoney(Number(a.amount_cents))} · {formatDate(a.created_at)}</span>
                  </li>
                ))}
                {extra.refunds?.map((r, i) => <li key={i} className="flex justify-between rounded-lg bg-white p-3"><span>Refund · {r.status}{r.reason ? ` · ${r.reason}` : ""}</span><span>−{formatMoney(Number(r.amount_cents))}</span></li>)}
              </ul>
            ) : <p className="text-sm text-admin-muted">{isDemoMode() ? "Payment attempts are recorded once Stripe/Square are connected." : "No payment attempts yet."}</p>}
            <p className="mt-3 text-xs text-admin-muted">Payment status changes only through verified processor events or audited reconciliation; it can&rsquo;t be edited by hand.</p>
          </Card>

          <Card title="Internal notes">
            <ul className="mb-3 space-y-2 text-sm">
              {(extra?.internal_notes ?? []).map((n, i) => <li key={i} className="rounded-lg bg-white p-3"><p>{n.note}</p><p className="mt-1 text-xs text-admin-muted">{n.by} · {formatDate(n.at)}</p></li>)}
              {!(extra?.internal_notes ?? []).length ? <li className="text-admin-muted">No notes yet.</li> : null}
            </ul>
            {canUpdate ? (
              <ActionForm action={addInternalNote.bind(null, order.id)} submitLabel="Add note" variant="outline">
                <textarea name="note" rows={2} required className={`${adminInput} h-auto py-2`} placeholder="Visible to staff only" aria-label="Internal note" />
              </ActionForm>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          {showCustomer ? (
            <Card title="Customer">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-sm text-admin-muted">{order.customerEmail}</p>
              {extra?.customer_phone ? <p className="text-sm text-admin-muted">{extra.customer_phone}</p> : null}
              {extra?.shipping_address ? <p className="mt-3 whitespace-pre-line text-sm">{[extra.shipping_address.line1, extra.shipping_address.line2, `${extra.shipping_address.city}, ${extra.shipping_address.state} ${extra.shipping_address.postal_code}`].filter(Boolean).join("\n")}</p> : null}
              {extra?.pickup_details ? <p className="mt-3 text-sm">Pickup{extra.pickup_details.scheduled_window ? ` · ${extra.pickup_details.scheduled_window}` : ""}{extra.pickup_details.collected_at ? ` · collected ${formatDate(extra.pickup_details.collected_at)}` : ""}</p> : null}
              {extra?.customer_notes ? <p className="mt-3 rounded-lg bg-white p-3 text-sm">“{extra.customer_notes}”</p> : null}
            </Card>
          ) : null}

          {canUpdate ? (
            <Card title="Update status">
              {next.length ? (
                <ActionForm action={updateFulfillmentFromForm.bind(null, order.id)} submitLabel="Update status">
                  <label className="sr-only" htmlFor="to">New status</label>
                  <select id="to" name="to" className={adminInput}>
                    {next.map((s) => <option key={s} value={s}>{FULFILLMENT_LABELS[s]}</option>)}
                  </select>
                </ActionForm>
              ) : <p className="text-sm text-admin-muted">{order.paymentStatus !== "paid" && order.fulfillmentStatus === "awaiting_payment" ? "Waiting for a verified payment." : "No further status changes available."}</p>}
            </Card>
          ) : null}

          {canUpdate && order.deliveryMethod === "shipping" && ["paid", "in_production", "ready_for_shipping", "approved"].includes(order.fulfillmentStatus) ? (
            <Card title="Add tracking">
              <ActionForm action={addTracking.bind(null, order.id)} submitLabel="Save & mark shipped" variant="pink">
                <div className="space-y-3">
                  <Field label="Carrier"><input name="carrier" className={adminInput} placeholder="USPS, UPS…" /></Field>
                  <Field label="Tracking number"><input name="tracking_number" required className={adminInput} /></Field>
                  <Field label="Tracking URL"><input name="tracking_url" type="url" className={adminInput} /></Field>
                </div>
              </ActionForm>
              {extra?.shipments?.map((s, i) => <p key={i} className="mt-3 text-sm">{s.carrier} {s.tracking_number}</p>)}
            </Card>
          ) : null}

          {canRefund ? (
            <Card title="Refund">
              <ActionForm action={issueRefund.bind(null, order.id)} submitLabel="Issue refund" variant="danger" confirm="Issue this refund through the payment processor? This can't be undone.">
                <div className="space-y-3">
                  <Field label="Amount (USD)" hint={`Up to ${formatMoney(order.totalCents - order.refundedCents)}`}><input name="amount" type="number" step="0.01" min="0.01" max={(order.totalCents - order.refundedCents) / 100} defaultValue={((order.totalCents - order.refundedCents) / 100).toFixed(2)} className={adminInput} /></Field>
                  <Field label="Reason"><input name="reason" className={adminInput} /></Field>
                </div>
              </ActionForm>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
