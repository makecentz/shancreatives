import { Package, Receipt, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { OrdersTable } from "@/components/admin/orders-table";
import { toOrderRow } from "@/components/admin/order-row";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { StatCard } from "@/components/admin/stat-card";
import { dashboardStats, revenueSeries, topProducts, type RangeKey } from "@/lib/analytics";
import { hasPermission } from "@/lib/auth/roles";
import { getStaffSession, requirePermission } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dashboardNow, getAllCustomers, getAllOrders } from "@/lib/data/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const current = await getStaffSession();
  if (current && !hasPermission(current.role, "dashboard.view")) redirect("/admin/orders");
  const session = await requirePermission("dashboard.view");
  const [orders, customers] = await Promise.all([getAllOrders(), getAllCustomers()]);
  const now = dashboardNow();
  const stats = dashboardStats(orders, customers, now);
  const series = Object.fromEntries((["1d", "7d", "30d", "6m", "max"] as RangeKey[]).map((r) => [r, revenueSeries(orders, r, now)])) as Record<RangeKey, ReturnType<typeof revenueSeries>>;
  const top = topProducts(orders, 5);
  const latest = orders.filter((o) => o.totalCents > 0).slice(0, 8).map(toOrderRow);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return (
    <div className="space-y-8">
      <AdminHeader title={`Welcome back, ${session.name.split(" ")[0]}!`} subtitle="Here's how your store is doing today." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard icon={<Wallet />} label="Monthly Revenue" value={formatMoney(stats.monthlyRevenue.value)} metric={stats.monthlyRevenue} />
          <StatCard icon={<Package />} label="Total Orders" value={stats.totalOrders.value.toLocaleString()} metric={stats.totalOrders} />
          <StatCard icon={<Receipt />} label="Average Order Value" value={formatMoney(stats.averageOrderValue.value)} metric={stats.averageOrderValue} />
          <StatCard icon={<UserPlus />} label="New Customers" value={stats.newCustomers.value.toLocaleString()} metric={stats.newCustomers} />
        </div>
        <RevenueChart series={series} />
      </div>
      <p className="-mt-4 text-xs text-admin-muted">Month to date ({formatDate(monthStart.toISOString())} – {formatDate(now.toISOString())}) compared with the same days last month. Revenue is net of refunds.</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_230px]">
        <section aria-labelledby="latest-orders" className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="latest-orders" className="text-[24px] font-medium">Latest Orders</h2>
            {hasPermission(session.role, "orders.view") ? <Link href="/admin/orders" className="text-sm font-medium text-admin-pink hover:underline">View all orders</Link> : null}
          </div>
          <OrdersTable rows={latest} variant="dashboard" pageSize={8} />
        </section>
        <section aria-labelledby="top-products" className="h-fit rounded-2xl border border-admin-border bg-admin-lavender p-5 text-center">
          <h2 id="top-products" className="text-[20px] font-medium">Top Products</h2>
          <ul className="mt-4 space-y-4 text-left">
            {top.map((p) => (
              <li key={p.productId} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-admin-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-contain p-1" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{p.name}</span>
                  <span className="block text-[13px] text-admin-pink">{p.units.toLocaleString()} units sold</span>
                  <span className="block text-[11px] text-admin-muted">{formatMoney(p.revenueCents)}</span>
                </span>
              </li>
            ))}
            {!top.length ? <li className="py-6 text-center text-sm text-admin-muted">No sales yet.</li> : null}
          </ul>
          <Link href="/admin/reports" className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-b from-admin-purple to-admin-purple-deep px-9 text-[16px] text-white shadow-sm hover:brightness-110">View All</Link>
        </section>
      </div>
    </div>
  );
}
