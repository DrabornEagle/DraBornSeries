import type { Episode, Page, Series } from "../types";
export const basePath = "/DraBornSeries/";
export type Route = { page: Page; series?: string; episode?: string; season?: number; episodeNumber?: number };
const pages: Page[] = ["home", "feed", "store", "browse", "search", "library", "wallet", "vip", "rewards", "profile", "settings", "notifications", "auth", "admin", "help", "privacy", "terms", "delete-account"];
export function parseRoute(url: string): Route {
  try {
    const parsed = new URL(url);
    const restored = parsed.searchParams.get("dbs_route");
    if (restored?.startsWith(basePath) && restored.length < 1500) return parseRoute(new URL(restored, parsed.origin).href);
    const path = decodeURIComponent(parsed.pathname);
    const match = path.match(/\/DiziAd[ıi]=([^/]+)(?:\/Sezonbilgisi=season([1-9]\d*)\/Bölümbilgisi=episode([1-9]\d*))?\/?$/i);
    if (match) return { page: match[3] ? "player" : "detail", series: match[1], ...(match[3] ? { season: Number(match[2]), episodeNumber: Number(match[3]) } : {}) };
    if (parsed.searchParams.get("episode")) return { page: "player", episode: parsed.searchParams.get("episode")! };
    if (parsed.searchParams.get("series")) return { page: "detail", series: parsed.searchParams.get("series")! };
    const page = parsed.searchParams.get("page") as Page;
    return { page: pages.includes(page) ? page : parsed.searchParams.has("reset") ? "auth" : "home" };
  } catch { return { page: "home" }; }
}
export function seriesPath(slug: string) { return `${basePath}DiziAdı=${encodeURIComponent(slug)}/`; }
export function episodePath(series: Pick<Series, "slug">, episode: Pick<Episode, "number" | "season_number">) {
  return `${seriesPath(series.slug)}Sezonbilgisi=season${episode.season_number || 1}/Bölümbilgisi=episode${episode.number}/`;
}
export function routePath(route: Route, shows: Series[], episodes: Episode[]) {
  const ep = episodes.find(item => item.id === route.episode);
  const show = shows.find(item => item.id === ep?.series_id || item.slug === route.series || item.id === route.series);
  if (ep && show) return episodePath(show, ep);
  if (show && route.page === "detail") return seriesPath(show.slug);
  if (show && route.episodeNumber) return episodePath(show, { number: route.episodeNumber, season_number: route.season || 1 });
  return basePath + (route.page === "home" ? "" : `?page=${route.page}`);
}
