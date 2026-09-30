import React, { useEffect, useState } from "react";
import { AppState, Image, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { InlineVideoProps } from "./InlineVideo.types";
import { getPreviewWindow } from "../shared/preview-window";
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
  const [frameReady, setFrameReady] = useState(false);
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 1;
  });
  useEffect(() => { setFrameReady(false); }, [url]);
  useEffect(() => {
    player.muted = muted;
    if (active) player.play();
    else player.pause();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && active) player.play();
      else player.pause();
    });
    return () => sub.remove();
  }, [player, active, muted]);
  useEffect(() => {
    const positionPreview = () => {
      if (preview) player.currentTime = getPreviewWindow(player.duration).start;
    };
    const time = player.addListener("timeUpdate", (e) => {
      onTime?.(e.currentTime);
      if (preview) {
        const range = getPreviewWindow(player.duration);
        if (e.currentTime >= range.end) player.currentTime = range.start;
      }
    });
    const ready = player.addListener("statusChange", (e) => {
      if (e.status === "readyToPlay") { positionPreview(); onReady?.(); }
      if (e.status === "error") { setFrameReady(false); onError?.(); }
    });
    if (player.status === "readyToPlay") { positionPreview(); onReady?.(); }
    return () => {
      time.remove();
      ready.remove();
    };
  }, [player, preview, onTime, onReady, onError]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
      <VideoView
        player={player}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={() => setFrameReady(true)}
        style={{ width: "100%", height: "100%" }}
      />
      {!frameReady && poster && <Image source={{ uri: poster }} resizeMode="cover" style={{ position: "absolute", inset: 0 }} />}
    </View>
  );
}
