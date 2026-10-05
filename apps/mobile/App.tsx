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
import * as ScreenOrientation from "expo-screen-orientation";
import * as NativeSplash from "expo-splash-screen";
import { useStore } from "../../packages/api/store";
import { db, requireData } from "../../packages/api/client";
import { translations } from "../../packages/shared/i18n";
import { filterSeries } from "../../packages/shared/domain";
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
import Legal from "./Legal";
import Library from "./Library";
import Commerce from "./Commerce";
import Discover from "./Discover";
import Splash from "../../packages/ui/Splash";
import AdminPanel from "../admin/AdminPanel";
import ErrorPopup from "../../packages/ui/ErrorPopup";
import PurchasePopup from "../../packages/ui/PurchasePopup";
import VipPopup from "../../packages/ui/VipPopup";
import { config } from "../../packages/shared/config";
import RefreshScrollView from "../../packages/ui/RefreshScrollView";
import { useBilling } from "../../packages/api/billing";
import { parseRoute, routePath, type Route } from "../../packages/shared/routes";
const navItems: [Page, React.ComponentProps<typeof Icon>["name"]][] = [
  ["home", "home-outline"],
  ["feed", "play-circle-outline"],
  ["library", "bookmark-outline"],
  ["rewards", "gift-outline"],
  ["profile", "person-circle-outline"],
];
if (Platform.OS !== "web") void NativeSplash.preventAutoHideAsync().catch(() => {});
function Main() {
  useEffect(() => {
    if (Platform.OS !== "web") void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);
  const store = useStore(),
    t = translations(store.language),
    { width } = useWindowDimensions(),
    desktop = width >= 1050,
    tightHeader = width < 380,
    compactBrand = desktop || width < 440;
  const [route, setRoute] = useState<Route>(() =>
      Platform.OS === "web" && typeof window !== "undefined"
        ? parseRoute(window.location.href)
        : { page: "home" },
    ),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState(""),
    [filter, setFilter] = useState("all"),
    [libraryTab, setLibraryTab] = useState<"favorites" | "history">("favorites"),
    [recent, setRecent] = useState<string[]>([]),
    [toast, setToast] = useState(""),
    [actionError, setActionError] = useState(""),
    [dismissedError, setDismissedError] = useState(""),
    [previewRegion, setPreviewRegion] = useState("hero"),
    [busy, setBusy] = useState(false);
  const [vipVisible, setVipVisible] = useState(false);
  const scrollOffset = useRef(0);
  const billing = useBilling(store.session?.user.id, () => store.refreshEntitlements(true));
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null),
    history = useRef<Route[]>([]),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    fade = useRef(new Animated.Value(0)).current;
  const catalog = useRef({ series: store.series, episodes: store.episodes });
  catalog.current = { series: store.series, episodes: store.episodes };
  const go = useCallback((page: Page, extra: Partial<Route> = {}) => {
    setPreviewRegion("hero");
    setRoute((current) => {
      history.current.push(current);
      return { page, ...extra };
    });
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.history.pushState({}, "", routePath({ page, ...extra }, catalog.current.series, catalog.current.episodes));
    }
  }, []);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) setToast(success);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(""), 6000);
      }
    },
    [],
  );
  useEffect(() => { if (!store.error) setDismissedError(""); }, [store.error]);
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
    activeEpisode = store.episodes.find((e) => route.episode ? e.id === route.episode : e.series_id === activeSeries?.id && e.number === route.episodeNumber && (e.season_number || 1) === route.season);
  useEffect(() => {
    if (Platform.OS === "web" && (activeEpisode || activeSeries) && (route.episode || route.page === "detail" || window.location.search.includes("dbs_route="))) {
      const path = routePath(route, store.series, store.episodes);
      if (decodeURI(window.location.pathname) !== decodeURI(path)) window.history.replaceState({}, "", path);
    }
  }, [route, activeEpisode, activeSeries, store.series, store.episodes]);
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
    if (route.page === "privacy" || route.page === "terms" || route.page === "delete-account")
      return <Legal key={route.page} page={route.page} store={store} go={go} run={run} />;
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
          onCategoryScroll={(y) => scroll.current?.scrollTo({ y: Math.max(0, y - 10), animated: true })}
        />
      );
    if (route.page === "detail")
      return activeSeries ? (
        <SeriesDetail
          key={activeSeries.id}
          series={activeSeries}
          store={store}
          onEpisode={onEpisode}
          run={run}
          onLogin={() => go("auth")}
          onRules={() => go("terms")}
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
          onVIP={() => go("vip")}
          onWallet={() => go("wallet")}
        />
      ) : (
        <Empty title="Bölüm bulunamadı" />
      );
    if (route.page === "auth") return <Auth store={store} run={run} onLegal={(page) => go(page)} />;
    if (route.page === "admin") return <AdminPanel store={store} run={run} onPreviewVisible={(view) => {
      view?.measureInWindow((_x, targetY) => scroll.current?.measureInWindow((_sx, containerY) => {
        scroll.current?.scrollTo({ y: Math.max(0, scrollOffset.current + targetY - containerY - 16), animated: true });
      }));
    }} />;
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
    if (route.page === "library") return <Library key={store.session?.user.id || "guest"} store={store} tab={libraryTab} onTabChange={setLibraryTab}
      onSelect={onSelect} onLogin={() => go("auth")} onBrowse={() => browse()} />;
    if (["store", "vip", "wallet", "rewards", "profile"].includes(route.page))
      return (
        <Commerce
          billing={billing}
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
      style={[styles.row, { gap: tightHeader ? 6 : 9, flexShrink: 1, minWidth: 0 }]}
      accessibilityLabel="DraBornSeries ana sayfa"
    >
      <Image
        source={require("../../assets/icons/logo-transparent.png")}
        style={{ width: tightHeader ? 32 : compactBrand ? 36 : 40, height: tightHeader ? 32 : compactBrand ? 36 : 40, borderRadius: 12 }}
      />
      <View style={{ minWidth: 0, flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontSize: tightHeader ? 13 : compactBrand ? 17 : 19,
            fontWeight: "900",
            color: "#fff",
            letterSpacing: -0.6,
          }}
        >
          DraBorn<Text style={{ color: colors.pink }}>Series</Text>
        </Text>
        <Text numberOfLines={1} style={{ fontSize: tightHeader ? 6 : compactBrand ? 7 : 8, letterSpacing: tightHeader ? 1.8 : compactBrand ? 2.8 : 3.7, color: colors.muted }}>
          YOUR NEXT CHAPTER
        </Text>
      </View>
    </Pressable>
  );
  return (
    <SafeAreaView
      onLayout={() => { if (Platform.OS !== "web") void NativeSplash.hideAsync().catch(() => {}); }}
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
                icon="shield-checkmark-outline"
                label="Gizlilik"
                active={route.page === "privacy"}
                onPress={() => go("privacy")}
              />
              <Nav
                icon="help-circle-outline"
                label={t.help}
                active={route.page === "help"}
                onPress={() => go("help")}
              />
              <Text style={{ color: "#675d72", fontSize: 10 }}>
                DraBornEagle © 2026{`\n`}DraBornSeries v{config.version}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {(desktop || route.page !== "feed") && (
            <View
              style={{
                paddingHorizontal: desktop ? 36 : tightHeader ? 14 : 20,
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
                  gap: desktop ? 18 : tightHeader ? 8 : 12,
                  flexShrink: 0,
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
                {store.vip && <Pressable accessibilityRole="button" accessibilityLabel="VIP üyelik bilgilerimi aç" onPress={() => { setVipVisible(true); void store.refreshEntitlements().catch(() => {}); }} style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6, borderRadius: 12, backgroundColor: "#ffd58c20", borderWidth: 1, borderColor: "#ffd58c70" }}><Icon name="diamond" color="#ffd58c" size={14} />{!tightHeader && <Text style={{ fontSize: 12, color: "#ffd58c", fontWeight: "900" }}>VIP</Text>}</Pressable>}
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
                  {store.profile?.avatar_url ? <Image source={{ uri: store.profile.avatar_url }}
                    style={{ width: 34, height: 34, borderRadius: 12 }} />
                    : <Icon name="person-outline" size={18} color={colors.purple} />}
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
            <RefreshScrollView
              ref={scroll}
              refreshEnabled={!busy && route.page !== "player"}
              onRefresh={async () => { await store.refreshCatalog(); await store.refreshAccount(); }}
              style={{ flex: 1 }}
              scrollEventThrottle={150}
              onScroll={(event) => {
                scrollOffset.current = event.nativeEvent.contentOffset.y;
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
                    <Pressable accessibilityRole="button" onPress={() => go("help")}>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        Yardım
                      </Text>
                    </Pressable>
                    {([ ["privacy", "Gizlilik Politikası"], ["terms", "Koşullar"], ["delete-account", "Hesap silme"] ] as const).map(([page, label]) =>
                      <Pressable key={page} accessibilityRole="button" onPress={() => go(page)}>
                        <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
                      </Pressable>)}
                    <Text style={{ fontSize: 11, color: "#665b70" }}>•</Text>
                    <Text style={{ fontSize: 11, color: "#665b70" }}>
                      Erken erişim · v{config.version}
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
            </RefreshScrollView>
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
                      flex: 1,
                      minWidth: 0,
                      paddingHorizontal: tightHeader ? 4 : 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor:
                          route.page === page ? "#f53b8d22" : "transparent",
                        paddingHorizontal: tightHeader ? 12 : 14,
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
      <ErrorPopup error={actionError || (store.error !== dismissedError ? store.error : "")}
        busy={busy} onClose={() => { setActionError(""); setDismissedError(store.error); }}
        onRetry={() => run(async () => {
          setActionError(""); setDismissedError("");
          await store.refreshCatalog(); await store.refreshAccount();
        })} />
      <Splash ready={!store.loading} />
      <PurchasePopup notice={billing.notice} busy={billing.restoring} onClose={billing.clearNotice}
        onVip={() => { billing.clearNotice(); go("vip"); }}
        onManage={() => { billing.clearNotice(); void Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.draborneagle.drabornseries"); }}
        onWallet={() => { billing.clearNotice(); go("wallet"); }}
        onRetry={() => { const product = billing.notice?.started === false ? billing.notice.productId : "";
          billing.clearNotice(); void run(() => product ? billing.buy(product) : billing.restore()); }} />
      <VipPopup visible={vipVisible} store={store} onClose={() => setVipVisible(false)} onStore={() => { setVipVisible(false); go("store"); }} />
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
