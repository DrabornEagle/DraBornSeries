import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackCache } from "../packages/shared/playback-cache";
import type { Playback } from "../packages/types";
const source = (url: string, expires_at?: string): Playback => ({ url, provider: "r2", subtitles: [], expires_at });
test("preview and full playback share a request while retry fetches a fresh URL", async () => {
  let calls = 0, time = 100000;
  const cache = new PlaybackCache(() => time), fetch = async () => source(String(++calls));
  const values = await Promise.all([cache.load("guest", "a", fetch), cache.load("guest", "a", fetch)]);
  assert.equal(calls, 1); assert.equal(values[0], values[1]);
  assert.equal((await cache.load("guest", "a", fetch)).url, "1");
  assert.equal((await cache.load("guest", "a", fetch, true)).url, "2");
  time += 90001; assert.equal((await cache.load("guest", "a", fetch)).url, "3");
});
test("signed expiry and account changes prevent stale or cross-account source reuse", async () => {
  let time = 100000, calls = 0;
  const cache = new PlaybackCache(() => time), fetch = async () => source(String(++calls), new Date(time + 31000).toISOString());
  await cache.load("alice", "paid", fetch); time += 1001;
  assert.equal((await cache.load("alice", "paid", fetch)).url, "2");
  assert.equal((await cache.load("bob", "paid", fetch)).url, "3");
  let finish!: (value: Playback) => void;
  const pending = cache.load("alice", "next", () => new Promise(resolve => { finish = resolve; }));
  cache.clear(); finish(source("old-account"));
  await assert.rejects(pending, /PLAYBACK_ACCOUNT_CHANGED/);
  assert.equal((await cache.load("guest", "paid", fetch)).url, "4");
});
test("failed requests do not poison later playback and old refreshes cannot overwrite newer results", async () => {
  const cache = new PlaybackCache();
  await assert.rejects(cache.load("guest", "a", async () => { throw Error("network"); }));
  let finish!: (value: Playback) => void;
  const old = cache.load("guest", "a", () => new Promise(resolve => { finish = resolve; }));
  await cache.load("guest", "a", async () => source("fresh"), true); finish(source("old")); await old;
  assert.equal((await cache.load("guest", "a", async () => source("unexpected"))).url, "fresh");
});
