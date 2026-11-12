import { saveTaxSettings } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getAuditLog } from "@/lib/data/admin-extra";
import { getTaxSettings } from "@/lib/data/settings";
import { isDemoMode, isEmailConfigured, isSquareConfigured, isStripeConfigured, isSupabaseConfigured, siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [tax, log] = await Promise.all([getTaxSettings(), getAuditLog()]);
  const demo = isDemoMode();
  const integrations: [string, boolean, string][] = [
    ["Supabase (database, auth, storage)", isSupabaseConfigured(), "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"],
    ["Stripe (primary payments)", isStripeConfigured(), "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"],
    ["Square (fallback payments)", isSquareConfigured(), "SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_ENVIRONMENT"],
    ["Resend (email)", isEmailConfigured(), "RESEND_API_KEY, EMAIL_FROM"],
  ];
  return (
    <div className="space-y-8">
      <AdminHeader title="Settings" subtitle="Tax, integrations and the activity log." />
      <Card title="Sales tax">
        <PageIntro>Applied to item subtotals after discounts. Confirm the right rate and rules for your state with an accountant. Tax is 0% until you set it.</PageIntro>
        <ActionForm action={saveTaxSettings} submitLabel="Save tax settings" disabled={demo} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tax rate (%)"><input name="rate" type="number" step="0.001" min="0" max="30" defaultValue={tax.rateBps / 100} className={adminInput} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="tax_shipping" defaultChecked={tax.taxShipping} className="size-4 accent-admin-purple" />Charge tax on shipping</label>
          </div>
        </ActionForm>
      </Card>
      <Card title="Integrations">
        <PageIntro>Keys are set as environment variables in Vercel, never in the dashboard, so they can&apos;t leak to the browser. Site URL: {siteUrl()}</PageIntro>
        <ul className="mt-4 divide-y divide-admin-border">
          {integrations.map(([name, ok, vars]) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span><span className="font-medium">{name}</span><span className="block font-mono text-[11px] text-admin-muted">{vars}</span></span>
              <Pill tone={ok ? "green" : "gray"}>{ok ? "Connected" : "Not configured"}</Pill>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-admin-muted">Webhook endpoints: {siteUrl()}/api/webhooks/stripe and {siteUrl()}/api/webhooks/square</p>
      </Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Activity log</h2>
        <DataTable head={["When", "Action", "Record", "By role"]} minWidth={620} empty={log.length ? false : demo ? "The activity log records every staff change once Supabase is connected." : "No activity yet."}>
          {log.map((l) => (
            <tr key={l.id}><td className="whitespace-nowrap text-xs">{formatDate(l.createdAt)}</td><td className="font-mono text-xs">{l.action}</td><td className="text-xs">{l.entityType} {l.entityId ? <span className="text-admin-muted">{l.entityId.slice(0, 18)}</span> : null}</td><td className="text-xs capitalize">{l.actorRole ?? "system"}</td></tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
