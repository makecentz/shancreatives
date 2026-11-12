/**
 * DEMO DATA — deterministic sample orders and customers for previewing the
 * admin dashboard before Supabase is connected. Every record is flagged
 * isDemo and the dashboard shows a "Demo data" banner whenever these are used.
 * Dashboard figures are still *calculated* from these records by the same
 * analytics functions used for real data; nothing is hardcoded.
 */
import type { Customer, FulfillmentStatus, Order, PaymentProvider, PaymentStatus } from "../types";
import { demoProducts } from "./catalog";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Avery", "Jordan", "Maya", "Tasha", "Leah", "Nia", "Carmen", "Priya", "Elena", "Dana", "Keisha", "Robin", "Imani", "Sofia", "Grace", "Talia", "Monique", "Hazel", "Ruth", "Simone"];
const LAST = ["Brooks", "Carter", "Nguyen", "Patel", "Reyes", "Hughes", "Walker", "Bennett", "Foster", "Kim", "Ortiz", "Price", "Coleman", "Hayes", "Ward"];

export function buildDemoData(now = new Date("2026-11-12T18:00:00Z")) {
  const rand = mulberry32(20261112);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const customers: Customer[] = Array.from({ length: 64 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const created = new Date(now.getTime() - Math.floor(rand() * 220) * 86400000);
    return {
      id: `demo-cust-${i + 1}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      phone: rand() > 0.5 ? `(555) 01${String(10 + i).padStart(2, "0")}` : null,
      createdAt: created.toISOString(),
      isDemo: true,
    };
  });

  const orders: Order[] = [];
  const sellable = demoProducts.filter((p) => !p.quoteOnly);
  let num = 1000;
  for (let day = 200; day >= 0; day--) {
    const count = Math.floor(rand() * (day < 30 ? 4 : 3));
    for (let k = 0; k < count; k++) {
      const created = new Date(now.getTime() - day * 86400000 - Math.floor(rand() * 20) * 3600000);
      const eligible = customers.filter((c) => new Date(c.createdAt) <= created);
      const customer = eligible.length ? pick(eligible) : customers[0];
      const lines = 1 + Math.floor(rand() * 2);
      const items = Array.from({ length: lines }, (_, li) => {
        const p = pick(sellable);
        const v = pick(p.variants);
        const qty = 1 + Math.floor(rand() * 2);
        const unit = v.salePriceCents ?? v.priceCents ?? p.salePriceCents ?? p.basePriceCents;
        const isCustom = p.fulfillmentType === "custom" || (p.fulfillmentType === "both" && rand() > 0.6);
        const custom = isCustom ? 500 + Math.floor(rand() * 4) * 300 : 0;
        return {
          id: `demo-oi-${num}-${li}`,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          imageUrl: p.media[0]?.url ?? null,
          variantId: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          quantity: qty,
          unitPriceCents: unit,
          customizationCents: custom,
          lineTotalCents: (unit + custom) * qty,
          isCustom,
          customization: (isCustom ? { custom_text: "Sample text" } : {}) as Record<string, string>,
          categoryIds: p.categoryIds,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.lineTotalCents, 0);
      const delivery = rand() > 0.3 ? "shipping" : "pickup";
      const shipping = delivery === "shipping" ? 695 : 0;
      const tax = Math.round(subtotal * 0.07);
      const isCustomOrder = items.some((i) => i.isCustom);
      const r = rand();
      let paymentStatus: PaymentStatus = "paid";
      let fulfillment: FulfillmentStatus = "completed";
      if (r < 0.06) { paymentStatus = "failed"; fulfillment = "cancelled"; }
      else if (r < 0.1) { paymentStatus = "refunded"; fulfillment = "cancelled"; }
      else if (day < 3) { fulfillment = isCustomOrder ? "in_production" : delivery === "pickup" ? "ready_for_pickup" : "paid"; }
      else if (day < 10) { fulfillment = isCustomOrder ? pick(["in_production", "design_review", "approved"] as const) : delivery === "pickup" ? "ready_for_pickup" : "shipped"; }
      const total = subtotal + shipping + tax;
      const provider: PaymentProvider | null = paymentStatus === "failed" ? (rand() > 0.5 ? "stripe" : null) : rand() > 0.12 ? "stripe" : "square";
      orders.push({
        id: `demo-order-${num}`,
        orderNumber: `SS-${num}`,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        items,
        subtotalCents: subtotal,
        discountCents: 0,
        shippingCents: shipping,
        taxCents: tax,
        totalCents: total,
        refundedCents: paymentStatus === "refunded" ? total : 0,
        paymentStatus,
        paymentProvider: provider,
        fulfillmentStatus: fulfillment,
        deliveryMethod: delivery,
        isCustomOrder,
        createdAt: created.toISOString(),
        isDemo: true,
      });
      num++;
    }
  }
  // A couple of open custom requests awaiting a quote
  const keepsake = demoProducts.find((p) => p.quoteOnly)!;
  for (let i = 0; i < 3; i++) {
    const c = customers[i * 5];
    orders.push({
      id: `demo-order-q${i}`,
      orderNumber: `SS-${num++}`,
      customerId: c.id, customerName: c.name, customerEmail: c.email,
      items: [{
        id: `demo-oi-q${i}`, productId: keepsake.id, productName: keepsake.name, productSlug: keepsake.slug,
        imageUrl: keepsake.media[0].url, variantId: keepsake.variants[0].id, sku: keepsake.variants[0].sku, size: null, color: null,
        quantity: 1, unitPriceCents: 0, customizationCents: 0, lineTotalCents: 0, isCustom: true,
        customization: { doll_style: "person", special_instructions: "Please match the photo" }, categoryIds: keepsake.categoryIds,
      }],
      subtotalCents: 0, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0, refundedCents: 0,
      paymentStatus: "unpaid", paymentProvider: null,
      fulfillmentStatus: i === 0 ? "request_received" : "quote_pending",
      deliveryMethod: "shipping", isCustomOrder: true,
      createdAt: new Date(now.getTime() - i * 86400000 * 1.5).toISOString(), isDemo: true,
    });
  }
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { customers, orders };
}
