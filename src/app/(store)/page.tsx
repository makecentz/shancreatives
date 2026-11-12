import { ArrowRight, Heart, PenLine, Scissors, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/store/fade-in";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import { Container, SectionHeading } from "@/components/store/section";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getFeaturedProducts, getSiteContent } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const [content, categories, featured] = await Promise.all([getSiteContent(), getCategories(), getFeaturedProducts(8)]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:py-20 lg:gap-16 lg:py-24">
          <FadeIn className="order-2 md:order-1">
            <p className="mb-5 text-sm font-medium tracking-wide text-store-muted">{content.heroEyebrow}</p>
            <h1 className="font-heading text-[42px] font-bold leading-[1.04] tracking-tight text-store-ink sm:text-6xl lg:text-[68px]">
              {content.heroHeadline}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-store-muted">{content.heroDescription}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={content.heroPrimaryCta.href} className={cn(buttonVariants({ variant: "store-primary", size: "lg" }), "h-14 px-9")}>
                {content.heroPrimaryCta.label}
                <ArrowRight />
              </Link>
              <Link href={content.heroSecondaryCta.href} className={cn(buttonVariants({ variant: "store-outline", size: "lg" }), "h-14 px-9")}>
                {content.heroSecondaryCta.label}
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-store-border pt-8">
              {[
                ["Handmade", "in small batches"],
                ["Custom", "made just for you"],
                ["Pickup", "or shipped to you"],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt className="font-heading text-base font-bold">{a}</dt>
                  <dd className="mt-1 text-xs text-store-muted">{b}</dd>
                </div>
              ))}
            </dl>
          </FadeIn>
          <FadeIn delay={0.1} className="order-1 md:order-2">
            <div className="relative">
              <div className="absolute -right-24 -top-16 hidden h-[520px] w-[520px] rounded-full bg-store-cream md:block" aria-hidden />
              <div className="relative overflow-hidden rounded-[28px] bg-[#f1f1f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={content.heroImageUrl} alt="Featured Shagannan Shenanigans creation" className="aspect-square w-full object-contain" fetchPriority="high" />
              </div>
              <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl border border-store-border bg-white p-3 pr-5 shadow-[0_12px_32px_rgba(24,24,24,0.08)] sm:-left-8">
                <div className="flex size-14 items-center justify-center rounded-xl bg-store-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/demo/doll-honey-bear.svg" alt="" className="h-12 w-12 object-contain" />
                </div>
                <div>
                  <p className="font-heading text-sm font-bold">Crochet friends</p>
                  <p className="text-xs text-store-muted">Made to order in your colors</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </section>

      {/* CATEGORIES */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Shop by category" title="Find something made for them" action={<Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">View all <ArrowRight className="size-4" /></Link>} />
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((c, i) => (
              <FadeIn key={c.id} delay={i * 0.04}>
                <Link href={`/collections/${c.slug}`} className="group block">
                  <div className="overflow-hidden rounded-2xl bg-store-cream">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" loading="lazy" className="aspect-square w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="aspect-square" />
                    )}
                  </div>
                  <p className="mt-3 font-heading text-[15px] font-semibold">{c.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-store-muted">{c.description}</p>
                </Link>
              </FadeIn>
            ))}
          </div>
        </Container>
      </section>

      {/* FEATURED */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Featured" title="Studio favorites" description="Hand-picked pieces from the worktable, ready to ship or made just for you." action={<Link href="/shop" className={buttonVariants({ variant: "store-outline", size: "sm" })}>Shop all</Link>} />
          {featured.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
              {featured.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-store-cream p-10 text-center text-store-muted">Featured products will appear here once they&rsquo;re selected in the dashboard.</p>
          )}
        </Container>
      </section>

      {/* HOW CUSTOM ORDERS WORK */}
      <section className="py-16 sm:py-24">
        <Container>
          <div className="rounded-[32px] bg-store-cream px-6 py-14 sm:px-12 lg:px-16">
            <SectionHeading align="center" eyebrow="Custom orders" title="How custom orders work" description="From a quick idea to a finished keepsake, in three simple steps." />
            <ol className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Sparkles, title: "Choose Your Creation", body: "Pick a shirt, a crochet doll, or a gift to start from." },
                { icon: PenLine, title: "Make It Your Own", body: "Choose sizes, colors, names, and upload a design or reference photo." },
                { icon: Scissors, title: "We Create It for You", body: "We review every detail, then make it by hand and ship it or set it aside for pickup." },
              ].map((s, i) => (
                <li key={s.title} className="relative rounded-3xl bg-white p-8">
                  <span className="absolute right-6 top-6 font-heading text-5xl font-bold text-store-cream">0{i + 1}</span>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-store-tan/25 text-store-ink">
                    <s.icon className="size-5" />
                  </div>
                  <h3 className="mt-6 font-heading text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-store-muted">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <Link href="/custom-orders" className={buttonVariants({ variant: "store-primary", size: "lg" })}>Start a custom order</Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ABOUT */}
      <section className="py-16 sm:py-20">
        <Container className="grid items-center gap-12 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-3xl bg-store-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/doll-blossom-bunny.svg" alt="" loading="lazy" className="aspect-[4/5] w-full object-contain p-6" />
            </div>
            <div className="mt-10 overflow-hidden rounded-3xl bg-[#f1f1f0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/tee-black-mama.jpg" alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-tan-deep">About the brand</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-[1.1]">{content.aboutHeadline}</h2>
            <p className="mt-5 text-base leading-relaxed text-store-muted">{content.aboutBody}</p>
            <ul className="mt-8 space-y-3 text-sm">
              {["Every custom order is checked by a real person", "Soft, durable materials chosen for everyday love", "Local pickup or shipping, your choice"].map((t) => (
                <li key={t} className="flex items-center gap-3"><Heart className="size-4 text-store-tan-deep" />{t}</li>
              ))}
            </ul>
            <Link href="/about" className={cn(buttonVariants({ variant: "store-outline" }), "mt-9")}>Our story</Link>
          </div>
        </Container>
      </section>

      {/* REVIEWS — verified reviews only; no fabricated testimonials */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading align="center" eyebrow="Reviews" title="Kind words from customers" />
          <div className="mx-auto max-w-xl rounded-3xl border border-store-border p-10 text-center">
            <div className="mb-4 flex justify-center gap-1 text-store-tan">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-5" />)}
            </div>
            <p className="font-heading text-lg font-semibold">Verified reviews are coming soon</p>
            <p className="mt-2 text-sm text-store-muted">After your order arrives, you&rsquo;ll be invited to leave a review. Only reviews from verified purchases will be shown here.</p>
          </div>
        </Container>
      </section>

      {/* NEWSLETTER */}
      <section className="pt-8">
        <Container>
          <div className="flex flex-col items-start justify-between gap-6 rounded-[32px] bg-store-ink px-8 py-12 text-white md:flex-row md:items-center md:px-14">
            <div>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">Be first to know</h2>
              <p className="mt-2 max-w-md text-sm text-white/70">New drops, seasonal favorites, and when custom order spots open up.</p>
            </div>
            <div className="w-full max-w-md [&_input]:border-white/20 [&_input]:bg-white/10 [&_input]:text-white [&_input]:placeholder:text-white/50 [&_button]:bg-store-tan [&_button]:text-store-ink [&_button:hover]:bg-white">
              <NewsletterForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
