import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import { Button, Chip, Empty, Field, Icon, Loading, colors, styles } from "../../packages/ui/theme";
import StudioUsers from "./StudioUsers";
import StudioMetrics from "./StudioMetrics";
import { StudioForm, studioTables, statusLabel, type StudioRow, type StudioTable } from "./StudioForms";

type Section = "content" | "users" | "metrics" | "reports" | "logs";
const sections: [Section, string, React.ComponentProps<typeof Icon>["name"]][] = [
  ["content", "İçerik", "film-outline"], ["users", "Kullanıcılar", "people-outline"],
  ["metrics", "İstatistikler", "analytics-outline"], ["reports", "Raporlar", "flag-outline"],
  ["logs", "İşlem kayıtları", "time-outline"],
];
const contentTables = studioTables.filter((item) => !["dbs_reports", "dbs_content_reports", "dbs_comments"].includes(item.table));
const reportTables = studioTables.filter((item) => !contentTables.includes(item));
function title(row: StudioRow, config: StudioTable) {
  if (config.table === "dbs_episodes")
    return "Bölüm " + row.number + " · " + row.title;
  if (config.table === "dbs_seasons")
    return row.title || "Sezon " + row.number;
  if (config.table === "dbs_video_assets")
    return "Stream videosu · " + (row.stream_uid || "UID eksik");
  if (config.table === "dbs_subtitles" || config.table === "dbs_audio_tracks")
    return row.label || row.language;
  return row.title || row.name || row.kind || row.body || config.singular;
}
function description(row: StudioRow, config: StudioTable, allSeries: StudioRow[]) {
  const series = allSeries.find((item) => item.id === row.series_id);
  const parts = [
    series?.title, row.status ? statusLabel(row.status) : null,
    row.access_type ? statusLabel(row.access_type) : null,
    row.coin_price ? row.coin_price + " BornCoins" : null,
    row.featured_order == null ? null : "Vitrin sırası " + row.featured_order,
    row.sort_order == null ? null : "Sıra " + row.sort_order,
  ].filter(Boolean);
  if (config.table === "dbs_video_assets")
    parts.push(row.ready ? "Oynatmaya hazır" : "Video işleniyor");
  return parts.join(" · ") || row.short_description || row.description || "Kaydı açarak düzenle";
}
function logTitle(row: StudioRow) {
  return ({ save: "Kayıt düzenlendi", delete: "Dizi silindi", catalog_replace: "Test kataloğu yenilendi", coin_grant: "BornCoins tanımlandı",
    vip_grant: "VIP tanımlandı" } as Record<string, string>)[row.action] || row.action || "Yönetici işlemi";
}
function logDetail(row: StudioRow) {
  const info = row.detail || {};
  const target = studioTables.find((item) => item.table === row.target)?.label ||
    (row.action === "coin_grant" || row.action === "vip_grant" ? "Kullanıcı hesabı" : "Kayıt");
  const detail = row.action === "coin_grant" ? info.coins + " BornCoins · " + (info.reason || "")
    : row.action === "vip_grant" ? info.days + " gün VIP · " + (info.reason || "")
      : row.action === "delete" ? (info.title || "Dizi")
        : row.action === "save" ? "Değiştirilen alan: " + (info.fields || []).length
          : "";
  return [target, detail, row.admin_name || "Yönetici", new Date(row.created_at).toLocaleString("tr-TR")].filter(Boolean).join(" · ");
}
export default function AdminPanel({ store, run }: {
  store: Store; run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [deleteName, setDeleteName] = useState("");
  const [section, setSection] = useState<Section>("content");
  const [table, setTable] = useState("dbs_series");
  const [rows, setRows] = useState<StudioRow[]>([]);
  const [series, setSeries] = useState<StudioRow[]>([]);
  const [seasons, setSeasons] = useState<StudioRow[]>([]);
  const [episodes, setEpisodes] = useState<StudioRow[]>([]);
  const [streamVideos, setStreamVideos] = useState<StudioRow[]>([]);
  const [role, setRole] = useState("support");
  const [editor, setEditor] = useState<StudioRow | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const config = studioTables.find((item) => item.table === table) || studioTables[0];
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ rows: StudioRow[] }>("admin-list", { table: section === "logs" ? "dbs_admin_logs" : table });
      setRows(data.rows || []);
    } finally { setLoading(false); }
  }, [table, section]);
  const catalog = useCallback(async () => {
    const [s, seasonsResult, episodeResult] = await Promise.all([
      api<{ rows: StudioRow[] }>("admin-list", { table: "dbs_series" }),
      api<{ rows: StudioRow[] }>("admin-list", { table: "dbs_seasons" }),
      api<{ rows: StudioRow[] }>("admin-list", { table: "dbs_episodes" }),
    ]);
    setSeries(s.rows); setSeasons(seasonsResult.rows); setEpisodes(episodeResult.rows);
  }, []);
  useEffect(() => {
    if (!store.isAdmin) return;
    run(async () => {
      const me = await api<{ role: string }>("admin-me");
      setRole(me.role);
      await catalog();
    });
  }, [store.isAdmin, catalog, run]);
  useEffect(() => {
    if (!store.isAdmin || section === "users" || section === "metrics") return;
    run(load); setEditor(null); setQuery("");
  }, [store.isAdmin, section, load, run]);
  useEffect(() => {
    if (!store.isAdmin || table !== "dbs_video_assets" || section !== "content") return;
    api<{ videos: StudioRow[] }>("admin-stream-videos").then((result) => setStreamVideos(result.videos)).catch(() => setStreamVideos([]));
  }, [store.isAdmin, section, table]);
  if (!store.isAdmin)
    return <Empty title="Yönetici erişimi gerekiyor"
      detail="Bu alan yalnızca yetkili DraBornSeries yöneticilerine açıktır."
      icon="shield-checkmark-outline" />;
  const open = (row: StudioRow) => { setEditor({ ...row }); setEditKey((current) => current + 1); setConfirmDelete(false); };
  const save = (row: StudioRow) => run(async () => {
    await api("admin-save", { table, row });
    setEditor(null); await load(); await catalog(); await store.refreshCatalog();
  }, config.singular + " kaydedildi.");
  const remove = () => {
    if (!confirmDelete) { setDeleteName(""); setConfirmDelete(true); return; }
    if (!editor?.id) return;
    return run(async () => {
      await api("admin-delete", { table: "dbs_series", id: editor.id, confirm: "DELETE", title: editor.title });
      setEditor(null); setConfirmDelete(false); await load(); await catalog(); await store.refreshCatalog();
    }, "Dizi ve bölümleri silindi.");
  };
  const visible = rows.filter((row) =>
    JSON.stringify(row).toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const choices = section === "reports" ? reportTables : contentTables;
  return <View style={{ gap: 21 }}>
    <View style={{ gap: 8 }}>
      <Text style={styles.eyebrow}>DRABORNSERIES STÜDYO</Text>
      <Text style={styles.h1}>Hikâyelerin kontrol odası.</Text>
      <Text style={styles.body}>İçerik yayınla, üyeleri yönet, verileri izle. Her bölüm kendi adımlarıyla düzenlenir.</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {sections.map(([key, label, icon]) => <Pressable key={key} accessibilityRole="button"
        onPress={() => { setSection(key); setTable(key === "reports" ? "dbs_reports" : "dbs_series"); setEditor(null); }}
        style={[styles.row, { paddingHorizontal: 15, paddingVertical: 13, borderRadius: 15,
          borderWidth: 1, borderColor: section === key ? colors.pink : colors.line,
          backgroundColor: section === key ? "#552340" : colors.panel }]}>
        <Icon name={icon} size={19} color={section === key ? colors.pink : colors.muted} />
        <Text style={{ color: section === key ? "#fff" : colors.muted, fontWeight: "800" }}>{label}</Text>
      </Pressable>)}
    </ScrollView>
    {section === "users" ? <StudioUsers role={role} run={run} /> :
      section === "metrics" ? <StudioMetrics run={run} /> :
      <View style={{ gap: 19 }}>
        {section !== "logs" && <View style={styles.wrap}>
          {choices.map((item) => <Chip key={item.table} label={item.label}
            active={table === item.table} onPress={() => { setTable(item.table); setEditor(null); }} />)}
        </View>}
        <View style={[styles.card, { borderColor: "#6c385f", backgroundColor: "#211527" }]}>
          <Text style={styles.eyebrow}>{section === "content" ? "İÇERİK YÖNETİMİ" : section === "reports" ? "MODERASYON" : "DENETİM İZİ"}</Text>
          <Text style={styles.h2}>{section === "logs" ? "Yönetici işlem kayıtları" : config.label}</Text>
          <Text style={styles.body}>{section === "content"
            ? config.table === "dbs_episodes" ? "Bölüm oluştur, erişim türünü ve BornCoins fiyatını seç, yayın tarihini ayarla."
              : config.table === "dbs_video_assets" ? "Bölümü Cloudflare Stream videosuyla bağla. Önce videonun işlenmesini bekle."
              : config.table === "dbs_series" ? "Dizi bilgilerini, görsellerini, fragmanını, VIP ve vitrin sırasını yönet."
              : "Kayıtları düzenle; sıralama ve görünürlük değişikliklerini kaydet."
            : section === "logs" ? "Hangi yöneticinin hangi kaydı değiştirdiğini gör." : "Raporları incele ve durumlarını güncelle."}</Text>
        </View>
        <View style={styles.wrap}>
          <View style={{ flex: 1, minWidth: 170 }}>
            <Field value={query} onChangeText={setQuery} placeholder="Listede ara…" />
          </View>
          <Button secondary small icon="refresh" onPress={() => run(load)}>Yenile</Button>
          {section === "content" && config.template && role !== "support" &&
            <Button small icon="add" onPress={() => open(config.template || {})}>Yeni {config.singular}</Button>}
        </View>
        {!editor && (loading ? <Loading /> : <View style={{ gap: 10 }}>
          <Text style={styles.body}>{visible.length} kayıt gösteriliyor · En fazla 100 kayıt yüklenir</Text>
          {visible.map((row, index) => <Pressable key={row.id || row.user_id || index}
            accessibilityRole="button" accessibilityLabel={title(row, config) + " kaydını aç"}
            onPress={() => section === "logs" ? undefined : open(row)}
            style={[styles.card, { padding: 18, gap: 8 }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={[styles.h3, { flex: 1 }]} numberOfLines={2}>{section === "logs" ? logTitle(row) : title(row, config)}</Text>
              {section !== "logs" && <Icon name="chevron-forward" color={colors.pink} />}
            </View>
            <Text style={styles.body} numberOfLines={3}>{section === "logs"
              ? logDetail(row) : description(row, config, series)}</Text>
          </Pressable>)}
          {!visible.length && <Empty title="Kayıt yok" detail="Aramayı değiştir veya yeni kayıt oluştur." icon="albums-outline" />}
        </View>)}
        {editor && section !== "logs" && <View style={{ gap: 12 }}>
          <StudioForm key={table + "-" + editKey} config={config} initial={editor}
            series={series} seasons={seasons} episodes={episodes} streamVideos={streamVideos}
            save={save} close={() => setEditor(null)} readOnly={role === "support"}
            remove={table === "dbs_series" && editor.id && role === "owner" ? remove : undefined} />
          <Modal transparent visible={confirmDelete} animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
            <View style={{ flex: 1, backgroundColor: "#07030ed9", padding: 24, justifyContent: "center" }}>
              <View style={[styles.card, { width: "100%", maxWidth: 480, alignSelf: "center", padding: 25, borderColor: "#ff5b8770" }]}>
                <Icon name="trash-outline" color={colors.pink} size={32} />
                <Text style={styles.h2}>Diziyi silmek istiyor musun?</Text>
                <Text style={styles.body}>“{editor.title}” ve bu diziye ait sezonlar, bölümler ve video bağlantıları kalıcı olarak silinir. BornCoins hareketleri ve satın alma kayıtları korunur. Cloudflare dosyaları hesabından ayrıca yönetilir.</Text>
                <Field label="Onaylamak için dizi adını yaz" value={deleteName} onChangeText={setDeleteName} placeholder={editor.title} />
                <Button icon="trash-outline" disabled={deleteName !== editor.title} onPress={remove}>Diziyi ve bölümleri sil</Button>
                <Button secondary onPress={() => setConfirmDelete(false)}>Vazgeç</Button>
              </View>
            </View>
          </Modal>
        </View>}
      </View>}
  </View>;
}
