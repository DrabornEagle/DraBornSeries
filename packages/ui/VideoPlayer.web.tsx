import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { View, useWindowDimensions } from "react-native";
import RotateHint from "./RotateHint";
import SubtitleOverlay, { useSubtitleSelection } from "./SubtitleOverlay";
// eslint-disable-next-line import/no-named-as-default
import Hls, { Events } from "hls.js";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
import { originalQuality, subtitleBottom, videoFit } from "../shared/player-layout";
/* eslint-disable import/no-named-as-default-member -- hls.js documents static class methods. */
export default function VideoPlayer({ source, initialTime, portrait, title, onRefreshSource, onProgress, onEnd }: VideoProps) {
  const { width, height } = useWindowDimensions();
  // Keep one portal target and one media element. Changing a portal target
  // remounts its children and can interrupt playback when native fullscreen
  // is unavailable (including mobile browsers and embedded previews).
  const [portalHost] = useState(() => typeof document === "undefined" ? null : document.createElement("div"));
  const mount = useRef<React.ElementRef<typeof View>>(null);
  const captions = useSubtitleSelection(source.subtitles, source.url);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }), [fit, setFit] = useState<"contain" | "cover">("cover");
  const video = useRef<HTMLVideoElement>(null), container = useRef<React.ElementRef<typeof View>>(null), hls = useRef<Hls | null>(null),
    [fullscreen, setFullscreen] = useState(false), [viewportFullscreen, setViewportFullscreen] = useState(false), [levels, setLevels] = useState<{ width: number; height: number }[]>([]),
    [quality, setQuality] = useState("Otomatik"), [error, setError] = useState(""), [buffering, setBuffering] = useState(true),
    [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [time, setTime] = useState(initialTime),
    [duration, setDuration] = useState(0);
  const lastSaved = useRef(0), progressCallback = useRef(onProgress), currentUrl = useRef(source.url);
  const resumeAt = useRef(initialTime), resumePlaying = useRef(true), selectedQuality = useRef("auto"), loadedBase = useRef(source.url);
  progressCallback.current = onProgress;
  useLayoutEffect(() => {
    if (!portalHost) return;
    const parent = viewportFullscreen ? document.body : mount.current as unknown as HTMLElement;
    if (parent && portalHost.parentNode !== parent) {
      const el = video.current, resume = el && !el.paused;
      parent.appendChild(portalHost);
      // Some browsers pause a media node when its DOM parent changes.
      // Resume the same node without reloading or losing its playback time.
      if (resume && el) void el.play().catch(() => setPlaying(false));
    }
  }, [portalHost, viewportFullscreen]);
  useEffect(() => () => { portalHost?.remove(); }, [portalHost]);
  useEffect(() => {
    const el = video.current; if (!el) return;
    if (loadedBase.current !== source.url) { loadedBase.current = source.url; currentUrl.current = source.url; resumeAt.current = initialTime; selectedQuality.current = "auto"; }
    const mediaUrl = currentUrl.current;
    const ready = () => { el.currentTime = resumeAt.current; setDuration(el.duration); setDimensions({ width: el.videoWidth, height: el.videoHeight });
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
  }, [source.url, initialTime]);
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
  const replace = (url: string, forcePlay = false) => {
    const el = video.current; if (!el) return;
    const position = el.currentTime, resume = forcePlay || !el.paused; setError(""); setBuffering(true);
    if (url.includes(".m3u8") && hls.current) { if (url === currentUrl.current) hls.current.recoverMediaError(); else hls.current.loadSource(url); currentUrl.current = url; hls.current.startLoad(position); if (resume) void el.play().catch(() => {}); return; }
    el.addEventListener("loadedmetadata", () => { el.currentTime = position; if (resume) el.play().catch(() => {}); else setBuffering(false); }, { once: true });
    currentUrl.current = url; el.src = url; el.load();
  };
  const retry = async () => {
    setError(""); setBuffering(true);
    try { const fresh = onRefreshSource ? await onRefreshSource() : source; setQuality("Otomatik"); selectedQuality.current = "auto"; if (hls.current) hls.current.currentLevel = -1; replace(fresh.url, true); }
    catch { setBuffering(false); setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene."); }
  };
  const choices = [{ key: "auto", label: "Otomatik" }, ...(source.qualities?.length
    ? source.qualities.map((item, index) => ({ key: "r:" + index, label: item.label }))
    : levels.length ? levels.map((level, index) => ({ key: "h:" + index, label: Math.min(level.width, level.height) + "p" }))
      : [{ key: "original", label: originalQuality(dimensions.width, dimensions.height) }] )];
  const mediaPortrait = dimensions.width > 0 ? dimensions.height > dimensions.width : portrait;
  const playerView = <View ref={container} nativeID={viewportFullscreen ? "dbs-premium-player-immersive" : "dbs-premium-player"} style={{ width: "100%", alignSelf: "center", maxWidth: 420,
    maxHeight: expanded ? undefined : 760, aspectRatio: 9 / 16, overflow: "hidden", borderRadius: 22, backgroundColor: "#05020a" }}>
    <style>{`#dbs-premium-player:fullscreen, #dbs-premium-player-immersive { width: 100vw !important; height: 100dvh !important; max-height: none !important; max-width: none !important; border-radius: 0 !important; }
      #dbs-premium-player-immersive { position: fixed !important; top: 0 !important; left: 0 !important; z-index: 99999 !important; }
      #dbs-premium-player:fullscreen video, #dbs-premium-player-immersive video { object-fit: ${videoFit(true, portrait, width > height, mediaPortrait, fit)} !important; object-position: center; }
      #dbs-premium-player video::-webkit-media-controls, #dbs-premium-player-immersive video::-webkit-media-controls { display: none !important; }
      `}</style>
    <video ref={video} playsInline muted={muted} controls={false} controlsList="nodownload"
      style={{ width: "100%", height: "100%", objectFit: videoFit(expanded, portrait, width > height, mediaPortrait, fit), objectPosition: "center", background: "#05020a" }}
      onLoadedMetadata={() => { if (video.current) { setDuration(video.current.duration); setDimensions({ width: video.current.videoWidth, height: video.current.videoHeight }); } }}
      onTimeUpdate={() => { if (!video.current) return; setTime(video.current.currentTime);
        if (Date.now() - lastSaved.current > 5000) { lastSaved.current = Date.now(); onProgress(video.current.currentTime); } }}
      onPause={() => { setPlaying(false); if (video.current) onProgress(video.current.currentTime); }} onPlay={() => setPlaying(true)}
      onEnded={() => { if (video.current) onProgress(video.current.duration); onEnd(); }} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)}
      onError={() => { setBuffering(false); setError("Video bağlantısı açılamadı. Tekrar dene."); }}>
    </video>
    <SubtitleOverlay track={captions.track} time={time} bottom={subtitleBottom(expanded, controlsVisible, 0, mediaPortrait)} />
    <PlayerChrome title={title} time={time} duration={duration} playing={playing} muted={muted} loading={buffering}
      onControlsVisibilityChange={setControlsVisible}
      quality={quality} choices={choices} fullscreen={expanded} error={error} fit={fit} onFit={setFit}
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
      onRetry={() => { void retry(); }}
      onPiP={typeof document !== "undefined" && document.pictureInPictureEnabled ? () => { video.current?.requestPictureInPicture?.().catch(() => {}); } : undefined}
      subtitles={captions.choices.length ? captions.choices : undefined}
      onSubtitle={captions.select} />
    <RotateHint fullscreen={expanded} landscapeVideo={!portrait} landscapeScreen={width > height} />
  </View>;
  return <><View ref={mount} style={{ width: "100%", alignSelf: "center", maxWidth: 420, maxHeight: 760, aspectRatio: 9 / 16 }} />{portalHost ? createPortal(playerView, portalHost) : playerView}</>;
}
