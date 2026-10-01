/** Shared caption positions for Android and web; keep the normal player unchanged. */
export function subtitleBottom(fullscreen: boolean, controlsVisible = false, safeBottom = 0, portrait = false) {
  return fullscreen ? (controlsVisible ? (portrait ? 148 : 104) : (portrait ? 106 : 36)) + Math.max(0, safeBottom) : 128;
}
export const discoverSubtitleBottom = 270;

/** Fill the display in the video's orientation while preserving its aspect ratio. */
export function videoFit(_fullscreen: boolean, _portrait: boolean, _landscapeScreen: boolean, _mediaPortrait = _portrait, fit: "contain" | "cover" = "cover"): "cover" | "contain" {
  return fit;
}

export function originalQuality(width: number, height: number) {
  const resolution = Math.round(Math.min(width, height));
  return resolution > 0 ? `${resolution}p · Orijinal` : "Orijinal";
}
