import { googleHeaders, packageName } from "./google.ts";
import { coinPrice, legacyCoinPrice, subscriptionPrice } from "./catalog-price.ts";
const plans: Record<string, string> = { dbs_vip_weekly: "weekly", dbs_vip_monthly: "monthly", dbs_vip_yearly: "yearly" };
const coins = ["dbs_coins_50", "dbs_coins_100", "dbs_coins_250", "dbs_coins_500", "dbs_coins_1000", "dbs_coins_2500"];
const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}`;
type Catalog = { configured: boolean; prices: Record<string, string>; available: string[]; checkedAt: string; region: string };
let cached: { value: Catalog; until: number; key: string } | undefined;
let loading: { key: string; promise: Promise<Catalog> } | undefined;
/** Public TR storefront metadata only. Credentials and purchases never leave the server. */
export async function playCatalog(credentials: string, active: string[]): Promise<Catalog> {
  const empty = { configured: Boolean(credentials), prices: {}, available: [], checkedAt: new Date().toISOString(), region: "TR" };
  if (!credentials) return empty;
  const ids = [...Object.keys(plans), ...coins].filter(id => active.includes(id)), key = ids.join(",");
  if (cached?.key === key && cached.until > Date.now()) return cached.value;
  if (loading?.key === key) return loading.promise;
  const promise = (async () => {
    try {
      const headers = await googleHeaders(credentials);
      const prices = Object.fromEntries((await Promise.all(ids.map(async id => {
        try {
          const path = plans[id] ? `/subscriptions/${id}` : `/oneTimeProducts/${id}`;
          const result = await fetch(root + path, { headers, signal: AbortSignal.timeout(12000) });
          const resource = await result.json();
          let price = result.ok ? plans[id] ? subscriptionPrice(resource, id, plans[id]) : coinPrice(resource, id) : "";
          if (!plans[id] && [404, 405].includes(result.status)) {
            const legacy = await fetch(root + `/inappproducts/${id}`, { headers, signal: AbortSignal.timeout(12000) });
            if (legacy.ok) price = legacyCoinPrice(await legacy.json(), id);
          }
          return [id, price];
        } catch { return [id, ""]; }
      }))).filter(([, price]) => Boolean(price)));
      const value = { ...empty, prices, available: Object.keys(prices), checkedAt: new Date().toISOString() };
      cached = { key, value, until: Date.now() + (value.available.length ? 300000 : 30000) };
      return value;
    } catch { cached = { key, value: empty, until: Date.now() + 30000 }; return empty; }
    finally { loading = undefined; }
  })();
  loading = { key, promise }; return promise;
}
