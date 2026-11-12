import { cartSchema, validateCart } from "@/lib/cart-validation";
import { getProductsByIds } from "@/lib/data/catalog";
import { getDiscountByCode } from "@/lib/data/settings";
import { limitOrResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = limitOrResponse(req, "cart-validate", 60);
  if (limited) return limited;
  const parsed = cartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid cart" }, { status: 400 });
  const products = await getProductsByIds([...new Set(parsed.data.lines.map((l) => l.productId))]);
  const discount = await getDiscountByCode(parsed.data.discountCode);
  const v = validateCart(parsed.data, products, discount);
  return Response.json({
    lines: v.lines.map((l) => ({
      index: l.index,
      unitPriceCents: l.unitPriceCents + l.customizationCents + l.rushCents,
      lineTotalCents: l.lineTotalCents,
      isCustom: l.isCustom,
    })),
    errors: v.errors,
    subtotalCents: v.subtotalCents,
    discountCents: v.discountCents,
    discountCode: v.discountCode,
    discountMessage: v.discountMessage,
  });
}
