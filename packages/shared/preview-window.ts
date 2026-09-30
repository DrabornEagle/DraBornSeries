/** Start home previews inside the scene instead of replaying opening logos. */
export function getPreviewWindow(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 7 };
  const start = Math.min(45, duration / 4);
  return { start, end: Math.min(duration - 0.05, start + 7) };
}
