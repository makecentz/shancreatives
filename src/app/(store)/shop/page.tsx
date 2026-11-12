import type { Metadata } from "next";
import { CatalogView } from "@/components/store/catalog-view";
import { Container } from "@/components/store/section";
import { getStoreCategories, getStoreProducts } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop custom shirts, crochet dolls, and handmade gifts from Shagannan Shenanigans.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const [sp, products, categories] = await Promise.all([searchParams, getStoreProducts(), getStoreCategories()]);
  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">The shop</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">Shop all creations</h1>
        <p className="mt-3 text-store-muted">Ready-to-ship favorites and made-to-order pieces you can make your own.</p>
      </header>
      <CatalogView products={products} categories={categories} sp={sp} basePath="/shop" />
    </Container>
  );
}
