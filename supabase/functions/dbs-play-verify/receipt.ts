export function subscriptionSnapshot(receipt: any, product: string, now = Date.now()) {
  const line = receipt.lineItems?.find((item: any) => item.productId === product);
  if (!line || !Number.isFinite(Date.parse(line.expiryTime))) throw Error("INVALID_SUBSCRIPTION_RECEIPT");
  const states: Record<string, string> = { SUBSCRIPTION_STATE_ACTIVE: "active", SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace", SUBSCRIPTION_STATE_CANCELED: "cancelled", SUBSCRIPTION_STATE_PAUSED: "paused", SUBSCRIPTION_STATE_ON_HOLD: "on_hold", SUBSCRIPTION_STATE_EXPIRED: "expired", SUBSCRIPTION_STATE_PENDING: "pending", SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "revoked" };
  const state = states[receipt.subscriptionState];
  if (!state) throw Error("INVALID_SUBSCRIPTION_STATE");
  const entitled = ["active", "grace", "cancelled"].includes(state) && Date.parse(line.expiryTime) > now;
  return { status: !entitled && ["active", "grace", "cancelled"].includes(state) ? "expired" : state, expires: line.expiryTime, entitled,
    autoRenew: line.autoRenewingPlan?.autoRenewEnabled === true, orderId: line.latestSuccessfulOrderId || receipt.latestOrderId || null };
}
