import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { browserVideoDocument, isBrowserR2Source } from "../packages/shared/browser-video";
import { BrowserPlayer } from "../packages/shared/browser-player";

const url = "https://drabornseries.draborneagle.workers.dev/media/Test/a.mp4?exp=9999999999&sig=fixture";
function harness(player = new BrowserPlayer(url, false, false)) {
  const messages: Record<string, unknown>[] = [], listeners = new Map<string, () => void>();
  let frames = 0, loads = 0;
  const video = {
    duration: 9.2, videoWidth: 478, videoHeight: 850, currentTime: 0, readyState: 0, muted: false, loop: false,
    error: null as { code: number } | null, src: "", style: { objectFit: "cover" },
    addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
    play: () => { listeners.get("playing")?.(); return Promise.resolve(); },
    pause: () => listeners.get("pause")?.(), load: () => { loads++; },
  };
  const window: Record<string, any> = { ReactNativeWebView: { postMessage: (raw: string) => {
    messages.push(JSON.parse(raw)); player.message(raw, () => { frames++; });
  } } };
  const context = vm.createContext({ window, document: { getElementById: () => video } });
  player.attach("view", (script) => vm.runInContext(script, context));
  const html = browserVideoDocument({ id: "view", url: player.url, time: player.currentTime, muted: player.muted, loop: player.loop, playing: player.wanted, fit: "cover" });
  vm.runInContext(html.match(/<script nonce="dbs-video">([\s\S]*?)<\/script>/)![1], context);
  return { player, video, messages, fire: (event: string) => listeners.get(event)?.(), frames: () => frames, loads: () => loads, window };
}

test("R2 Chromium bridge plays, seeks, reports progress and resumes after view relocation", async () => {
  const player = new BrowserPlayer(url, false, false); player.currentTime = 2; player.play();
  const first = harness(player), time: number[] = [];
  player.addListener("timeUpdate", event => time.push(event.currentTime));
  first.video.readyState = 4; first.fire("loadedmetadata"); first.fire("loadeddata"); first.fire("canplay");
  assert.equal(player.duration, 9.2); assert.equal(player.availableVideoTracks[0].size.height, 850);
  assert.equal(first.video.currentTime, 2); assert.equal(player.playing, true); assert.equal(first.frames(), 1);
  player.currentTime = 4.5; first.fire("timeupdate");
  assert.equal(first.video.currentTime, 4.5); assert.equal(time.at(-1), 4.5);
  player.muted = true; assert.equal(first.video.muted, true);
  player.pause(); assert.equal(player.playing, false); assert.equal(player.wanted, false);
  player.play(); player.detach("view");
  const second = harness(player); second.video.readyState = 4; second.fire("loadedmetadata"); second.fire("canplay");
  assert.equal(second.video.currentTime, 4.5); assert.equal(player.playing, true);
  await player.replaceAsync({ uri: url.replace("fixture", "fresh") });
  assert.match(second.video.src, /fresh$/); assert.equal(second.loads(), 2);
});

test("media errors expose a safe code; detached WebViews cannot change the player", () => {
  const h = harness(), errors: string[] = [];
  h.player.addListener("statusChange", event => { if (event.error) errors.push(event.error.message); });
  h.video.error = { code: 3 }; h.fire("error"); assert.deepEqual(errors, ["R2_DECODE"]);
  h.player.detach("view"); h.fire("canplay"); assert.equal(h.player.status, "error");
});

test("browser media cannot load third-party URLs or inject scripts through signed query data", async () => {
  for (const value of ["http://drabornseries.draborneagle.workers.dev/media/a.mp4", "https://drabornseries.draborneagle.workers.dev.evil.test/media/a.mp4", "https://user:pass@drabornseries.draborneagle.workers.dev/media/a.mp4", "https://drabornseries.draborneagle.workers.dev/media/a.m3u8", "https://other.test/video.mp4"]) {
    assert.equal(isBrowserR2Source(value), false);
    await assert.rejects(new BrowserPlayer(url, false, false).replaceAsync(value), /INVALID_R2_MEDIA/);
  }
  const attack = url + "&x=</script><script>window.injected=true</script>";
  const h = harness(new BrowserPlayer(attack, false, false));
  assert.equal(h.window.injected, undefined); assert.equal(h.video.src, attack);
});
