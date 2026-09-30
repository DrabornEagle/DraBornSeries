export const streamUID = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);

/** Manual saves must keep the previous playable asset until its replacement is ready. */
export function assertPlayableStream(video: { uid?: unknown; readyToStream?: boolean; requireSignedURLs?: boolean; status?: { state?: string } }, uid: string) {
  if (!streamUID(video.uid) || video.uid !== uid) throw Error("INVALID_STREAM_UID");
  if (video.readyToStream !== true || video.status?.state === "error") throw Error("VIDEO_NOT_READY");
  if (video.requireSignedURLs !== true) throw Error("VIDEO_MUST_REQUIRE_SIGNED_URLS");
}

export async function verifyStreamWebhook(raw: string, header: string, secret: string, now = Date.now()) {
  if (!secret) return false;
  const timestamp = /(?:^|,)\s*time=(\d+)/.exec(header)?.[1];
  const signatures = [...header.matchAll(/(?:^|,)\s*sig1=([a-f0-9]{64})(?=,|$)/g)].map((match) => match[1]);
  if (!timestamp || !signatures.length || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = encoder.encode(timestamp + "." + raw);
  for (const signature of signatures) {
    const expected = Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16));
    if (await crypto.subtle.verify("HMAC", key, expected, bytes)) return true;
  }
  return false;
}

export function naturalConflict(table: string, hasID: boolean) {
  if (hasID) return "id";
  return ({ dbs_seasons: "series_id,number", dbs_episodes: "series_id,number", dbs_video_assets: "episode_id", dbs_series: "slug" } as Record<string,string>)[table] || "id";
}
