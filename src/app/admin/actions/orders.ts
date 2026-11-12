"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, audit, guard, run, type ActionResult } from "@/lib/admin/actions-core";
import { newAccessToken } from "@/lib/checkout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/env";
import { canTransitionFulfillment, emailForStatus } from "@/lib/fulfillment";
import { refundSquare } from "@/lib/payments/square";
import { refundStripe } from "@/lib/payments/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FulfillmentStatus } from "@/lib/types";

export async function updateFulfillmentStatus(orderId: string, to: FulfillmentStatus): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("fulfillment.update");
    const { data: o } = await db.from("orders").select("id, order_number, fulfillment_status, payment_status, delivery_method, customer_email, customer_name, pickup_location_id").eq("id", orderId).single();
    if (!o) throw new ActionError("Order not found");
    if (!canTransitionFulfillment(o.fulfillment_status, to, o.payment_status, o.delivery_method)) throw new ActionError(`Can't move from ${o.fulfillment_status} to ${to}.`);
    if (to === "cancelled" && !(await guard("orders.manage").then(() => true, () => false))) throw new ActionError("Only managers can cancel orders.");
    const { error } = await db.from("orders").update({ fulfillment_status: to }).eq("id", orderId).eq("fulfillment_status", o.fulfillment_status);
    if (error) throw error;
    if (to === "ready_for_pickup") await db.from("pickup_details").update({ ready_at: new Date().toISOString() }).eq("order_id", orderId);
    if (to === "completed" && o.delivery_method === "pickup") await db.from("pickup_details").update({ collected_at: new Date().toISOString(), collected_confirmed_by: session.userId }).eq("order_id", orderId);
    if (to === "cancelled") await supabaseAdmin().rpc("release_inventory", { p_order_id: orderId });
    await audit(session, "order.fulfillment", "order", orderId, { status: o.fulfillment_status }, { status: to });

    const tpl = to === "completed" && o.delivery_method === "pickup" ? "pickup_completed" : emailForStatus(to);
    if (tpl) {
      let pickupInstructions: string | undefined;
      if (tpl === "ready_for_pickup" && o.pickup_location_id) {
        const { data: loc } = await db.from("pickup_locations").select("instructions").eq("id", o.pickup_location_id).maybeSingle();
        pickupInstructions = loc?.instructions;
      }
      await sendEmail(tpl, o.customer_email, { orderNumber: o.order_number, customerName: o.customer_name, pickupInstructions, link: `${siteUrl()}/account/orders/${o.id}` }, { orderId, dedupeKey: `${tpl}:${orderId}` });
    }
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Status updated" };
  });
}

export async function addTracking(orderId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("fulfillment.update");
    const data = z.object({ carrier: z.string().trim().max(60), tracking_number: z.string().trim().min(3).max(80), tracking_url: z.string().trim().url().or(z.literal("")) }).parse(Object.fromEntries(form));
    const { error } = await db.from("shipments").insert({ order_id: orderId, carrier: data.carrier || null, tracking_number: data.tracking_number, tracking_url: data.tracking_url || null, status: "shipped", shipped_at: new Date().toISOString(), created_by: session.userId });
    if (error) throw error;
    await audit(session, "order.tracking", "order", orderId, null, data);
    const { data: o } = await db.from("orders").select("fulfillment_status, payment_status, delivery_method").eq("id", orderId).single();
    if (o && canTransitionFulfillment(o.fulfillment_status, "shipped", o.payment_status, o.delivery_method)) await updateFulfillmentStatus(orderId, "shipped");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Tracking added" };
  });
}

export async function addInternalNote(orderId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session, db } = await guard("fulfillment.update");
    const note = z.string().trim().min(1).max(2000).parse(form.get("note"));
    const { data: o } = await db.from("orders").select("internal_notes").eq("id", orderId).single();
    const notes = [...((o?.internal_notes as unknown[]) ?? []), { by: session.name, at: new Date().toISOString(), note }];
    const { error } = await db.from("orders").update({ internal_notes: notes }).eq("id", orderId);
    if (error) throw error;
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Note added" };
  });
}

/** Full or partial refund through the processor that took the payment. */
export async function issueRefund(orderId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session } = await guard("orders.refund");
    const amountCents = Math.round(Number(form.get("amount")) * 100);
    const reason = String(form.get("reason") ?? "").slice(0, 300);
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new ActionError("Enter a valid refund amount.");
    const db = supabaseAdmin();
    const { data: pay } = await db.from("payments").select("id, provider, provider_payment_id, amount_cents").eq("order_id", orderId).maybeSingle();
    if (!pay) throw new ActionError("This order has no captured payment to refund.");
    const { data: prior } = await db.from("refunds").select("amount_cents, status").eq("payment_id", pay.id).in("status", ["pending", "succeeded"]);
    const already = (prior ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
    if (amountCents > Number(pay.amount_cents) - already) throw new ActionError(`You can refund at most $${((Number(pay.amount_cents) - already) / 100).toFixed(2)}.`);

    const { data: refund, error } = await db
      .from("refunds")
      .insert({ payment_id: pay.id, order_id: orderId, provider: pay.provider, amount_cents: amountCents, reason, idempotency_key: `refund_${orderId}_${already}_${amountCents}`, requested_by: session.userId })
      .select("id")
      .single();
    if (error || !refund) throw new ActionError("A matching refund is already in progress.");
    await audit(session, "refund.requested", "order", orderId, null, { amountCents, reason, refund_id: refund.id });
    try {
      if (pay.provider === "stripe") {
        const r = await refundStripe(pay.provider_payment_id, amountCents, refund.id);
        await db.rpc("record_refund_result", { p_refund_id: refund.id, p_status: r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : "pending", p_provider_refund_id: r.id });
      } else {
        const r = await refundSquare(pay.provider_payment_id, amountCents, refund.id);
        await db.rpc("record_refund_result", { p_refund_id: refund.id, p_status: r?.status === "COMPLETED" ? "succeeded" : r?.status === "FAILED" || r?.status === "REJECTED" ? "failed" : "pending", p_provider_refund_id: r?.id ?? null });
      }
    } catch (e) {
      await db.rpc("record_refund_result", { p_refund_id: refund.id, p_status: "failed" });
      throw new ActionError(`The processor rejected the refund: ${(e as Error).message}`);
    }
    const { data: o } = await db.from("orders").select("order_number, customer_email, customer_name").eq("id", orderId).single();
    if (o) await sendEmail("refund_confirmation", o.customer_email, { orderNumber: o.order_number, customerName: o.customer_name, amountCents }, { orderId, dedupeKey: `refund:${refund.id}` });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Refund submitted" };
  });
}

/** Issue a quote for a custom request; the customer must accept before paying. */
export async function issueQuote(orderId: string, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const { session } = await guard("custom_orders.manage");
    const cents = Math.round(Number(form.get("amount")) * 100);
    const message = String(form.get("message") ?? "").slice(0, 2000);
    if (!Number.isInteger(cents) || cents <= 0) throw new ActionError("Enter a valid quote amount.");
    const db = supabaseAdmin();
    const { data: o } = await db.from("orders").select("id, order_number, customer_email, customer_name, fulfillment_status, is_quote_request").eq("id", orderId).single();
    if (!o?.is_quote_request || !["request_received", "quote_pending"].includes(o.fulfillment_status)) throw new ActionError("This request can't be quoted right now.");
    const access = newAccessToken();
    const { error } = await db
      .from("orders")
      .update({ quote_cents: cents, quote_message: message || null, subtotal_cents: cents, total_cents: cents, fulfillment_status: "quote_pending", guest_access_token_hash: access.hash })
      .eq("id", orderId);
    if (error) throw error;
    await audit(session, "order.quote", "order", orderId, null, { cents, message });
    await sendEmail("quote_ready", o.customer_email, { orderNumber: o.order_number, customerName: o.customer_name, amountCents: cents, message, link: `${siteUrl()}/quotes/${o.id}?t=${access.token}` }, { orderId, dedupeKey: `quote:${orderId}:${cents}` });
    revalidatePath("/admin/custom-orders");
    return { ok: true, message: "Quote sent to customer" };
  });
}

export async function updateFulfillmentFromForm(orderId: string, form: FormData): Promise<ActionResult> {
  return updateFulfillmentStatus(orderId, String(form.get("to")) as FulfillmentStatus);
}
