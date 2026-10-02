import test from "node:test";
import assert from "node:assert/strict";
import { nativeVideoSource } from "../packages/shared/native-video-source";
test("signed R2 MP4 uses progressive extraction without changing the signed URI", () => {
  const uri = "https://drabornseries.draborneagle.workers.dev/media/Test/a.mp4?exp=1&sig=example";
  const source = nativeVideoSource(uri)!;
  assert.equal(typeof source, "object");
  if (typeof source !== "object") throw Error("source");
  assert.equal(source.uri, uri); assert.equal(source.contentType, "progressive"); assert.equal(source.useCaching, false);
  assert.equal(source.headers?.["User-Agent"], "DraBornSeries/0.7.4");
});
test("native headers are scoped to the exact R2 host; HLS is retained", () => {
  for (const uri of ["https://other.example/video.mp4", "https://drabornseries.draborneagle.workers.dev.evil.example/video.mp4"]) {
    const source = nativeVideoSource(uri); assert.equal(typeof source, "object"); if (typeof source !== "object" || !source) throw Error("source"); assert.equal(source.headers, undefined);
  }
  const source = nativeVideoSource("https://other.example/a.m3u8?token=x"); if (typeof source !== "object" || !source) throw Error("source"); assert.equal(source.contentType,"hls");
});
