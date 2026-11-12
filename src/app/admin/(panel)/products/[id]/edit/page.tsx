import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { ProductForm } from "@/components/admin/product-form";
import { productToForm } from "@/lib/admin/product-form-values";
import { requirePermission } from "@/lib/auth/session";
import { getAdminProducts } from "@/lib/data/admin";
import { getCategories } from "@/lib/data/catalog";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]/edit">) {
  await requirePermission("products.manage");
  const { id } = await params;
  const product = (await getAdminProducts()).find((p) => p.id === id);
  if (!product) notFound();
  return (
    <div className="space-y-8">
      <AdminHeader title={`Edit ${product.name}`} />
      <ProductForm initial={productToForm(product)} categories={await getCategories()} demo={isDemoMode()} />
    </div>
  );
}
