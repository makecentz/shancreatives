import "server-only";
import type { Permission } from "../auth/roles";
import { hasPermission } from "../auth/roles";
import { getStaffSession, type StaffSession } from "../auth/session";
import { isDemoMode } from "../env";
import { supabaseAdmin, supabaseServer } from "../supabase/server";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

export class ActionError extends Error {}

/**
 * Every admin mutation goes through here: refuses in demo mode, re-checks the
 * staff member's permission on the server, and returns an RLS-bound client so
 * the database enforces the same rule a second time.
 */
export async function guard(permission: Permission): Promise<{ session: StaffSession; db: Awaited<ReturnType<typeof supabaseServer>> }> {
  if (isDemoMode()) throw new ActionError("Changes are disabled in demo mode. Connect Supabase to manage the store.");
  const session = await getStaffSession();
  if (!session) throw new ActionError("Please sign in again.");
  if (!hasPermission(session.role, permission)) throw new ActionError("You don't have permission to do that.");
  return { session, db: await supabaseServer() };
}

export async function audit(session: StaffSession, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  await supabaseAdmin().from("audit_logs").insert({ actor_id: session.userId, actor_role: session.role, action, entity_type: entityType, entity_id: entityId, before: before ?? null, after: after ?? null });
}

export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: (e as { message?: string }).message ?? "Something went wrong." };
  }
}
