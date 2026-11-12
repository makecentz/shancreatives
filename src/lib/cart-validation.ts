import { z } from "zod";
import { availableStock } from "./catalog";
import { applyDiscount, type Discount } from "./discounts";
import type { Cents } from "./money";
import { percentOf } from "./money";
import { PricingError, priceLine } from "./pricing";
import type { Product } from "./types";

export const cartLineSchema = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64).nullable(),
  quantity: z.number().int().min(1).max(50),
  customize: z.boolean(),
  rush: z.boolean().default(false),
  selections: z.record(z.string().max(64), z.union([z.string().max(1000), z.array(z.string().max(64)).max(20)])).default({}),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(40),
  discountCode: z.string().trim().max(40).optional().nullable(),
});

export interface ValidatedLine {
  index: number;
  product: Product;
  variantId: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPriceCents: Cents;
  customizationCents: Cents;
  rushCents: Cents;
  lineTotalCents: Cents;
  isCustom: boolean;
  snapshot: Record<string, string | string[]>;
  uploadIds: string[];
}

export interface CartValidation {
  lines: ValidatedLine[];
  errors: { index: number; message: string }[];
  subtotalCents: Cents;
  discountCents: Cents;
  discountMessage: string | null;
  discountCode: string | null;
  requiresQuote: boolean;
}

/**
 * Server-authoritative cart pricing and stock check. Takes only identifiers and
 * selections from the client; every number comes from catalogue records.
 */
export function validateCart(
  input: z.infer<typeof cartSchema>,
  products: Product[],
  discount: Discount | undefined,
  opts: { now?: Date; customerUses?: number } = {},
): CartValidation {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: ValidatedLine[] = [];
  const errors: { index: number; message: string }[] = [];
  const demand = new Map<string, number>();
  let requiresQuote = false;

  input.lines.forEach((l, index) => {
    const product = byId.get(l.productId);
    if (!product) return errors.push({ index, message: "This item is no longer available." });
    if (product.quoteOnly) {
      requiresQuote = true;
      return errors.push({ index, message: `${product.name} needs a quote before purchase.` });
    }
    const variant = l.variantId ? product.variants.find((v) => v.id === l.variantId) ?? null : null;
    if (l.variantId && !variant) return errors.push({ index, message: `The selected option for ${product.name} is no longer available.` });
    try {
      const priced = priceLine(product, variant, l.quantity, { customize: l.customize, selections: l.selections, rush: l.rush });
      if (!priced.isCustom && variant) {
        const avail = availableStock(variant);
        const want = (demand.get(variant.id) ?? 0) + l.quantity;
        if (avail !== null && want > avail) {
          return errors.push({ index, message: avail === 0 ? `${product.name} is sold out.` : `Only ${avail} of ${product.name} available.` });
        }
        demand.set(variant.id, want);
      }
      const uploadIds = product.customizationFields
        .filter((f) => f.type === "file" && typeof l.selections[f.key] === "string")
        .map((f) => l.selections[f.key] as string);
      lines.push({
        index,
        product,
        variantId: variant?.id ?? null,
        sku: variant?.sku ?? null,
        size: variant?.size ?? null,
        color: variant?.color ?? null,
        quantity: l.quantity,
        unitPriceCents: priced.unitPriceCents,
        customizationCents: priced.customizationCents,
        rushCents: priced.rushCents,
        lineTotalCents: priced.lineTotalCents,
        isCustom: priced.isCustom,
        snapshot: priced.snapshot,
        uploadIds,
      });
    } catch (e) {
      errors.push({ index, message: e instanceof PricingError ? e.message : "This item couldn't be priced." });
    }
  });

  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  let discountCents = 0;
  let discountMessage: string | null = null;
  let discountCode: string | null = null;
  if (input.discountCode) {
    const r = applyDiscount(discount, lines.map((l) => ({ productId: l.product.id, lineTotalCents: l.lineTotalCents })), opts);
    if (r.ok) {
      discountCents = r.amountCents;
      discountCode = r.discount.code;
    } else discountMessage = r.reason;
  }
  return { lines, errors, subtotalCents, discountCents, discountMessage, discountCode, requiresQuote };
}

export interface ShippingRate {
  id: string;
  name: string;
  amountCents: Cents;
  freeOverCents: Cents | null;
  minDays: number | null;
  maxDays: number | null;
}

export function shippingFor(rate: ShippingRate | null, merchandiseCents: Cents): Cents {
  if (!rate) return 0;
  if (rate.freeOverCents != null && merchandiseCents >= rate.freeOverCents) return 0;
  return rate.amountCents;
}

/** Order totals. Tax rate comes from the tax_settings table (owner-configured), never hardcoded. */
export function orderTotals(v: Pick<CartValidation, "subtotalCents" | "discountCents">, shippingCents: Cents, tax: { rateBps: number; taxShipping: boolean }) {
  const taxable = v.subtotalCents - v.discountCents + (tax.taxShipping ? shippingCents : 0);
  const taxCents = percentOf(Math.max(0, taxable), tax.rateBps);
  const totalCents = v.subtotalCents - v.discountCents + shippingCents + taxCents;
  return { subtotalCents: v.subtotalCents, discountCents: v.discountCents, shippingCents, taxCents, totalCents };
}
