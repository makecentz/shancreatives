"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";
import { variantUnitPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { useCart } from "./cart-context";

export function QuickAdd({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = React.useState(false);
  const v = product.variants[0];
  return (
    <button
      type="button"
      onClick={() => {
        add({
          productId: product.id,
          variantId: v?.id ?? null,
          quantity: 1,
          customize: false,
          rush: false,
          selections: {},
          display: { name: product.name, slug: product.slug, imageUrl: product.media[0]?.url ?? null, variantLabel: null, unitPriceCents: variantUnitPrice(product, v ?? null), selectionSummary: [] },
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-store-ink px-4 text-xs font-medium text-white hover:bg-black"
    >
      {added ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {added ? "Added" : "Add to cart"}
    </button>
  );
}
