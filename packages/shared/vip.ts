export type VipMembership = { product_id: string; provider: string; status: string; starts_at: string; expires_at: string; auto_renew: boolean; is_test?: boolean };
export const vipColumns = "product_id,provider,status,starts_at,expires_at,auto_renew,is_test";
export const vipStates = ["active", "grace", "cancelled"];
export function activeMemberships(rows: VipMembership[], now = Date.now()) {
  return rows.filter(row => vipStates.includes(row.status) && Date.parse(row.expires_at) > now)
    .sort((first, second) => Date.parse(second.expires_at) - Date.parse(first.expires_at));
}
export function vipPlanLabel(product = "", provider = "") {
  const labels: Record<string, string> = { dbs_vip_weekly: "Haftalık VIP", dbs_vip_monthly: "Aylık VIP", dbs_vip_yearly: "Yıllık VIP" };
  return labels[product] || (provider === "admin" ? "Hediye VIP" : provider === "promotion" || provider === "promo" ? "Promosyon VIP" : "DraBornSeries VIP");
}
export function vipCountdown(expiresAt: string | null | undefined, now = Date.now()) {
  const milliseconds = expiresAt ? Math.max(0, Date.parse(expiresAt) - now) : 0;
  const remaining = Number.isFinite(milliseconds) ? milliseconds : 0;
  const totalMinutes = Math.ceil(remaining / 60000), days = Math.floor(totalMinutes / 1440), hours = Math.floor(totalMinutes % 1440 / 60), minutes = totalMinutes % 60;
  return { active: remaining > 0, days, daysLabel: remaining === 0 ? "Süre doldu" : days > 0 ? `${days} gün` : hours > 0 ? `${hours} saat` : remaining < 60000 ? "1 dakikadan az" : `${minutes} dakika`,
    detail: remaining === 0 ? "Üyelik durumunu yenileyebilirsin." : days > 0 || hours > 0 ? `${hours} saat ${minutes} dakika kaldı` : `${Math.max(1, minutes)} dakika kaldı` };
}
