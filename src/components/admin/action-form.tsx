"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import type { ActionResult } from "@/lib/admin/actions-core";
import { cn } from "@/lib/utils";

/** Small wrapper that runs a server action and shows its result inline. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  confirm,
  variant = "primary",
  disabled,
  secondary,
  submitName,
  submitValue,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  submitLabel: string;
  className?: string;
  confirm?: string;
  variant?: "primary" | "pink" | "danger" | "outline";
  disabled?: boolean;
  /** Optional second submit button; its name/value are added to the submitted form data. */
  secondary?: { label: string; name: string; value: string };
  /** Optional name/value sent with the main submit button. */
  submitName?: string;
  submitValue?: string;
}) {
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const styles = {
    primary: "bg-gradient-to-b from-admin-purple to-admin-purple-deep text-white",
    pink: "bg-admin-pink text-white",
    danger: "bg-admin-danger text-white",
    outline: "border border-admin-border bg-white text-admin-ink hover:bg-admin-lavender",
  };
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget);
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        start(async () => setResult(await action(fd)));
      }}
    >
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" name={submitName} value={submitValue} disabled={pending || disabled} className={cn("inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-50", styles[variant])}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitLabel}
        </button>
        {secondary ? (
          <button type="submit" name={secondary.name} value={secondary.value} disabled={pending || disabled} className={cn("inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-50", styles.outline)}>
            {secondary.label}
          </button>
        ) : null}
        {result ? <span role="status" className={cn("text-sm", result.ok ? "text-admin-success" : "text-admin-danger")}>{result.ok ? result.message ?? "Saved" : result.error}</span> : null}
      </div>
    </form>
  );
}
