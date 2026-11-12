import "server-only";
import { Resend } from "resend";
import { isEmailConfigured, siteUrl } from "../env";
import { formatMoney } from "../money";
import { supabaseAdmin } from "../supabase/server";

export type EmailTemplate =
  | "order_confirmation"
  | "payment_confirmation"
  | "quote_ready"
  | "custom_approved"
  | "production_started"
  | "order_shipped"
  | "ready_for_pickup"
  | "pickup_completed"
  | "refund_confirmation"
  | "admin_new_order"
  | "admin_custom_request"
  | "admin_low_inventory"
  | "admin_payment_issue";

interface EmailData {
  orderNumber?: string;
  customerName?: string;
  totalCents?: number;
  link?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  pickupInstructions?: string;
  amountCents?: number;
  message?: string;
}

const SUBJECTS: Record<EmailTemplate, (d: EmailData) => string> = {
  order_confirmation: (d) => `Thank you! Order ${d.orderNumber} is confirmed`,
  payment_confirmation: (d) => `Payment received for ${d.orderNumber}`,
  quote_ready: (d) => `Your custom quote for ${d.orderNumber} is ready`,
  custom_approved: (d) => `Your design for ${d.orderNumber} is approved`,
  production_started: (d) => `We've started making ${d.orderNumber}`,
  order_shipped: (d) => `${d.orderNumber} is on its way`,
  ready_for_pickup: (d) => `${d.orderNumber} is ready for pickup`,
  pickup_completed: (d) => `Thanks for picking up ${d.orderNumber}`,
  refund_confirmation: (d) => `Refund issued for ${d.orderNumber}`,
  admin_new_order: (d) => `New order ${d.orderNumber}`,
  admin_custom_request: (d) => `New custom request ${d.orderNumber}`,
  admin_low_inventory: () => `Low inventory alert`,
  admin_payment_issue: (d) => `Payment issue on ${d.orderNumber}`,
};

const BODIES: Record<EmailTemplate, (d: EmailData) => string> = {
  order_confirmation: (d) => `Hi ${d.customerName ?? "there"}, thank you for your order! We've received it and will keep you posted at every step.${d.totalCents != null ? ` Order total: ${formatMoney(d.totalCents)}.` : ""}`,
  payment_confirmation: (d) => `We've received your payment${d.amountCents != null ? ` of ${formatMoney(d.amountCents)}` : ""}.`,
  quote_ready: (d) => `Your quote is ready${d.amountCents != null ? `: ${formatMoney(d.amountCents)}` : ""}. Review and accept it to proceed to payment.${d.message ? `\n\n${d.message}` : ""}`,
  custom_approved: () => `Your custom design has been approved and is queued for production.`,
  production_started: () => `Good news! Your order is now being handmade.`,
  order_shipped: (d) => `Your order has shipped.${d.trackingNumber ? ` Tracking number: ${d.trackingNumber}.` : ""}`,
  ready_for_pickup: (d) => `Your order is ready to collect.${d.pickupInstructions ? `\n\n${d.pickupInstructions}` : ""}`,
  pickup_completed: () => `Thanks for collecting your order. We hope you love it!`,
  refund_confirmation: (d) => `We've issued a refund${d.amountCents != null ? ` of ${formatMoney(d.amountCents)}` : ""}. It may take 5 to 10 business days to appear.`,
  admin_new_order: (d) => `${d.customerName} placed order ${d.orderNumber}${d.totalCents != null ? ` for ${formatMoney(d.totalCents)}` : ""}.`,
  admin_custom_request: (d) => `${d.customerName} submitted a custom request (${d.orderNumber}).`,
  admin_low_inventory: (d) => d.message ?? "One or more items are running low.",
  admin_payment_issue: (d) => d.message ?? `A payment on ${d.orderNumber} needs attention.`,
};

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Branded HTML matching the storefront: white, black type, warm tan accent. */
export function renderEmail(template: EmailTemplate, d: EmailData) {
  const body = escape(BODIES[template](d)).replace(/\n/g, "<br/>");
  const link = d.link ?? d.trackingUrl;
  const html = `<!doctype html><html><body style="margin:0;background:#F8F4EF;font-family:Inter,Arial,sans-serif;color:#181818">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E8E2DC;border-radius:20px">
<tr><td style="padding:28px 32px;border-bottom:1px solid #E8E2DC"><img src="${siteUrl()}/brand/logo.svg" alt="" height="36" style="vertical-align:middle"/> <span style="font-weight:700;font-size:16px;vertical-align:middle">Shagannan Shenanigans</span></td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px">${escape(SUBJECTS[template](d))}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#444">${body}</p>
${link ? `<p style="margin:28px 0 0"><a href="${escape(link)}" style="display:inline-block;background:#181818;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px">View details</a></p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #E8E2DC;font-size:12px;color:#777">Handmade with love. <span style="color:#C9AD8F">&#9829;</span></td></tr>
</table></td></tr></table></body></html>`;
  return { subject: SUBJECTS[template](d), html, text: `${SUBJECTS[template](d)}\n\n${BODIES[template](d)}${link ? `\n\n${link}` : ""}` };
}

/**
 * Sends an email and logs the outcome. Never throws: an email failure must not
 * change payment or fulfilment state. `dedupeKey` prevents duplicates when a
 * webhook is delivered more than once.
 */
export async function sendEmail(template: EmailTemplate, to: string, data: EmailData, opts: { orderId?: string; dedupeKey?: string } = {}) {
  const db = supabaseAdmin();
  if (opts.dedupeKey) {
    const { data: existing } = await db.from("email_log").select("id").eq("dedupe_key", opts.dedupeKey).maybeSingle();
    if (existing) return { skipped: true };
  }
  if (!isEmailConfigured()) {
    await db.from("email_log").insert({ template, to_email: to, order_id: opts.orderId ?? null, status: "skipped", error: "email provider not configured", dedupe_key: opts.dedupeKey ?? null });
    return { skipped: true };
  }
  try {
    const { subject, html, text } = renderEmail(template, data);
    const res = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM!, to, subject, html, text });
    await db.from("email_log").insert({ template, to_email: to, order_id: opts.orderId ?? null, status: res.error ? "failed" : "sent", provider_message_id: res.data?.id ?? null, error: res.error?.message ?? null, dedupe_key: opts.dedupeKey ?? null });
    return { ok: !res.error };
  } catch (e) {
    await db.from("email_log").insert({ template, to_email: to, order_id: opts.orderId ?? null, status: "failed", error: (e as Error).message, dedupe_key: opts.dedupeKey ?? null }).then(() => {}, () => {});
    return { ok: false };
  }
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
