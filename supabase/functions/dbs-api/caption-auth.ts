const issuer = "https://token.actions.githubusercontent.com";
const repository = "DrabornEagle/DraBornSeries";
export const captionAudience = "drabornseries-subtitles";
let cached: { until: number; keys: JsonWebKey[] } | undefined;
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error("INVALID_RUNNER");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}
export function assertCaptionClaims(claims: Record<string, any>, now = Math.floor(Date.now() / 1000)) {
  if (claims.iss !== issuer || claims.aud !== captionAudience || claims.repository !== repository || claims.repository_id !== "1393825232"
    || claims.ref !== "refs/heads/main" || claims.sub !== `repo:${repository}:ref:refs/heads/main`
    || claims.workflow_ref !== `${repository}/.github/workflows/subtitles.yml@refs/heads/main`
    || !["schedule", "workflow_dispatch", "push"].includes(claims.event_name)
    || !Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) || !Number.isInteger(claims.nbf)
    || claims.exp <= now || claims.nbf > now + 30 || claims.iat > now + 30 || claims.iat < now - 600
    || claims.exp > claims.iat + 600) throw Error("INVALID_RUNNER");
}
export async function verifyCaptionRunner(authorization: string, suppliedKeys?: JsonWebKey[], now?: number) {
  if (!authorization.startsWith("Bearer ") || authorization.length > 16000) throw Error("INVALID_RUNNER");
  const parts = authorization.slice(7).split(".");
  if (parts.length !== 3) throw Error("INVALID_RUNNER");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw Error("INVALID_RUNNER");
  assertCaptionClaims(claims, now);
  if (!suppliedKeys && (!cached || cached.until < Date.now())) {
    const response = await fetch(issuer + "/.well-known/jwks", { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error("INVALID_RUNNER");
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw Error("INVALID_RUNNER");
    cached = { keys: data.keys, until: Date.now() + 300000 };
  }
  const jwk = (suppliedKeys || cached!.keys).find((key: JsonWebKey & { kid?: string }) => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw Error("INVALID_RUNNER");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]))) throw Error("INVALID_RUNNER");
  return claims;
}
