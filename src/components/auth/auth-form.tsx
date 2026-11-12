"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "reset";

/**
 * Email/password auth via Supabase. Shared by the customer account page and
 * the admin login; `tone` picks storefront or dashboard styling and
 * `redirectTo` where to go after sign-in.
 */
export function AuthForm({ tone, redirectTo, allowSignup = true }: { tone: "store" | "admin"; redirectTo: string; allowSignup?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("signin");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const s = tone === "store";
  const input = cn("h-12 w-full rounded-xl border px-4 text-sm outline-none", s ? "border-store-border focus:border-store-tan" : "border-admin-border focus:border-admin-pink");
  const primary = cn("flex h-12 w-full items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-60", s ? "rounded-full bg-store-ink hover:bg-black" : "rounded-lg bg-gradient-to-b from-admin-purple to-admin-purple-deep");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password") ?? "");
    const sb = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: String(f.get("name") ?? "") }, emailRedirectTo: `${window.location.origin}${redirectTo}` } });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Check your email to confirm your account." });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account/reset` });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode === "signup" ? <input name="name" required placeholder="Full name" aria-label="Full name" autoComplete="name" className={input} /> : null}
      <input name="email" type="email" required placeholder="Email" aria-label="Email" autoComplete="email" className={input} />
      {mode !== "reset" ? <input name="password" type="password" required minLength={8} placeholder="Password" aria-label="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} className={input} /> : null}
      <button disabled={loading} className={primary}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
      </button>
      {msg ? <p role="status" className={cn("text-sm", msg.kind === "error" ? (s ? "text-store-danger" : "text-admin-danger") : s ? "text-store-success" : "text-admin-success")}>{msg.text}</p> : null}
      <div className={cn("flex justify-between pt-1 text-xs", s ? "text-store-muted" : "text-admin-muted")}>
        {mode !== "reset" ? <button type="button" onClick={() => setMode("reset")} className="underline-offset-4 hover:underline">Forgot password?</button> : <button type="button" onClick={() => setMode("signin")} className="hover:underline">Back to sign in</button>}
        {allowSignup && mode === "signin" ? <button type="button" onClick={() => setMode("signup")} className="hover:underline">Create an account</button> : null}
        {allowSignup && mode === "signup" ? <button type="button" onClick={() => setMode("signin")} className="hover:underline">I have an account</button> : null}
      </div>
    </form>
  );
}
