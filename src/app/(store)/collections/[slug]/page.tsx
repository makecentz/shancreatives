import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/store/catalog-view";
import { Container } from "@/components/store/section";
import { getCategoryBySlug, getStoreCategories, getStoreProducts } from "@/lib/data/catalog";

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCategoryBySlug(slug);
  if (!c) return {};
  return { title: c.name, description: c.description, alternates: { canonical: `/collections/${c.slug}` } };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, products, categories] = await Promise.all([getCategoryBySlug(slug), getStoreProducts(), getStoreCategories()]);
  if (!category) notFound();
  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">Collection</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{category.name}</h1>
        <p className="mt-3 text-store-muted">{category.description}</p>
      </header>
      <CatalogView products={products} categories={categories} sp={sp} basePath={`/collections/${category.slug}`} fixedCategoryId={category.id} />
    </Container>
  );
}
