import { googleHeaders, googleRoot, hash } from "./google.ts";
import { subscriptionSnapshot } from "./receipt.ts";
export async function syncSubscription(service: any, user: string, product: string, token: string, credentials: string, voided = false) {
  const observed = new Date().toISOString(), headers = await googleHeaders(credentials);
  const response = await fetch(googleRoot + "/subscriptionsv2/tokens/" + encodeURIComponent(token), { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("PURCHASE_NOT_VERIFIED");
  const receipt = await response.json();
  if (receipt.externalAccountIdentifiers?.obfuscatedExternalAccountId !== await hash(user)) throw Error("PURCHASE_ACCOUNT_MISMATCH");
  const snapshot = subscriptionSnapshot(receipt, product), tokenHash = await hash(token), linkedHash = receipt.linkedPurchaseToken ? await hash(receipt.linkedPurchaseToken) : null;
  if (voided && snapshot.status === "expired") snapshot.status = "revoked";
  const { linkedPurchaseToken: _linked, ...safeReceipt } = receipt;
  const { data, error } = await service.rpc("dbs_sync_play_subscription", { account: user, product, token_hash: tokenHash, order_id: snapshot.orderId,
    subscription_status: snapshot.status, expires_at: snapshot.expires, auto_renew: snapshot.autoRenew, receipt: safeReceipt, observed_at: observed, linked_hash: linkedHash });
  if (error) throw Error(error.message);
  let acknowledged = receipt.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
  if (snapshot.entitled && !acknowledged) {
    const ack = await fetch(googleRoot + `/subscriptions/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}:acknowledge`, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(15000) });
    acknowledged = ack.ok;
  }
  return { ...data, verified: true, status: data.status || snapshot.status, entitled: data.entitled, acknowledged };
}
