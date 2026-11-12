"use client";

import { ArrowDownUp, Download, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { FULFILLMENT_LABELS } from "@/components/store/order-status";
import { formatMoney } from "@/lib/money";
import type { FulfillmentStatus } from "@/lib/types";
import type { OrderRow } from "./order-row";
export type { OrderRow } from "./order-row";
import { cn, formatDate } from "@/lib/utils";
import { FulfillmentText, PaymentBadge } from "./status";

type SortKey = "orderNumber" | "customer" | "product" | "date" | "total" | "status";

function csvEscape(v: string | number) {
  const raw = String(v);
  // Neutralise spreadsheet formula injection from customer-entered names.
  const s = /^[=+\-@\t\r]/.test(raw) && !/^-?\d/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function OrdersTable({ rows, variant = "full", pageSize = 25 }: { rows: OrderRow[]; variant?: "dashboard" | "full"; pageSize?: number }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) list = list.filter((r) => `${r.orderNumber} ${r.customer} ${r.email} ${r.product}`.toLowerCase().includes(needle));
    if (status) list = list.filter((r) => (status.startsWith("pay:") ? r.paymentStatus === status.slice(4) : r.fulfillmentStatus === status));
    const val = (r: OrderRow) => ({ orderNumber: r.orderNumber, customer: r.customer, product: r.product, date: r.date, total: r.totalCents, status: r.fulfillmentStatus })[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
    });
  }, [rows, q, status, sort]);

  const shown = variant === "dashboard" ? filtered.slice(0, pageSize) : filtered.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const th = (k: SortKey, children: React.ReactNode, className?: string) => (
    <th key={k} scope="col" className={cn("px-5 py-4 text-left font-medium", className)} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))} className="inline-flex items-center gap-1 whitespace-nowrap">
        {children}
        <ArrowDownUp className="size-3.5 opacity-90" />
      </button>
    </th>
  );

  function exportCsv() {
    const header = ["Order", "Customer", "Email", "Items", "Date", "Total", "Payment", "Fulfillment", "Processor", "Delivery"];
    const lines = filtered.map((r) => [r.orderNumber, r.customer, r.email, r.product, r.date, (r.totalCents / 100).toFixed(2), r.paymentStatus, r.fulfillmentStatus, r.provider ?? "", r.delivery].map(csvEscape).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 sm:max-w-xs">
          <span className="sr-only">Search orders</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-admin-muted" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search order, customer, product" className="h-10 w-full rounded-lg border border-admin-border bg-white pl-9 pr-3 text-sm outline-none focus:border-admin-pink" />
        </label>
        <label className="sr-only" htmlFor={`status-${variant}`}>Filter by status</label>
        <select id={`status-${variant}`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-admin-border bg-white px-3 text-sm outline-none focus:border-admin-pink">
          <option value="">All statuses</option>
          <optgroup label="Fulfillment">
            {(Object.keys(FULFILLMENT_LABELS) as FulfillmentStatus[]).map((s) => <option key={s} value={s}>{FULFILLMENT_LABELS[s]}</option>)}
          </optgroup>
          <optgroup label="Payment">
            <option value="pay:paid">Paid</option>
            <option value="pay:pending">Pending</option>
            <option value="pay:failed">Failed</option>
            <option value="pay:refunded">Refunded</option>
            <option value="pay:requires_reconciliation">Needs reconciliation</option>
          </optgroup>
        </select>
        {variant === "full" ? (
          <button onClick={exportCsv} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-admin-border bg-white px-4 text-sm font-medium hover:bg-admin-lavender">
            <Download className="size-4" /> Export CSV
          </button>
        ) : null}
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-admin-border">
        <table className="w-full min-w-[900px] text-[15px]">
          <thead className="bg-admin-pink text-[17px] text-white">
            <tr>
              {th("orderNumber", "Order ID")}
              {th("customer", "Customer")}
              {th("product", "Product")}
              {th("date", "Date")}
              {th("total", "Total")}
              <th scope="col" className="px-5 py-4 text-left font-medium">Payment</th>
              {th("status", "Status")}
              <th scope="col" className="px-5 py-4 text-left font-medium">Processor</th>
              <th scope="col" className="px-5 py-4 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className={cn("border-t border-admin-border/70", i % 2 === 1 ? "bg-admin-row" : "bg-admin-lavender")}>
                <td className="whitespace-nowrap px-5 py-4">#{r.orderNumber.replace(/^SS-/, "")}</td>
                <td className="px-5 py-4"><span className="block whitespace-nowrap">{r.customer}</span></td>
                <td className="px-5 py-4"><span className="flex items-center gap-2 whitespace-nowrap">{r.product}{r.isCustom ? <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-admin-purple">Custom</span> : null}</span></td>
                <td className="whitespace-nowrap px-5 py-4">{formatDate(r.date)}</td>
                <td className="whitespace-nowrap px-5 py-4">{r.totalCents ? formatMoney(r.totalCents) : "Quote"}</td>
                <td className="px-5 py-4"><PaymentBadge status={r.paymentStatus} /></td>
                <td className="whitespace-nowrap px-5 py-4"><FulfillmentText status={r.fulfillmentStatus} /></td>
                <td className="whitespace-nowrap px-5 py-4 capitalize">{r.provider ?? "—"}</td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/admin/orders/${r.id}`} className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-sm font-medium text-admin-purple ring-1 ring-admin-border hover:bg-admin-purple hover:text-white">View</Link>
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr><td colSpan={9} className="bg-admin-lavender px-5 py-12 text-center text-admin-muted">No orders match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {variant === "full" && pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-admin-muted">{filtered.length} orders</p>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-9 rounded-lg border border-admin-border px-3 disabled:opacity-40">Previous</button>
            <span>Page {page} of {pages}</span>
            <button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="h-9 rounded-lg border border-admin-border px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
