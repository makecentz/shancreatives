/**
 * Simple fixed-window rate limiter keyed by IP + route. In-memory, so it is
 * per server instance — adequate as a first line of defence on Vercel. For
 * stronger guarantees swap the store for Upstash Redis / Vercel KV (same API).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function limitOrResponse(req: Request, route: string, limit: number, windowMs = 60000): Response | null {
  const r = rateLimit(`${route}:${clientIp(req)}`, limit, windowMs);
  if (r.ok) return null;
  return Response.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429, headers: { "retry-after": String(r.retryAfter) } });
}
