import type { VideoSource } from "expo-video";
import { config } from "./config";
/** Signed MP4 media must use the progressive extractor in Android Media3. */
export function nativeVideoSource(url: string): VideoSource {
  const path = url.split(/[?#]/)[0].toLowerCase();
  let r2 = false;
  try { r2 = new URL(url).hostname === "drabornseries.draborneagle.workers.dev"; } catch {}
  return { uri: url, contentType: path.endsWith(".m3u8") ? "hls" : /\.(mp4|m4v|webm)$/.test(path) ? "progressive" : "auto", useCaching: false,
    ...(r2 ? { headers: { "User-Agent": `DraBornSeries/${config.version}`, "Accept-Encoding": "identity" } } : {}) };
}
export function safeVideoError(error: unknown) { return String(error && typeof error === "object" && "message" in error ? error.message : error).replace(/https?:\/\/[^\s]+/g, "[media]"); }
