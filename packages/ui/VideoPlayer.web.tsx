import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
// hls.js v1 ships its class as a default export.
// eslint-disable-next-line import/no-named-as-default
import Hls, { Events } from "hls.js";
import type { VideoProps } from "./VideoPlayer.types";
import { Button, Chip, colors, styles } from "./theme";
/* eslint-disable import/no-named-as-default-member -- hls.js documents static class methods. */
export default function VideoPlayer({
  source,
  initialTime,
  portrait,
  onProgress,
  onEnd,
}: VideoProps) {
  const video = useRef<HTMLVideoElement>(null),
    hls = useRef<Hls | null>(null),
    [fullscreen, setFullscreen] = useState(false),
    [levels, setLevels] = useState<number[]>([]),
    [quality, setQuality] = useState(-1),
    [error, setError] = useState(""),
    [buffering, setBuffering] = useState(false),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false);
  const lastSaved = useRef(0),
    progressCallback = useRef(onProgress);
  progressCallback.current = onProgress;
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const ready = () => {
      el.currentTime = initialTime;
      el.play().catch(() => {});
    };
    el.addEventListener("loadedmetadata", ready, { once: true });
    if (source.url.includes(".m3u8") && Hls.isSupported()) {
      const instance = new Hls({ maxBufferLength: 25 });
      hls.current = instance;
      instance.loadSource(source.url);
      instance.attachMedia(el);
      instance.on(Events.MANIFEST_PARSED, () =>
        setLevels(instance.levels.map((level) => level.height)),
      );
      instance.on(Events.ERROR, (_event, data) => {
        if (data.fatal)
          console.warn(
            "DraBornSeries playback",
            data.type,
            data.details,
            data.response?.code,
          );
        if (data.fatal)
          setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene.");
      });
    } else {
      el.src = source.url;
    }
    return () => {
      progressCallback.current(el.currentTime);
      el.pause();
      el.removeEventListener("loadedmetadata", ready);
      hls.current?.destroy();
      el.removeAttribute("src");
      el.load();
    };
  }, [source.url, initialTime]);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === video.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  return (
    <View style={{ gap: 15 }}>
      <style>{`.dbs-player:fullscreen { width: 100vw !important; height: 100vh !important; max-height: none !important; border-radius: 0; object-fit: contain; background: black; }`}</style>
      <View
        style={{
          backgroundColor: "#000",
          borderRadius: 16,
          overflow: "hidden",
          alignItems: "center",
        }}
      >
        <video
          ref={video}
          className="dbs-player"
          controls
          playsInline
          controlsList="nodownload"
          crossOrigin={source.subtitles.length ? "anonymous" : undefined}
          style={{
            width: "100%",
            maxHeight: fullscreen ? "none" : "70vh",
            height: fullscreen ? "100vh" : undefined,
            objectFit: "contain",
            aspectRatio: fullscreen ? undefined : portrait ? "9 / 16" : "16 / 9",
            background: "#000",
          }}
          onTimeUpdate={() => {
            if (video.current && Date.now() - lastSaved.current > 15000) {
              lastSaved.current = Date.now();
              onProgress(video.current.currentTime);
            }
          }}
          onPause={() => {
            setPlaying(false);
            if (video.current) onProgress(video.current.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onEnded={onEnd}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onError={() => setError("Video bağlantısı açılamadı. Tekrar dene.")}
        >
          {source.subtitles.map((s) => (
            <track
              key={s.language}
              kind="subtitles"
              src={s.url}
              srcLang={s.language}
              label={s.label}
            />
          ))}
        </video>
      </View>
      {buffering && (
        <Text style={styles.body}>
          Video yükleniyor… Bağlantı zayıfsa kalite otomatik düşürülür.
        </Text>
      )}
      {error && <Text style={{ color: colors.orange }}>{error}</Text>}
      <View style={styles.wrap}>
        <Button
          secondary
          small
          onPress={() => {
            if (video.current)
              video.current.currentTime = Math.max(
                0,
                video.current.currentTime - 10,
              );
          }}
          icon="play-back"
        >
          -10 sn
        </Button>
        <Button
          small
          onPress={() => {
            if (playing) video.current?.pause();
            else video.current?.play().catch(() => {});
          }}
          icon={playing ? "pause" : "play"}
        >
          {playing ? "Duraklat" : "Oynat"}
        </Button>
        <Button
          secondary
          small
          onPress={() => {
            if (video.current)
              video.current.currentTime = Math.min(
                video.current.duration,
                video.current.currentTime + 10,
              );
          }}
          icon="play-forward"
        >
          +10 sn
        </Button>
        <Button
          secondary
          small
          onPress={() => {
            if (video.current) {
              video.current.muted = !muted;
              setMuted(!muted);
            }
          }}
          icon={muted ? "volume-mute" : "volume-high"}
        >
          Ses
        </Button>
        <Button
          small
          secondary
          onPress={() => {
            video.current?.requestFullscreen?.().catch(() => {});
          }}
          icon="expand"
        >
          Tam ekran
        </Button>
        {typeof document !== "undefined" &&
          document.pictureInPictureEnabled && (
            <Button
              secondary
              small
              onPress={() => {
                video.current?.requestPictureInPicture?.().catch(() => {});
              }}
            >
              PiP
            </Button>
          )}
      </View>
      <View style={styles.wrap}>
        <Chip
          label="Otomatik kalite"
          active={quality === -1}
          onPress={() => {
            if (hls.current) hls.current.currentLevel = -1;
            setQuality(-1);
          }}
        />
        {levels.map((height, index) => (
          <Chip
            key={index}
            label={`${height}p`}
            active={quality === index}
            onPress={() => {
              if (hls.current) hls.current.currentLevel = index;
              setQuality(index);
            }}
          />
        ))}
      </View>
    </View>
  );
}
