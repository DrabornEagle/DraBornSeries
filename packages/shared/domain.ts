import type { Episode, Series } from "../types";
export const rewardDays = [2, 3, 5, 5, 7, 10, 20] as const;
export function formatTime(value: number) {
  const safe = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
export function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .trim();
}
export function filterSeries(
  series: Series[],
  query: string,
  genre: string,
  filter: string,
) {
  const needle = normalize(query);
  return series.filter(
    (s) =>
      (!needle ||
        normalize(
          [
            s.title,
            s.alternative_title,
            s.description,
            s.country,
            ...s.genres,
            ...s.tags,
            ...s.cast_names,
          ].join(" "),
        ).includes(needle)) &&
      (!genre || s.genres.includes(genre)) &&
      (filter !== "vip" || s.is_vip) &&
      (filter !== "free" || s.is_demo) &&
      (filter !== "upcoming" || s.status === "coming_soon"),
  );
}
export function accessLabel(ep: Episode, lang = "tr") {
  const tr = lang === "tr";
  return {
    free: tr ? "Ücretsiz" : "Free",
    coins: `${ep.coin_price} BornCoins`,
    vip: "VIP",
    ad: tr ? "Reklamla aç" : "Watch an ad",
    vip_or_coins: `VIP / ${ep.coin_price} BornCoins`,
    promotion: tr ? "Kampanya" : "Promotion",
  }[ep.access_type];
}
export function clientCanWatch(
  ep: Episode,
  unlocked: Set<string>,
  vip: boolean,
) {
  return (
    ep.access_type === "free" ||
    unlocked.has(ep.id) ||
    (vip &&
      (ep.vip_included ||
        ep.access_type === "vip" ||
        ep.access_type === "vip_or_coins"))
  );
}
export const readableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const known: Record<string, string> = {
    AUTH_REQUIRED: "Devam etmek için hesabına giriş yap.",
    ACCOUNT_UNAVAILABLE: "Bu hesap şu anda kullanılamıyor.",
    ALREADY_CLAIMED: "Bu ödülü zaten aldın.",
    INSUFFICIENT_COINS: "BornCoins bakiyen yeterli değil.",
    EPISODE_UNAVAILABLE: "Bu bölüm henüz yayında değil.",
    VIDEO_NOT_READY: "Video henüz yayına hazır değil.",
    INVALID_PROMO: "Promosyon kodu geçersiz veya süresi dolmuş.",
    ACCESS_DENIED: "Bu bölüm için erişim gerekiyor.",
    STREAM_NOT_CONFIGURED: "Video dağıtımı henüz etkinleştirilmedi.",
    Invalid: "İşlem tamamlanamadı.",
  };
  return (
    Object.entries(known).find(([k]) => message.includes(k))?.[1] || message
  );
};
