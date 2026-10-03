import { restoreProfilePhoto } from "./avatar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { db, deviceId, requireData, rpc } from "./client";
import { flushProgress } from "./progress";
import type {
  Series,
  Episode,
  Profile,
  Progress,
  Transaction,
  Notice,
  Language,
} from "../types";
export function useStore() {
  const [session, setSession] = useState<Session | null>(null),
    [series, setSeries] = useState<Series[]>([]),
    [episodes, setEpisodes] = useState<Episode[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [favorites, setFavorites] = useState<string[]>([]),
    [progress, setProgress] = useState<Progress[]>([]),
    [unlocks, setUnlocks] = useState<string[]>([]),
    [balance, setBalance] = useState(0),
    [transactions, setTransactions] = useState<Transaction[]>([]),
    [vip, setVip] = useState(false),
    [vipEnd, setVipEnd] = useState<string | null>(null),
    [isAdmin, setIsAdmin] = useState(false),
    [streak, setStreak] = useState({
      days: 0,
      last_claim_date: null as string | null,
    }),
    [notifications, setNotifications] = useState<Notice[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [language, setLanguage] = useState<Language>("tr");
  const userRef = useRef<string | null>(null);
  const bootstrapped = useRef<string | null>(null);
  const entitlementEpoch = useRef(0);
  const entitlementFlight = useRef<{ account: string; promise: Promise<void> } | null>(null);
  const refreshEntitlements = useCallback(async (force = false) => {
    const uid = userRef.current;
    if (!uid) return;
    if (entitlementFlight.current?.account === uid) {
      await entitlementFlight.current.promise;
      if (!force || userRef.current !== uid) return;
    }
    const epoch = ++entitlementEpoch.current;
    const promise = (async () => {
      // A failure in profile/history must never prevent an already credited wallet from updating.
      const results = await Promise.allSettled([
        requireData(db.from("dbs_borncoins_wallet").select("balance").eq("user_id", uid).single()),
        rpc<boolean>("dbs_is_vip"),
        requireData(db.from("dbs_borncoins_transactions").select("*").order("created_at", { ascending: false }).limit(100)),
        requireData(db.from("dbs_vip_subscriptions").select("expires_at").in("status", ["active", "grace", "cancelled"])
          .gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1)),
      ]);
      if (userRef.current !== uid || epoch !== entitlementEpoch.current) return;
      if (results[0].status === "fulfilled") setBalance(results[0].value.balance);
      if (results[1].status === "fulfilled") setVip(results[1].value);
      if (results[2].status === "fulfilled") setTransactions(results[2].value);
      if (results[3].status === "fulfilled") setVipEnd(results[3].value[0]?.expires_at || null);
      if (results[0].status === "rejected" || results[1].status === "rejected") throw Error("Hesap bilgisi henüz yenilenemedi.");
    })().finally(() => { if (entitlementFlight.current?.promise === promise) entitlementFlight.current = null; });
    entitlementFlight.current = { account: uid, promise };
    return promise;
  }, []);
  const refreshCatalog = useCallback(async () => {
    try {
      const [shows, eps] = await Promise.all([
        requireData(
          db
            .from("dbs_series")
            .select("*")
            .order("featured_order", { nullsFirst: false })
            .limit(200),
        ),
        requireData(
          db.from("dbs_episodes").select("*,dbs_seasons(number)").order("number").limit(500),
        ),
      ]);
      setSeries(shows);
      const resolved = eps.map((ep: any) => ({ ...ep, season_number: ep.dbs_seasons?.number || 1 }));
      setEpisodes(resolved);
      await AsyncStorage.setItem(
        "dbs-catalog-v04",
        JSON.stringify({ series: shows, episodes: resolved }),
      );
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı kurulamadı");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshAccount = useCallback(async () => {
    const {
      data: { session: current },
    } = await db.auth.getSession();
    if (!current) return;
    const uid = current.user.id;
    const epoch = entitlementEpoch.current;
    try {
      if (bootstrapped.current !== uid) {
        await rpc("dbs_bootstrap", {
          device: await deviceId(),
          label: Platform.OS === "web" ? "Web tarayıcı" : "Android · DraBornSeries",
          platform: Platform.OS,
        });
        await restoreProfilePhoto(current.user);
        bootstrapped.current = uid;
      }
      const results = await Promise.all([
        requireData(
          db.from("dbs_profiles").select("*").eq("user_id", uid).single(),
        ),
        requireData(db.from("dbs_favorites").select("series_id")),
        requireData(
          db
            .from("dbs_watch_progress")
            .select("*")
            .order("updated_at", { ascending: false }),
        ),
        requireData(db.from("dbs_episode_unlocks").select("episode_id")),
        requireData(
          db
            .from("dbs_borncoins_wallet")
            .select("balance")
            .eq("user_id", uid)
            .single(),
        ),
        requireData(
          db
            .from("dbs_borncoins_transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        rpc<boolean>("dbs_is_vip"),
        rpc<boolean>("dbs_is_admin"),
        requireData(
          db.from("dbs_user_streaks").select("*").eq("user_id", uid).single(),
        ),
        requireData(
          db
            .from("dbs_notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
        ),
        requireData(
          db
            .from("dbs_vip_subscriptions")
            .select("expires_at")
            .in("status", ["active", "grace", "cancelled"])
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1),
        ),
      ]);
      if (userRef.current !== uid) return;
      setProfile(results[0]);
      setLanguage(results[0].language);
      setFavorites(results[1].map((r: any) => r.series_id));
      setProgress(results[2]);
      setUnlocks(results[3].map((r: any) => r.episode_id));
      if (epoch === entitlementEpoch.current) {
        setBalance(results[4].balance);
        setTransactions(results[5]);
        setVip(results[6]);
        setVipEnd(results[10][0]?.expires_at || null);
      }
      setIsAdmin(results[7]);
      setStreak(results[8]);
      setNotifications(results[9]);
      setError("");
    } catch (err) {
      if (userRef.current === uid)
        setError(err instanceof Error ? err.message : "Hesap yüklenemedi");
    }
  }, []);
  useEffect(() => {
    AsyncStorage.getItem("dbs-catalog-v04").then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setSeries(parsed.series);
          setEpisodes(parsed.episodes);
          setLoading(false);
        } catch {}
      }
    });
    refreshCatalog();
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, current) => {
      const sameAccount = userRef.current === (current?.user.id || null);
      userRef.current = current?.user.id || null;
      setSession(current);
      if (sameAccount && _event === "TOKEN_REFRESHED") return;
      if (current) {
        setTimeout(() => {
          refreshAccount();
          flushProgress();
        }, 0);
      } else {
        setProfile(null);
        setFavorites([]);
        setProgress([]);
        setUnlocks([]);
        setBalance(0);
        setTransactions([]);
        setVip(false);
        setVipEnd(null);
        bootstrapped.current = null;
        setIsAdmin(false);
        setNotifications([]);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshAccount, refreshCatalog]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (userRef.current && AppState.currentState === "active") void refreshEntitlements().catch(() => {});
    }, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        flushProgress();
        void refreshEntitlements().catch(() => {});
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refreshEntitlements]);
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refreshEntitlements().catch(() => {}); }, 150);
    };
    const channel = db.channel("dbs-entitlements:" + uid)
      .on("postgres_changes", { event: "*", schema: "drabornseries", table: "dbs_borncoins_wallet", filter: "user_id=eq." + uid }, update)
      .on("postgres_changes", { event: "*", schema: "drabornseries", table: "dbs_vip_subscriptions", filter: "user_id=eq." + uid }, update)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void db.removeChannel(channel); };
  }, [session?.user.id, refreshEntitlements]);
  const toggleFavorite = async (id: string) => {
    if (!session) throw Error("AUTH_REQUIRED");
    if (favorites.includes(id))
      await requireData(
        db
          .from("dbs_favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("series_id", id),
      );
    else
      await requireData(
        db
          .from("dbs_favorites")
          .insert({ user_id: session.user.id, series_id: id }),
      );
    await refreshAccount();
  };
  return {
    session,
    series,
    episodes,
    profile,
    favorites,
    progress,
    unlocks,
    balance,
    transactions,
    vip,
    vipEnd,
    isAdmin,
    streak,
    notifications,
    loading,
    error,
    language,
    setLanguage,
    refreshAccount,
    refreshEntitlements,
    refreshCatalog,
    toggleFavorite,
  };
}
export type Store = ReturnType<typeof useStore>;
