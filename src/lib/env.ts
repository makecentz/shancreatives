/**
 * Central environment access. Server-only secrets are never read in client code;
 * only NEXT_PUBLIC_* values are safe for the browser.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Demo mode serves clearly labelled sample data so the UI can be previewed
 * before Supabase is connected. It is on when Supabase is not configured, or
 * when DEMO_MODE=true is set explicitly. In demo mode every write and every
 * payment path is disabled.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  return !isSupabaseConfigured();
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function isSquareConfigured(): boolean {
  return Boolean(
    process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID && process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
  );
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
