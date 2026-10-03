import test from "node:test";
import assert from "node:assert/strict";
import { OwnedVideoPlayer } from "../packages/shared/owned-video-player";

test("closing a view waits for its in-flight source load before releasing the native object once", async () => {
  const callbacks: (() => void)[] = [];
  let finish!: () => void, releases = 0;
  const player = { replaceAsync: () => new Promise<void>(resolve => { finish = resolve; }), pause: () => {}, release: () => { releases++; } };
  const owner = new OwnedVideoPlayer(player, fn => { callbacks.push(fn); return 1 as unknown as ReturnType<typeof setTimeout>; });
  const task = owner.replace("https://example.test/movie.mp4");
  await Promise.resolve(); owner.close();
  assert.equal(releases, 0); assert.equal(callbacks.length, 0);
  finish(); await task;
  assert.equal(callbacks.length, 1); assert.equal(releases, 0);
  callbacks[0](); owner.close();
  assert.equal(releases, 1); assert.equal(callbacks.length, 1);
  await assert.rejects(owner.replace("new"), /PLAYER_CLOSED/);
});

test("source replacements are serialized and queued work cannot use a closed player", async () => {
  const callbacks: (() => void)[] = [], calls: unknown[] = [];
  let finish!: () => void, releases = 0;
  const player = { replaceAsync: (source: unknown) => { calls.push(source); return new Promise<void>(resolve => { finish = resolve; }); }, pause: () => {}, release: () => { releases++; } };
  const owner = new OwnedVideoPlayer(player, fn => { callbacks.push(fn); return 1 as unknown as ReturnType<typeof setTimeout>; });
  const first = owner.replace("first"), second = owner.replace("second");
  const rejected = assert.rejects(second, /PLAYER_CLOSED/);
  await Promise.resolve(); assert.deepEqual(calls, ["first"]);
  owner.close(); finish(); await first; await rejected;
  assert.deepEqual(calls, ["first"]); assert.equal(releases, 0);
  callbacks[0](); assert.equal(releases, 1);
});
