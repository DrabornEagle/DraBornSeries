import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Series, Episode } from "../types";
import type { Store } from "../api/store";
import { usePreview } from "../api/preview";
import InlineVideo from "./InlineVideo";
import { Button, Icon, colors, styles } from "./theme";
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
// Only the three posters respond to a horizontal gesture; the rest of the hero stays still.
function FeaturedPosters({ entries, tick, compact, store, active, onStep, onSelect }: {
  entries: Series[]; tick: number; compact: boolean; store: Store; active: boolean;
  onStep: (step: number) => void; onSelect: (series: Series) => void;
}) {
  const phase = useRef(new Animated.Value(0)).current;
  const surface = useRef<React.ElementRef<typeof View>>(null);
  const suppressClickUntil = useRef(0);
  const previous = useRef(tick);
  const step = useRef(onStep); step.current = onStep;
  useEffect(() => {
    if (previous.current === tick) return;
    phase.stopAnimation(); phase.setValue(tick > previous.current ? 1 : -1);
    previous.current = tick;
    const animation = Animated.spring(phase, { toValue: 0, useNativeDriver: true,
      damping: 19, stiffness: 150, mass: 0.8 });
    animation.start(); return () => animation.stop();
  }, [tick, phase]);
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
    onPanResponderGrant: () => { suppressClickUntil.current = Infinity; },
    onPanResponderRelease: (_, gesture) => {
      setTimeout(() => { suppressClickUntil.current = 0; }, 400);
      if (Math.abs(gesture.dx) > 30) step.current(gesture.dx < 0 ? 1 : -1);
    },
    onPanResponderTerminationRequest: () => false,
  })).current;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = surface.current as unknown as HTMLElement | null;
    if (!node) return;
    let origin: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY, id: event.pointerId }; dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (!origin || event.pointerId !== origin.id) return;
      const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
      if (!dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dragging = true; node.setPointerCapture?.(event.pointerId);
      }
      if (dragging) { event.preventDefault(); suppressClickUntil.current = Date.now() + 1000; }
    };
    const up = (event: PointerEvent) => {
      if (!origin || event.pointerId !== origin.id) return;
      const dx = event.clientX - origin.x;
      if (dragging) {
        event.preventDefault(); event.stopPropagation(); suppressClickUntil.current = Date.now() + 400;
        if (Math.abs(dx) > 30) step.current(dx < 0 ? 1 : -1);
      }
      origin = null; dragging = false;
    };
    const cancel = () => { origin = null; dragging = false; };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== node || event.repeat) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); step.current(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    node.addEventListener("pointerdown", down); node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up); node.addEventListener("pointercancel", cancel);
    node.addEventListener("click", click, true); node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", click, true); node.removeEventListener("keydown", key);
    };
  }, []);
  const height = compact ? 300 : 388, cardWidth = height * 9 / 16, spacing = cardWidth * 0.86;
  return <View ref={surface} {...(Platform.OS === "web" ? {} : responder.panHandlers)} accessibilityLabel="Vitrindeki üç görsel arasında sağa veya sola kaydır"
    tabIndex={Platform.OS === "web" ? 0 : undefined}
    accessibilityActions={[{ name: "increment", label: "Sonraki afiş" }, { name: "decrement", label: "Önceki afiş" }]}
    onAccessibilityAction={(event) => step.current(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    style={[{ height, width: compact ? "100%" : 370, alignItems: "center", justifyContent: "center", overflow: "hidden" },
      Platform.OS === "web" ? { touchAction: "pan-y" } as ViewStyle : undefined]}>
    {[-1, 0, 1].map((slot) => {
      const series = entries[((tick + slot) % entries.length + entries.length) % entries.length];
      const position = Animated.add(phase, slot);
      return <Animated.View key={slot} style={{ position: "absolute", height, width: cardWidth, zIndex: slot === 0 ? 3 : 1,
        opacity: position.interpolate({ inputRange: [-2, -1, 0, 1, 2], outputRange: [0.25, 0.55, 1, 0.55, 0.25] }),
        transform: [{ translateX: Animated.multiply(position, spacing) },
          { scale: position.interpolate({ inputRange: [-2, -1, 0, 1, 2], outputRange: [0.7, 0.84, 1, 0.84, 0.7] }) },
          { rotate: position.interpolate({ inputRange: [-2, 0, 2], outputRange: ["-18deg", "0deg", "18deg"] }) }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={series.title} onPress={() => { if (Date.now() >= suppressClickUntil.current) onSelect(series); }}
          style={{ flex: 1, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#f5badb60" }}>
          <MotionArtwork series={series} episode={store.episodes.find((e) => e.series_id === series.id && e.access_type === "free")}
            active={slot === 0 && active} />
          <LinearGradient colors={["transparent", "#0a0710ef"]} style={{ position: "absolute", inset: 0 }} />
          <View style={{ position: "absolute", top: 12, left: 9, padding: 5, borderRadius: 6, backgroundColor: "#d83085dc" }}>
            <Text style={{ color: "white", fontSize: 8, fontWeight: "800" }}>{compactCount(series.view_count)} izlenme · ♥ {compactCount(series.like_count)}</Text>
          </View>
          <View style={{ position: "absolute", bottom: 18, left: 12, right: 10, gap: 6 }}>
            <Text style={{ color: "white", fontSize: compact ? 23 : 29, fontWeight: "900", lineHeight: compact ? 27 : 33 }}>{series.title}</Text>
            <Text style={{ color: "#f1d8e3", fontSize: 10 }}>{series.genres.join(" · ")}</Text>
          </View>
        </Pressable>
      </Animated.View>;
    })}
  </View>;
}

export function Home({
  store,
  onSelect,
  onBrowse,
  onStore,
  onRewards,
  onVIP,
  previewRegion = "hero",
  onCategoryScroll,
}: {
  store: Store;
  onSelect: (s: Series) => void;
  onBrowse: () => void;
  onStore: () => void;
  onRewards: () => void;
  onVIP: () => void;
  previewRegion?: string;
  onCategoryScroll?: (y: number) => void;
}) {
  const { width } = useWindowDimensions(),
    compact = width < 700,
    [tick, setTick] = useState(0),
    [category, setCategory] = useState("Sana özel");
  const resultY = useRef(0);
  const published = store.series.filter((s) => s.status === "published"),
    featured = published.length ? published : store.series;
  const wrap = (value: number) => ((value % Math.max(1, featured.length)) + featured.length) % Math.max(1, featured.length);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    const timer = setTimeout(() => setTick((t) => t + 1), 9000);
    return () => clearTimeout(timer);
  }, [tick]);
  const hero = featured[wrap(tick + seed)];
  if (!hero) return null;
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
            <Pressable key={v} onPress={() => { setCategory(v); requestAnimationFrame(() => onCategoryScroll?.(resultY.current)); }}>
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
          <FeaturedPosters entries={featured} tick={tick + seed} compact={compact} store={store}
            active={previewRegion === "hero" && store.profile?.preferences?.previews !== false}
            onStep={(value) => setTick((current) => current + value)} onSelect={onSelect} />
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
      <View onLayout={(event) => { resultY.current = event.nativeEvent.layout.y; }}>
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
      </View>
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
    </View>
  );
}
