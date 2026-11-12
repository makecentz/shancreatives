import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/store/section";
import { getProducts } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { startingPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Custom Orders",
  description: "Design a custom shirt or a one-of-a-kind crochet doll with Shagannan Shenanigans.",
  alternates: { canonical: "/custom-orders" },
};

const STAGES = ["Request received", "Quote (for complex pieces)", "Payment", "Design review", "In production", "Shipped or ready for pickup"];

export default async function CustomOrdersPage() {
  const products = (await getProducts()).filter((p) => p.fulfillmentType !== "ready_made");
  const shirts = products.filter((p) => p.customizerKind === "shirt");
  const dolls = products.filter((p) => p.customizerKind === "crochet_doll");
  const other = products.filter((p) => p.customizerKind !== "shirt" && p.customizerKind !== "crochet_doll");

  const group = (title: string, desc: string, items: typeof products) =>
    items.length ? (
      <section className="mt-16">
        <h2 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-2 text-store-muted">{desc}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`} className="group flex gap-5 rounded-3xl border border-store-border p-4 transition-colors hover:border-store-tan">
              <div className="size-28 shrink-0 overflow-hidden rounded-2xl bg-store-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.media[0] ? <img src={p.media[0].url} alt={p.media[0].alt} className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105" /> : null}
              </div>
              <div className="flex flex-col py-1">
                <p className="font-heading font-semibold">{p.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-store-muted">{p.shortDescription}</p>
                <p className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium">{p.quoteOnly ? "Request a quote" : `From ${formatMoney(startingPrice(p))}`} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <Container className="py-16 sm:py-20">
      <div className="grid gap-10 rounded-[32px] bg-store-cream p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">Custom creations</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">Made just for you</h1>
          <p className="mt-4 max-w-lg text-lg text-store-muted">Design a shirt with your own words or artwork, or dream up a crochet doll in your colors. Every custom order is reviewed by our team before we start.</p>
        </div>
        <div className="rounded-3xl bg-white p-6">
          <p className="font-heading font-bold">What happens next</p>
          <ol className="mt-4 space-y-3 text-sm">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-3"><span className="flex size-6 items-center justify-center rounded-full bg-store-tan/30 text-[11px] font-bold">{i + 1}</span>{s}</li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-xs text-store-muted"><Check className="size-3.5" />Track every step from your account.</p>
        </div>
      </div>
      {group("Custom shirts", "Choose a shirt style, size and color, then add text or upload your design.", shirts)}
      {group("Custom crochet dolls", "Pick a style and size, choose yarn colors, outfits and accessories, and add a name.", dolls)}
      {group("Personalized gifts", "Small touches that make a gift unforgettable.", other)}
    </Container>
  );
}
