import type { Order, Product, ProductVariant } from "@/lib/types";

export function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return { id: "v1", sku: "SKU-1", size: "M", color: "Black", priceCents: null, salePriceCents: null, stockQuantity: 5, reservedQuantity: 0, lowStockThreshold: 2, isActive: true, ...over };
}

export function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1", slug: "tee", name: "Tee", shortDescription: "", description: "", status: "active", fulfillmentType: "both", customizerKind: "shirt",
    categoryIds: ["c1"], basePriceCents: 2500, salePriceCents: null, productionDaysMin: 5, productionDaysMax: 7, quoteOnly: false,
    rushAvailable: true, rushFeeCents: 1000, isFeatured: false, isSeasonal: false, seoTitle: null, seoDescription: null, media: [],
    variants: [variant()],
    customizationFields: [
      { id: "f1", key: "text", label: "Custom text", type: "text", required: true, maxLength: 10, priceDeltaCents: 500, options: [], sortOrder: 1 },
      { id: "f2", key: "color", label: "Ink", type: "select", required: false, priceDeltaCents: 0, sortOrder: 2, options: [{ value: "gold", label: "Gold", priceDeltaCents: 300 }, { value: "white", label: "White", priceDeltaCents: 0 }] },
      { id: "f3", key: "extras", label: "Extras", type: "multi_select", required: false, priceDeltaCents: 0, sortOrder: 3, options: [{ value: "back", label: "Back print", priceDeltaCents: 700 }, { value: "sleeve", label: "Sleeve", priceDeltaCents: 400 }] },
    ],
    createdAt: "2026-01-01T00:00:00Z", unitsSold: 0,
    ...over,
  };
}

let n = 0;
export function order(over: Partial<Order> = {}): Order {
  n++;
  return {
    id: `o${n}`, orderNumber: `SS-${n}`, customerId: "u1", customerName: "A", customerEmail: "a@example.com",
    items: [{ id: `i${n}`, productId: "p1", productName: "Tee", productSlug: "tee", imageUrl: null, variantId: "v1", sku: "SKU-1", size: "M", color: "Black", quantity: 1, unitPriceCents: 2500, customizationCents: 0, lineTotalCents: 2500, isCustom: false, customization: {}, categoryIds: ["c1"] }],
    subtotalCents: 2500, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 2500, refundedCents: 0,
    paymentStatus: "paid", paymentProvider: "stripe", fulfillmentStatus: "paid", deliveryMethod: "shipping", isCustomOrder: false,
    createdAt: "2026-11-10T12:00:00Z",
    ...over,
  };
}
