/** Shared caption positions for Android and web; keep the normal player unchanged. */
export function subtitleBottom(fullscreen: boolean, controlsVisible = false, safeBottom = 0) {
  return fullscreen ? (controlsVisible ? 104 : 36) + Math.max(0, safeBottom) : 128;
}
export const discoverSubtitleBottom = 270;
