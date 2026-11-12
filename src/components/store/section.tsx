import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", align === "center" && "items-center text-center sm:flex-col sm:items-center")}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-store-rose">{eyebrow}</p> : null}
        <h2 className="font-heading text-3xl font-bold tracking-tight text-store-ink sm:text-[40px] sm:leading-[1.1]">{title}</h2>
        {description ? <p className="mt-3 text-base leading-relaxed text-store-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
