export function ssvContent(rawQuery: string) {
  if (rawQuery.length > 10000) throw Error("INVALID_SSV");
  const marker = rawQuery.indexOf("&signature=");
  if (marker < 1 || !/^signature=[A-Za-z0-9_%-]+&key_id=\d+$/.test(rawQuery.slice(marker + 1))) throw Error("INVALID_SSV");
  const params = new URLSearchParams(rawQuery), seen = new Set<string>();
  for (const [key] of params) { if (seen.has(key)) throw Error("INVALID_SSV"); seen.add(key); }
  return { params, content: new TextEncoder().encode(rawQuery.slice(0, marker)), signature: params.get("signature")!, keyId: params.get("key_id")! };
}
export function base64Bytes(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0));
}
/** Google's ECDSA callback uses DER; WebCrypto expects 32-byte R + S. */
export function derToRaw(bytes: Uint8Array) {
  if (bytes[0] !== 0x30 || bytes[1] !== bytes.length - 2 || bytes[2] !== 2) throw Error("INVALID_SSV_SIGNATURE");
  const firstLength = bytes[3], second = firstLength + 4;
  if (bytes[second] !== 2 || second + 2 + bytes[second + 1] !== bytes.length) throw Error("INVALID_SSV_SIGNATURE");
  const integer = (start: number, length: number) => {
    let part = bytes.slice(start, start + length);
    if (part[0] === 0) part = part.slice(1);
    if (!part.length || part.length > 32 || bytes[start] & 0x80) throw Error("INVALID_SSV_SIGNATURE");
    const output = new Uint8Array(32); output.set(part, 32 - part.length); return output;
  };
  const output = new Uint8Array(64); output.set(integer(4, firstLength)); output.set(integer(second + 2, bytes[second + 1]), 32); return output;
}
export async function verifySsv(rawQuery: string, spki: Uint8Array) {
  const parsed = ssvContent(rawQuery);
  const key = await crypto.subtle.importKey("spki", spki as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(base64Bytes(parsed.signature)) as BufferSource, parsed.content))) throw Error("INVALID_SSV_SIGNATURE");
  return parsed.params;
}
