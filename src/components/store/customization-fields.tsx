"use client";

import { Check, Loader2, Upload } from "lucide-react";
import * as React from "react";
import { formatMoney } from "@/lib/money";
import type { CustomizationField } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Selections = Record<string, string | string[]>;

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

function delta(cents: number) {
  return cents > 0 ? ` (+${formatMoney(cents)})` : "";
}

function FileField({ field, value, onChange }: { field: CustomizationField; value?: string; onChange: (v: string | undefined) => void }) {
  const [state, setState] = React.useState<{ status: "idle" | "uploading" | "done" | "error"; name?: string; error?: string }>({ status: value ? "done" : "idle" });
  return (
    <div>
      <label className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-store-border bg-store-cream/60 p-4 transition-colors hover:border-store-tan", state.status === "done" && "border-store-success bg-white")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-store-ink ring-1 ring-store-border">
          {state.status === "uploading" ? <Loader2 className="size-4 animate-spin" /> : state.status === "done" ? <Check className="size-4 text-store-success" /> : <Upload className="size-4" />}
        </span>
        <span className="text-sm">
          <span className="block font-medium">{state.status === "done" ? state.name ?? "File uploaded" : "Choose an image"}</span>
          <span className="block text-xs text-store-muted">PNG, JPG or WebP, up to 10 MB. Kept private.</span>
        </span>
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!ACCEPT.split(",").includes(file.type)) return setState({ status: "error", error: "Please choose a PNG, JPG, or WebP image." });
            if (file.size > MAX_BYTES) return setState({ status: "error", error: "That file is larger than 10 MB." });
            setState({ status: "uploading" });
            const body = new FormData();
            body.append("file", file);
            const res = await fetch("/api/uploads", { method: "POST", body });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              onChange(undefined);
              return setState({ status: "error", error: json.error ?? "Upload failed. Please try again." });
            }
            onChange(json.uploadId);
            setState({ status: "done", name: file.name });
          }}
        />
      </label>
      {state.status === "error" ? <p className="mt-2 text-xs text-store-danger" role="alert">{state.error}</p> : null}
    </div>
  );
}

export function CustomizationFields({
  fields,
  values,
  onChange,
  errors,
}: {
  fields: CustomizationField[];
  values: Selections;
  onChange: (key: string, value: string | string[] | undefined) => void;
  errors?: Record<string, string>;
}) {
  const input = "h-12 w-full rounded-xl border border-store-border bg-white px-4 text-sm outline-none focus:border-store-tan";
  return (
    <div className="space-y-6">
      {fields.map((f) => {
        const id = `cf-${f.key}`;
        const v = values[f.key];
        return (
          <div key={f.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor={f.type === "color" || f.type === "multi_select" ? undefined : id} id={`${id}-label`} className="text-sm font-semibold">
                {f.label}
                {f.required ? <span className="text-store-danger"> *</span> : <span className="font-normal text-store-muted"> (optional)</span>}
                {f.priceDeltaCents > 0 ? <span className="font-normal text-store-muted">{delta(f.priceDeltaCents)}</span> : null}
              </label>
              {f.maxLength && (f.type === "text" || f.type === "textarea") ? (
                <span className="text-xs text-store-muted">{String(v ?? "").length}/{f.maxLength}</span>
              ) : null}
            </div>
            {f.type === "select" ? (
              <select id={id} className={input} value={(v as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value || undefined)} aria-invalid={Boolean(errors?.[f.key])}>
                <option value="">{f.required ? "Select an option" : "No preference"}</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}{delta(o.priceDeltaCents)}</option>)}
              </select>
            ) : f.type === "color" ? (
              <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2.5">
                {f.options.map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    role="radio"
                    aria-checked={v === o.value}
                    aria-label={o.label}
                    title={o.label}
                    onClick={() => onChange(f.key, v === o.value && !f.required ? undefined : o.value)}
                    className={cn("size-10 rounded-full ring-1 ring-store-border ring-offset-2 transition-all", v === o.value && "ring-2 ring-store-ink")}
                    style={{ background: o.swatch ?? "#eee" }}
                  />
                ))}
                {v ? <span className="self-center text-sm text-store-muted">{f.options.find((o) => o.value === v)?.label}</span> : null}
              </div>
            ) : f.type === "multi_select" ? (
              <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
                {f.options.map((o) => {
                  const list = Array.isArray(v) ? v : [];
                  const on = list.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      aria-pressed={on}
                      onClick={() => onChange(f.key, on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                      className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors", on ? "border-store-ink bg-store-ink text-white" : "border-store-border hover:border-store-ink")}
                    >
                      {on ? <Check className="size-3.5" /> : null}
                      {o.label}
                      {o.priceDeltaCents ? <span className={on ? "text-white/70" : "text-store-muted"}>+{formatMoney(o.priceDeltaCents)}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : f.type === "textarea" ? (
              <textarea id={id} rows={4} maxLength={f.maxLength} className={cn(input, "h-auto py-3")} value={(v as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value || undefined)} />
            ) : f.type === "file" ? (
              <FileField field={f} value={v as string | undefined} onChange={(val) => onChange(f.key, val)} />
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-3 text-sm">
                <input id={id} type="checkbox" className="size-4 accent-store-ink" checked={v === "true"} onChange={(e) => onChange(f.key, e.target.checked ? "true" : undefined)} />
                Yes
              </label>
            ) : (
              <input id={id} type={f.type === "number" ? "number" : "text"} maxLength={f.maxLength} className={input} value={(v as string) ?? ""} onChange={(e) => onChange(f.key, e.target.value || undefined)} aria-invalid={Boolean(errors?.[f.key])} />
            )}
            {f.helpText ? <p className="mt-1.5 text-xs text-store-muted">{f.helpText}</p> : null}
            {errors?.[f.key] ? <p className="mt-1.5 text-xs text-store-danger" role="alert">{errors[f.key]}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
