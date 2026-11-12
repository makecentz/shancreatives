import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Reusable brand mark. `src` comes from site_content (uploaded in
 * /admin/content). The existing crowned-S company logo is the default; when no
 * logo is set the wordmark renders as clean text.
 */
export function Logo({
  src,
  tone = "dark",
  showWordmark = true,
  className,
  href = "/",
}: {
  src: string | null;
  tone?: "dark" | "light";
  showWordmark?: boolean;
  className?: string;
  href?: string | null;
}) {
  const mark = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "light" && src === "/brand/logo.svg" ? "/brand/logo-white.svg" : src}
      alt=""
      className="h-full w-auto object-contain"
    />
  ) : null;
  const content = (
    <span className={cn("inline-flex h-11 items-center gap-2.5", className)}>
      {mark}
      {showWordmark || !mark ? (
        <span className={cn("font-heading leading-none", tone === "light" ? "text-white" : "text-store-ink")}>
          <span className="block text-[17px] font-bold tracking-tight">Shagannan</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.28em] opacity-70">Shenanigans</span>
        </span>
      ) : null}
      <span className="sr-only">Shagannan Shenanigans home</span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}
