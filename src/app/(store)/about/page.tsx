import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/store/section";
import { buttonVariants } from "@/components/ui/button";
import { getSiteContent } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "About", description: "Meet Shagannan Shenanigans, a small handmade studio.", alternates: { canonical: "/about" } };

export default async function AboutPage() {
  const c = await getSiteContent();
  return (
    <Container className="py-16 sm:py-24">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">Our story</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{c.aboutHeadline}</h1>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-store-muted">
            {c.aboutBody.split("\n").map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="mt-10 flex gap-3">
            <Link href="/shop" className={buttonVariants({ variant: "store-primary", size: "lg" })}>Shop the studio</Link>
            <Link href="/contact" className={buttonVariants({ variant: "store-outline", size: "lg" })}>Say hello</Link>
          </div>
        </div>
        <div className="flex aspect-square items-center justify-center rounded-[32px] bg-store-cream p-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.logoUrl ?? "/brand/logo.svg"} alt="Shagannan Shenanigans crowned S logo" className="max-h-full w-auto" />
        </div>
      </div>
    </Container>
  );
}
