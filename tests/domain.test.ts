import test from "node:test";
import assert from "node:assert/strict";
import {
  accessLabel,
  clientCanWatch,
  filterSeries,
  formatTime,
  normalize,
  rewardDays,
} from "../packages/shared/domain";
import type { Series, Episode } from "../packages/types";
const episode = {
  id: "episode1",
  access_type: "coins",
  coin_price: 10,
  vip_included: false,
} as Episode;
test("coin-only episode is not automatically included in VIP", () => {
  assert.equal(clientCanWatch(episode, new Set(), true), false);
  assert.equal(
    clientCanWatch(
      { ...episode, access_type: "vip_or_coins" },
      new Set(),
      true,
    ),
    true,
  );
});
test("owned unlock works across platforms", () => {
  assert.equal(clientCanWatch(episode, new Set(["episode1"]), false), true);
  assert.equal(clientCanWatch(episode, new Set(), false), false);
});
test("free, ad and vip policies have distinct client labels", () => {
  assert.equal(
    clientCanWatch({ ...episode, access_type: "free" }, new Set(), false),
    true,
  );
  assert.equal(
    clientCanWatch({ ...episode, access_type: "ad" }, new Set(), true),
    false,
  );
  assert.equal(accessLabel(episode), "10 BornCoins");
});
test("Turkish search supports accents, actor and tags", () => {
  const s = {
    title: "Kıyı",
    description: "",
    country: "TR",
    genres: ["Dram"],
    tags: ["sahil"],
    cast_names: ["Çağrı"],
    is_demo: false,
  } as Series;
  assert.equal(normalize("KIYI"), "kiyi");
  assert.equal(filterSeries([s], "cagri", "", "all").length, 1);
  assert.equal(filterSeries([s], "sahil", "Komedi", "all").length, 0);
});
test("resume time handles invalid and negative values", () => {
  assert.equal(formatTime(526), "8:46");
  assert.equal(formatTime(-5), "0:00");
  assert.equal(formatTime(NaN), "0:00");
});
test("seven day reward total is explicit", () => {
  assert.equal(rewardDays.length, 7);
  assert.equal(
    rewardDays.reduce((a, b) => a + b, 0),
    52,
  );
});
