import test from "node:test";
import assert from "node:assert/strict";
import { r2Folder, r2Key, r2MediaUrl, seriesSlug } from "../packages/shared/r2";
import { mediaUrl, normalizeR2Key } from "../supabase/functions/dbs-api/r2";
import { subtitleBottom, discoverSubtitleBottom } from "../packages/shared/player-layout";

test("R2 keys preserve folders and Unicode while signed URLs are never persisted", () => {
  const key = "Dizi Adı/Sezon 1/Bölüm-01.mp4";
  const url = r2MediaUrl(key);
  assert.equal(r2Key(url + "?exp=9999999999&sig=abcdef"), key);
  assert.equal(normalizeR2Key(url), key);
  assert.equal(mediaUrl(key), url);
  assert.equal(r2Key("/media/Test/clip.mp4"), "Test/clip.mp4");
  assert.equal(r2Folder(" /Dizi Adı/ "), "Dizi Adı/");
  assert.equal(seriesSlug("Şehirde Son Gece!"), "sehirde-son-gece");
  for (const value of ["https://evil.example/media/a.mp4", "https://user:pass@drabornseries.draborneagle.workers.dev/media/a.mp4", "../a.mp4", "Test/../a.mp4", "Test//a.mp4", "Test/a.mp4?token=x", "Test/a.txt", "Test\\a.mp4"]) {
    assert.throws(() => r2Key(value)); assert.throws(() => normalizeR2Key(value));
  }
});
test("portrait fullscreen subtitles move upward without changing Discover or landscape", () => {
  assert.equal(subtitleBottom(true, false, 0, true), 82);
  assert.equal(subtitleBottom(true, true, 24, true), 148);
  assert.equal(subtitleBottom(true, false, 0, false), 36);
  assert.equal(subtitleBottom(false, true, 24, true), 128);
  assert.equal(discoverSubtitleBottom, 270);
});
