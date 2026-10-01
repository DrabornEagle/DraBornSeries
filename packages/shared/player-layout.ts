/** Shared caption positions for Android and web; keep the normal player unchanged. */
export function subtitleBottom(fullscreen: boolean, controlsVisible = false, safeBottom = 0, portrait = false) {
  return fullscreen ? (controlsVisible ? (portrait ? 124 : 104) : (portrait ? 82 : 36)) + Math.max(0, safeBottom) : 128;
}
export const discoverSubtitleBottom = 270;

/** Fill the display in the video's orientation while preserving its aspect ratio. */
export function videoFit(fullscreen: boolean, portrait: boolean, landscapeScreen: boolean, mediaPortrait = portrait, fit: "auto" | "contain" | "cover" = "auto"): "cover" | "contain" {
  if (fit !== "auto") return fit;
  return fullscreen && (mediaPortrait !== portrait ? mediaPortrait === landscapeScreen : portrait === landscapeScreen) ? "contain" : "cover";
}

export function originalQuality(width: number, height: number) {
  const resolution = Math.round(Math.min(width, height));
  return resolution > 0 ? `${resolution}p · Orijinal` : "Orijinal";
}
