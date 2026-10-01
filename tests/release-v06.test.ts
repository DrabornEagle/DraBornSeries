import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTrailer } from "../supabase/functions/dbs-api/trailer";

test("trailers follow the selected direction and only reuse the matching media's caption clock", () => {
  const url = "https://media.example.com/episode-2.mp4";
  const episodes = [{ id: "one", number: 1, orientation: "portrait" }, { id: "two", number: 2, orientation: "landscape" }];
  const assets = [{ episode_id: "two", demo_url: url }];
  assert.deepEqual(resolveTrailer(url, episodes, assets), { matchedEpisodeId: "two", orientation: "landscape", qualities: [] });
  assert.equal(resolveTrailer(url, episodes, assets, "portrait")?.orientation, "portrait");
  assert.equal(resolveTrailer("https://media.example.com/new-edit.mp4", episodes, assets)?.matchedEpisodeId, undefined);
  assert.equal(resolveTrailer(url, [episodes[0]], assets)?.matchedEpisodeId, undefined);
  for (const unsafe of ["http://media.example.com/a.mp4", "javascript:alert(1)", "https://user:secret@example.com/a.mp4"])
    assert.equal(resolveTrailer(unsafe, episodes, assets), undefined);
});

test("Google Play legal pages are standalone, public HTML with a usable outside-app deletion path", async () => {
  const output = await mkdtemp(join(tmpdir(), "dbs-legal-test-"));
  try {
    const { writeLegalPages } = await import("../scripts/legal-pages.mjs");
    await writeLegalPages(output);
    for (const name of ["privacy.html", "terms.html", "account-deletion.html"]) {
      const html = await readFile(join(output, name), "utf8");
      assert.match(html, /<html lang="tr">/);
      assert.match(html, /DraBornSeries/);
      assert.match(html, /DraBornEagle/);
      assert.match(html, /mailto:support@draborneagle\.com/);
      assert.doesNotMatch(html, /<script|type="password"/);
    }
    const deletion = await readFile(join(output, "account-deletion.html"), "utf8");
    assert.match(deletion, /\.\/\?page=delete-account/);
    assert.match(deletion, /mailto:support@draborneagle\.com\?subject=/);
    assert.match(deletion, /Korunan asgari kayıtlar/);
  } finally { await rm(output, { recursive: true, force: true }); }
});
