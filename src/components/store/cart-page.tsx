"use client";

import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import { useCart, type CartLine } from "./cart-context";

interface Validation {
  lines: { index: number; unitPriceCents: number; lineTotalCents: number }[];
  errors: { index: number; message: string }[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  discountMessage: string | null;
}

export function useCartValidation(lines: CartLine[], discountCode: string | null) {
  const [data, setData] = React.useState<Validation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const body = JSON.stringify({
    lines: lines.map(({ productId, variantId, quantity, customize, rush, selections }) => ({ productId, variantId, quantity, customize, rush, selections })),
    discountCode,
  });
  React.useEffect(() => {
    if (!lines.length) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for async validation
    setLoading(true);
    fetch("/api/cart/validate", { method: "POST", headers: { "content-type": "application/json" }, body, signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  return { data: lines.length ? data : null, loading };
}

export function CartPageClient() {
  const { lines, ready, setQuantity, remove } = useCart();
  const [code, setCode] = React.useState("");
  const [applied, setApplied] = React.useState<string | null>(null);
  const { data, loading } = useCartValidation(lines, applied);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore remembered code
      setApplied(window.sessionStorage.getItem("ss_discount"));
    } catch {}
  }, []);

  if (!ready) return <div className="py-24 text-center text-store-muted"><Loader2 className="mx-auto size-6 animate-spin" /></div>;

  if (!lines.length)
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-store-cream px-6 py-16 text-center">
        <ShoppingBag className="mx-auto size-8 text-store-tan-deep" />
        <h2 className="mt-4 font-heading text-xl font-bold">Your cart is empty</h2>
        <p className="mt-2 text-sm text-store-muted">Find something handmade, or start a custom creation.</p>
        <Link href="/shop" className="mt-6 inline-flex h-12 items-center rounded-full bg-store-ink px-8 text-sm font-medium text-white">Continue shopping</Link>
      </div>
    );

  const errorFor = (i: number) => data?.errors.find((e) => e.index === i)?.message;
  const priceFor = (i: number) => data?.lines.find((l) => l.index === i);
  const hasErrors = Boolean(data?.errors.length);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-store-border border-y border-store-border">
        {lines.map((l, i) => {
          const p = priceFor(i);
          const err = errorFor(i);
          return (
            <li key={l.key} className="flex gap-4 py-6 sm:gap-6">
              <Link href={`/products/${l.display.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl bg-store-cream sm:size-32">
                {l.display.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.display.imageUrl} alt="" className="h-full w-full object-contain p-2" />
                ) : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/products/${l.display.slug}`} className="font-heading font-semibold hover:underline">{l.display.name}</Link>
                    <p className="mt-0.5 text-sm text-store-muted">
                      {[l.display.variantLabel, l.customize ? "Custom" : "Ready made"].filter(Boolean).join(" · ")}
                    </p>
                    {l.display.selectionSummary.length ? (
                      <dl className="mt-2 space-y-0.5 text-xs text-store-muted">
                        {l.display.selectionSummary.map(([k, v]) => (
                          <div key={k} className="flex gap-1"><dt className="font-medium text-store-ink/70">{k}:</dt><dd className="truncate">{v}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-semibold">{formatMoney(p?.lineTotalCents ?? l.display.unitPriceCents * l.quantity)}</p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="inline-flex h-10 items-center rounded-full border border-store-border">
                    <button className="flex h-full w-10 items-center justify-center" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label={`Decrease quantity of ${l.display.name}`}><Minus className="size-3.5" /></button>
                    <span className="w-6 text-center text-sm">{l.quantity}</span>
                    <button className="flex h-full w-10 items-center justify-center" onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label={`Increase quantity of ${l.display.name}`}><Plus className="size-3.5" /></button>
                  </div>
                  <button onClick={() => remove(l.key)} className="inline-flex items-center gap-1.5 text-xs text-store-muted hover:text-store-danger"><Trash2 className="size-3.5" />Remove</button>
                </div>
                {err ? <p className="mt-2 text-xs text-store-danger" role="alert">{err}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-3xl bg-store-cream p-6 lg:sticky lg:top-28">
        <h2 className="font-heading text-lg font-bold">Order summary</h2>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim() || null;
            setApplied(c);
            try { if (c) sessionStorage.setItem("ss_discount", c); else sessionStorage.removeItem("ss_discount"); } catch {}
          }}
        >
          <label htmlFor="discount" className="sr-only">Discount code</label>
          <input id="discount" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="h-11 flex-1 rounded-full border border-store-border bg-white px-4 text-sm uppercase outline-none focus:border-store-tan" />
          <button className="h-11 rounded-full border border-store-ink px-5 text-sm font-medium hover:bg-store-ink hover:text-white">Apply</button>
        </form>
        {data?.discountMessage ? <p className="mt-2 text-xs text-store-danger" role="alert">{data.discountMessage}</p> : null}
        {data?.discountCode ? <p className="mt-2 text-xs text-store-success">Code {data.discountCode} applied.</p> : null}
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-store-muted">Subtotal</dt><dd>{data ? formatMoney(data.subtotalCents) : "—"}</dd></div>
          {data?.discountCents ? <div className="flex justify-between text-store-success"><dt>Discount</dt><dd>−{formatMoney(data.discountCents)}</dd></div> : null}
          <div className="flex justify-between"><dt className="text-store-muted">Shipping</dt><dd className="text-store-muted">Calculated at checkout</dd></div>
          <div className="flex justify-between"><dt className="text-store-muted">Tax</dt><dd className="text-store-muted">Calculated at checkout</dd></div>
          <div className="flex justify-between border-t border-store-border pt-3 text-base font-semibold">
            <dt>Estimated total</dt>
            <dd className="flex items-center gap-2">{loading ? <Loader2 className="size-4 animate-spin" /> : null}{data ? formatMoney(data.subtotalCents - data.discountCents) : "—"}</dd>
          </div>
        </dl>
        <Link
          href={hasErrors ? "#" : "/checkout"}
          aria-disabled={hasErrors}
          className={`mt-6 flex h-13 items-center justify-center rounded-full py-4 text-sm font-medium text-white ${hasErrors ? "pointer-events-none bg-store-muted" : "bg-store-ink hover:bg-black"}`}
        >
          Proceed to checkout
        </Link>
        <Link href="/shop" className="mt-3 block text-center text-sm text-store-muted underline-offset-4 hover:text-store-ink hover:underline">Continue shopping</Link>
        {hasErrors ? <p className="mt-3 text-center text-xs text-store-danger">Please fix the items marked above to continue.</p> : null}
      </aside>
    </div>
  );
}
