import Link from "next/link";
import { reconcilePayment } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { hasPermission } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { dashboardNow, getAllOrders } from "@/lib/data/admin";
import { getPaymentAttempts } from "@/lib/data/admin-extra";
import { isDemoMode, isSquareConfigured, isStripeConfigured } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Payments" };

const TONE: Record<string, "green" | "red" | "amber" | "gray" | "purple"> = {
  succeeded: "green", failed: "red", canceled: "gray", expired: "gray", unknown: "amber", pending: "amber", created: "gray", refunded: "purple", partially_refunded: "purple",
};

export default async function PaymentsPage() {
  const session = await requirePermission("payments.view");
  const [attempts, orders] = await Promise.all([getPaymentAttempts(), getAllOrders()]);
  const canReconcile = hasPermission(session.role, "orders.refund") && !isDemoMode();
  const now = dashboardNow().getTime();
  const needs = attempts.filter((a) => a.status === "unknown" || (a.status === "pending" && now - new Date(a.createdAt).getTime() > 2 * 3600000));
  const recOrders = orders.filter((o) => o.paymentStatus === "requires_reconciliation");
  return (
    <div className="space-y-8">
      <AdminHeader title="Payments" subtitle="Checkout attempts, provider status and reconciliation." />
      <PageIntro>Payment status is only changed by verified provider webhooks. When a result is unknown, Square fallback stays blocked for that order until it&apos;s resolved here, using the payment id you confirmed in the provider dashboard.</PageIntro>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Stripe (primary)"><Pill tone={isStripeConfigured() ? "green" : "gray"}>{isStripeConfigured() ? "Configured" : "Not configured"}</Pill></Card>
        <Card title="Square (fallback)"><Pill tone={isSquareConfigured() ? "green" : "gray"}>{isSquareConfigured() ? "Configured" : "Not configured"}</Pill></Card>
      </div>
      <Card title="Needs reconciliation">
        {needs.length || recOrders.length ? (
          <div className="space-y-4">
            {recOrders.map((o) => <p key={o.id} className="text-sm"><Link className="font-medium hover:underline" href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link> has a payment flagged for review (for example an amount mismatch or a second successful payment). Check the provider dashboard and refund any duplicate.</p>)}
            {needs.map((a) => (
              <div key={a.id} className="rounded-xl border border-admin-border bg-white p-4">
                <p className="text-sm"><span className="font-medium">{a.orderNumber}</span> · {a.provider} · {formatMoney(a.amountCents)} · <Pill tone={TONE[a.status]}>{a.status}</Pill> <span className="text-xs text-admin-muted">since {formatDate(a.createdAt)}</span></p>
                {canReconcile ? (
                  <ActionForm action={reconcilePayment.bind(null, a.id)} submitLabel="Record verified result" confirm="Record this result? It's applied to the order and audit logged." className="mt-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Result"><select name="resolution" className={adminInput}><option value="succeeded">Payment succeeded</option><option value="failed">Payment failed</option></select></Field>
                      <Field label="Provider payment id"><input name="provider_payment_id" required className={adminInput} placeholder="pi_… or Square payment id" /></Field>
                      <Field label="How you verified it"><input name="note" required minLength={5} className={adminInput} /></Field>
                    </div>
                  </ActionForm>
                ) : <p className="mt-2 text-xs text-admin-muted">Only the owner can record a reconciliation.</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-admin-muted">Nothing needs attention.</p>}
      </Card>
      <DataTable head={["Date", "Order", "Provider", "Amount", "Status", "Provider reference", "Note"]} minWidth={940} empty={attempts.length ? false : isDemoMode() ? "Payment attempts appear here once Supabase and a payment provider are connected." : "No payment attempts yet."}>
        {attempts.map((a) => (
          <tr key={a.id}>
            <td className="whitespace-nowrap text-xs">{formatDate(a.createdAt)}</td>
            <td><Link href={`/admin/orders/${a.orderId}`} className="font-medium hover:underline">{a.orderNumber}</Link></td>
            <td className="capitalize">{a.provider}</td>
            <td>{formatMoney(a.amountCents)}</td>
            <td><Pill tone={TONE[a.status] ?? "gray"}>{a.status.replace("_", " ")}</Pill></td>
            <td className="max-w-48 truncate font-mono text-xs">{a.providerPaymentId ?? a.providerSessionId ?? "—"}</td>
            <td className="text-xs text-admin-muted">{a.failureReason ?? ""}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
