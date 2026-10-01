export const playPlans = { dbs_vip_weekly: "weekly", dbs_vip_monthly: "monthly", dbs_vip_yearly: "yearly" } as const;
export type Billing = { ready: boolean; busy: boolean; message: string; prices: Record<string, string>; buy: (id: string) => Promise<void>; restore: () => Promise<void> };
