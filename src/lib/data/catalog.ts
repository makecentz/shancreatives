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

export const getCategoryBySlug = cache(async (slug: string) => (await getCategories()).find((c) => c.slug === slug) ?? null);

/** Public catalogue (active + out-of-stock products). RLS hides drafts and archives. */
export const getProducts = cache(async (): Promise<Product[]> => {
  if (isDemoMode()) return demoProducts.filter((p) => p.status === "active" || p.status === "out_of_stock");
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).in("status", ["active", "out_of_stock"]);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  if (isDemoMode()) return demoProducts.find((p) => p.slug === slug) ?? null;
  const sb = await supabaseServer();
  const { data, error } = await sb.from("products").select(PRODUCT_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data) : null;
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
  return (await getProducts()).filter((p) => p.isFeatured).slice(0, limit);
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const all = await getProducts();
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
