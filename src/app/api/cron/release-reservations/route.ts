import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isDemoMode } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Backup sweep for stock held by abandoned checkouts. Provider "expired"
 * webhooks normally release stock; this catches anything missed. Vercel Cron
 * calls it with `Authorization: Bearer $CRON_SECRET` (see vercel.json).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isDemoMode()) return NextResponse.json({ released: 0, demo: true });
  const { data, error } = await supabaseAdmin().rpc("release_expired_reservations");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ released: data });
}
