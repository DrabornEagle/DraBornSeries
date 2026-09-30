type Episode = { id: string; number: number; orientation: string };
type Asset = { episode_id: string; demo_url: string; renditions?: unknown[] };
/** A separately edited trailer must not inherit another video's caption clock. */
export function resolveTrailer(url: string, episodes: Episode[], assets: Asset[], explicitOrientation?: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
  } catch { return undefined; }
  const ordered = [...episodes].sort((a, b) => a.number - b.number);
  const asset = assets.find((candidate) => candidate.demo_url === url && ordered.some((episode) => episode.id === candidate.episode_id));
  const matched = ordered.find((episode) => episode.id === asset?.episode_id);
  const direction = explicitOrientation === "landscape" || explicitOrientation === "portrait"
    ? explicitOrientation : matched?.orientation || ordered[0]?.orientation;
  return { orientation: direction === "landscape" ? "landscape" : "portrait", matchedEpisodeId: matched?.id, qualities: asset?.renditions || [] };
}
