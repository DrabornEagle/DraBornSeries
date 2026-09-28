import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Series } from "../types";
import { Button, Chip, Icon, colors, styles } from "./theme";
import { translations } from "../shared/i18n";
import type { Store } from "../api/store";
export function Artwork({
  series,
  hero = false,
}: {
  series: Series;
  hero?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const source =
    series.slug === "gece-hatti"
      ? require("../../assets/posters/gece-hatti.png")
      : {
          uri:
            (hero ? series.banner_url : series.poster_url) ||
            series.poster_url ||
            "",
        };
  return (
    <View style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <LinearGradient
        colors={[series.accent || "#513868", "#09080f"]}
        style={{ position: "absolute", inset: 0 }}
      />
      {!failed && (
        <Image
          source={source}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {failed && (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="film-outline" color="#ffffff60" size={hero ? 80 : 55} />
        </View>
      )}
    </View>
  );
}
export function Poster({
  series,
  onPress,
  rank,
  wide = false,
}: {
  series: Series;
  onPress: () => void;
  rank?: number;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={series.title}
      onPress={onPress}
      style={({ pressed }) => ({
        width: wide ? 260 : 162,
        gap: 10,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          height: wide ? 155 : 230,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: colors.panel,
        }}
      >
        <Artwork series={series} />
        <LinearGradient
          colors={["transparent", "#080711ee"]}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            backgroundColor: series.is_demo ? "#070d0de0" : "#100c16d0",
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 6,
          }}
        >
          <Text
            style={{
              color: series.is_demo ? colors.mint : colors.purple,
              fontWeight: "800",
              fontSize: 9,
              letterSpacing: 1,
            }}
          >
            {series.is_demo
              ? "TEST FİLMİ"
              : series.is_vip
                ? "VIP · YAKINDA"
                : "YAKINDA"}
          </Text>
        </View>
        <View style={{ position: "absolute", bottom: 15, left: 14, right: 10 }}>
          {rank && (
            <Text
              style={{
                color: "#ffffff88",
                fontSize: 40,
                fontWeight: "900",
                fontStyle: "italic",
              }}
            >
              {String(rank).padStart(2, "0")}
            </Text>
          )}
          <Text
            numberOfLines={2}
            style={{
              color: "#fff",
              fontSize: wide ? 20 : 22,
              fontWeight: "900",
              letterSpacing: -0.6,
            }}
          >
            {series.title}
          </Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.label, { fontSize: 13 }]}>
        {series.title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>
        {series.genres.slice(0, 2).join(" · ")}
      </Text>
    </Pressable>
  );
}
export function Rail({
  title,
  subtitle,
  series,
  onSelect,
  onMore,
  rank = false,
}: {
  title: string;
  subtitle?: string;
  series: Series[];
  onSelect: (s: Series) => void;
  onMore?: () => void;
  rank?: boolean;
}) {
  if (!series.length) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={{ gap: 5 }}>
          <Text style={styles.h2}>{title}</Text>
          {subtitle && <Text style={styles.body}>{subtitle}</Text>}
        </View>
        {onMore && (
          <Pressable accessibilityRole="button" onPress={onMore}>
            <Icon name="arrow-forward" color={colors.purple} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 18, paddingVertical: 4 }}
      >
        {series.map((s, i) => (
          <Poster
            key={s.id}
            series={s}
            onPress={() => onSelect(s)}
            rank={rank ? i + 1 : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}
export function Home({
  store,
  onSelect,
  onBrowse,
  onPlayDemo,
}: {
  store: Store;
  onSelect: (s: Series) => void;
  onBrowse: () => void;
  onPlayDemo: () => void;
}) {
  const { width } = useWindowDimensions(),
    compact = width < 700,
    t = translations(store.language);
  const featured = store.series.filter((s) => s.featured_order !== null),
    [index, setIndex] = useState(0),
    hero = featured[index % Math.max(1, featured.length)] || store.series[0];
  if (!hero) return null;
  const continueShows = store.progress
    .filter((p) => !p.completed && p.position_seconds > 0)
    .map((p) =>
      store.series.find(
        (s) =>
          s.id === store.episodes.find((e) => e.id === p.episode_id)?.series_id,
      ),
    )
    .filter((s): s is Series => !!s);
  return (
    <View>
      <View
        style={{
          borderRadius: 24,
          overflow: "hidden",
          minHeight: compact ? 500 : 520,
          marginBottom: 36,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Artwork series={hero} hero />
        <LinearGradient
          colors={
            compact
              ? ["#09080f00", "#09080f70", "#09080ff8"]
              : ["#09080fee", "#09080f95", "#09080f00"]
          }
          start={{ x: 0, y: compact ? 0 : 0.5 }}
          end={{ x: compact ? 0 : 0.9, y: compact ? 1 : 0.5 }}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            padding: compact ? 24 : 42,
            paddingTop: compact ? 180 : 95,
            gap: 18,
            maxWidth: compact ? "100%" : 540,
          }}
        >
          <View style={styles.row}>
            <Text style={styles.eyebrow}>D R A B O R N O R I G I N A L S</Text>
            <View
              style={{ height: 1, width: 25, backgroundColor: colors.pink }}
            />
          </View>
          <Text
            style={{
              color: "#fff",
              fontSize: compact ? 49 : 70,
              lineHeight: compact ? 52 : 72,
              fontWeight: "900",
              letterSpacing: -2.5,
            }}
          >
            {hero.title}
          </Text>
          <View style={styles.wrap}>
            <Text style={{ color: "#eee1f4", fontSize: 12, fontWeight: "700" }}>
              {hero.genres.join("  ·  ")} | {hero.age_rating}
            </Text>
            <Text
              style={{ color: colors.orange, fontSize: 12, fontWeight: "700" }}
            >
              {t.coming}
            </Text>
          </View>
          <Text
            style={{
              color: "#d9cddf",
              fontSize: 15,
              lineHeight: 25,
              maxWidth: 360,
            }}
          >
            {hero.short_description}
          </Text>
          <View style={[styles.wrap, { marginTop: 5 }]}>
            <Button onPress={() => onSelect(hero)} icon="play">
              {t.discover}
            </Button>
            <Button secondary onPress={onPlayDemo} icon="play-circle-outline">
              {store.language === "tr"
                ? "Ücretsiz test filmi"
                : "Free test film"}
            </Button>
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            {featured.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => setIndex(i)}
                accessibilityLabel={s.title}
                style={{
                  height: 4,
                  width: index === i ? 30 : 10,
                  borderRadius: 3,
                  backgroundColor: index === i ? colors.pink : "#ffffff55",
                }}
              />
            ))}
          </View>
        </View>
        <View
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            backgroundColor: "#0c0917aa",
            borderColor: "#ffffff30",
            borderWidth: 1,
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: "#eee",
              fontSize: 9,
              fontWeight: "700",
              letterSpacing: 2,
            }}
          >
            {t.test} / 0.1
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.row,
          { marginBottom: 30, justifyContent: "space-between" },
        ]}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.h2}>{t.originals}</Text>
          <Text style={styles.body}>
            {store.language === "tr"
              ? "Büyük duygular. Kısa bölümler. Senin zamanın."
              : "Big emotions. Short episodes. Your time."}
          </Text>
        </View>
        <Icon name="sparkles" color={colors.pink} size={28} />
      </View>
      {continueShows.length > 0 && (
        <Rail
          title={t.continue}
          series={[...new Map(continueShows.map((s) => [s.id, s])).values()]}
          onSelect={onSelect}
        />
      )}
      <Rail
        title={t.trending}
        subtitle={
          store.language === "tr"
            ? "DraBornSeries için geliştirilen özgün dizi konseptleri"
            : "Original concepts in development for DraBornSeries"
        }
        series={store.series.filter((s) => !s.is_demo)}
        onSelect={onSelect}
        onMore={onBrowse}
        rank
      />
      <LinearGradient
        colors={["#28112e", "#1c153b", "#151324"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: compact ? 24 : 32,
          borderRadius: 20,
          marginBottom: 34,
          borderWidth: 1,
          borderColor: "#633254",
          gap: 12,
        }}
      >
        <Text style={styles.eyebrow}>ONE ACCOUNT. EVERY SCREEN.</Text>
        <Text style={styles.h2}>{t.continueTitle}</Text>
        <Text style={styles.body}>{t.synced}</Text>
        <View style={styles.row}>
          <Icon name="phone-portrait-outline" color={colors.pink} />
          <Icon name="swap-horizontal" color={colors.muted} />
          <Icon name="desktop-outline" color={colors.purple} />
        </View>
      </LinearGradient>
      <Rail
        title={t.free}
        subtitle={
          store.language === "tr"
            ? "Açık lisanslı filmlerle oynatıcı ve erişim testi"
            : "Player and access testing with openly licensed films"
        }
        series={store.series.filter((s) => s.is_demo)}
        onSelect={onSelect}
      />
      <Rail
        title={t.recommended}
        series={[...store.series]
          .sort((a, b) => {
            const favoriteGenres = store.series
              .filter((s) => store.favorites.includes(s.id))
              .flatMap((s) => s.genres);
            return (
              b.genres.filter((g) => favoriteGenres.includes(g)).length -
              a.genres.filter((g) => favoriteGenres.includes(g)).length
            );
          })
          .slice(0, 6)}
        onSelect={onSelect}
      />
      <View style={[styles.row, { flexWrap: "wrap", paddingBottom: 12 }]}>
        {[
          "Romantik",
          "Gerilim",
          "Dram",
          "Bilimkurgu",
          "Komedi",
          "Animasyon",
        ].map((g) => (
          <Chip key={g} label={g} onPress={onBrowse} />
        ))}
      </View>
    </View>
  );
}
