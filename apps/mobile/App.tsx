import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useStore } from "../../packages/api/store";
import { db, requireData } from "../../packages/api/client";
import { translations } from "../../packages/shared/i18n";
import { filterSeries, readableError } from "../../packages/shared/domain";
import {
  colors,
  styles,
  Button,
  Chip,
  Empty,
  Field,
  Icon,
  Loading,
} from "../../packages/ui/theme";
import { Home, Poster } from "../../packages/ui/Catalog";
import type { Episode, Page, Series } from "../../packages/types";
import Auth from "./Auth";
import SeriesDetail from "./SeriesDetail";
import Player from "./Player";
import Account from "./Account";
import Commerce from "./Commerce";
import Discover from "./Discover";
import Splash from "../../packages/ui/Splash";
import AdminPanel from "../admin/AdminPanel";
const navItems: [Page, React.ComponentProps<typeof Icon>["name"]][] = [
  ["home", "home-outline"],
  ["feed", "play-circle-outline"],
  ["library", "bookmark-outline"],
  ["rewards", "gift-outline"],
  ["profile", "person-circle-outline"],
];
type Route = { page: Page; series?: string; episode?: string };
function parseRoute(url: string): Route {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("episode"))
      return { page: "player", episode: parsed.searchParams.get("episode")! };
    if (parsed.searchParams.get("series"))
      return { page: "detail", series: parsed.searchParams.get("series")! };
    const page = parsed.searchParams.get("page");
    const allowed = [
      "home",
      "feed",
      "store",
      "browse",
      "search",
      "library",
      "wallet",
      "vip",
      "rewards",
      "profile",
      "settings",
      "notifications",
      "auth",
      "admin",
      "help",
    ];
    return {
      page: allowed.includes(page || "")
        ? (page as Page)
        : parsed.searchParams.has("reset")
          ? "auth"
          : "home",
    };
  } catch {
    return { page: "home" };
  }
}
function Main() {
  const store = useStore(),
    t = translations(store.language),
    { width } = useWindowDimensions(),
    desktop = width >= 1050;
  const [route, setRoute] = useState<Route>(() =>
      Platform.OS === "web" && typeof window !== "undefined"
        ? parseRoute(window.location.href)
        : { page: "home" },
    ),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState(""),
    [filter, setFilter] = useState("all"),
    [libraryTab, setLibraryTab] = useState("favorites"),
    [recent, setRecent] = useState<string[]>([]),
    [toast, setToast] = useState(""),
    [previewRegion, setPreviewRegion] = useState("hero"),
    [busy, setBusy] = useState(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null),
    history = useRef<Route[]>([]),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    fade = useRef(new Animated.Value(0)).current;
  const go = useCallback((page: Page, extra: Partial<Route> = {}) => {
    setPreviewRegion("hero");
    setRoute((current) => {
      history.current.push(current);
      return { page, ...extra };
    });
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const params = new URLSearchParams();
      if (extra.episode) params.set("episode", extra.episode);
      else if (extra.series) params.set("series", extra.series);
      else if (page !== "home") params.set("page", page);
      window.history.pushState(
        {},
        "",
        `${window.location.pathname}${params.toString() ? "?" + params : ""}`,
      );
    }
  }, []);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) setToast(success);
      } catch (err) {
        setToast(readableError(err));
      } finally {
        setBusy(false);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(""), 6000);
      }
    },
    [],
  );
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 650,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [fade]);
  useEffect(() => {
    if (Platform.OS === "web") {
      const back = () => setRoute(parseRoute(window.location.href));
      window.addEventListener("popstate", back);
      return () => window.removeEventListener("popstate", back);
    }
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      const prev = history.current.pop();
      if (prev) {
        setRoute(prev);
        return true;
      }
      if (route.page !== "home") {
        setRoute({ page: "home" });
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [route.page]);
  useEffect(() => {
    if (Platform.OS !== "web")
      Linking.getInitialURL().then((url) => {
        if (url) setRoute(parseRoute(url));
      });
    const subscription = Linking.addEventListener("url", (event) =>
      setRoute(parseRoute(event.url)),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (
      store.session &&
      route.page === "auth" &&
      !(Platform.OS === "web" && window.location.search.includes("reset"))
    )
      go("profile");
  }, [store.session, route.page, go]);
  useEffect(() => {
    if (store.session && route.page === "search")
      requireData(
        db
          .from("dbs_search_history")
          .select("query")
          .order("created_at", { ascending: false })
          .limit(10),
      )
        .then((rows) =>
          setRecent([...new Set<string>(rows.map((row: any) => row.query))]),
        )
        .catch(() => {});
  }, [store.session, route.page]);
  const onSelect = (series: Series) => go("detail", { series: series.slug }),
    onEpisode = (episode: Episode) => go("player", { episode: episode.id });
  const activeSeries = store.series.find(
      (s) => s.slug === route.series || s.id === route.series,
    ),
    activeEpisode = store.episodes.find((e) => e.id === route.episode);
  const selectedGenre = genre;
  const results = filterSeries(store.series, query, selectedGenre, filter);
  function browse(reset = true) {
    if (reset) {
      setQuery("");
      setGenre("");
      setFilter("all");
    }
    go("browse");
  }
  function renderPage() {
    if (store.loading && !store.series.length) return <Loading />;
    if (route.page === "home")
      return (
        <Home
          store={store}
          onSelect={onSelect}
          onBrowse={() => browse()}
          onStore={() => go("store")}
          onRewards={() => go("rewards")}
          onVIP={() => go("vip")}
          previewRegion={previewRegion}
        />
      );
    if (route.page === "detail")
      return activeSeries ? (
        <SeriesDetail
          series={activeSeries}
          store={store}
          onEpisode={onEpisode}
          run={run}
          onLogin={() => go("auth")}
        />
      ) : (
        <Empty title="Dizi bulunamadı" />
      );
    if (route.page === "player")
      return activeEpisode ? (
        <Player
          key={activeEpisode.id}
          episode={activeEpisode}
          store={store}
          onEpisode={onEpisode}
          onLogin={() => go("auth")}
          run={run}
          onReport={() => go("help")}
        />
      ) : (
        <Empty title="Bölüm bulunamadı" />
      );
    if (route.page === "auth") return <Auth store={store} run={run} />;
    if (route.page === "admin") return <AdminPanel store={store} run={run} />;
    if (route.page === "browse" || route.page === "search")
      return (
        <View style={{ gap: 25 }}>
          <View>
            <Text style={styles.eyebrow}>HİKÂYELERİNİ BUL</Text>
            <Text style={[styles.h1, { marginTop: 12 }]}>
              {route.page === "search" ? t.search : t.browse}
            </Text>
          </View>
          <Field
            placeholder={t.searchPlaceholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim() && store.session)
                run(async () => {
                  await requireData(
                    db.from("dbs_search_history").insert({
                      user_id: store.session!.user.id,
                      query: query.trim().slice(0, 120),
                    }),
                  );
                  setRecent(
                    [query, ...recent.filter((v) => v !== query)].slice(0, 10),
                  );
                });
            }}
          />
          {route.page === "search" && recent.length > 0 && (
            <View style={styles.wrap}>
              {recent.map((word) => (
                <Chip key={word} label={word} onPress={() => setQuery(word)} />
              ))}
              <Button
                small
                secondary
                onPress={() =>
                  run(async () => {
                    await requireData(
                      db
                        .from("dbs_search_history")
                        .delete()
                        .eq("user_id", store.session!.user.id),
                    );
                    setRecent([]);
                  })
                }
              >
                Geçmişi temizle
              </Button>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {[
              "",
              "Romantik",
              "Gerilim",
              "Dram",
              "Bilimkurgu",
              "Gizem",
              "Komedi",
              "Animasyon",
              "Fantastik",
            ].map((value) => (
              <Chip
                key={value}
                label={value || t.all}
                active={value === genre}
                onPress={() => setGenre(value)}
              />
            ))}
          </ScrollView>
          <View style={styles.wrap}>
            {[
              ["all", t.all],
              ["free", t.free],
              ["vip", "VIP"],
              ["upcoming", t.coming],
            ].map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                active={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </View>
          <Text style={styles.body}>{results.length} hikâye</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
            {results.map((series) => (
              <Poster
                key={series.id}
                series={series}
                onPress={() => onSelect(series)}
              />
            ))}
          </View>
          {!results.length && (
            <Empty title={t.noResult} icon="search-outline" />
          )}
        </View>
      );
    if (route.page === "library") {
      if (!store.session)
        return (
          <Empty title="Kendi koleksiyonunu oluştur" detail={t.synced}>
            <Button onPress={() => go("auth")}>{t.login}</Button>
          </Empty>
        );
      const ids =
        libraryTab === "favorites"
          ? store.favorites
          : store.progress.map(
              (p) =>
                store.episodes.find((e) => e.id === p.episode_id)?.series_id,
            );
      const list = store.series.filter((s) => ids.includes(s.id));
      return (
        <View style={{ gap: 25 }}>
          <Text style={styles.h1}>{t.library}</Text>
          <View style={styles.row}>
            <Chip
              label="Favorilerim"
              active={libraryTab === "favorites"}
              onPress={() => setLibraryTab("favorites")}
            />
            <Chip
              label={t.history}
              active={libraryTab === "history"}
              onPress={() => setLibraryTab("history")}
            />
          </View>
          <View style={styles.wrap}>
            {list.map((s) => (
              <Poster key={s.id} series={s} onPress={() => onSelect(s)} />
            ))}
          </View>
          {list.length === 0 && (
            <Empty
              title="İlk hikâyeni seç"
              detail="Sevdiğin dizileri listene ekle, kaldığın yerden devam et."
              icon="bookmark-outline"
            >
              <Button onPress={() => browse()}>{t.browse}</Button>
            </Empty>
          )}
        </View>
      );
    }
    if (["store", "vip", "wallet", "rewards", "profile"].includes(route.page))
      return (
        <Commerce
          page={route.page}
          store={store}
          go={go}
          run={run}
          onHistory={() => {
            setLibraryTab("history");
            go("library");
          }}
        />
      );
    return <Account page={route.page} store={store} go={go} run={run} />;
  }
  const brand = (
    <Pressable
      onPress={() => go("home")}
      style={[styles.row, { gap: 9 }]}
      accessibilityLabel="DraBornSeries ana sayfa"
    >
      <Image
        source={require("../../assets/icons/icon.png")}
        style={{ width: 40, height: 40, borderRadius: 12 }}
      />
      <View>
        <Text
          style={{
            fontSize: 19,
            fontWeight: "900",
            color: "#fff",
            letterSpacing: -0.6,
          }}
        >
          DraBorn<Text style={{ color: colors.pink }}>Series</Text>
        </Text>
        <Text style={{ fontSize: 8, letterSpacing: 3.7, color: colors.muted }}>
          YOUR NEXT CHAPTER
        </Text>
      </View>
    </Pressable>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, flexDirection: "row" }}>
        {desktop && (
          <View
            style={{
              width: 224,
              borderRightWidth: 1,
              borderColor: colors.line,
              padding: 22,
              paddingTop: 30,
              gap: 36,
            }}
          >
            {brand}
            <View style={{ gap: 9 }}>
              <Text
                style={[styles.eyebrow, { color: "#746981", marginBottom: 8 }]}
              >
                KEŞFET
              </Text>
              {navItems.map(([page, icon]) => (
                <Nav
                  key={page}
                  icon={icon}
                  label={t[page]}
                  active={route.page === page}
                  onPress={() => go(page)}
                />
              ))}
            </View>
            <View style={{ gap: 9 }}>
              <Text
                style={[styles.eyebrow, { color: "#746981", marginBottom: 8 }]}
              >
                SANA ÖZEL
              </Text>
              <Nav
                icon="bag-handle-outline"
                label="DraBornSeries Mağazası"
                active={route.page === "store"}
                onPress={() => go("store")}
              />
              <Nav
                icon="diamond-outline"
                label="DraBornSeries VIP"
                active={route.page === "vip"}
                onPress={() => go("vip")}
              />
              <Nav
                icon="grid-outline"
                label={t.browse}
                active={route.page === "browse"}
                onPress={() => browse()}
              />
              {store.isAdmin && (
                <Nav
                  icon="options-outline"
                  label="Stüdyo"
                  active={route.page === "admin"}
                  onPress={() => go("admin")}
                />
              )}
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 15 }}>
              <Nav
                icon="help-circle-outline"
                label={t.help}
                active={route.page === "help"}
                onPress={() => go("help")}
              />
              <Text style={{ color: "#675d72", fontSize: 10 }}>
                DraBornEagle © 2026{`\n`}DraBornSeries v0.2.0
              </Text>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {(desktop || route.page !== "feed") && (
            <View
              style={{
                paddingHorizontal: desktop ? 36 : 20,
                height: desktop ? 85 : 75,
                borderBottomWidth: 1,
                borderColor: colors.line,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {desktop ? (
                <Pressable
                  onPress={() => go("search")}
                  style={[styles.row, { flex: 1 }]}
                >
                  <Icon name="search-outline" color={colors.muted} />
                  <Text style={styles.body}>{t.searchPlaceholder}</Text>
                </Pressable>
              ) : (
                brand
              )}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: desktop ? 18 : 12,
                }}
              >
                {desktop && (
                  <Pressable onPress={() => go("wallet")} style={styles.row}>
                    <Icon name="dbs-coin" color={colors.orange} size={18} />
                    <Text style={styles.label}>{store.balance} BornCoins</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityLabel={t.search}
                  onPress={() => go("search")}
                >
                  <Icon name="search-outline" color={colors.pink} />
                </Pressable>
                <Pressable
                  accessibilityLabel={t.store}
                  onPress={() => go("store")}
                >
                  <Icon name="bag-handle-outline" />
                </Pressable>
                <Pressable
                  accessibilityLabel={store.session ? t.profile : t.login}
                  onPress={() => go(store.session ? "profile" : "auth")}
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "#30223f",
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="person-outline" size={18} color={colors.purple} />
                </Pressable>
              </View>
            </View>
          )}
          {route.page === "feed" ? (
            <Discover
              store={store}
              onEpisode={onEpisode}
              onSeries={onSelect}
              onLogin={() => go("auth")}
              run={run}
            />
          ) : (
            <ScrollView
              ref={scroll}
              style={{ flex: 1 }}
              scrollEventThrottle={150}
              onScroll={(event) => {
                if (route.page === "home") {
                  const y = event.nativeEvent.contentOffset.y;
                  setPreviewRegion(
                    y < 320 ? "hero" : y < 1150 ? "rail" : "none",
                  );
                }
              }}
              contentContainerStyle={{
                padding: desktop ? 32 : 18,
                paddingBottom: 100,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View
                style={{
                  width: "100%",
                  maxWidth: 1320,
                  alignSelf: "center",
                  opacity: fade,
                }}
              >
                {!["home", "browse", "search"].includes(route.page) && (
                  <View style={{ marginBottom: 22 }}>
                    <Button
                      small
                      secondary
                      icon="arrow-back"
                      onPress={() => {
                        if (Platform.OS === "web" && window.history.length > 1)
                          window.history.back();
                        else {
                          const previous = history.current.pop();
                          setRoute(previous || { page: "home" });
                        }
                      }}
                    >
                      {t.back}
                    </Button>
                  </View>
                )}
                {store.error && (
                  <View
                    style={[
                      styles.card,
                      { marginBottom: 20, padding: 16, borderColor: "#824e57" },
                    ]}
                  >
                    <Text style={{ color: colors.orange }}>
                      Bağlantı veya hesap sorunu: {readableError(store.error)}
                    </Text>
                    <Button
                      small
                      secondary
                      onPress={() =>
                        run(async () => {
                          await store.refreshCatalog();
                          await store.refreshAccount();
                        })
                      }
                    >
                      {t.retry}
                    </Button>
                  </View>
                )}
                {renderPage()}
                <View
                  style={{
                    marginTop: 42,
                    borderTopWidth: 1,
                    borderColor: colors.line,
                    paddingTop: 25,
                    gap: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, color: "#766981" }}>
                    DraBornSeries — Bir sonraki hikâyen.
                  </Text>
                  <View style={styles.wrap}>
                    <Pressable onPress={() => go("help")}>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        Yardım & Gizlilik
                      </Text>
                    </Pressable>
                    <Text style={{ fontSize: 11, color: "#665b70" }}>•</Text>
                    <Text style={{ fontSize: 11, color: "#665b70" }}>
                      Erken erişim · v0.2.0
                    </Text>
                    <Pressable
                      onPress={() =>
                        store.setLanguage(store.language === "tr" ? "en" : "tr")
                      }
                    >
                      <Text style={{ fontSize: 11, color: colors.purple }}>
                        TR / EN
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>
          )}
          {!desktop && (
            <SafeAreaView
              edges={["bottom"]}
              style={{
                backgroundColor: "#120e1a",
                borderTopWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  paddingTop: 11,
                  paddingBottom: 10,
                }}
              >
                {navItems.map(([page, icon]) => (
                  <Pressable
                    key={page}
                    accessibilityRole="button"
                    accessibilityState={{ selected: route.page === page }}
                    onPress={() => go(page)}
                    style={{
                      gap: 5,
                      alignItems: "center",
                      minWidth: 55,
                      paddingHorizontal: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor:
                          route.page === page ? "#f53b8d22" : "transparent",
                        paddingHorizontal: 14,
                        paddingVertical: 5,
                        borderRadius: 15,
                      }}
                    >
                      <Icon
                        name={icon}
                        size={22}
                        color={route.page === page ? colors.pink : colors.muted}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: route.page === page ? colors.pink : colors.muted,
                      }}
                    >
                      {t[page]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </SafeAreaView>
          )}
        </View>
      </View>
      {(toast || busy) && (
        <View
          style={{
            position: "absolute",
            bottom: desktop ? 25 : 90,
            left: 20,
            right: 20,
            alignItems: "center",
            pointerEvents: "box-none",
          }}
        >
          <Pressable
            onPress={() => setToast("")}
            style={{
              maxWidth: 650,
              backgroundColor: "#33233f",
              borderWidth: 1,
              borderColor: "#754a82",
              borderRadius: 16,
              padding: 17,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            {busy && <ActivityIndicator color={colors.pink} />}
            <Text style={{ color: colors.text, fontSize: 13, flexShrink: 1 }}>
              {toast || "İşlem yapılıyor…"}
            </Text>
          </Pressable>
        </View>
      )}
      <Splash ready={!store.loading} />
    </SafeAreaView>
  );
}
function Nav({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <LinearGradient
        colors={
          active ? ["#44203b", "#211527"] : ["transparent", "transparent"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Icon name={icon} color={active ? colors.pink : colors.muted} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: active ? "800" : "500",
            color: active ? "#fff" : colors.muted,
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
