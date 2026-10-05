import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webVersionGuard } from "../scripts/web-version-guard.mjs";

const oldCommit = "a".repeat(40), newCommit = "b".repeat(40);
const href = "https://www.draborneagle.com/DraBornSeries/hero=season-2/episode-7?keep=yes#saved";
const flush = () => new Promise(resolve => setImmediate(resolve));
function tab({ version = "0.7.7.4", commit = oldCommit, release = { version, commit }, url = href, storage = new Map(), storageDenied = false, navigator = {}, caches } = {}) {
  const events = { window: {}, document: {} }, replaced = [], requests = [];
  let now = 100000, reply = async () => ({ ok: true, json: async () => ({ ...release }) });
  const context = {
    URL, AbortSignal, Date: class extends Date { static now() { return now; } },
    document: { hidden: false, addEventListener: (name, fn) => events.document[name] = fn },
    window: { addEventListener: (name, fn) => events.window[name] = fn, ...(caches ? { caches } : {}) },
    navigator, ...(caches ? { caches } : {}),
    sessionStorage: { getItem: key => { if (storageDenied) throw Error("storage denied"); return storage.get(key); }, setItem: (key, value) => { if (storageDenied) throw Error("storage denied"); storage.set(key, value); } },
    location: { href: url, replace: value => replaced.push(value) },
    fetch: async (url, options) => { assert.equal(options.cache, "no-store"); assert.match(url, /^\/DraBornSeries\/DBS-SOURCE\.json\?check=\d+$/); requests.push(url); return reply(); },
  };
  vm.runInNewContext(webVersionGuard(version, commit).replace(/^<script[^>]*>|<\/script>$/g, ""), context);
  return { context, replaced, requests, storage, release, advance: ms => now += ms, reply: value => reply = value, emit: (surface, name, event = {}) => events[surface][name](event) };
}

test("four-part upgrades and legacy three-part versions preserve episode, query and fragment", async () => {
  for (const version of ["0.7.7.3", "0.7.4", "0.2.0"]) {
    const result = tab({ version, release: { version: "0.7.7.4", commit: newCommit } }); await flush();
    assert.equal(result.replaced.length, 1);
    const url = new URL(result.replaced[0]);
    assert.equal(url.pathname, new URL(href).pathname); assert.equal(url.searchParams.get("keep"), "yes"); assert.equal(url.hash, "#saved");
    assert.equal(url.searchParams.get("_dbs_release"), "0.7.7.4"); assert.equal(url.searchParams.get("_dbs_source"), newCommit);
  }
});
test("a correction published under the same four-part version updates by source commit", async () => {
  const result = tab({ release: { version: "0.7.7.4", commit: newCommit } }); await flush(); assert.equal(result.replaced.length, 1);
});
test("current, older, malformed, unsuccessful and offline responses keep the working page", async () => {
  for (const version of ["0.7.7.4", "0.7.7.3", "0.7.4", "0.2.0", "invalid", "0.7.bad.5", "0.7.7.4.1"]) {
    const result = tab({ release: { version, commit: version === "0.7.7.4" ? oldCommit : newCommit } }); await flush(); assert.deepEqual(result.replaced, []);
  }
  for (const commit of [undefined, "invalid"]) { const result = tab({ release: { version: "0.7.7.4", commit } }); await flush(); assert.deepEqual(result.replaced, []); }
  for (const reply of [async () => ({ ok: false }), async () => { throw Error("offline"); }]) {
    const result = tab(); await flush(); result.advance(16000); result.reply(reply); result.emit("window", "focus"); await flush(); assert.deepEqual(result.replaced, []);
  }
});
test("Chrome BFCache restore and frozen-tab resume bypass the normal short throttle", async () => {
  for (const [surface, event, detail] of [["window", "pageshow", { persisted: true }], ["document", "resume", {}]]) {
    const result = tab(); await flush(); result.release.commit = newCommit; result.emit(surface, event, detail); await flush();
    assert.equal(result.requests.length, 2); assert.equal(result.replaced.length, 1);
  }
});
test("visible-tab and focus events revalidate after time away without requesting while hidden", async () => {
  for (const [surface, event] of [["document", "visibilitychange"], ["window", "focus"]]) {
    const result = tab(); await flush(); result.advance(16000); result.release.commit = newCommit; result.context.document.hidden = true;
    result.emit(surface, event); await flush(); assert.equal(result.requests.length, 1);
    result.context.document.hidden = false; result.emit(surface, event); await flush(); assert.equal(result.replaced.length, 1);
  }
});
test("returning online retries immediately and simultaneous lifecycle events share a request", async () => {
  const result = tab(); await flush(); result.release.commit = newCommit;
  let resolve; result.reply(() => new Promise(done => resolve = done));
  result.emit("window", "online"); result.emit("window", "focus"); result.emit("document", "visibilitychange"); result.emit("window", "pageshow", { persisted: true });
  assert.equal(result.requests.length, 2);
  resolve({ ok: true, json: async () => ({ ...result.release }) }); await flush(); assert.equal(result.replaced.length, 1);
});
test("ordinary repeated focus/pageshow events are throttled", async () => {
  const result = tab(); await flush(); result.emit("window", "focus"); result.emit("window", "pageshow", { persisted: false }); result.emit("document", "visibilitychange");
  await flush(); assert.equal(result.requests.length, 1);
});
test("a stale entry document cannot create a reload loop even when storage is denied", async () => {
  for (const storageDenied of [false, true]) {
    const release = { version: "0.7.7.4", commit: newCommit }, first = tab({ release, storageDenied }); await flush();
    const next = tab({ release, url: first.replaced[0], storage: first.storage, storageDenied }); await flush();
    assert.deepEqual(next.replaced, []); next.advance(60001); next.emit("window", "focus"); await flush(); assert.equal(next.replaced.length, 1);
  }
});
test("cache cleanup is limited to DraBornSeries and leaves other app scopes and caches alone", async () => {
  const unregistered = [], deleted = [];
  const navigator = { serviceWorker: { getRegistrations: async () => ["/", "/DraBornSeries/", "/DraBornBuy/"].map(scope => ({ scope: "https://www.draborneagle.com" + scope, unregister: async () => unregistered.push(scope) })) } };
  tab({ navigator, caches: { keys: async () => ["dbs-v1", "drabornseries-v2", "other-app", "auth-session"], delete: async key => deleted.push(key) } }); await flush();
  assert.deepEqual(unregistered, ["/DraBornSeries/"]); assert.deepEqual(deleted, ["dbs-v1", "drabornseries-v2"]);
});
