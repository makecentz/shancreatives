import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { requirePermission } from "@/lib/auth/session";
import { getOrderById } from "@/lib/data/admin";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Packing slip", robots: { index: false } };

export default async function PackingSlipPage({ params }: PageProps<"/admin/orders/[id]/packing-slip">) {
  await requirePermission("orders.view");
  const order = await getOrderById((await params).id);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-2xl p-10 font-sans text-black">
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="" className="h-12" />
          <div><p className="text-lg font-bold">Shagannan Shenanigans</p><p className="text-sm text-gray-600">Packing slip</p></div>
        </div>
        <div className="text-right text-sm"><p className="font-semibold">{order.orderNumber}</p><p>{formatDate(order.createdAt)}</p><p className="capitalize">{order.deliveryMethod}</p></div>
      </div>
      <p className="mb-6 text-sm"><strong>Customer:</strong> {order.customerName}</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b-2 border-black text-left"><th className="py-2">Item</th><th>SKU</th><th>Options</th><th className="text-right">Qty</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-300 align-top">
              <td className="py-2 font-medium">{i.productName}</td>
              <td>{i.sku}</td>
              <td className="text-xs">{[i.color, i.size].filter(Boolean).join(" / ")}{Object.entries(i.customization).map(([k, v]) => <div key={k}>{k}: {Array.isArray(v) ? v.join(", ") : v}</div>)}</td>
              <td className="text-right">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-10 text-center text-sm text-gray-600">Thank you for supporting handmade!</p>
      <div className="mt-8 text-center print:hidden"><PrintButton /></div>
    </div>
  );
}
