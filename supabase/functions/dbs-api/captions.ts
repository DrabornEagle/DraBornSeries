const stamp = (value: string) => {
  const match = /^(\d{2}):([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
  if (!match) throw Error("INVALID_CAPTION");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
};
export function validateAutoVtt(value: unknown, duration: number) {
  if (typeof value !== "string" || new TextEncoder().encode(value).length > 300000 || !value.startsWith("WEBVTT\n\n") || !Number.isFinite(duration) || duration <= 0) throw Error("INVALID_CAPTION");
  let last = -1, cues = 0;
  for (const block of value.trim().split(/\n\s*\n/).slice(1)) {
    if (block.startsWith("NOTE ")) continue;
    const lines = block.split("\n"), match = /^(\S+) --> (\S+)$/.exec(lines[0]);
    if (!match || lines.length < 2 || !lines.slice(1).join(" ").trim() || lines.slice(1).join(" ").length > 1000) throw Error("INVALID_CAPTION");
    const start = stamp(match[1]), end = stamp(match[2]);
    if (start < last || end <= start || end > duration + 2 || end - start > 120) throw Error("INVALID_CAPTION");
    last = start; cues++;
  }
  if (!cues || cues > 6000) throw Error("INVALID_CAPTION");
  return value;
}
