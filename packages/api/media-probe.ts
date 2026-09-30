import { Platform } from "react-native";

export async function videoDuration(url: string): Promise<number | null> {
  if (Platform.OS === "web") return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata"; video.muted = true;
    const finish = (duration: number | null) => {
      clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null;
      video.removeAttribute("src"); video.load(); resolve(duration);
    };
    const timer = setTimeout(() => finish(null), 12000);
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? Math.ceil(video.duration) : null);
    video.onerror = () => finish(null); video.src = url;
  });
  const { createVideoPlayer } = await import("expo-video");
  return new Promise((resolve) => {
    const player = createVideoPlayer(null); player.muted = true;
    let finished = false;
    const finish = (duration: number | null) => {
      if (finished) return; finished = true; clearTimeout(timer); load.remove(); status.remove(); player.release(); resolve(duration);
    };
    const timer = setTimeout(() => finish(null), 12000);
    const load = player.addListener("sourceLoad", ({ duration }) => finish(duration > 0 && Number.isFinite(duration) ? Math.ceil(duration) : null));
    const status = player.addListener("statusChange", ({ status: next }) => { if (next === "error") finish(null); });
    player.replaceAsync(url).catch(() => finish(null));
  });
}
