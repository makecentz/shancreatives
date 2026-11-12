"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, audit, guard, run, type ActionResult } from "@/lib/admin/actions-core";
import { supabaseAdmin } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  if (!Number.isFinite(n) || n < 0) throw new ActionError("Enter a valid amount.");
  return n;
};

export async function adjustStock(variantId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { db } = await guard("inventory.manage");
    const change = parseInt(String(form.get("change")), 10);
    const reason = z.enum(["adjustment", "restock", "return", "damage", "correction"]).parse(form.get("reason"));
    if (!Number.isInteger(change) || change === 0) throw new ActionError("Enter a non-zero whole number.");
    const { data, error } = await db.rpc("adjust_stock", { p_variant_id: variantId, p_change: change, p_reason: reason, p_note: String(form.get("note") ?? "") || null });
    if (error) throw new ActionError(error.message);
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock is now ${data}` };
  });
}

export async function saveCategory(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("products.manage");
    const name = z.string().trim().min(2).max(80).parse(form.get("name"));
    const row = { name, slug: slugify(String(form.get("slug") || name)), description: String(form.get("description") ?? "").slice(0, 300), sort_order: parseInt(String(form.get("sort_order") ?? "0"), 10) || 0, is_visible: form.get("is_visible") === "on" };
    const id = String(form.get("id") ?? "");
    const { error } = id ? await db.from("categories").update(row).eq("id", id) : await db.from("categories").insert(row);
    if (error) throw new ActionError(error.code === "23505" ? "That slug is already used." : error.message);
    await audit(session, id ? "category.update" : "category.create", "category", id || row.slug);
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category saved" };
  });
}

export async function saveDiscount(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("discounts.manage");
    const kind = z.enum(["percentage", "fixed"]).parse(form.get("kind"));
    const raw = parseFloat(String(form.get("value")));
    if (!(raw > 0)) throw new ActionError("Enter a discount value.");
    const value = kind === "percentage" ? Math.round(raw * 100) : Math.round(raw * 100); // bps or cents
    if (kind === "percentage" && value > 10000) throw new ActionError("Percentage can't exceed 100%.");
    const code = z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes only").parse(form.get("code")).toUpperCase();
    const productIds = String(form.get("product_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const row = {
      code, kind, value,
      product_ids: productIds.length ? productIds : null,
      min_subtotal_cents: money(form.get("min_subtotal")) ?? 0,
      usage_limit: form.get("usage_limit") ? parseInt(String(form.get("usage_limit")), 10) : null,
      per_customer_limit: form.get("per_customer_limit") ? parseInt(String(form.get("per_customer_limit")), 10) : null,
      starts_at: form.get("starts_at") ? new Date(String(form.get("starts_at"))).toISOString() : null,
      ends_at: form.get("ends_at") ? new Date(String(form.get("ends_at"))).toISOString() : null,
      is_active: true,
    };
    const { error } = await db.from("discounts").insert(row);
    if (error) throw new ActionError(error.code === "23505" ? "That code already exists." : error.message);
    await audit(session, "discount.create", "discount", code, null, row);
    revalidatePath("/admin/discounts");
    return { ok: true, message: `Code ${code} created` };
  });
}

export async function toggleDiscount(id: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("discounts.manage");
    const active = form.get("active") === "true";
    const { error } = await db.from("discounts").update({ is_active: active }).eq("id", id);
    if (error) throw error;
    await audit(session, active ? "discount.enable" : "discount.disable", "discount", id);
    revalidatePath("/admin/discounts");
    return { ok: true, message: active ? "Enabled" : "Disabled" };
  });
}

export async function saveShippingRate(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("shipping.manage");
    const row = {
      name: z.string().trim().min(2).max(80).parse(form.get("name")),
      amount_cents: money(form.get("amount")) ?? 0,
      free_over_cents: money(form.get("free_over")),
      min_days: form.get("min_days") ? parseInt(String(form.get("min_days")), 10) : null,
      max_days: form.get("max_days") ? parseInt(String(form.get("max_days")), 10) : null,
      is_active: true,
    };
    const { error } = await db.from("shipping_rates").insert(row);
    if (error) throw error;
    await audit(session, "shipping_rate.create", "shipping_rate", row.name, null, row);
    revalidatePath("/admin/shipping");
    return { ok: true, message: "Shipping rate added" };
  });
}

export async function savePickupLocation(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("shipping.manage");
    const s = (k: string) => String(form.get(k) ?? "").trim();
    if (!s("name") || !s("line1") || !s("city")) throw new ActionError("Name, address and city are required.");
    const row = {
      name: s("name"),
      address: { line1: s("line1"), line2: s("line2"), city: s("city"), state: s("state"), postal_code: s("postal_code") },
      instructions: s("instructions"),
      scheduling_note: s("scheduling_note") || null,
      available_windows: s("windows").split("\n").map((w) => w.trim()).filter(Boolean),
      is_active: true,
    };
    const { error } = await db.from("pickup_locations").insert(row);
    if (error) throw error;
    await audit(session, "pickup_location.create", "pickup_location", row.name, null, row);
    revalidatePath("/admin/shipping");
    return { ok: true, message: "Pickup location added" };
  });
}

export async function deactivateRow(table: "shipping_rates" | "pickup_locations", id: string): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("shipping.manage");
    const { error } = await db.from(table).update({ is_active: false }).eq("id", id);
    if (error) throw error;
    await audit(session, `${table}.deactivate`, table, id);
    revalidatePath("/admin/shipping");
    return { ok: true, message: "Removed" };
  });
}

export async function saveTaxSettings(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("settings.manage");
    const pct = parseFloat(String(form.get("rate")));
    if (!(pct >= 0 && pct <= 30)) throw new ActionError("Enter a rate between 0 and 30%.");
    const row = { default_rate_bps: Math.round(pct * 100), tax_shipping: form.get("tax_shipping") === "on" };
    const { error } = await db.from("tax_settings").update(row).eq("id", 1);
    if (error) throw error;
    await audit(session, "tax.update", "tax_settings", "1", null, row);
    revalidatePath("/admin/settings");
    return { ok: true, message: "Tax settings saved" };
  });
}

const contentKeys = ["heroEyebrow", "heroHeadline", "heroDescription", "heroImageUrl", "promoBanner", "aboutHeadline", "aboutBody", "contactEmail", "contactPhone", "footerTagline", "logoUrl", "faviconUrl"] as const;

/** Saves the site content draft and optionally publishes it. */
export async function saveSiteContent(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("content.manage");
    const draft: Record<string, unknown> = {};
    for (const k of contentKeys) {
      const v = String(form.get(k) ?? "").trim();
      draft[k] = v || null;
    }
    draft.heroPrimaryCta = { label: String(form.get("primaryLabel") || "Shop Now"), href: String(form.get("primaryHref") || "/shop") };
    draft.heroSecondaryCta = { label: String(form.get("secondaryLabel") || "Explore Custom Creations"), href: String(form.get("secondaryHref") || "/custom-orders") };
    draft.socialLinks = { instagram: String(form.get("instagram") || "") || undefined, facebook: String(form.get("facebook") || "") || undefined, tiktok: String(form.get("tiktok") || "") || undefined, pinterest: String(form.get("pinterest") || "") || undefined };
    for (const [k, v] of Object.entries(draft)) if (v === null) delete draft[k];
    const publish = form.get("publish") === "1";
    const row: Record<string, unknown> = { key: "site", draft, updated_by: session.userId };
    if (publish) { row.published = draft; row.published_at = new Date().toISOString(); }
    const { error } = await db.from("site_content").upsert(row, { onConflict: "key" });
    if (error) throw error;
    await audit(session, publish ? "content.publish" : "content.save_draft", "site_content", "site");
    if (publish) revalidatePath("/", "layout");
    return { ok: true, message: publish ? "Published to the live site" : "Draft saved" };
  });
}

export async function savePolicy(slug: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("content.manage");
    const body = String(form.get("body") ?? "").slice(0, 20000);
    const title = String(form.get("title") ?? "").slice(0, 120);
    const payload = { title, body };
    const { error } = await db.from("site_content").upsert({ key: `policy:${slug}`, draft: payload, published: payload, published_at: new Date().toISOString(), updated_by: session.userId }, { onConflict: "key" });
    if (error) throw error;
    await audit(session, "policy.publish", "site_content", `policy:${slug}`);
    revalidatePath(`/policies/${slug}`);
    return { ok: true, message: "Policy published" };
  });
}

/** Owner invites a staff member by email and assigns a role. */
export async function inviteStaff(form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session } = await guard("staff.manage");
    const email = z.string().trim().email().parse(form.get("email"));
    const role = z.enum(["owner", "manager", "fulfillment"]).parse(form.get("role"));
    const name = String(form.get("name") ?? "").trim() || null;
    const admin = supabaseAdmin();
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name ?? "" } });
    let userId = invited?.user?.id;
    if (error) {
      // Existing user: look them up instead.
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
      if (!userId) throw new ActionError(error.message);
    }
    const { error: e2 } = await admin.from("staff_roles").upsert({ user_id: userId, role, display_name: name, is_active: true, invited_by: session.userId }, { onConflict: "user_id" });
    if (e2) throw e2;
    await audit(session, "staff.invite", "staff_role", userId!, null, { email, role });
    revalidatePath("/admin/staff");
    return { ok: true, message: `${email} added as ${role}` };
  });
}

export async function setStaffActive(userId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("staff.manage");
    if (userId === session.userId) throw new ActionError("You can't deactivate yourself.");
    const active = form.get("active") === "true";
    const { error } = await db.from("staff_roles").update({ is_active: active }).eq("user_id", userId);
    if (error) throw error;
    await audit(session, active ? "staff.activate" : "staff.deactivate", "staff_role", userId);
    revalidatePath("/admin/staff");
    return { ok: true, message: active ? "Reactivated" : "Deactivated" };
  });
}

/**
 * Owner-only manual reconciliation of a payment attempt whose result is
 * unknown. Requires the provider's payment id and a note; the database
 * function writes the audit entry and applies the result atomically.
 */
export async function reconcilePayment(attemptId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { db } = await guard("orders.refund");
    const resolution = z.enum(["succeeded", "failed"]).parse(form.get("resolution"));
    const providerPaymentId = String(form.get("provider_payment_id") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    if (!providerPaymentId || note.length < 5) throw new ActionError("Enter the provider payment id and a short note explaining how you verified it.");
    const { error } = await db.rpc("reconcile_payment", { p_attempt_id: attemptId, p_resolution: resolution, p_provider_payment_id: providerPaymentId, p_note: note });
    if (error) throw new ActionError(error.message);
    revalidatePath("/admin/payments");
    return { ok: true, message: `Marked ${resolution}` };
  });
}
