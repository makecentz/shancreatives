import { AdminHeader } from "@/components/admin/header";
import { CsvButton } from "@/components/admin/csv-button";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { Card, DataTable, PageIntro, WhiteCard, adminInput } from "@/components/admin/ui";
import { isRevenueOrder, reportSummary, revenueByCategory, revenueSeries, topProducts, type RangeKey } from "@/lib/analytics";
import { requirePermission } from "@/lib/auth/session";
import { dashboardNow, getAllCustomers, getAllOrders } from "@/lib/data/admin";
import { getCategories } from "@/lib/data/catalog";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Analytics" };

const day = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePermission("analytics.view");
  const sp = await searchParams;
  const now = dashboardNow();
  const parse = (v: unknown, fallback: Date) => {
    const d = new Date(String(v ?? ""));
    return Number.isNaN(d.getTime()) ? fallback : d;
  };
  const start = parse(sp.from, new Date(now.getTime() - 29 * day));
  start.setUTCHours(0, 0, 0, 0);
  const endDay = parse(sp.to, now);
  const end = new Date(Date.UTC(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate() + 1));

  const [orders, customers, categories] = await Promise.all([getAllOrders(), getAllCustomers(), getCategories()]);
  const inRange = orders.filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= start.getTime() && t < end.getTime(); });
  const s = reportSummary(orders, customers, start, end);
  const cats = revenueByCategory(inRange, (id) => categories.find((c) => c.id === id)?.name ?? "Uncategorised");
  const tops = topProducts(inRange, 10);
  const series = Object.fromEntries((["1d", "7d", "30d", "6m", "max"] as RangeKey[]).map((r) => [r, revenueSeries(orders, r, now)])) as Record<RangeKey, ReturnType<typeof revenueSeries>>;
  const paid = inRange.filter(isRevenueOrder);
  const viaStripe = paid.filter((o) => o.paymentProvider === "stripe").reduce((t, o) => t + o.totalCents, 0);
  const viaSquare = paid.filter((o) => o.paymentProvider === "square").reduce((t, o) => t + o.totalCents, 0);

  const metrics: [string, string][] = [
    ["Gross revenue", formatMoney(s.grossCents)],
    ["Refunds", formatMoney(s.refundsCents)],
    ["Net revenue", formatMoney(s.netCents)],
    ["Average order value", formatMoney(s.averageOrderValueCents)],
    ["Orders", String(s.totalOrders)],
    ["Open orders", String(s.pendingOrders)],
    ["Completed", String(s.completedOrders)],
    ["Cancelled", String(s.cancelledOrders)],
    ["Custom orders", String(s.customOrders)],
    ["New customers", String(s.newCustomers)],
    ["Returning customers", String(s.returningCustomers)],
    ["Failed payments", String(s.failedPayments)],
  ];

  const csv: (string | number)[][] = [
    ["Metric", "Value"],
    ["From", iso(start)], ["To", iso(new Date(end.getTime() - day))],
    ...metrics,
    ["Paid via Stripe", formatMoney(viaStripe)], ["Paid via Square", formatMoney(viaSquare)],
    [],
    ["Category", "Revenue"], ...cats.map((c) => [c.name, (c.revenueCents / 100).toFixed(2)]),
    [],
    ["Product", "Units", "Revenue"], ...tops.map((t) => [t.name, t.units, (t.revenueCents / 100).toFixed(2)]),
  ];

  return (
    <div className="space-y-8">
      <AdminHeader title="Analytics" subtitle="Sales, orders, customers and payments." />
      <PageIntro>All figures are calculated from order records{isDemoMode() ? " (demo sample data in this preview)" : ""}. Revenue counts paid orders; refunds are subtracted for net.</PageIntro>
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block font-medium">From</span><input type="date" name="from" defaultValue={iso(start)} className={`${adminInput} w-40`} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">To</span><input type="date" name="to" defaultValue={iso(new Date(end.getTime() - day))} className={`${adminInput} w-40`} /></label>
          <button className="h-10 rounded-lg bg-admin-purple px-4 text-sm font-medium text-white">Apply</button>
        </form>
        <div className="ml-auto"><CsvButton filename={`report-${iso(start)}-to-${iso(new Date(end.getTime() - day))}.csv`} rows={csv} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map(([k, v]) => (
          <WhiteCard key={k} className="p-4"><p className="text-xs text-admin-muted">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></WhiteCard>
        ))}
      </div>
      <Card title="Revenue over time"><RevenueChart series={series} defaultRange="30d" /></Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Revenue by category">
          {cats.length ? (
            <ul className="space-y-3">
              {cats.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm"><span>{c.name}</span><span className="font-medium">{formatMoney(c.revenueCents)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-admin-pink" style={{ width: `${Math.max(3, (c.revenueCents / cats[0].revenueCents) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-admin-muted">No paid orders in this range.</p>}
        </Card>
        <Card title="Payments">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-admin-muted">Stripe</dt><dd className="text-lg font-semibold">{formatMoney(viaStripe)}</dd><dd className="text-xs text-admin-muted">{s.stripeCount} orders</dd></div>
            <div><dt className="text-admin-muted">Square (fallback)</dt><dd className="text-lg font-semibold">{formatMoney(viaSquare)}</dd><dd className="text-xs text-admin-muted">{s.squareCount} orders</dd></div>
            <div><dt className="text-admin-muted">Failed payments</dt><dd className="text-lg font-semibold">{s.failedPayments}</dd></div>
            <div><dt className="text-admin-muted">Orders with refunds</dt><dd className="text-lg font-semibold">{s.refundCount}</dd></div>
          </dl>
        </Card>
      </div>
      <DataTable head={["Product", "Units sold", "Revenue"]} minWidth={480} empty={tops.length ? false : "No sales in this range."}>
        {tops.map((t) => (
          <tr key={t.productId}><td className="font-medium">{t.name}</td><td>{t.units}</td><td>{formatMoney(t.revenueCents)}</td></tr>
        ))}
      </DataTable>
    </div>
  );
}
