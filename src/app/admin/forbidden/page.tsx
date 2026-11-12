import Link from "next/link";

export const metadata = { title: "Not permitted", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="theme-admin flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-admin-border bg-admin-lavender p-8 text-center">
        <h1 className="text-2xl font-bold">You don&rsquo;t have access to that page</h1>
        <p className="mt-2 text-sm text-admin-muted">Ask the store owner if you need this permission.</p>
        <Link href="/admin" className="mt-6 inline-flex h-10 items-center rounded-lg bg-admin-purple px-5 text-sm text-white">Back to dashboard</Link>
      </div>
    </div>
  );
}
