import { AdminHeader } from "@/components/admin/header";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Help" };

const TOPICS: { title: string; body: string[] }[] = [
  { title: "How an order flows", body: ["A customer checks out and an unpaid order is created with stock reserved for 30 minutes.", "Stripe (or Square, if the customer chooses the fallback after a Stripe failure) confirms payment by webhook. Only then does the order become Paid and stock is committed.", "Move the order through design review, production and shipping or pickup from its order page. Customers get an email at key steps."] },
  { title: "Custom orders and quotes", body: ["Requests that need pricing arrive under Custom Orders as Request received.", "Send a quote with a price and note; the customer accepts it from their email link and pays through the normal checkout.", "Customer reference photos are private. They open through short-lived links only you and the customer can use."] },
  { title: "If a payment looks stuck", body: ["Open Payments. Attempts that are Unknown or Pending for a long time are listed under Needs reconciliation.", "Look the payment up in the Stripe or Square dashboard. Only the owner can record the verified result, with the provider's payment id and a note. It's saved to the activity log.", "The Square fallback is blocked for an order while its Stripe payment is unresolved, so a customer can't be charged twice."] },
  { title: "Refunds", body: ["Owners can refund all or part of a payment from the order page. The refund is sent to the original processor, and the order updates when the processor confirms it."] },
  { title: "Inventory", body: ["Ready-made items track stock. Made-to-order variants don't.", "Use Inventory to restock or correct counts. Every change is logged with a reason."] },
];

export default async function HelpPage() {
  await requirePermission("orders.view");
  return (
    <div className="space-y-8">
      <AdminHeader title="Help" subtitle="Quick answers for running the shop." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {TOPICS.map((t) => (
          <Card key={t.title} title={t.title}>
            <ul className="list-disc space-y-2 pl-5 text-sm">{t.body.map((b) => <li key={b}>{b}</li>)}</ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
