import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { SiteContent } from "@/lib/types";
import { NewsletterForm } from "./newsletter-form";

function SocialIcon({ name }: { name: string }) {
  // Simple brand-neutral glyphs (lucide v1 no longer ships brand logos).
  const paths: Record<string, string> = {
    instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6-1.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z",
    facebook: "M14 8V6.5c0-.8.6-1.5 1.5-1.5H17V2h-2.5A4.5 4.5 0 0 0 10 6.5V8H8v3h2v11h4V11h2.6l.4-3h-3Z",
    tiktok: "M16 2c.3 2.4 1.8 4 4 4.2v3.3a7.6 7.6 0 0 1-4-1.2v6.9A6.3 6.3 0 1 1 9.7 9v3.4a3 3 0 1 0 2.3 2.9V2h4Z",
    pinterest: "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.6-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.5-4.4-3.1 0-4.9 2.3-4.9 4.7 0 .9.4 1.9.8 2.5l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.4-.7-2.2-2.7-2.2-4.3 0-3.5 2.5-6.7 7.3-6.7 3.8 0 6.8 2.7 6.8 6.4 0 3.8-2.4 6.9-5.8 6.9-1.1 0-2.2-.6-2.6-1.3l-.7 2.7c-.3 1-1 2.2-1.4 2.9A10 10 0 1 0 12 2Z",
  };
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d={paths[name]} fillRule="evenodd" />
    </svg>
  );
}

export function StoreFooter({ content }: { content: SiteContent }) {
  const socials = Object.entries(content.socialLinks).filter(([, v]) => Boolean(v)) as [string, string][];
  return (
    <footer className="mt-24 border-t border-store-border bg-store-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr] lg:px-8">
        <div className="space-y-4">
          <Logo src={content.logoUrl} className="h-12" />
          <p className="max-w-xs text-sm leading-relaxed text-store-muted">{content.footerTagline}</p>
          {socials.length ? (
            <div className="flex gap-2">
              {socials.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-full border border-store-border bg-white text-store-ink hover:border-store-tan" aria-label={name}>
                  <SocialIcon name={name} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-[0.16em]">Shop</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-store-muted">
            <li><Link className="hover:text-store-ink" href="/shop">All products</Link></li>
            <li><Link className="hover:text-store-ink" href="/collections/custom-shirts">Custom Shirts</Link></li>
            <li><Link className="hover:text-store-ink" href="/collections/crochet-dolls">Crochet Dolls</Link></li>
            <li><Link className="hover:text-store-ink" href="/collections/ready-to-ship">Ready to Ship</Link></li>
            <li><Link className="hover:text-store-ink" href="/custom-orders">Custom Orders</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-[0.16em]">Help</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-store-muted">
            <li><Link className="hover:text-store-ink" href="/about">About</Link></li>
            <li><Link className="hover:text-store-ink" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-store-ink" href="/policies/shipping">Shipping Policy</Link></li>
            <li><Link className="hover:text-store-ink" href="/policies/returns">Return Policy</Link></li>
            <li><Link className="hover:text-store-ink" href="/policies/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-store-ink" href="/policies/terms">Terms &amp; Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-[0.16em]">Stay in the loop</h3>
          <p className="mt-4 text-sm text-store-muted">New drops, seasonal makes, and custom order windows. No spam.</p>
          <NewsletterForm compact />
        </div>
      </div>
      <div className="border-t border-store-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-store-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} Shagannan Shenanigans. All rights reserved.</p>
          <p>Handmade in small batches.</p>
        </div>
      </div>
    </footer>
  );
}
