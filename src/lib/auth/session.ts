import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isDemoMode } from "../env";
import { supabaseServer } from "../supabase/server";
import { hasPermission, type Permission, type StaffRole } from "./roles";

export interface StaffSession {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  isDemo: boolean;
}

/**
 * Resolves the current staff member from the Supabase session and the
 * staff_roles table. In demo mode (no Supabase configured) a read-only demo
 * owner is returned so the dashboard can be previewed; every mutating action
 * separately refuses to run in demo mode.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  if (isDemoMode()) return { userId: "demo-owner", email: "owner@example.com", name: "Shannon", role: "owner", isDemo: true };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: staff } = await sb.from("staff_roles").select("role, display_name, is_active").eq("user_id", user.id).maybeSingle();
  if (!staff || !staff.is_active) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    name: staff.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "there",
    role: staff.role as StaffRole,
    isDemo: false,
  };
});

/** Server-side gate for admin pages and actions. */
export async function requirePermission(permission: Permission): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, permission)) redirect("/admin/forbidden");
  return session;
}

/** Same check for route handlers: returns a Response on failure instead of redirecting. */
export async function checkPermission(permission: Permission): Promise<{ session: StaffSession } | { response: Response }> {
  const session = await getStaffSession();
  if (!session) return { response: Response.json({ error: "Not signed in" }, { status: 401 }) };
  if (!hasPermission(session.role, permission)) return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function getCustomerUser() {
  if (isDemoMode()) return null;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
