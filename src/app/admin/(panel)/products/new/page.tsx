import { AdminHeader } from "@/components/admin/header";
import { ProductForm } from "@/components/admin/product-form";
import { emptyProduct } from "@/lib/admin/product-form-values";
import { requirePermission } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/catalog";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission("products.manage");
  return (
    <div className="space-y-8">
      <AdminHeader title="New product" />
      <ProductForm initial={emptyProduct()} categories={await getCategories()} demo={isDemoMode()} />
    </div>
  );
}
