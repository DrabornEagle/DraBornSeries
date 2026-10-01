/** DraBornSeries R2 gateway. Paste this entire file into the existing Worker. */
const SUPABASE_URL = "https://xpdiwyxnnrmyvpcqwuyb.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_cu71JQGPiRusMw_YeZzUbg_6r9r13TG";
const allowedOrigins = ["https://www.draborneagle.com", "https://draborneagle.com", "http://localhost:8081", "http://localhost:8082"];
const videoPattern = /\.(mp4|m4v|webm)$/i;
const encoder = new TextEncoder();
const signingSecret = (env) => env.SIGNING_SECRET || env.MEDIA_SIGNING_SECRET || env.DBS_MEDIA_SIGNING_SECRET;
function bucketBinding(env) {
  // Accept the existing binding name so replacing the code does not require rebinding.
  return Object.values(env).find((binding) => binding && typeof binding.get === "function" && typeof binding.head === "function" && typeof binding.list === "function");
}
function objectKey(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\u0000-\u001f\u007f\\?#]/.test(value) || value.split("/").some((part) => !part || part === "." || part === "..")) throw Error("INVALID_R2_KEY");
  return value;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signedUrl(request, env, key, seconds = 7200) {
  const secret = signingSecret(env);
  if (!secret) throw Error("R2_SIGNING_SECRET_REQUIRED");
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(key + "\n" + expires));
  const hex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { url: new URL("/media/" + key.split("/").map(encodeURIComponent).join("/"), request.url).origin + "/media/" + key.split("/").map(encodeURIComponent).join("/") + "?exp=" + expires + "&sig=" + hex,
    expires_at: new Date(expires * 1000).toISOString() };
}
async function verifyUrl(url, env, key) {
  const secret = signingSecret(env), expires = url.searchParams.get("exp"), signature = url.searchParams.get("sig");
  if (!secret || !expires || !/^\d+$/.test(expires) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + 43200) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), Uint8Array.from(signature.match(/../g), (pair) => parseInt(pair, 16)), encoder.encode(key + "\n" + expires));
}
async function rpc(request, name, args = {}) {
  // Server-only secret keys are API keys, not user JWTs. Never return or log this header.
  const serviceKey = request.headers.get("x-dbs-service-key");
  if (serviceKey && !serviceKey.startsWith("sb_secret_") && !serviceKey.startsWith("eyJ")) throw Error("ACCESS_DENIED");
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, { method: "POST", headers: {
    apikey: serviceKey || PUBLISHABLE_KEY, "Content-Type": "application/json", "Content-Profile": "drabornseries",
    ...(!serviceKey?.startsWith("sb_secret_") && request.headers.get("authorization") ? { Authorization: request.headers.get("authorization") } : {}),
  }, body: JSON.stringify(args) });
  if (!response.ok) throw Error("ACCESS_DENIED");
  return response.json();
}
async function editor(request) {
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) throw Error("AUTH_REQUIRED");
  if (await rpc(request, "dbs_is_admin") !== true) throw Error("ADMIN_REQUIRED");
}
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw Error("RANGE_NOT_SATISFIABLE");
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (suffix < 1) throw Error("RANGE_NOT_SATISFIABLE"); start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) throw Error("RANGE_NOT_SATISFIABLE");
  return { offset: start, length: end - start + 1 };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get("origin"), bucket = bucketBinding(env);
    const cors = new Headers({ "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Headers": "authorization,content-type,range,if-range,if-none-match",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS", "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,ETag",
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" });
    const reply = (data, status = 200) => { const headers = new Headers(cors); headers.set("Content-Type", "application/json"); return new Response(JSON.stringify(data), { status, headers }); };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (origin && !allowedOrigins.includes(origin)) return reply({ error: "ORIGIN_DENIED" }, 403);
    if (url.pathname === "/health" && request.method === "GET") return reply({ ok: !!bucket, provider: "r2", version: "0.7.1", serviceProbe: true, listing: !!bucket, privateMedia: !!bucket && !!signingSecret(env) });
    if (!bucket) return reply({ error: "R2_BUCKET_BINDING_REQUIRED" }, 503);
    try {
      if (url.pathname === "/studio/media" && request.method === "GET") {
        await editor(request);
        const prefix = url.searchParams.get("prefix") || "";
        if (prefix.length > 1000 || /[\u0000-\u001f\\?#]/.test(prefix) || prefix.split("/").some((part) => part === "." || part === "..")) throw Error("INVALID_R2_KEY");
        const cursor = url.searchParams.get("cursor") || undefined;
        const result = await bucket.list({ prefix, cursor, limit: 100, include: ["httpMetadata", "customMetadata"] });
        return reply({ configured: true, objects: result.objects.filter((item) => videoPattern.test(item.key)).map((item) => ({ key: item.key, size: item.size,
          uploaded: item.uploaded, duration: Number(item.customMetadata?.duration) || null })), cursor: result.truncated ? result.cursor : null });
      }
      if (["/studio/probe", "/playback", "/trailer"].includes(url.pathname) && request.method === "POST") {
        const raw = await request.text();
        if (raw.length > 5000) return reply({ error: "BODY_TOO_LARGE" }, 413);
        const body = JSON.parse(raw);
        let key;
        if (url.pathname === "/studio/probe") { await editor(request); key = objectKey(body.key); }
        else if (url.pathname === "/trailer") {
          if (typeof body.series !== "string" || !/^[a-f0-9-]{36}$/i.test(body.series)) throw Error("INVALID_SERIES");
          key = objectKey(await rpc(request, "dbs_r2_trailer_key", { series: body.series }));
        } else {
          if (typeof body.episode !== "string" || !/^[a-f0-9-]{36}$/i.test(body.episode)) throw Error("INVALID_EPISODE");
          key = objectKey(await rpc(request, "dbs_r2_playback_key", { episode: body.episode }));
        }
        const metadata = await bucket.head(key);
        if (!metadata || !metadata.size || !videoPattern.test(key)) return reply({ error: "R2_VIDEO_UNAVAILABLE" }, 404);
        return reply({ provider: "r2", key, size: metadata.size, duration: Number(metadata.customMetadata?.duration) || null, privateMedia: true, ...await signedUrl(request, env, key) });
      }
      if (!url.pathname.startsWith("/media/") || !["GET", "HEAD"].includes(request.method)) return reply({ error: "NOT_FOUND" }, 404);
      const key = objectKey(decodeURIComponent(url.pathname.slice(7)));
      if (!(await verifyUrl(url, env, key))) return reply({ error: "SIGNED_URL_REQUIRED" }, 403);
      const metadata = await bucket.head(key);
      if (!metadata) return reply({ error: "NOT_FOUND" }, 404);
      const headers = new Headers(cors);
      metadata.writeHttpMetadata(headers);
      if (!headers.get("Content-Type") || headers.get("Content-Type") === "application/octet-stream") headers.set("Content-Type", /\.webm$/i.test(key) ? "video/webm" : /\.(vtt)$/i.test(key) ? "text/vtt; charset=utf-8" : "video/mp4");
      headers.set("ETag", metadata.httpEtag); headers.set("Accept-Ranges", "bytes"); headers.set("Cache-Control", "private, max-age=300");
      if (request.headers.get("if-none-match") === metadata.httpEtag) return new Response(null, { status: 304, headers });
      let range;
      try { range = parseRange(request.headers.get("if-range") && request.headers.get("if-range") !== metadata.httpEtag ? null : request.headers.get("range"), metadata.size); }
      catch { headers.set("Content-Range", "bytes */" + metadata.size); return new Response(null, { status: 416, headers }); }
      headers.set("Content-Length", String(range ? range.length : metadata.size));
      if (range) headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
      if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
      const object = await bucket.get(key, { ...(range ? { range } : {}), onlyIf: { etagMatches: metadata.etag } });
      if (!object) return reply({ error: "NOT_FOUND" }, 404);
      if (!object.body) return reply({ error: "R2_OBJECT_CHANGED_RETRY" }, 409);
      return new Response(object.body, { status: range ? 206 : 200, headers });
    } catch (error) {
      const message = error instanceof Error ? error.message : "REQUEST_FAILED";
      return reply({ error: message }, /AUTH_REQUIRED|ACCESS_DENIED|ADMIN_REQUIRED/.test(message) ? 403 : /SECRET_REQUIRED/.test(message) ? 503 : 400);
    }
  },
};
