import React, { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Pressable, Text, View, Switch } from "react-native";
import type { Store } from "../../packages/api/store";
import type { Episode, Playback } from "../../packages/types";
import { api, rpc } from "../../packages/api/client";
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
}: {
  episode: Episode;
  store: Store;
  onEpisode: (ep: Episode) => void;
  onLogin: () => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onReport: () => void;
}) {
  const [episodePicker, setEpisodePicker] = useState(false);
  const [source, setSource] = useState<Playback | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [auto, setAuto] = useState(true);
  const allowed = clientCanWatch(episode, new Set(store.unlocks), store.vip),
    progress = store.progress.find((p) => p.episode_id === episode.id);
  const [initialTime] = useState(
    progress?.completed ? 0 : progress?.position_seconds || 0,
  );
  const autoAttempted = useRef(false);
  useEffect(() => {
    if (
      !allowed &&
      !autoAttempted.current &&
      store.session &&
      store.profile?.preferences?.auto_unlock === true &&
      ["coins", "vip_or_coins"].includes(episode.access_type) &&
      store.balance >= episode.coin_price
    ) {
      autoAttempted.current = true;
      run(async () => {
        await rpc("dbs_unlock_episode", { episode: episode.id });
        await store.refreshAccount();
      }, `${episode.coin_price} BornCoins kullanılarak bölüm açıldı.`);
    }
  }, [allowed, episode, store, run]);
  const sequence = store.episodes.filter(
      (e) => e.series_id === episode.series_id,
    ).sort((a, b) => a.number - b.number),
    position = sequence.findIndex((e) => e.id === episode.id),
    next = sequence[position + 1],
    previous = sequence[position - 1];
  useEffect(() => {
    let live = true;
    setSource(null);
    setError("");
    if (allowed)
      api<Playback>("playback", { episode: episode.id })
        .then((value) => {
          if (live) setSource(value);
        })
        .catch((err) => {
          if (live) setError(readableError(err));
        });
    return () => {
      live = false;
    };
  }, [episode.id, allowed, retry]);
  return (
    <View style={{ gap: 24 }}>
      <View>
        <Text style={styles.eyebrow}>DRABORNSERIES PLAYER</Text>
        <Text style={[styles.h2, { marginTop: 10 }]}>{episode.title}</Text>
      </View>
      {!allowed ? (
        <Empty
          icon="lock-closed-outline"
          title="Bu hikâyenin devamını aç"
          detail={`${accessLabel(episode)} · Bakiye: ${store.balance} BornCoins`}
        >
          {!store.session ? (
            <Button onPress={onLogin}>Giriş yap</Button>
          ) : (
            <View style={{ gap: 12, alignItems: "center" }}>
              {["coins", "vip_or_coins"].includes(episode.access_type) && (
                <Button
                  onPress={() =>
                    run(async () => {
                      await rpc("dbs_unlock_episode", { episode: episode.id });
                      await store.refreshAccount();
                    }, "Bölüm hesabına kalıcı olarak açıldı.")
                  }
                >
                  {episode.coin_price} BornCoins ile aç
                </Button>
              )}
              {episode.access_type === "vip" && (
                <Text style={styles.body}>
                  Bu bölüm DraBornSeries VIP üyelerine özeldir.
                </Text>
              )}
              {episode.access_type === "ad" && (
                <AdRewardButton store={store} run={run} onLogin={onLogin} episode={episode.id} onDone={() => setRetry(value => value + 1)} />
              )}
            </View>
          )}
        </Empty>
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
          title={episode.title}
          initialTime={initialTime}
          portrait={episode.orientation !== "landscape"}
          onProgress={(seconds) => {
            saveProgress(episode.id, seconds).catch(() => {});
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
                  <Text style={[styles.body, { fontSize: 11 }]}>{item.id === episode.id ? "Şimdi izleniyor · " : ""}{accessLabel(item)}</Text></View>
                <Icon name={clientCanWatch(item, new Set(store.unlocks), store.vip) ? "play-circle-outline" : "lock-closed-outline"} color={colors.pink} />
              </Pressable>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Text style={styles.body}>{episode.description}</Text>
      <Button small secondary icon="flag-outline" onPress={onReport}>
        Video sorunu bildir
      </Button>
    </View>
  );
}
