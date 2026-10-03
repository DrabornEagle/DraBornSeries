import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, View } from "react-native";
import { VideoView, type VideoPlayer } from "expo-video";
import type { InlineVideoProps } from "./InlineVideo.types";
import { getDiscoverStart, getPreviewWindow } from "../shared/preview-window";
import SubtitleOverlay from "./SubtitleOverlay";
import { preferredSubtitle } from "../shared/subtitles";
import { discoverSubtitleBottom } from "../shared/player-layout";
import { safeVideoError } from "../shared/native-video-source";
import { usePlaybackEngine } from "./usePlaybackEngine";
export default function InlineVideo(props: InlineVideoProps) {
  const interval = props.subtitles?.length || props.onTime ? 0.25 : props.preview ? 0.75 : 1;
  const handle = usePlaybackEngine(props.url, !props.startFromMiddle, props.muted ?? true, props.active ? interval : 0);
  if (!handle) return props.poster ? <Image source={{ uri: props.poster }} resizeMode="cover" style={{ position: "absolute", inset: 0 }} /> : null;
  return <ReadyInlineVideo key={handle.id} {...props} player={handle.owner.player} />;
}
function ReadyInlineVideo({
  url,
  active,
  muted = true,
  poster,
  preview = false,
  startFromMiddle = false,
  subtitleBottom = discoverSubtitleBottom,
  subtitles = [],
  onTime,
  onReady,
  onError,
  player,
}: InlineVideoProps & { player: VideoPlayer }) {
  const [frameReady, setFrameReady] = useState(false);
  const [time, setTime] = useState(0);
  const callbacks = useRef({ onTime, onReady, onError });
  callbacks.current = { onTime, onReady, onError };
  const positioned = useRef(false), seeking = useRef(false), foreground = useRef(AppState.currentState === "active");
  const enabled = useRef(active); enabled.current = active;
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
      if (e.status === "error") { console.warn("DraBornSeries: preview video error", safeVideoError(e.error)); setFrameReady(false); callbacks.current.onError?.(); }
    });
    const loaded = player.addListener("sourceLoad", positionPreview);
    const ended = player.addListener("playToEnd", () => {
      if (!startFromMiddle) return;
      player.currentTime = getDiscoverStart(player.duration);
      if (enabled.current && foreground.current) player.play();
    });
    if (player.status === "readyToPlay") positionPreview();
    if (player.status === "error") { setFrameReady(false); callbacks.current.onError?.(); }
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
      {frameReady && <SubtitleOverlay track={preferredSubtitle(subtitles)} time={time} bottom={startFromMiddle ? subtitleBottom : 110} />}
    </View>
  );
}
