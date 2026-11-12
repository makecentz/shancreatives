"use client";

import { AlertCircle, Loader2, Lock, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { formatMoney, percentOf } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";
import { useCartValidation } from "./cart-page";

interface Options {
  demo: boolean;
  rates: { id: string; name: string; amountCents: number; freeOverCents: number | null; minDays: number | null; maxDays: number | null }[];
  pickup: { id: string; name: string; addressLines: string[]; instructions: string; schedulingNote: string | null; windows: string[] }[];
  tax: { rateBps: number; taxShipping: boolean; configured: boolean };
  providers: { stripe: boolean; square: boolean };
}

const field = "h-12 w-full rounded-xl border border-store-border bg-white px-4 text-sm outline-none focus:border-store-tan";

export function CheckoutForm() {
  const { lines, ready } = useCart();
  const sp = useSearchParams();
  const [discount, setDiscount] = React.useState<string | null>(null);
  const [opts, setOpts] = React.useState<Options | null>(null);
  const [method, setMethod] = React.useState<"shipping" | "pickup">("shipping");
  const [rateId, setRateId] = React.useState<string>("");
  const [locationId, setLocationId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fallback, setFallback] = React.useState<{ orderId: string; token: string } | null>(null);
  const { data } = useCartValidation(lines, discount);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore remembered code
      setDiscount(sessionStorage.getItem("ss_discount"));
    } catch {}
    fetch("/api/checkout/options").then((r) => r.json()).then((o: Options) => {
      setOpts(o);
      setRateId(o.rates[0]?.id ?? "");
      setLocationId(o.pickup[0]?.id ?? "");
    });
  }, []);

  // Returning from a cancelled Stripe checkout: the customer may retry or explicitly choose the backup processor.
  const cancelledOrder = sp.get("cancelled");
  const cancelledToken = sp.get("t");

  const merch = data ? data.subtotalCents - data.discountCents : 0;
  const rate = opts?.rates.find((r) => r.id === rateId);
  const shipping = method === "shipping" && rate ? (rate.freeOverCents != null && merch >= rate.freeOverCents ? 0 : rate.amountCents) : 0;
  const tax = opts ? percentOf(merch + (opts.tax.taxShipping ? shipping : 0), opts.tax.rateBps) : 0;
  const total = merch + shipping + tax;

  async function pay(provider: "stripe" | "square", orderId: string, token: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/checkout/fallback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, token, provider }) });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.url) {
      window.location.href = json.url;
      return;
    }
    setSubmitting(false);
    setError(json.error ?? "Payment couldn't be started.");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFallback(null);
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    const body = {
      lines: lines.map(({ productId, variantId, quantity, customize, rush, selections }) => ({ productId, variantId, quantity, customize, rush, selections })),
      discountCode: discount,
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      notes: get("notes"),
      delivery:
        method === "shipping"
          ? { method, rateId, address: { line1: get("line1"), line2: get("line2"), city: get("city"), state: get("state"), postal_code: get("postal_code"), country: "US" } }
          : { method, locationId, window: get("window") || undefined },
    };
    const res = await fetch("/api/checkout/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.url) {
      // Cart is kept until the success page confirms payment, so a cancelled checkout loses nothing.
      window.location.href = json.url;
      return;
    }
    setSubmitting(false);
    setError(json.error ?? "We couldn't start checkout.");
    if (json.fallbackAvailable && json.orderId) setFallback({ orderId: json.orderId, token: json.token });
  }

  if (!ready) return <Loader2 className="mx-auto my-24 size-6 animate-spin text-store-muted" />;
  if (!lines.length)
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-store-cream p-12 text-center">
        <p className="font-heading text-lg font-semibold">Your cart is empty</p>
        <Link href="/shop" className="mt-6 inline-flex h-11 items-center rounded-full bg-store-ink px-6 text-sm text-white">Continue shopping</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="space-y-10">
        {opts?.demo ? (
          <div className="flex gap-3 rounded-2xl border border-store-border bg-store-cream p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p><strong>Preview mode.</strong> Checkout is disabled because the store database and payment processors aren&rsquo;t connected yet. No order will be created and no card will be charged.</p>
          </div>
        ) : null}
        {cancelledOrder && cancelledToken ? (
          <div className="rounded-2xl border border-store-border p-5 text-sm">
            <p className="font-semibold">Your payment wasn&rsquo;t completed.</p>
            <p className="mt-1 text-store-muted">Nothing was charged. You can try card checkout again{opts?.providers.square ? ", or use our backup checkout" : ""}.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={submitting} onClick={() => pay("stripe", cancelledOrder, cancelledToken)} className="h-10 rounded-full bg-store-ink px-5 text-sm text-white disabled:opacity-60">Try card checkout again</button>
              {opts?.providers.square ? (
                <button type="button" disabled={submitting} onClick={() => pay("square", cancelledOrder, cancelledToken)} className="h-10 rounded-full border border-store-ink px-5 text-sm disabled:opacity-60">Use backup checkout (Square)</button>
              ) : null}
            </div>
          </div>
        ) : null}

        <section>
          <h2 className="mb-4 font-heading text-xl font-bold">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" required autoComplete="name" placeholder="Full name" aria-label="Full name" className={cn(field, "sm:col-span-2")} />
            <input name="email" type="email" required autoComplete="email" placeholder="Email" aria-label="Email" className={field} />
            <input name="phone" type="tel" autoComplete="tel" placeholder="Phone (optional)" aria-label="Phone" className={field} />
          </div>
          <p className="mt-2 text-xs text-store-muted">Guest checkout is fine. <Link href="/account" className="underline">Sign in</Link> to track orders in your account.</p>
        </section>

        <section>
          <h2 className="mb-4 font-heading text-xl font-bold">Delivery</h2>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Delivery method">
            {([["shipping", "Ship my order", Truck], ["pickup", "Local pickup", Store]] as const).map(([m, label, Icon]) => (
              <button type="button" key={m} role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-colors", method === m ? "border-store-ink bg-store-cream" : "border-store-border hover:border-store-ink")}>
                <Icon className="size-5" />
                <span className="font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {method === "shipping" ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-6">
                <input name="line1" required autoComplete="address-line1" placeholder="Address" aria-label="Address" className={cn(field, "sm:col-span-6")} />
                <input name="line2" autoComplete="address-line2" placeholder="Apartment, suite (optional)" aria-label="Apartment or suite" className={cn(field, "sm:col-span-6")} />
                <input name="city" required autoComplete="address-level2" placeholder="City" aria-label="City" className={cn(field, "sm:col-span-3")} />
                <input name="state" required autoComplete="address-level1" placeholder="State" aria-label="State" className={cn(field, "sm:col-span-1")} />
                <input name="postal_code" required autoComplete="postal-code" placeholder="ZIP" aria-label="ZIP code" className={cn(field, "sm:col-span-2")} />
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Shipping method</legend>
                {opts?.rates.length ? opts.rates.map((r) => (
                  <label key={r.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 text-sm", rateId === r.id ? "border-store-ink" : "border-store-border")}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="rate" checked={rateId === r.id} onChange={() => setRateId(r.id)} className="accent-store-ink" />
                      <span>{r.name}{r.minDays ? <span className="block text-xs text-store-muted">{r.minDays}–{r.maxDays} business days after it ships</span> : null}</span>
                    </span>
                    <span className="font-medium">{r.freeOverCents != null && merch >= r.freeOverCents ? "Free" : formatMoney(r.amountCents)}</span>
                  </label>
                )) : <p className="text-sm text-store-muted">{opts ? "Shipping isn't available right now." : "Loading options…"}</p>}
              </fieldset>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {opts?.pickup.length ? opts.pickup.map((l) => (
                <label key={l.id} className={cn("block cursor-pointer rounded-xl border p-4 text-sm", locationId === l.id ? "border-store-ink" : "border-store-border")}>
                  <span className="flex items-start gap-3">
                    <input type="radio" name="location" checked={locationId === l.id} onChange={() => setLocationId(l.id)} className="mt-1 accent-store-ink" />
                    <span>
                      <span className="font-semibold">{l.name}</span>
                      {l.addressLines.map((a) => <span key={a} className="block text-store-muted">{a}</span>)}
                      {l.instructions ? <span className="mt-2 block text-xs">{l.instructions}</span> : null}
                    </span>
                  </span>
                </label>
              )) : <p className="text-sm text-store-muted">{opts ? "Pickup isn't available right now." : "Loading…"}</p>}
              {opts?.pickup.find((l) => l.id === locationId)?.windows.length ? (
                <div>
                  <label htmlFor="window" className="mb-2 block text-sm font-semibold">Preferred pickup window</label>
                  <select id="window" name="window" className={field}>
                    {opts.pickup.find((l) => l.id === locationId)!.windows.map((w) => <option key={w}>{w}</option>)}
                  </select>
                  {opts.pickup.find((l) => l.id === locationId)?.schedulingNote ? <p className="mt-1.5 text-xs text-store-muted">{opts.pickup.find((l) => l.id === locationId)!.schedulingNote}</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section>
          <label htmlFor="notes" className="mb-2 block text-sm font-semibold">Order notes (optional)</label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className={cn(field, "h-auto py-3")} />
        </section>
      </div>

      <aside className="h-fit rounded-3xl bg-store-cream p-6 lg:sticky lg:top-28">
        <h2 className="font-heading text-lg font-bold">Order summary</h2>
        <ul className="mt-5 space-y-4">
          {lines.map((l, i) => (
            <li key={l.key} className="flex gap-3 text-sm">
              <div className="relative size-16 shrink-0 rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.display.imageUrl ? <img src={l.display.imageUrl} alt="" className="h-full w-full object-contain p-1.5" /> : null}
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-store-ink text-[10px] text-white">{l.quantity}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{l.display.name}</p>
                <p className="truncate text-xs text-store-muted">{[l.display.variantLabel, l.customize ? "Custom" : null].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="font-medium">{formatMoney(data?.lines.find((x) => x.index === i)?.lineTotalCents ?? l.display.unitPriceCents * l.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-2.5 border-t border-store-border pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-store-muted">Subtotal</dt><dd>{data ? formatMoney(data.subtotalCents) : "—"}</dd></div>
          {data?.discountCents ? <div className="flex justify-between text-store-success"><dt>Discount ({data.discountCode})</dt><dd>−{formatMoney(data.discountCents)}</dd></div> : null}
          <div className="flex justify-between"><dt className="text-store-muted">{method === "pickup" ? "Pickup" : "Shipping"}</dt><dd>{method === "pickup" ? "Free" : rate ? (shipping ? formatMoney(shipping) : "Free") : "—"}</dd></div>
          <div className="flex justify-between"><dt className="text-store-muted">Tax</dt><dd>{opts?.tax.configured ? formatMoney(tax) : <span className="text-xs text-store-muted">Not configured</span>}</dd></div>
          <div className="flex justify-between border-t border-store-border pt-3 text-base font-semibold"><dt>Total</dt><dd>{data ? formatMoney(total) : "—"}</dd></div>
        </dl>
        {data?.errors.length ? <p className="mt-4 text-xs text-store-danger">Some items need attention. <Link href="/cart" className="underline">Review cart</Link></p> : null}
        {error ? <p className="mt-4 rounded-xl bg-white p-3 text-sm text-store-danger" role="alert">{error}</p> : null}
        {fallback ? (
          <button type="button" onClick={() => pay("square", fallback.orderId, fallback.token)} disabled={submitting} className="mt-3 h-12 w-full rounded-full border border-store-ink text-sm font-medium disabled:opacity-60">
            Pay with backup checkout (Square)
          </button>
        ) : null}
        <button disabled={submitting || opts?.demo || Boolean(data?.errors.length)} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-store-ink text-sm font-medium text-white hover:bg-black disabled:opacity-50">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          {opts?.demo ? "Checkout disabled in preview" : "Continue to secure payment"}
        </button>
        <p className="mt-3 text-center text-xs text-store-muted">Payments are processed securely by Stripe. We never see or store your card details.</p>
      </aside>
    </form>
  );
}
