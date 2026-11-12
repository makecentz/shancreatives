"use client";

import { ChartColumn } from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RangeKey, RevenuePoint } from "@/lib/analytics";
import { formatCompactMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1d", label: "1d" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "6m", label: "6m" },
  { key: "max", label: "Max" },
];

function TooltipPill({ active, payload }: { active?: boolean; payload?: { payload: RevenuePoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md bg-admin-purple px-3 py-1.5 text-sm font-medium text-white shadow-md">
      {formatMoney(p.revenueCents)}
      <span className="ml-1.5 text-xs text-white/70">{p.label} · {p.orders} {p.orders === 1 ? "order" : "orders"}</span>
    </div>
  );
}

export function RevenueChart({ series, defaultRange = "7d" }: { series: Record<RangeKey, RevenuePoint[]>; defaultRange?: RangeKey }) {
  const [range, setRange] = React.useState<RangeKey>(defaultRange);
  const data = series[range];
  const [active, setActive] = React.useState<number | null>(null);
  const peak = data.reduce((m, p, i) => (p.revenueCents > (data[m]?.revenueCents ?? -1) ? i : m), 0);
  const highlight = active ?? peak;
  const empty = data.every((d) => d.revenueCents === 0);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-admin-border bg-admin-lavender p-5" aria-label="Revenue chart">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[22px] font-semibold">Revenue <ChartColumn className="size-5 text-admin-pink" /></h2>
        <div className="flex items-center gap-1" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => { setRange(r.key); setActive(null); }}
              className={cn("rounded-md px-2.5 py-1 text-[15px] transition-colors", range === r.key ? "bg-admin-purple text-white" : "text-admin-ink hover:bg-admin-pink-soft")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-4 min-h-[230px] flex-1">
        {empty ? <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-admin-muted">No paid orders in this period yet.</p> : null}
        <ResponsiveContainer width="100%" height="100%" minHeight={230}>
          <BarChart data={data} margin={{ top: 28, right: 4, bottom: 0, left: 0 }} onMouseLeave={() => setActive(null)}>
            <CartesianGrid vertical={false} stroke="#e7d7e4" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#111", fontSize: data.length > 12 ? 11 : 15 }} interval={data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0} />
            <YAxis axisLine={false} tickLine={false} width={54} tick={{ fill: "#111", fontSize: 15 }} tickFormatter={(v: number) => formatCompactMoney(v)} />
            <Tooltip content={<TooltipPill />} cursor={false} />
            <Bar dataKey="revenueCents" radius={[10, 10, 10, 10]} maxBarSize={40} onMouseEnter={(_, i) => setActive(i)}>
              {data.map((d, i) => <Cell key={d.key} fill={i === highlight ? "#c2408a" : "#e3d3e1"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
