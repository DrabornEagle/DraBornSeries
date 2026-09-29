import React, { useEffect } from "react";
import { AppState, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { InlineVideoProps } from "./InlineVideo.types";
export default function InlineVideo({
  url,
  active,
  muted = true,
  preview = false,
  onTime,
  onReady,
  onError,
}: InlineVideoProps) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 1;
  });
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
    const time = player.addListener("timeUpdate", (e) => {
      onTime?.(e.currentTime);
      if (preview && e.currentTime > 7) player.currentTime = 0;
    });
    const ready = player.addListener("statusChange", (e) => {
      if (e.status === "readyToPlay") onReady?.();
      if (e.status === "error") onError?.();
    });
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
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
