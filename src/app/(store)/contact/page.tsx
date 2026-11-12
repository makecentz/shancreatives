import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/store/section";
import { getSiteContent } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with Shagannan Shenanigans.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const c = await getSiteContent();
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">Contact</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">We&rsquo;d love to hear from you</h1>
        <p className="mt-4 text-lg text-store-muted">Questions about an order, a custom idea, or a bulk request? Reach out and we&rsquo;ll get back to you.</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-2xl gap-4 sm:grid-cols-2">
        {c.contactEmail ? (
          <a href={`mailto:${c.contactEmail}`} className="flex items-center gap-4 rounded-3xl border border-store-border p-6 hover:border-store-tan">
            <Mail className="size-6 text-store-tan-deep" /><span><span className="block font-semibold">Email</span><span className="text-sm text-store-muted">{c.contactEmail}</span></span>
          </a>
        ) : null}
        {c.contactPhone ? (
          <a href={`tel:${c.contactPhone}`} className="flex items-center gap-4 rounded-3xl border border-store-border p-6 hover:border-store-tan">
            <Phone className="size-6 text-store-tan-deep" /><span><span className="block font-semibold">Phone</span><span className="text-sm text-store-muted">{c.contactPhone}</span></span>
          </a>
        ) : null}
        {!c.contactEmail && !c.contactPhone ? (
          <div className="rounded-3xl bg-store-cream p-8 text-center text-sm text-store-muted sm:col-span-2">
            Contact details will appear here once they&rsquo;re added in the dashboard. In the meantime, you can <Link href="/custom-orders" className="underline">start a custom request</Link>.
          </div>
        ) : null}
      </div>
    </Container>
  );
}
