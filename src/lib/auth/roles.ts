/**
 * Role-based access control. This matrix is enforced server-side in
 * requirePermission() and mirrored in Supabase RLS (public.has_permission).
 * The sidebar also uses it, but hiding navigation is never the only check.
 */
export type StaffRole = "owner" | "manager" | "fulfillment";

export type Permission =
  | "dashboard.view"
  | "orders.view"
  | "orders.manage"
  | "orders.refund"
  | "custom_orders.manage"
  | "products.manage"
  | "inventory.manage"
  | "customers.view"
  | "analytics.view"
  | "payments.view"
  | "discounts.manage"
  | "shipping.manage"
  | "content.manage"
  | "staff.manage"
  | "settings.manage"
  | "fulfillment.update";

const MATRIX: Record<StaffRole, Permission[]> = {
  owner: [
    "dashboard.view", "orders.view", "orders.manage", "orders.refund", "custom_orders.manage", "products.manage",
    "inventory.manage", "customers.view", "analytics.view", "payments.view", "discounts.manage", "shipping.manage",
    "content.manage", "staff.manage", "settings.manage", "fulfillment.update",
  ],
  manager: [
    "dashboard.view", "orders.view", "orders.manage", "custom_orders.manage", "products.manage", "inventory.manage",
    "customers.view", "analytics.view", "discounts.manage", "shipping.manage", "content.manage", "fulfillment.update",
  ],
  fulfillment: ["orders.view", "fulfillment.update"],
};

export function hasPermission(role: StaffRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: StaffRole): Permission[] {
  return [...MATRIX[role]];
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  fulfillment: "Fulfillment Staff",
};
