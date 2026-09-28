import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Button, Chip, colors, styles } from "./theme";
import type { VideoProps } from "./VideoPlayer.types";
export default function VideoPlayer({
  source,
  initialTime,
  portrait,
  onProgress,
  onEnd,
}: VideoProps) {
  const [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [tracks, setTracks] = useState<any[]>([]),
    [subtitles, setSubtitles] = useState<any[]>([]),
    [audio, setAudio] = useState<any[]>([]),
    [quality, setQuality] = useState("Auto"),
    [muted, setMuted] = useState(false),
    [playing, setPlaying] = useState(true);
  const current = useRef(initialTime),
    lastSaved = useRef(0),
    resumed = useRef(false),
    progressCallback = useRef(onProgress),
    endCallback = useRef(onEnd);
  progressCallback.current = onProgress;
  endCallback.current = onEnd;
  const player = useVideoPlayer(
    {
      uri: source.url,
      contentType: source.url.includes(".m3u8") ? "hls" : "auto",
    },
    (p) => {
      p.timeUpdateEventInterval = 1;
    },
  );
  useEffect(() => {
    const statusSub = player.addListener("statusChange", (event) => {
      setStatus(event.status);
      if (event.error) setError(event.error.message);
      if (event.status === "readyToPlay" && !resumed.current) {
        resumed.current = true;
        player.currentTime = initialTime;
        player.play();
        setTracks(player.availableVideoTracks);
        setSubtitles(player.availableSubtitleTracks);
        setAudio(player.availableAudioTracks);
      }
    });
    const timeSub = player.addListener("timeUpdate", (event) => {
      current.current = event.currentTime;
      if (Date.now() - lastSaved.current > 15000) {
        lastSaved.current = Date.now();
        progressCallback.current(event.currentTime);
      }
    });
    const endSub = player.addListener("playToEnd", () => {
      progressCallback.current(current.current);
      endCallback.current();
    });
    return () => {
      statusSub.remove();
      timeSub.remove();
      endSub.remove();
      progressCallback.current(current.current);
    };
  }, [player, initialTime]);
  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          backgroundColor: "#000",
          borderRadius: 16,
          overflow: "hidden",
          aspectRatio: portrait ? 9 / 16 : 16 / 9,
          maxHeight: 700,
        }}
      >
        <VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{
            enable: true,
            orientation: portrait ? "portrait" : "landscape",
          }}
          allowsPictureInPicture
        />
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 12, left: 12 }}
        >
          {status === "loading" && <ActivityIndicator color={colors.pink} />}
        </View>
      </View>
      {error && <Text style={{ color: colors.orange }}>{error}</Text>}
      <View style={styles.wrap}>
        <Button
          small
          secondary
          icon="play-back"
          onPress={() => player.seekBy(-10)}
        >
          -10 sn
        </Button>
        <Button
          small
          icon={playing ? "pause" : "play"}
          onPress={() => {
            if (playing) player.pause();
            else player.play();
            setPlaying(!playing);
            if (playing) onProgress(current.current);
          }}
        >
          {playing ? "Duraklat" : "Oynat"}
        </Button>
        <Button
          small
          secondary
          icon="play-forward"
          onPress={() => player.seekBy(10)}
        >
          +10 sn
        </Button>
        <Button
          small
          secondary
          icon={muted ? "volume-mute" : "volume-high"}
          onPress={() => {
            player.muted = !muted;
            setMuted(!muted);
          }}
        >
          Ses
        </Button>
      </View>
      <View style={styles.wrap}>
        <Chip
          label="Otomatik kalite"
          active={quality === "Auto"}
          onPress={() => {
            player.maxResolution = null;
            setQuality("Auto");
          }}
        />
        {tracks.map((track, i) => (
          <Chip
            key={i}
            label={`${track.size?.height || "HD"}p`}
            active={quality === track.id}
            onPress={() => {
              player.maxResolution = track.size;
              setQuality(track.id);
            }}
          />
        ))}
      </View>
      {subtitles.length > 0 && (
        <View style={styles.wrap}>
          <Chip
            label="Altyazı kapalı"
            onPress={() => (player.subtitleTrack = null)}
          />
          {subtitles.map((track, i) => (
            <Chip
              key={i}
              label={track.label || track.language}
              onPress={() => (player.subtitleTrack = track)}
            />
          ))}
        </View>
      )}
      {audio.length > 1 && (
        <View style={styles.wrap}>
          {audio.map((track, i) => (
            <Chip
              key={i}
              label={track.label || track.language}
              onPress={() => (player.audioTrack = track)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
