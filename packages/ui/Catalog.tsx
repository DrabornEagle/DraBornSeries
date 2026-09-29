import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Series, Episode } from "../types";
import type { Store } from "../api/store";
import { usePreview } from "../api/preview";
import InlineVideo from "./InlineVideo";
import { Button, Icon, colors, styles } from "./theme";
import SwipeSurface from "./SwipeSurface";
import { compactCount } from "../shared/domain";
export function Artwork({
  series,
  hero = false,
}: {
  series: Series;
  hero?: boolean;
}) {
  const uri =
    (hero ? series.banner_url : series.poster_url) || series.poster_url;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = !!uri && failedUri === uri;
  return (
    <View style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <LinearGradient
        colors={[series.accent || "#553561", "#100a19"]}
        style={{ position: "absolute", inset: 0 }}
      />
      {!failed && uri && (
        <Image
          source={{ uri }}
          onError={() => setFailedUri(uri)}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {(failed || !uri) && (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="film-outline" size={60} color="#ffffff40" />
        </View>
      )}
    </View>
  );
}
function MotionArtwork({
  series,
  episode,
  active,
}: {
  series: Series;
  episode?: Episode;
  active: boolean;
}) {
  const url = usePreview(episode?.id, active);
  return (
    <>
      <Artwork series={series} />
      {url && active && (
        <InlineVideo url={url} active preview poster={series.poster_url} />
      )}
    </>
  );
}
export function Poster({
  series,
  onPress,
  rank,
  wide = false,
  episode,
  preview = false,
}: {
  series: Series;
  onPress: () => void;
  rank?: number;
  wide?: boolean;
  episode?: Episode;
  preview?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={series.title}
      onPress={onPress}
      style={({ pressed }) => ({
        width: wide ? 205 : 146,
        gap: 9,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <View
        style={{
          height: wide ? 310 : 228,
          borderRadius: 13,
          overflow: "hidden",
          backgroundColor: colors.panel,
        }}
      >
        <MotionArtwork series={series} episode={episode} active={preview} />
        <LinearGradient
          colors={["#08050e15", "transparent", "#09030ceb"]}
          locations={[0, 0.43, 1]}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              backgroundColor: series.is_vip
                ? "#ba3a7fe6"
                : series.status === "coming_soon"
                  ? "#2c193ddd"
                  : "#181320dc",
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: series.is_vip ? "#fff" : "#ffdab5",
                fontSize: 8,
                fontWeight: "900",
                letterSpacing: 0.8,
              }}
            >
              {series.status === "coming_soon"
                ? "YAKINDA"
                : `${compactCount(series.view_count)} izlenme`}
            </Text>
          </View>
          <View style={{ backgroundColor: "#181320dc", borderRadius: 5, padding: 4, flexDirection: "row", gap: 3, alignItems: "center" }}>
            <Icon name="heart" size={10} color={colors.pink} />
            <Text style={{ color: "#fff", fontSize: 8 }}>{compactCount(series.like_count)}</Text>
          </View>
        </View>
        <View style={{ position: "absolute", bottom: 13, left: 12, right: 10 }}>
          {rank && (
            <Text
              style={{
                color: "#ffffff8c",
                fontSize: 37,
                fontWeight: "900",
                fontStyle: "italic",
                marginBottom: 1,
              }}
            >
              {String(rank).padStart(2, "0")}
            </Text>
          )}
          <Text
            numberOfLines={3}
            style={{
              color: "#fff",
              fontSize: 23,
              fontWeight: "900",
              letterSpacing: -0.8,
              lineHeight: 25,
            }}
          >
            {series.title}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={{ color: "#ecdaee", fontSize: 11, fontWeight: "600" }}
      >
        {series.genres[0]} ·{" "}
        {series.total_episodes > 0
          ? `${series.total_episodes} bölüm`
          : "Yakında"}
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
  episodes = [],
  previewId,
}: {
  title: string;
  subtitle?: string;
  series: Series[];
  onSelect: (s: Series) => void;
  onMore?: () => void;
  rank?: boolean;
  episodes?: Episode[];
  previewId?: string;
}) {
  if (!series.length) return null;
  return (
    <View style={{ gap: 14, marginBottom: 30 }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 21,
              fontWeight: "900",
              letterSpacing: -0.5,
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {subtitle}
            </Text>
          )}
        </View>
        {onMore && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title + " tümünü gör"}
            onPress={onMore}
          >
            <Icon name="chevron-forward" color="#a58cbb" size={20} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingVertical: 3 }}
      >
        {series.map((s, i) => (
          <Poster
            key={s.id}
            series={s}
            onPress={() => onSelect(s)}
            rank={rank ? i + 1 : undefined}
            episode={episodes.find(
              (e) => e.series_id === s.id && e.access_type === "free",
            )}
            preview={previewId === s.id}
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
  onStore,
  onRewards,
  onVIP,
  previewRegion = "hero",
}: {
  store: Store;
  onSelect: (s: Series) => void;
  onBrowse: () => void;
  onStore: () => void;
  onRewards: () => void;
  onVIP: () => void;
  previewRegion?: string;
}) {
  const { width } = useWindowDimensions(),
    compact = width < 700,
    [tick, setTick] = useState(0),
    [category, setCategory] = useState("Sana özel");
  const published = store.series.filter((s) => s.status === "published"),
    featured = published.length ? published : store.series;
  const wrap = (value: number) => ((value % Math.max(1, featured.length)) + featured.length) % Math.max(1, featured.length);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 9000);
    return () => clearInterval(timer);
  }, []);
  const hero = featured[wrap(tick + seed)],
    side = featured[wrap(tick + seed + 1)],
    left = featured[wrap(tick + seed + 2)];
  if (!hero) return null;
  const first = store.episodes.find(
    (e) => e.series_id === hero.id && e.access_type === "free",
  );
  const continuing = Array.from(
    new Set(
      store.progress
        .filter((p) => p.position_seconds > 0 && !p.completed)
        .map(
          (p) => store.episodes.find((e) => e.id === p.episode_id)?.series_id,
        ),
    ),
  )
    .map((id) => store.series.find((s) => s.id === id))
    .filter((s): s is Series => !!s);
  const filtered =
    category === "Sana özel"
      ? featured
      : category === "Yeni"
        ? featured.slice().reverse()
        : featured.filter((s) => s.genres.includes(category));
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 24,
          paddingBottom: 16,
          alignItems: "center",
        }}
      >
        {["Sana özel", "Yeni", "Animasyon", "Macera", "Romantik", "Dram", "Gizem", "Komedi"].map(
          (v) => (
            <Pressable key={v} onPress={() => setCategory(v)}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: category === v ? "900" : "500",
                  color: category === v ? "#fff" : "#97879f",
                }}
              >
                {v}
              </Text>
              <View
                style={{
                  height: 3,
                  width: 24,
                  alignSelf: "center",
                  marginTop: 9,
                  borderRadius: 4,
                  backgroundColor: category === v ? colors.pink : "transparent",
                }}
              />
            </Pressable>
          ),
        )}
      </ScrollView>
      <SwipeSurface axis="horizontal" extent={width} onStep={(step) => setTick((current) => current + step)}
        label="Öne çıkan diziler. Diğer diziler için sağa veya sola kaydır.">
      <LinearGradient
        colors={["#32192e", "#180e26", "#0b0811"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 23,
          overflow: "hidden",
          marginBottom: 20,
          minHeight: compact ? 422 : 444,
        }}
      >
        <View
          style={{
            position: "absolute",
            width: 330,
            height: 330,
            backgroundColor: "#b04cf015",
            borderRadius: 165,
            right: -160,
            top: -100,
          }}
        />
        <View
          style={{
            flexDirection: compact ? "column" : "row",
            alignItems: "center",
            paddingTop: compact ? 18 : 27,
            paddingHorizontal: compact ? 0 : 30,
            gap: compact ? 14 : 40,
          }}
        >
          <View
            style={{
              height: compact ? 292 : 388,
              width: compact ? "100%" : 370,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {[left, side].map((s, i) => (
              <Pressable
                key={s.id + "-" + i}
                onPress={() => onSelect(s)}
                style={{
                  position: "absolute",
                  width: compact ? 145 : 185,
                  height: compact ? 245 : 318,
                  left: i === 0 ? (compact ? -22 : -5) : undefined,
                  right: i === 1 ? (compact ? -22 : -5) : undefined,
                  transform: [{ rotate: i === 0 ? "-9deg" : "9deg" }],
                  borderRadius: 16,
                  overflow: "hidden",
                  opacity: 0.52,
                }}
              >
                <Artwork series={s} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hero.title + " öne çıkan"}
              onPress={() => onSelect(hero)}
              style={{
                height: "100%",
                aspectRatio: 9 / 16,
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#f5badb60",
                boxShadow: "0px 15px 35px #00000055",
              }}
            >
              <MotionArtwork
                series={hero}
                episode={first}
                active={
                  previewRegion === "hero" &&
                  store.profile?.preferences?.previews !== false
                }
              />
              <LinearGradient
                colors={["transparent", "#0a0710dd"]}
                style={{ position: "absolute", inset: 0 }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 11,
                  left: 10,
                  backgroundColor: "#f44492",
                  borderRadius: 5,
                  padding: 5,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: "900",
                    letterSpacing: 1,
                  }}
                >
                  {compactCount(hero.view_count)} izlenme · ♥ {compactCount(hero.like_count)}
                </Text>
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: 17,
                  left: 13,
                  right: 10,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: compact ? 24 : 31,
                    fontWeight: "900",
                    letterSpacing: -0.8,
                    lineHeight: compact ? 27 : 33,
                  }}
                >
                  {hero.title}
                </Text>
                <Text style={{ color: "#f1d8e3", fontSize: 10, marginTop: 7 }}>
                  {hero.genres.join(" · ")}
                </Text>
              </View>
            </Pressable>
          </View>
          <View
            style={{
              flex: compact ? undefined : 1,
              width: compact ? "100%" : undefined,
              paddingHorizontal: compact ? 19 : 0,
              gap: compact ? 9 : 20,
              paddingBottom: 24,
            }}
          >
            {!compact && (
              <>
                <Text
                  style={{
                    color: colors.orange,
                    fontSize: 11,
                    fontWeight: "900",
                    letterSpacing: 4,
                  }}
                >
                  KÜÇÜK BÖLÜMLER · BÜYÜK HİKÂYELER
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 54,
                    fontWeight: "900",
                    letterSpacing: -2,
                    lineHeight: 59,
                  }}
                >
                  {hero.title}
                </Text>
                <Text style={[styles.body, { fontSize: 16, maxWidth: 430 }]}>
                  {hero.short_description}
                </Text>
              </>
            )}
            <View
              style={[
                styles.row,
                { justifyContent: compact ? "center" : "flex-start", gap: 7 },
              ]}
            >
              {featured.map((s) => (
                <View
                  key={s.id}
                  style={{
                    height: 3,
                    width: hero.id === s.id ? 20 : 5,
                    borderRadius: 3,
                    backgroundColor: hero.id === s.id ? colors.pink : "#73526c",
                  }}
                />
              ))}
            </View>
            <Button
              icon="play"
              onPress={() => onSelect(hero)}
              style={compact ? { alignSelf: "stretch" } : undefined}
            >
              Hemen izle
            </Button>
            {!compact && (
              <Text style={{ color: "#a286a4", fontSize: 11 }}>
                9:16 dikey format · Android ve webde aynı hesap
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
      </SwipeSurface>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 27 }}>
        {[
          ["bag-handle", "Mağaza", colors.pink, onStore],
          ["diamond", "VIP", colors.orange, onVIP],
          ["gift", "Ödüller", "#be8aff", onRewards],
        ].map(([icon, label, color, action]) => (
          <Pressable
            key={String(label)}
            onPress={action as () => void}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={[String(color) + "23", "#1a1124"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: 17,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: String(color) + "36",
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 9,
              }}
            >
              <Icon name={icon as any} color={String(color)} size={22} />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                {String(label)}
              </Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
      {continuing.length > 0 && (
        <Rail title="Kaldığın yerden" series={continuing} onSelect={onSelect} />
      )}
      <Rail
        title={category === "Sana özel" ? "Bir sonraki favorin" : category}
        subtitle="Dikey kısa sahneler · Telefonun için"
        series={filtered}
        episodes={store.episodes}
        previewId={
          previewRegion === "rail" &&
          store.profile?.preferences?.previews !== false
            ? featured[(tick + seed) % featured.length]?.id
            : undefined
        }
        onSelect={onSelect}
        onMore={onBrowse}
      />
      <Pressable onPress={onRewards}>
        <LinearGradient
          colors={["#632440", "#3a204e", "#241335"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 19,
            padding: 19,
            marginBottom: 29,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Image
            source={require("../../assets/icons/reward.png")}
            style={{ width: 72, height: 72 }}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 18, color: "#fff", fontWeight: "900" }}>
              Her gün bir sürpriz
            </Text>
            <Text style={{ color: "#e7bddc", fontSize: 11 }}>
              Günlük BornCoins ödülünü kaçırma.
            </Text>
          </View>
          <Icon name="chevron-forward" />
        </LinearGradient>
      </Pressable>
      <Rail
        title="Gecenin seçkisi"
        series={featured.slice().reverse()}
        onSelect={onSelect}
        rank
      />
      <Rail
        title="Yakında yeni hikâyeler"
        subtitle="DraBornSeries özgün dizi konseptleri"
        series={store.series.filter((s) => s.status === "coming_soon")}
        onSelect={onSelect}
      />
      <Text style={{ color: "#76687c", fontSize: 10, lineHeight: 17 }}>
        İlk bakış koleksiyonundaki videolar, dikey izleme deneyimi için
        kullanılan lisanslı kısa demo sahneleridir. Tam dizi yapımları
        yayınlandıkça kataloğa eklenecek.
      </Text>
    </View>
  );
}
