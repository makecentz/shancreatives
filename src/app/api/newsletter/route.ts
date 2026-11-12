import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { limitOrResponse } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const limited = limitOrResponse(req, "newsletter", 5);
  if (limited) return limited;
  const parsed = z.object({ email: z.string().trim().email().max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Please enter a valid email." }, { status: 400 });
  if (isDemoMode()) return Response.json({ message: "Newsletter signup is disabled in preview mode." }, { status: 503 });
  const { error } = await supabaseAdmin().from("newsletter_subscribers").upsert({ email: parsed.data.email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return Response.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  return Response.json({ message: "Thanks for subscribing!" });
}
