import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, Text, View, useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView, isPictureInPictureSupported, type VideoTrack } from "expo-video";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
import { colors } from "./theme";
import RotateHint from "./RotateHint";
import SubtitleOverlay, { useSubtitleSelection } from "./SubtitleOverlay";
import { isTurkish } from "../shared/subtitles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subtitleBottom, videoFit } from "../shared/player-layout";
// Serialize orientation changes so closing quickly cannot leave ALL applied.
let orientationQueue = Promise.resolve();
export default function VideoPlayer({ source, initialTime, portrait, title, showRotateHint = false, onProgress, onEnd }: VideoProps) {
  const [status, setStatus] = useState("loading"), [error, setError] = useState(""),
    [tracks, setTracks] = useState<VideoTrack[]>([]), [quality, setQuality] = useState("Otomatik"),
    [muted, setMuted] = useState(false), [playing, setPlaying] = useState(true),
    [fullscreen, setFullscreen] = useState(false), [time, setTime] = useState(initialTime), [duration, setDuration] = useState(0);
  const videoView = useRef<VideoView>(null);
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const foreground = useRef(AppState.currentState === "active");
  const captions = useSubtitleSelection(source.subtitles, source.url), manualSubtitles = useRef(false);
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (!fullscreen && !(showRotateHint && !portrait)) return;
    let previous = ScreenOrientation.OrientationLock.PORTRAIT_UP;
    orientationQueue = orientationQueue.then(async () => {
      previous = await ScreenOrientation.getOrientationLockAsync();
      await ScreenOrientation.lockAsync(portrait ? ScreenOrientation.OrientationLock.PORTRAIT_UP : ScreenOrientation.OrientationLock.ALL);
    }).catch(() => {});
    return () => {
      orientationQueue = orientationQueue.then(() => ScreenOrientation.lockAsync(
        previous === ScreenOrientation.OrientationLock.UNKNOWN ? ScreenOrientation.OrientationLock.PORTRAIT_UP : previous,
      )).catch(() => {});
    };
  }, [fullscreen, portrait, showRotateHint]);
  const current = useRef(initialTime), lastSaved = useRef(0), resumed = useRef(false), resumeTime = useRef(initialTime),
    shouldPlay = useRef(true), progressCallback = useRef(onProgress), endCallback = useRef(onEnd);
  progressCallback.current = onProgress; endCallback.current = onEnd;
  const player = useVideoPlayer({ uri: source.url, contentType: source.url.includes(".m3u8") ? "hls" : "auto" }, (p) => { p.timeUpdateEventInterval = 0.5; });
  useEffect(() => {
    const ready = () => {
      if (player.status !== "readyToPlay") return;
      setStatus("readyToPlay"); setDuration(player.duration); setTracks(player.availableVideoTracks);
      if (!manualSubtitles.current) player.subtitleTrack = source.subtitles.some((track) => isTurkish(track.language))
        ? null : player.availableSubtitleTracks.find((track) => isTurkish(track.language)) || null;
      if (!resumed.current) {
        resumed.current = true; player.currentTime = resumeTime.current;
        if (shouldPlay.current && foreground.current) player.play(); else player.pause();
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
    const stateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && foreground.current) { shouldPlay.current = player.playing; player.pause(); }
      else if (state === "active" && shouldPlay.current) player.play();
      foreground.current = state === "active";
    });
    return () => { statusSub.remove(); timeSub.remove(); endSub.remove(); playingSub.remove(); stateSub.remove(); progressCallback.current(current.current); };
  }, [player, source.subtitles]);
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
    borderRadius: expanded ? 0 : 22, aspectRatio: expanded ? undefined : 9 / 16, width: "100%", alignSelf: "center", maxWidth: expanded ? undefined : 420, maxHeight: expanded ? undefined : 720 }}>
    <VideoView ref={videoView} player={player} style={{ width: "100%", height: "100%" }} nativeControls={false}
      contentFit={videoFit(expanded, portrait, width > height)} surfaceType="textureView" fullscreenOptions={{ enable: false }} allowsPictureInPicture />
    <SubtitleOverlay track={captions.track} time={time} bottom={subtitleBottom(expanded, controlsVisible, insets.bottom, portrait)} />
    <PlayerChrome title={title} time={time} duration={duration} playing={playing} muted={muted} loading={status === "loading"}
      onControlsVisibilityChange={setControlsVisible} safeTop={insets.top} safeBottom={insets.bottom}
      fullscreen={expanded} quality={quality} choices={choices} error={error} onQuality={selectQuality}
      onSeek={(value) => { player.currentTime = value; current.current = value; setTime(value); }}
      onPlay={() => { shouldPlay.current = !player.playing; if (player.playing) { player.pause(); onProgress(current.current); } else player.play(); }}
      onMute={() => { player.muted = !muted; setMuted(!muted); }} onFullscreen={() => setFullscreen(!fullscreen)}
      onRetry={() => { void replace(source.url, true); }}
      onPiP={isPictureInPictureSupported() ? () => { videoView.current?.startPictureInPicture().catch(() => setError("Bu cihazda küçük pencere başlatılamadı.")); } : undefined}
      audio={player.availableAudioTracks.length > 1 ? player.availableAudioTracks.map((item, index) => ({ key: String(index), label: item.label || item.language })) : undefined}
      onAudio={(key) => { player.audioTrack = player.availableAudioTracks[Number(key)]; }}
      subtitles={captions.choices.length || player.availableSubtitleTracks.length ? [
        ...(captions.choices.length ? captions.choices : [{ key: "off", label: "Altyazı kapalı" }]),
        ...player.availableSubtitleTracks.map((item, index) => ({ key: "embedded:" + index, label: item.label || item.language })),
      ] : undefined}
      onSubtitle={(key) => {
        manualSubtitles.current = true;
        captions.select(key.startsWith("embedded:") ? "off" : key);
        player.subtitleTrack = key.startsWith("embedded:") ? player.availableSubtitleTracks[Number(key.slice(9))] : null;
      }} />
    <RotateHint fullscreen={expanded} presentationOpen={showRotateHint} landscapeVideo={!portrait} landscapeScreen={width > height} />
  </View>;
  return <View>
    {fullscreen ? <View style={{ aspectRatio: 9 / 16, maxHeight: 720, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Tam ekran oynatılıyor</Text></View> : render(false)}
    <Modal visible={fullscreen} animationType="fade" statusBarTranslucent navigationBarTranslucent supportedOrientations={portrait ? ["portrait"] : ["portrait", "landscape-left", "landscape-right"]} onRequestClose={() => setFullscreen(false)}>
      {fullscreen && <><StatusBar hidden />{render(true)}</>}
    </Modal>
  </View>;
}
