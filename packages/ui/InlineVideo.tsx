import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { InlineVideoProps } from "./InlineVideo.types";
import { getDiscoverStart, getPreviewWindow } from "../shared/preview-window";
import SubtitleOverlay from "./SubtitleOverlay";
import { preferredSubtitle } from "../shared/subtitles";
import { discoverSubtitleBottom } from "../shared/player-layout";
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
}: InlineVideoProps) {
  const [frameReady, setFrameReady] = useState(false);
  const [time, setTime] = useState(0);
  const callbacks = useRef({ onTime, onReady, onError });
  callbacks.current = { onTime, onReady, onError };
  const positioned = useRef(false), seeking = useRef(false), foreground = useRef(AppState.currentState === "active");
  const enabled = useRef(active); enabled.current = active;
  const source = useMemo(() => ({ uri: url, contentType: url.includes(".m3u8") ? "hls" as const : "auto" as const }), [url]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = !startFromMiddle;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => { setFrameReady(false); positioned.current = false; seeking.current = false; }, [url]);
  useEffect(() => {
    player.muted = muted;
    if (active && foreground.current) player.play();
    else player.pause();
    const sub = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      if (foreground.current && enabled.current) player.play();
      else player.pause();
    });
    return () => sub.remove();
  }, [player, active, muted]);
  useEffect(() => {
    const positionPreview = () => {
      // Seeking itself can emit loading -> readyToPlay on Android. Never seek
      // again just because buffering ended or a parent's callback changed.
      if ((preview || startFromMiddle) && !positioned.current && player.duration > 0) {
        positioned.current = true;
        player.currentTime = startFromMiddle ? getDiscoverStart(player.duration) : getPreviewWindow(player.duration).start;
      }
      if (enabled.current && foreground.current) player.play();
    };
    const time = player.addListener("timeUpdate", (e) => {
      if (subtitles.length) setTime(e.currentTime);
      callbacks.current.onTime?.(e.currentTime);
      if (preview) {
        const range = getPreviewWindow(player.duration);
        if (e.currentTime < range.end - 0.3) seeking.current = false;
        if (positioned.current && !seeking.current && e.currentTime >= range.end) {
          seeking.current = true;
          player.currentTime = range.start;
        }
      }
    });
    const ready = player.addListener("statusChange", (e) => {
      if (e.status === "readyToPlay") positionPreview();
      if (e.status === "error") { setFrameReady(false); callbacks.current.onError?.(); }
    });
    const loaded = player.addListener("sourceLoad", positionPreview);
    const ended = player.addListener("playToEnd", () => {
      if (!startFromMiddle) return;
      player.currentTime = getDiscoverStart(player.duration);
      if (enabled.current && foreground.current) player.play();
    });
    if (player.status === "readyToPlay") positionPreview();
    return () => {
      time.remove();
      ready.remove();
      loaded.remove();
      ended.remove();
    };
  }, [player, preview, startFromMiddle, url, subtitles.length]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
      <VideoView
        player={player}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={() => { setFrameReady(true); callbacks.current.onReady?.(); }}
        style={{ width: "100%", height: "100%" }}
      />
      {!frameReady && poster && <Image source={{ uri: poster }} resizeMode="cover" style={{ position: "absolute", inset: 0 }} />}
      {frameReady && <SubtitleOverlay track={preferredSubtitle(subtitles)} time={time} bottom={startFromMiddle ? discoverSubtitleBottom : 110} />}
    </View>
  );
}
