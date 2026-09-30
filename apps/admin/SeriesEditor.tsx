import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../packages/api/client";
import { videoDuration } from "../../packages/api/media-probe";
import { r2EpisodeTitle, r2Folder, r2Key, seriesSlug } from "../../packages/shared/r2";
import { readableError } from "../../packages/shared/domain";
import { Button, Chip, Field, Icon, Loading, colors, styles } from "../../packages/ui/theme";
import InlineVideo from "../../packages/ui/InlineVideo";
import StudioMediaPicker from "./StudioMediaPicker";
import R2MediaPicker from "./R2MediaPicker";
import type { StudioRow } from "./StudioForms";

type Tab = "story" | "art" | "episodes" | "publish";
type R2Object = { key: string; size?: number; duration?: number };
const tabs: [Tab, string, React.ComponentProps<typeof Button>["icon"]][] = [
  ["story", "Dizi bilgileri", "film-outline"], ["art", "Görseller", "image-outline"],
  ["episodes", "Bölümler ve R2", "folder-open-outline"], ["publish", "Yayın ayarları", "radio-outline"],
];
export default function SeriesEditor({ initial, onSaved, close, remove }: {
  initial: StudioRow; onSaved: () => Promise<void>; close: () => void; remove?: () => void;
}) {
  const [form, setForm] = useState<StudioRow>({ title: "", slug: "", description: "", short_description: "", genres: [],
    status: "draft", poster_url: "", banner_url: "", trailer_url: "", video_orientation: "portrait", r2_folder: "", is_vip: false, ...initial });
  const [tab, setTab] = useState<Tab>("story"), [advanced, setAdvanced] = useState(false), [slugManual, setSlugManual] = useState(!!initial.id);
  const [episodes, setEpisodes] = useState<StudioRow[]>([]), [loading, setLoading] = useState(!!initial.id), [saving, setSaving] = useState(false);
  const [folder, setFolder] = useState(initial.r2_folder || ""), [objects, setObjects] = useState<R2Object[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [scanning, setScanning] = useState(false), [manual, setManual] = useState("");
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [preview, setPreview] = useState<{ url: string; key: string }>();
  const [activeEpisode, setActiveEpisode] = useState<string | null>(null);
  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const changeEpisode = (key: string, field: string, value: unknown) => setEpisodes((current) => current.map((item) => item.localKey === key ? { ...item, [field]: value, dirty: true } : item));
  useEffect(() => {
    if (!initial.id) return;
    let live = true;
    api<{ episodes: StudioRow[] }>("admin-series-editor", { series: initial.id }).then((result) => {
      if (!live) return;
      setEpisodes(result.episodes.map((item) => ({ ...item, localKey: item.id, dirty: false })));
      if (!initial.video_orientation && result.episodes.length) setForm((current) => ({ ...current, video_orientation: result.episodes[0].orientation || "portrait" }));
    }).catch((err) => { if (live) setError(readableError(err)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [initial.id, initial.video_orientation]);
  const scan = async (more = false) => {
    setScanning(true); setError(""); setMessage("");
    try {
      const prefix = r2Folder(folder); update("r2_folder", prefix);
      const result = await api<{ objects: R2Object[]; cursor: string | null; message?: string }>("admin-r2-list", { prefix, ...(more ? { cursor } : {}) });
      setObjects((previous) => [...(more ? previous : []), ...result.objects].filter((item, index, items) => items.findIndex((other) => other.key === item.key) === index)
        .sort((first, second) => first.key.localeCompare(second.key, "tr", { numeric: true })));
      setCursor(result.cursor); if (!more) setSelected([]);
      setMessage(result.message || (result.objects.length ? "Videolar bulundu. Eklemek istediğin bölümleri seç." : "Bu klasörde video bulunamadı. Klasör adını ve büyük/küçük harfleri kontrol et."));
    } catch (err) { setError(readableError(err)); } finally { setScanning(false); }
  };
  const addKeys = (keys: string[]) => {
    const unique = [...new Set(keys.map((key) => r2Key(key)))].filter((key) => !episodes.some((episode) => episode.r2_key === key));
    if (episodes.filter((episode) => !episode.id).length + unique.length > 50) throw Error("Bir kayıtta en fazla 50 yeni bölüm ekleyebilirsin.");
    const start = Math.max(0, ...episodes.map((episode) => Number(episode.number) || 0));
    setEpisodes((current) => [...current, ...unique.map((key, index) => ({ localKey: key, r2_key: key, newVideo: true, dirty: true,
      number: start + index + 1, season_number: 1, title: r2EpisodeTitle(key), access_type: "free", coin_price: 0, status: "draft",
      duration_seconds: objects.find((item) => item.key === key)?.duration || "", publish_at: new Date().toISOString() }))]);
    setSelected([]); setManual(""); setMessage(unique.length + " bölüm eklendi. Bölüm adına dokunarak ayarlarını düzenleyebilirsin.");
  };
  const showPreview = async (episode: StudioRow) => {
    setError("");
    try {
      const key = r2Key(episode.r2_key);
      const result = await api<{ url: string; duration?: number }>("admin-r2-probe", { key });
      setPreview({ key, url: result.url });
      const duration = result.duration || await videoDuration(result.url);
      if (duration) changeEpisode(episode.localKey, "duration_seconds", Math.ceil(duration));
    } catch (err) { setError(readableError(err)); }
  };
  const save = async () => {
    if (saving || loading) return;
    setError(""); setSaving(true); setMessage("");
    try {
      if (!String(form.title).trim() || !String(form.slug).trim()) throw Error("Dizi adını ve bağlantı adını doldur.");
      if (episodes.some((item) => !Number.isInteger(Number(item.number)) || Number(item.number) < 1 || !String(item.title || "").trim())) throw Error("Her bölüm için bir ad ve pozitif bölüm numarası gerekli.");
      if (new Set(episodes.map((item) => Number(item.number))).size !== episodes.length) throw Error("Bölüm numaraları birbirinden farklı olmalı.");
      if (episodes.some((item) => ["coins", "vip_or_coins"].includes(item.access_type) && Number(item.coin_price) < 1)) throw Error("BornCoins ile açılan bölümlere bir fiyat yaz.");
      if ((form.release_at && Number.isNaN(Date.parse(form.release_at))) || episodes.some((item) => item.publish_at && Number.isNaN(Date.parse(item.publish_at)))) throw Error("Yayın tarihini 2026-10-01T21:00:00+03:00 biçiminde gir.");
      const changed = episodes.filter((item) => item.dirty);
      // Read metadata before persisting the episode duration. Sequential reads release each decoder.
      for (const item of changed) {
        if (!item.newVideo || Number(item.duration_seconds) > 0) continue;
        setMessage("Video süresi okunuyor: " + item.title);
        const probe = await api<{ url: string; duration?: number }>("admin-r2-probe", { key: r2Key(item.r2_key) });
        const duration = probe.duration || await videoDuration(probe.url);
        if (!duration) throw Error(item.title + " videosunun süresi okunamadı. Önizlemeyi kontrol et veya süreyi saniye olarak gir.");
        item.duration_seconds = Math.ceil(duration);
      }
      setMessage("Dizi ve bölümler kaydediliyor…");
      await api("admin-studio-save", { payload: { series: { ...form, genres: Array.isArray(form.genres) ? form.genres : String(form.genres).split(",").map((value) => value.trim()).filter(Boolean),
        r2_folder: r2Folder(folder), featured_order: form.featured_order === "" ? null : form.featured_order },
        episodes: changed.map((item) => ({ ...(item.id ? { id: item.id } : {}), number: Number(item.number), season_number: Number(item.season_number) || 1,
          title: item.title, description: item.description || "", thumbnail_url: item.thumbnail_url || "", duration_seconds: Number(item.duration_seconds) || undefined,
          access_type: item.access_type, coin_price: Number(item.coin_price) || 0, vip_included: !!item.vip_included,
          status: item.status, publish_at: item.publish_at, ...(item.newVideo ? { r2_key: r2Key(item.r2_key) } : {}) })) } });
      await onSaved();
    } catch (err) { setError(readableError(err)); } finally { setSaving(false); }
  };
  const input = (key: string, label: string, multiline = false) => <Field key={key} label={label} value={String(form[key] ?? "")}
    onChangeText={(value) => update(key, value)} multiline={multiline} style={multiline ? { minHeight: 100, textAlignVertical: "top" } : undefined} />;
  return <View style={{ gap: 18 }}>
    <LinearGradient colors={["#412342", "#281936", "#161223"]} style={[styles.card, { padding: 24 }]}>
      <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}><Text style={styles.eyebrow}>DRABORNSERIES STÜDYO</Text><Chip label={initial.id ? "DİZİYİ DÜZENLE" : "YENİ DİZİ"} active /></View>
      <Text style={styles.h1}>{form.title || "Yeni hikâyen burada."}</Text>
      <Text style={styles.body}>Dizi bilgileri, görseller ve bölümler aynı yerde. İstediğin alanı aç, düzenle ve kaydet.</Text>
      <View style={styles.wrap}><Chip label={episodes.length + " bölüm"} /><Chip label={form.video_orientation === "landscape" ? "Yatay video" : "Dikey video"} /><Chip label="R2" /></View>
    </LinearGradient>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingVertical: 4 }}>
      {tabs.map(([key, label, icon]) => <Button key={key} secondary={tab !== key} small icon={icon} onPress={() => setTab(key)}>{label}</Button>)}
    </ScrollView>
    {loading ? <Loading /> : <>
      {tab === "story" && <View style={styles.card}>
        <Text style={styles.h2}>Hikâyeni tanıt</Text>
        <Field label="Dizi adı" value={form.title} onChangeText={(value) => { update("title", value); if (!slugManual) update("slug", seriesSlug(value)); }} placeholder="Örn. Son Gece" />
        <Field label="Bağlantı adı" value={form.slug} onChangeText={(value) => { setSlugManual(true); update("slug", value); }} autoCapitalize="none" />
        {input("short_description", "Kısa tanıtım", true)}{input("description", "Dizi hakkında", true)}
        <Field label="Dizi türleri" value={Array.isArray(form.genres) ? form.genres.join(", ") : form.genres} onChangeText={(value) => update("genres", value)} placeholder="Dram, Gerilim, Romantik" />
        <View style={{ padding: 18, gap: 12, borderRadius: 18, backgroundColor: "#2b213a" }}>
          <Text style={styles.h3}>Dizinin video yönü</Text>
          <Text style={styles.body}>Bu seçim dizinin mevcut ve bundan sonra eklenen tüm bölümleri için geçerlidir.</Text>
          <View style={styles.wrap}><Chip label="Dikey · 9:16" active={form.video_orientation === "portrait"} onPress={() => update("video_orientation", "portrait")} />
            <Chip label="Yatay" active={form.video_orientation === "landscape"} onPress={() => update("video_orientation", "landscape")} /></View>
        </View>
        <Button small secondary icon="options-outline" onPress={() => setAdvanced(!advanced)}>{advanced ? "Ek bilgileri gizle" : "Oyuncular ve ek bilgiler"}</Button>
        {advanced && <View style={{ gap: 15 }}>{input("alternative_title", "Alternatif ad")}
          <Field label="Arama etiketleri" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags || ""} onChangeText={(value) => update("tags", value.split(",").map((tag) => tag.trim()).filter(Boolean))} />
          <Field label="Oyuncular" value={Array.isArray(form.cast_names) ? form.cast_names.join(", ") : form.cast_names || ""} onChangeText={(value) => update("cast_names", value.split(",").map((name) => name.trim()).filter(Boolean))} />
          {input("director", "Yönetmen")}{input("production_year", "Yapım yılı")}{input("country", "Ülke")}{input("age_rating", "Yaş sınırı")}
        </View>}
      </View>}
      {tab === "art" && <View style={styles.card}>
        <Text style={styles.h2}>Dizinin vitrini</Text>
        <View style={styles.wrap}>{form.poster_url && <Image source={{ uri: form.poster_url }} style={{ width: 120, height: 180, borderRadius: 15 }} />}
          {form.banner_url && <Image source={{ uri: form.banner_url }} style={{ width: 240, height: 135, borderRadius: 15 }} />}</View>
        {input("poster_url", "Dikey afiş bağlantısı")}<StudioMediaPicker kind="image" value={form.poster_url} onValue={(value) => update("poster_url", value)} />
        {input("banner_url", "Yatay kapak bağlantısı")}<StudioMediaPicker kind="image" value={form.banner_url} onValue={(value) => update("banner_url", value)} />
        {input("trailer_url", "Fragman bağlantısı (isteğe bağlı)")}
        <R2MediaPicker trailer value={form.trailer_url} onValue={(value) => update("trailer_url", value)} />
      </View>}
      {tab === "episodes" && <View style={{ gap: 16 }}>
        <View style={[styles.card, { borderColor: "#73e1cd50" }]}>
          <View style={styles.row}><Icon name="folder-open-outline" color={colors.mint} size={30} /><Text style={styles.h2}>R2’den bölüm ekle</Text></View>
          <Text style={styles.body}>R2’de dizi adına bir klasör açıp bölümleri yükle. Buradan klasörü seç veya dosya yollarını yapıştır.</Text>
          <Field label="Dizinin R2 klasörü" value={folder} onChangeText={setFolder} placeholder="Dizi Adı" autoCapitalize="none" />
          <Button secondary icon="search-outline" disabled={scanning} onPress={() => void scan()}>{scanning ? "Videolar aranıyor…" : "Klasördeki videoları bul"}</Button>
          {objects.length > 0 && <>
            <View style={styles.wrap}><Chip label="Tümünü seç" onPress={() => setSelected(objects.filter((item) => !episodes.some((episode) => episode.r2_key === item.key)).slice(0, 50).map((item) => item.key))} /><Chip label="Seçimi temizle" onPress={() => setSelected([])} /></View>
            {objects.map((item) => { const added = episodes.some((episode) => episode.r2_key === item.key); return <Pressable key={item.key} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(item.key), disabled: added }}
              onPress={() => { if (!added) setSelected((current) => current.includes(item.key) ? current.filter((key) => key !== item.key) : [...current, item.key]); }}
              style={[styles.row, { padding: 14, borderWidth: 1, borderRadius: 14, borderColor: selected.includes(item.key) ? colors.mint : colors.line, backgroundColor: selected.includes(item.key) ? "#19332f" : colors.bg }]}>
              <Icon name={added || selected.includes(item.key) ? "checkmark-circle" : "ellipse-outline"} color={colors.mint} />
              <View style={{ flex: 1 }}><Text style={styles.label}>{r2EpisodeTitle(item.key)}</Text><Text style={styles.body} numberOfLines={2}>{added ? "Bu diziye eklenmiş" : item.key}</Text></View>
              {!!item.size && <Text style={styles.body}>{(item.size / 1024 / 1024).toFixed(1)} MB</Text>}
            </Pressable>; })}
            {!!cursor && <Button secondary small disabled={scanning} onPress={() => void scan(true)}>Daha fazla video</Button>}
            <Button icon="add-circle-outline" disabled={!selected.length} onPress={() => { try { addKeys(selected); } catch (err) { setError(readableError(err)); } }}>{selected.length} videoyu bölüm olarak ekle</Button>
          </>}
          <Field label="Video yolları veya bağlantıları · her satıra bir video" multiline style={{ minHeight: 110, textAlignVertical: "top" }} value={manual} onChangeText={setManual} placeholder="Dizi Adı/Bolum-01.mp4\nDizi Adı/Bolum-02.mp4" autoCapitalize="none" />
          <Button secondary small icon="add" disabled={!manual.trim()} onPress={() => {
            try { addKeys(manual.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => folder && !line.includes("/") ? r2Folder(folder) + line : line)); }
            catch (err) { setError(readableError(err)); }
          }}>Bu videoları ekle</Button>
        </View>
        {!!preview && <View style={[styles.card, { padding: 15 }]}><Text style={styles.label}>Önizleme · {r2EpisodeTitle(preview.key)}</Text>
          <View style={{ height: 320, backgroundColor: "#050309", borderRadius: 16, overflow: "hidden" }}><InlineVideo url={preview.url} active muted preview={false} /></View>
          <Button secondary small onPress={() => setPreview(undefined)}>Önizlemeyi kapat</Button></View>}
        <Text style={styles.h2}>Bölümlerin · {episodes.length}</Text>
        {!episodes.length && <Text style={styles.body}>Videoları eklediğinde bölüm adları ve numaraları otomatik hazırlanır.</Text>}
        {episodes.map((item) => <View key={item.localKey} style={[styles.card, { padding: 18, borderColor: item.newVideo ? "#73e1cd50" : colors.line }]}>
          <Pressable accessibilityRole="button" onPress={() => setActiveEpisode(activeEpisode === item.localKey ? null : item.localKey)} style={[styles.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.h3}>{item.number}. {item.title}</Text><Text style={styles.body}>{item.newVideo ? "Yeni R2 videosu" : item.provider === "r2" ? "R2 videosu" : "Mevcut video"} · {item.access_type === "free" ? "Ücretsiz" : item.access_type.toUpperCase()}</Text></View><Icon name={activeEpisode === item.localKey ? "chevron-up" : "chevron-down"} color={colors.pink} />
          </Pressable>
          {activeEpisode === item.localKey && <View style={{ gap: 14 }}>
            <Field label="Bölüm adı" value={item.title} onChangeText={(value) => changeEpisode(item.localKey, "title", value)} />
            <View style={styles.wrap}><View style={{ flex: 1, minWidth: 120 }}><Field label="Bölüm numarası" value={String(item.number)} keyboardType="numeric" onChangeText={(value) => changeEpisode(item.localKey, "number", value)} /></View>
              <View style={{ flex: 1, minWidth: 120 }}><Field label="Sezon numarası" value={String(item.season_number)} keyboardType="numeric" onChangeText={(value) => changeEpisode(item.localKey, "season_number", value)} /></View></View>
            <Field label="Süre · saniye" value={String(item.duration_seconds || "")} placeholder="Video okununca otomatik doldurulur" keyboardType="numeric" onChangeText={(value) => changeEpisode(item.localKey, "duration_seconds", value)} />
            <Field label="Bölüm açıklaması" value={item.description || ""} multiline onChangeText={(value) => changeEpisode(item.localKey, "description", value)} />
            <Field label="Bölüm küçük görseli · isteğe bağlı" value={item.thumbnail_url || ""} onChangeText={(value) => changeEpisode(item.localKey, "thumbnail_url", value)} />
            <StudioMediaPicker kind="image" value={item.thumbnail_url} onValue={(value) => changeEpisode(item.localKey, "thumbnail_url", value)} />
            <Text style={styles.label}>Erişim</Text><View style={styles.wrap}>{[["free", "Ücretsiz"], ["coins", "BornCoins"], ["vip", "VIP"], ["vip_or_coins", "VIP / BornCoins"], ["ad", "Reklam"], ["promotion", "Promosyon"]].map(([key, label]) => <Chip key={key} label={label} active={item.access_type === key} onPress={() => changeEpisode(item.localKey, "access_type", key)} />)}</View>
            {["coins", "vip_or_coins"].includes(item.access_type) && <Field label="BornCoins fiyatı" value={String(item.coin_price)} keyboardType="numeric" onChangeText={(value) => changeEpisode(item.localKey, "coin_price", value)} />}
            <View style={styles.wrap}><Text style={styles.label}>VIP üyeliğine dahil</Text><Chip label="Evet" active={!!item.vip_included} onPress={() => changeEpisode(item.localKey, "vip_included", true)} /><Chip label="Hayır" active={!item.vip_included} onPress={() => changeEpisode(item.localKey, "vip_included", false)} /></View>
            <Text style={styles.label}>Bölüm durumu</Text><View style={styles.wrap}>{[["draft", "Taslak"], ["published", "Yayında"], ["scheduled", "Planlı"], ["hidden", "Gizli"]].map(([key, label]) => <Chip key={key} label={label} active={item.status === key} onPress={() => changeEpisode(item.localKey, "status", key)} />)}</View>
            <Field label="Yayın tarihi" value={item.publish_at} onChangeText={(value) => changeEpisode(item.localKey, "publish_at", value)} />
            {item.r2_key && <Text style={[styles.body, { color: colors.mint }]}>{item.r2_key}</Text>}
            <View style={styles.wrap}>{item.r2_key && <Button secondary small icon="play-outline" onPress={() => void showPreview(item)}>Videoyu izle / süreyi oku</Button>}
              {!item.id && <Button secondary small icon="close" onPress={() => setEpisodes((current) => current.filter((episode) => episode.localKey !== item.localKey))}>Eklemeyi kaldır</Button>}</View>
          </View>}
        </View>)}
      </View>}
      {tab === "publish" && <View style={styles.card}>
        <Text style={styles.h2}>Ne zaman, nasıl görünsün?</Text>
        <Text style={styles.label}>Dizi durumu</Text><View style={styles.wrap}>{[["draft", "Taslak"], ["published", "Yayında"], ["scheduled", "Planlı"], ["hidden", "Gizli"], ["coming_soon", "Yakında"], ["archived", "Arşiv"]].map(([key, label]) => <Chip key={key} label={label} active={form.status === key} onPress={() => update("status", key)} />)}</View>
        <Text style={styles.body}>Dizi ve bölümün “Yayında” olması videoyu izlemeye açar. Kaydetmeden önce önizlemeyi kontrol edebilirsin.</Text>
        <Field label="Dizi yayın tarihi · isteğe bağlı" value={form.release_at || ""} placeholder="2026-10-01T21:00:00+03:00" onChangeText={(value) => update("release_at", value)} />
        <Button secondary small icon="checkmark-circle-outline" onPress={() => setEpisodes((current) => current.map((item) => ({ ...item,
          status: ["published", "scheduled", "hidden", "archived"].includes(form.status) ? form.status : "draft",
          publish_at: form.status === "scheduled" && form.release_at ? form.release_at : item.publish_at, dirty: true })))}>Dizinin durumunu tüm bölümlere uygula</Button>
        {input("featured_order", "Ana sayfada öne çıkarma sırası · isteğe bağlı")}
        <Text style={styles.label}>VIP dizisi</Text><View style={styles.wrap}><Chip label="Evet" active={!!form.is_vip} onPress={() => update("is_vip", true)} /><Chip label="Hayır" active={!form.is_vip} onPress={() => update("is_vip", false)} /></View>
      </View>}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.mint }]}>{message}</Text>}
    {!!error && <View style={[styles.card, { borderColor: colors.orange }]}><Text accessibilityRole="alert" style={{ color: colors.orange }}>{error}</Text></View>}
    <View style={[styles.card, { padding: 18, borderColor: "#f143a160" }]}><View style={styles.wrap}>
      <Button icon="save-outline" disabled={saving || loading} onPress={() => void save()}>{saving ? "Kaydediliyor…" : "Diziyi ve bölümleri kaydet"}</Button>
      <Button secondary disabled={saving} onPress={close}>Kapat</Button>{remove && <Button secondary small icon="trash-outline" disabled={saving} onPress={remove}>Diziyi sil</Button>}
    </View></View>
  </View>;
}
