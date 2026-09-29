export function swipeStep(distance: number, velocity: number, extent: number) {
  const threshold = Math.max(40, Math.min(90, extent * 0.12));
  if (Math.abs(distance) < threshold && !(Math.abs(distance) > 18 && Math.abs(velocity) > 0.55)) return 0;
  return distance < 0 ? 1 : -1;
}
export function adjacentIndex(index: number, step: number, count: number, loop = false) {
  if (count <= 1) return 0;
  const next = index + Math.sign(step);
  return loop ? (next + count) % count : Math.max(0, Math.min(count - 1, next));
}
