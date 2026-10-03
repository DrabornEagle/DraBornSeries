import test from "node:test";
import assert from "node:assert/strict";
import { nativeVideoSource, nativeVideoFailureCode, safeVideoError } from "../packages/shared/native-video-source";
test("signed R2 media retains v0.7.2 auto detection and the exact signed URI", () => {
  const uri = "https://drabornseries.draborneagle.workers.dev/media/Test/a.mp4?exp=1&sig=example";
  const source = nativeVideoSource(uri)!;
  assert.equal(typeof source, "object");
  if (typeof source !== "object") throw Error("source");
  assert.equal(source.uri, uri); assert.equal(source.contentType, "auto"); assert.equal(source.useCaching, false);
  assert.equal(source.headers, undefined);
});
test("HLS is retained and requests keep the native client's original headers", () => {
  for (const uri of ["https://other.example/video.mp4", "https://drabornseries.draborneagle.workers.dev.evil.example/video.mp4"]) {
    const source = nativeVideoSource(uri); assert.equal(typeof source, "object"); if (typeof source !== "object" || !source) throw Error("source"); assert.equal(source.headers, undefined);
  }
  const source = nativeVideoSource("https://other.example/a.m3u8?token=x"); if (typeof source !== "object" || !source) throw Error("source"); assert.equal(source.contentType,"hls");
});
test("HTTP denials, decoder faults and network errors stay distinct without logging signed URLs", () => {
  assert.equal(nativeVideoFailureCode({ message: "A playback exception: Source error Response code: 403" }), "HTTP_403");
  assert.equal(nativeVideoFailureCode({ message: "DecoderInitializationException MediaCodec" }), "DECODER");
  assert.equal(nativeVideoFailureCode({ message: "Unable to resolve host" }), "NETWORK");
  assert.equal(nativeVideoFailureCode({ message: "Unrecognized input format" }), "FORMAT");
  assert.equal(safeVideoError({ message: "Failed https://worker.test/a.mp4?sig=secret" }), "Failed [media]");
});
