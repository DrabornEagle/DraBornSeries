import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Store } from "../../packages/api/store";
import type { Series } from "../../packages/types";
import { translations } from "../../packages/shared/i18n";
import { filterSeries } from "../../packages/shared/domain";
import { Poster } from "../../packages/ui/Catalog";
import { AccentButton } from "../../packages/ui/ActionRow";
import { Button, Chip, Empty, Field, Icon, styles } from "../../packages/ui/theme";

type Tab = "favorites" | "history";

export default function Library({ store, tab, onTabChange, onSelect, onLogin, onBrowse }: {
  store: Store;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onSelect: (series: Series) => void;
  onLogin: () => void;
  onBrowse: () => void;
}) {
  const t = translations(store.language);
  const [queries, setQueries] = useState<Record<Tab, string>>({ favorites: "", history: "" });
  const [visibleCount, setVisibleCount] = useState(5);
  const query = queries[tab];
  const changeTab = (value: Tab) => { onTabChange(value); setVisibleCount(5); };
  const changeQuery = (value: string) => {
    setQueries(current => ({ ...current, [tab]: value }));
    setVisibleCount(5);
  };

  if (!store.session) return <Empty title="Kendi koleksiyonunu oluştur" detail={t.synced}>
    <Button onPress={onLogin}>{t.login}</Button>
  </Empty>;

  const episodeSeries = new Map(store.episodes.map(episode => [episode.id, episode.series_id]));
  const seriesById = new Map(store.series.map(series => [series.id, series]));
  const historyIds = [...new Set(store.progress.map(progress => episodeSeries.get(progress.episode_id)))];
  const list = tab === "favorites"
    ? store.series.filter(series => store.favorites.includes(series.id))
    : historyIds.map(id => id ? seriesById.get(id) : undefined).filter((series): series is Series => !!series);
  const matches = filterSeries(list, query, "", "all");
  const visible = matches.slice(0, visibleCount);
  const searchLabel = tab === "favorites" ? "Favorilerimde ara" : "İzleme geçmişimde ara";

  return <View style={{ gap: 22 }}>
    <Text style={styles.h1}>{t.library}</Text>
    <View style={styles.wrap}>
      <Chip label="Favorilerim" active={tab === "favorites"} onPress={() => changeTab("favorites")} />
      <Chip label={t.history} active={tab === "history"} onPress={() => changeTab("history")} />
    </View>
    <LinearGradient colors={["#30192c", "#1a1530"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: "#ed48a24d", borderRadius: 17, gap: 4 }}>
      <Icon name="search-outline" color="#ff75ba" size={22} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Field testID="library-search" accessibilityLabel={searchLabel} placeholder={searchLabel}
          value={query} onChangeText={changeQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
          style={{ borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 10, fontSize: 14 }} />
      </View>
      {!!query && <Pressable testID="library-search-clear" accessibilityRole="button" accessibilityLabel="Listem aramasını temizle"
        onPress={() => changeQuery("")} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Icon name="close-circle" color="#e7b7e1" size={22} />
      </Pressable>}
    </LinearGradient>
    <Text testID="library-result-count" accessibilityLiveRegion="polite" style={[styles.body, { fontSize: 12 }]}>
      {visible.length} / {matches.length} dizi
    </Text>
    <View testID="library-grid" style={[styles.wrap, { gap: 14 }]}>
      {visible.map(series => <View testID="library-item" key={series.id}>
        <Poster series={series} onPress={() => onSelect(series)} />
      </View>)}
    </View>
    {matches.length > visibleCount && <AccentButton small testID="library-more" icon="chevron-down"
      gradient={["#de3f92", "#a742ca", "#6254d4"]} onPress={() => setVisibleCount(count => count + 5)}>
      Daha Fazla
    </AccentButton>}
    {!matches.length && (query.trim()
      ? <Empty title="Aramana uygun dizi bulunamadı" detail="Dizi adı, tür veya oyuncu adıyla tekrar ara." icon="search-outline">
        <Button secondary onPress={() => changeQuery("")}>Aramayı temizle</Button>
      </Empty>
      : <Empty title="İlk hikâyeni seç" detail="Sevdiğin dizileri listene ekle, kaldığın yerden devam et." icon="bookmark-outline">
        <Button onPress={onBrowse}>{t.browse}</Button>
      </Empty>)}
  </View>;
}
