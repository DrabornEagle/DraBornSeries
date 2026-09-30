export const r2WorkerUrl = "https://drabornseries.draborneagle.workers.dev";

/** Persist object keys, never expiring links or another provider's URL. */
export function r2Key(value: unknown, base = r2WorkerUrl): string {
  if (typeof value !== "string") throw Error("INVALID_R2_KEY");
  let key = value.trim();
  if (/^https?:\/\//i.test(key)) {
    const url = new URL(key);
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith("/media/") || url.username || url.password)
      throw Error("INVALID_R2_URL");
    key = decodeURIComponent(url.pathname.slice(7));
  } else {
    key = key.replace(/^\/?media\//, "").replace(/^\/+/, "");
  }
  if (!key || key.length > 1024 || /[\u0000-\u001f\u007f\\?#]/.test(key) || key.split("/").some((part) => !part || part === "." || part === ".."))
    throw Error("INVALID_R2_KEY");
  if (!/\.(mp4|webm|m4v)$/i.test(key)) throw Error("R2_VIDEO_FORMAT");
  return key;
}

export function r2MediaUrl(key: string, base = r2WorkerUrl) {
  return base.replace(/\/$/, "") + "/media/" + r2Key(key, base).split("/").map(encodeURIComponent).join("/");
}

export function r2Folder(value: string) {
  const folder = value.trim().replace(/^\/+|\/+$/g, "");
  if (folder.length > 1000 || /[\u0000-\u001f\u007f\\?#]/.test(folder) || folder.split("/").some((part) => part === "." || part === ".."))
    throw Error("INVALID_R2_KEY");
  return folder ? folder + "/" : "";
}

export function r2EpisodeTitle(key: string) {
  return key.split("/").pop()!.replace(/\.(mp4|webm|m4v)$/i, "").replace(/[_-]+/g, " ").trim();
}

export function seriesSlug(title: string) {
  return title.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
