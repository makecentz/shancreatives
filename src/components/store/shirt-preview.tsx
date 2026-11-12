import { cn } from "@/lib/utils";

const FONTS: Record<string, string> = {
  classic_serif: "Georgia, 'Times New Roman', serif",
  modern_sans: "var(--font-dm-sans), system-ui, sans-serif",
  handwritten: "'Brush Script MT', 'Segoe Script', cursive",
  varsity: "Impact, 'Arial Black', sans-serif",
};

/**
 * Approximate visual preview only. It is clearly labelled as such and is NOT
 * a production proof — the team sends an approved proof for custom work.
 */
export function ShirtPreview({ text, placement, font }: { text: string; placement: string; font: string }) {
  const pos =
    placement === "left_chest" ? "left-[58%] top-[34%] text-[11px] max-w-[22%]"
      : placement === "back" ? "left-1/2 top-[44%] -translate-x-1/2 text-xl max-w-[56%]"
        : "left-1/2 top-[42%] -translate-x-1/2 text-lg max-w-[56%]";
  return (
    <figure className="mb-6">
      <div className="relative mx-auto aspect-square max-w-[280px] overflow-hidden rounded-2xl bg-[#f1f1f0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demo/tee-black-folded.jpg" alt="" className="h-full w-full object-cover" />
        {text ? (
          <span className={cn("absolute break-words text-center leading-tight text-store-tan", pos)} style={{ fontFamily: FONTS[font] ?? FONTS.classic_serif }}>
            {text}
          </span>
        ) : (
          <span className="absolute left-1/2 top-[42%] -translate-x-1/2 rounded-md border border-dashed border-white/40 px-3 py-2 text-[10px] uppercase tracking-widest text-white/60">Your text</span>
        )}
        {placement === "back" || placement === "front_and_back" ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-medium">{placement === "back" ? "Back print" : "Front + back"}</span>
        ) : null}
      </div>
      <figcaption className="mt-2 text-center text-[11px] text-store-muted">
        Approximate preview only. We&rsquo;ll send a production proof for approval before printing.
      </figcaption>
    </figure>
  );
}
