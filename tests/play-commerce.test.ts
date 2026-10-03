import test from "node:test";
import assert from "node:assert/strict";
import { playProductPrice, regularPlayOffer } from "../packages/shared/play-offers";
import { coinPrice, legacyCoinPrice, moneyPrice, subscriptionPrice } from "../supabase/functions/dbs-play-verify/catalog-price";
import { validateCoinReceipt } from "../supabase/functions/dbs-play-verify/coin-receipt";

test("VIP prices and payments select the configured regular base plan, never trials or another period", () => {
  const product = { id: "dbs_vip_monthly", type: "subs", displayPrice: "₺0", subscriptionOffers: [
    { id: "trial", basePlanIdAndroid: "monthly", offerTokenAndroid: "trial", displayPrice: "₺0" },
    { basePlanIdAndroid: "yearly", offerTokenAndroid: "wrong", displayPrice: "₺100" },
    { basePlanIdAndroid: "monthly", offerTokenAndroid: "correct", pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: "₺199,99" }] } },
  ] };
  assert.equal(regularPlayOffer(product)?.offerTokenAndroid, "correct");
  assert.equal(playProductPrice(product), "₺199,99");
  assert.equal(playProductPrice({ ...product, subscriptionOffers: product.subscriptionOffers.slice(0, 2) }), "");
});
test("coin purchase price matches the selected one-time buy option and supports legacy ProductDetails", () => {
  const product = { id: "dbs_coins_50", type: "in-app", displayPrice: "₺50", discountOffers: [
    { id: "sale", displayPrice: "₺1", offerTokenAndroid: "sale" },
    { purchaseOptionIdAndroid: "buy", displayPrice: "₺39,99", offerTokenAndroid: "buy" },
  ] };
  assert.equal(playProductPrice(product), "₺39,99");
  assert.equal(regularPlayOffer(product)?.offerTokenAndroid, "buy");
  assert.equal(playProductPrice({ ...product, discountOffers: null }), "₺50");
  assert.equal(playProductPrice({ ...product, id: "unknown-product" }), "");
});
test("web catalog uses active TR Console prices with nanos, not examples or another country's price", () => {
  const money = { currencyCode: "TRY", units: "199", nanos: 990000000 };
  assert.match(moneyPrice(money), /199,99/);
  assert.equal(moneyPrice({ ...money, nanos: 1e9 }), "");
  assert.equal(moneyPrice({ currencyCode: "TRY", units: "NaN" }), "");
  const subscription = { productId: "dbs_vip_monthly", basePlans: [{ basePlanId: "monthly", state: "ACTIVE", regionalConfigs: [{ regionCode: "TR", newSubscriberAvailability: true, price: money }] }] };
  assert.match(subscriptionPrice(subscription, "dbs_vip_monthly", "monthly"), /199,99/);
  assert.equal(subscriptionPrice(subscription, "dbs_vip_monthly", "weekly"), "");
  assert.equal(subscriptionPrice(subscription, "dbs_vip_monthly", "monthly", "US"), "");
  subscription.basePlans[0].state = "INACTIVE";
  assert.equal(subscriptionPrice(subscription, "dbs_vip_monthly", "monthly"), "");
  const coin = { productId: "dbs_coins_50", purchaseOptions: [{ purchaseOptionId: "buy", buyOption: {}, state: "ACTIVE", regionalPricingAndAvailabilityConfigs: [{ regionCode: "TR", availability: "AVAILABLE", price: money }] }] };
  assert.match(coinPrice(coin, "dbs_coins_50"), /199,99/);
  coin.purchaseOptions[0].regionalPricingAndAvailabilityConfigs[0].availability = "NO_LONGER_AVAILABLE";
  assert.equal(coinPrice(coin, "dbs_coins_50"), "");
  assert.match(legacyCoinPrice({ sku: "dbs_coins_50", status: "active", purchaseType: "managedUser", prices: { TR: { currency: "TRY", priceMicros: "39990000" } } }, "dbs_coins_50"), /39,99/);
});
test("coin verification rejects foreign accounts, wrong products, cancelled and multi-quantity payments", () => {
  const receipt = { purchaseState: 0, quantity: 1, productId: "dbs_coins_50", obfuscatedExternalAccountId: "account" };
  assert.equal(validateCoinReceipt(receipt, "dbs_coins_50", "account"), "purchased");
  assert.equal(validateCoinReceipt({ ...receipt, purchaseState: 2 }, "dbs_coins_50", "account"), "pending");
  assert.throws(() => validateCoinReceipt(receipt, "dbs_coins_100", "account"), /PRODUCT_MISMATCH/);
  assert.throws(() => validateCoinReceipt(receipt, "dbs_coins_50", "other"), /ACCOUNT_MISMATCH/);
  assert.throws(() => validateCoinReceipt({ ...receipt, quantity: 2 }, "dbs_coins_50", "account"), /QUANTITY/);
  assert.throws(() => validateCoinReceipt({ ...receipt, purchaseState: 1 }, "dbs_coins_50", "account"), /CANCELLED/);
});
