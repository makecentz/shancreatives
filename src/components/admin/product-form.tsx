"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { saveProduct } from "@/app/admin/actions/products";
import { productFormSchema, type ProductFormValues } from "@/lib/admin/product-schema";
import type { Category } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";
import { adminInput, adminLabel } from "./ui";

function dollarsToCents(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Math.round(parseFloat(v) * 100);
  return Number.isFinite(n) ? n : null;
}

function MoneyInput({ value, onChange, placeholder, id }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; id?: string }) {
  const [text, setText] = React.useState(value == null ? "" : (value / 100).toFixed(2));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-admin-muted">$</span>
      <input id={id} inputMode="decimal" className={cn(adminInput, "pl-6")} value={text} placeholder={placeholder} onChange={(e) => { setText(e.target.value); onChange(dollarsToCents(e.target.value)); }} />
    </div>
  );
}

function Section({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-admin-border bg-admin-lavender p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? <p className="mb-4 mt-1 text-sm text-admin-muted">{desc}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function ProductForm({ initial, categories, demo }: { initial: ProductFormValues; categories: Category[]; demo: boolean }) {
  const router = useRouter();
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>, defaultValues: initial });
  const { register, control, watch, setValue, handleSubmit, formState } = form;
  const variants = useFieldArray({ control, name: "variants" });
  const fields = useFieldArray({ control, name: "fields" });
  const media = useFieldArray({ control, name: "media" });
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fulfillment = watch("fulfillmentType");

  async function onSubmit(values: ProductFormValues) {
    setSaving(true);
    setResult(null);
    const r = await saveProduct(values);
    setSaving(false);
    setResult(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
    if (r.ok && !values.id && r.id) router.replace(`/admin/products/${r.id}/edit`);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (demo) return setResult({ ok: false, text: "Image uploads are disabled in demo mode." });
    setUploading(true);
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    const sb = supabaseBrowser();
    for (const file of Array.from(files)) {
      if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setResult({ ok: false, text: `${file.name}: use PNG, JPG, WebP or SVG up to 10 MB.` });
        continue;
      }
      const path = `${watch("slug") || "product"}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
      const { error } = await sb.storage.from("product-media").upload(path, file, { contentType: file.type });
      if (error) setResult({ ok: false, text: error.message });
      else media.append({ path, alt: watch("name") });
    }
    setUploading(false);
  }

  const err = (name: string) => {
    const parts = name.split(".");
    let e: unknown = formState.errors;
    for (const p of parts) e = (e as Record<string, unknown> | undefined)?.[p];
    const msg = (e as { message?: string } | undefined)?.message;
    return msg ? <p className="mt-1 text-xs text-admin-danger">{msg}</p> : null;
  };

  const publicUrl = (p: string) => (p.startsWith("/") || p.startsWith("http") ? p : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-media/${p}`);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className={adminLabel}>Product name</span>
              <input {...register("name", { onChange: (e) => { if (!initial.id) setValue("slug", slugify(e.target.value)); } })} className={adminInput} />{err("name")}
            </label>
            <label><span className={adminLabel}>URL slug</span><input {...register("slug")} className={adminInput} />{err("slug")}</label>
            <label><span className={adminLabel}>Short description</span><input {...register("shortDescription")} className={adminInput} /></label>
            <label className="sm:col-span-2"><span className={adminLabel}>Description</span><textarea {...register("description")} rows={5} className={cn(adminInput, "h-auto py-2")} /></label>
          </div>
        </Section>

        <Section title="Images" desc="The first image is the main photo. Transparent PNG/WebP are shown on a light background without cropping.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.fields.map((m, i) => (
              <div key={m.id} className="rounded-xl bg-white p-2 ring-1 ring-admin-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(watch(`media.${i}.path`))} alt="" className="aspect-square w-full rounded-lg object-contain" />
                <input {...register(`media.${i}.alt`)} placeholder="Alt text" aria-label="Image alt text" className="mt-2 h-8 w-full rounded border border-admin-border px-2 text-xs" />
                <div className="mt-1.5 flex justify-between">
                  <div className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => media.move(i, i - 1)} className="rounded p-1 hover:bg-admin-lavender disabled:opacity-30" aria-label="Move earlier"><ArrowUp className="size-3.5" /></button>
                    <button type="button" disabled={i === media.fields.length - 1} onClick={() => media.move(i, i + 1)} className="rounded p-1 hover:bg-admin-lavender disabled:opacity-30" aria-label="Move later"><ArrowDown className="size-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => media.remove(i)} className="rounded p-1 text-admin-danger hover:bg-red-50" aria-label="Remove image"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-white text-sm text-admin-muted hover:border-admin-pink">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              Add images
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
        </Section>

        <Section title="Pricing">
          <div className="grid gap-4 sm:grid-cols-3">
            <label><span className={adminLabel}>Regular price</span><MoneyInput value={watch("basePriceCents")} onChange={(v) => setValue("basePriceCents", v ?? 0)} /></label>
            <label><span className={adminLabel}>Sale price</span><MoneyInput value={watch("salePriceCents")} onChange={(v) => setValue("salePriceCents", v)} placeholder="None" />{err("salePriceCents")}</label>
            <label><span className={adminLabel}>Rush fee</span><MoneyInput value={watch("rushFeeCents")} onChange={(v) => setValue("rushFeeCents", v ?? 0)} /></label>
          </div>
        </Section>

        <Section title="Variants & inventory" desc="Sizes, colors and SKUs. Leave stock empty for made-to-order variants. Existing stock is adjusted on the Inventory page so every change is recorded.">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left text-xs text-admin-muted">{["SKU", "Size", "Color", "Price", "Sale", "Stock", "Low at", "Active", ""].map((h) => <th key={h} className="px-1 pb-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {variants.fields.map((v, i) => (
                  <tr key={v.id}>
                    <td className="p-1"><input {...register(`variants.${i}.sku`)} className={adminInput} aria-label="SKU" /></td>
                    <td className="p-1"><input {...register(`variants.${i}.size`)} className={adminInput} aria-label="Size" /></td>
                    <td className="p-1"><input {...register(`variants.${i}.color`)} className={adminInput} aria-label="Color" /></td>
                    <td className="w-28 p-1"><MoneyInput value={watch(`variants.${i}.priceCents`)} onChange={(x) => setValue(`variants.${i}.priceCents`, x)} placeholder="Base" /></td>
                    <td className="w-28 p-1"><MoneyInput value={watch(`variants.${i}.salePriceCents`)} onChange={(x) => setValue(`variants.${i}.salePriceCents`, x)} placeholder="—" /></td>
                    <td className="w-24 p-1">
                      <input type="number" min={0} disabled={Boolean(watch(`variants.${i}.id`))} className={adminInput} aria-label="Stock quantity" placeholder="MTO"
                        value={watch(`variants.${i}.stockQuantity`) ?? ""} onChange={(e) => setValue(`variants.${i}.stockQuantity`, e.target.value === "" ? null : parseInt(e.target.value, 10))} />
                    </td>
                    <td className="w-20 p-1"><input type="number" min={0} {...register(`variants.${i}.lowStockThreshold`, { valueAsNumber: true })} className={adminInput} aria-label="Low stock threshold" /></td>
                    <td className="p-1 text-center"><input type="checkbox" {...register(`variants.${i}.isActive`)} className="size-4 accent-admin-purple" aria-label="Active" /></td>
                    <td className="p-1"><button type="button" onClick={() => variants.remove(i)} className="rounded p-2 text-admin-danger hover:bg-red-50" aria-label="Remove variant"><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err("variants")}
          <button type="button" onClick={() => variants.append({ sku: "", size: "", color: "", priceCents: null, salePriceCents: null, stockQuantity: fulfillment === "custom" ? null : 0, lowStockThreshold: 3, isActive: true })} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-admin-border bg-white px-3 text-sm hover:bg-admin-lavender"><Plus className="size-4" />Add variant</button>
        </Section>

        {fulfillment !== "ready_made" ? (
          <Section title="Customization options" desc="Fields customers fill in when they customize this product. Options can add to the price.">
            <div className="space-y-4">
              {fields.fields.map((f, i) => (
                <FieldEditor key={f.id} index={i} form={form} onRemove={() => fields.remove(i)} />
              ))}
            </div>
            {err("fields")}
            <button type="button" onClick={() => fields.append({ key: `field_${fields.fields.length + 1}`, label: "", type: "text", required: false, helpText: "", priceDeltaCents: 0, maxLength: null, options: [] })} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-admin-border bg-white px-3 text-sm hover:bg-admin-lavender"><Plus className="size-4" />Add field</button>
          </Section>
        ) : null}

        <Section title="Search engine listing">
          <div className="grid gap-4">
            <label><span className={adminLabel}>SEO title</span><input {...register("seoTitle")} className={adminInput} maxLength={70} /></label>
            <label><span className={adminLabel}>SEO description</span><textarea {...register("seoDescription")} rows={2} maxLength={170} className={cn(adminInput, "h-auto py-2")} /></label>
          </div>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Section title="Status">
          <select {...register("status")} className={adminInput} aria-label="Status">
            <option value="draft">Draft (hidden)</option>
            <option value="active">Active (published)</option>
            <option value="out_of_stock">Out of stock (visible)</option>
            <option value="archived">Archived</option>
          </select>
          <div className="mt-4 space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...register("isFeatured")} className="size-4 accent-admin-purple" />Featured on homepage</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...register("isSeasonal")} className="size-4 accent-admin-purple" />Seasonal</label>
          </div>
        </Section>
        <Section title="Fulfillment">
          <select {...register("fulfillmentType")} className={adminInput} aria-label="Fulfillment type">
            <option value="ready_made">Ready-made only</option>
            <option value="custom">Custom-made only</option>
            <option value="both">Ready-made and customizable</option>
          </select>
          {fulfillment !== "ready_made" ? (
            <div className="mt-4 space-y-3 text-sm">
              <label className="block"><span className={adminLabel}>Customizer</span>
                <select {...register("customizerKind")} className={adminInput}>
                  <option value="generic">Standard options</option>
                  <option value="shirt">Shirt designer (with preview)</option>
                  <option value="crochet_doll">Crochet doll builder</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className={adminLabel}>Min days</span><input type="number" min={0} className={adminInput} value={watch("productionDaysMin") ?? ""} onChange={(e) => setValue("productionDaysMin", e.target.value === "" ? null : +e.target.value)} /></label>
                <label><span className={adminLabel}>Max days</span><input type="number" min={0} className={adminInput} value={watch("productionDaysMax") ?? ""} onChange={(e) => setValue("productionDaysMax", e.target.value === "" ? null : +e.target.value)} />{err("productionDaysMax")}</label>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" {...register("quoteOnly")} className="size-4 accent-admin-purple" />Requires a quote before payment</label>
              <label className="flex items-center gap-2"><input type="checkbox" {...register("rushAvailable")} className="size-4 accent-admin-purple" />Offer rush production</label>
            </div>
          ) : null}
        </Section>
        <Section title="Categories">
          <div className="space-y-2 text-sm">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" value={c.id} {...register("categoryIds")} className="size-4 accent-admin-purple" />{c.name}
              </label>
            ))}
          </div>
        </Section>
        <div className="rounded-2xl border border-admin-border bg-white p-5">
          <button disabled={saving || demo} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-admin-purple to-admin-purple-deep text-sm font-medium text-white disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {demo ? "Saving disabled in demo" : "Save product"}
          </button>
          {result ? <p role="status" className={cn("mt-3 text-sm", result.ok ? "text-admin-success" : "text-admin-danger")}>{result.text}</p> : null}
          {Object.keys(formState.errors).length ? <p className="mt-3 text-sm text-admin-danger">Please fix the highlighted fields.</p> : null}
        </div>
      </div>
    </form>
  );
}

function FieldEditor({ index, form, onRemove }: { index: number; form: ReturnType<typeof useForm<ProductFormValues>>; onRemove: () => void }) {
  const { register, control, watch } = form;
  const options = useFieldArray({ control, name: `fields.${index}.options` });
  const type = watch(`fields.${index}.type`);
  const hasOptions = type === "select" || type === "multi_select" || type === "color";
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-admin-border">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
        <label><span className={adminLabel}>Label</span><input {...register(`fields.${index}.label`)} className={adminInput} /></label>
        <label><span className={adminLabel}>Key</span><input {...register(`fields.${index}.key`)} className={adminInput} /></label>
        <label><span className={adminLabel}>Type</span>
          <select {...register(`fields.${index}.type`)} className={adminInput}>
            {["text", "textarea", "select", "multi_select", "color", "file", "number", "checkbox"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </label>
        <button type="button" onClick={onRemove} className="self-end rounded-lg p-2.5 text-admin-danger hover:bg-red-50" aria-label="Remove field"><Trash2 className="size-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" {...register(`fields.${index}.required`)} className="size-4 accent-admin-purple" />Required</label>
        <label className="flex items-center gap-2">Surcharge ¢ <input type="number" min={0} {...register(`fields.${index}.priceDeltaCents`, { valueAsNumber: true })} className="h-8 w-24 rounded border border-admin-border px-2" /></label>
        <input {...register(`fields.${index}.helpText`)} placeholder="Help text" className="h-8 flex-1 rounded border border-admin-border px-2" aria-label="Help text" />
      </div>
      {hasOptions ? (
        <div className="mt-3 space-y-2">
          {options.fields.map((o, j) => (
            <div key={o.id} className="flex flex-wrap gap-2">
              <input {...register(`fields.${index}.options.${j}.label`)} placeholder="Option label" className="h-8 flex-1 rounded border border-admin-border px-2 text-sm" aria-label="Option label" />
              <input {...register(`fields.${index}.options.${j}.value`)} placeholder="value" className="h-8 w-32 rounded border border-admin-border px-2 text-sm" aria-label="Option value" />
              <input type="number" min={0} {...register(`fields.${index}.options.${j}.priceDeltaCents`, { valueAsNumber: true })} placeholder="+¢" className="h-8 w-24 rounded border border-admin-border px-2 text-sm" aria-label="Option surcharge in cents" />
              {type === "color" ? <input {...register(`fields.${index}.options.${j}.swatch`)} placeholder="#hex" className="h-8 w-24 rounded border border-admin-border px-2 text-sm" aria-label="Swatch color" /> : null}
              <button type="button" onClick={() => options.remove(j)} className="px-2 text-admin-danger" aria-label="Remove option"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={() => options.append({ value: "", label: "", priceDeltaCents: 0 })} className="text-sm font-medium text-admin-pink hover:underline">+ Add option</button>
        </div>
      ) : null}
    </div>
  );
}
