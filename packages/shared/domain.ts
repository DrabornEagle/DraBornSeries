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
  if (message.includes("dbs_seasons_series_id_number_key")) return "Bu dizide aynı numaralı sezon zaten var. Mevcut sezonu açarak düzenleyebilirsin.";
  if (message.includes("dbs_episodes_series_id_number_key")) return "Bu dizide aynı numaralı bölüm zaten var. Bölüm numarasını kontrol et.";
  if (/failed to fetch|network request failed|networkerror|load failed|timeout/i.test(message))
    return "İnternet bağlantını kontrol et. Kaydedilmiş içeriklerin burada; bağlantı geldiğinde tekrar deneyebilirsin.";
  const known: Record<string, string> = {
    AUTH_REQUIRED: "Devam etmek için hesabına giriş yap.",
    OWNER_REQUIRED: "Bu işlem için proje sahibi yetkisi gerekir.",
    CONFIRMATION_REQUIRED: "Dizi adını doğru yazarak silme işlemini onayla.",
    ACCOUNT_UNAVAILABLE: "Bu hesap şu anda kullanılamıyor.",
    ALREADY_CLAIMED: "Bu ödülü zaten aldın.",
    TASK_INCOMPLETE: "Önce görev açıklamasındaki adımı tamamla.",
    TASK_UNAVAILABLE: "Bu görev şu anda kullanılamıyor.",
    EMAIL_UNCONFIRMED: "Ödül almak için e-posta adresini doğrula.",
    INSUFFICIENT_COINS: "BornCoins bakiyen yeterli değil.",
    EPISODE_UNAVAILABLE: "Bu bölüm henüz yayında değil.",
    VIDEO_NOT_READY: "Video henüz yayına hazır değil.",
    INVALID_PROMO: "Promosyon kodu geçersiz veya süresi dolmuş.",
    ACCESS_DENIED: "Bu bölüm için erişim gerekiyor.",
    STREAM_UPLOAD_NOT_CONFIGURED: "Video yükleme için Cloudflare Stream hesabını Stüdyo backendine bağlaman gerekiyor. Supabase Functions Secrets alanına CLOUDFLARE_ACCOUNT_ID ve CLOUDFLARE_API_TOKEN ekle.",
    STREAM_UPLOAD_FAILED: "Cloudflare video yükleme bağlantısı oluşturulamadı. Hesap yetkilerini kontrol et.",
    STREAM_STATUS_FAILED: "Cloudflare video durumu okunamadı. Stream UID ve hesap bağlantısını kontrol et.",
    STREAM_NOT_CONFIGURED: "Video dağıtımı henüz etkinleştirilmedi.",
    Invalid: "İşlem tamamlanamadı.",
  };
  return (
    Object.entries(known).find(([k]) => message.includes(k))?.[1] || message
  );
};

export function compactCount(value: number) {
  const count = Math.max(0, Number(value) || 0);
  return count >= 1000000 ? `${(count / 1000000).toFixed(1).replace(".0", "")} Mn`
    : count >= 1000 ? `${(count / 1000).toFixed(1).replace(".0", "")} B` : String(count);
}
