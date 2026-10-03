export const playPlans = { dbs_vip_weekly: "weekly", dbs_vip_monthly: "monthly", dbs_vip_yearly: "yearly" } as const;
export const playCoins = ["dbs_coins_50", "dbs_coins_100", "dbs_coins_250", "dbs_coins_500", "dbs_coins_1000", "dbs_coins_2500"] as const;
export const isCoinProduct = (id: string) => (playCoins as readonly string[]).includes(id);
export const isPlayProduct = (id: string) => isCoinProduct(id) || Object.hasOwn(playPlans, id);
export type PlayCatalog = { configured: boolean; prices: Record<string, string>; available: string[]; checkedAt: string; region: string };
export type Billing = { ready: boolean; busy: boolean; message: string; prices: Record<string, string>; available: string[]; buy: (id: string) => Promise<void>; restore: () => Promise<void>; refresh: () => Promise<void> };
