type Money = { currencyCode?: string; units?: string; nanos?: number };
export function moneyPrice(money: Money | undefined) {
  if (!money || !/^[A-Z]{3}$/.test(money.currencyCode || "")) return "";
  const units = Number(money.units || "0"), nanos = Number(money.nanos || 0);
  if (!Number.isSafeInteger(units) || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1e9) return "";
  const amount = units + nanos / 1e9;
  if (!(amount > 0)) return "";
  try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: money.currencyCode }).format(amount); } catch { return ""; }
}
export function subscriptionPrice(resource: any, product: string, plan: string, region = "TR") {
  if (resource.productId !== product) return "";
  const base = resource.basePlans?.find((item: any) => item.basePlanId === plan && item.state === "ACTIVE");
  const regional = base?.regionalConfigs?.find((item: any) => item.regionCode === region && item.newSubscriberAvailability === true);
  return moneyPrice(regional?.price);
}
export function coinPrice(resource: any, product: string, region = "TR") {
  if (resource.productId !== product) return "";
  const option = resource.purchaseOptions?.find((item: any) => item.state === "ACTIVE" && item.buyOption && item.purchaseOptionId === "buy")
    || resource.purchaseOptions?.find((item: any) => item.state === "ACTIVE" && item.buyOption?.legacyCompatible);
  const regional = option?.regionalPricingAndAvailabilityConfigs?.find((item: any) => item.regionCode === region && item.availability === "AVAILABLE");
  return moneyPrice(regional?.price);
}
export function legacyCoinPrice(resource: any, product: string, region = "TR") {
  if (resource.sku !== product || resource.status !== "active" || resource.purchaseType !== "managedUser") return "";
  const price = resource.prices?.[region];
  if (!price || !/^\d+$/.test(price.priceMicros || "")) return "";
  const micros = Number(price.priceMicros);
  if (!Number.isSafeInteger(micros) || micros <= 0) return "";
  return moneyPrice({ currencyCode: price.currency, units: String(Math.floor(micros / 1e6)), nanos: micros % 1e6 * 1000 });
}
