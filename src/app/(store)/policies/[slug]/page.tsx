import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/store/section";
import { getPolicy } from "@/lib/data/catalog";

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const p = await getPolicy((await params).slug);
  return p ? { title: p.title, alternates: { canonical: `/policies/${p.slug}` } } : {};
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const policy = await getPolicy((await params).slug);
  if (!policy) notFound();
  return (
    <Container className="py-16 sm:py-24">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-heading text-4xl font-bold tracking-tight">{policy.title}</h1>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-store-muted">
          {policy.body.split("\n").map((l) => l.trim()).filter(Boolean).map((p, i) => (p.startsWith("## ") ? <h2 key={i} className="pt-4 font-heading text-xl font-semibold text-store-ink">{p.slice(3)}</h2> : <p key={i}>{p}</p>))}
        </div>
      </article>
    </Container>
  );
}
