import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ProductCard } from "@/components/store/product-card";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { Container } from "@/components/store/section";
import { isInStock, productionEstimate } from "@/lib/catalog";
import { getProductBySlug, getRelatedProducts, getStoreCategories } from "@/lib/data/catalog";
import { isDemoMode, siteUrl } from "@/lib/env";
import { startingPrice } from "@/lib/pricing";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const title = p.seoTitle ?? p.name;
  const description = p.seoDescription ?? p.shortDescription;
  const image = p.media[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title, description, images: image ? [{ url: image, alt: p.media[0].alt }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || (product.status !== "active" && product.status !== "out_of_stock")) notFound();
  const [related, categories] = await Promise.all([getRelatedProducts(product), getStoreCategories()]);
  const primaryCategory = categories.find((c) => product.categoryIds.includes(c.id));
  const estimate = productionEstimate(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.media.map((m) => new URL(m.url, siteUrl()).toString()),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Shagannan Shenanigans" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (startingPrice(product) / 100).toFixed(2),
      availability: isInStock(product) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/products/${product.slug}`, siteUrl()).toString(),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-store-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-store-ink">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/shop" className="hover:text-store-ink">Shop</Link></li>
            {primaryCategory ? (<><li aria-hidden>/</li><li><Link href={`/collections/${primaryCategory.slug}`} className="hover:text-store-ink">{primaryCategory.name}</Link></li></>) : null}
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-store-ink">{product.name}</li>
          </ol>
        </nav>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery media={product.media} />
          </div>
          <div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {product.fulfillmentType !== "ready_made" ? <Badge tone="tan">Customizable</Badge> : null}
              {product.fulfillmentType !== "custom" ? <Badge>Ready made</Badge> : null}
              {product.isSeasonal ? <Badge tone="outline">Seasonal</Badge> : null}
              {product.isDemo ? <Badge tone="outline">Sample product</Badge> : null}
            </div>
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight sm:text-[42px]">{product.name}</h1>
            <p className="mt-3 text-base text-store-muted">{product.shortDescription}</p>
            <div className="mt-8">
              <ProductPurchase product={product} productionEstimate={estimate} demo={isDemoMode()} sample={!!product.isDemo && !isDemoMode()} />
            </div>
            <div className="mt-10 border-t border-store-border pt-8">
              <h2 className="font-heading text-lg font-bold">Details</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-store-muted">
                {product.description.split("\n").map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {estimate ? <p className="mt-4 text-sm"><span className="font-semibold">Production time:</span> <span className="text-store-muted">{estimate} after your design is approved.</span></p> : null}
            </div>
          </div>
        </div>
      </Container>
      {related.length ? (
        <Container className="py-16">
          <h2 className="mb-8 font-heading text-2xl font-bold sm:text-3xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Container>
      ) : null}
    </>
  );
}
