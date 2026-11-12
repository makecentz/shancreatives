import { deactivateRow, savePickupLocation, saveShippingRate } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getShippingAdmin } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Shipping & Pickup" };

export default async function ShippingPage() {
  await requirePermission("shipping.manage");
  const { rates, pickups } = await getShippingAdmin();
  const demo = isDemoMode();
  return (
    <div className="space-y-8">
      <AdminHeader title="Shipping & Pickup" subtitle="Rates shown at checkout and local pickup locations." />
      <PageIntro>Nothing here is hardcoded. Checkout only offers the active rates and pickup locations you add. The pickup address is shown to customers only after they choose pickup.</PageIntro>
      <Card title="Shipping rates">
        <ActionForm action={saveShippingRate} submitLabel="Add rate" disabled={demo}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" className="lg:col-span-2"><input name="name" required className={adminInput} placeholder="Standard shipping" /></Field>
            <Field label="Price ($)"><input name="amount" type="number" step="0.01" min="0" required className={adminInput} /></Field>
            <Field label="Free over ($)"><input name="free_over" type="number" step="0.01" min="0" className={adminInput} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min days"><input name="min_days" type="number" min="0" className={adminInput} /></Field>
              <Field label="Max days"><input name="max_days" type="number" min="0" className={adminInput} /></Field>
            </div>
          </div>
        </ActionForm>
        <div className="mt-5">
          <DataTable head={["Rate", "Price", "Free over", "Delivery", "Status", ""]} minWidth={640} empty={rates.length ? false : demo ? "Rates are stored in Supabase. The demo checkout uses two labelled sample rates." : "No shipping rates yet. Customers can't choose shipping until you add one."}>
            {rates.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{formatMoney(r.amountCents)}</td>
                <td>{r.freeOverCents != null ? formatMoney(r.freeOverCents) : "—"}</td>
                <td className="text-xs">{r.minDays != null ? `${r.minDays}–${r.maxDays ?? r.minDays} days` : "—"}</td>
                <td><Pill tone={r.isActive ? "green" : "gray"}>{r.isActive ? "Active" : "Removed"}</Pill></td>
                <td className="text-right">{r.isActive ? <ActionForm action={deactivateRow.bind(null, "shipping_rates", r.id)} submitLabel="Remove" variant="outline" className="[&>div]:mt-0 [&_button]:h-8" /> : null}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </Card>
      <Card title="Local pickup locations">
        <ActionForm action={savePickupLocation} submitLabel="Add pickup location" disabled={demo}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Location name"><input name="name" required className={adminInput} /></Field>
            <Field label="Address line 1"><input name="line1" required className={adminInput} /></Field>
            <Field label="Address line 2"><input name="line2" className={adminInput} /></Field>
            <Field label="City"><input name="city" required className={adminInput} /></Field>
            <Field label="State"><input name="state" className={adminInput} /></Field>
            <Field label="Postal code"><input name="postal_code" className={adminInput} /></Field>
            <Field label="Pickup instructions" className="sm:col-span-2 lg:col-span-3"><textarea name="instructions" rows={2} className={`${adminInput} h-auto py-2`} /></Field>
            <Field label="Scheduling note"><input name="scheduling_note" className={adminInput} placeholder="We'll confirm your time by email" /></Field>
            <Field label="Pickup windows" hint="One per line" className="sm:col-span-1 lg:col-span-2"><textarea name="windows" rows={3} className={`${adminInput} h-auto py-2`} placeholder={"Weekday evenings 5–7pm\nSaturday 10am–noon"} /></Field>
          </div>
        </ActionForm>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {pickups.map((p) => (
            <li key={p.id} className="rounded-xl border border-admin-border bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold">{p.name}</p><Pill tone={p.isActive ? "green" : "gray"}>{p.isActive ? "Active" : "Removed"}</Pill></div>
              <p className="mt-1 text-admin-muted">{[p.address.line1, p.address.line2, [p.address.city, p.address.state, p.address.postal_code].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
              {p.windows.length ? <p className="mt-1 text-xs">{p.windows.join(" · ")}</p> : null}
              {p.isActive ? <ActionForm action={deactivateRow.bind(null, "pickup_locations", p.id)} submitLabel="Remove" variant="outline" className="[&_button]:h-8" /> : null}
            </li>
          ))}
          {!pickups.length ? <li className="text-sm text-admin-muted">{demo ? "Pickup locations are stored in Supabase." : "No pickup locations yet. Pickup won't be offered at checkout until you add one."}</li> : null}
        </ul>
      </Card>
    </div>
  );
}
