import { adjustStock } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { availableStock } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/data/admin";
import { getInventoryMovements } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requirePermission("inventory.manage");
  const [products, movements] = await Promise.all([getAdminProducts(), getInventoryMovements()]);
  const demo = isDemoMode();
  const rows = products.flatMap((p) => p.variants.filter((v) => v.stockQuantity !== null).map((v) => ({ p, v, avail: availableStock(v) ?? 0 })));
  rows.sort((a, b) => a.avail - a.v.lowStockThreshold - (b.avail - b.v.lowStockThreshold));
  const variantLabel = (id: string) => {
    for (const p of products) {
      const v = p.variants.find((x) => x.id === id);
      if (v) return `${p.name}${v.size || v.color ? ` (${[v.color, v.size].filter(Boolean).join(" / ")})` : ""}`;
    }
    return id;
  };
  return (
    <div className="space-y-8">
      <AdminHeader title="Inventory" subtitle="Finished-goods stock for ready-made items." />
      <PageIntro>Stock is reserved when checkout starts, committed when payment is confirmed, and released if checkout expires or fails. Made-to-order variants don&apos;t track stock and aren&apos;t listed here. Every adjustment is logged.</PageIntro>
      <DataTable head={["Product", "SKU", "On hand", "Reserved", "Available", "Status", "Adjust"]} minWidth={980} empty={rows.length ? false : "No stock-tracked variants yet."}>
        {rows.map(({ p, v, avail }) => (
          <tr key={v.id}>
            <td className="font-medium">{p.name}<span className="block text-xs font-normal text-admin-muted">{[v.color, v.size].filter(Boolean).join(" / ") || "Default"}</span></td>
            <td className="text-xs">{v.sku}</td>
            <td>{v.stockQuantity}</td>
            <td>{v.reservedQuantity}</td>
            <td className="font-semibold">{avail}</td>
            <td>{avail <= 0 ? <Pill tone="red">Out of stock</Pill> : avail <= v.lowStockThreshold ? <Pill tone="amber">Low</Pill> : <Pill tone="green">In stock</Pill>}</td>
            <td>
              <ActionForm action={adjustStock.bind(null, v.id)} submitLabel="Apply" variant="outline" disabled={demo} className="flex flex-nowrap items-center gap-2 [&>div]:mt-0 [&_button]:h-9">
                <input name="change" type="number" step={1} required placeholder="+/-" aria-label="Change" className={cn(adminInput, "h-9 w-20")} />
                <select name="reason" aria-label="Reason" className={cn(adminInput, "h-9 w-32")} defaultValue="restock">
                  <option value="restock">Restock</option><option value="adjustment">Adjustment</option><option value="return">Return</option><option value="damage">Damage</option><option value="correction">Correction</option>
                </select>
                <input name="note" placeholder="Note" aria-label="Note" className={cn(adminInput, "h-9 w-32")} />
              </ActionForm>
            </td>
          </tr>
        ))}
      </DataTable>
      <Card title="Recent stock movements">
        {movements.length ? (
          <ul className="divide-y divide-admin-border text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span className={m.change > 0 ? "font-semibold text-admin-success" : "font-semibold text-admin-danger"}>{m.change > 0 ? `+${m.change}` : m.change}</span> {variantLabel(m.variantId)} <span className="text-admin-muted">· {m.reason}{m.note ? ` · ${m.note}` : ""}</span></span>
                <span className="text-xs text-admin-muted">{m.stockAfter != null ? `Now ${m.stockAfter} · ` : ""}{formatDate(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-admin-muted">{demo ? "Movement history appears once the store is connected to Supabase." : "No stock movements yet."}</p>}
      </Card>
    </div>
  );
}
