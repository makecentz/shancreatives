"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");
  return (
    <form
      className={cn("mt-4 flex gap-2", compact ? "flex-col sm:flex-row lg:flex-col xl:flex-row" : "flex-col sm:flex-row")}
      onSubmit={async (e) => {
        e.preventDefault();
        setState("loading");
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        const res = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
        const json = await res.json().catch(() => ({}));
        setState(res.ok ? "done" : "error");
        setMessage(json.message ?? (res.ok ? "Thanks for subscribing!" : "Something went wrong."));
      }}
    >
      <label className="sr-only" htmlFor={compact ? "nl-footer" : "nl-main"}>Email address</label>
      <input
        id={compact ? "nl-footer" : "nl-main"}
        name="email"
        type="email"
        required
        placeholder="Your email"
        className="h-11 flex-1 rounded-full border border-store-border bg-white px-5 text-sm outline-none focus:border-store-tan"
      />
      <button disabled={state === "loading"} className="h-11 rounded-full bg-store-ink px-6 text-sm font-medium text-white hover:bg-black disabled:opacity-60">
        {state === "loading" ? "Joining…" : "Subscribe"}
      </button>
      {state === "done" || state === "error" ? (
        <p role="status" className={cn("basis-full text-xs", state === "error" ? "text-store-danger" : "text-store-success")}>{message}</p>
      ) : null}
    </form>
  );
}
