import { Plus } from "lucide-react";
import Link from "next/link";
import { setProductStatusFromForm, setSampleProducts } from "@/app/admin/actions/products";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Pill } from "@/components/admin/ui";
import { hasPermission } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { availableStock } from "@/lib/catalog";
import { getAdminProducts } from "@/lib/data/admin";
import { getCategories, getSampleProductsEnabled } from "@/lib/data/catalog";
import { demoProducts } from "@/lib/demo/catalog";
import { isDemoMode } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { startingPrice } from "@/lib/pricing";

export const metadata = { title: "Products" };

const STATUS_TONE = { active: "green", draft: "gray", archived: "red", out_of_stock: "amber" } as const;

export default async function AdminProductsPage() {
  const session = await requirePermission("products.manage");
  const [products, categories, samplesOn] = await Promise.all([getAdminProducts(), getCategories(), getSampleProductsEnabled()]);
  const demo = isDemoMode();
  const canToggle = !demo && hasPermission(session.role, "content.manage");
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  return (
    <div className="space-y-8">
      <AdminHeader title="Products" subtitle="Create, edit, publish, and archive products." />
      {!demo ? (
        <Card title="Sample products">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Pill tone={samplesOn ? "green" : "gray"}>{samplesOn ? "Showing on the store" : "Hidden"}</Pill>
              </p>
              <p className="mt-2 max-w-xl text-admin-muted">
                {demoProducts.length} example products, each marked &ldquo;Sample product&rdquo;, so the shop doesn&rsquo;t look empty while you add your own. They can&rsquo;t be added to a cart or bought, and they never appear in orders or reports. They aren&rsquo;t listed below because they aren&rsquo;t saved in your database.
              </p>
            </div>
            {canToggle ? (
              <ActionForm action={setSampleProducts} submitLabel={samplesOn ? "Turn off sample products" : "Turn on sample products"} variant={samplesOn ? "outline" : "primary"}>
                <input type="hidden" name="enabled" value={samplesOn ? "0" : "1"} />
              </ActionForm>
            ) : <p className="text-xs text-admin-muted">Only the owner or a manager can change this.</p>}
          </div>
        </Card>
      ) : null}
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
