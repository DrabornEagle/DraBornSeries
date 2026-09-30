import type { Episode, Series } from "../types";

/** One scene per published series; video orientation does not limit discovery. */
export function buildDiscoverEntries(series: Series[], episodes: Episode[], seed: number) {
  let state = Math.max(1, seed);
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const entries = series.filter((item) => item.status === "published").flatMap((item) => {
    const published = episodes.filter((episode) => episode.series_id === item.id && episode.status === "published");
    const free = published.filter((episode) => episode.access_type === "free");
    const available = free.length ? free : published;
    if (!available.length) return [];
    return [{ series: item, episode: available[Math.floor(random() * available.length)] }];
  });
  for (let index = entries.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    [entries[index], entries[next]] = [entries[next], entries[index]];
  }
  return entries;
}
