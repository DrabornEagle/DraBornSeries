/** Shared caption positions for Android and web; keep the normal player unchanged. */
export function subtitleBottom(fullscreen: boolean, controlsVisible = false, safeBottom = 0, portrait = false) {
  return fullscreen ? (controlsVisible ? (portrait ? 124 : 104) : (portrait ? 82 : 36)) + Math.max(0, safeBottom) : 128;
}
export const discoverSubtitleBottom = 270;
