import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/store/section";
import { StoreStatusPill } from "@/components/store/order-status";
import { getCustomerUser } from "@/lib/auth/session";
import { mapOrder, ORDER_SELECT } from "@/lib/data/mappers";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

// Per-request: reads the signed-in session.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My orders", robots: { index: false, follow: false } };

export default async function AccountOrdersPage() {
  if (isDemoMode()) redirect("/account");
  const user = await getCustomerUser();
  if (!user) redirect("/account");
  // RLS: customers can only ever read their own orders.
  const sb = await supabaseServer();
  const { data } = await sb.from("orders").select(ORDER_SELECT).eq("user_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []).map(mapOrder);
  return (
    <Container className="py-16">
      <h1 className="font-heading text-4xl font-bold">My orders</h1>
      {orders.length ? (
        <ul className="mt-10 divide-y divide-store-border border-y border-store-border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-4 py-5 hover:bg-store-cream/50">
                <div>
                  <p className="font-heading font-semibold">{o.orderNumber}</p>
                  <p className="text-sm text-store-muted">{formatDate(o.createdAt)} &middot; {o.items.length} {o.items.length === 1 ? "item" : "items"}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StoreStatusPill status={o.fulfillmentStatus} />
                  <span className="font-semibold">{o.totalCents ? formatMoney(o.totalCents) : "Quote pending"}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-3xl bg-store-cream p-10 text-center text-store-muted">No orders yet. <Link href="/shop" className="underline">Start shopping</Link></p>
      )}
    </Container>
  );
}
