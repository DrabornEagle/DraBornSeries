import React, { useEffect, useRef, useState } from "react";
import type { InlineVideoProps } from "./InlineVideo.types";
export default function InlineVideo({
  url,
  active,
  muted = true,
  poster,
  preview = false,
  onTime,
  onReady,
  onError,
}: InlineVideoProps) {
  const ref = useRef<HTMLVideoElement>(null),
    [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      video.muted = muted;
      if (active && visible && !document.hidden) video.play().catch(() => {});
      else video.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [active, visible, muted, url]);
  return (
    <video
      ref={ref}
      src={url}
      poster={poster || undefined}
      muted={muted}
      autoPlay={active}
      playsInline
      loop
      preload="metadata"
      aria-label="Dikey video"
      onCanPlay={onReady}
      onError={onError}
      onTimeUpdate={() => {
        const el = ref.current;
        if (el) {
          onTime?.(el.currentTime);
          if (preview && el.currentTime > 7) el.currentTime = 0;
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        pointerEvents: "none",
      }}
    />
  );
}
