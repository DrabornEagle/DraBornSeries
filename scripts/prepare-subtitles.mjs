import { mkdir, readFile, writeFile } from "node:fs/promises";
import subtitleHelpers from "../packages/shared/subtitles.ts";
const { parseSubtitles } = subtitleHelpers;

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sources = { ...await json("assets/subtitles/sources.json"), ...await json("assets/subtitles/english-sources.json") };
const directory = "assets/subtitles/published";
await mkdir(directory, { recursive: true });
const toSeconds = (value) => value.replace(",", ".").split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
const normalize = (cues) => cues.map((cue) => ({ start: toSeconds(cue.start), end: toSeconds(cue.end), text: cue.text }));
const key = (cue) => `${cue.start}:${cue.end}`;
const tracks = [];
const commons = "https://commons.wikimedia.org/wiki/TimedText:";
const credits = {
  "sintel": commons + "Sintel_movie_-_Blender_Fondation.ogv.tr.srt",
  "elephants-dream": commons + "Elephants_Dream_(2006).webm.en.srt",
  "cosmos-laundromat": commons + "Cosmos_Laundromat_-_First_Cycle_-_Official_Blender_Foundation_release.webm.en.srt",
  "sprite-fright": commons + "Sprite_Fright_-_Blender_Open_Movie-full_movie.webm.en.srt",
  "tears-of-steel": "https://github.com/ghinda/acornmediaplayer/blob/gh-pages/subs/TOS-turkish.srt",
};

function wrap(text) {
  return text.split("\n").map((paragraph) => {
    const lines = []; let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > 38) { lines.push(line); line = ""; }
      line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines.join("\n");
  }).join("\n");
}
function timestamp(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  return [Math.floor(milliseconds / 3600000), Math.floor(milliseconds / 60000) % 60, Math.floor(milliseconds / 1000) % 60]
    .map((part) => String(part).padStart(2, "0")).join(":") + "." + String(milliseconds % 1000).padStart(3, "0");
}
async function publish(slug, number, cues, duration) {
  const file = `${slug}-${number}-tr.vtt`;
  const acorn = slug === "tears-of-steel";
  const license = acorn ? "MIT (sidecar source); movie CC BY 3.0" : "CC BY-SA 4.0";
  const notice = acorn ? await readFile("assets/subtitles/ACORN-LICENSE.txt", "utf8") : "https://creativecommons.org/licenses/by-sa/4.0/";
  let text = `WEBVTT\n\nNOTE\nMovie: Blender Foundation / original open movie team.\nSubtitle source: ${credits[slug]}\nAttribution: ${acorn ? "Cristian-Ioan Colceriu / acornmediaplayer contributors" : "Wikimedia Commons TimedText contributors (history at source URL)"}\nLicense: ${license}\nChanges: Turkish translation/corrections and episode-relative timing by DraBornSeries.\n${notice.trim()}\n\n`;
  for (const cue of cues) {
    if (!cue.text || !Number.isFinite(cue.start) || cue.start < 0 || cue.end <= cue.start || cue.end > duration + 0.1)
      throw new Error(`Invalid subtitle in ${file}`);
    text += `${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${wrap(cue.text)}\n\n`;
  }
  await writeFile(`${directory}/${file}`, text);
  tracks.push({ slug, number, language: "tr", label: "Türkçe", file, cue_count: cues.length, source: credits[slug], license });
}

const fullFilms = await json("docs/blender-film-catalog.json");
for (const slug of ["sintel", "elephants-dream", "cosmos-laundromat", "sprite-fright"]) {
  const original = slug === "sintel" ? sources[slug] : sources[slug + "-en"] || sources[slug];
  const cues = normalize(original.cues);
  if (slug === "sintel") cues[11].text = "Kendimi bildim bileli hep yalnızdım.";
  else {
    const translations = await json(`assets/subtitles/${slug}.tr.json`);
    if (translations.length !== cues.length || translations.some((text) => typeof text !== "string" || !text.trim()))
      throw new Error(`Incomplete Turkish translation: ${slug}`);
    cues.forEach((cue, index) => { cue.text = translations[index]; });
  }
  await publish(slug, 1, cues, fullFilms.find((film) => film.slug === slug).duration);
}

const turkish = parseSubtitles(sources["tears-of-steel"].srt.replaceAll("tutukularımızın", "tutkularımızın"));
const originals = parseSubtitles(sources["tears-of-steel-en"].srt);
const translated = new Map(turkish.map((cue) => [key(cue), cue.text]));
const complete = originals.map((cue) => {
  const text = translated.get(key(cue)) || (/^Whoaaa!$/i.test(cue.text) ? "Vay!" : "");
  if (!text) throw new Error(`Missing Tears of Steel translation at ${cue.start}`);
  return { ...cue, text };
});
const film = (await json("docs/vertical-film-catalog.json")).find((film) => film.slug === "tears-of-steel");
for (const episode of film.episodes) {
  const start = episode.start_seconds, end = start + episode.duration_seconds;
  const cues = complete.filter((cue) => cue.end > start && cue.start < end).map((cue) => ({
    start: Math.max(0, cue.start - start), end: Math.min(episode.duration_seconds, cue.end - start), text: cue.text,
  }));
  await publish(film.slug, episode.number, cues, episode.duration_seconds);
}
await writeFile(`${directory}/tracks.json`, JSON.stringify(tracks, null, 2) + "\n");
console.log(`Prepared ${tracks.length} Turkish subtitle tracks (${tracks.reduce((sum, track) => sum + track.cue_count, 0)} cues).`);
