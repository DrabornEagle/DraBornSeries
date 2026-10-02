import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { config } = require("../packages/shared/config.ts");
const { basePath, episodePath, seriesPath } = require("../packages/shared/routes.ts");
export async function writeCatalogRoutes(html, target = "dist") {
  async function catalog(table, select) {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1000`, {
      headers: { apikey: config.publishableKey, "Accept-Profile": "drabornseries" }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`Public route catalog ${table}: ${response.status}`);
    return response.json();
  }
  const [shows, episodes] = await Promise.all([catalog("dbs_series", "id,slug"), catalog("dbs_episodes", "series_id,number,dbs_seasons(number)")]);
  const routes = new Set(shows.map(show => seriesPath(show.slug)));
  for (const show of shows) routes.add(`${basePath}DiziAdı=${encodeURIComponent(show.slug)}/`);
  for (const episode of episodes) {
    const show = shows.find(item => item.id === episode.series_id);
    if (show) {
      routes.add(episodePath(show, { ...episode, season_number: episode.dbs_seasons?.number || 1 }));
      routes.add(`${basePath}DiziAdı=${encodeURIComponent(show.slug)}/Sezonbilgisi=season${episode.dbs_seasons?.number || 1}/Bölümbilgisi=episode${episode.number}/`);
    }
  }
  for (const route of routes) {
    const folder = path.join(target, decodeURIComponent(route.slice(basePath.length)));
    if (!path.resolve(folder).startsWith(path.resolve(target) + path.sep)) throw Error("Invalid catalog route.");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "index.html"), html);
  }
  console.log(`${routes.size} readable series/season/episode routes are ready for direct links and refresh.`);
}
