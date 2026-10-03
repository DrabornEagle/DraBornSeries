import { isPlayProduct, playCoins, playPlans } from "../api/billing-types";
import { playProductPrice, type PlayProduct } from "./play-offers";

type Fetch<T> = (request: { skus: string[]; type: "subs" | "in-app" }) => Promise<T[] | null>;
/** Retry missing rows independently; one unavailable SKU must not hide its siblings. */
export async function fetchPlayProducts<T extends PlayProduct>(fetch: Fetch<T>) {
  const products = new Map<string, T>();
  for (const [type, skus] of [["subs", Object.keys(playPlans)], ["in-app", [...playCoins]]] as const) {
    const put = (rows: T[] | null) => rows?.forEach(product => {
      if (isPlayProduct(product.id) && playProductPrice(product)) products.set(product.id, product);
    });
    try { put(await fetch({ skus: [...skus], type })); } catch {}
    for (const sku of skus) {
      if (products.has(sku)) continue;
      try { put(await fetch({ skus: [sku], type })); } catch {}
    }
  }
  return [...products.values()];
}
