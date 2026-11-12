import { ArrowRight, Heart, PenLine, Scissors, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/store/fade-in";
import { HeroVideo } from "@/components/store/hero-video";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";
import { Container, SectionHeading } from "@/components/store/section";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getFeaturedProducts, getSiteContent } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

const TINTS = ["bg-store-blush", "bg-store-sage", "bg-store-butter", "bg-store-sky", "bg-store-cream", "bg-store-blush"];
const STEP_TONES = [
  { box: "bg-store-blush text-store-rose", num: "text-store-blush" },
  { box: "bg-store-butter text-store-butter-deep", num: "text-store-butter" },
  { box: "bg-store-sage text-store-sage-deep", num: "text-store-sage" },
];

export default async function HomePage() {
  const [content, categories, featured] = await Promise.all([getSiteContent(), getCategories(), getFeaturedProducts(8)]);

  return (
    <>
      {/* HERO — background video (or color wash) behind the copy. The empty
          square on the right keeps the section the same height as before and
          leaves room for whatever is on that side of the video. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <HeroVideo src={content.heroVideoUrl} poster={content.heroVideoPosterUrl} />
          <div className="absolute inset-0 bg-gradient-to-t from-white from-45% via-white/80 via-60% to-transparent md:bg-gradient-to-r md:from-white md:from-25% md:via-white/75 md:via-50% md:to-transparent md:to-75%" aria-hidden />
        </div>
        <Container className="grid items-center gap-10 py-12 md:grid-cols-[1.05fr_1fr] md:py-20 lg:gap-16 lg:py-24">
          <FadeIn className="order-2 md:order-1">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-store-blush px-3.5 py-1.5 text-[13px] font-medium leading-5 tracking-wide text-store-rose sm:text-sm">
              <Sparkles className="hidden size-3.5 shrink-0 sm:block" />
              {content.heroEyebrow}
            </p>
            <h1 className="font-heading text-[42px] font-bold leading-[1.04] tracking-tight text-store-ink sm:text-6xl lg:text-[68px]">
              {content.heroHeadline}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-store-ink/70">{content.heroDescription}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={content.heroPrimaryCta.href} className={cn(buttonVariants({ variant: "store-primary", size: "lg" }), "h-14 px-9")}>
                {content.heroPrimaryCta.label}
                <ArrowRight />
              </Link>
              <Link href={content.heroSecondaryCta.href} className={cn(buttonVariants({ variant: "store-outline", size: "lg" }), "h-14 bg-white/70 px-9 backdrop-blur-sm")}>
                {content.heroSecondaryCta.label}
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-store-ink/10 pt-8">
              {[
                ["Handmade", "in small batches", "bg-store-rose"],
                ["Custom", "made just for you", "bg-store-butter-deep"],
                ["Pickup", "or shipped to you", "bg-store-sage-deep"],
              ].map(([a, b, dot]) => (
                <div key={a}>
                  <dt className="flex items-center gap-2 font-heading text-base font-bold"><span className={cn("size-2 rounded-full", dot)} aria-hidden />{a}</dt>
                  <dd className="mt-1 text-xs text-store-ink/60">{b}</dd>
                </div>
              ))}
            </dl>
          </FadeIn>
          <div className="order-1 md:order-2" aria-hidden>
            <div className="aspect-square w-full" />
          </div>
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
                  <div className={cn("overflow-hidden rounded-2xl", TINTS[i % TINTS.length])}>
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
          <div className="rounded-[32px] bg-gradient-to-br from-store-cream via-store-blush/60 to-store-sky/70 px-6 py-14 sm:px-12 lg:px-16">
            <SectionHeading align="center" eyebrow="Custom orders" title="How custom orders work" description="From a quick idea to a finished keepsake, in three simple steps." />
            <ol className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Sparkles, title: "Choose Your Creation", body: "Pick a shirt, a crochet doll, or a gift to start from." },
                { icon: PenLine, title: "Make It Your Own", body: "Choose sizes, colors, names, and upload a design or reference photo." },
                { icon: Scissors, title: "We Create It for You", body: "We review every detail, then make it by hand and ship it or set it aside for pickup." },
              ].map((s, i) => (
                <li key={s.title} className="relative rounded-3xl bg-white p-8">
                  <span className={cn("absolute right-6 top-6 font-heading text-5xl font-bold", STEP_TONES[i].num)}>0{i + 1}</span>
                  <div className={cn("flex size-12 items-center justify-center rounded-2xl", STEP_TONES[i].box)}>
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
            <div className="overflow-hidden rounded-3xl bg-store-blush">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/doll-blossom-bunny.svg" alt="" loading="lazy" className="aspect-[4/5] w-full object-contain p-6" />
            </div>
            <div className="mt-10 overflow-hidden rounded-3xl bg-store-sage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo/tee-black-mama.jpg" alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-rose">About the brand</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-[1.1]">{content.aboutHeadline}</h2>
            <p className="mt-5 text-base leading-relaxed text-store-muted">{content.aboutBody}</p>
            <ul className="mt-8 space-y-3 text-sm">
              {["Every custom order is checked by a real person", "Soft, durable materials chosen for everyday love", "Local pickup or shipping, your choice"].map((t) => (
                <li key={t} className="flex items-center gap-3"><Heart className="size-4 fill-store-blush text-store-rose" />{t}</li>
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
          <div className="mx-auto max-w-xl rounded-3xl bg-store-butter/50 p-10 text-center">
            <div className="mb-4 flex justify-center gap-1 text-store-butter-deep">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-5 fill-store-butter" />)}
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
