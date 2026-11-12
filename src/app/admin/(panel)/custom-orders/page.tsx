import Link from "next/link";
import { issueQuote } from "@/app/admin/actions/orders";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { FulfillmentText, PaymentBadge } from "@/components/admin/status";
import { adminInput, Card, Field, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getAllOrders } from "@/lib/data/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Custom Orders" };

export default async function CustomOrdersAdminPage() {
  await requirePermission("custom_orders.manage");
  const orders = (await getAllOrders()).filter((o) => o.isCustomOrder);
  const requests = orders.filter((o) => o.fulfillmentStatus === "request_received" || o.fulfillmentStatus === "quote_pending");
  const queue = orders.filter((o) => ["paid", "design_review", "approved", "in_production"].includes(o.fulfillmentStatus) && o.paymentStatus === "paid");

  return (
    <div className="space-y-8">
      <AdminHeader title="Custom Orders" subtitle="Review requests, send quotes, and track the production queue." />

      <section>
        <h2 className="mb-4 text-xl font-semibold">Quote requests <Pill tone="pink">{requests.length}</Pill></h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {requests.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.orderNumber} · {o.customerName}</p>
                  <p className="text-xs text-admin-muted">{formatDate(o.createdAt)} · {o.customerEmail}</p>
                </div>
                <FulfillmentText status={o.fulfillmentStatus} />
              </div>
              {o.items.map((i) => (
                <div key={i.id} className="mt-3 rounded-lg bg-white p-3 text-sm">
                  <p className="font-medium">{i.productName} × {i.quantity}</p>
                  {Object.entries(i.customization).map(([k, v]) => <p key={k} className="text-xs text-admin-muted">{k}: {Array.isArray(v) ? v.join(", ") : v}</p>)}
                </div>
              ))}
              <ActionForm action={issueQuote.bind(null, o.id)} submitLabel={o.fulfillmentStatus === "quote_pending" ? "Update quote" : "Send quote"} className="mt-4">
                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <Field label="Quote (USD)"><input name="amount" type="number" min="1" step="0.01" required className={adminInput} defaultValue={o.totalCents ? (o.totalCents / 100).toFixed(2) : ""} /></Field>
                  <Field label="Message to customer"><input name="message" className={adminInput} placeholder="Timeline, materials, anything to confirm" /></Field>
                </div>
              </ActionForm>
            </Card>
          ))}
          {!requests.length ? <p className="text-sm text-admin-muted">No open quote requests.</p> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Production queue <Pill>{queue.length}</Pill></h2>
        <div className="relative overflow-x-auto rounded-2xl border border-admin-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-admin-pink text-left text-white"><tr>{["Order", "Customer", "Items", "Ordered", "Total", "Payment", "Stage", ""].map((h) => <th key={h} className="px-4 py-3.5 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {queue.map((o, i) => (
                <tr key={o.id} className={i % 2 ? "bg-admin-row" : "bg-admin-lavender"}>
                  <td className="px-4 py-3">{o.orderNumber}</td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  <td className="px-4 py-3">{o.items.filter((x) => x.isCustom).map((x) => x.productName).join(", ")}</td>
                  <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">{formatMoney(o.totalCents)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={o.paymentStatus} /></td>
                  <td className="px-4 py-3"><FulfillmentText status={o.fulfillmentStatus} /></td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/orders/${o.id}`} className="font-medium text-admin-purple hover:underline">Open</Link></td>
                </tr>
              ))}
              {!queue.length ? <tr><td colSpan={8} className="bg-admin-lavender py-10 text-center text-admin-muted">Nothing in production.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
