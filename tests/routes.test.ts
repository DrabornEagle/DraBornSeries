import test from "node:test";
import assert from "node:assert/strict";
import { episodePath, parseRoute, routePath, seriesPath } from "../packages/shared/routes";
import type { Episode, Series } from "../packages/types";
test("readable paths resolve season and episode, including shared percent-encoded Turkish paths", () => {
  const show = { id: "hero-id", slug: "hero" } as Series;
  const ep = { id: "episode-id", series_id: show.id, number: 7, season_number: 2 } as Episode;
  const url = "https://www.draborneagle.com" + episodePath(show, ep);
  assert.equal(url, "https://www.draborneagle.com/DraBornSeries/DiziAdı=hero/Sezonbilgisi=season2/Bölümbilgisi=episode7/");
  assert.deepEqual(parseRoute(new URL(url).href), { page: "player", series: "hero", season: 2, episodeNumber: 7 });
  assert.equal(routePath({ page: "player", episode: ep.id }, [show], [ep]), episodePath(show, ep));
  assert.deepEqual(parseRoute("https://www.draborneagle.com" + seriesPath(show.slug)), { page: "detail", series: "hero" });
  assert.deepEqual(parseRoute("https://www.draborneagle.com/DraBornSeries/?episode=legacy-id"), { page: "player", episode: "legacy-id" });
  assert.equal(routePath({ page: "rewards" }, [show], [ep]), "/DraBornSeries/?page=rewards");
  assert.equal(episodePath(show, { number: 1 }), "/DraBornSeries/DiziAdı=hero/Sezonbilgisi=season1/Bölümbilgisi=episode1/");
});
