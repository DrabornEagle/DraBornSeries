import test from "node:test";
import assert from "node:assert/strict";
import { playProductPrice, regularPlayOffer, type PlayProduct } from "../packages/shared/play-offers";
import { playCoins, playPlans } from "../packages/api/billing-types";
import { fetchPlayProducts } from "../packages/shared/play-products";
import { PurchaseJournal } from "../packages/shared/purchase-journal";
import { playApiFailure } from "../supabase/functions/dbs-play-verify/google-failure";

// These are the normalized shapes emitted by openiap-google 3.6.2, rather than
// synthetic empty offer IDs (the latter hid the original Android failure).
const rows: PlayProduct[] = [
  ...Object.entries(playPlans).map(([id, plan]) => ({ id, type: "subs", displayPrice: "₺334,99", productStatusAndroid: "ok", subscriptionOffers: [
    { id: plan, basePlanIdAndroid: plan, offerTokenAndroid: "regular-" + plan,
      pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: "₺334,99", priceAmountMicros: "334990000" }] } },
  ] })),
  ...playCoins.map(id => ({ id, type: "in-app", displayPrice: "₺35,99", productStatusAndroid: "ok", discountOffers: [
    { id: null, purchaseOptionIdAndroid: "buy", offerTokenAndroid: "buy-" + id, displayPrice: "₺35,99" },
  ] })),
];
test("all nine normalized Android SKUs retain Google prices and the matching payment token", () => {
  for (const row of rows) {
    assert.ok(playProductPrice(row), row.id);
    assert.ok(regularPlayOffer(row)?.offerTokenAndroid, row.id);
  }
  const monthly = rows.find(row => row.id === "dbs_vip_monthly")!;
  assert.equal(playProductPrice({ ...monthly, subscriptionOffers: [{ ...monthly.subscriptionOffers![0], id: "trial", pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: "₺0" }, { formattedPrice: "₺334,99" }] } }] }), "");
  assert.equal(playProductPrice({ ...monthly, productStatusAndroid: "not-found" }), "");
});
test("one unavailable coin does not erase fetched siblings, and missing rows are retried without parallel store queries", async () => {
  let querying = false;
  const calls: string[][] = [];
  const products = await fetchPlayProducts<PlayProduct>(async request => {
    assert.equal(querying, false); querying = true;
    calls.push(request.skus);
    await Promise.resolve();
    querying = false;
    if (request.skus.length > 1) return rows.filter(row => request.skus.includes(row.id) && row.id.endsWith("50"));
    if (request.skus[0] === "dbs_coins_2500") throw Error("Temporarily unavailable");
    return rows.filter(row => request.skus.includes(row.id));
  });
  assert.equal(products.length, 8);
  assert.ok(products.some(row => row.id === "dbs_vip_monthly"));
  assert.ok(products.some(row => row.id === "dbs_coins_1000"));
  assert.ok(calls.some(call => call.length === 1 && call[0] === "dbs_coins_100"));
});
test("Console one-time options and eligible discounts use their own actual price and token, never a rental", () => {
  const product = { id: "dbs_coins_100", type: "in-app", displayPrice: "wrong", discountOffers: [
    { id: "rent", offerTokenAndroid: "rent", rentalDetailsAndroid: {}, displayPrice: "₺1" },
    { id: "promotion", purchaseOptionIdAndroid: "default", offerTokenAndroid: "eligible", displayPrice: "₺61,99" },
  ] };
  assert.equal(playProductPrice(product), "₺61,99");
  assert.equal(regularPlayOffer(product)?.offerTokenAndroid, "eligible");
});
test("unfinished purchases survive restart and concurrent writes, without crossing accounts or losing another receipt", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) || null,
    setItem: async (key: string, value: string) => { await Promise.resolve(); values.set(key, value); } };
  let journal = new PurchaseJournal(storage);
  await Promise.all([
    journal.remember("owner", { productId: "dbs_coins_50", purchaseToken: "one" }),
    journal.remember("owner", { productId: "dbs_coins_100", purchaseToken: "two" }),
  ]);
  journal = new PurchaseJournal(storage);
  assert.equal((await journal.list("owner")).length, 2);
  assert.deepEqual(await journal.list("other-account"), []);
  await journal.forget("owner", "one");
  assert.deepEqual((await journal.list("owner")).map(row => row.purchaseToken), ["two"]);
  await journal.remember("owner", { productId: "dbs_coins_100", purchaseToken: "two", purchaseState: "pending" });
  assert.equal((await journal.list("owner")).length, 1);
});
test("Google permission denial stays distinct from pending/invalid receipts and transient outages", () => {
  const denied = playApiFailure(401, { error: { errors: [{ reason: "permissionDenied" }] } });
  assert.equal(denied.error, "PLAY_VERIFICATION_PERMISSION"); assert.equal(denied.retry, true);
  assert.equal(playApiFailure(503, {}).error, "PLAY_TEMPORARILY_UNAVAILABLE");
  assert.equal(playApiFailure(400, {}).error, "PURCHASE_NOT_VERIFIED");
  assert.equal(playApiFailure(400, {}).retry, false);
});
