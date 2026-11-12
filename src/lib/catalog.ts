import { startingPrice } from "./pricing";
import type { Product, ProductVariant } from "./types";

export function availableStock(v: ProductVariant): number | null {
  if (v.stockQuantity === null) return null;
  return Math.max(0, v.stockQuantity - v.reservedQuantity);
}

/** A product is in stock if any active variant has free stock, or it's made to order. */
export function isInStock(product: Product): boolean {
  if (product.status === "out_of_stock") return product.fulfillmentType !== "ready_made" && canMakeToOrder(product);
  return product.variants.some((v) => v.isActive && (availableStock(v) === null || (availableStock(v) ?? 0) > 0)) || canMakeToOrder(product);
}

export function canMakeToOrder(product: Product): boolean {
  return product.fulfillmentType === "custom" || product.fulfillmentType === "both";
}

export function isReadyToShip(product: Product): boolean {
  return (
    product.fulfillmentType !== "custom" &&
    product.variants.some((v) => v.isActive && v.stockQuantity !== null && (availableStock(v) ?? 0) > 0)
  );
}

export function productionEstimate(product: Product): string | null {
  if (product.productionDaysMin == null) return null;
  if (product.productionDaysMax == null || product.productionDaysMax === product.productionDaysMin)
    return `${product.productionDaysMin} business days`;
  return `${product.productionDaysMin}–${product.productionDaysMax} business days`;
}

export type SortKey = "newest" | "price_asc" | "price_desc" | "name" | "popular";

export interface CatalogQuery {
  q?: string;
  category?: string; // category id
  minCents?: number;
  maxCents?: number;
  type?: "ready_made" | "custom";
  inStock?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export function queryCatalog(products: Product[], query: CatalogQuery) {
  const q = query.q?.trim().toLowerCase();
  let list = products.filter((p) => p.status === "active" || p.status === "out_of_stock");
  if (q) list = list.filter((p) => `${p.name} ${p.shortDescription} ${p.description}`.toLowerCase().includes(q));
  if (query.category) list = list.filter((p) => p.categoryIds.includes(query.category!));
  if (query.minCents != null) list = list.filter((p) => startingPrice(p) >= query.minCents!);
  if (query.maxCents != null) list = list.filter((p) => startingPrice(p) <= query.maxCents!);
  if (query.type === "ready_made") list = list.filter((p) => p.fulfillmentType !== "custom");
  if (query.type === "custom") list = list.filter((p) => p.fulfillmentType !== "ready_made");
  if (query.inStock) list = list.filter(isInStock);

  const sort = query.sort ?? "newest";
  list = [...list].sort((a, b) => {
    switch (sort) {
      case "price_asc": return startingPrice(a) - startingPrice(b);
      case "price_desc": return startingPrice(b) - startingPrice(a);
      case "name": return a.name.localeCompare(b.name);
      case "popular": return b.unitsSold - a.unitsSold;
      default: return b.createdAt.localeCompare(a.createdAt);
    }
  });
  const pageSize = query.pageSize ?? 12;
  const page = Math.max(1, query.page ?? 1);
  const total = list.length;
  return { items: list.slice(0, page * pageSize), total, hasMore: page * pageSize < total, page };
}

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function parseCatalogQuery(sp: SP, fixedCategoryId?: string): CatalogQuery {
  const dollars = (v?: string) => (v && /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(parseFloat(v) * 100) : undefined);
  const sort = one(sp.sort) as SortKey | undefined;
  const type = one(sp.type);
  return {
    q: one(sp.q)?.slice(0, 80),
    category: fixedCategoryId ?? (one(sp.category) || undefined),
    minCents: dollars(one(sp.min)),
    maxCents: dollars(one(sp.max)),
    type: type === "ready_made" || type === "custom" ? type : undefined,
    inStock: one(sp.in_stock) === "1",
    sort: sort && ["newest", "price_asc", "price_desc", "name", "popular"].includes(sort) ? sort : "newest",
    page: Math.min(50, Math.max(1, parseInt(one(sp.page) ?? "1", 10) || 1)),
  };
}

