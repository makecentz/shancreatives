import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getStaffSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (isDemoMode() || (await getStaffSession())) redirect("/admin");
  return (
    <div className="theme-admin grid min-h-screen md:grid-cols-2">
      <div className="admin-sidebar hidden flex-col justify-between p-10 text-white md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.svg" alt="" className="h-14 w-fit" />
        <div>
          <p className="text-4xl font-bold leading-tight">Shagannan Shenanigans</p>
          <p className="mt-2 text-white/80">Store management</p>
        </div>
        <p className="text-xs text-white/60">Staff access only. Activity is logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold">Sign in</h1>
          <p className="mb-8 mt-2 text-sm text-admin-muted">Use your staff account to manage the store.</p>
          <AuthForm tone="admin" redirectTo="/admin" allowSignup={false} />
          <Link href="/" className="mt-8 block text-center text-xs text-admin-muted hover:underline">Back to the store</Link>
        </div>
      </div>
    </div>
  );
}
