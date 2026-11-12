"use client";

import { Loader2, Upload } from "lucide-react";
import * as React from "react";
import { adminInput } from "./ui";

/** URL field with an optional direct upload to the public site-assets bucket. */
export function AssetInput({ name, defaultValue, demo, accept = "image/png,image/jpeg,image/webp,image/svg+xml" }: { name: string; defaultValue?: string | null; demo: boolean; accept?: string }) {
  const [value, setValue] = React.useState(defaultValue ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  async function upload(file: File | undefined) {
    if (!file) return;
    setErr(null);
    if (demo) return setErr("Uploads are disabled in demo mode.");
    if (file.size > 5 * 1024 * 1024) return setErr("Use an image up to 5 MB.");
    setBusy(true);
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    const path = `${name}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
    const { error } = await supabaseBrowser().storage.from("site-assets").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) return setErr(error.message);
    setValue(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`);
  }
  return (
    <div>
      <div className="flex gap-2">
        <input name={name} value={value} onChange={(e) => setValue(e.target.value)} className={adminInput} placeholder="/brand/logo.svg or https://…" />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-admin-border bg-white px-3 text-sm hover:bg-admin-lavender">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Upload
          <input type="file" accept={accept} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>
      {err ? <p className="mt-1 text-xs text-admin-danger">{err}</p> : null}
    </div>
  );
}
