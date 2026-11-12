import { inviteStaff, setStaffActive } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { ROLE_LABELS, permissionsFor, type StaffRole } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { getStaff } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Staff" };

const ROLE_INFO: Record<StaffRole, string> = {
  owner: "Everything, including refunds, payment reconciliation, staff and settings.",
  manager: "Orders, products, inventory, customers, analytics, discounts, shipping and content. No refunds, staff or settings.",
  fulfillment: "View orders and update fulfillment status, tracking and notes. No financial tools.",
};

export default async function StaffPage() {
  const session = await requirePermission("staff.manage");
  const staff = await getStaff();
  const demo = isDemoMode();
  return (
    <div className="space-y-8">
      <AdminHeader title="Staff" subtitle="Who can sign in to the dashboard, and what they can do." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(Object.keys(ROLE_INFO) as StaffRole[]).map((r) => (
          <Card key={r} title={ROLE_LABELS[r]}><p className="text-sm">{ROLE_INFO[r]}</p><p className="mt-2 text-xs text-admin-muted">{permissionsFor(r).length} permissions</p></Card>
        ))}
      </div>
      <Card title="Invite a staff member">
        <PageIntro>They&apos;ll get an email to set a password. Roles are checked on the server and again by database policies on every request.</PageIntro>
        <ActionForm action={inviteStaff} submitLabel="Send invite" disabled={demo} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Email"><input name="email" type="email" required className={adminInput} /></Field>
            <Field label="Name"><input name="name" className={adminInput} /></Field>
            <Field label="Role"><select name="role" defaultValue="fulfillment" className={adminInput}><option value="fulfillment">Fulfillment</option><option value="manager">Manager</option><option value="owner">Owner</option></select></Field>
          </div>
        </ActionForm>
      </Card>
      <DataTable head={["Name", "Email", "Role", "Added", "Status", ""]} minWidth={720} empty={staff.length ? false : demo ? "Staff accounts are managed in Supabase. This preview signs you in as a demo owner." : "No staff yet."}>
        {staff.map((s) => (
          <tr key={s.userId}>
            <td className="font-medium">{s.name ?? "—"}{s.userId === session.userId ? <span className="ml-2 text-xs text-admin-muted">(you)</span> : null}</td>
            <td className="text-xs">{s.email}</td>
            <td><Pill tone="purple">{ROLE_LABELS[s.role]}</Pill></td>
            <td className="text-xs">{formatDate(s.createdAt)}</td>
            <td><Pill tone={s.isActive ? "green" : "gray"}>{s.isActive ? "Active" : "Deactivated"}</Pill></td>
            <td className="text-right">
              {s.userId !== session.userId ? (
                <ActionForm action={setStaffActive.bind(null, s.userId)} submitLabel={s.isActive ? "Deactivate" : "Reactivate"} variant="outline" className="[&>div]:mt-0 [&_button]:h-8" confirm={s.isActive ? `Deactivate ${s.email}? They'll lose dashboard access immediately.` : undefined}>
                  <input type="hidden" name="active" value={s.isActive ? "false" : "true"} />
                </ActionForm>
              ) : null}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
