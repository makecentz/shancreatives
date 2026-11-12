import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/store/section";
import { getCustomerUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out";

// Per-request: reads the signed-in session.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  if (isDemoMode()) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-md rounded-3xl bg-store-cream p-10 text-center">
          <h1 className="font-heading text-2xl font-bold">Customer accounts</h1>
          <p className="mt-3 text-sm text-store-muted">Sign-in, order history, and saved addresses turn on once the store database (Supabase) is connected. Guest checkout will always be available.</p>
        </div>
      </Container>
    );
  }
  const user = await getCustomerUser();
  if (!user) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-md">
          <h1 className="text-center font-heading text-3xl font-bold">Welcome back</h1>
          <p className="mb-8 mt-2 text-center text-sm text-store-muted">Sign in to track orders and manage your details.</p>
          <AuthForm tone="store" redirectTo="/account" />
        </div>
      </Container>
    );
  }
  const sb = await supabaseServer();
  const { data: profile } = await sb.from("profiles").select("full_name, phone, saved_addresses").eq("id", user.id).maybeSingle();
  return (
    <Container className="py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold">Hi, {profile?.full_name || user.email}</h1>
          <p className="mt-2 text-store-muted">{user.email}</p>
        </div>
        <SignOutButton className="text-sm text-store-muted underline" />
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Link href="/account/orders" className="rounded-3xl border border-store-border p-6 hover:border-store-tan">
          <p className="font-heading text-lg font-bold">Orders</p>
          <p className="mt-1 text-sm text-store-muted">Track active orders, custom requests, and pickup details.</p>
        </Link>
        <div className="rounded-3xl border border-store-border p-6">
          <p className="font-heading text-lg font-bold">Profile</p>
          <p className="mt-1 text-sm text-store-muted">{profile?.phone || "No phone saved"}</p>
        </div>
        <div className="rounded-3xl border border-store-border p-6">
          <p className="font-heading text-lg font-bold">Saved addresses</p>
          <p className="mt-1 text-sm text-store-muted">{Array.isArray(profile?.saved_addresses) && profile.saved_addresses.length ? `${profile.saved_addresses.length} saved` : "None yet. Addresses are saved after checkout."}</p>
        </div>
      </div>
    </Container>
  );
}
