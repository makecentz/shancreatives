import "server-only";
import { defaultPolicies, defaultSiteContent } from "../demo/content";
import type { Discount } from "../discounts";
import { isDemoMode } from "../env";
import type { Policy, SiteContent } from "../types";
import { supabaseAdmin, supabaseServer } from "../supabase/server";

/*
 * Admin-only reads. Every caller has already passed requirePermission(); the
 * RLS-bound client enforces the same rule again. In demo mode these return
 * empty lists rather than invented records.
 */

export async function getDiscounts(): Promise<Discount[]> {
  if (isDemoMode()) return [];
  const sb = await supabaseServer();
  const { data, error } = await sb.from("discounts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id, code: d.code, kind: d.kind, value: Number(d.value), productIds: d.product_ids,
    minSubtotalCents: Number(d.min_subtotal_cents), usageLimit: d.usage_limit, usageCount: d.usage_count,
    perCustomerLimit: d.per_customer_limit, startsAt: d.starts_at, endsAt: d.ends_at, isActive: d.is_active,
  }));
}

export interface InventoryMovement {
  id: string;
  variantId: string;
  change: number;
  reason: string;
  note: string | null;
  stockAfter: number | null;
  orderId: string | null;
  createdAt: string;
}

export async function getInventoryMovements(limit = 100): Promise<InventoryMovement[]> {
  if (isDemoMode()) return [];
  const sb = await supabaseServer();
  const { data, error } = await sb.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, variantId: m.variant_id, change: m.change, reason: m.reason, note: m.note, stockAfter: m.stock_after, orderId: m.order_id, createdAt: m.created_at }));
}

export interface StaffMember {
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "manager" | "fulfillment";
  isActive: boolean;
  createdAt: string;
}

/** Uses the service role to read auth emails; only call after requirePermission('staff.manage'). */
export async function getStaff(): Promise<StaffMember[]> {
  if (isDemoMode()) return [];
  const admin = supabaseAdmin();
  const [{ data: roles, error }, { data: users }] = await Promise.all([
    admin.from("staff_roles").select("*").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;
  const email = (id: string) => users?.users.find((u) => u.id === id)?.email ?? "";
  return (roles ?? []).map((r) => ({ userId: r.user_id, email: email(r.user_id), name: r.display_name, role: r.role, isActive: r.is_active, createdAt: r.created_at }));
}

export interface PaymentAttemptRow {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: "stripe" | "square";
  status: string;
  amountCents: number;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  failureReason: string | null;
  createdAt: string;
}

export async function getPaymentAttempts(limit = 200): Promise<PaymentAttemptRow[]> {
  if (isDemoMode()) return [];
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("payment_attempts")
    .select("id, order_id, provider, status, amount_cents, provider_session_id, provider_payment_id, failure_reason, created_at, orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a) => {
    const ord = a.orders as unknown as { order_number?: string } | null;
    return {
      id: a.id, orderId: a.order_id, orderNumber: ord?.order_number ?? "", provider: a.provider, status: a.status,
      amountCents: Number(a.amount_cents), providerSessionId: a.provider_session_id, providerPaymentId: a.provider_payment_id,
      failureReason: a.failure_reason, createdAt: a.created_at,
    };
  });
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  actorRole: string | null;
  createdAt: string;
}

export async function getAuditLog(limit = 50): Promise<AuditEntry[]> {
  if (isDemoMode()) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from("audit_logs").select("id, action, entity_type, entity_id, actor_role, created_at").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((a) => ({ id: a.id, action: a.action, entityType: a.entity_type, entityId: a.entity_id, actorRole: a.actor_role, createdAt: a.created_at }));
}

export interface ContentState {
  draft: SiteContent;
  published: SiteContent;
  publishedAt: string | null;
  hasUnpublished: boolean;
}

export async function getContentState(): Promise<ContentState> {
  if (isDemoMode()) return { draft: defaultSiteContent, published: defaultSiteContent, publishedAt: null, hasUnpublished: false };
  const sb = await supabaseServer();
  const { data } = await sb.from("site_content").select("draft, published, published_at").eq("key", "site").maybeSingle();
  const draft = { ...defaultSiteContent, ...((data?.draft as Partial<SiteContent>) ?? {}) };
  const published = { ...defaultSiteContent, ...((data?.published as Partial<SiteContent>) ?? {}) };
  return { draft, published, publishedAt: data?.published_at ?? null, hasUnpublished: JSON.stringify(data?.draft ?? null) !== JSON.stringify(data?.published ?? null) };
}

export async function getPoliciesForEdit(): Promise<Policy[]> {
  if (isDemoMode()) return defaultPolicies;
  const sb = await supabaseServer();
  const { data } = await sb.from("site_content").select("key, published").like("key", "policy:%");
  return defaultPolicies.map((p) => {
    const row = data?.find((r) => r.key === `policy:${p.slug}`);
    const pub = row?.published as Partial<Policy> | undefined;
    return pub?.body ? { slug: p.slug, title: pub.title ?? p.title, body: pub.body } : p;
  });
}

export interface AdminShippingRate { id: string; name: string; amountCents: number; freeOverCents: number | null; minDays: number | null; maxDays: number | null; isActive: boolean }
export interface AdminPickup { id: string; name: string; address: Record<string, string>; instructions: string; windows: string[]; isActive: boolean }

export async function getShippingAdmin(): Promise<{ rates: AdminShippingRate[]; pickups: AdminPickup[] }> {
  if (isDemoMode()) return { rates: [], pickups: [] };
  const sb = await supabaseServer();
  const [{ data: rates }, { data: pickups }] = await Promise.all([
    sb.from("shipping_rates").select("*").order("sort_order"),
    sb.from("pickup_locations").select("*").order("created_at"),
  ]);
  return {
    rates: (rates ?? []).map((r) => ({ id: r.id, name: r.name, amountCents: Number(r.amount_cents), freeOverCents: r.free_over_cents == null ? null : Number(r.free_over_cents), minDays: r.min_days, maxDays: r.max_days, isActive: r.is_active })),
    pickups: (pickups ?? []).map((p) => ({ id: p.id, name: p.name, address: (p.address ?? {}) as Record<string, string>, instructions: p.instructions ?? "", windows: (p.available_windows as string[]) ?? [], isActive: p.is_active })),
  };
}

export interface AdminCategory { id: string; slug: string; name: string; description: string; sortOrder: number; isVisible: boolean }

export async function getAdminCategories(): Promise<AdminCategory[]> {
  if (isDemoMode()) {
    const { demoCategories } = await import("../demo/catalog");
    return demoCategories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, sortOrder: c.sortOrder, isVisible: true }));
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.from("categories").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description ?? "", sortOrder: c.sort_order, isVisible: c.is_visible }));
}
