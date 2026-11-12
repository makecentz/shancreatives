import type { Cents } from "./money";
import type { CustomizationField, Product, ProductVariant } from "./types";

export type CustomizationSelections = Record<string, string | string[] | boolean | undefined>;

export interface PricedLine {
  unitPriceCents: Cents;
  customizationCents: Cents;
  rushCents: Cents;
  lineTotalCents: Cents;
  isCustom: boolean;
  /** Clean, validated snapshot of the customer's choices (labels resolved). */
  snapshot: Record<string, string | string[]>;
}

export class PricingError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "PricingError";
  }
}

/** Effective unit price for a variant: variant sale > variant price > product sale > product base. */
export function variantUnitPrice(product: Product, variant: ProductVariant | null): Cents {
  if (variant) {
    if (variant.salePriceCents != null) return variant.salePriceCents;
    if (variant.priceCents != null) return variant.priceCents;
  }
  return product.salePriceCents ?? product.basePriceCents;
}

export function variantCompareAtPrice(product: Product, variant: ProductVariant | null): Cents | null {
  const unit = variantUnitPrice(product, variant);
  const regular = variant?.priceCents ?? product.basePriceCents;
  return regular > unit ? regular : null;
}

/** Lowest available price across active variants, for "From $X" display. */
export function startingPrice(product: Product): Cents {
  const active = product.variants.filter((v) => v.isActive);
  if (!active.length) return product.salePriceCents ?? product.basePriceCents;
  return Math.min(...active.map((v) => variantUnitPrice(product, v)));
}

export function hasPriceRange(product: Product): boolean {
  const prices = new Set(product.variants.filter((v) => v.isActive).map((v) => variantUnitPrice(product, v)));
  return prices.size > 1 || product.customizationFields.some((f) => f.priceDeltaCents > 0 || f.options.some((o) => o.priceDeltaCents > 0));
}

function fieldCost(field: CustomizationField, value: CustomizationSelections[string]): { cents: Cents; snap?: string | string[] } {
  if (value === undefined || value === "" || value === false || (Array.isArray(value) && value.length === 0)) {
    if (field.required) throw new PricingError(`${field.label} is required`, field.key);
    return { cents: 0 };
  }
  switch (field.type) {
    case "select":
    case "color": {
      if (typeof value !== "string") throw new PricingError(`Invalid value for ${field.label}`, field.key);
      const opt = field.options.find((o) => o.value === value);
      if (!opt) throw new PricingError(`"${value}" is not an option for ${field.label}`, field.key);
      return { cents: opt.priceDeltaCents + field.priceDeltaCents, snap: opt.label };
    }
    case "multi_select": {
      const values = Array.isArray(value) ? value : [String(value)];
      let cents = field.priceDeltaCents;
      const labels: string[] = [];
      for (const v of new Set(values)) {
        const opt = field.options.find((o) => o.value === v);
        if (!opt) throw new PricingError(`"${v}" is not an option for ${field.label}`, field.key);
        cents += opt.priceDeltaCents;
        labels.push(opt.label);
      }
      return { cents, snap: labels };
    }
    case "text":
    case "textarea": {
      const text = String(value).trim();
      if (!text) {
        if (field.required) throw new PricingError(`${field.label} is required`, field.key);
        return { cents: 0 };
      }
      if (field.maxLength && text.length > field.maxLength) throw new PricingError(`${field.label} must be ${field.maxLength} characters or fewer`, field.key);
      return { cents: field.priceDeltaCents, snap: text };
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new PricingError(`${field.label} must be a number`, field.key);
      return { cents: field.priceDeltaCents, snap: String(n) };
    }
    case "checkbox":
      return { cents: value ? field.priceDeltaCents : 0, snap: value ? "Yes" : undefined };
    case "file":
      // value is an upload id returned by /api/uploads; ownership is checked by the caller
      if (typeof value !== "string") throw new PricingError(`Invalid upload for ${field.label}`, field.key);
      return { cents: field.priceDeltaCents, snap: value };
  }
}

/**
 * Server-authoritative price for one cart line. The client may send selections,
 * but never prices — everything is recomputed here from catalogue records.
 */
export function priceLine(
  product: Product,
  variant: ProductVariant | null,
  quantity: number,
  opts: { customize: boolean; selections?: CustomizationSelections; rush?: boolean },
): PricedLine {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new PricingError("Quantity must be between 1 and 50");
  if (product.status !== "active" && product.status !== "out_of_stock") throw new PricingError("This product is not available");
  if (product.variants.length > 0 && !variant) throw new PricingError("Please choose an option");
  if (variant && !variant.isActive) throw new PricingError("That option is no longer available");

  const isCustom = product.fulfillmentType === "custom" || (product.fulfillmentType === "both" && opts.customize);
  if (opts.customize && product.fulfillmentType === "ready_made") throw new PricingError("This product cannot be customized");

  const unit = variantUnitPrice(product, variant);
  let customizationCents = 0;
  const snapshot: Record<string, string | string[]> = {};
  if (isCustom) {
    const sel = opts.selections ?? {};
    const allowed = new Set(product.customizationFields.map((f) => f.key));
    for (const key of Object.keys(sel)) if (!allowed.has(key)) throw new PricingError(`Unknown option "${key}"`);
    for (const field of [...product.customizationFields].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const { cents, snap } = fieldCost(field, sel[field.key]);
      customizationCents += cents;
      if (snap !== undefined) snapshot[field.label] = snap;
    }
  }
  let rushCents = 0;
  if (opts.rush) {
    if (!isCustom || !product.rushAvailable) throw new PricingError("Rush production isn't available for this item");
    rushCents = product.rushFeeCents;
    snapshot["Rush production"] = "Yes";
  }
  const lineTotalCents = (unit + customizationCents + rushCents) * quantity;
  return { unitPriceCents: unit, customizationCents, rushCents, lineTotalCents, isCustom, snapshot };
}
