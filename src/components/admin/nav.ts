import type { Permission } from "@/lib/auth/roles";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
}

/** Sidebar items. Visibility follows permissions, but every page re-checks on the server. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: "Package", permission: "orders.view" },
  { href: "/admin/custom-orders", label: "Custom Orders", icon: "Scissors", permission: "custom_orders.manage" },
  { href: "/admin/products", label: "Products", icon: "ShoppingBag", permission: "products.manage" },
  { href: "/admin/categories", label: "Categories", icon: "Layers", permission: "products.manage" },
  { href: "/admin/inventory", label: "Inventory", icon: "Boxes", permission: "inventory.manage" },
  { href: "/admin/customers", label: "Customers", icon: "Users", permission: "customers.view" },
  { href: "/admin/reports", label: "Analytics", icon: "ChartColumn", permission: "analytics.view" },
  { href: "/admin/payments", label: "Payments", icon: "CreditCard", permission: "payments.view" },
  { href: "/admin/discounts", label: "Discounts", icon: "Percent", permission: "discounts.manage" },
  { href: "/admin/shipping", label: "Shipping & Pickup", icon: "Truck", permission: "shipping.manage" },
  { href: "/admin/content", label: "Website Content", icon: "FileText", permission: "content.manage" },
  { href: "/admin/staff", label: "Staff", icon: "UserCog", permission: "staff.manage" },
];

export const ADMIN_NAV_FOOTER: AdminNavItem[] = [
  { href: "/admin/settings", label: "Settings", icon: "Settings", permission: "settings.manage" },
  { href: "/admin/help", label: "Help", icon: "LifeBuoy", permission: "orders.view" },
];
