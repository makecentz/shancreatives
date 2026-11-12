import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_NAV, ADMIN_NAV_FOOTER } from "@/components/admin/nav";
import { AdminSidebar } from "@/components/admin/sidebar";
import { hasPermission } from "@/lib/auth/roles";
import { getStaffSession } from "@/lib/auth/session";

// Per-request: reads the signed-in session.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Shagannan Admin" },
  robots: { index: false, follow: false },
};

/** Admin layout: deep purple / pink / lavender identity, separate from the storefront. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  const items = ADMIN_NAV.filter((i) => hasPermission(session.role, i.permission));
  const footer = ADMIN_NAV_FOOTER.filter((i) => hasPermission(session.role, i.permission));
  return (
    <div className="theme-admin min-h-screen bg-white font-sans text-admin-ink">
      <AdminSidebar items={items} footer={footer} demo={session.isDemo} />
      <div className="md:pl-[76px] xl:pl-[243px]">
        {session.isDemo ? (
          <div className="border-b border-admin-border bg-admin-lavender py-2 pl-16 pr-4 text-left text-xs text-admin-purple md:px-4 md:text-center">
            <strong>Demo data.</strong> Supabase isn&rsquo;t connected, so this dashboard is showing labelled sample records. Figures are calculated from those records, and all changes are disabled.
          </div>
        ) : null}
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-5 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
