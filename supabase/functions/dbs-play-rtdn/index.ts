import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";
import { hash, packageName } from "../dbs-play-verify/google.ts";
import { syncSubscription } from "../dbs-play-verify/sync.ts";
const env = (name: string) => Deno.env.get(name) || "";
const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { db: { schema: "drabornseries" }, auth: { persistSession: false } });
Deno.serve(async request => {
  const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405);
  if (!env("DBS_PLAY_RTDN_SERVICE_EMAIL") || !env("DBS_GOOGLE_SERVICE_ACCOUNT")) return reply(503);
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    const { payload } = await jwtVerify(token, keys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env("DBS_PLAY_RTDN_AUDIENCE") || env("SUPABASE_URL") + "/functions/v1/dbs-play-rtdn", algorithms: ["RS256"] });
    if (payload.email !== env("DBS_PLAY_RTDN_SERVICE_EMAIL") || payload.email_verified !== true) return reply(401);
  } catch { return reply(401); }
  try {
    const raw = await request.text(); if (raw.length > 30000) return reply(413);
    const body = JSON.parse(raw); if (typeof body.message?.data !== "string" || body.message.data.length > 20000) return reply(400);
    const notice = JSON.parse(atob(body.message.data));
    if (notice.packageName !== packageName) return reply(400);
    if (notice.testNotification) return reply(204);
    const notification = notice.subscriptionNotification || notice.voidedPurchaseNotification;
    const purchaseToken = notification?.purchaseToken;
    if (typeof purchaseToken !== "string" || purchaseToken.length < 1 || purchaseToken.length > 4096) return reply(400);
    const tokenHash = await hash(purchaseToken);
    const { data: prior, error } = await service.from("dbs_purchases").select("user_id,product_id").eq("token_hash", tokenHash).maybeSingle();
    if (error) return reply(503);
    // New purchase notifications can arrive before the in-app verification.
    if (!prior) return reply(503);
    const { data: product } = await service.from("dbs_google_play_products").select("kind").eq("id", prior.product_id).single();
    if (product?.kind !== "vip") return reply(204);
    // The current Google API response controls access, including revoked refunds.
    await syncSubscription(service, prior.user_id, prior.product_id, purchaseToken, env("DBS_GOOGLE_SERVICE_ACCOUNT"), Boolean(notice.voidedPurchaseNotification));
    return reply(204);
  } catch { console.error("Play RTDN processing failed; Pub/Sub will retry."); return reply(503); }
});
