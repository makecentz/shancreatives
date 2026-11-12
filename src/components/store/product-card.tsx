import Link from "next/link";
import { isInStock, isReadyToShip } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { hasPriceRange, startingPrice, variantCompareAtPrice } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickAdd } from "./quick-add";

export function Badge({ children, tone = "cream" }: { children: React.ReactNode; tone?: "cream" | "ink" | "tan" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        tone === "cream" && "bg-white/90 text-store-ink ring-1 ring-store-border",
        tone === "ink" && "bg-store-ink text-white",
        tone === "tan" && "bg-store-tan text-store-ink",
        tone === "outline" && "border border-store-border bg-white text-store-muted",
      )}
    >
      {children}
    </span>
  );
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const img = product.media[0];
  const price = startingPrice(product);
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;
  const compareAt = variantCompareAtPrice(product, singleVariant ?? product.variants[0] ?? null);
  const customizable = product.fulfillmentType !== "ready_made";
  const ready = isReadyToShip(product);
  const inStock = isInStock(product);
  const canQuickAdd = !product.isDemo && (product.fulfillmentType === "ready_made" && singleVariant && inStock);

  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${product.slug}`} className="relative block overflow-hidden rounded-2xl bg-store-cream">
        <div className="aspect-[4/5] w-full">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.url}
              alt={img.alt}
              loading={priority ? "eager" : "lazy"}
              className="h-full w-full object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : null}
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.salePriceCents != null || compareAt ? <Badge tone="ink">Sale</Badge> : null}
          {customizable ? <Badge tone="tan">Customizable</Badge> : null}
          {ready ? <Badge>Ready to ship</Badge> : null}
          {!inStock ? <Badge tone="outline">Sold out</Badge> : null}
        </div>
        {product.isDemo ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-store-muted">Sample product</span>
        ) : null}
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <h3 className="font-heading text-[15px] font-semibold leading-snug text-store-ink">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] md:after:hidden">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-store-muted">{product.shortDescription}</p>
        <div className="mt-2 flex items-baseline gap-2 text-sm">
          {product.quoteOnly ? (
            <span className="font-semibold text-store-ink">From {formatMoney(price)} &middot; by quote</span>
          ) : (
            <>
              <span className="font-semibold text-store-ink">
                {hasPriceRange(product) ? "From " : ""}
                {formatMoney(price)}
              </span>
              {compareAt ? <span className="text-store-muted line-through">{formatMoney(compareAt)}</span> : null}
            </>
          )}
        </div>
        <div className="relative z-10 mt-4 flex items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {canQuickAdd ? <QuickAdd product={product} /> : null}
          <Link
            href={`/products/${product.slug}`}
            className="inline-flex h-9 items-center rounded-full border border-store-ink px-4 text-xs font-medium text-store-ink transition-colors hover:bg-store-ink hover:text-white"
          >
            {customizable ? "Customize" : "View product"}
          </Link>
        </div>
      </div>
    </article>
  );
}
