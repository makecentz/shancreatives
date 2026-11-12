"use client";

import { Loader2, Upload } from "lucide-react";
import * as React from "react";
import { adminInput } from "./ui";

type Props = {
  name: string;
  defaultValue?: string | null;
  demo: boolean;
  accept?: string;
  /** Public bucket the file is uploaded to. */
  bucket?: "site-assets" | "site-videos";
  /** Largest file accepted, in megabytes. Must not exceed the bucket's own limit. */
  maxMb?: number;
  /** Show a small preview of the current file. */
  preview?: "image" | "video";
};

/** URL field with an optional direct upload to a public site bucket. */
export function AssetInput({ name, defaultValue, demo, accept = "image/png,image/jpeg,image/webp,image/svg+xml", bucket = "site-assets", maxMb = 5, preview }: Props) {
  const [value, setValue] = React.useState(defaultValue ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const kind = bucket === "site-videos" ? "video" : "image";
  async function upload(file: File | undefined) {
    if (!file) return;
    setErr(null);
    if (demo) return setErr("Uploads are disabled in demo mode.");
    const allowed = accept.split(",").map((s) => s.trim());
    if (!allowed.includes(file.type)) return setErr(`That file type isn't supported. Use ${allowed.map((t) => t.split("/")[1]?.toUpperCase()).join(" or ")}.`);
    if (file.size > maxMb * 1024 * 1024) return setErr(`Use a ${kind} up to ${maxMb} MB. This one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
    setBusy(true);
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    const path = `${name}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
    const { error } = await supabaseBrowser().storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(false);
    if (error) return setErr(/bucket not found/i.test(error.message) ? `The ${bucket} storage bucket hasn't been set up yet. Run the setup SQL in Supabase first.` : error.message);
    setValue(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`);
  }
  return (
    <div>
      <div className="flex gap-2">
        <input name={name} value={value} onChange={(e) => setValue(e.target.value)} className={adminInput} placeholder={kind === "video" ? "Upload a video or paste an https:// link" : "/brand/logo.svg or https://…"} />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-admin-border bg-white px-3 text-sm hover:bg-admin-lavender">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{busy ? "Uploading…" : "Upload"}
          <input type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {value ? <button type="button" onClick={() => setValue("")} className="h-10 shrink-0 rounded-lg px-3 text-sm text-admin-muted hover:bg-admin-lavender">Clear</button> : null}
      </div>
      {err ? <p className="mt-1 text-xs text-admin-danger">{err}</p> : null}
      {preview && value ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-admin-border bg-white">
          {preview === "video" ? (
            <video src={value} className="aspect-video w-full max-w-md object-cover" muted loop playsInline controls preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="aspect-video w-full max-w-md object-cover" />
          )}
        </div>
      ) : null}
    </div>
  );
}
