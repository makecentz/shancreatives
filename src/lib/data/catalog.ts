import "server-only";
import { cache } from "react";
import { isDemoMode } from "../env";
import { demoCategories, demoProducts } from "../demo/catalog";
import { defaultPolicies, defaultSiteContent } from "../demo/content";
import type { Category, Policy, Product, SiteContent } from "../types";
import { supabaseServer } from "../supabase/server";
import { mapCategory, mapProduct, PRODUCT_SELECT } from "./mappers";

export const getCategories = cache(async (): Promise<Category[]> => {
  if (isDemoMode()) return demoCategories;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("categories").select("*").eq("is_visible", true).order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapCategory);
});

/**
 * Sample products: the labelled demo catalogue can be shown on the live store
 * (Admin → Products → "Show sample products") so the shop doesn't look empty
 * while real products are added. Samples are never in the database, so they
 * can't be bought: checkout and cart validation only read real products
 * (getProductsByIds), and the product page disables purchase for them.
 * Defaults to on until the owner turns it off.
 */
export const getSampleProductsEnabled = cache(async (): Promise<boolean> => {
  if (isDemoMode()) return false; // demo mode already shows the samples
  const sb = await supabaseServer();
  const { data } = await sb.from("site_content").select("published").eq("key", "samples").maybeSingle();
  const enabled = (data?.published as { enabled?: boolean } | null)?.enabled;
  return enabled ?? true;
});

const activeSamples = () => demoProducts.filter((p) => p.status === "active" || p.status === "out_of_stock");

/** Storefront categories: real ones, plus sample categories while samples are shown. */
export const getStoreCategories = cache(async (): Promise<Category[]> => {
  const real = await getCategories();
  if (!(await getSampleProductsEnabled())) return real;
  const slugs = new Set(real.map((c) => c.slug));
  return [...real, ...demoCategories.filter((c) => !slugs.has(c.slug))];
});

export const getCategoryBySlug = cache(async (slug: string) => (await getStoreCategories()).find((c) => c.slug === slug) ?? null);

/** Public catalogue (active + out-of-stock products). RLS hides drafts and archives. */
export const getProducts = cache(async (): Promise<Product[]> => {
  if (isDemoMode()) return demoProducts.filter((p) => p.status === "active" || p.status === "out_of_stock");
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).in("status", ["active", "out_of_stock"]);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
});

/** Storefront catalogue: real products, plus labelled samples while samples are shown. */
export const getStoreProducts = cache(async (): Promise<Product[]> => {
  const real = await getProducts();
  if (!(await getSampleProductsEnabled())) return real;
  const slugs = new Set(real.map((p) => p.slug));
  return [...real, ...activeSamples().filter((p) => !slugs.has(p.slug))];
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  if (isDemoMode()) return demoProducts.find((p) => p.slug === slug) ?? null;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (data) return mapProduct(data);
  if (await getSampleProductsEnabled()) return activeSamples().find((p) => p.slug === slug) ?? null;
  return null;
});

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  if (isDemoMode()) return demoProducts.filter((p) => ids.includes(p.id));
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).in("id", ids);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function getFeaturedProducts(limit = 8) {
  return (await getStoreProducts()).filter((p) => p.isFeatured).slice(0, limit);
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const all = await getStoreProducts();
  return all
    .filter((p) => p.id !== product.id && p.categoryIds.some((c) => product.categoryIds.includes(c)))
    .slice(0, limit);
}

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  if (isDemoMode()) return defaultSiteContent;
  const sb = await supabaseServer();
  const { data } = await sb.from("site_content").select("published").eq("key", "site").maybeSingle();
  return { ...defaultSiteContent, ...((data?.published as Partial<SiteContent>) ?? {}) };
});

export async function getPolicy(slug: string): Promise<Policy | null> {
  const fallback = defaultPolicies.find((p) => p.slug === slug) ?? null;
  if (isDemoMode()) return fallback;
  const sb = await supabaseServer();
  const { data } = await sb.from("site_content").select("published").eq("key", `policy:${slug}`).maybeSingle();
  const pub = data?.published as Partial<Policy> | undefined;
  return pub?.body ? { slug, title: pub.title ?? fallback?.title ?? slug, body: pub.body } : fallback;
}
