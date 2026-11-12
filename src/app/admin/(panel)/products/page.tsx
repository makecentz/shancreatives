import { Plus } from "lucide-react";
import Link from "next/link";
import { setProductStatusFromForm } from "@/app/admin/actions/products";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { DataTable, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { availableStock } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/data/admin";
import { getCategories } from "@/lib/data/catalog";
import { formatMoney } from "@/lib/money";
import { startingPrice } from "@/lib/pricing";

export const metadata = { title: "Products" };

const STATUS_TONE = { active: "green", draft: "gray", archived: "red", out_of_stock: "amber" } as const;

export default async function AdminProductsPage() {
  await requirePermission("products.manage");
  const [products, categories] = await Promise.all([getAdminProducts(), getCategories()]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  return (
    <div className="space-y-8">
      <AdminHeader title="Products" subtitle="Create, edit, publish, and archive products." />
      <div className="flex justify-end">
        <Link href="/admin/products/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-b from-admin-purple to-admin-purple-deep px-4 text-sm font-medium text-white"><Plus className="size-4" />New product</Link>
      </div>
      <DataTable head={["", "Product", "Status", "Type", "Category", "Price", "Stock", "Sold", ""]} minWidth={900} empty={products.length ? false : "No products yet."}>
        {products.map((p) => {
          const tracked = p.variants.filter((v) => v.stockQuantity !== null);
          const stock = tracked.reduce((s, v) => s + (availableStock(v) ?? 0), 0);
          return (
            <tr key={p.id}>
              <td className="w-14">
                <span className="block size-11 overflow-hidden rounded-lg bg-white ring-1 ring-admin-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.media[0] ? <img src={p.media[0].url} alt="" className="h-full w-full object-contain p-0.5" /> : null}
                </span>
              </td>
              <td><Link href={`/admin/products/${p.id}/edit`} className="font-medium hover:underline">{p.name}</Link><span className="block text-xs text-admin-muted">{p.variants.length} variant{p.variants.length === 1 ? "" : "s"}{p.isFeatured ? " · Featured" : ""}{p.isDemo ? " · Demo" : ""}</span></td>
              <td><Pill tone={STATUS_TONE[p.status]}>{p.status.replace("_", " ")}</Pill></td>
              <td className="whitespace-nowrap text-xs">{p.fulfillmentType === "ready_made" ? "Ready-made" : p.fulfillmentType === "custom" ? "Custom" : "Both"}</td>
              <td className="text-xs">{p.categoryIds.map(catName).filter(Boolean).slice(0, 2).join(", ")}</td>
              <td className="whitespace-nowrap">{formatMoney(startingPrice(p))}</td>
              <td>{tracked.length ? <span className={stock <= 3 ? "font-semibold text-admin-danger" : ""}>{stock}</span> : <span className="text-xs text-admin-muted">Made to order</span>}</td>
              <td>{p.unitsSold}</td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/products/${p.id}/edit`} className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-sm text-admin-purple ring-1 ring-admin-border hover:bg-admin-purple hover:text-white">Edit</Link>
                  {p.status !== "archived" ? (
                    <ActionForm action={setProductStatusFromForm.bind(null, p.id)} submitLabel="Archive" variant="outline" confirm={`Archive “${p.name}”? It will be hidden from the store. Order history is kept.`} className="[&>div]:mt-0 [&_button]:h-8">
                      <input type="hidden" name="status" value="archived" />
                    </ActionForm>
                  ) : null}
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
