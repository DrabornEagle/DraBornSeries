import React, { useEffect, useRef, useState } from "react";
import type { InlineVideoProps } from "./InlineVideo.types";
import { getDiscoverStart, getPreviewWindow } from "../shared/preview-window";
import SubtitleOverlay from "./SubtitleOverlay";
import { preferredSubtitle } from "../shared/subtitles";
import { discoverSubtitleBottom } from "../shared/player-layout";
// eslint-disable-next-line import/no-named-as-default
import Hls, { Events } from "hls.js";
/* eslint-disable import/no-named-as-default-member -- documented Hls static API. */
export default function InlineVideo({
  url,
  active,
  muted = true,
  poster,
  preview = false,
  startFromMiddle = false,
  subtitles = [],
  onTime,
  onReady,
  onError,
  onAutoplayBlocked,
}: InlineVideoProps) {
  const [time, setTime] = useState(0);
  const ref = useRef<HTMLVideoElement>(null), range = useRef({ start: 0, end: 7 }),
    [visible, setVisible] = useState(true), [frameReady, setFrameReady] = useState(false);
  const callbacks = useRef({ onReady, onError, onTime, onAutoplayBlocked });
  callbacks.current = { onReady, onError, onTime, onAutoplayBlocked };
  useEffect(() => {
    setFrameReady(false);
    const el = ref.current; if (!el) return;
    let hls: Hls | undefined;
    if (url.includes(".m3u8") && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 12 });
      hls.loadSource(url); hls.attachMedia(el);
      hls.on(Events.ERROR, (_, data) => { if (data.fatal) callbacks.current.onError?.(); });
    } else el.src = url;
    return () => { el.pause(); hls?.destroy(); el.removeAttribute("src"); el.load(); };
  }, [url]);
  useEffect(() => { if (frameReady) callbacks.current.onReady?.(); }, [frameReady]);
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
      if (active && visible && !document.hidden) video.play().catch((error: DOMException) => { if (error.name === "NotAllowedError") callbacks.current.onAutoplayBlocked?.(); });
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
    <><video
      ref={ref}
      poster={poster || undefined}
      muted={muted}
      autoPlay={active}
      playsInline
      loop={!startFromMiddle}
      preload="metadata"
      aria-label="Dikey video"
      onLoadedMetadata={() => {
        if (startFromMiddle && ref.current) {
          ref.current.currentTime = getDiscoverStart(ref.current.duration);
        } else if (preview && ref.current) {
          range.current = getPreviewWindow(ref.current.duration);
          ref.current.currentTime = range.current.start;
        }
      }}
      onLoadedData={() => { if (!preview) setFrameReady(true); }}
      onSeeked={() => { if (ref.current && ref.current.readyState >= 2) setFrameReady(true); }}
      onPlaying={() => { if (ref.current && (!preview || ref.current.currentTime >= range.current.start)) setFrameReady(true); }}
      onError={() => { setFrameReady(false); callbacks.current.onError?.(); }}
      onEnded={() => {
        if (!startFromMiddle || !ref.current) return;
        ref.current.currentTime = getDiscoverStart(ref.current.duration);
        if (active && visible && !document.hidden) ref.current.play().catch(() => callbacks.current.onAutoplayBlocked?.());
      }}
      onTimeUpdate={() => {
        const el = ref.current;
        if (el) {
          if (subtitles.length) setTime(el.currentTime);
          callbacks.current.onTime?.(el.currentTime);
          if (preview && el.currentTime >= range.current.end) el.currentTime = range.current.start;
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: frameReady ? 1 : 0,
        transition: "opacity 180ms ease",
        pointerEvents: "none",
      }}
    />
      {frameReady && <SubtitleOverlay track={preferredSubtitle(subtitles)} time={time} bottom={startFromMiddle ? discoverSubtitleBottom : 110} />}
    </>
  );
}
