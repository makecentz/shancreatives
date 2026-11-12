"use server";

import { revalidatePath } from "next/cache";
import { ActionError, audit, guard, run, type ActionResult } from "@/lib/admin/actions-core";
import { productFormSchema, type ProductFormValues } from "@/lib/admin/product-schema";
import { slugify } from "@/lib/utils";

export async function saveProduct(values: ProductFormValues): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("products.manage");
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Please check the form.");
    const p = parsed.data;
    const row = {
      name: p.name,
      slug: p.slug,
      short_description: p.shortDescription,
      description: p.description,
      status: p.status,
      fulfillment_type: p.fulfillmentType,
      customizer_kind: p.customizerKind || null,
      base_price_cents: p.basePriceCents,
      sale_price_cents: p.salePriceCents,
      production_days_min: p.productionDaysMin,
      production_days_max: p.productionDaysMax,
      quote_only: p.quoteOnly,
      rush_available: p.rushAvailable,
      rush_fee_cents: p.rushFeeCents,
      is_featured: p.isFeatured,
      is_seasonal: p.isSeasonal,
      seo_title: p.seoTitle || null,
      seo_description: p.seoDescription || null,
    };
    let productId = p.id;
    if (productId) {
      const { error } = await db.from("products").update(row).eq("id", productId);
      if (error) throw new ActionError(error.code === "23505" ? "That URL slug is already used." : error.message);
    } else {
      const { data, error } = await db.from("products").insert(row).select("id").single();
      if (error || !data) throw new ActionError(error?.code === "23505" ? "That URL slug is already used." : error?.message ?? "Couldn't create product");
      productId = data.id;
    }

    // Categories
    await db.from("product_categories").delete().eq("product_id", productId);
    if (p.categoryIds.length) await db.from("product_categories").insert(p.categoryIds.map((c, i) => ({ product_id: productId, category_id: c, sort_order: i })));

    // Media (order = array order)
    await db.from("product_media").delete().eq("product_id", productId);
    if (p.media.length) await db.from("product_media").insert(p.media.map((m, i) => ({ product_id: productId, storage_path: m.path, alt: m.alt, sort_order: i })));

    // Variants: update existing, insert new, deactivate removed (never hard-delete: order history references them).
    const { data: existing } = await db.from("product_variants").select("id").eq("product_id", productId);
    const keep = new Set(p.variants.map((v) => v.id).filter(Boolean));
    for (const v of existing ?? []) if (!keep.has(v.id)) await db.from("product_variants").update({ is_active: false }).eq("id", v.id);
    for (const [i, v] of p.variants.entries()) {
      const vr = { product_id: productId, sku: v.sku, size: v.size || null, color: v.color || null, price_cents: v.priceCents, sale_price_cents: v.salePriceCents, low_stock_threshold: v.lowStockThreshold, is_active: v.isActive, sort_order: i };
      if (v.id) {
        // Stock changes go through adjust_stock() so they're recorded in inventory history.
        const { error } = await db.from("product_variants").update(vr).eq("id", v.id);
        if (error) throw new ActionError(error.message);
      } else {
        const { data, error } = await db.from("product_variants").insert({ ...vr, stock_quantity: v.stockQuantity == null ? null : 0 }).select("id").single();
        if (error || !data) throw new ActionError(error?.code === "23505" ? `SKU ${v.sku} already exists.` : error?.message ?? "Variant error");
        if (v.stockQuantity) await db.rpc("adjust_stock", { p_variant_id: data.id, p_change: v.stockQuantity, p_reason: "initial", p_note: "Initial stock" });
      }
    }

    // Customization fields: replace set
    await db.from("customization_fields").delete().eq("product_id", productId);
    if (p.fields.length)
      await db.from("customization_fields").insert(
        p.fields.map((f, i) => ({
          product_id: productId, key: f.key, label: f.label, type: f.type, required: f.required, help_text: f.helpText || null,
          price_delta_cents: f.priceDeltaCents, max_length: f.maxLength, sort_order: i,
          options: f.options.map((o) => ({ value: o.value || slugify(o.label).replace(/-/g, "_"), label: o.label, price_delta_cents: o.priceDeltaCents, swatch: o.swatch })),
        })),
      );

    await audit(session, p.id ? "product.update" : "product.create", "product", productId!, null, { name: p.name, status: p.status });
    revalidatePath("/admin/products");
    revalidatePath(`/products/${p.slug}`);
    revalidatePath("/shop");
    return { ok: true, message: "Product saved", id: productId };
  });
}

export async function setProductStatus(productId: string, status: "draft" | "active" | "archived"): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("products.manage");
    const { error } = await db.from("products").update({ status }).eq("id", productId);
    if (error) throw error;
    await audit(session, `product.${status}`, "product", productId);
    revalidatePath("/admin/products");
    return { ok: true, message: `Product ${status === "archived" ? "archived" : status === "active" ? "published" : "unpublished"}` };
  });
}

export async function setProductStatusFromForm(productId: string, form: FormData) {
  return setProductStatus(productId, String(form.get("status")) as "draft" | "active" | "archived");
}
