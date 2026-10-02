import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Share,
  Platform,
  Linking,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api, db, requireData } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import type { Series, Episode, Playback } from "../../packages/types";
import { DetailAction, DetailTabs, InfoBadge } from "../../packages/ui/DetailControls";
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
import { seriesPath } from "../../packages/shared/routes";
import { config } from "../../packages/shared/config";
import { legalContact } from "../../packages/shared/legal";
export default function SeriesDetail({
  series,
  store,
  onEpisode,
  run,
  onLogin,
  onRules,
}: {
  series: Series;
  store: Store;
  onEpisode: (ep: Episode) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onLogin: () => void;
  onRules: () => void;
}) {
  const { width } = useWindowDimensions(),
    compact = width < 700,
    t = translations(store.language),
    [trailer, setTrailer] = useState(false),
    [tab, setTab] = useState("episodes"),
    [comment, setComment] = useState(""),
    [spoiler, setSpoiler] = useState(false),
    [comments, setComments] = useState<any[]>([]),
    [stars, setStars] = useState(0),
    [trailerSource, setTrailerSource] = useState<Playback & { orientation?: string }>(),
    [trailerError, setTrailerError] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const blockedUsers: string[] = Array.isArray(store.profile?.preferences?.blocked_user_ids)
    ? store.profile.preferences.blocked_user_ids.filter((id): id is string => typeof id === "string") : [];
  const episodes = store.episodes.filter((e) => e.series_id === series.id).sort((a, b) => a.number - b.number),
    progress = store.progress.find(
      (p) => episodes.some((e) => e.id === p.episode_id) && !p.completed,
    ),
    resume = episodes.find((e) => e.id === progress?.episode_id) || episodes[0];
  useEffect(() => {
    let live = true;
    setComments([]);
    if (store.session)
      requireData(
        db
          .from("dbs_comments")
          .select("*")
          .eq("series_id", series.id)
          .order("created_at", { ascending: false })
          .limit(50),
      )
        .then((rows) => { if (live) setComments(rows); })
        .catch(() => {});
    return () => { live = false; };
  }, [series.id, store.session]);
  useEffect(() => {
    let live = true;
    setTrailerSource(undefined); setTrailerError("");
    if (trailer) api<Playback & { orientation: string }>("trailer", { series: series.id })
      .then((source) => { if (live) setTrailerSource(source); })
      .catch(() => { if (live) setTrailerError("Fragman yüklenemedi. Bağlantını kontrol ederek tekrar dene."); });
    return () => { live = false; };
  }, [trailer, series.id]);
  const favorite = () =>
    store.session ? run(() => store.toggleFavorite(series.id)) : onLogin();
  return (
    <View style={{ gap: 26 }}>
      <View
        style={{
          minHeight: compact ? 510 : 430,
          justifyContent: "flex-end",
          borderRadius: 26,
          borderWidth: 1,
          borderColor: "#bc74de40",
          overflow: "hidden",
        }}
      >
        <Artwork series={series} hero />
        <LinearGradient
          colors={["#10081b10", "#160b2560", "#0e0718fc"]}
          locations={[0, 0.38, 1]}
          style={{ position: "absolute", inset: 0 }}
        />
        <View style={{ position: "absolute", top: 18, right: 18, left: 18, flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
          <InfoBadge label={`${episodes.length} bölüm`} icon="albums-outline" color="#ffc56f" />
          <InfoBadge label={`${(series.view_count || 0).toLocaleString("tr-TR")} izlenme`} icon="eye-outline" color="#7aeadb" />
        </View>
        <View
          style={{
            paddingHorizontal: compact ? 22 : 36,
            paddingTop: compact ? 110 : 90,
            paddingBottom: 28,
            gap: 14,
          }}
        >
          <Text style={styles.eyebrow}>
            {series.source_credit?.creator
              ? episodes[0]?.orientation === "landscape" ? "LİSANSLI FİLM · TAM FİLM" : "LİSANSLI FİLM · DİKEY UYARLAMA"
              : series.is_demo ? "DİKEY TEST KOLEKSİYONU" : "DRABORNSERIES"}
          </Text>
          <Text style={[styles.h1, { fontSize: compact ? 36 : 56 }]}>
            {series.title}
          </Text>
          <View style={styles.wrap}>
            {!!series.production_year && <InfoBadge label={String(series.production_year)} icon="calendar-outline" color={colors.orange} />}
            <InfoBadge label={series.age_rating} icon="shield-checkmark-outline" color={colors.mint} />
            <InfoBadge label={`${(series.like_count || 0).toLocaleString("tr-TR")} beğeni`} icon="heart-outline" color={colors.pink} />
          </View>
          {resume && <View style={{ width: "100%", maxWidth: 440 }}><DetailAction primary icon="play" onPress={() => onEpisode(resume)}
            label={progress ? `${t.continue} · ${formatTime(progress.position_seconds)}` : t.play} /></View>}
          <View style={[styles.wrap, { maxWidth: 560 }]}>
            {!!series.trailer_url && series.trailer_url.startsWith("https://") && (
              <DetailAction icon="videocam-outline" color={colors.orange} onPress={() => setTrailer(true)} label="Fragmanı izle" />
            )}
            <DetailAction icon={store.favorites.includes(series.id) ? "checkmark" : "bookmark-outline"}
              color={colors.purple} onPress={favorite} label={store.favorites.includes(series.id) ? t.added : t.add} />
            <DetailAction
              label={t.share} color={colors.mint}
              icon="share-social-outline"
              onPress={() =>
                run(() =>
                  Share.share({
                    message: `${series.title} — DraBornSeries\n${new URL(seriesPath(series.slug), config.webUrl).href}`,
                  }),
                )
              }
            />
          </View>
        </View>
      </View>
      <Modal visible={trailer} transparent animationType="slide" supportedOrientations={series.video_orientation === "landscape" || trailerSource?.orientation === "landscape" ? ["portrait", "landscape-left", "landscape-right"] : ["portrait"]} onRequestClose={() => setTrailer(false)}>
        <View style={{ flex: 1, backgroundColor: "#000c", justifyContent: "center", padding: 14 }}>
          <View style={[styles.card, { width: "100%", maxWidth: 650, maxHeight: "92%", alignSelf: "center", padding: 14, gap: 12 }]}>
            <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={[styles.h3, { flex: 1 }]}>{series.title} · Fragman</Text>
              <Button secondary small icon="close" onPress={() => setTrailer(false)}>Kapat</Button></View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              {trailerSource ? <VideoPlayer key={series.id + "-trailer"} source={trailerSource} onRefreshSource={() => api<Playback>("trailer", { series: series.id })}
                title={series.title + " · Fragman"} portrait={trailerSource.orientation !== "landscape"} initialTime={0} onProgress={() => {}} onEnd={() => {}} />
                : <Text style={[styles.body, { padding: 24 }]}>{trailerError || "Fragman hazırlanıyor…"}</Text>}
              {!!trailerError && <Button secondary onPress={() => { setTrailer(false); }}>Kapat</Button>}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <LinearGradient colors={["#24142f", "#14111f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor: "#be6bda35", padding: 24 }]}>
        <View style={styles.row}><Icon name="sparkles-outline" color={colors.pink} /><Text style={styles.h3}>Hikâyenin içinde</Text></View>
        <Text style={[styles.body, { maxWidth: 900, color: "#d9cfdf", fontSize: 15, lineHeight: 26 }]}>
        {store.language === "en" && series.description_en
          ? series.description_en
          : series.description}
        </Text>
      </LinearGradient>
      {!!series.source_credit?.creator && <LinearGradient colors={["#142b2c", "#151322"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { gap: 12, padding: 22, borderColor: "#73e1cd35" }]}>
        <View style={styles.row}><Icon name="shield-checkmark-outline" color={colors.mint} /><Text style={styles.h3}>Film kaynağı ve lisans</Text></View>
        <Text style={styles.body}>{series.source_credit.creator} · {series.source_credit.license}</Text>
        <Text style={[styles.body, { fontSize: 12 }]}>{series.source_credit.modifications}</Text>
        <View style={styles.wrap}>
          <DetailAction icon="open-outline" color={colors.mint} label="Özgün film ve yapım ekibi" onPress={() => { void Linking.openURL(series.source_credit!.source_url); }} />
          <DetailAction icon="document-text-outline" color={colors.purple} label="Lisansı incele" onPress={() => { void Linking.openURL(series.source_credit!.license_url); }} />
        </View>
      </LinearGradient>}
      <View style={styles.wrap}>
        {series.genres.map((g, index) => (
          <InfoBadge key={g} label={g} icon="pricetag-outline" color={[colors.pink, colors.purple, colors.orange, colors.mint][index % 4]} />
        ))}
        <InfoBadge label={series.country} icon="earth-outline" color={colors.purple} />
        <InfoBadge label={series.language.toUpperCase()} icon="language-outline" color={colors.orange} />
        {series.license && <InfoBadge icon="ribbon-outline" label={series.source_credit?.license || series.license} color={colors.mint} />}
      </View>
      <DetailTabs value={tab} onChange={setTab} items={[
        { key: "episodes", label: t.episodes, icon: "albums-outline", color: colors.pink },
        { key: "about", label: t.about, icon: "information-circle-outline", color: colors.purple },
        { key: "comments", label: t.comments, icon: "chatbubbles-outline", color: colors.mint },
      ]} />
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
                    { padding: 16, justifyContent: "space-between", borderColor: allowed ? "#a58aff35" : "#f143a135", backgroundColor: "#181122" },
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
                      {accessLabel(ep, store.language, Platform.OS === "android")}
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
            <View style={[styles.card, { borderColor: "#73e1cd40", backgroundColor: "#131b22" }]}>
              <View style={styles.row}><Icon name="chatbubbles-outline" color={colors.mint} /><Text style={styles.h3}>Sohbete katıl</Text></View>
              {store.profile?.preferences?.community_terms_version !== legalContact.version && <View style={{ gap: 8 }}>
                <Button secondary small icon="document-text-outline" onPress={onRules}>Topluluk kurallarını oku</Button>
                <Pressable accessibilityRole="checkbox" accessibilityLabel="Topluluk kurallarını kabul ediyorum"
                  accessibilityState={{ checked: rulesAccepted }} onPress={() => setRulesAccepted(!rulesAccepted)} style={styles.row}>
                  <Icon name={rulesAccepted ? "checkbox" : "square-outline"} color={colors.mint} />
                  <Text style={[styles.body, { flex: 1, fontSize: 12 }]}>Topluluk kurallarını kabul ediyorum.</Text>
                </Pressable>
              </View>}
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
                    if (store.profile?.preferences?.community_terms_version !== legalContact.version) {
                      if (!rulesAccepted) throw Error("Yorum paylaşmadan önce topluluk kurallarını kabul et.");
                      await requireData(db.from("dbs_profiles").update({ preferences: {
                        ...store.profile?.preferences, community_terms_version: legalContact.version,
                      } }).eq("user_id", store.session!.user.id));
                    }
                    const created = await requireData(
                      db
                        .from("dbs_comments")
                        .insert({
                          user_id: store.session!.user.id,
                          series_id: series.id,
                          body: comment.trim(),
                          spoiler,
                        }).select("*").single(),
                    );
                    setComments((rows) => [created, ...rows]);
                    setComment("");
                    await store.refreshAccount();
                  }, "Yorumun yayınlandı.")
                }
              >
                Yorumu gönder
              </Button>
              <Text style={[styles.body, { fontSize: 12 }]}>
                Yorumun hemen yayınlanır. Topluluk kurallarına uymayan yorumlar bildirim üzerine incelenebilir ve gizlenebilir.
              </Text>
            </View>
          ) : (
            <Button onPress={onLogin}>{t.login}</Button>
          )}
          {comments.filter((c) => !blockedUsers.includes(c.user_id)).map((c) => (
            <Comment
              key={c.id}
              comment={c}
              own={c.user_id === store.session?.user.id}
              block={() => {
                if (!store.session) { onLogin(); return; }
                void run(async () => {
                  await requireData(db.from("dbs_profiles").update({ preferences: {
                    ...store.profile?.preferences, blocked_user_ids: [...new Set([...blockedUsers, c.user_id])],
                  } }).eq("user_id", store.session!.user.id));
                  await store.refreshAccount();
                }, "Bu kullanıcının yorumları gizlendi.");
              }}
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
  block,
}: {
  comment: any;
  own: boolean;
  remove: () => void;
  report: () => void;
  like: () => void;
  block: () => void;
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
      <View style={styles.wrap}>
        <Button small secondary onPress={like} icon="heart-outline">
          Beğen
        </Button>
        <Button small secondary onPress={own ? remove : report}>
          {own ? "Sil" : "Şikayet et"}
        </Button>
        {!own && <Button small secondary icon="person-remove-outline" onPress={block}>Kullanıcıyı engelle</Button>}
      </View>
    </View>
  );
}
