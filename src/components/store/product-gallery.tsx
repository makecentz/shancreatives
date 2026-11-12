"use client";

import * as React from "react";
import type { ProductMedia } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductGallery({ media, overlay }: { media: ProductMedia[]; overlay?: React.ReactNode }) {
  const [active, setActive] = React.useState(0);
  const current = media[active];
  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {media.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto md:flex-col" role="tablist" aria-label="Product images">
          {media.map((m, i) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn("size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-store-cream transition-colors", i === active ? "border-store-ink" : "border-transparent hover:border-store-border")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative flex-1 overflow-hidden rounded-3xl bg-store-cream">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={current.alt} className="aspect-square w-full object-contain p-6" />
        ) : (
          <div className="aspect-square" />
        )}
        {active === 0 ? overlay : null}
      </div>
    </div>
  );
}
