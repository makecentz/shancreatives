import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { Container } from "@/components/store/section";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="mb-10 font-heading text-4xl font-bold tracking-tight">Checkout</h1>
      <Suspense>
        <CheckoutForm />
      </Suspense>
    </Container>
  );
}
