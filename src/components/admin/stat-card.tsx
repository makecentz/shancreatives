import { TrendingDown, TrendingUp } from "lucide-react";
import type { Metric } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function StatCard({ icon, label, value, metric, period = "from last month" }: { icon: React.ReactNode; label: string; value: string; metric: Metric; period?: string }) {
  const up = (metric.changePct ?? 0) >= 0;
  return (
    <div className="flex flex-col rounded-2xl border border-admin-border bg-admin-lavender p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-admin-ink [&_svg]:size-8">{icon}</span>
        <p className="text-[19px] leading-6 text-admin-ink">{label}</p>
      </div>
      <p className="mt-6 text-[30px] font-semibold leading-none tracking-tight sm:text-[32px]">{value}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-admin-ink">
        {metric.changePct === null ? (
          <span className="text-admin-muted">No data for the previous period</span>
        ) : (
          <>
            {up ? <TrendingUp className="size-4 text-admin-success" /> : <TrendingDown className="size-4 text-admin-danger" />}
            <span className={cn(up ? "text-admin-success" : "text-admin-danger")}>{up ? "+" : ""}{metric.changePct}%</span>
            <span>{period}</span>
          </>
        )}
      </p>
    </div>
  );
}
