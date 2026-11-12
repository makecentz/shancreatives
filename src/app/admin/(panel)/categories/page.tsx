import { saveCategory } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AdminHeader } from "@/components/admin/header";
import { Card, DataTable, Field, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getAdminCategories } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Categories" };

function CategoryFields({ c }: { c?: { id: string; name: string; slug: string; description: string; sortOrder: number; isVisible: boolean } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <Field label="Name"><input name="name" required minLength={2} defaultValue={c?.name} className={adminInput} /></Field>
      <Field label="Slug" hint="Leave blank to generate from the name."><input name="slug" defaultValue={c?.slug} className={adminInput} /></Field>
      <Field label="Description" className="sm:col-span-2"><input name="description" maxLength={300} defaultValue={c?.description} className={adminInput} /></Field>
      <Field label="Sort order"><input name="sort_order" type="number" defaultValue={c?.sortOrder ?? 0} className={adminInput} /></Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_visible" defaultChecked={c?.isVisible ?? true} className="size-4 accent-admin-purple" />Visible on the storefront</label>
    </div>
  );
}

export default async function CategoriesPage() {
  await requirePermission("products.manage");
  const categories = await getAdminCategories();
  const demo = isDemoMode();
  return (
    <div className="space-y-8">
      <AdminHeader title="Categories" subtitle="Group products into collections shown in the shop." />
      <Card title="Add a category">
        <ActionForm action={saveCategory} submitLabel="Add category" disabled={demo}><CategoryFields /></ActionForm>
      </Card>
      <DataTable head={["Name", "Slug", "Order", "Visibility", ""]} minWidth={640} empty={categories.length ? false : "No categories yet."}>
        {categories.map((c) => (
          <tr key={c.id}>
            <td className="font-medium">{c.name}<span className="block text-xs font-normal text-admin-muted">{c.description}</span></td>
            <td className="text-xs">/collections/{c.slug}</td>
            <td>{c.sortOrder}</td>
            <td><Pill tone={c.isVisible ? "green" : "gray"}>{c.isVisible ? "Visible" : "Hidden"}</Pill></td>
            <td className="text-right">
              <details className="inline-block text-left">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-lg bg-white px-3 text-sm text-admin-purple ring-1 ring-admin-border">Edit</summary>
                <div className="mt-2 w-[min(32rem,80vw)] rounded-xl border border-admin-border bg-white p-4">
                  <ActionForm action={saveCategory} submitLabel="Save" disabled={demo}><CategoryFields c={c} /></ActionForm>
                </div>
              </details>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
