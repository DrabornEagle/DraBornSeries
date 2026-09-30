import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assertPlayableStream, naturalConflict, streamUID, verifyStreamWebhook } from "../supabase/functions/dbs-api/stream";
import { uploadTus } from "../packages/shared/tus-upload";

test("Stream webhook verifies original bytes and rejects tampering and stale requests", async () => {
  const raw = '{"uid":"1234567890abcdef1234567890abcdef"}\n', time = 1780000000, secret = "test-webhook-secret";
  const sig = createHmac("sha256", secret).update(`${time}.${raw}`).digest("hex");
  assert.equal(await verifyStreamWebhook(raw, `time=${time},sig1=${sig}`, secret, time * 1000), true);
  assert.equal(await verifyStreamWebhook(raw.trim(), `time=${time},sig1=${sig}`, secret, time * 1000), false);
  assert.equal(await verifyStreamWebhook(raw, `time=${time},sig1=${sig}`, secret, (time + 301) * 1000), false);
  assert.equal(await verifyStreamWebhook(raw, `time=${time},sig1=${sig}`, "", time * 1000), false);
  assert.equal(await verifyStreamWebhook(raw, `time=${time},sig1=bad`, secret, time * 1000), false);
});
test("Studio saves a repeated season by its natural key while edits retain their IDs", () => {
  assert.equal(naturalConflict("dbs_seasons", false), "series_id,number");
  assert.equal(naturalConflict("dbs_seasons", true), "id");
  assert.equal(naturalConflict("dbs_episodes", false), "series_id,number");
  assert.equal(naturalConflict("dbs_video_assets", false), "episode_id");
  assert.equal(streamUID("1234567890abcdef1234567890abcdef"), true);
  assert.equal(streamUID("sample-uid"), false);
});
test("Manual Stream replacement rejects processing, failed, public and mismatched videos before saving", () => {
  const uid = "1234567890abcdef1234567890abcdef";
  const ready = { uid, readyToStream: true, requireSignedURLs: true };
  assert.doesNotThrow(() => assertPlayableStream(ready, uid));
  assert.throws(() => assertPlayableStream({ ...ready, readyToStream: false }, uid), /VIDEO_NOT_READY/);
  assert.throws(() => assertPlayableStream({ ...ready, status: { state: "error" } }, uid), /VIDEO_NOT_READY/);
  assert.throws(() => assertPlayableStream({ ...ready, requireSignedURLs: false }, uid), /SIGNED_URLS/);
  assert.throws(() => assertPlayableStream({ ...ready, uid: "a".repeat(32) }, uid), /INVALID_STREAM_UID/);
});
test("tus recovers a lost acknowledgement without uploading the same bytes twice", async () => {
  const size = 8 * 1024 * 1024 + 7, chunks: [number, number][] = [], progress: number[] = [];
  let offset = 0, heads = 0, first = true;
  const request = (async (_url: unknown, init: RequestInit) => {
    if (init.method === "HEAD") { heads++; return new Response(null, { headers: { "Upload-Offset": String(offset) } }); }
    assert.equal(Number((init.headers as Record<string,string>)["Upload-Offset"]), offset);
    offset += (init.body as ArrayBuffer).byteLength;
    if (first) { first = false; throw Error("Connection lost after server received bytes"); }
    return new Response(null, { status: 204, headers: { "Upload-Offset": String(offset) } });
  }) as typeof fetch;
  await uploadTus("https://upload.example.invalid", size, async (start, end) => { chunks.push([start, end]); return new ArrayBuffer(end - start); }, (n) => progress.push(n), request);
  assert.equal(offset, size); assert.equal(heads, 2);
  assert.deepEqual(chunks, [[0, 8 * 1024 * 1024], [8 * 1024 * 1024, size]]);
  assert.equal(progress.at(-1), 100);
});
test("tus rejects invalid server offsets and stops persistent failures", async () => {
  await assert.rejects(uploadTus("https://upload.example.invalid", 10, async () => new ArrayBuffer(10), undefined,
    (async () => new Response(null, { headers: { "Upload-Offset": "11" } })) as typeof fetch), /OFFSET_INVALID/);
  let patches = 0;
  const request = (async (_url: unknown, init: RequestInit) => {
    if (init.method === "HEAD") return new Response(null, { headers: { "Upload-Offset": "0" } });
    patches++; return new Response(null, { status: 503 });
  }) as typeof fetch;
  await assert.rejects(uploadTus("https://upload.example.invalid", 10, async () => new ArrayBuffer(10), undefined, request), /UPLOAD_FAILED/);
  assert.equal(patches, 4);
});
