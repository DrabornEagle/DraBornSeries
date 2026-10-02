import test from "node:test";
import assert from "node:assert/strict";
import { r2Playback } from "../supabase/functions/dbs-api/r2";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
test("current Worker signs with one request and legacy fallback never bypasses denial", async () => {
  const original = globalThis.fetch, paths: string[] = [];
  try {
    globalThis.fetch = async (input) => { paths.push(String(input)); return json({ url: "signed", provider: "r2" }); };
    assert.equal((await r2Playback("episode", "a.mp4", "Bearer user", "coins")).url, "signed");
    assert.equal(paths.length, 1); assert.match(paths[0], /\/playback$/);
    for (const status of [401, 403, 500]) {
      paths.length = 0;
      globalThis.fetch = async input => { paths.push(String(input)); return json({ error: "ACCESS_DENIED" }, status); };
      await assert.rejects(r2Playback("episode", "a.mp4", "", "free"), /ACCESS_DENIED/);
      assert.equal(paths.length, 1);
    }
    globalThis.fetch = async input => String(input).endsWith("/health") ? json({ provider: "r2", privateMedia: false }) : json({}, 404);
    assert.match((await r2Playback("episode", "a.mp4", "", "free")).url, /\/media\/a.mp4$/);
    await assert.rejects(r2Playback("episode", "a.mp4", "", "coins"), /R2_PRIVATE_WORKER_REQUIRED/);
    globalThis.fetch = async input => String(input).endsWith("/health") ? json({ provider: "r2", privateMedia: true }) : json({ error: "NOT_FOUND" }, 404);
    await assert.rejects(r2Playback("episode", "a.mp4", "", "free"), /NOT_FOUND/);
  } finally { globalThis.fetch = original; }
});
