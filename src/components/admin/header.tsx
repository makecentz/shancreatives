import { ROLE_LABELS } from "@/lib/auth/roles";
import { getStaffSession } from "@/lib/auth/session";
import { getNotifications } from "@/lib/data/admin";
import { AdminTopbar } from "./topbar";

export async function AdminHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [session, notifications] = await Promise.all([getStaffSession(), getNotifications()]);
  return (
    <AdminTopbar
      title={title}
      subtitle={subtitle}
      name={session?.name ?? ""}
      roleLabel={session ? (session.isDemo ? `${ROLE_LABELS[session.role]} (demo)` : ROLE_LABELS[session.role]) : ""}
      notifications={notifications}
    />
  );
}
