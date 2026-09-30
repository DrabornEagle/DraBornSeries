export type SubtitleCue = { start: number; end: number; text: string };
export type SubtitleTrack = { language: string; label: string; url: string };

export function isTurkish(language: string) {
  return /^(tr|tur)([-_]|$)/i.test(language);
}

function seconds(value: string) {
  const parts = value.replace(",", ".").split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (entity) =>
    ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " })[entity] || entity).trim();
}

/** Parse SRT/WebVTT cue identifiers, settings, BOM, notes and multiline text. */
export function parseSubtitles(value: string): SubtitleCue[] {
  const lines = value.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const cues: SubtitleCue[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].trim().match(/^((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})(?:\s|$)/);
    if (!match) continue;
    const start = seconds(match[1]), end = seconds(match[2]), text: string[] = [];
    while (index + 1 < lines.length && lines[index + 1].trim()) text.push(lines[++index]);
    const content = plainText(text.join("\n"));
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && content)
      cues.push({ start, end, text: content });
  }
  return cues.sort((left, right) => left.start - right.start);
}

export function subtitleAt(cues: SubtitleCue[], time: number) {
  if (!Number.isFinite(time)) return "";
  return cues.filter((cue) => cue.start <= time && time < cue.end).map((cue) => cue.text).join("\n");
}

export function preferredSubtitle(tracks: SubtitleTrack[]) {
  return tracks.find((track) => isTurkish(track.language));
}
