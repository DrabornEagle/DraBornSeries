import React, { useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView, isPictureInPictureSupported, type VideoTrack } from "expo-video";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
import { colors } from "./theme";
export default function VideoPlayer({ source, initialTime, portrait, title, onProgress, onEnd }: VideoProps) {
  const [status, setStatus] = useState("loading"), [error, setError] = useState(""),
    [tracks, setTracks] = useState<VideoTrack[]>([]), [quality, setQuality] = useState("Otomatik"),
    [muted, setMuted] = useState(false), [playing, setPlaying] = useState(true),
    [fullscreen, setFullscreen] = useState(false), [time, setTime] = useState(initialTime), [duration, setDuration] = useState(0);
  const videoView = useRef<VideoView>(null);
  const current = useRef(initialTime), lastSaved = useRef(0), resumed = useRef(false), resumeTime = useRef(initialTime),
    shouldPlay = useRef(true), progressCallback = useRef(onProgress), endCallback = useRef(onEnd);
  progressCallback.current = onProgress; endCallback.current = onEnd;
  const player = useVideoPlayer({ uri: source.url, contentType: source.url.includes(".m3u8") ? "hls" : "auto" }, (p) => { p.timeUpdateEventInterval = 0.5; });
  useEffect(() => {
    const ready = () => {
      if (player.status !== "readyToPlay") return;
      setStatus("readyToPlay"); setDuration(player.duration); setTracks(player.availableVideoTracks);
      if (!resumed.current) {
        resumed.current = true; player.currentTime = resumeTime.current;
        if (shouldPlay.current) player.play(); else player.pause();
      }
    };
    const statusSub = player.addListener("statusChange", (event) => {
      setStatus(event.status); if (event.error) setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene."); ready();
    });
    const playingSub = player.addListener("playingChange", (event) => setPlaying(event.isPlaying));
    const timeSub = player.addListener("timeUpdate", (event) => {
      current.current = event.currentTime; setTime(event.currentTime);
      if (Date.now() - lastSaved.current > 15000) { lastSaved.current = Date.now(); progressCallback.current(event.currentTime); }
    });
    const endSub = player.addListener("playToEnd", () => { progressCallback.current(current.current); endCallback.current(); });
    ready();
    return () => { statusSub.remove(); timeSub.remove(); endSub.remove(); playingSub.remove(); progressCallback.current(current.current); };
  }, [player]);
  const replace = async (url: string, forcePlay = false) => {
    resumeTime.current = current.current; shouldPlay.current = forcePlay || player.playing;
    resumed.current = false; setError(""); setStatus("loading");
    try { await player.replaceAsync({ uri: url, contentType: url.includes(".m3u8") ? "hls" : "auto" }); }
    catch { setError("Bu kalite yüklenemedi. Otomatik kaliteyi seç veya tekrar dene."); }
  };
  const choices = [{ key: "auto", label: "Otomatik" }, ...(source.qualities?.length
    ? source.qualities.map((item, index) => ({ key: "r:" + index, label: item.label }))
    : tracks.map((track, index) => ({ key: "t:" + index, label: Math.min(track.size.width, track.size.height) + "p" })) )];
  const selectQuality = (key: string) => {
    setQuality(choices.find((choice) => choice.key === key)?.label || "Otomatik");
    if (key.startsWith("r:")) { void replace(source.qualities![Number(key.slice(2))].url); }
    else if (key.startsWith("t:")) player.maxResolution = tracks[Number(key.slice(2))].size;
    else { player.maxResolution = null; if (source.qualities?.length) void replace(source.url); }
  };
  const render = (expanded: boolean) => <View style={{ flex: expanded ? 1 : undefined, backgroundColor: "#05020a", overflow: "hidden",
    borderRadius: expanded ? 0 : 22, aspectRatio: expanded ? undefined : portrait ? 9 / 16 : 16 / 9, width: "100%", alignSelf: "center", maxWidth: expanded ? undefined : portrait ? 420 : 1100, maxHeight: expanded ? undefined : 720 }}>
    <VideoView ref={videoView} player={player} style={{ width: "100%", height: "100%" }} nativeControls={false}
      contentFit="cover" surfaceType="textureView" fullscreenOptions={{ enable: false }} allowsPictureInPicture />
    <PlayerChrome title={title} time={time} duration={duration} playing={playing} muted={muted} loading={status === "loading"}
      fullscreen={expanded} quality={quality} choices={choices} error={error} onQuality={selectQuality}
      onSeek={(value) => { player.currentTime = value; current.current = value; setTime(value); }}
      onPlay={() => { if (player.playing) { player.pause(); onProgress(current.current); } else player.play(); }}
      onMute={() => { player.muted = !muted; setMuted(!muted); }} onFullscreen={() => setFullscreen(!fullscreen)}
      onRetry={() => { void replace(source.url, true); }}
      onPiP={isPictureInPictureSupported() ? () => { videoView.current?.startPictureInPicture().catch(() => setError("Bu cihazda küçük pencere başlatılamadı.")); } : undefined}
      audio={player.availableAudioTracks.length > 1 ? player.availableAudioTracks.map((item, index) => ({ key: String(index), label: item.label || item.language })) : undefined}
      onAudio={(key) => { player.audioTrack = player.availableAudioTracks[Number(key)]; }}
      subtitles={player.availableSubtitleTracks.length ? [{ key: "off", label: "Altyazı kapalı" }, ...player.availableSubtitleTracks.map((item, index) => ({ key: String(index), label: item.label || item.language }))] : undefined}
      onSubtitle={(key) => { player.subtitleTrack = key === "off" ? null : player.availableSubtitleTracks[Number(key)]; }} />
  </View>;
  return <View>
    {fullscreen ? <View style={{ aspectRatio: portrait ? 9 / 16 : 16 / 9, maxHeight: 720, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Tam ekran oynatılıyor</Text></View> : render(false)}
    <Modal visible={fullscreen} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setFullscreen(false)}>
      {fullscreen && <><StatusBar hidden />{render(true)}</>}
    </Modal>
  </View>;
}
