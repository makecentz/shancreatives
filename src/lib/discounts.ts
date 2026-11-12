import { percentOf, type Cents } from "./money";

export interface Discount {
  id: string;
  code: string;
  kind: "percentage" | "fixed";
  /** basis points for percentage (1000 = 10%), cents for fixed */
  value: number;
  productIds: string[] | null;
  minSubtotalCents: Cents;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface DiscountLine {
  productId: string;
  lineTotalCents: Cents;
}

export type DiscountResult =
  | { ok: true; amountCents: Cents; discount: Discount }
  | { ok: false; reason: string };

/** Server-side discount validation. Never trust a discount amount from the client. */
export function applyDiscount(
  discount: Discount | undefined,
  lines: DiscountLine[],
  opts: { now?: Date; customerUses?: number } = {},
): DiscountResult {
  const now = opts.now ?? new Date();
  if (!discount || !discount.isActive) return { ok: false, reason: "That code isn't valid." };
  if (discount.startsAt && new Date(discount.startsAt) > now) return { ok: false, reason: "That code isn't active yet." };
  if (discount.endsAt && new Date(discount.endsAt) <= now) return { ok: false, reason: "That code has expired." };
  if (discount.usageLimit != null && discount.usageCount >= discount.usageLimit) return { ok: false, reason: "That code has reached its usage limit." };
  if (discount.perCustomerLimit != null && (opts.customerUses ?? 0) >= discount.perCustomerLimit)
    return { ok: false, reason: "You've already used this code." };

  const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  if (subtotal < discount.minSubtotalCents) return { ok: false, reason: `This code needs a subtotal of at least $${(discount.minSubtotalCents / 100).toFixed(2)}.` };

  const eligible = discount.productIds?.length ? lines.filter((l) => discount.productIds!.includes(l.productId)) : lines;
  const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotalCents, 0);
  if (eligibleTotal === 0) return { ok: false, reason: "That code doesn't apply to the items in your cart." };

  let amount = discount.kind === "percentage" ? percentOf(eligibleTotal, Math.min(10000, Math.max(0, discount.value))) : Math.max(0, discount.value);
  // Never discount more than the eligible merchandise total.
  amount = Math.min(amount, eligibleTotal);
  return { ok: true, amountCents: amount, discount };
}
