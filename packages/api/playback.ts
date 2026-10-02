import { api, db } from "./client";
import type { Playback } from "../types";
import { PlaybackCache } from "../shared/playback-cache";
const cache = new PlaybackCache();
let account: string | undefined;
db.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id || "guest";
  if (account !== undefined && next !== account) cache.clear();
  account = next;
});
export async function loadPlaybackSource(episode: string, refresh = false) {
  const { data: { session } } = await db.auth.getSession();
  const scope = session?.user.id || "guest";
  if (account !== undefined && scope !== account) cache.clear();
  account = scope;
  return cache.load(scope, episode, () => api<Playback>("playback", { episode }, session), refresh);
}
