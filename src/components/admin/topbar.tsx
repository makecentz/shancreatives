"use client";

import { AlertTriangle, Bell, Boxes, Clock, CreditCard, Mail, Package, Scissors, Store, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { AdminNotification } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  new_order: Package,
  custom_request: Scissors,
  low_inventory: Boxes,
  payment_failed: CreditCard,
  awaiting_production: Clock,
  pickup_waiting: Store,
  reconciliation_needed: AlertTriangle,
} as const;

const KIND_COLOR: Record<AdminNotification["kind"], string> = {
  new_order: "bg-admin-pink-soft text-admin-pink",
  custom_request: "bg-[#efe3f7] text-admin-purple",
  low_inventory: "bg-amber-100 text-amber-700",
  payment_failed: "bg-red-100 text-red-600",
  awaiting_production: "bg-blue-100 text-blue-700",
  pickup_waiting: "bg-emerald-100 text-emerald-700",
  reconciliation_needed: "bg-red-100 text-red-600",
};

export function AdminTopbar({ title, subtitle, name, roleLabel, notifications }: { title: string; subtitle?: string; name: string; roleLabel: string; notifications: AdminNotification[] }) {
  const [open, setOpen] = React.useState(false);
  const [seen, setSeen] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore per-browser read state
      setSeen(new Set(JSON.parse(localStorage.getItem("ss_admin_seen") ?? "[]")));
    } catch {}
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  const unread = notifications.filter((n) => !seen.has(n.id)).length;
  const markAll = () => {
    const s = new Set(notifications.map((n) => n.id));
    setSeen(s);
    try { localStorage.setItem("ss_admin_seen", JSON.stringify([...s])); } catch {}
  };
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pl-12 md:pl-0">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-admin-ink sm:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-3 text-[17px] text-admin-ink/85">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-5">
        <Link href="/admin/custom-orders" className="relative text-admin-ink" aria-label="Custom order requests">
          <Mail className="size-6" fill="currentColor" stroke="white" />
          {notifications.some((n) => n.kind === "custom_request") ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-admin-pink" /> : null}
        </Link>
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className="relative text-admin-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
            <Bell className="size-6" fill="currentColor" />
            {unread ? <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-admin-pink px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
          </button>
          {open ? (
            <div className="absolute right-0 top-10 z-40 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[0_18px_48px_rgba(90,19,107,0.18)]" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
                <p className="font-semibold">Notifications</p>
                <div className="flex items-center gap-3">
                  <button onClick={markAll} className="text-xs font-medium text-admin-pink hover:underline">Mark all read</button>
                  <button onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></button>
                </div>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {notifications.length ? notifications.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link href={n.link} onClick={() => setOpen(false)} className={cn("flex gap-3 px-4 py-3 hover:bg-admin-lavender", !seen.has(n.id) && "bg-admin-lavender/60")}>
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", KIND_COLOR[n.kind])}><Icon className="size-4" /></span>
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">{n.title}</span>
                          {n.body ? <span className="block truncate text-xs text-admin-muted">{n.body}</span> : null}
                        </span>
                      </Link>
                    </li>
                  );
                }) : <li className="px-4 py-10 text-center text-sm text-admin-muted">You&rsquo;re all caught up.</li>}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-admin-pink to-admin-purple text-sm font-bold text-white">{initials}</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-medium">{name}</span>
            <span className="block text-sm text-admin-ink/80">{roleLabel}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
