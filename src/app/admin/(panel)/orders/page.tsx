import { AdminHeader } from "@/components/admin/header";
import { toOrderRow } from "@/components/admin/order-row";
import { OrdersTable } from "@/components/admin/orders-table";
import { requirePermission } from "@/lib/auth/session";
import { getAllOrders } from "@/lib/data/admin";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  await requirePermission("orders.view");
  const orders = await getAllOrders();
  return (
    <div className="space-y-8">
      <AdminHeader title="Orders" subtitle="Search, filter, and manage every order." />
      <OrdersTable rows={orders.map(toOrderRow)} variant="full" />
    </div>
  );
}
