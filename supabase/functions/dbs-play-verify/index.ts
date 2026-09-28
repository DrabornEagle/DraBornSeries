import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { SignJWT, importPKCS8 } from "npm:jose@6.1.0";
const env = (key: string) => Deno.env.get(key) || "";
const service = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { db: { schema: "drabornseries" }, auth: { persistSession: false } },
);
const hash = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
Deno.serve(async (request) => {
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "POST")
    return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!env("DBS_GOOGLE_SERVICE_ACCOUNT"))
    return reply({ error: "BILLING_NOT_CONFIGURED" }, 503);
  try {
    const authorization = request.headers.get("authorization") || "";
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      db: { schema: "drabornseries" },
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) return reply({ error: "AUTH_REQUIRED" }, 401);
    const { data: profile } = await client
      .from("dbs_profiles")
      .select("user_id")
      .single();
    if (!profile) return reply({ error: "ACCOUNT_UNAVAILABLE" }, 403);
    const body = await request.json();
    const { productId, purchaseToken } = body;
    if (
      typeof productId !== "string" ||
      typeof purchaseToken !== "string" ||
      purchaseToken.length > 4096
    )
      return reply({ error: "INVALID_PURCHASE" }, 400);
    const { data: product } = await service
      .from("dbs_google_play_products")
      .select("*")
      .eq("id", productId)
      .eq("active", true)
      .single();
    if (!product) return reply({ error: "PRODUCT_INACTIVE" }, 409);
    const credentials = JSON.parse(env("DBS_GOOGLE_SERVICE_ACCOUNT"));
    const privateKey = await importPKCS8(credentials.private_key, "RS256");
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/androidpublisher",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(credentials.client_email)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const oauth = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const token = await oauth.json();
    if (!oauth.ok || !token.access_token) throw Error("GOOGLE_AUTH_FAILED");
    const packageName = "com.draborneagle.drabornseries";
    const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases`;
    const googleHeaders = {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    };
    const path =
      product.kind === "vip"
        ? `/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
        : `/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const verification = await fetch(root + path, { headers: googleHeaders });
    const receipt = await verification.json();
    if (!verification.ok) return reply({ error: "PURCHASE_NOT_VERIFIED" }, 403);
    const expectedAccount = await hash(user.id);
    const actualAccount =
      product.kind === "vip"
        ? receipt.externalAccountIdentifiers?.obfuscatedExternalAccountId
        : receipt.obfuscatedExternalAccountId;
    if (actualAccount !== expectedAccount)
      return reply({ error: "PURCHASE_ACCOUNT_MISMATCH" }, 403);
    let expires: string | null = null,
      orderId: string | null = null,
      status = "verified";
    if (product.kind === "coins") {
      if (receipt.purchaseState !== 0)
        return reply(
          { status: receipt.purchaseState === 2 ? "pending" : "cancelled" },
          receipt.purchaseState === 2 ? 202 : 409,
        );
      if ((receipt.quantity || 1) !== 1)
        return reply({ error: "UNSUPPORTED_QUANTITY" }, 409);
      orderId = receipt.orderId || null;
    } else {
      const line = receipt.lineItems?.find(
        (line: any) => line.productId === productId,
      );
      expires = line?.expiryTime || null;
      const valid = [
        "SUBSCRIPTION_STATE_ACTIVE",
        "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
        "SUBSCRIPTION_STATE_CANCELED",
      ];
      if (
        !line ||
        !valid.includes(receipt.subscriptionState) ||
        new Date(expires!).getTime() <= Date.now()
      )
        return reply({ error: "SUBSCRIPTION_NOT_ACTIVE" }, 409);
      status =
        receipt.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
          ? "grace"
          : receipt.subscriptionState === "SUBSCRIPTION_STATE_CANCELED"
            ? "cancelled"
            : "active";
      orderId = line.latestSuccessfulOrderId || receipt.latestOrderId || null;
    }
    const tokenHash = await hash(purchaseToken);
    const { data, error } = await service.rpc("dbs_apply_verified_purchase", {
      account: user.id,
      product: productId,
      token_hash: tokenHash,
      order_id: orderId,
      subscription_status: status,
      expires_at: expires,
      receipt,
    });
    if (error) throw Error(error.message);
    // Credit entitlement atomically first. A retry can safely repeat acknowledgement/consumption.
    if (product.kind === "coins") {
      const consume = await fetch(
        root +
          `/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`,
        { method: "POST", headers: googleHeaders },
      );
      if (!consume.ok && receipt.consumptionState !== 1)
        return reply({ credited: true, acknowledged: false, retry: true }, 202);
    } else if (
      receipt.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
    ) {
      const ack = await fetch(
        root +
          `/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
        { method: "POST", headers: googleHeaders, body: "{}" },
      );
      if (!ack.ok)
        return reply({ credited: true, acknowledged: false, retry: true }, 202);
    }
    return reply({ verified: true, ...data });
  } catch (error) {
    console.error(
      "dbs-play-verify",
      error instanceof Error ? error.message : "unknown",
    );
    return reply({ error: "VERIFICATION_FAILED" }, 400);
  }
});
