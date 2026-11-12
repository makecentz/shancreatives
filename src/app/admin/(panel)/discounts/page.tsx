import { saveDiscount, toggleDiscount } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getDiscounts } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  await requirePermission("discounts.manage");
  const discounts = await getDiscounts();
  const demo = isDemoMode();
  return (
    <div className="space-y-8">
      <AdminHeader title="Discounts" subtitle="Promo codes customers can enter at checkout." />
      <Card title="Create a code">
        <ActionForm action={saveDiscount} submitLabel="Create code" disabled={demo}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code"><input name="code" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_\-]+" className={`${adminInput} uppercase`} /></Field>
            <Field label="Type"><select name="kind" className={adminInput}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option></select></Field>
            <Field label="Value" hint="Percent (e.g. 15) or dollars (e.g. 5.00)"><input name="value" type="number" step="0.01" min="0.01" required className={adminInput} /></Field>
            <Field label="Minimum subtotal ($)"><input name="min_subtotal" type="number" step="0.01" min="0" className={adminInput} /></Field>
            <Field label="Total uses allowed"><input name="usage_limit" type="number" min="1" className={adminInput} /></Field>
            <Field label="Uses per customer"><input name="per_customer_limit" type="number" min="1" className={adminInput} /></Field>
            <Field label="Starts"><input name="starts_at" type="datetime-local" className={adminInput} /></Field>
            <Field label="Ends"><input name="ends_at" type="datetime-local" className={adminInput} /></Field>
            <Field label="Limit to product ids" hint="Optional, comma-separated" className="sm:col-span-2 lg:col-span-4"><input name="product_ids" className={adminInput} /></Field>
          </div>
        </ActionForm>
      </Card>
      <DataTable head={["Code", "Discount", "Minimum", "Used", "Window", "Status", ""]} minWidth={860} empty={discounts.length ? false : demo ? "Discount codes are stored in Supabase; none in demo mode." : "No discount codes yet."}>
        {discounts.map((d) => (
          <tr key={d.id}>
            <td className="font-mono font-semibold">{d.code}</td>
            <td>{d.kind === "percentage" ? `${d.value / 100}% off` : `${formatMoney(d.value)} off`}{d.productIds?.length ? <span className="block text-xs text-admin-muted">{d.productIds.length} products</span> : null}</td>
            <td>{d.minSubtotalCents ? formatMoney(d.minSubtotalCents) : "—"}</td>
            <td>{d.usageCount}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</td>
            <td className="whitespace-nowrap text-xs">{d.startsAt ? formatDate(d.startsAt) : "Now"} – {d.endsAt ? formatDate(d.endsAt) : "No end"}</td>
            <td><Pill tone={d.isActive ? "green" : "gray"}>{d.isActive ? "Active" : "Disabled"}</Pill></td>
            <td className="text-right">
              <ActionForm action={toggleDiscount.bind(null, d.id)} submitLabel={d.isActive ? "Disable" : "Enable"} variant="outline" className="[&>div]:mt-0 [&_button]:h-8">
                <input type="hidden" name="active" value={d.isActive ? "false" : "true"} />
              </ActionForm>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
