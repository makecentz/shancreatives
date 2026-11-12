import type { Product } from "../types";
import type { ProductFormValues } from "./product-schema";

export function emptyProduct(): ProductFormValues {
  return {
    name: "", slug: "", shortDescription: "", description: "", status: "draft", fulfillmentType: "ready_made", customizerKind: "",
    categoryIds: [], basePriceCents: 0, salePriceCents: null, productionDaysMin: null, productionDaysMax: null, quoteOnly: false,
    rushAvailable: false, rushFeeCents: 0, isFeatured: false, isSeasonal: false, seoTitle: "", seoDescription: "", media: [],
    variants: [{ sku: "", size: "", color: "", priceCents: null, salePriceCents: null, stockQuantity: 0, lowStockThreshold: 3, isActive: true }],
    fields: [],
  };
}

export function productToForm(p: Product): ProductFormValues {
  return {
    id: p.id, name: p.name, slug: p.slug, shortDescription: p.shortDescription, description: p.description, status: p.status,
    fulfillmentType: p.fulfillmentType, customizerKind: p.customizerKind ?? "", categoryIds: p.categoryIds,
    basePriceCents: p.basePriceCents, salePriceCents: p.salePriceCents, productionDaysMin: p.productionDaysMin, productionDaysMax: p.productionDaysMax,
    quoteOnly: p.quoteOnly, rushAvailable: p.rushAvailable, rushFeeCents: p.rushFeeCents, isFeatured: p.isFeatured, isSeasonal: p.isSeasonal,
    seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    media: p.media.map((m) => ({ path: m.url, alt: m.alt })),
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size ?? "", color: v.color ?? "", priceCents: v.priceCents, salePriceCents: v.salePriceCents, stockQuantity: v.stockQuantity, lowStockThreshold: v.lowStockThreshold, isActive: v.isActive })),
    fields: p.customizationFields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, helpText: f.helpText ?? "", priceDeltaCents: f.priceDeltaCents, maxLength: f.maxLength ?? null, options: f.options.map((o) => ({ value: o.value, label: o.label, priceDeltaCents: o.priceDeltaCents, swatch: o.swatch })) })),
  };
}
