import { CartProvider } from "@/components/store/cart-context";
import { StoreDemoBanner } from "@/components/store/demo-banner";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";
import { getSiteContent } from "@/lib/data/catalog";
import { isDemoMode } from "@/lib/env";

/** Storefront layout: white / tan / black boutique identity. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const content = await getSiteContent();
  return (
    <CartProvider>
      <div className="theme-store flex min-h-screen flex-col bg-store-bg text-store-ink">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-store-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        {isDemoMode() ? <StoreDemoBanner /> : null}
        <StoreHeader logoUrl={content.logoUrl} promo={content.promoBanner} />
        <main id="main" className="flex-1">{children}</main>
        <StoreFooter content={content} />
      </div>
    </CartProvider>
  );
}
