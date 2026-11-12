"use client";

import { Check, Clock, Minus, PackageCheck, Plus, Store, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { availableStock } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { PricingError, priceLine, variantCompareAtPrice } from "@/lib/pricing";
import type { Product, ProductVariant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";
import { CustomizationFields, type Selections } from "./customization-fields";
import { ShirtPreview } from "./shirt-preview";

function unique<T>(arr: (T | null)[]) {
  return [...new Set(arr.filter((x): x is T => x !== null))];
}

export function ProductPurchase({ product, productionEstimate, demo }: { product: Product; productionEstimate: string | null; demo: boolean }) {
  const router = useRouter();
  const { add } = useCart();
  const variants = product.variants.filter((v) => v.isActive);
  const sizes = unique(variants.map((v) => v.size));
  const colors = unique(variants.map((v) => v.color));
  const [size, setSize] = React.useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = React.useState<string | null>(colors[0] ?? null);
  const [qty, setQty] = React.useState(1);
  const [mode, setMode] = React.useState<"ready" | "custom">(product.fulfillmentType === "custom" ? "custom" : "ready");
  const [selections, setSelections] = React.useState<Selections>({});
  const [rush, setRush] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [added, setAdded] = React.useState(false);
  const [quoteState, setQuoteState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [quoteMsg, setQuoteMsg] = React.useState("");

  const variant: ProductVariant | null =
    variants.length === 1 ? variants[0] : variants.find((v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true)) ?? null;

  const customize = mode === "custom";
  const stock = variant ? availableStock(variant) : null;
  // Made-to-order (custom) lines don't consume finished stock.
  const soldOut = !customize && variant != null && stock !== null && stock <= 0;
  const lowStock = !customize && stock !== null && stock > 0 && stock <= (variant?.lowStockThreshold ?? 0);

  let priced: ReturnType<typeof priceLine> | null = null;
  let priceErr: string | null = null;
  try {
    priced = priceLine(product, variant ?? (variants.length ? null : null), qty, { customize, selections, rush });
  } catch (e) {
    priceErr = e instanceof PricingError ? e.message : "Unavailable";
  }
  const compareAt = variantCompareAtPrice(product, variant);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (sizes.length && !size) errs.__size = "Please choose a size";
    if (customize) {
      for (const f of product.customizationFields) {
        const v = selections[f.key];
        if (f.required && (v === undefined || v === "" || (Array.isArray(v) && !v.length))) errs[f.key] = `${f.label} is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function addToCart(goToCheckout: boolean) {
    if (!validate()) return;
    if (!priced) {
      setErrors({ __price: priceErr ?? "Please complete your selections" });
      return;
    }
    const summary: [string, string][] = Object.entries(priced.snapshot).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(", ") : product.customizationFields.find((f) => f.label === k)?.type === "file" ? "Image uploaded" : v,
    ]);
    add({
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: qty,
      customize,
      rush,
      selections,
      display: {
        name: product.name,
        slug: product.slug,
        imageUrl: product.media[0]?.url ?? null,
        variantLabel: [variant?.color, variant?.size].filter(Boolean).join(" / ") || null,
        unitPriceCents: priced.unitPriceCents + priced.customizationCents + priced.rushCents,
        selectionSummary: summary,
      },
    });
    if (goToCheckout) router.push("/checkout");
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    }
  }

  async function requestQuote() {
    if (!validate()) return;
    setQuoteState("sending");
    const form = document.getElementById("quote-contact") as HTMLFormElement | null;
    const fd = form ? new FormData(form) : new FormData();
    const res = await fetch("/api/custom-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: product.id, variantId: variant?.id ?? null, quantity: qty, selections, rush, name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") }),
    });
    const json = await res.json().catch(() => ({}));
    setQuoteState(res.ok ? "sent" : "error");
    setQuoteMsg(json.message ?? json.error ?? "");
  }

  const pill = (on: boolean) =>
    cn("inline-flex h-11 min-w-12 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors", on ? "border-store-ink bg-store-ink text-white" : "border-store-border hover:border-store-ink");

  return (
    <div className="space-y-8">
      {/* Price */}
      <div className="flex items-baseline gap-3">
        {product.quoteOnly ? (
          <p className="font-heading text-2xl font-bold">From {formatMoney(product.basePriceCents)}</p>
        ) : (
          <>
            <p className="font-heading text-3xl font-bold">{priced ? formatMoney(priced.lineTotalCents / qty) : formatMoney(product.salePriceCents ?? product.basePriceCents)}</p>
            {compareAt && !customize ? <p className="text-lg text-store-muted line-through">{formatMoney(compareAt)}</p> : null}
            {priced && qty > 1 ? <p className="text-sm text-store-muted">each &middot; {formatMoney(priced.lineTotalCents)} total</p> : null}
          </>
        )}
      </div>

      {/* Ready-made vs customize */}
      {product.fulfillmentType === "both" ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-store-cream p-1.5" role="radiogroup" aria-label="Order type">
          {(["ready", "custom"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("rounded-xl px-4 py-3 text-left text-sm transition-colors", mode === m ? "bg-white shadow-sm" : "text-store-muted hover:text-store-ink")}>
              <span className="block font-semibold text-store-ink">{m === "ready" ? "Ready made" : "Customize it"}</span>
              <span className="block text-xs">{m === "ready" ? "Ships from stock" : `Made for you${productionEstimate ? ` in ${productionEstimate}` : ""}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Variant pickers */}
      {colors.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Color: <span className="font-normal text-store-muted">{color}</span></p>
          <div className="flex flex-wrap gap-2">{colors.map((c) => <button key={c} className={pill(color === c)} onClick={() => setColor(c)} aria-pressed={color === c}>{c}</button>)}</div>
        </div>
      ) : null}
      {sizes.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Size{size ? <span className="font-normal text-store-muted">: {size}</span> : null}</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const v = variants.find((x) => x.size === s && (colors.length ? x.color === color : true));
              const out = !customize && v && availableStock(v) === 0;
              return (
                <button key={s} className={cn(pill(size === s), out && "text-store-muted line-through")} onClick={() => setSize(s)} aria-pressed={size === s} aria-label={`${s}${out ? ", sold out" : ""}`}>
                  {s}
                </button>
              );
            })}
          </div>
          {errors.__size ? <p className="mt-2 text-xs text-store-danger" role="alert">{errors.__size}</p> : null}
        </div>
      ) : null}

      {/* Customization */}
      {customize && product.customizationFields.length ? (
        <div className="rounded-3xl border border-store-border p-5 sm:p-6">
          <h2 className="mb-5 font-heading text-lg font-bold">{product.customizerKind === "crochet_doll" ? "Design your doll" : product.customizerKind === "shirt" ? "Design your shirt" : "Personalize it"}</h2>
          {product.customizerKind === "shirt" && "custom_text" in Object.fromEntries(product.customizationFields.map((f) => [f.key, 1])) ? (
            <ShirtPreview text={(selections.custom_text as string) ?? ""} placement={(selections.text_placement as string) ?? "front_center"} font={(selections.font_style as string) ?? "classic_serif"} />
          ) : null}
          <CustomizationFields
            fields={product.customizationFields}
            values={selections}
            errors={errors}
            onChange={(k, v) => setSelections((cur) => { const n = { ...cur }; if (v === undefined) delete n[k]; else n[k] = v; return n; })}
          />
          {product.rushAvailable ? (
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-store-cream p-4 text-sm">
              <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} className="mt-0.5 size-4 accent-store-ink" />
              <span><span className="font-semibold">Rush production</span> (+{formatMoney(product.rushFeeCents)})<span className="block text-xs text-store-muted">We&rsquo;ll prioritize your order in the production queue.</span></span>
            </label>
          ) : null}
        </div>
      ) : null}

      {/* Quantity */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex h-12 items-center rounded-full border border-store-border">
          <button className="flex h-full w-12 items-center justify-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="size-4" /></button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</span>
          <button className="flex h-full w-12 items-center justify-center" onClick={() => setQty((q) => Math.min(customize || stock === null ? 50 : Math.max(1, stock), q + 1))} aria-label="Increase quantity"><Plus className="size-4" /></button>
        </div>
        <p className="text-sm text-store-muted">
          {customize ? <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />Made to order{productionEstimate ? `: ${productionEstimate}` : ""}</span>
            : soldOut ? "Sold out"
            : lowStock ? <span className="text-store-danger">Only {stock} left</span>
            : stock !== null ? <span className="inline-flex items-center gap-1.5 text-store-success"><PackageCheck className="size-4" />In stock, ready to ship</span>
            : null}
        </p>
      </div>

      {/* Order summary for custom builds */}
      {customize && priced && !product.quoteOnly ? (
        <div className="rounded-2xl bg-store-cream p-5 text-sm">
          <p className="mb-3 font-semibold">Your selections</p>
          <dl className="space-y-1.5">
            {Object.entries(priced.snapshot).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-store-muted">{k}</dt><dd className="text-right">{Array.isArray(v) ? v.join(", ") : product.customizationFields.find((f) => f.label === k)?.type === "file" ? "Image uploaded" : v}</dd></div>
            ))}
            <div className="flex justify-between gap-4 border-t border-store-border pt-2"><dt className="text-store-muted">Base price</dt><dd>{formatMoney(priced.unitPriceCents)}</dd></div>
            {priced.customizationCents ? <div className="flex justify-between gap-4"><dt className="text-store-muted">Customization</dt><dd>+{formatMoney(priced.customizationCents)}</dd></div> : null}
            {priced.rushCents ? <div className="flex justify-between gap-4"><dt className="text-store-muted">Rush</dt><dd>+{formatMoney(priced.rushCents)}</dd></div> : null}
            <div className="flex justify-between gap-4 font-semibold"><dt>Total ({qty})</dt><dd>{formatMoney(priced.lineTotalCents)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-store-muted">Final price is confirmed at checkout. Taxes and shipping are calculated there.</p>
        </div>
      ) : null}

      {/* Actions */}
      {product.quoteOnly ? (
        <div className="space-y-4 rounded-3xl border border-store-border p-5 sm:p-6">
          <h2 className="font-heading text-lg font-bold">Request a quote</h2>
          <p className="text-sm text-store-muted">Every keepsake is unique, so we&rsquo;ll review your request and email a quote. You only pay after you accept it.</p>
          {quoteState === "sent" ? (
            <p className="flex items-center gap-2 rounded-xl bg-store-cream p-4 text-sm"><Check className="size-4 text-store-success" />{quoteMsg || "Request received! We'll be in touch soon."}</p>
          ) : (
            <form id="quote-contact" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); requestQuote(); }}>
              <input name="name" required placeholder="Your name" aria-label="Your name" className="h-12 rounded-xl border border-store-border px-4 text-sm outline-none focus:border-store-tan" />
              <input name="email" type="email" required placeholder="Email" aria-label="Email" className="h-12 rounded-xl border border-store-border px-4 text-sm outline-none focus:border-store-tan" />
              <input name="phone" placeholder="Phone (optional)" aria-label="Phone" className="h-12 rounded-xl border border-store-border px-4 text-sm outline-none focus:border-store-tan sm:col-span-2" />
              <button disabled={quoteState === "sending"} className="h-13 rounded-full bg-store-ink py-4 text-sm font-medium text-white hover:bg-black disabled:opacity-60 sm:col-span-2">
                {quoteState === "sending" ? "Sending…" : "Submit custom request"}
              </button>
              {quoteState === "error" ? <p className="text-sm text-store-danger sm:col-span-2" role="alert">{quoteMsg || "We couldn't send your request."}</p> : null}
            </form>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => addToCart(false)}
            disabled={soldOut}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-store-ink text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            {added ? <><Check className="size-4" />Added to cart</> : soldOut ? "Sold out" : "Add to cart"}
          </button>
          <button
            onClick={() => addToCart(true)}
            disabled={soldOut}
            className="inline-flex h-14 flex-1 items-center justify-center rounded-full border border-store-ink text-sm font-medium transition-colors hover:bg-store-ink hover:text-white disabled:opacity-50"
          >
            Buy now
          </button>
        </div>
      )}
      {errors.__price ? <p className="text-sm text-store-danger" role="alert">{errors.__price}</p> : null}
      {demo ? <p className="text-xs text-store-muted">Preview mode: you can build a cart, but checkout stays disabled until payments are connected.</p> : null}

      {/* Delivery info */}
      <div className="grid gap-3 border-t border-store-border pt-6 text-sm sm:grid-cols-2">
        <div className="flex gap-3"><Truck className="mt-0.5 size-5 shrink-0 text-store-tan-deep" /><div><p className="font-semibold">Shipping</p><p className="text-store-muted">Rates shown at checkout. Custom pieces ship once made.</p></div></div>
        <div className="flex gap-3"><Store className="mt-0.5 size-5 shrink-0 text-store-tan-deep" /><div><p className="font-semibold">Local pickup</p><p className="text-store-muted">Choose pickup at checkout; we&rsquo;ll email when it&rsquo;s ready.</p></div></div>
      </div>
    </div>
  );
}
