import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { api } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  colors,
  styles,
} from "../../packages/ui/theme";
const tables = [
  ["dbs_series", "Diziler"],
  ["dbs_seasons", "Sezonlar"],
  ["dbs_episodes", "Bölümler"],
  ["dbs_video_assets", "Videolar"],
  ["dbs_profiles", "Kullanıcılar"],
  ["dbs_borncoins_wallet", "Cüzdanlar"],
  ["dbs_borncoins_transactions", "Hareketler"],
  ["dbs_purchases", "Satın almalar"],
  ["dbs_vip_subscriptions", "VIP"],
  ["dbs_comments", "Yorumlar"],
  ["dbs_reports", "Raporlar"],
  ["dbs_content_reports", "İçerik raporları"],
  ["dbs_watch_progress", "İzleme"],
  ["dbs_home_sections", "Ana sayfa"],
  ["dbs_featured_content", "Featured"],
  ["dbs_subtitles", "Altyazılar"],
  ["dbs_audio_tracks", "Sesler"],
  ["dbs_promo_codes", "Promosyonlar"],
  ["dbs_admin_logs", "İşlem kayıtları"],
];
const templates: Record<string, object> = {
  dbs_series: {
    slug: "yeni-dizi",
    title: "Yeni dizi",
    short_description: "",
    description: "",
    genres: ["Dram"],
    status: "draft",
    poster_url: "",
    banner_url: "",
  },
  dbs_episodes: {
    series_id: "",
    season_id: null,
    number: 1,
    title: "Bölüm 1",
    duration_seconds: 120,
    access_type: "free",
    coin_price: 0,
    status: "draft",
    publish_at: new Date().toISOString(),
  },
  dbs_seasons: { series_id: "", number: 1, title: "Sezon 1" },
  dbs_video_assets: {
    episode_id: "",
    provider: "cloudflare",
    stream_uid: "",
    ready: false,
  },
  dbs_subtitles: {
    episode_id: "",
    language: "tr",
    label: "Türkçe",
    asset_key: "",
  },
  dbs_audio_tracks: {
    episode_id: "",
    language: "tr",
    label: "Türkçe",
    asset_key: "",
  },
  dbs_promo_codes: {
    code: "",
    coins: 10,
    max_uses: 100,
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    active: true,
  },
};
export default function AdminPanel({
  store,
  run,
}: {
  store: Store;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [table, setTable] = useState("dbs_series"),
    [rows, setRows] = useState<any[]>([]),
    [editor, setEditor] = useState(""),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [grantUser, setGrantUser] = useState(""),
    [grantCoins, setGrantCoins] = useState(""),
    [reason, setReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("admin-list", { table });
      setRows(data.rows);
    } finally {
      setLoading(false);
    }
  }, [table]);
  useEffect(() => {
    if (store.isAdmin) run(load);
    setEditor("");
    setQuery("");
  }, [store.isAdmin, load, run]);
  if (!store.isAdmin)
    return (
      <Empty
        title="Yönetici erişimi gerekiyor"
        detail="Bu alan yalnızca yetkili DraBornSeries yöneticilerine açıktır."
        icon="shield-checkmark-outline"
      />
    );
  return (
    <View style={{ gap: 24 }}>
      <Text style={styles.eyebrow}>DRABORNSERIES STUDIO</Text>
      <Text style={styles.h1}>Hikâyelerin kontrol odası.</Text>
      <Text style={styles.body}>
        Veriler: drabornseries şeması · dbs_ tabloları. Katalog, bölüm
        kilitleri, moderasyon ve işlemler.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {tables.map(([name, label]) => (
          <Chip
            key={name}
            label={label}
            active={name === table}
            onPress={() => setTable(name)}
          />
        ))}
      </ScrollView>
      <View style={styles.wrap}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Yüklenen kayıtlarda ara…"
        />
        <Button secondary onPress={() => run(load)} icon="refresh">
          Yenile
        </Button>
        {templates[table] && (
          <Button
            icon="add"
            onPress={() => setEditor(JSON.stringify(templates[table], null, 2))}
          >
            Yeni kayıt
          </Button>
        )}
      </View>
      {loading ? (
        <Loading />
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={styles.body}>
            {rows.length} kayıt · En fazla 100 kayıt gösterilir
          </Text>
          {rows
            .filter((row) =>
              JSON.stringify(row)
                .toLocaleLowerCase("tr-TR")
                .includes(query.toLocaleLowerCase("tr-TR")),
            )
            .map((row, index) => (
              <Pressable
                key={row.id || row.user_id || index}
                onPress={() => setEditor(JSON.stringify(row, null, 2))}
                style={[styles.card, { padding: 16 }]}
              >
                <Text style={styles.h3}>
                  {row.title ||
                    row.username ||
                    row.name ||
                    row.code ||
                    row.action ||
                    row.description ||
                    row.user_id ||
                    row.id}
                </Text>
                <Text numberOfLines={2} style={styles.body}>
                  {row.status || row.kind || row.access_type || ""}{" "}
                  {row.coin_price ? `· ${row.coin_price} BornCoins` : ""}{" "}
                  {row.balance !== undefined
                    ? `· ${row.balance} BornCoins`
                    : ""}{" "}
                  {row.body || ""}
                </Text>
                <Text selectable style={{ color: colors.purple, fontSize: 11 }}>
                  {row.id || row.user_id}
                </Text>
              </Pressable>
            ))}
        </View>
      )}
      {!!editor && (
        <View style={styles.card}>
          <Text style={styles.h3}>Kaydı düzenle · {table}</Text>
          <Text style={styles.body}>
            Yayın durumları: draft, scheduled, published, hidden, archived.
            Silmek yerine archived kullan. Video kaydında Cloudflare Stream UID
            gerekir.
          </Text>
          <Field
            multiline
            value={editor}
            onChangeText={setEditor}
            style={{ minHeight: 300, fontFamily: "monospace", fontSize: 12 }}
          />
          <View style={styles.wrap}>
            <Button
              onPress={() =>
                run(async () => {
                  const row = JSON.parse(editor);
                  await api("admin-save", { table, row });
                  setEditor("");
                  await load();
                  await store.refreshCatalog();
                }, "Kayıt kaydedildi.")
              }
              icon="save-outline"
            >
              Kaydet
            </Button>
            <Button secondary onPress={() => setEditor("")}>
              Kapat
            </Button>
          </View>
        </View>
      )}
      {table === "dbs_borncoins_wallet" && (
        <View style={styles.card}>
          <Text style={styles.h3}>BornCoins tanımla</Text>
          <Field
            label="Kullanıcı UUID"
            value={grantUser}
            onChangeText={setGrantUser}
          />
          <Field
            label="BornCoins"
            value={grantCoins}
            onChangeText={setGrantCoins}
            keyboardType="number-pad"
          />
          <Field
            label="İşlem gerekçesi"
            value={reason}
            onChangeText={setReason}
          />
          <Button
            onPress={() =>
              run(async () => {
                const request_id = globalThis.crypto?.randomUUID?.();
                if (!request_id)
                  throw Error("Yönetici işlemini web tarayıcısından yap.");
                await api("admin-grant", {
                  user_id: grantUser,
                  coins: Number(grantCoins),
                  reason,
                  request_id,
                });
                await load();
              }, "BornCoins hareketi ve yönetici kaydı oluşturuldu.")
            }
          >
            Tanımla
          </Button>
        </View>
      )}
    </View>
  );
}
