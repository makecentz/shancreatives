import { parseCatalogQuery, queryCatalog } from "@/lib/catalog";
import { getProducts } from "@/lib/data/catalog";
import { startingPrice } from "@/lib/pricing";

/** Public, read-only catalogue search. */
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const result = queryCatalog(await getProducts(), parseCatalogQuery(sp));
  return Response.json({
    total: result.total,
    hasMore: result.hasMore,
    items: result.items.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, shortDescription: p.shortDescription, fromPriceCents: startingPrice(p),
      image: p.media[0]?.url ?? null, fulfillmentType: p.fulfillmentType, isDemo: Boolean(p.isDemo),
    })),
  });
}
