"use client";

import * as React from "react";

const safe = (u?: string | null) => (u && (u.startsWith("https://") || (u.startsWith("/") && !u.startsWith("//"))) ? u : null);

/**
 * Full-bleed muted background video for the homepage hero. Falls back to a
 * soft color wash when no video is set. Visitors who prefer reduced motion
 * see the still cover image instead of a playing video.
 */
export function HeroVideo({ src, poster }: { src?: string | null; poster?: string | null }) {
  const video = safe(src);
  const still = safe(poster);
  const ref = React.useRef<HTMLVideoElement>(null);
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduce(mq.matches);
      const v = ref.current;
      if (!v) return;
      if (mq.matches) v.pause();
      else v.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!video) return <div className="store-hero-wash absolute inset-0" aria-hidden />;
  return (
    <div className="absolute inset-0 bg-store-cream" aria-hidden>
      {reduce && still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" className="h-full w-full object-cover" />
      ) : (
        <video
          ref={ref}
          className="h-full w-full object-cover"
          src={video}
          poster={still ?? undefined}
          autoPlay={!reduce}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
        />
      )}
    </div>
  );
}
