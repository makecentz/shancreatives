import type { Metadata } from "next";
import { CartPageClient } from "@/components/store/cart-page";
import { Container } from "@/components/store/section";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="mb-10 font-heading text-4xl font-bold tracking-tight">Your cart</h1>
      <CartPageClient />
    </Container>
  );
}
