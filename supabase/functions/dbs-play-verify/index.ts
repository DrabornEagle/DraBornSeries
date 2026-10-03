import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { syncSubscription } from "./sync.ts";
import { googleHeaders, googleRoot, hash } from "./google.ts";
import { validateCoinReceipt } from "./coin-receipt.ts";
import { playApiFailure } from "./google-failure.ts";
const env = (key: string) => Deno.env.get(key) || "";
const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { db: { schema: "drabornseries" }, auth: { persistSession: false } });
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
Deno.serve(async request => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      db: { schema: "drabornseries" }, global: { headers: { Authorization: request.headers.get("authorization") || "" } }, auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: "AUTH_REQUIRED" }, 401);
    const { data: profile } = await client.from("dbs_profiles").select("user_id,status").eq("user_id", user.id).single();
    if (!profile || profile.status !== "active") return reply({ error: "ACCOUNT_UNAVAILABLE" }, 403);
    if (!env("DBS_GOOGLE_SERVICE_ACCOUNT")) return reply({ error: "BILLING_NOT_CONFIGURED" }, 503);
    const raw = await request.text(); if (raw.length > 10000) return reply({ error: "BODY_TOO_LARGE" }, 413);
    const { productId, purchaseToken } = JSON.parse(raw);
    if (typeof productId !== "string" || typeof purchaseToken !== "string" || purchaseToken.length < 1 || purchaseToken.length > 4096) return reply({ error: "INVALID_PURCHASE" }, 400);
    const { data: product } = await service.from("dbs_google_play_products").select("*").eq("id", productId).eq("active", true).single();
    if (!product) return reply({ error: "PRODUCT_INACTIVE" }, 409);
    if (product.kind === "vip") {
      const result = await syncSubscription(service, user.id, productId, purchaseToken, env("DBS_GOOGLE_SERVICE_ACCOUNT"));
      return reply(result, result.entitled ? result.acknowledged ? 200 : 202 : 409);
    }
    if (product.kind !== "coins") return reply({ error: "PRODUCT_INACTIVE" }, 409);
    const google = await googleHeaders(env("DBS_GOOGLE_SERVICE_ACCOUNT"));
    const path = `/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const verification = await fetch(googleRoot + path, { headers: google, signal: AbortSignal.timeout(15000) });
    if (!verification.ok) {
      const failure = playApiFailure(verification.status, await verification.json().catch(() => ({})));
      console.warn("dbs-play-verify: Google purchase lookup", verification.status, failure.error);
      return reply({ error: failure.error, retry: failure.retry }, failure.status);
    }
    const receipt = await verification.json();
    if (validateCoinReceipt(receipt, productId, await hash(user.id)) === "pending") return reply({ status: "pending" }, 202);
    const tokenHash = await hash(purchaseToken);
    if (receipt.consumptionState === 1) {
      const { data: prior, error } = await service.from("dbs_purchases").select("user_id,product_id,status").eq("token_hash", tokenHash).maybeSingle();
      if (error) throw Error("VERIFICATION_FAILED");
      if (!prior || prior.user_id !== user.id || prior.product_id !== productId || prior.status === "refunded") return reply({ error: "PURCHASE_ALREADY_CONSUMED" }, 409);
    }
    const { data, error } = await service.rpc("dbs_apply_verified_purchase", {
      account: user.id, product: productId, token_hash: tokenHash, order_id: receipt.orderId || null,
      subscription_status: "verified", expires_at: null, receipt,
    });
    if (error) { console.error("dbs-play-verify: ledger rejected", error.code); throw Error("VERIFICATION_FAILED"); }
    // Atomically credit once before consuming. Failed consumption stays recoverable via restore.
    const consumed = receipt.consumptionState === 1 || await fetch(googleRoot + path + ":consume", { method: "POST", headers: google, signal: AbortSignal.timeout(15000) }).then(result => result.ok).catch(() => false);
    const { data: wallet } = await service.from("dbs_borncoins_wallet").select("balance").eq("user_id", user.id).single();
    return reply({ verified: true, credited: !data?.duplicate, consumed, acknowledged: consumed, retry: !consumed,
      coins: product.coins, balance: wallet?.balance, orderId: receipt.orderId || null, ...data }, consumed ? 200 : 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : "VERIFICATION_FAILED";
    if (["PURCHASE_ACCOUNT_MISMATCH", "PURCHASE_PRODUCT_MISMATCH"].includes(code)) return reply({ error: code }, 403);
    if (["PURCHASE_CANCELLED", "UNSUPPORTED_QUANTITY"].includes(code)) return reply({ error: code }, 409);
    if (["PLAY_VERIFICATION_PERMISSION", "GOOGLE_AUTH_FAILED", "PLAY_TEMPORARILY_UNAVAILABLE"].includes(code)) return reply({ error: code, retry: true }, 503);
    console.error("dbs-play-verify: verification failed"); return reply({ error: "VERIFICATION_FAILED" }, 503);
  }
});
