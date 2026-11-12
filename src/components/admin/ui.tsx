import { cn } from "@/lib/utils";

export function Card({ className, children, title, action }: { className?: string; children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-admin-border bg-admin-lavender p-5", className)}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function WhiteCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-admin-border bg-white p-5", className)}>{children}</section>;
}

/** Pink-header table matching the reference dashboard. */
export function DataTable({ head, children, minWidth = 720, empty }: { head: React.ReactNode[]; children: React.ReactNode; minWidth?: number; empty?: string | false }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-admin-border">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-admin-pink text-left text-[15px] text-white">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap px-4 py-3.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr:nth-child(odd)]:bg-admin-lavender [&>tr:nth-child(even)]:bg-admin-row [&>tr]:border-t [&>tr]:border-admin-border/70 [&_td]:px-4 [&_td]:py-3.5">
          {children}
          {empty ? <tr><td colSpan={head.length} className="py-10 text-center text-admin-muted">{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export const adminInput = "h-10 w-full rounded-lg border border-admin-border bg-white px-3 text-sm outline-none focus:border-admin-pink";
export const adminLabel = "mb-1.5 block text-sm font-medium";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className={adminLabel}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-admin-muted">{hint}</span> : null}
    </label>
  );
}

export function PageIntro({ children }: { children: React.ReactNode }) {
  return <p className="-mt-2 max-w-3xl text-sm text-admin-muted">{children}</p>;
}

export function Pill({ children, tone = "purple" }: { children: React.ReactNode; tone?: "purple" | "pink" | "green" | "red" | "amber" | "gray" }) {
  const tones = {
    purple: "bg-[#efe3f7] text-admin-purple",
    pink: "bg-admin-pink-soft text-admin-pink",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}
