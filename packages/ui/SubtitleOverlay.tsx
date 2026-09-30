import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { parseSubtitles, preferredSubtitle, subtitleAt, type SubtitleCue, type SubtitleTrack } from "../shared/subtitles";

const cache = new Map<string, SubtitleCue[]>();
const emptyTracks: SubtitleTrack[] = [];

export function useSubtitleSelection(tracks: SubtitleTrack[] = emptyTracks, identity: string) {
  const [selection, setSelection] = useState<{ identity: string; key: string }>();
  const key = selection?.identity === identity ? selection.key : preferredSubtitle(tracks)?.url;
  return {
    track: tracks.find((track) => track.url === key),
    choices: tracks.length ? [{ key: "off", label: "Altyazı kapalı" }, ...tracks.map((track) => ({ key: track.url, label: track.label }))] : [],
    select: (next: string) => setSelection({ identity, key: next }),
  };
}

/** Independent of native embedded tracks, so sidecar captions work on Android too. */
export default function SubtitleOverlay({ track, time, bottom = 128 }: {
  track?: SubtitleTrack; time: number; bottom?: number;
}) {
  const [loaded, setLoaded] = useState<{ url: string; cues: SubtitleCue[] }>();
  const url = track?.url;
  useEffect(() => {
    if (!url) return;
    const saved = cache.get(url);
    if (saved) { setLoaded({ url, cues: saved }); return; }
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Subtitle unavailable");
      const content = await response.text();
      if (content.length > 1_000_000) throw new Error("Subtitle too large");
      const cues = parseSubtitles(content);
      if (!controller.signal.aborted) {
        if (cache.size >= 50) cache.delete(cache.keys().next().value!);
        cache.set(url, cues);
        setLoaded({ url, cues });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [url]);
  const text = loaded && loaded.url === url ? subtitleAt(loaded.cues, time) : "";
  if (!text) return null;
  return <View pointerEvents="none" accessibilityLabel="Türkçe altyazı" style={{ position: "absolute", left: 16, right: 16, bottom, alignItems: "center", zIndex: 2 }}>
    <Text style={{ color: "#fff", backgroundColor: "#000000c9", fontSize: 17, lineHeight: 24, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, textAlign: "center", maxWidth: 840 }}>{text}</Text>
  </View>;
}
