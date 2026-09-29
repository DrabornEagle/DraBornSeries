import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
// eslint-disable-next-line import/no-named-as-default
import Hls, { Events } from "hls.js";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
/* eslint-disable import/no-named-as-default-member -- hls.js documents static class methods. */
export default function VideoPlayer({ source, initialTime, portrait, title, onProgress, onEnd }: VideoProps) {
  const video = useRef<HTMLVideoElement>(null), container = useRef<React.ElementRef<typeof View>>(null), hls = useRef<Hls | null>(null),
    [fullscreen, setFullscreen] = useState(false), [levels, setLevels] = useState<{ width: number; height: number }[]>([]),
    [quality, setQuality] = useState("Otomatik"), [error, setError] = useState(""), [buffering, setBuffering] = useState(true),
    [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [time, setTime] = useState(initialTime),
    [duration, setDuration] = useState(0);
  const lastSaved = useRef(0), progressCallback = useRef(onProgress), currentUrl = useRef(source.url);
  progressCallback.current = onProgress;
  useEffect(() => {
    const el = video.current; if (!el) return;
    const ready = () => { el.currentTime = initialTime; setDuration(el.duration); el.play().catch(() => { setBuffering(false); }); };
    el.addEventListener("loadedmetadata", ready, { once: true });
    if (source.url.includes(".m3u8") && Hls.isSupported()) {
      const instance = new Hls({ maxBufferLength: 25 }); hls.current = instance;
      instance.loadSource(source.url); instance.attachMedia(el);
      instance.on(Events.MANIFEST_PARSED, () => setLevels(instance.levels.map((level) => ({ width: level.width, height: level.height }))));
      instance.on(Events.ERROR, (_, data) => { if (data.fatal) setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene."); });
    } else { el.src = source.url; }
    return () => { progressCallback.current(el.currentTime); el.pause(); el.removeEventListener("loadedmetadata", ready); hls.current?.destroy(); hls.current = null; el.removeAttribute("src"); el.load(); };
  }, [source.url, initialTime]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === (container.current as unknown as HTMLElement));
    document.addEventListener("fullscreenchange", changed); return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
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
  return <View ref={container} nativeID="dbs-premium-player" style={{ width: "100%", alignSelf: "center", maxWidth: portrait ? 420 : 1100,
    maxHeight: fullscreen ? undefined : 760, aspectRatio: portrait ? 9 / 16 : 16 / 9, overflow: "hidden", borderRadius: 22, backgroundColor: "#05020a" }}>
    <style>{`#dbs-premium-player:fullscreen { width: 100vw !important; height: 100dvh !important; max-height: none !important; max-width: none !important; border-radius: 0 !important; }
      #dbs-premium-player:fullscreen video { object-fit: cover !important; object-position: center top; }
      #dbs-premium-player video::-webkit-media-controls { display: none !important; }`}</style>
    <video ref={video} playsInline controls={false} controlsList="nodownload" crossOrigin={source.subtitles.length ? "anonymous" : undefined}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", background: "#05020a" }}
      onLoadedMetadata={() => { if (video.current) setDuration(video.current.duration); }}
      onTimeUpdate={() => { if (!video.current) return; setTime(video.current.currentTime);
        if (Date.now() - lastSaved.current > 15000) { lastSaved.current = Date.now(); onProgress(video.current.currentTime); } }}
      onPause={() => { setPlaying(false); if (video.current) onProgress(video.current.currentTime); }} onPlay={() => setPlaying(true)}
      onEnded={onEnd} onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)}
      onError={() => { setBuffering(false); setError("Video bağlantısı açılamadı. Tekrar dene."); }}>
      {source.subtitles.map((item) => <track key={item.language} kind="subtitles" src={item.url} srcLang={item.language} label={item.label} />)}
    </video>
    <PlayerChrome title={title} time={time} duration={duration} playing={playing} muted={muted} loading={buffering}
      quality={quality} choices={choices} fullscreen={fullscreen} error={error}
      onPlay={() => { if (playing) video.current?.pause(); else video.current?.play().catch(() => {}); }}
      onSeek={(value) => { if (video.current) video.current.currentTime = value; }}
      onMute={() => { if (video.current) { video.current.muted = !muted; setMuted(!muted); } }}
      onFullscreen={() => {
        if (fullscreen) document.exitFullscreen?.().catch(() => {});
        else (container.current as unknown as HTMLElement)?.requestFullscreen?.().catch(() => { setError("Tarayıcın tam ekranı desteklemiyor."); });
      }}
      onQuality={(key) => { setQuality(choices.find((choice) => choice.key === key)?.label || "Otomatik");
        if (key.startsWith("h:") && hls.current) hls.current.currentLevel = Number(key.slice(2));
        else if (key.startsWith("r:")) replace(source.qualities![Number(key.slice(2))].url);
        else { if (hls.current) hls.current.currentLevel = -1; else if (currentUrl.current !== source.url) replace(source.url); } }}
      onRetry={() => replace(currentUrl.current)}
      onPiP={typeof document !== "undefined" && document.pictureInPictureEnabled ? () => { video.current?.requestPictureInPicture?.().catch(() => {}); } : undefined}
      subtitles={source.subtitles.length ? [{ key: "off", label: "Altyazı kapalı" }, ...source.subtitles.map((item) => ({ key: item.language, label: item.label }))] : undefined}
      onSubtitle={(key) => { if (video.current) Array.from(video.current.textTracks).forEach((track) => { track.mode = track.language === key ? "showing" : "disabled"; }); }} />
  </View>;
}
