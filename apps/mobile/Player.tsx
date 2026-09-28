import React, { useEffect, useState } from "react";
import { Text, View, Switch } from "react-native";
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
import {
  Button,
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
  const [source, setSource] = useState<Playback | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [auto, setAuto] = useState(true);
  const allowed = clientCanWatch(episode, new Set(store.unlocks), store.vip),
    progress = store.progress.find((p) => p.episode_id === episode.id);
  const [initialTime] = useState(
    progress?.completed ? 0 : progress?.position_seconds || 0,
  );
  const sequence = store.episodes.filter(
      (e) => e.series_id === episode.series_id,
    ),
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
                <Text style={styles.body}>
                  Ödüllü reklamlar Expo Go test sürümünde kullanılamaz.
                </Text>
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
          initialTime={initialTime}
          portrait={episode.orientation === "portrait"}
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
      <Text style={styles.body}>{episode.description}</Text>
      <Button small secondary icon="flag-outline" onPress={onReport}>
        Video sorunu bildir
      </Button>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
        Test filmleri açık lisanslıdır. Üretim videolarının adresleri erişim
        kontrolünden sonra kısa süreli olarak oluşturulur.
      </Text>
    </View>
  );
}
