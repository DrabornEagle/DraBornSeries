import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  Share,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Store } from "../../packages/api/store";
import type { Episode, Series } from "../../packages/types";
import { usePreviewSource } from "../../packages/api/preview";
import InlineVideo from "../../packages/ui/InlineVideo";
import { Artwork } from "../../packages/ui/Catalog";
import { Button, Icon, colors, Empty } from "../../packages/ui/theme";
import { seriesPath } from "../../packages/shared/routes";
import { config } from "../../packages/shared/config";
import { buildDiscoverEntries } from "../../packages/shared/discover";
import { compactCount } from "../../packages/shared/domain";
type Entry = { episode: Episode; series: Series };
function Scene({
  item,
  active,
  height,
  onWatch,
  onSeries,
  onLike,
  favorite,
  muted,
  onMute,
}: {
  item: Entry;
  active: boolean;
  height: number;
  onWatch: () => void;
  onSeries: () => void;
  onLike: () => void;
  favorite: boolean;
  muted: boolean;
  onMute: () => void;
}) {
  const source = usePreviewSource(item.episode.id, active), url = source?.url,
    [paused, setPaused] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (active) { setReady(false); setFailed(false); setPaused(false); }
  }, [active, url]);
  return (
    <View style={{ height, alignItems: "center", backgroundColor: "#08060f" }}>
      <View
        style={{
          height,
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
          backgroundColor: "#1a1323",
        }}
      >
        <Artwork series={item.series} />
        {active && url && !failed && (
          <InlineVideo
            key={retry}
            url={url}
            active={!paused}
            muted={muted}
            startFromMiddle
            subtitles={source?.subtitles}
            poster={item.series.poster_url}
            onReady={() => {
              setReady(true);
              setFailed(false);
            }}
            onError={() => setFailed(true)}
            onAutoplayBlocked={() => setPaused(true)}
          />
        )}
        <Pressable
          accessibilityLabel={paused ? "Videoyu oynat" : "Videoyu duraklat"}
          onPress={() => { if (failed) { setFailed(false); setReady(false); setRetry((value) => value + 1); } else setPaused(!paused); }}
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {paused ? (
            <View
              style={{
                padding: 20,
                borderRadius: 60,
                backgroundColor: "#00000045",
              }}
            >
              <Icon name="play" size={44} />
            </View>
          ) : active && !ready && !failed ? (
            <ActivityIndicator color="#fff" />
          ) : failed ? (
            <Text
              style={{
                color: "#fff",
                fontSize: 12,
                backgroundColor: "#2a1a2bd9",
                padding: 9,
                borderRadius: 9,
              }}
            >
              Yeniden oynatmak için dokun
            </Text>
          ) : null}
        </Pressable>
        <LinearGradient
          pointerEvents="none"
          colors={["#09061499", "transparent", "transparent", "#090610fa"]}
          locations={[0, 0.23, 0.5, 1]}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            top: 22,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
              Senin için
            </Text>
            <Text style={{ color: "#ffffff95", fontSize: 11, marginTop: 5 }}>
              Keşfet · Tüm hikâyeler
            </Text>
          </View>
          <Pressable
            accessibilityLabel={muted ? "Sesi aç" : "Sessize al"}
            onPress={onMute}
            style={{
              backgroundColor: "#00000060",
              padding: 11,
              borderRadius: 30,
            }}
          >
            <Icon name={muted ? "volume-mute" : "volume-high"} size={21} />
          </Pressable>
        </View>
        <View
          style={{
            position: "absolute",
            right: 16,
            bottom: 196,
            gap: 22,
            alignItems: "center",
          }}
        >
          <Pressable
            accessibilityLabel="Listeme ekle"
            onPress={onLike}
            style={{ alignItems: "center", gap: 6 }}
          >
            <Icon
              name={favorite ? "heart" : "heart-outline"}
              size={32}
              color={favorite ? colors.pink : "#fff"}
            />
            <Text style={{ color: "#fff", fontSize: 10 }}>Listem</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Bölüm listesi"
            onPress={onSeries}
            style={{ alignItems: "center", gap: 6 }}
          >
            <Icon name="albums-outline" size={30} />
            <Text style={{ color: "#fff", fontSize: 10 }}>Bölümler</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Diziyi paylaş"
            onPress={() =>
              Share.share({
                message: new URL(seriesPath(item.series.slug), config.webUrl).href,
              })
            }
          >
            <Icon name="paper-plane-outline" size={29} />
          </Pressable>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 25,
            left: 22,
            right: 22,
            gap: 10,
          }}
        >
          <Text
            style={{
              color: colors.orange,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 2,
            }}
          >
            BÖLÜM {item.episode.number} · {compactCount(item.series.view_count)} izlenme · {compactCount(item.series.like_count)} beğeni
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: "#fff",
              fontSize: 31,
              fontWeight: "900",
              letterSpacing: -1,
              marginRight: 40,
            }}
          >
            {item.series.title}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: "#efe4f0",
              fontSize: 13,
              lineHeight: 20,
              marginRight: 35,
            }}
          >
            {item.series.short_description}
          </Text>
          <Button
            icon="play"
            onPress={onWatch}
            style={{ alignSelf: "stretch", marginTop: 4 }}
          >
            Tümünü izle · {item.series.total_episodes} bölüm
          </Button>
          <Text style={{ textAlign: "center", color: "#d0bdd3", fontSize: 10 }}>
            Sonraki hikâye için yukarı kaydır ↑
          </Text>
        </View>
      </View>
    </View>
  );
}
export default function Discover({
  store,
  onSeries,
  onEpisode,
  onLogin,
  run,
}: {
  store: Store;
  onSeries: (s: Series) => void;
  onEpisode: (e: Episode) => void;
  onLogin: () => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [height, setHeight] = useState(650),
    [index, setIndex] = useState(0), [muted, setMuted] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 2147483647));
  const items = useMemo(() => buildDiscoverEntries(store.series, store.episodes, seed), [store.series, store.episodes, seed]);
  if (!items.length)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Empty
          title="Hikâyeler hazırlanıyor"
          detail="Yayınlanmış tüm dizi ve filmler burada görünür."
        />
      </View>
    );
  return (
    <View
      style={{ flex: 1, minHeight: 0 }}
      onLayout={(e) =>
        setHeight(Math.max(300, Math.round(e.nativeEvent.layout.height)))
      }
    >
      <FlatList<Entry>
        data={items} keyExtractor={(item) => item.episode.id}
        pagingEnabled snapToInterval={height} decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        onScroll={(event) => setIndex(Math.max(0, Math.min(items.length - 1,
          Math.round(event.nativeEvent.contentOffset.y / height))))}
        scrollEventThrottle={80} initialNumToRender={2} windowSize={3} maxToRenderPerBatch={2}
        renderItem={({ item, index: sceneIndex }) => <Scene item={item}
          active={index === sceneIndex} height={height} muted={muted} onMute={() => setMuted((value) => !value)}
          onSeries={() => onSeries(item.series)}
          onWatch={() => onEpisode(store.episodes.find((e) => e.series_id === item.series.id && e.number === 1) || item.episode)}
          favorite={store.favorites.includes(item.series.id)}
          onLike={() => store.session ? run(() => store.toggleFavorite(item.series.id)) : onLogin()} />}
      />
    </View>
  );
}
