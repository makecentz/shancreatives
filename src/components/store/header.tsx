"use client";

import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/collections/custom-shirts", label: "Custom Shirts" },
  { href: "/collections/crochet-dolls", label: "Crochet Dolls" },
  { href: "/collections/personalized-gifts", label: "Gifts & More" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function StoreHeader({ logoUrl, promo }: { logoUrl: string | null; promo: string | null }) {
  const [compact, setCompact] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { count, ready } = useCart();

  React.useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close menus on navigation
  React.useEffect(() => { setOpen(false); setSearchOpen(false); }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {promo ? (
        <div className="bg-store-rose px-4 py-2 text-center text-xs tracking-wide text-white">{promo}</div>
      ) : null}
      <header
        className={cn(
          "sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-all duration-300",
          compact ? "border-store-border shadow-[0_1px_12px_rgba(24,24,24,0.06)]" : "border-transparent",
        )}
      >
        <div className={cn("mx-auto flex max-w-7xl items-center gap-4 px-4 transition-all duration-300 sm:px-6 lg:px-8", compact ? "h-16" : "h-20")}>
          <button
            className="-ml-2 rounded-full p-2 text-store-ink lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Logo src={logoUrl} className={cn("transition-all", compact ? "h-9" : "h-11")} />
          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-full px-3 py-2 text-[13px] font-medium tracking-wide text-store-ink/80 transition-colors hover:text-store-ink",
                  isActive(n.href) && "text-store-ink underline decoration-store-tan decoration-2 underline-offset-8",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-4 lg:border-l lg:border-store-border lg:pl-4">
            <button className="rounded-full p-2.5 text-store-ink hover:bg-store-cream" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
              <Search className="size-5" />
            </button>
            <Link href="/account" className="rounded-full p-2.5 text-store-ink hover:bg-store-cream" aria-label="Account">
              <User className="size-5" />
            </Link>
            <Link href="/cart" className="relative rounded-full p-2.5 text-store-ink hover:bg-store-cream" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="size-5" />
              {ready && count > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-store-tan px-1 text-[10px] font-bold text-store-ink">
                  {count}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
        {searchOpen ? (
          <div className="border-t border-store-border bg-white">
            <form
              className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get("q");
                router.push(`/shop?q=${encodeURIComponent(String(q ?? ""))}`);
              }}
            >
              <Search className="size-5 text-store-muted" />
              <input
                name="q"
                autoFocus
                placeholder="Search shirts, crochet dolls, gifts…"
                className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-store-muted"
                aria-label="Search products"
              />
              <button type="submit" className="text-sm font-medium underline underline-offset-4">Search</button>
            </form>
          </div>
        ) : null}
      </header>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
        <div className={cn("absolute inset-0 bg-store-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={cn("absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-white p-6 shadow-xl transition-transform duration-300", open ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex items-center justify-between">
            <Logo src={logoUrl} className="h-10" />
            <button onClick={() => setOpen(false)} className="rounded-full p-2" aria-label="Close menu"><X className="size-5" /></button>
          </div>
          <nav className="mt-8 flex flex-col" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cn("border-b border-store-border py-4 font-heading text-lg font-semibold", isActive(n.href) ? "text-store-ink" : "text-store-ink/75")}>
                {n.label}
              </Link>
            ))}
            <Link href="/custom-orders" className="mt-6 rounded-full bg-store-ink py-3.5 text-center text-sm font-medium text-white">Start a custom order</Link>
          </nav>
        </div>
      </div>
    </>
  );
}
