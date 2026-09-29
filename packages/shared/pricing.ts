// UI examples only. Never use these amounts to initiate or verify a purchase.
// A future native checkout must render its authoritative price from Google Play ProductDetails.
export const examplePricesTRY: Record<string, number> = {
  dbs_coins_50: 39.99,
  dbs_coins_100: 69.99,
  dbs_coins_250: 149.99,
  dbs_coins_500: 269.99,
  dbs_coins_1000: 499.99,
  dbs_coins_2500: 999.99,
  dbs_vip_weekly: 69.99,
  dbs_vip_monthly: 199,
  dbs_vip_yearly: 1799,
};
export function examplePrice(id: string) {
  const amount = examplePricesTRY[id];
  return amount == null ? "Örnek fiyat bekleniyor" : "Örnek " + new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY",
  }).format(amount);
}
