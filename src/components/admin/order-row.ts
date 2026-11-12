import type { FulfillmentStatus, Order } from "@/lib/types";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customer: string;
  email: string;
  product: string;
  date: string;
  totalCents: number;
  paymentStatus: Order["paymentStatus"];
  fulfillmentStatus: FulfillmentStatus;
  provider: Order["paymentProvider"];
  delivery: Order["deliveryMethod"];
  isCustom: boolean;
}

export function toOrderRow(o: Order): OrderRow {
  const first = o.items[0]?.productName ?? "—";
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customer: o.customerName,
    email: o.customerEmail,
    product: o.items.length > 1 ? `${first} +${o.items.length - 1}` : first,
    date: o.createdAt,
    totalCents: o.totalCents,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    provider: o.paymentProvider,
    delivery: o.deliveryMethod,
    isCustom: o.isCustomOrder,
  };
}

