import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { DataTable, PageIntro, Pill } from "@/components/admin/ui";
import { isRevenueOrder, netRevenue } from "@/lib/analytics";
import { requirePermission } from "@/lib/auth/session";
import { getAllCustomers, getAllOrders } from "@/lib/data/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requirePermission("customers.view");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().toLowerCase();
  const [customers, orders] = await Promise.all([getAllCustomers(), getAllOrders()]);
  const stats = new Map<string, { count: number; spent: number; last: string | null; custom: number }>();
  for (const o of orders) {
    const key = o.customerId ?? `guest:${o.customerEmail.toLowerCase()}`;
    const s = stats.get(key) ?? { count: 0, spent: 0, last: null, custom: 0 };
    if (isRevenueOrder(o)) { s.count++; s.spent += netRevenue(o); }
    if (o.isCustomOrder) s.custom++;
    if (!s.last || o.createdAt > s.last) s.last = o.createdAt;
    stats.set(key, s);
  }
  const rows = customers
    .map((c) => ({ c, s: stats.get(c.id) ?? { count: 0, spent: 0, last: null, custom: 0 } }))
    .filter(({ c }) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    .sort((a, b) => b.s.spent - a.s.spent);
  return (
    <div className="space-y-8">
      <AdminHeader title="Customers" subtitle={`${customers.length} registered customers`} />
      <PageIntro>Totals count paid orders net of refunds. Guest checkouts appear on their orders but not here, since they have no account.</PageIntro>
      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="h-10 w-full rounded-lg border border-admin-border bg-white px-3 text-sm outline-none focus:border-admin-pink" />
        <button className="h-10 rounded-lg bg-admin-purple px-4 text-sm font-medium text-white">Search</button>
      </form>
      <DataTable head={["Customer", "Email", "Joined", "Orders", "Custom", "Total spent", "Last order"]} minWidth={860} empty={rows.length ? false : "No customers found."}>
        {rows.map(({ c, s }) => (
          <tr key={c.id}>
            <td className="font-medium">{c.name}{c.isDemo ? <span className="ml-2"><Pill tone="gray">Demo</Pill></span> : null}</td>
            <td className="text-xs"><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></td>
            <td className="whitespace-nowrap text-xs">{formatDate(c.createdAt)}</td>
            <td>{s.count}</td>
            <td>{s.custom}</td>
            <td className="font-semibold">{formatMoney(s.spent)}</td>
            <td className="whitespace-nowrap text-xs">{s.last ? <Link className="hover:underline" href={`/admin/orders?q=${encodeURIComponent(c.email)}`}>{formatDate(s.last)}</Link> : "—"}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
