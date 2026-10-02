import React, { useEffect, useState } from "react";
import { Image, Linking, Platform, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { db, requireData, rpc } from "../../packages/api/client";
import type { Store } from "../../packages/api/store";
import type { Page } from "../../packages/types";
import { rewardDays } from "../../packages/shared/domain";
import {
  Button,
  Chip,
  Empty,
  Field,
  Icon,
  colors,
  styles,
} from "../../packages/ui/theme";
import ProfilePhotoPicker from "../../packages/ui/ProfilePhotoPicker";
import { pickProfilePhoto, uploadProfilePhoto, type ProfilePhoto } from "../../packages/api/avatar";
import { config } from "../../packages/shared/config";
import { translations } from "../../packages/shared/i18n";
import { adAvailable, adPrivacyOptions } from "../../packages/api/ads";
import { legalContact } from "../../packages/shared/legal";
type Props = {
  page: Page;
  store: Store;
  go: (page: Page) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
};
export default function Account({ page, store, go, run }: Props) {
  const [visibleSessionCount, setVisibleSessionCount] = useState(5);
  const t = translations(store.language),
    [promo, setPromo] = useState(""),
    [username, setUsername] = useState(store.profile?.username || ""),
    [name, setName] = useState(store.profile?.full_name || ""),
    [photo, setPhoto] = useState<ProfilePhoto | null>(null),
    [avatar, setAvatar] = useState(store.profile?.avatar_url || ""),
    [sessions, setSessions] = useState<any[]>([]),
    [achievements, setAchievements] = useState<any[]>([]),
    [notifications, setNotifications] = useState(true),
    [reportKind, setReportKind] = useState("Video açılmıyor"),
    [reportBody, setReportBody] = useState("");
  useEffect(() => {
    setUsername(store.profile?.username || "");
    setName(store.profile?.full_name || "");
    setAvatar(store.profile?.avatar_url || "");
    if (store.session) {
      requireData(
        db
          .from("dbs_user_sessions")
          .select("*")
          .order("last_seen_at", { ascending: false }),
      )
        .then(setSessions)
        .catch(() => {});
      requireData(
        db.from("dbs_notification_preferences").select("*").maybeSingle(),
      )
        .then((p) => {
          if (p) setNotifications(p.new_episodes);
        })
        .catch(() => {});
    }
    requireData(db.from("dbs_achievements").select("*"))
      .then(setAchievements)
      .catch(() => {});
  }, [store.profile, store.session]);
  if (page === "vip")
    return (
      <View style={{ gap: 26 }}>
        <LinearGradient
          colors={["#36204a", "#211632", "#16101f"]}
          style={[styles.card, { padding: 34, gap: 24 }]}
        >
          <Icon name="diamond" color={colors.orange} size={52} />
          <Text style={styles.eyebrow}>DRABORNSERIES VIP</Text>
          <Text style={styles.h1}>{t.vipTitle}</Text>
          <Text style={styles.body}>{t.vipSubtitle}</Text>
          <View style={styles.wrap}>
            <Chip label={store.vip ? "VIP AKTİF" : "AYLIK ÜYELİK"} active />
            {store.vipEnd && (
              <Chip
                label={new Date(store.vipEnd).toLocaleDateString("tr-TR")}
              />
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>
            DraBornSeries VIP
          </Text>
          <Text style={styles.body}>
            Fiyat, Google Play ürünleri etkinleştirildiğinde mağazadan
            gösterilecek.
          </Text>
          <Button
            secondary
            onPress={() =>
              run(async () => {
                throw Error(
                  Platform.OS === "web"
                    ? "Webde VIP durumunu görebilirsin. Üyelik satışı Google Play yayınıyla açılacak."
                    : "Google Play satın alımları Expo Go içinde çalışmaz. Mağaza yayını ve Android development build gerekiyor.",
                );
              })
            }
          >
            {store.vip ? "Üyeliği yönet" : "Üyelik hakkında"}
          </Button>
        </LinearGradient>
        <View style={styles.wrap}>
          {[
            ...(Platform.OS === "android" ? [["eye-off-outline", "Reklamsız izleme"]] : []),
            ["diamond-outline", "VIP dizi ve bölümler"],
            ["flash-outline", "Yeni bölümlere erken erişim"],
            ["gift-outline", "Aylık BornCoins bonusu"],
          ].map(([icon, label]) => (
            <View key={label} style={[styles.card, { minWidth: 220, flex: 1 }]}>
              <Icon name={icon as any} color={colors.purple} />
              <Text style={styles.h3}>{label}</Text>
              <Text style={styles.body}>
                Üretim paketinin planlanan avantajı.
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  if (page === "help")
    return (
      <View style={{ gap: 24 }}>
        <Text style={styles.h1}>Nasıl yardımcı olabiliriz?</Text>
        <View style={styles.card}>
          <Text style={styles.h3}>DraBornSeries · v{config.version} · Kod {config.versionCode}</Text>
          <Text style={styles.body}>
            {store.series.filter((series) => series.status === "published").length} yayındaki hikâyeyi ve {store.episodes.length} bölümü keşfedebilirsin.
            Android ve web aynı hesabı, profil fotoğrafını ve izleme ilerlemesini kullanır.
            VIP aboneliklerini Android’de Google Play üzerinden satın alıp aynı hesabınla her iki platformda kullanabilirsin.
            {Platform.OS === "android" ? " Bu APK'da resmi AdMob test reklamları hazır. Test reklamları gerçek BornCoins kazandırmaz." : ""}
            BornCoins paket satışı ve push bildirimleri henüz etkin değildir.
          </Text>
          <Button
            secondary
            icon="mail-outline"
            onPress={() =>
              Linking.openURL(
                `mailto:${legalContact.email}?subject=DraBornSeries`,
              )
            }
          >
            {legalContact.email}
          </Button>
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>Sorun bildir</Text>
          <View style={styles.wrap}>
            {[
              "Video açılmıyor",
              "Video donuyor",
              "Ses hatalı",
              "Altyazı eksik",
              "Yanlış bölüm",
              "Diğer",
            ].map((kind) => (
              <Chip
                key={kind}
                label={kind}
                active={kind === reportKind}
                onPress={() => setReportKind(kind)}
              />
            ))}
          </View>
          <Field
            multiline
            placeholder="Ne olduğunu anlat…"
            value={reportBody}
            onChangeText={setReportBody}
          />
          <Button
            onPress={() =>
              store.session
                ? run(async () => {
                    await requireData(
                      db.from("dbs_reports").insert({
                        user_id: store.session!.user.id,
                        kind: reportKind,
                        body: reportBody.trim() || reportKind,
                      }),
                    );
                    setReportBody("");
                  }, "Bildirimin yönetim paneline iletildi.")
                : go("auth")
            }
          >
            Gönder
          </Button>
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>Gizlilik ve hesap</Text>
          <Text style={styles.body}>
            E-posta, profil tercihleri, izleme ilerlemesi ve cüzdan hareketleri
            hesabınla ilişkilendirilir. DraBornSeries verileri aynı Supabase
            projesindeki diğer uygulamalardan ayrı tutulur. Hesap silme bu
            uygulamanın verilerini temizler; ortak giriş hesabını ve diğer
            DraBornEagle uygulamalarını silmez.
          </Text>
          <View style={styles.wrap}>
            <Button secondary small icon="shield-checkmark-outline" onPress={() => go("privacy")}>Gizlilik Politikası</Button>
            <Button secondary small icon="document-text-outline" onPress={() => go("terms")}>Kullanım ve topluluk kuralları</Button>
            <Button secondary small icon="person-remove-outline" onPress={() => go("delete-account")}>Hesap silme</Button>
          </View>
        </View>
      </View>
    );
  if (!store.session)
    return (
      <View style={{ gap: 20, maxWidth: 960, width: "100%", alignSelf: "center" }}>
        <LinearGradient colors={["#412247", "#251937", "#141221"]} style={[styles.card, { padding: 28, gap: 20, overflow: "hidden" }]}>
          <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
            <Image source={require("../../assets/icons/icon.png")} style={{ width: 68, height: 68, borderRadius: 21 }} />
            <Chip label="HİKÂYEN SENİNLE" active />
          </View>
          <Text style={styles.eyebrow}>DRABORNSERIES HESABIN</Text>
          <Text style={[styles.h1, { maxWidth: 600 }]}>Bir sonraki hikâyene hazır mısın?</Text>
          <Text style={[styles.body, { color: "#e4d5ee", maxWidth: 640 }]}>{t.synced}</Text>
          <Button icon="logo-google" onPress={() => go("auth")}>Giriş yap veya kayıt ol</Button>
          <Button secondary icon="play-circle-outline" onPress={() => go("home")}>Dizileri keşfet</Button>
        </LinearGradient>
        <View style={[styles.wrap, { gap: 12 }]}>
          {([["bookmark-outline", "Kendi koleksiyonun", "Sevdiğin hikâyeleri bir araya getir.", "#f143a1"],
            ["play-circle-outline", "Kaldığın yerden", "Web ve Android’de izlemeye devam et.", "#a88aff"],
            ["gift-outline", "Günlük ödüller", "BornCoins ve izleme deneyimin hesabında.", "#ffb56b"]] as const).map(([icon, title, detail, accent]) =>
            <View key={title} style={[styles.card, { flexGrow: 1, flexBasis: 230, padding: 20, borderColor: accent + "40" }]}>
              <Icon name={icon} color={accent} size={28} /><Text style={styles.h3}>{title}</Text><Text style={styles.body}>{detail}</Text>
            </View>)}
        </View>
        <View style={[styles.card, { gap: 14, padding: 20 }]}>
          <Text style={styles.h3}>Tercihler ve yardım</Text>
          <View style={styles.wrap}>
            <Chip label="Türkçe" active={store.language === "tr"} onPress={() => store.setLanguage("tr")} />
            <Chip label="English" active={store.language === "en"} onPress={() => store.setLanguage("en")} />
          </View>
          <View style={styles.wrap}>
            <Button secondary small icon="help-circle-outline" onPress={() => go("help")}>Yardım</Button>
            <Button secondary small icon="shield-checkmark-outline" onPress={() => go("privacy")}>Gizlilik Politikası</Button>
            <Button secondary small icon="document-text-outline" onPress={() => go("terms")}>Koşullar</Button>
            <Button secondary small icon="person-remove-outline" onPress={() => go("delete-account")}>Hesap silme</Button>
          </View>
        </View>
      </View>
    );
  if (page === "wallet")
    return (
      <View style={{ gap: 24 }}>
        <LinearGradient
          colors={["#432337", "#221331", "#15101f"]}
          style={[styles.card, { padding: 30 }]}
        >
          <Text style={styles.eyebrow}>BORNCOINS CÜZDANIN</Text>
          <View style={styles.row}>
            <Icon name="dbs-coin" size={42} color={colors.orange} />
            <Text
              style={{
                fontSize: 58,
                fontWeight: "900",
                color: colors.text,
                letterSpacing: -2,
              }}
            >
              {store.balance.toLocaleString("tr-TR")}
            </Text>
          </View>
          <Text style={styles.body}>Biriktir. Hikâyeni seç. Bölümünü aç.</Text>
          <View style={styles.wrap}>
            <Button small onPress={() => go("rewards")} icon="gift-outline">
              BornCoins kazan
            </Button>
            <Chip label="Android + Web senkron" color={colors.mint} />
          </View>
        </LinearGradient>
        <Text style={styles.h2}>BornCoins paketleri</Text>
        <View style={styles.wrap}>
          {[50, 100, 250, 500, 1000, 2500].map((amount, i) => (
            <View
              key={amount}
              style={[
                styles.card,
                {
                  minWidth: 145,
                  flex: 1,
                  borderColor: i === 2 ? "#c45aab" : colors.line,
                },
              ]}
            >
              <Icon name="dbs-coin" color={colors.orange} size={30} />
              <Text
                style={{ fontSize: 28, fontWeight: "900", color: colors.text }}
              >
                {amount.toLocaleString("tr-TR")}
              </Text>
              <Text style={styles.body}>BornCoins</Text>
              <Chip label="Mağaza yayını bekleniyor" />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Fiyat Google Play’den alınacak.
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>Promosyon kodu</Text>
          <Text style={styles.body}>
            Promosyon kodunu gir; kodun BornCoins ve VIP ödülleri hesabına
            otomatik eklensin. Her kodu bir kez kullanabilirsin.
          </Text>
          <Field
            value={promo}
            onChangeText={setPromo}
            placeholder="Kodunu yaz"
            autoCapitalize="characters"
          />
          <Button
            onPress={() =>
              run(async () => {
                await rpc("dbs_redeem_reward", { code: promo });
                setPromo("");
                await store.refreshAccount();
              }, "Promosyon ödüllerin hesabına eklendi.")
            }
          >
            Kodu kullan
          </Button>
        </View>
        <Text style={styles.h2}>{t.coinHistory}</Text>
        {store.transactions.length ? (
          store.transactions.map((tx) => (
            <View
              key={tx.id}
              style={[
                styles.card,
                styles.row,
                { justifyContent: "space-between", padding: 18 },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.label}>{tx.description}</Text>
                <Text style={styles.body}>
                  {new Date(tx.created_at).toLocaleString("tr-TR")}
                </Text>
              </View>
              <Text
                style={{
                  color: tx.amount > 0 ? colors.mint : colors.orange,
                  fontSize: 20,
                  fontWeight: "800",
                }}
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </Text>
            </View>
          ))
        ) : (
          <Empty
            title="Cüzdanın yeni bir hikâyeye hazır"
            detail="Kazandığın ve harcadığın BornCoins burada görünecek."
          />
        )}
      </View>
    );
  if (page === "rewards")
    return (
      <View style={{ gap: 25 }}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>HER GÜN YENİ BİR HİKÂYE</Text>
          <Text style={styles.h1}>{t.daily}</Text>
          <Text style={styles.body}>
            Seriyi devam ettir, 7. günde büyük bonusu al. Ödül günü Türkiye
            saatine göre yenilenir.
          </Text>
          <Text style={styles.h3}>{store.streak.days} günlük seri</Text>
          <View style={styles.wrap}>
            {rewardDays.map((coins, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: index === 6 ? "#3b243e" : colors.bg,
                  borderRadius: 14,
                  padding: 16,
                  gap: 10,
                  borderWidth: 1,
                  borderColor:
                    (store.streak.days - 1) % 7 === index
                      ? colors.pink
                      : colors.line,
                  minWidth: 86,
                  alignItems: "center",
                }}
              >
                <Text style={styles.body}>{index + 1}. Gün</Text>
                <Icon
                  name={index === 6 ? "gift" : "dbs-coin"}
                  color={colors.orange}
                />
                <Text style={styles.h3}>+{coins}</Text>
              </View>
            ))}
          </View>
          <Button
            icon="gift-outline"
            onPress={() =>
              run(async () => {
                await rpc("dbs_claim_daily");
                await store.refreshAccount();
              }, "Günlük BornCoins ödülün eklendi.")
            }
          >
            {t.claim}
          </Button>
        </View>
        <Text style={styles.h2}>Başarımlar</Text>
        <View style={styles.wrap}>
          {achievements.map((a, index) => {
            const complete =
              index === 0
                ? store.progress.some((p) => p.completed)
                : index === 1
                  ? store.progress.filter((p) => p.completed).length >= 10
                  : index === 3
                    ? store.favorites.length >= 20
                    : index === 4
                      ? store.streak.days >= 7
                      : false;
            return (
              <View
                key={a.id}
                style={[styles.card, { minWidth: 210, flex: 1 }]}
              >
                <Icon
                  name={complete ? "ribbon" : "ribbon-outline"}
                  color={complete ? colors.orange : colors.muted}
                  size={32}
                />
                <Text style={styles.h3}>{a.name}</Text>
                <Text style={styles.body}>{a.description}</Text>
                <Chip
                  label={complete ? "Tamamlandı" : "Devam ediyor"}
                  color={complete ? colors.mint : colors.muted}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>{Platform.OS === "android" ? "Reklam ve görev ödülleri" : "Görev ödülleri"}</Text>
          <Text style={styles.body}>
            Günlük giriş ve promosyon ödülleri aktif.
            {Platform.OS === "android" ? " Ödüller ekranından AdMob test reklamlarını deneyebilirsin; örnek reklamlar gerçek BornCoins eklemez." : ""}
          </Text>
        </View>
      </View>
    );
  if (page === "notifications")
    return (
      <View style={{ gap: 14 }}>
        <Text style={styles.h1}>{t.notifications}</Text>
        {store.notifications.length ? (
          store.notifications.map((n) => (
            <View key={n.id} style={styles.card}>
              <Text style={styles.h3}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
              {!n.read_at && (
                <Button
                  small
                  secondary
                  onPress={() =>
                    run(async () => {
                      await requireData(
                        db
                          .from("dbs_notifications")
                          .update({ read_at: new Date().toISOString() })
                          .eq("id", n.id),
                      );
                      await store.refreshAccount();
                    })
                  }
                >
                  Okundu
                </Button>
              )}
            </View>
          ))
        ) : (
          <Empty
            title="Şimdilik her şey güncel"
            detail="Yeni bildirimlerin burada görünecek."
            icon="notifications-outline"
          />
        )}
      </View>
    );
  if (page === "settings")
    return (
      <View style={{ gap: 24 }}>
        <Text style={styles.h1}>{t.settings}</Text>
        <View style={styles.card}>
          <Text style={styles.h3}>Profil bilgilerin</Text>
          <Field
            label="Kullanıcı adı"
            value={username}
            onChangeText={setUsername}
            maxLength={320}
          />
          <Field
            label="Ad soyad (isteğe bağlı)"
            value={name}
            onChangeText={setName}
          />
          <ProfilePhotoPicker uri={photo?.uri || avatar}
            onPick={() => run(async () => { const selected = await pickProfilePhoto(); if (selected) setPhoto(selected); })}
            onRemove={() => { setPhoto(null); setAvatar(""); }} />
          <View style={styles.wrap}>
            {(["tr", "en"] as const).map((language) => (
              <Chip
                key={language}
                label={language === "tr" ? "Türkçe" : "English"}
                active={store.language === language}
                onPress={() => store.setLanguage(language)}
              />
            ))}
          </View>
          <Button
            onPress={() =>
              run(async () => {
                if (username.length < 3)
                  throw Error("Kullanıcı adı en az 3 karakter olmalı.");
                const avatarUrl = photo ? await uploadProfilePhoto(store.session!.user.id, photo) : avatar;
                if (!avatarUrl) {
                  const { error } = await db.storage.from("dbs_series_avatars").remove([store.session!.user.id + "/avatar.jpg"]);
                  if (error) throw error;
                }
                await requireData(
                  db
                    .from("dbs_profiles")
                    .update({
                      username,
                      full_name: name,
                      avatar_url: avatarUrl || null,
                      language: store.language,
                    })
                    .eq("user_id", store.session!.user.id),
                );
                setPhoto(null);
                await store.refreshAccount();
              }, "Profilin kaydedildi.")
            }
          >
            {t.save}
          </Button>
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>İzleme tercihleri</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={styles.label}>Otomatik video önizlemeleri</Text>
              <Text style={styles.body}>
                Ana sayfada kısa, sessiz önizlemeler oynat.
              </Text>
            </View>
            <Switch
              value={store.profile?.preferences?.previews !== false}
              trackColor={{ true: colors.pink }}
              onValueChange={(value) =>
                run(async () => {
                  await requireData(
                    db
                      .from("dbs_profiles")
                      .update({
                        preferences: {
                          ...store.profile?.preferences,
                          previews: value,
                        },
                      })
                      .eq("user_id", store.session!.user.id),
                  );
                  await store.refreshAccount();
                })
              }
            />
          </View>
          <Text style={styles.h3}>Bildirim tercihleri</Text>
          {Array.isArray(store.profile?.preferences?.blocked_user_ids) && store.profile.preferences.blocked_user_ids.length > 0 &&
            <Button secondary small icon="person-add-outline" onPress={() => run(async () => {
              await requireData(db.from("dbs_profiles").update({ preferences: {
                ...store.profile?.preferences, blocked_user_ids: [],
              } }).eq("user_id", store.session!.user.id));
              await store.refreshAccount();
            }, "Yorum engellemeleri kaldırıldı.")}>Engellenen kullanıcıları yeniden göster</Button>}
          <View style={styles.row}>
            <Switch
              value={notifications}
              onValueChange={(value) => {
                setNotifications(value);
                run(async () => {
                  await requireData(
                    db.from("dbs_notification_preferences").upsert({
                      user_id: store.session!.user.id,
                      new_episodes: value,
                    }),
                  );
                });
              }}
              trackColor={{ true: colors.pink }}
            />
            <Text style={styles.body}>Yeni bölüm bildirimleri</Text>
          </View>
          <Text style={styles.body}>
            Expo Go üzerinde uygulama içi bildirimler kullanılabilir. Android
            push için development build gerekir.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>Aktif DraBornSeries oturumları</Text>
          {sessions
            .filter((s) => !s.revoked_at)
            .slice(0, visibleSessionCount)
            .map((s) => (
              <View
                key={s.session_id}
                style={[
                  styles.row,
                  { justifyContent: "space-between", flexWrap: "wrap" },
                ]}
              >
                <View>
                  <Text style={styles.label}>
                    {s.device_id.split("-")[0] === "web"
                      ? "Web tarayıcı"
                      : "Android"}
                  </Text>
                  <Text style={styles.body}>
                    {new Date(s.last_seen_at).toLocaleString("tr-TR")}
                  </Text>
                </View>
                <Button
                  small
                  secondary
                  onPress={() =>
                    run(async () => {
                      await rpc("dbs_revoke_session", {
                        session: s.session_id,
                      });
                      setSessions(
                        sessions.filter((v) => v.session_id !== s.session_id),
                      );
                    }, "Bu oturumun DraBornSeries erişimi kapatıldı.")
                  }
                >
                  Erişimi kapat
                </Button>
              </View>
            ))}
          {sessions.filter((s) => !s.revoked_at).length > visibleSessionCount && <Button secondary small icon="chevron-down"
            onPress={() => setVisibleSessionCount((count) => count + 5)}>Daha Fazla · 5 oturum</Button>}
          <Button
            secondary
            onPress={() =>
              run(async () => {
                const { error } = await db.auth.signOut({ scope: "global" });
                if (error) throw error;
              }, "Tüm oturumlardan çıkış yapıldı.")
            }
          >
            Tüm cihazlardan çıkış
          </Button>
        </View>
        <View style={[styles.card, { borderColor: "#703042" }]}>
          <Text style={styles.h3}>DraBornSeries hesabını sil</Text>
          <Text style={styles.body}>
            DraBornSeries profilin, fotoğrafın, izleme geçmişin, yorumların ve
            cüzdanın temizlenir. Silme kapsamını inceleyip bir sonraki ekranda onaylayabilirsin.
          </Text>
          <Button
            secondary
            icon="person-remove-outline"
            onPress={() => go("delete-account")}
          >
            Hesap silme sayfasını aç
          </Button>
        </View>
        <View style={styles.card}>
          <Text style={styles.h3}>Gizlilik ve kurallar</Text>
          {adAvailable && <Button secondary icon="options-outline" onPress={() => void run(async () => {
            if (!(await adPrivacyOptions())) throw Error("Örnek reklamlarda kişiselleştirme kapalıdır. Gerçek reklamlar etkinleştirildiğinde gizlilik tercihlerini burada yönetebilirsin.");
          })}>Reklam gizlilik tercihleri</Button>}
          <Button secondary icon="shield-checkmark-outline" onPress={() => go("privacy")}>Gizlilik Politikası</Button>
          <Button secondary icon="document-text-outline" onPress={() => go("terms")}>Kullanım ve topluluk kuralları</Button>
        </View>
      </View>
    );
  return (
    <View style={{ gap: 24 }}>
      <LinearGradient
        colors={["#291a36", "#14111e"]}
        style={[styles.card, { padding: 30 }]}
      >
        <View style={styles.row}>
          {store.profile?.avatar_url ? (
            <Image
              source={{ uri: store.profile.avatar_url }}
              style={{ height: 70, width: 70, borderRadius: 24 }}
            />
          ) : (
            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 24,
                backgroundColor: "#443052",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="person" size={32} color={colors.purple} />
            </View>
          )}
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.h2}>
              {store.profile?.username || "İzleyici"}
            </Text>
            <Text style={styles.body}>{store.session.user.email}</Text>
          </View>
        </View>
        <View style={styles.wrap}>
          <Chip
            label={store.vip ? "DraBornSeries VIP" : "Ücretsiz üyelik"}
            active
          />
          <Chip label={`${store.balance} BornCoins`} color={colors.orange} />
        </View>
      </LinearGradient>
      <View style={styles.wrap}>
        {[
          [
            "Tamamlanan bölüm",
            store.progress.filter((p) => p.completed).length,
          ],
          ["Listendeki dizi", store.favorites.length],
          ["Günlük seri", store.streak.days],
        ].map(([label, value]) => (
          <View key={label} style={[styles.card, { flex: 1, minWidth: 130 }]}>
            <Text
              style={{ fontSize: 32, fontWeight: "900", color: colors.text }}
            >
              {value}
            </Text>
            <Text style={styles.body}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.wrap}>
        <Button onPress={() => go("settings")} icon="settings-outline">
          Hesap ayarları
        </Button>
        <Button secondary onPress={() => go("rewards")} icon="ribbon-outline">
          Başarımlar
        </Button>
        <Button secondary onPress={() => go("library")} icon="bookmark-outline">
          Listem / geçmişim
        </Button>
        {store.isAdmin && (
          <Button secondary onPress={() => go("admin")} icon="options-outline">
            DraBornSeries Stüdyo
          </Button>
        )}
        <Button
          secondary
          onPress={() => run(() => db.auth.signOut({ scope: "local" }))}
          icon="log-out-outline"
        >
          Çıkış yap
        </Button>
      </View>
    </View>
  );
}
