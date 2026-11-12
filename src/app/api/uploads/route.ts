import { randomUUID } from "node:crypto";
import { getCustomerUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { guestTokenHash } from "@/lib/guest";
import { limitOrResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

const MAX = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Checks magic bytes so a renamed file can't pose as an image. */
function sniff(buf: Uint8Array): string | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

/**
 * Private customer upload (design files, reference photos). Stored in the
 * private `customer-uploads` bucket; only the owner and authorised staff can
 * read it, via short-lived signed URLs.
 */
export async function POST(req: Request) {
  const limited = limitOrResponse(req, "uploads", 12);
  if (limited) return limited;
  if (isDemoMode()) return Response.json({ error: "Uploads are disabled in preview mode." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX) return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || type !== file.type) return Response.json({ error: "Please upload a PNG, JPG, or WebP image." }, { status: 415 });

  const user = await getCustomerUser();
  const guestHash = user ? null : await guestTokenHash(true);
  const path = `${user?.id ?? "guest"}/${randomUUID()}.${TYPES[type]}`;
  const db = supabaseAdmin();
  const { error: upErr } = await db.storage.from("customer-uploads").upload(path, bytes, { contentType: type, upsert: false });
  if (upErr) return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  const { data, error } = await db
    .from("custom_uploads")
    .insert({ owner_user_id: user?.id ?? null, guest_token_hash: guestHash, storage_path: path, mime_type: type, size_bytes: file.size, original_name: file.name.slice(0, 120) })
    .select("id")
    .single();
  if (error || !data) return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  return Response.json({ uploadId: data.id });
}
