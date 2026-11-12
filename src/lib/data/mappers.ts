import type { Category, CustomizationField, Order, Product } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Row -> domain mappers for Supabase results. Kept in one place so the
// storefront and dashboard read the same shapes in demo and live modes.

export function storagePublicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export function mapCategory(r: any): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    imageUrl: storagePublicUrl("site-assets", r.image_path),
    sortOrder: r.sort_order ?? 0,
  };
}

function mapField(f: any): CustomizationField {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    helpText: f.help_text ?? undefined,
    options: (f.options ?? []).map((o: any) => ({ value: o.value, label: o.label, priceDeltaCents: Number(o.price_delta_cents ?? 0), swatch: o.swatch })),
    priceDeltaCents: Number(f.price_delta_cents ?? 0),
    maxLength: f.max_length ?? undefined,
    sortOrder: f.sort_order ?? 0,
  };
}

export const PRODUCT_SELECT =
  "*, product_categories(category_id), product_variants(*), product_media(*), customization_fields(*)";

export function mapProduct(r: any): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortDescription: r.short_description ?? "",
    description: r.description ?? "",
    status: r.status,
    fulfillmentType: r.fulfillment_type,
    customizerKind: r.customizer_kind,
    categoryIds: (r.product_categories ?? []).map((c: any) => c.category_id),
    basePriceCents: Number(r.base_price_cents),
    salePriceCents: r.sale_price_cents == null ? null : Number(r.sale_price_cents),
    productionDaysMin: r.production_days_min,
    productionDaysMax: r.production_days_max,
    quoteOnly: r.quote_only,
    rushAvailable: r.rush_available,
    rushFeeCents: Number(r.rush_fee_cents ?? 0),
    isFeatured: r.is_featured,
    isSeasonal: r.is_seasonal,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    media: (r.product_media ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((m: any) => ({ id: m.id, url: storagePublicUrl("product-media", m.storage_path)!, alt: m.alt || r.name, sortOrder: m.sort_order })),
    variants: (r.product_variants ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((v: any) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        priceCents: v.price_cents == null ? null : Number(v.price_cents),
        salePriceCents: v.sale_price_cents == null ? null : Number(v.sale_price_cents),
        stockQuantity: v.stock_quantity,
        reservedQuantity: v.reserved_quantity,
        lowStockThreshold: v.low_stock_threshold,
        isActive: v.is_active,
      })),
    customizationFields: (r.customization_fields ?? []).map(mapField).sort((a: CustomizationField, b: CustomizationField) => a.sortOrder - b.sortOrder),
    createdAt: r.created_at,
    unitsSold: r.units_sold ?? 0,
  };
}

export const ORDER_SELECT = "*, order_items(*)";

export function mapOrder(r: any): Order {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerId: r.user_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    items: (r.order_items ?? []).map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productSlug: i.product_slug,
      imageUrl: storagePublicUrl("product-media", i.image_path),
      variantId: i.variant_id,
      sku: i.sku,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unitPriceCents: Number(i.unit_price_cents),
      customizationCents: Number(i.customization_cents) + Number(i.rush_cents ?? 0),
      lineTotalCents: Number(i.line_total_cents),
      isCustom: i.is_custom,
      customization: i.customization ?? {},
      categoryIds: i.category_ids ?? [],
    })),
    subtotalCents: Number(r.subtotal_cents),
    discountCents: Number(r.discount_cents),
    shippingCents: Number(r.shipping_cents),
    taxCents: Number(r.tax_cents),
    totalCents: Number(r.total_cents),
    refundedCents: Number(r.refunded_cents),
    paymentStatus: r.payment_status,
    paymentProvider: r.payment_provider,
    fulfillmentStatus: r.fulfillment_status,
    deliveryMethod: r.delivery_method,
    isCustomOrder: r.is_custom_order,
    createdAt: r.created_at,
  };
}
