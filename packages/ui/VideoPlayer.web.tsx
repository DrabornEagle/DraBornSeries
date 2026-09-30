import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { View, useWindowDimensions } from "react-native";
import RotateHint from "./RotateHint";
import SubtitleOverlay, { useSubtitleSelection } from "./SubtitleOverlay";
// eslint-disable-next-line import/no-named-as-default
import Hls, { Events } from "hls.js";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
import { subtitleBottom } from "../shared/player-layout";
/* eslint-disable import/no-named-as-default-member -- hls.js documents static class methods. */
export default function VideoPlayer({ source, initialTime, portrait, title, onProgress, onEnd }: VideoProps) {
  const { width, height } = useWindowDimensions();
  const captions = useSubtitleSelection(source.subtitles, source.url);
  const [controlsVisible, setControlsVisible] = useState(true);
  const video = useRef<HTMLVideoElement>(null), container = useRef<React.ElementRef<typeof View>>(null), hls = useRef<Hls | null>(null),
    [fullscreen, setFullscreen] = useState(false), [viewportFullscreen, setViewportFullscreen] = useState(false), [levels, setLevels] = useState<{ width: number; height: number }[]>([]),
    [quality, setQuality] = useState("Otomatik"), [error, setError] = useState(""), [buffering, setBuffering] = useState(true),
    [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [time, setTime] = useState(initialTime),
    [duration, setDuration] = useState(0);
  const lastSaved = useRef(0), progressCallback = useRef(onProgress), currentUrl = useRef(source.url);
  const resumeAt = useRef(initialTime), resumePlaying = useRef(true), selectedQuality = useRef("auto"), loadedBase = useRef(source.url);
  progressCallback.current = onProgress;
  useEffect(() => {
    const el = video.current; if (!el) return;
    if (loadedBase.current !== source.url) { loadedBase.current = source.url; currentUrl.current = source.url; resumeAt.current = initialTime; selectedQuality.current = "auto"; }
    const mediaUrl = currentUrl.current;
    const ready = () => { el.currentTime = resumeAt.current; setDuration(el.duration);
      if (resumePlaying.current) el.play().catch(() => { setBuffering(false); }); else setBuffering(false); };
    el.addEventListener("loadedmetadata", ready, { once: true });
    if (mediaUrl.includes(".m3u8") && Hls.isSupported()) {
      const instance = new Hls({ maxBufferLength: 25 }); hls.current = instance;
      instance.loadSource(mediaUrl); instance.attachMedia(el);
      instance.on(Events.MANIFEST_PARSED, () => { setLevels(instance.levels.map((level) => ({ width: level.width, height: level.height })));
        if (selectedQuality.current.startsWith("h:")) instance.currentLevel = Number(selectedQuality.current.slice(2)); });
      instance.on(Events.ERROR, (_, data) => { if (data.fatal) setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene."); });
    } else { el.src = mediaUrl; }
    return () => { if (el.readyState >= 1) { resumeAt.current = el.currentTime; resumePlaying.current = !el.paused; }
      progressCallback.current(resumeAt.current); el.pause(); el.removeEventListener("loadedmetadata", ready); hls.current?.destroy(); hls.current = null; el.removeAttribute("src"); el.load(); };
  }, [source.url, initialTime, viewportFullscreen]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === (container.current as unknown as HTMLElement));
    document.addEventListener("fullscreenchange", changed); return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!viewportFullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setViewportFullscreen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", escape); };
  }, [viewportFullscreen]);
  const expanded = fullscreen || viewportFullscreen;
  const replace = (url: string) => {
    const el = video.current; if (!el) return;
    const position = el.currentTime, resume = !el.paused; setError(""); setBuffering(true);
    if (url.includes(".m3u8") && hls.current) { hls.current.recoverMediaError(); hls.current.startLoad(); return; }
    el.addEventListener("loadedmetadata", () => { el.currentTime = position; if (resume) el.play().catch(() => {}); else setBuffering(false); }, { once: true });
    currentUrl.current = url; el.src = url; el.load();
  };
  const choices = [{ key: "auto", label: "Otomatik" }, ...(source.qualities?.length
    ? source.qualities.map((item, index) => ({ key: "r:" + index, label: item.label }))
    : levels.map((level, index) => ({ key: "h:" + index, label: Math.min(level.width, level.height) + "p" })) )];
  const playerView = <View ref={container} nativeID={viewportFullscreen ? "dbs-premium-player-immersive" : "dbs-premium-player"} style={{ width: "100%", alignSelf: "center", maxWidth: 420,
    maxHeight: expanded ? undefined : 760, aspectRatio: 9 / 16, overflow: "hidden", borderRadius: 22, backgroundColor: "#05020a" }}>
    <style>{`#dbs-premium-player:fullscreen, #dbs-premium-player-immersive { width: 100vw !important; height: 100dvh !important; max-height: none !important; max-width: none !important; border-radius: 0 !important; }
      #dbs-premium-player-immersive { position: fixed !important; top: 0 !important; left: 0 !important; z-index: 99999 !important; }
      #dbs-premium-player:fullscreen video, #dbs-premium-player-immersive video { object-fit: contain !important; object-position: center; }
      #dbs-premium-player video::-webkit-media-controls, #dbs-premium-player-immersive video::-webkit-media-controls { display: none !important; }
      ${portrait ? "@media (min-aspect-ratio: 1/1) { #dbs-premium-player:fullscreen video, #dbs-premium-player-immersive video { object-fit: contain !important; background: radial-gradient(ellipse at top, #301939, #0e0918) !important; } }" : ""}`}</style>
    <video ref={video} playsInline muted={muted} controls={false} controlsList="nodownload"
      style={{ width: "100%", height: "100%", objectFit: expanded ? "contain" : "cover", objectPosition: "center", background: "#05020a" }}
      onLoadedMetadata={() => { if (video.current) setDuration(video.current.duration); }}
      onTimeUpdate={() => { if (!video.current) return; setTime(video.current.currentTime);
        if (Date.now() - lastSaved.current > 15000) { lastSaved.current = Date.now(); onProgress(video.current.currentTime); } }}
      onPause={() => { setPlaying(false); if (video.current) onProgress(video.current.currentTime); }} onPlay={() => setPlaying(true)}
      onEnded={onEnd} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)}
      onError={() => { setBuffering(false); setError("Video bağlantısı açılamadı. Tekrar dene."); }}>
    </video>
    <SubtitleOverlay track={captions.track} time={time} bottom={subtitleBottom(expanded, controlsVisible, 0, portrait)} />
    <PlayerChrome title={title} time={time} duration={duration} playing={playing} muted={muted} loading={buffering}
      onControlsVisibilityChange={setControlsVisible}
      quality={quality} choices={choices} fullscreen={expanded} error={error}
      onPlay={() => { if (playing) video.current?.pause(); else video.current?.play().catch(() => {}); }}
      onSeek={(value) => { if (video.current) { video.current.currentTime = value; setTime(value); } }}
      onMute={() => { if (video.current) { video.current.muted = !muted; setMuted(!muted); } }}
      onFullscreen={() => {
        if (viewportFullscreen) setViewportFullscreen(false);
        else if (fullscreen) document.exitFullscreen?.().catch(() => {});
        else {
          const target = container.current as unknown as HTMLElement;
          if (target?.requestFullscreen) target.requestFullscreen().catch(() => setViewportFullscreen(true));
          else setViewportFullscreen(true);
        }
      }}
      onQuality={(key) => { selectedQuality.current = key; setQuality(choices.find((choice) => choice.key === key)?.label || "Otomatik");
        if (key.startsWith("h:") && hls.current) hls.current.currentLevel = Number(key.slice(2));
        else if (key.startsWith("r:")) replace(source.qualities![Number(key.slice(2))].url);
        else { if (hls.current) hls.current.currentLevel = -1; else if (currentUrl.current !== source.url) replace(source.url); } }}
      onRetry={() => replace(currentUrl.current)}
      onPiP={typeof document !== "undefined" && document.pictureInPictureEnabled ? () => { video.current?.requestPictureInPicture?.().catch(() => {}); } : undefined}
      subtitles={captions.choices.length ? captions.choices : undefined}
      onSubtitle={captions.select} />
    <RotateHint fullscreen={expanded} landscapeVideo={!portrait} landscapeScreen={width > height} />
  </View>;
  return viewportFullscreen ? createPortal(playerView, document.body) : playerView;
}
