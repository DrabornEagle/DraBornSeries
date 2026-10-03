import type { VideoSource } from "expo-video";
/** Match the working v0.7.2 source: keep signed URLs intact and let Expo sniff media. */
export function nativeVideoSource(url: string): VideoSource {
  const path = url.split(/[?#]/)[0].toLowerCase();
  return { uri: url, contentType: path.endsWith(".m3u8") ? "hls" : "auto", useCaching: false };
}
export function safeVideoError(error: unknown) { return String(error && typeof error === "object" && "message" in error ? error.message : error).replace(/https?:\/\/[^\s]+/g, "[media]"); }
export function isR2Media(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "drabornseries.draborneagle.workers.dev" && parsed.pathname.startsWith("/media/"); } catch { return false; }
}
export function nativeVideoFailureCode(error: unknown) {
  const text = safeVideoError(error), http = text.match(/(?:response code|status code)\s*[:=]?\s*(\d{3})/i);
  if (http) return "HTTP_" + http[1];
  if (/decoder|mediacodec/i.test(text)) return "DECODER";
  if (/unrecognized.*format|unsupported.*format|no suitable.*extractor/i.test(text)) return "FORMAT";
  if (/network|unable to resolve host|connect|timed? out|SSL|DNS/i.test(text)) return "NETWORK";
  return "NATIVE";
}
