import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, Text, View, useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { VideoView, isPictureInPictureSupported, type VideoTrack, type VideoPlayer as NativePlayer, type VideoSource } from "expo-video";
import type { VideoProps } from "./VideoPlayer.types";
import PlayerChrome from "./PlayerChrome";
import { colors } from "./theme";
import RotateHint from "./RotateHint";
import SubtitleOverlay, { useSubtitleSelection } from "./SubtitleOverlay";
import { isTurkish } from "../shared/subtitles";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { originalQuality, subtitleBottom, videoFit } from "../shared/player-layout";
import { nativeVideoSource, safeVideoError, isR2Media, nativeVideoFailureCode } from "../shared/native-video-source";
import { usePlaybackEngine } from "./usePlaybackEngine";
// Serialize orientation changes so closing quickly cannot leave ALL applied.
let orientationQueue = Promise.resolve();
export default function VideoPlayer(props: VideoProps) {
  const handle = usePlaybackEngine(props.source.url);
  if (!handle) return <View style={{ width: "100%", maxWidth: 420, aspectRatio: 9 / 16, backgroundColor: "#05020a", borderRadius: 22, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.muted }}>Video hazırlanıyor…</Text></View>;
  return <ReadyVideoPlayer key={handle.id} {...props} player={handle.owner.player} replaceSource={(source) => handle.owner.replace(source)} />;
}
function ReadyVideoPlayer({ source, initialTime, portrait, title, onRefreshSource, onProgress, onEnd, player, replaceSource }: VideoProps & { player: NativePlayer; replaceSource: (source: VideoSource) => Promise<void> }) {
  const [status, setStatus] = useState("loading"), [error, setError] = useState(""),
    [tracks, setTracks] = useState<VideoTrack[]>([]), [quality, setQuality] = useState("Otomatik"),
    [muted, setMuted] = useState(false), [playing, setPlaying] = useState(true),
    [fullscreen, setFullscreen] = useState(false), [time, setTime] = useState(initialTime), [duration, setDuration] = useState(0);
  const frameLogged = useRef(false), advancingLogged = useRef(false);
  const videoView = useRef<VideoView>(null);
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fit, setFit] = useState<"contain" | "cover">("cover");
  const foreground = useRef(AppState.currentState === "active");
  const captions = useSubtitleSelection(source.subtitles, source.url), manualSubtitles = useRef(false);
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (!fullscreen) return;
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
  }, [fullscreen, portrait]);
  const current = useRef(initialTime), lastSaved = useRef(0), resumed = useRef(false), resumeTime = useRef(initialTime),
    shouldPlay = useRef(true), progressCallback = useRef(onProgress), endCallback = useRef(onEnd);
  progressCallback.current = onProgress; endCallback.current = onEnd;
  useEffect(() => {
    const ready = () => {
      if (player.status !== "readyToPlay") return;
      setError(""); setStatus("readyToPlay"); setDuration(player.duration); setTracks(player.availableVideoTracks);
      if (!manualSubtitles.current) player.subtitleTrack = source.subtitles.some((track) => isTurkish(track.language))
        ? null : player.availableSubtitleTracks.find((track) => isTurkish(track.language)) || null;
      if (!resumed.current) {
        resumed.current = true; player.currentTime = resumeTime.current;
        if (shouldPlay.current && foreground.current) player.play(); else player.pause();
      }
    };
    const statusSub = player.addListener("statusChange", (event) => {
      setStatus(event.status); if (event.error) { console.warn("DraBornSeries: video error", safeVideoError(event.error)); setError("Video yüklenemedi. Tekrar dene." + (isR2Media(source.url) ? " (R2_" + nativeVideoFailureCode(event.error) + ")" : "")); } ready();
    });
    const playingSub = player.addListener("playingChange", (event) => setPlaying(event.isPlaying));
    const timeSub = player.addListener("timeUpdate", (event) => {
      if (!advancingLogged.current && player.playing && event.currentTime > initialTime + 0.75) { advancingLogged.current = true; console.info("DraBornSeries: video playback advanced"); }
      current.current = event.currentTime; setTime(event.currentTime);
      if (Date.now() - lastSaved.current > 5000) { lastSaved.current = Date.now(); progressCallback.current(event.currentTime); }
    });
    const endSub = player.addListener("playToEnd", () => { progressCallback.current(current.current); endCallback.current(); });
    setStatus(player.status);
    if (player.status === "error") setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene.");
    ready();
    const stateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && foreground.current) { shouldPlay.current = player.playing; player.pause(); }
      else if (state === "active" && shouldPlay.current) player.play();
      foreground.current = state === "active";
    });
    return () => { statusSub.remove(); timeSub.remove(); endSub.remove(); playingSub.remove(); stateSub.remove(); progressCallback.current(current.current); };
  }, [player, source.subtitles, source.url, initialTime]);
  const replace = async (url: string, forcePlay = false) => {
    resumeTime.current = current.current; shouldPlay.current = forcePlay || player.playing;
    resumed.current = false; setError(""); setStatus("loading");
    try { await replaceSource(nativeVideoSource(url)); }
    catch { setStatus("error"); setError("Bu kalite yüklenemedi. Otomatik kaliteyi seç veya tekrar dene."); }
  };
  const retry = async () => {
    setError(""); setStatus("loading");
    try { const fresh = onRefreshSource ? await onRefreshSource() : source; setQuality("Otomatik"); player.maxResolution = null; await replace(fresh.url, true); }
    catch { setStatus("error"); setError("Video yüklenemedi. Bağlantını kontrol ederek tekrar dene."); }
  };
  const choices = [{ key: "auto", label: "Otomatik" }, ...(source.qualities?.length
    ? source.qualities.map((item, index) => ({ key: "r:" + index, label: item.label }))
    : tracks.length ? tracks.map((track, index) => ({ key: "t:" + index, label: originalQuality(track.size.width, track.size.height) }))
      : [{ key: "original", label: "Orijinal" }] )];
  const mediaPortrait = tracks[0]?.size.width ? tracks[0].size.height > tracks[0].size.width : portrait;
  const selectQuality = (key: string) => {
    setQuality(choices.find((choice) => choice.key === key)?.label || "Otomatik");
    if (key.startsWith("r:")) { void replace(source.qualities![Number(key.slice(2))].url); }
    else if (key.startsWith("t:")) player.maxResolution = tracks[Number(key.slice(2))].size;
    else { player.maxResolution = null; if (source.qualities?.length) void replace(source.url); }
  };
  const render = (expanded: boolean) => <View style={{ flex: expanded ? 1 : undefined, backgroundColor: "#05020a", overflow: "hidden",
    borderRadius: expanded ? 0 : 22, aspectRatio: expanded ? undefined : 9 / 16, width: "100%", alignSelf: "center", maxWidth: expanded ? undefined : 420, maxHeight: expanded ? undefined : 720 }}>
    <VideoView ref={videoView} player={player} style={{ width: "100%", height: "100%" }} nativeControls={false}
      onFirstFrameRender={() => { if (!frameLogged.current) { frameLogged.current = true; console.info("DraBornSeries: video frame rendered"); if (isR2Media(source.url)) console.info("DraBornSeries: R2 native video frame rendered"); } }}
      contentFit={videoFit(expanded, portrait, width > height, mediaPortrait, fit)} surfaceType="textureView" fullscreenOptions={{ enable: false }} allowsPictureInPicture />
    {status === "readyToPlay" && duration > 0 && <SubtitleOverlay track={captions.track} time={time} bottom={subtitleBottom(expanded, controlsVisible, insets.bottom, mediaPortrait)} />}
    <PlayerChrome title={title} time={duration > 0 ? time : 0} duration={duration} playing={playing} muted={muted} loading={status === "loading"}
      onControlsVisibilityChange={setControlsVisible} safeTop={insets.top} safeBottom={insets.bottom}
      fullscreen={expanded} quality={quality} choices={choices} error={error} onQuality={selectQuality} fit={fit} onFit={setFit}
      onSeek={(value) => { player.currentTime = value; current.current = value; setTime(value); }}
      onPlay={() => { shouldPlay.current = !player.playing; if (player.playing) { player.pause(); onProgress(current.current); } else player.play(); }}
      onMute={() => { player.muted = !muted; setMuted(!muted); }} onFullscreen={() => setFullscreen(!fullscreen)}
      onRetry={() => { void retry(); }}
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
    <RotateHint fullscreen={expanded} landscapeVideo={!portrait} landscapeScreen={width > height} />
  </View>;
  return <View>
    {fullscreen ? <View style={{ aspectRatio: 9 / 16, maxHeight: 720, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.muted }}>Tam ekran oynatılıyor</Text></View> : render(false)}
    <Modal visible={fullscreen} animationType="fade" statusBarTranslucent navigationBarTranslucent supportedOrientations={portrait ? ["portrait"] : ["portrait", "landscape-left", "landscape-right"]} onRequestClose={() => setFullscreen(false)}>
      {fullscreen && <><StatusBar hidden />{render(true)}</>}
    </Modal>
  </View>;
}
