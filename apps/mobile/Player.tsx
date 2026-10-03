import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, ScrollView, Pressable, Text, View, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Store } from "../../packages/api/store";
import type { Episode, Playback } from "../../packages/types";
import { rpc } from "../../packages/api/client";
import { loadPlaybackSource } from "../../packages/api/playback";
import { saveProgress } from "../../packages/api/progress";
import {
  accessLabel,
  clientCanWatch,
  readableError,
} from "../../packages/shared/domain";
import VideoPlayer from "../../packages/ui/VideoPlayer";
import AdRewardButton from "../../packages/ui/AdRewardButton";
import {
  Button,
  Icon,
  Empty,
  Loading,
  colors,
  styles,
} from "../../packages/ui/theme";
export default function Player({
  episode,
  store,
  onEpisode,
  onLogin,
  run,
  onReport,
  onVIP,
  onWallet,
}: {
  episode: Episode;
  store: Store;
  onEpisode: (ep: Episode) => void;
  onLogin: () => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onReport: () => void;
  onVIP: () => void;
  onWallet: () => void;
}) {
  const [episodePicker, setEpisodePicker] = useState(false);
  const [confirmCoins, setConfirmCoins] = useState(false), [unlockBusy, setUnlockBusy] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(entrance, { toValue: 1, duration: 480, useNativeDriver: Platform.OS !== "web" }).start(); }, [entrance]);
  const [source, setSource] = useState<Playback | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [auto, setAuto] = useState(true);
  const allowed = clientCanWatch(episode, new Set(store.unlocks), store.vip),
    progress = store.progress.find((p) => p.episode_id === episode.id);
  const [initialTime] = useState(
    progress?.completed ? 0 : progress?.position_seconds || 0,
  );
  const confirmationShown = useRef(false);
  const countedViewRefreshed = useRef(false);
  useEffect(() => {
    if (
      !allowed &&
      !confirmationShown.current &&
      store.session &&
      ["coins", "vip_or_coins"].includes(episode.access_type)
    ) {
      confirmationShown.current = true;
      setConfirmCoins(true);
    }
  }, [allowed, episode, store, run]);
  const sequence = store.episodes.filter(
      (e) => e.series_id === episode.series_id,
    ).sort((a, b) => (a.season_number || 1) - (b.season_number || 1) || a.number - b.number),
    position = sequence.findIndex((e) => e.id === episode.id),
    next = sequence[position + 1],
    previous = sequence[position - 1];
  useEffect(() => {
    let live = true;
    setSource(null);
    setError("");
    if (allowed)
      loadPlaybackSource(episode.id, retry > 0)
        .then((value) => {
          if (live) setSource(value);
        })
        .catch((err) => {
          if (live) setError(readableError(err));
        });
    return () => {
      live = false;
    };
  }, [episode.id, allowed, retry, store.session?.user.id]);
  const nextId = next?.id, nextAllowed = next && clientCanWatch(next, new Set(store.unlocks), store.vip);
  useEffect(() => {
    // Prepare only the next authorized URL; never download whole videos in the background.
    if (source && nextId && nextAllowed) {
      void loadPlaybackSource(nextId).catch(() => {});
    }
  }, [source, nextId, nextAllowed, store.session?.user.id]);
  return (
    <View style={{ gap: 24 }}>
      <View>
        <Text style={styles.eyebrow}>DRABORNSERIES PLAYER</Text>
        <Text style={[styles.h2, { marginTop: 10 }]}>{episode.title}</Text>
      </View>
      {!allowed ? (
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <LinearGradient colors={episode.access_type === "vip" ? ["#493028", "#281d37", "#181020"] : ["#40203e", "#26153d", "#131326"]} style={{ padding: 26, borderRadius: 28, borderWidth: 1, borderColor: episode.access_type === "vip" ? "#ffc56f70" : "#ed74d160", alignItems: "center", gap: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 27, backgroundColor: "#ffffff0d", justifyContent: "center", alignItems: "center" }}><Icon name={episode.access_type === "vip" ? "diamond" : episode.access_type === "ad" && Platform.OS === "android" ? "play-circle" : "lock-closed"} size={40} color={episode.access_type === "vip" ? "#ffd58c" : "#ef9cda"} /></View>
          <Text style={[styles.h2, { textAlign: "center", fontSize: 26 }]}>Bu hikâyenin devamını aç</Text>
          <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: "#ffd58c20", borderWidth: 1, borderColor: "#ffd58c65" }}><Text style={{ color: "#ffe0a6", fontSize: 17, fontWeight: "900" }}>{episode.access_type === "ad" && Platform.OS !== "android" ? "ANDROID ERİŞİMİ" : accessLabel(episode)}</Text></View>
          <Text style={[styles.body, { textAlign: "center", fontSize: 15 }]}>Bakiye: {store.balance.toLocaleString("tr-TR")} BornCoins</Text>
          {!store.session ? (
            <Button onPress={onLogin}>Giriş yap</Button>
          ) : (
            <View style={{ gap: 14, width: "100%", maxWidth: 440 }}>
              {["coins", "vip_or_coins"].includes(episode.access_type) && (
                <Button
                  icon="cash-outline" onPress={() => setConfirmCoins(true)}
                >
                  {episode.coin_price} BornCoins ile aç
                </Button>
              )}
              {["vip", "vip_or_coins"].includes(episode.access_type) && <><Text style={[styles.body, { textAlign: "center" }]}>VIP üyeliğinle özel bölümlere hemen eriş.</Text><Button icon="diamond" onPress={onVIP}>VIP planlarını keşfet</Button></>}
              {episode.access_type === "ad" && (
                Platform.OS === "android" ? <AdRewardButton store={store} run={run} onLogin={onLogin} episode={episode.id} onDone={() => setRetry(value => value + 1)} /> : <Text style={[styles.body, { textAlign: "center", lineHeight: 24 }]}>Bu bölümü Android uygulamasından açabilirsin. Açtığın bölümler aynı hesabınla burada da izlenebilir.</Text>
              )}
              {episode.access_type === "promotion" && <Button icon="gift-outline" onPress={onWallet}>Promosyon kodunu kullan</Button>}
            </View>
          )}
        </LinearGradient></Animated.View>
      ) : error ? (
        <Empty
          title="Video açılamadı"
          detail={error}
          icon="cloud-offline-outline"
        >
          <Button onPress={() => setRetry(retry + 1)}>Tekrar dene</Button>
        </Empty>
      ) : source ? (
        <VideoPlayer
          key={`${episode.id}-${retry}`}
          source={source}
          onRefreshSource={() => loadPlaybackSource(episode.id, true)}
          title={episode.title}
          initialTime={initialTime}
          portrait={episode.orientation !== "landscape"}
          onProgress={(seconds) => {
            if (seconds <= 0) return;
            void saveProgress(episode.id, seconds).then(async (synced) => {
              // The server counts one view once this episode's threshold is crossed.
              // Refresh that result promptly without downloading the catalog every 5s.
              if (synced && store.session && !countedViewRefreshed.current && seconds >= Math.min(5, episode.duration_seconds / 2)) {
                countedViewRefreshed.current = true;
                try { countedViewRefreshed.current = await store.refreshCatalog(); }
                catch { countedViewRefreshed.current = false; }
              }
            }).catch(() => {});
          }}
          onEnd={() => {
            if (auto && next) onEpisode(next);
          }}
        />
      ) : (
        <Loading />
      )}
      <View
        style={[
          styles.row,
          { justifyContent: "space-between", flexWrap: "wrap" },
        ]}
      >
        <View style={styles.wrap}>
          {previous && (
            <Button
              secondary
              icon="arrow-back"
              onPress={() => onEpisode(previous)}
            >
              Önceki
            </Button>
          )}
          <Button secondary icon="albums-outline" onPress={() => setEpisodePicker(true)}>Bölümler</Button>
          {next && (
            <Button icon="arrow-forward" onPress={() => onEpisode(next)}>
              Sonraki bölüm
            </Button>
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.body}>Otomatik sonraki bölüm</Text>
          <Switch
            value={auto}
            onValueChange={setAuto}
            trackColor={{ true: colors.pink }}
          />
        </View>
      </View>
      <Modal visible={episodePicker} transparent animationType="slide" onRequestClose={() => setEpisodePicker(false)}>
        <View style={{ flex: 1, backgroundColor: "#000a", justifyContent: "flex-end", alignItems: "center" }}>
          <View style={[styles.card, { width: "100%", maxWidth: 640, maxHeight: "80%", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={styles.h2}>Bölümler · {sequence.length}</Text>
              <Button secondary small icon="close" onPress={() => setEpisodePicker(false)}>Kapat</Button></View>
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {sequence.map((item) => <Pressable key={item.id} onPress={() => { setEpisodePicker(false); onEpisode(item); }}
                style={[styles.row, { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: item.id === episode.id ? colors.pink : colors.line,
                  backgroundColor: item.id === episode.id ? "#482039" : "#181021", gap: 14 }]}>
                <Text style={{ color: colors.pink, fontWeight: "900", fontSize: 22, width: 34 }}>{String(item.number).padStart(2, "0")}</Text>
                <View style={{ flex: 1, gap: 3 }}><Text style={styles.label}>{item.title}</Text>
                  <Text style={[styles.body, { fontSize: 11 }]}>{item.id === episode.id ? "Şimdi izleniyor · " : ""}{accessLabel(item, store.language, Platform.OS === "android")}</Text></View>
                <Icon name={clientCanWatch(item, new Set(store.unlocks), store.vip) ? "play-circle-outline" : "lock-closed-outline"} color={colors.pink} />
              </Pressable>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Text style={styles.body}>{episode.description}</Text>
      <Modal visible={confirmCoins && !allowed} transparent animationType="fade" onRequestClose={() => { if (!unlockBusy) setConfirmCoins(false); }}>
        <View style={{ flex: 1, padding: 24, backgroundColor: "#06030ce8", alignItems: "center", justifyContent: "center" }}>
          <LinearGradient colors={["#483022", "#281637", "#161022"]} style={{ width: "100%", maxWidth: 460, padding: 26, borderRadius: 28, borderWidth: 1, borderColor: "#ffc56f80", gap: 20 }}>
            <Icon name="dbs-coin" size={48} color="#ffc56f" />
            <Text style={styles.h2}>BornCoins kullanılsın mı?</Text>
            <Text style={[styles.body, { color: "#ebdcec", fontSize: 16, lineHeight: 25 }]}>{episode.title} bölümünü izlemek için {episode.coin_price} BornCoins kullanmak ister misin?</Text>
            <View style={{ backgroundColor: "#ffd58c15", padding: 16, borderRadius: 16, gap: 8 }}><Text style={[styles.label, { color: "#ffd58c" }]}>Bölüm ücreti: {episode.coin_price} BornCoins</Text><Text style={styles.body}>Bakiyen: {store.balance} · İşlem sonrası: {Math.max(0, store.balance - episode.coin_price)}</Text></View>
            {store.balance < episode.coin_price ? <><Text style={styles.body}>Bu bölüm için bakiyen yeterli değil.</Text><Button onPress={() => { setConfirmCoins(false); onWallet(); }}>Cüzdanımı aç</Button></> : <Button disabled={unlockBusy} icon="lock-open-outline" onPress={() => { void run(async () => { setUnlockBusy(true); try { await rpc("dbs_unlock_episode", { episode: episode.id }); setConfirmCoins(false); await store.refreshAccount(); } finally { setUnlockBusy(false); } }, "Bölüm hesabına kalıcı olarak açıldı."); }}>{unlockBusy ? "Bölüm açılıyor…" : `Evet, ${episode.coin_price} BornCoins kullan`}</Button>}
            <Button secondary disabled={unlockBusy} onPress={() => setConfirmCoins(false)}>Vazgeç</Button>
          </LinearGradient>
        </View>
      </Modal>
      <Button small secondary icon="flag-outline" onPress={onReport}>
        Video sorunu bildir
      </Button>
    </View>
  );
}
