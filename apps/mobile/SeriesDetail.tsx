import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Share,
  Linking,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { db, requireData } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import type { Series, Episode } from "../../packages/types";
import VideoPlayer from "../../packages/ui/VideoPlayer";
import { Artwork } from "../../packages/ui/Catalog";
import {
  Button,
  Chip,
  Field,
  Empty,
  Icon,
  colors,
  styles,
} from "../../packages/ui/theme";
import {
  accessLabel,
  clientCanWatch,
  formatTime,
} from "../../packages/shared/domain";
import { translations } from "../../packages/shared/i18n";
import { config } from "../../packages/shared/config";
export default function SeriesDetail({
  series,
  store,
  onEpisode,
  run,
  onLogin,
}: {
  series: Series;
  store: Store;
  onEpisode: (ep: Episode) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onLogin: () => void;
}) {
  const { width } = useWindowDimensions(),
    compact = width < 700,
    t = translations(store.language),
    [trailer, setTrailer] = useState(false),
    [tab, setTab] = useState("episodes"),
    [comment, setComment] = useState(""),
    [spoiler, setSpoiler] = useState(false),
    [comments, setComments] = useState<any[]>([]),
    [stars, setStars] = useState(0);
  const episodes = store.episodes.filter((e) => e.series_id === series.id),
    progress = store.progress.find(
      (p) => episodes.some((e) => e.id === p.episode_id) && !p.completed,
    ),
    resume = episodes.find((e) => e.id === progress?.episode_id) || episodes[0];
  useEffect(() => {
    if (store.session)
      requireData(
        db
          .from("dbs_comments")
          .select("*")
          .eq("series_id", series.id)
          .order("created_at", { ascending: false })
          .limit(50),
      )
        .then(setComments)
        .catch(() => {});
  }, [series.id, store.session]);
  const favorite = () =>
    store.session ? run(() => store.toggleFavorite(series.id)) : onLogin();
  return (
    <View style={{ gap: 26 }}>
      <View
        style={{
          height: compact ? 460 : 410,
          borderRadius: 22,
          overflow: "hidden",
        }}
      >
        <Artwork series={series} hero />
        <LinearGradient
          colors={["transparent", "#09080fff"]}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            position: "absolute",
            left: compact ? 24 : 36,
            right: 24,
            bottom: 28,
            gap: 14,
          }}
        >
          <Text style={styles.eyebrow}>
            {series.source_credit?.creator
              ? episodes[0]?.orientation === "landscape" ? "LİSANSLI FİLM · TAM FİLM" : "LİSANSLI FİLM · DİKEY UYARLAMA"
              : series.is_demo ? "DİKEY TEST KOLEKSİYONU" : "DRABORNSERIES"}
          </Text>
          <Text style={[styles.h1, { fontSize: compact ? 42 : 58 }]}>
            {series.title}
          </Text>
          <Text style={styles.body}>
            {series.production_year} · {series.genres.join(" / ")} ·{" "}
            {series.age_rating}
          </Text>
          <View style={styles.wrap}>
            {resume && (
              <Button icon="play" onPress={() => onEpisode(resume)}>
                {progress
                  ? `${t.continue} · ${formatTime(progress.position_seconds)}`
                  : t.play}
              </Button>
            )}
            {!!series.trailer_url && series.trailer_url.startsWith("https://") && (
              <Button secondary icon="videocam-outline" onPress={() => setTrailer(true)}>
                Fragmanı izle
              </Button>
            )}
            <Button
              secondary
              icon={store.favorites.includes(series.id) ? "checkmark" : "add"}
              onPress={favorite}
            >
              {store.favorites.includes(series.id) ? t.added : t.add}
            </Button>
            <Button
              secondary
              icon="share-social-outline"
              onPress={() =>
                run(() =>
                  Share.share({
                    message: `${series.title} — DraBornSeries\n${config.webUrl}?series=${series.slug}`,
                  }),
                )
              }
            >
              {t.share}
            </Button>
          </View>
        </View>
      </View>
      <Modal visible={trailer} transparent animationType="slide" onRequestClose={() => setTrailer(false)}>
        <View style={{ flex: 1, backgroundColor: "#000c", justifyContent: "center", padding: 14 }}>
          <View style={[styles.card, { width: "100%", maxWidth: 650, maxHeight: "92%", alignSelf: "center", padding: 14, gap: 12 }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={[styles.h3, { flex: 1 }]}>{series.title} · Fragman</Text>
              <Button secondary small icon="close" onPress={() => setTrailer(false)}>Kapat</Button></View>
            <ScrollView>{trailer && series.trailer_url && <VideoPlayer
              source={{ url: series.trailer_url, provider: series.is_demo ? "demo" : "cloudflare", subtitles: [] }}
              title={series.title + " · Fragman"} portrait initialTime={0} onProgress={() => {}} onEnd={() => {}} />}</ScrollView>
          </View>
        </View>
      </Modal>
      <Text style={[styles.body, { maxWidth: 900 }]}>
        {store.language === "en" && series.description_en
          ? series.description_en
          : series.description}
      </Text>
      {!!series.source_credit?.creator && <View style={[styles.card, { gap: 9, padding: 18, marginTop: 12 }]}>
        <Text style={styles.h3}>Film kaynağı ve lisans</Text>
        <Text style={styles.body}>{series.source_credit.creator} · {series.source_credit.license}</Text>
        <Text style={[styles.body, { fontSize: 12 }]}>{series.source_credit.modifications}</Text>
        <View style={styles.wrap}>
          <Button secondary small icon="open-outline" onPress={() => Linking.openURL(series.source_credit!.source_url)}>Özgün film ve yapım ekibi</Button>
          <Button secondary small icon="document-text-outline" onPress={() => Linking.openURL(series.source_credit!.license_url)}>Lisansı incele</Button>
        </View>
      </View>}
      <View style={styles.wrap}>
        {series.genres.map((g) => (
          <Chip key={g} label={g} />
        ))}
        <Chip label={series.country} />
        <Chip label={series.language.toUpperCase()} />
        {series.license && <Chip label={series.source_credit?.license || series.license} color={colors.mint} />}
      </View>
      <View
        style={[
          styles.row,
          { borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 15 },
        ]}
      >
        {[
          ["episodes", t.episodes],
          ["about", t.about],
          ["comments", t.comments],
        ].map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            active={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>
      {tab === "episodes" &&
        (episodes.length ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h3}>
              {t.episodes} · {episodes.length}
            </Text>
            {episodes.map((ep) => {
              const watched = store.progress.find(
                  (p) => p.episode_id === ep.id,
                ),
                allowed = clientCanWatch(ep, new Set(store.unlocks), store.vip);
              return (
                <Pressable
                  key={ep.id}
                  accessibilityRole="button"
                  onPress={() => onEpisode(ep)}
                  style={[
                    styles.card,
                    styles.row,
                    { padding: 16, justifyContent: "space-between" },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: allowed ? "#b980ff1a" : "#f143a112",
                      width: 52,
                      height: 58,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: allowed ? colors.purple : colors.pink,
                        fontSize: 23,
                        fontWeight: "900",
                      }}
                    >
                      {String(ep.number).padStart(2, "0")}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.h3}>{ep.title}</Text>
                    <Text style={styles.body}>
                      {formatTime(ep.duration_seconds)} ·{" "}
                      {accessLabel(ep, store.language)}
                      {watched?.completed ? "  ✓" : ""}
                    </Text>
                    {watched && (
                      <View
                        style={{
                          height: 3,
                          backgroundColor: colors.line,
                          borderRadius: 3,
                        }}
                      >
                        <View
                          style={{
                            height: 3,
                            width: `${Math.min(100, (watched.position_seconds / watched.duration_seconds) * 100)}%`,
                            backgroundColor: colors.pink,
                          }}
                        />
                      </View>
                    )}
                  </View>
                  <Icon
                    name={allowed ? "play-circle" : "lock-closed-outline"}
                    color={allowed ? colors.pink : colors.muted}
                    size={26}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Empty
            title={t.coming}
            detail="Bu özgün konseptin bölümleri henüz yayınlanmadı. Listene ekleyerek takip edebilirsin."
            icon="time-outline"
          />
        ))}
      {tab === "about" && (
        <View style={styles.card}>
          <Text style={styles.h3}>{series.title}</Text>
          <Text style={styles.body}>
            {series.director
              ? `Yönetmen: ${series.director}`
              : "Yapım bilgileri yayınlandığında burada yer alacak."}
          </Text>
          {series.cast_names.length > 0 && (
            <Text style={styles.body}>{series.cast_names.join(", ")}</Text>
          )}
          {series.license && <Text style={styles.body}>{series.license}</Text>}
          <Text style={styles.body}>
            Dil: {series.language} · Sezon: {series.total_seasons}
          </Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  if (!store.session) {
                    onLogin();
                    return;
                  }
                  run(async () => {
                    await requireData(
                      db
                        .from("dbs_ratings")
                        .upsert({
                          user_id: store.session!.user.id,
                          series_id: series.id,
                          value,
                        }),
                    );
                    setStars(value);
                  }, "Puanın kaydedildi.");
                }}
                accessibilityLabel={`${value} yıldız`}
              >
                <Icon
                  name={value <= stars ? "star" : "star-outline"}
                  color={colors.orange}
                  size={27}
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {tab === "comments" && (
        <View style={{ gap: 15 }}>
          {store.session ? (
            <View style={styles.card}>
              <Field
                value={comment}
                onChangeText={setComment}
                placeholder="Hikâye hakkında ne düşünüyorsun?"
                multiline
                maxLength={1000}
              />
              <Chip
                label={spoiler ? "Spoiler işaretli" : "Spoiler içeriyor"}
                active={spoiler}
                onPress={() => setSpoiler(!spoiler)}
              />
              <Button
                onPress={() =>
                  run(async () => {
                    if (!comment.trim()) throw Error("Önce yorumunu yaz.");
                    await requireData(
                      db
                        .from("dbs_comments")
                        .insert({
                          user_id: store.session!.user.id,
                          series_id: series.id,
                          body: comment.trim(),
                          spoiler,
                        }),
                    );
                    setComment("");
                  }, "Yorumun incelemeye gönderildi.")
                }
              >
                Yorumu gönder
              </Button>
              <Text style={styles.body}>
                Yorumlar yayınlanmadan önce moderasyon incelemesinden geçer.
              </Text>
            </View>
          ) : (
            <Button onPress={onLogin}>{t.login}</Button>
          )}
          {comments.map((c) => (
            <Comment
              key={c.id}
              comment={c}
              own={c.user_id === store.session?.user.id}
              remove={() =>
                run(async () => {
                  await requireData(
                    db.from("dbs_comments").delete().eq("id", c.id),
                  );
                  setComments(comments.filter((v) => v.id !== c.id));
                })
              }
              report={() =>
                run(async () => {
                  await requireData(
                    db
                      .from("dbs_comment_reports")
                      .insert({
                        user_id: store.session!.user.id,
                        comment_id: c.id,
                        body: "Kullanıcı şikayeti",
                      }),
                  );
                }, "Şikayetin alındı.")
              }
              like={() =>
                run(async () => {
                  await requireData(
                    db
                      .from("dbs_comment_likes")
                      .upsert({
                        user_id: store.session!.user.id,
                        comment_id: c.id,
                      }),
                  );
                }, "Beğenildi.")
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}
function Comment({
  comment,
  own,
  remove,
  report,
  like,
}: {
  comment: any;
  own: boolean;
  remove: () => void;
  report: () => void;
  like: () => void;
}) {
  const [reveal, setReveal] = useState(!comment.spoiler);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        {own ? "Sen" : "İzleyici"} ·{" "}
        {new Date(comment.created_at).toLocaleDateString("tr-TR")}
        {comment.status === "pending" ? " · İncelemede" : ""}
      </Text>
      {reveal ? (
        <Text style={styles.body}>{comment.body}</Text>
      ) : (
        <Button small secondary onPress={() => setReveal(true)}>
          Spoiler · Göster
        </Button>
      )}
      <View style={styles.row}>
        <Button small secondary onPress={like} icon="heart-outline">
          Beğen
        </Button>
        <Button small secondary onPress={own ? remove : report}>
          {own ? "Sil" : "Şikayet et"}
        </Button>
      </View>
    </View>
  );
}
