import "server-only";
import { cache } from "react";
import { isDemoMode } from "../env";
import { demoProducts } from "../demo/catalog";
import { buildDemoData } from "../demo/orders";
import type { Customer, Order, Product } from "../types";
import { supabaseServer } from "../supabase/server";
import { mapOrder, mapProduct, ORDER_SELECT, PRODUCT_SELECT } from "./mappers";
import { availableStock } from "../catalog";

/** In demo mode the dashboard pretends "now" is fixed so the sample series stays stable. */
export function dashboardNow(): Date {
  return isDemoMode() ? new Date("2026-11-12T18:00:00Z") : new Date();
}

const demo = cache(() => buildDemoData());

/** Caller must already have passed requirePermission('orders.view'); RLS enforces it again. */
export const getAllOrders = cache(async (): Promise<Order[]> => {
  if (isDemoMode()) return demo().orders;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return (data ?? []).map(mapOrder);
});

export async function getOrderById(id: string): Promise<Order | null> {
  if (isDemoMode()) return demo().orders.find((o) => o.id === id) ?? null;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export const getAllCustomers = cache(async (): Promise<Customer[]> => {
  if (isDemoMode()) return demo().customers;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("id, full_name, email, phone, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.full_name || r.email, email: r.email, phone: r.phone, createdAt: r.created_at }));
});

/** All products including drafts/archived (staff view). */
export const getAdminProducts = cache(async (): Promise<Product[]> => {
  if (isDemoMode()) return demoProducts;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
});

export interface AdminNotification {
  id: string;
  kind: "new_order" | "custom_request" | "low_inventory" | "payment_failed" | "awaiting_production" | "pickup_waiting" | "reconciliation_needed";
  title: string;
  body?: string;
  link: string;
  createdAt: string;
}

/**
 * Notifications are derived from live records so they can never drift from
 * reality: recent orders, open custom requests, low stock, failed payments,
 * orders awaiting production and pickups waiting.
 */
export async function getNotifications(): Promise<AdminNotification[]> {
  const [orders, products] = await Promise.all([getAllOrders(), getAdminProducts()]);
  const now = dashboardNow().getTime();
  const out: AdminNotification[] = [];
  for (const o of orders) {
    const age = now - new Date(o.createdAt).getTime();
    if (o.paymentStatus === "paid" && age < 2 * 86400000)
      out.push({ id: `n-new-${o.id}`, kind: "new_order", title: `New order ${o.orderNumber}`, body: o.customerName, link: `/admin/orders/${o.id}`, createdAt: o.createdAt });
    if (o.fulfillmentStatus === "request_received" || o.fulfillmentStatus === "quote_pending")
      out.push({ id: `n-req-${o.id}`, kind: "custom_request", title: `Custom request ${o.orderNumber}`, body: `${o.customerName} is waiting for a quote`, link: `/admin/custom-orders`, createdAt: o.createdAt });
    if (o.paymentStatus === "failed" && age < 7 * 86400000)
      out.push({ id: `n-fail-${o.id}`, kind: "payment_failed", title: `Payment failed on ${o.orderNumber}`, link: `/admin/orders/${o.id}`, createdAt: o.createdAt });
    if (o.paymentStatus === "requires_reconciliation")
      out.push({ id: `n-rec-${o.id}`, kind: "reconciliation_needed", title: `Reconcile payment on ${o.orderNumber}`, link: `/admin/payments`, createdAt: o.createdAt });
    if (o.paymentStatus === "paid" && (o.fulfillmentStatus === "design_review" || o.fulfillmentStatus === "approved"))
      out.push({ id: `n-prod-${o.id}`, kind: "awaiting_production", title: `${o.orderNumber} is awaiting production`, link: `/admin/orders/${o.id}`, createdAt: o.createdAt });
    if (o.fulfillmentStatus === "ready_for_pickup")
      out.push({ id: `n-pick-${o.id}`, kind: "pickup_waiting", title: `${o.orderNumber} is ready for pickup`, body: o.customerName, link: `/admin/orders/${o.id}`, createdAt: o.createdAt });
  }
  for (const p of products) {
    for (const v of p.variants) {
      const avail = availableStock(v);
      if (avail !== null && v.isActive && avail <= v.lowStockThreshold)
        out.push({ id: `n-low-${v.id}`, kind: "low_inventory", title: `Low stock: ${p.name}${v.size ? ` (${[v.color, v.size].filter(Boolean).join(" / ")})` : ""}`, body: `${avail} available`, link: `/admin/inventory`, createdAt: dashboardNow().toISOString() });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}
