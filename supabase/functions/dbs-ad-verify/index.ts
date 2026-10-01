import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { base64Bytes, ssvContent, verifySsv } from "./signature.ts";
const env = (key: string) => Deno.env.get(key) || "";
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { db: { schema: "drabornseries" }, auth: { persistSession: false } });
const admobVerificationUser = "00000000-0000-4000-8000-000000000001";
const admobVerificationTicket = "00000000-0000-4000-8000-000000000002";
let cached: { keys: { keyId: number; base64: string }[]; expires: number } | undefined;
async function trustedKeys(refresh = false) {
  if (cached && cached.expires > Date.now() && !refresh) return cached.keys;
  const response = await fetch("https://www.gstatic.com/admob/reward/verifier-keys.json", { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("KEYS_UNAVAILABLE");
  const data = await response.json(); if (!Array.isArray(data.keys) || !data.keys.length) throw Error("KEYS_UNAVAILABLE");
  cached = { keys: data.keys, expires: Date.now() + 6 * 60 * 60 * 1000 }; return cached.keys;
}
Deno.serve(async request => {
  const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "GET") return reply(405);
  if (env("DBS_ADMOB_MODE") !== "production" || !env("DBS_ADMOB_AD_UNIT")) return reply(503);
  const raw = new URL(request.url).search.slice(1);
  try {
    const parsed = ssvContent(raw);
    let key = (await trustedKeys()).find(item => String(item.keyId) === parsed.keyId);
    if (!key) key = (await trustedKeys(true)).find(item => String(item.keyId) === parsed.keyId);
    if (!key) return reply(401);
    const params = await verifySsv(raw, base64Bytes(key.base64));
    const expectedUnit = env("DBS_ADMOB_AD_UNIT").split("/").at(-1);
    if (params.get("ad_unit") !== expectedUnit || params.get("reward_amount") !== "3" || params.get("reward_item") !== "BornCoins") return reply(400);
    if (!/^[a-f0-9-]{36}$/.test(params.get("user_id") || "") || !/^[a-f0-9-]{36}$/.test(params.get("custom_data") || "")) return reply(400);
    const timestamp = Number(params.get("timestamp"));
    if (!Number.isFinite(timestamp) || timestamp < Date.now() - 48 * 60 * 60 * 1000 || timestamp > Date.now() + 5 * 60 * 1000) return reply(400);
    if (params.get("user_id") === admobVerificationUser && params.get("custom_data") === admobVerificationTicket) return reply(200);
    const { error } = await service.rpc("dbs_complete_ad", { ticket: params.get("custom_data"), account: params.get("user_id"), transaction: params.get("transaction_id"), ad_unit: expectedUnit, earned_at: new Date(timestamp).toISOString() });
    if (error) return reply(/INVALID_AD|ALREADY_USED|DAILY_LIMIT|EPISODE_UNAVAILABLE|ACCOUNT_UNAVAILABLE/.test(error.message) ? 400 : 503);
    return reply(200);
  } catch (error) { return reply(error instanceof Error && error.message === "KEYS_UNAVAILABLE" ? 503 : 401); }
});
