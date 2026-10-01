export const workerDefault = "https://drabornseries.draborneagle.workers.dev";

export function normalizeR2Key(value: unknown, base = workerDefault) {
  if (typeof value !== "string") throw Error("INVALID_R2_KEY");
  let key = value.trim();
  if (/^https?:\/\//i.test(key)) {
    const url = new URL(key);
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith("/media/") || url.username || url.password)
      throw Error("INVALID_R2_URL");
    key = decodeURIComponent(url.pathname.slice(7));
  } else key = key.replace(/^\/?media\//, "").replace(/^\/+/, "");
  if (!key || key.length > 1024 || /[\u0000-\u001f\u007f\\?#]/.test(key) || key.split("/").some((part) => !part || part === "." || part === "..")) throw Error("INVALID_R2_KEY");
  if (!/\.(mp4|webm|m4v)$/i.test(key)) throw Error("R2_VIDEO_FORMAT");
  return key;
}

export const mediaUrl = (key: string, base = workerDefault) => base.replace(/\/$/, "") + "/media/" + normalizeR2Key(key, base).split("/").map(encodeURIComponent).join("/");

export async function workerCapabilities(base = workerDefault) {
  try {
    const response = await fetch(base + "/health", { signal: AbortSignal.timeout(5000) });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return { privateMedia: false, listing: false, serviceProbe: false };
    const data = await response.json();
    return { privateMedia: data.provider === "r2" && data.privateMedia === true, listing: data.provider === "r2" && data.listing === true, serviceProbe: data.serviceProbe === true };
  } catch { return { privateMedia: false, listing: false, serviceProbe: false }; }
}

export async function probeR2(key: string, authorization: string, base = workerDefault, secure = false, serviceKey = "") {
  if (secure) {
    const response = await fetch(base + "/studio/probe", { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json", ...(serviceKey ? { "X-Dbs-Service-Key": serviceKey } : {}) },
      body: JSON.stringify({ key }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      let detail = "";
      try { const result = await response.json(); if (/^[A-Z_]{2,60}$/.test(result.error || "")) detail = result.error; } catch { /* no private response body in logs */ }
      throw new Error("R2_VIDEO_UNAVAILABLE", { cause: "R2_WORKER_HTTP_" + response.status + (detail ? "_" + detail : "") });
    }
    const data = await response.json();
    if (!data.size || !data.url) throw Error("R2_VIDEO_UNAVAILABLE");
    return { ...data, key };
  }
  const url = mediaUrl(key, base);
  const response = await fetch(url, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !Number(response.headers.get("content-length")) || !/video\//i.test(response.headers.get("content-type") || ""))
    throw Error("R2_VIDEO_UNAVAILABLE");
  return { key, url, size: Number(response.headers.get("content-length")), duration: null, privateMedia: false };
}

export async function r2Playback(episode: string, key: string, authorization: string, accessType: string, base = workerDefault) {
  const capabilities = await workerCapabilities(base);
  if (capabilities.privateMedia) {
    const response = await fetch(base + "/playback", { method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify({ episode }), signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || !data.url) throw Error(data.error || "R2_PLAYBACK_UNAVAILABLE");
    return data;
  }
  if (accessType !== "free") throw Error("R2_PRIVATE_WORKER_REQUIRED");
  return { provider: "r2", url: mediaUrl(key, base), qualities: [] };
}
