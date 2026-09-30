/** Start home previews inside the scene instead of replaying opening logos. */
export function getPreviewWindow(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 7 };
  const start = Math.min(45, duration / 4);
  return { start, end: Math.min(duration - 0.05, start + 7) };
}

/** Discover starts in the story and continues normally, rather than a 7s loop. */
export function getDiscoverStart(duration: number) {
  return Number.isFinite(duration) && duration > 0 ? duration * 0.5 : 0;
}
