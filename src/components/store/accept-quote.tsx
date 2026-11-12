"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

export function AcceptQuoteButton({ orderId, token }: { orderId: string; token: string }) {
  const [state, setState] = React.useState<{ loading: boolean; error?: string }>({ loading: false });
  return (
    <div className="mt-6">
      <button
        disabled={state.loading}
        onClick={async () => {
          setState({ loading: true });
          const res = await fetch("/api/quotes/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, token }) });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.url) window.location.href = json.url;
          else setState({ loading: false, error: json.error ?? "Couldn't start payment." });
        }}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-store-ink py-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {state.loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Accept quote and pay
      </button>
      {state.error ? <p className="mt-3 text-sm text-store-danger" role="alert">{state.error}</p> : null}
      <p className="mt-3 text-center text-xs text-store-muted">You&rsquo;ll be taken to our secure payment page.</p>
    </div>
  );
}
