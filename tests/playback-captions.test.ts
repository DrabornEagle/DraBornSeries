import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSubtitles, preferredSubtitle, subtitleAt } from "../packages/shared/subtitles";
import { getDiscoverStart, getPreviewWindow } from "../packages/shared/preview-window";
import { buildDiscoverEntries } from "../packages/shared/discover";
import { publicSubtitleTracks } from "../supabase/functions/dbs-api/subtitles";
import { naturalConflict } from "../supabase/functions/dbs-api/stream";
import type { Episode, Series } from "../packages/types";

test("Discover includes all 18 published films, including every landscape film", () => {
  const films: { slug: string }[] = JSON.parse(readFileSync("docs/blender-film-catalog.json", "utf8"));
  const collections: { slug: string; episodes: { number: number }[] }[] = JSON.parse(readFileSync("docs/vertical-film-catalog.json", "utf8"));
  const series = [...films, ...collections].map((film) => ({ id: film.slug, status: "published" })) as Series[];
  series.push({ id: "coming-soon", status: "coming_soon" } as Series);
  const episodes = [...films.map((film) => ({ id: film.slug, series_id: film.slug, status: "published", orientation: "landscape", access_type: "free" })),
    ...collections.flatMap((film) => film.episodes.map((episode: { number: number }) => ({ id: `${film.slug}-${episode.number}`, series_id: film.slug, status: "published", orientation: "portrait", access_type: "free" })))] as Episode[];
  episodes.push({ id: "draft", series_id: films[0].slug, status: "draft", access_type: "free" } as Episode);
  const feed = buildDiscoverEntries(series, episodes, 42);
  assert.equal(feed.length, 18);
  assert.equal(new Set(feed.map((scene) => scene.series.id)).size, 18);
  assert.equal(feed.filter((scene) => scene.episode.orientation === "landscape").length, 14);
  assert.ok(feed.every((scene) => scene.episode.status === "published"));
});

test("Discover does not omit a published VIP-only series", () => {
  const series = [{ id: "vip-series", status: "published" }] as Series[];
  const episodes = [{ id: "vip-episode", series_id: "vip-series", status: "published", access_type: "vip" }] as Episode[];
  assert.equal(buildDiscoverEntries(series, episodes, 7)[0].episode.id, "vip-episode");
});

test("Discover starts at the middle without changing the home preview loop", () => {
  assert.equal(getDiscoverStart(630), 315);
  assert.equal(getDiscoverStart(60), 30);
  for (const invalid of [NaN, Infinity, -10, 0]) assert.equal(getDiscoverStart(invalid), 0);
  assert.equal(getPreviewWindow(630).start, 45);
});

test("caption parser and clock handle cue settings, overlap, seeks, Unicode and off-screen gaps", () => {
  const cues = parseSubtitles("\uFEFFWEBVTT\r\n\r\nNOTE\r\nLicensed sidecar\r\n\r\na\r\n00:01.000 --> 00:03.000 align:middle\r\n<i>Türkçe</i> &amp; ses\r\nİkinci satır\r\n\r\nb\r\n00:02.000 --> 00:04.000\r\nBaşka konuşmacı\r\n\r\n");
  assert.equal(subtitleAt(cues, 1.5), "Türkçe & ses\nİkinci satır");
  assert.equal(subtitleAt(cues, 2.5), "Türkçe & ses\nİkinci satır\nBaşka konuşmacı");
  assert.equal(subtitleAt(cues, 4), "");
  assert.equal(subtitleAt(cues, 0), "");
  assert.equal(subtitleAt(cues, NaN), "");
  assert.equal(subtitleAt(cues, 1.5), "Türkçe & ses\nİkinci satır");
});

test("Turkish defaults on, while private keys and insecure subtitle addresses remain hidden", () => {
  const tracks = publicSubtitleTracks([
    { language: "en", label: "English", asset_key: "https://example.com/en.vtt" },
    { language: "tr-TR", label: "Türkçe", asset_key: "https://example.com/tr.vtt" },
    { language: "tr", label: "Private", asset_key: "private/subtitles.vtt" },
    { language: "tr", label: "Unsafe", asset_key: "javascript:alert(1)" },
    { language: "tr", label: "HTTP", asset_key: "http://example.com/tr.vtt" },
    { language: "tr", label: "Credentials", asset_key: "https://user:password@example.com/tr.vtt" },
  ]);
  assert.equal(tracks.length, 2);
  assert.equal(preferredSubtitle(tracks)?.language, "tr-TR");
  assert.equal(preferredSubtitle([tracks[0]]), undefined);
  assert.equal(naturalConflict("dbs_subtitles", false), "episode_id,language");
});

test("all published Turkish files are complete and Tears of Steel cues cross cuts at the right time", () => {
  const tracks = JSON.parse(readFileSync("assets/subtitles/published/tracks.json", "utf8"));
  assert.equal(tracks.length, 9);
  for (const track of tracks) {
    const cues = parseSubtitles(readFileSync(`assets/subtitles/published/${track.file}`, "utf8"));
    assert.equal(cues.length, track.cue_count);
    assert.ok(cues.every((cue) => cue.text.trim() && cue.start >= 0 && cue.end > cue.start));
    assert.doesNotMatch(cues.map((cue) => cue.text).join("\n"), /Any further questions|How perfect|My name is Victor|Hello, Mr\. Snail/);
  }
  const second = parseSubtitles(readFileSync("assets/subtitles/published/tears-of-steel-2-tr.vtt", "utf8"));
  const third = parseSubtitles(readFileSync("assets/subtitles/published/tears-of-steel-3-tr.vtt", "utf8"));
  assert.deepEqual(second.at(-1), { start: 149, end: 150, text: "Tam bir aptalsın Thom!" });
  assert.deepEqual(third[0], { start: 0, end: 1, text: "Tam bir aptalsın Thom!" });
  const sintel = parseSubtitles(readFileSync("assets/subtitles/published/sintel-1-tr.vtt", "utf8"));
  assert.equal(subtitleAt(sintel, 107.5), "Bu silahın karanlık bir geçmişi var.");
});
