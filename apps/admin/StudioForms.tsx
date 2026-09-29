import StudioMediaPicker from "./StudioMediaPicker";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Chip, Field, colors, styles } from "../../packages/ui/theme";

export type StudioRow = Record<string, any>;
export type StudioField = {
  key: string;
  label: string;
  type?: "number" | "long" | "choice" | "toggle" | "list" | "series" | "season" | "episode" | "date" | "json";
  choices?: [string, string][];
  hint?: string;
};
export type StudioTable = {
  table: string;
  label: string;
  singular: string;
  icon: string;
  fields: StudioField[];
  template?: StudioRow;
};
const status: [string, string][] = [
  ["draft", "Taslak"], ["scheduled", "Planlı"], ["published", "Yayında"],
  ["hidden", "Gizli"], ["archived", "Arşiv"], ["coming_soon", "Yakında"],
];
export const studioTables: StudioTable[] = [
  { table: "dbs_series", label: "Diziler", singular: "Dizi", icon: "film-outline",
    template: { slug: "", title: "", description: "", short_description: "", genres: [], status: "draft", poster_url: "", banner_url: "", trailer_url: "", is_vip: false },
    fields: [
      { key: "title", label: "Dizi adı" }, { key: "slug", label: "Bağlantı adı", hint: "Örnek: gece-hatti" },
      { key: "alternative_title", label: "Alternatif ad" },
      { key: "short_description", label: "Kısa tanıtım", type: "long" },
      { key: "description", label: "Açıklama", type: "long" },
      { key: "genres", label: "Türler", type: "list", hint: "Virgülle ayır: Dram, Romantik" },
      { key: "tags", label: "Etiketler", type: "list" }, { key: "cast_names", label: "Oyuncular", type: "list" },
      { key: "director", label: "Yönetmen" }, { key: "production_year", label: "Yapım yılı", type: "number" },
      { key: "country", label: "Ülke" }, { key: "age_rating", label: "Yaş sınırı" },
      { key: "poster_url", label: "Dikey afiş URL", hint: "HTTPS görsel adresi" },
      { key: "banner_url", label: "Yatay banner URL" },
      { key: "trailer_url", label: "Fragman URL", hint: "HTTPS video bağlantısı" },
      { key: "status", label: "Yayın durumu", type: "choice", choices: status },
      { key: "release_at", label: "Dizi yayın tarihi", type: "date" },
      { key: "is_vip", label: "VIP dizisi", type: "toggle" },
      { key: "featured_order", label: "Öne çıkarma sırası", type: "number", hint: "Boş bırakılırsa öne çıkarılmaz" },
    ] },
  { table: "dbs_seasons", label: "Sezonlar", singular: "Sezon", icon: "albums-outline",
    template: { series_id: "", number: 1, title: "Sezon 1" },
    fields: [{ key: "series_id", label: "Dizi", type: "series" }, { key: "number", label: "Sezon numarası", type: "number" }, { key: "title", label: "Sezon adı" }] },
  { table: "dbs_episodes", label: "Bölümler", singular: "Bölüm", icon: "play-circle-outline",
    template: { series_id: "", season_id: null, number: 1, title: "", duration_seconds: 120, orientation: "portrait", access_type: "free", coin_price: 0, vip_included: false, status: "draft", publish_at: new Date().toISOString() },
    fields: [
      { key: "series_id", label: "Dizi", type: "series" }, { key: "season_id", label: "Sezon (isteğe bağlı)", type: "season" },
      { key: "number", label: "Bölüm numarası", type: "number" }, { key: "title", label: "Bölüm adı" },
      { key: "description", label: "Bölüm açıklaması", type: "long" },
      { key: "duration_seconds", label: "Süre (saniye)", type: "number" },
      { key: "thumbnail_url", label: "Bölüm küçük görseli URL" },
      { key: "orientation", label: "Video yönü", type: "choice", choices: [["portrait", "Dikey 9:16"], ["landscape", "Yatay"]] },
      { key: "access_type", label: "Bölüm erişimi", type: "choice", choices: [
        ["free", "Ücretsiz"], ["coins", "BornCoins"], ["ad", "Reklamla açılır"],
        ["vip", "VIP"], ["vip_or_coins", "VIP veya BornCoins"], ["promotion", "Promosyon"],
      ] },
      { key: "coin_price", label: "BornCoins bedeli", type: "number", hint: "BornCoins/VIP veya BornCoins seçiliyse sıfırdan büyük olmalı" },
      { key: "vip_included", label: "VIP üyeliğine dahil", type: "toggle" },
      { key: "status", label: "Yayın durumu", type: "choice", choices: status.filter(([key]) => key !== "coming_soon") },
      { key: "publish_at", label: "Yayın tarihi ve saati", type: "date", hint: "2026-10-01T21:00:00+03:00 biçiminde" },
    ] },
  { table: "dbs_video_assets", label: "Videolar", singular: "Video", icon: "videocam-outline",
    template: { episode_id: "", provider: "cloudflare", stream_uid: "", r2_key: "", ready: false },
    fields: [
      { key: "episode_id", label: "Bağlı bölüm", type: "episode" },
      { key: "stream_uid", label: "Cloudflare Stream video UID", hint: "Hesap bağlıysa listeden de seçilebilir" },
      { key: "r2_key", label: "R2 kaynak anahtarı (isteğe bağlı)" },
      { key: "ready", label: "Video oynatmaya hazır", type: "toggle" },
    ] },
  { table: "dbs_subtitles", label: "Altyazılar", singular: "Altyazı", icon: "text-outline",
    template: { episode_id: "", language: "tr", label: "Türkçe", asset_key: "" },
    fields: [{ key: "episode_id", label: "Bölüm", type: "episode" }, { key: "language", label: "Dil kodu" }, { key: "label", label: "Görünen dil adı" }, { key: "asset_key", label: "VTT dosya anahtarı" }] },
  { table: "dbs_audio_tracks", label: "Ses dilleri", singular: "Ses", icon: "musical-notes-outline",
    template: { episode_id: "", language: "tr", label: "Türkçe", asset_key: "" },
    fields: [{ key: "episode_id", label: "Bölüm", type: "episode" }, { key: "language", label: "Dil kodu" }, { key: "label", label: "Görünen dil adı" }, { key: "asset_key", label: "Ses dosyası anahtarı" }] },
  { table: "dbs_featured_content", label: "Öne çıkanlar", singular: "Vitrin kaydı", icon: "star-outline",
    template: { name: "", data: {}, active: true, sort_order: 0 },
    fields: [{ key: "name", label: "Başlık" }, { key: "sort_order", label: "Gösterim sırası", type: "number" }, { key: "active", label: "Aktif", type: "toggle" }, { key: "starts_at", label: "Başlangıç", type: "date" }, { key: "ends_at", label: "Bitiş", type: "date" }, { key: "data", label: "Ek ayarlar (isteğe bağlı)", type: "json", hint: "Yalnızca özel düzenlerde gereken JSON nesnesi" }] },
  { table: "dbs_home_sections", label: "Ana sayfa", singular: "Ana sayfa alanı", icon: "grid-outline",
    template: { name: "", data: {}, active: true, sort_order: 0 },
    fields: [{ key: "name", label: "Alan adı" }, { key: "sort_order", label: "Sıralama", type: "number" }, { key: "active", label: "Göster", type: "toggle" }, { key: "data", label: "Ek ayarlar (isteğe bağlı)", type: "json" }] },
  { table: "dbs_reports", label: "Kullanıcı raporları", singular: "Rapor", icon: "flag-outline",
    fields: [{ key: "status", label: "Durum", type: "choice", choices: [["open", "Açık"], ["reviewing", "İnceleniyor"], ["resolved", "Çözüldü"]] }] },
  { table: "dbs_content_reports", label: "İçerik raporları", singular: "İçerik raporu", icon: "warning-outline",
    fields: [{ key: "status", label: "Durum", type: "choice", choices: [["open", "Açık"], ["reviewing", "İnceleniyor"], ["resolved", "Çözüldü"]] }] },
  { table: "dbs_comments", label: "Yorumlar", singular: "Yorum", icon: "chatbubble-outline",
    fields: [{ key: "status", label: "Durum", type: "choice", choices: [["pending", "Bekliyor"], ["published", "Yayında"], ["hidden", "Gizli"]] }] },
];
export const statusLabel = (value: string) => status.find(([key]) => key === value)?.[1] || ({
  free: "Ücretsiz", coins: "BornCoins", ad: "Reklam", vip: "VIP",
  vip_or_coins: "VIP / BornCoins", active: "Aktif", suspended: "Askıda", blocked: "Engelli",
  open: "Açık", reviewing: "İnceleniyor", resolved: "Çözüldü", pending: "Beklemede",
} as Record<string, string>)[value] || value;

function fieldGroup(table: string, key: string) {
  const groups: Record<string, Record<string, string>> = {
    dbs_series: { title: "Kimlik ve bağlantı", short_description: "Hikâye ve ekip", poster_url: "Görseller ve fragman", status: "Yayın ve vitrin" },
    dbs_episodes: { series_id: "Dizi ve sezon", number: "Bölüm bilgisi", thumbnail_url: "Görsel ve biçim", access_type: "Erişim ve fiyat", status: "Yayın takvimi" },
    dbs_video_assets: { episode_id: "Video bağlantısı" },
  };
  return groups[table]?.[key];
}
export function StudioForm({ config, initial, series, seasons, episodes, streamVideos, save, close, remove, readOnly }: {
  config: StudioTable; initial: StudioRow; series: StudioRow[]; seasons: StudioRow[];
  episodes: StudioRow[]; streamVideos: StudioRow[];
  save: (row: StudioRow) => void; close: () => void; remove?: () => void; readOnly?: boolean;
}) {
  const [form, setForm] = useState<StudioRow>({ ...initial });
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (config.table === "dbs_series" && (!String(form.title || "").trim() || !String(form.slug || "").trim())) {
      setError("Dizi adı ve bağlantı adı gerekli."); return;
    }
    if (config.table === "dbs_episodes" &&
      (["coins", "vip_or_coins"].includes(form.access_type) && Number(form.coin_price) < 1)) {
      setError("Bu erişim türü için BornCoins bedeli gir."); return;
    }
    if (config.fields.some((f) => f.type === "date" && form[f.key] && Number.isNaN(Date.parse(form[f.key])))) {
      setError("Tarih ISO biçiminde olmalı. Örnek: 2026-10-01T21:00:00+03:00"); return;
    }
    if (config.fields.some((f) => (f.key.endsWith("_url") && form[f.key] && !String(form[f.key]).startsWith("https://")))) {
      setError("Medya bağlantıları HTTPS ile başlamalı."); return;
    }
    if (config.table === "dbs_video_assets" && (!form.episode_id || !form.stream_uid)) {
      setError("Bölüm ve Cloudflare Stream UID gerekli."); return;
    }
    const row: StudioRow = { ...(initial.id ? { id: initial.id } : {}) };
    try {
      for (const field of config.fields) {
        const value = form[field.key];
        if (value === undefined) continue;
        row[field.key] = field.type === "json"
          ? (typeof value === "string" ? JSON.parse(value || "{}") : value)
          : field.type === "number"
            ? (value === "" || value == null ? null : Number(value))
            : field.type === "list"
              ? (Array.isArray(value) ? value : String(value).split(",").map((s) => s.trim()).filter(Boolean))
              : value === "" && (field.type === "date" || field.type === "season") ? null : value;
      }
    } catch { setError("Ek ayarlar geçerli bir JSON nesnesi olmalı."); return; }
    if (config.table === "dbs_video_assets") row.provider = "cloudflare";
    save(row);
  };
  return <View style={[styles.card, { borderColor: colors.pink, gap: 20 }]}>
    <View style={{ gap: 5 }}>
      <Text style={styles.eyebrow}>STÜDYO DÜZENLEYİCİSİ</Text>
      <Text style={styles.h2}>{initial.id ? config.singular + " düzenle" : "Yeni " + config.singular.toLocaleLowerCase("tr-TR")}</Text>
      <Text style={styles.body}>Alanları doldur ve kaydet. Yayından kaldırmak için “Gizli” veya “Arşiv” seç.</Text>
    </View>
    {config.table === "dbs_series" && !initial.id && <View style={{ padding: 15, borderRadius: 16, backgroundColor: "#49243b" }}>
      <Text style={styles.label}>Bölüm ve videoları nasıl eklerim?</Text>
      <Text style={styles.body}>Diziyi önce kaydet. Sonraki adımda “Bu diziye sezon ekle”, ardından “Bu sezona bölüm ekle” ve “Bölüme video yükle / bağla” düğmeleri görünür. Yayını, video hazır olduktan sonra aç.</Text>
    </View>}
    {readOnly && <Text style={styles.body}>Destek yetkisiyle kayıtları görebilirsin. Düzenleme için içerik yetkisi gerekir.</Text>}
    {config.fields.map((field) => {
      if (field.type === "json" && !advanced) return null;
      if (config.table === "dbs_video_assets" && field.key === "ready") return <Text key="ready" style={styles.body}>Video durumu: {form.ready ? "Oynatmaya hazır" : "Henüz doğrulanmadı / işleniyor"}. Sunucudan doğrulanarak kaydedilir.</Text>;
      const group = fieldGroup(config.table, field.key);
      const options = field.type === "series" ? series.map((s) => [s.id, s.title] as [string, string])
        : field.type === "season" ? seasons.filter((s) => s.series_id === form.series_id).map((s) => [s.id, s.title || "Sezon " + s.number] as [string, string])
        : field.type === "episode" ? episodes.map((e) => [e.id, (series.find((s) => s.id === e.series_id)?.title || "Dizi") + " · " + e.title] as [string, string])
        : field.choices;
      if (options || field.type === "toggle") return <React.Fragment key={field.key}>
        {group && <Text style={[styles.h3, { paddingTop: 10, color: colors.pink }]}>{group}</Text>}
        <View style={{ gap: 9 }}>
        <Text style={styles.label}>{field.label}</Text>
        <View style={styles.wrap}>
          {field.type === "toggle"
            ? [["true", "Evet"], ["false", "Hayır"]].map(([key, label]) =>
              <Chip key={key} label={label} active={!!form[field.key] === (key === "true")} onPress={() => update(field.key, key === "true")} />)
            : <>{field.type === "season" && <Chip label="Sezonsuz" active={!form[field.key]} onPress={() => update(field.key, null)} />}
              {options?.map(([key, label]) => <Chip key={key} label={label} active={form[field.key] === key} onPress={() => update(field.key, key)} />)}</>}
        </View>
        {field.hint && <Text style={[styles.body, { fontSize: 12 }]}>{field.hint}</Text>}
        </View>
      </React.Fragment>;
      return <React.Fragment key={field.key}>
        {group && <Text style={[styles.h3, { paddingTop: 10, color: colors.pink }]}>{group}</Text>}
        <View style={{ gap: 6 }}>
        <Field label={field.label} value={field.type === "list"
          ? (Array.isArray(form[field.key]) ? form[field.key].join(", ") : String(form[field.key] || ""))
          : field.type === "json" ? (typeof form[field.key] === "string" ? form[field.key] : JSON.stringify(form[field.key] || {}, null, 2)) : String(form[field.key] ?? "")}
          onChangeText={(text) => update(field.key, text)}
          multiline={field.type === "long" || field.type === "json"}
          keyboardType={field.type === "number" ? "numeric" : "default"}
          style={field.type === "long" || field.type === "json" ? { minHeight: 90, textAlignVertical: "top" } : undefined} />
        {field.hint && <Text style={[styles.body, { fontSize: 12 }]}>{field.hint}</Text>}
        {!readOnly && ["poster_url", "banner_url", "thumbnail_url", "trailer_url"].includes(field.key) && <StudioMediaPicker
          kind={field.key === "trailer_url" ? "trailer" : "image"} value={form[field.key]} onValue={(value) => update(field.key, value)} />}
        </View>
      </React.Fragment>;
    })}
    {config.fields.some((f) => f.type === "json") && <Button secondary small onPress={() => setAdvanced(!advanced)}>
      {advanced ? "Ek ayarları gizle" : "Gelişmiş ayarları göster"}
    </Button>}
    {config.table === "dbs_video_assets" && <View style={{ gap: 8 }}>
      {!readOnly && <StudioMediaPicker kind="episode" episodeId={form.episode_id} value={form.stream_uid}
        onValue={(value) => update("stream_uid", value)} onReady={(ready) => update("ready", ready)} />}
      <Text style={styles.label}>Cloudflare hesabındaki videolar</Text>
      <View style={styles.wrap}>{streamVideos.length ? streamVideos.map((v) =>
        <Chip key={v.uid} label={(v.name || v.uid) + (v.ready ? " ✓" : " · işleniyor")}
          active={form.stream_uid === v.uid} onPress={() => update("stream_uid", v.uid)} />)
        : <Text style={styles.body}>Hesap bağlı değilse Stream UID alanına videonun kimliğini gir.</Text>}</View>
    </View>}
    {!!error && <Text style={{ color: colors.orange }}>{error}</Text>}
    <View style={styles.wrap}>
      {!readOnly && <Button icon="save-outline" onPress={submit}>Değişiklikleri kaydet</Button>}
      <Button secondary onPress={close}>Vazgeç</Button>
      {remove && <Button secondary icon="trash-outline" onPress={remove}>Diziyi sil</Button>}
    </View>
  </View>;
}
