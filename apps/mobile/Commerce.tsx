import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Store } from "../../packages/api/store";
import type { Page } from "../../packages/types";
import { db, requireData, rpc } from "../../packages/api/client";
import {
  Button,
  Chip,
  Field,
  Icon,
  colors,
  styles,
} from "../../packages/ui/theme";
import { rewardDays } from "../../packages/shared/domain";
import { examplePrice } from "../../packages/shared/pricing";
type Props = {
  page: Page;
  store: Store;
  onHistory: () => void;
  go: (p: Page) => void;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<void>;
};
type Product = {
  id: string;
  kind: string;
  coins: number;
  active: boolean;
  title?: string;
  billing_period?: string;
  bonus_coins?: number;
  sort_order?: number;
};
const periods = [
  ["weekly", "Haftalık", "7 gün"],
  ["monthly", "Aylık", "1 ay"],
  ["yearly", "Yıllık", "1 yıl"],
];
const panel = {
  ...styles.card,
  padding: 20,
  borderRadius: 22,
  backgroundColor: "#181321",
  borderColor: "#ffffff0d",
};
function RewardArt({ size = 150 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/icons/reward.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
function Row({
  icon,
  title,
  value,
  onPress,
  color = colors.purple,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  value?: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderColor: "#ffffff06",
      }}
    >
      <View
        style={{
          width: 37,
          height: 37,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color + "15",
        }}
      >
        <Icon name={icon} color={color} />
      </View>
      <Text
        style={{ flex: 1, color: "#eee5f4", fontSize: 15, fontWeight: "600" }}
      >
        {title}
      </Text>
      {value && (
        <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{value}</Text>
      )}
      <Icon name="chevron-forward" color="#76667e" size={18} />
    </Pressable>
  );
}
export default function Commerce({ page, store, go, run, onHistory }: Props) {
  const [products, setProducts] = useState<Product[]>([]),
    [selected, setSelected] = useState("monthly"),
    [checkout, setCheckout] = useState<Product | null>(null),
    [reward, setReward] = useState<number | null>(null),
    [filter, setFilter] = useState("all"),
    [promo, setPromo] = useState(""),
    [tasks, setTasks] = useState<any[]>([]),
    [claims, setClaims] = useState<string[]>([]);
  useEffect(() => {
    requireData(
      db.from("dbs_google_play_products").select("*").order("sort_order"),
    )
      .then(setProducts)
      .catch(() => {});
    requireData(db.from("dbs_tasks").select("*").eq("active", true))
      .then(setTasks)
      .catch(() => {});
    if (store.session)
      requireData(
        db
          .from("dbs_user_tasks")
          .select("tasks_id,claimed_at")
          .not("claimed_at", "is", null),
      )
        .then((rows) => setClaims(rows.map((r: any) => r.tasks_id)))
        .catch(() => {});
    else setClaims([]);
  }, [store.session, page]);
  const logged = !!store.session,
    coins = products.filter((p) => p.kind === "coins"),
    plans = products.filter((p) => p.kind === "vip"),
    currentPlan = plans.find((p) => p.billing_period === selected);
  const needLogin = (fn: () => Promise<unknown>) =>
    logged ? run(fn) : go("auth");
  const claim = async (id: string) => {
    const result = await rpc<{ coins: number }>("dbs_claim_task", { task: id });
    await store.refreshAccount();
    setClaims([...claims, id]);
    setReward(result.coins);
  };
  const vipBanner = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="DraBornSeries VIP paketlerini aç"
      onPress={() => go("vip")}
    >
      <LinearGradient
        colors={["#f03b87", "#b832cc", "#683ce7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 23, borderRadius: 24, overflow: "hidden", gap: 12 }}
      >
        <View
          style={{
            position: "absolute",
            right: -25,
            top: -30,
            width: 160,
            height: 160,
            borderRadius: 90,
            borderWidth: 24,
            borderColor: "#ffffff12",
          }}
        />
        <View style={styles.row}>
          <Icon name="diamond" color="#ffe2aa" size={30} />
          <Text
            style={{ fontSize: 22, color: "#fff", fontWeight: "900", flex: 1 }}
          >
            DraBornSeries VIP
          </Text>
          <Icon name="arrow-forward" />
        </View>
        <Text
          style={{ color: "#fff", fontSize: 13, opacity: 0.88, lineHeight: 21 }}
        >
          Daha fazla hikâye. Daha az bekleme.{`\n`}Haftalık, aylık veya yıllık
          paketini seç.
        </Text>
        <View style={{ flexDirection: "row", gap: 18, marginTop: 4 }}>
          {[
            ["diamond-outline", "Özel bölümler"],
            ["eye-off-outline", "Reklamsız"],
            ["flash-outline", "Erken erişim"],
          ].map(([icon, label]) => (
            <View key={label} style={{ alignItems: "center", gap: 7, flex: 1 }}>
              <Icon name={icon as any} color="#fff0d7" />
              <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Pressable>
  );
  const planCards = (
    <View style={{ gap: 12 }}>
      {periods.map(([id, title, length], i) => {
        const product = plans.find((p) => p.billing_period === id);
        const active = selected === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={title + " VIP"}
            onPress={() => setSelected(id)}
          >
            <LinearGradient
              colors={active ? ["#45263e", "#261a32"] : ["#201822", "#17121d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 22,
                borderRadius: 20,
                borderWidth: active ? 2 : 1,
                borderColor: active ? colors.orange : "#48313d",
                gap: 12,
              }}
            >
              <View style={styles.row}>
                <Icon
                  name="diamond"
                  color={active ? "#ffd499" : "#a58d9c"}
                  size={24}
                />
                <Text
                  style={{
                    color: "#ffe0b3",
                    fontWeight: "900",
                    fontSize: 22,
                    flex: 1,
                  }}
                >
                  {title} VIP
                </Text>
                <Icon
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  color={active ? colors.pink : "#786071"}
                  size={25}
                />
              </View>
              <Text style={{ color: "#f0dfe9", fontSize: 13 }}>
                VIP kapsamındaki bölümlere {length} erişim
              </Text>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ color: "#ffe0b3", fontSize: 16, fontWeight: "900" }}>
                  {examplePrice(product?.id || "dbs_vip_" + id)}
                </Text>
                <Text
                  style={{
                    color: colors.orange,
                    fontWeight: "900",
                    fontSize: 19,
                  }}
                >
                  Satış kapalı
                </Text>
              </View>
              {i === 1 && (
                <View
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#f53b9520",
                    borderRadius: 7,
                    padding: 7,
                  }}
                >
                  <Text
                    style={{
                      color: "#ff8bbc",
                      fontSize: 10,
                      fontWeight: "900",
                    }}
                  >
                    SENİN TEMPO, SENİN HİKÂYEN
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
  let body: React.ReactNode;
  if (page === "store")
    body = (
      <View style={{ gap: 24 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={styles.eyebrow}>HİKÂYENE DEVAM ET</Text>
            <Text style={[styles.h1, { fontSize: 28, marginTop: 7 }]}>
              DraBornSeries Mağazası
            </Text>
          </View>
          <Icon name="bag-handle" color={colors.pink} size={30} />
        </View>
        <LinearGradient
          colors={["#25182f", "#16101f"]}
          style={[
            panel,
            { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
          ]}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.body}>Cüzdanındaki BornCoins</Text>
            <View style={styles.row}>
              <Icon name="dbs-coin" color={colors.orange} size={28} />
              <Text style={{ fontSize: 35, fontWeight: "900", color: "#fff" }}>
                {store.balance}
              </Text>
            </View>
            <Pressable onPress={() => go("wallet")}>
              <Text style={{ color: colors.purple, fontSize: 12 }}>
                Cüzdanıma git →
              </Text>
            </Pressable>
          </View>
          <RewardArt size={118} />
        </LinearGradient>
        <View style={{ gap: 15 }}>
          <Text style={styles.h2}>BornCoins yükle</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {coins.map((p, i) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.coins} BornCoins paketi`}
                onPress={() => setCheckout(p)}
                style={{ width: "47.8%", flexGrow: 1, minWidth: 135 }}
              >
                <LinearGradient
                  colors={
                    i === 2 ? ["#482b35", "#251a2d"] : ["#241b2e", "#181321"]
                  }
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: i === 2 ? colors.orange : "#392841",
                    minHeight: 131,
                    justifyContent: "space-between",
                  }}
                >
                  {!!p.bonus_coins && (
                    <Text
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        backgroundColor: colors.pink,
                        color: "#fff",
                        paddingHorizontal: 9,
                        paddingVertical: 5,
                        fontSize: 10,
                        fontWeight: "900",
                        borderTopRightRadius: 16,
                        borderBottomLeftRadius: 10,
                      }}
                    >
                      +{p.bonus_coins} BONUS
                    </Text>
                  )}
                  <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
                    <Icon name="dbs-coin" color={colors.orange} size={27} />
                    <Text
                      style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}
                    >
                      {p.coins - (p.bonus_coins || 0)}
                    </Text>
                  </View>
                  <Text
                    style={{ color: "#b3a0bd", fontSize: 12, marginTop: 12 }}
                  >
                    {examplePrice(p.id)} · Satış kapalı
                  </Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.h2}>Sınırsız hikâyelere bir adım</Text>
        {planCards}
        <Button onPress={() => go("vip")} icon="diamond">
          VIP avantajlarını keşfet
        </Button>
        <Button
          secondary
          small
          icon="refresh"
          onPress={() =>
            needLogin(async () => {
              await store.refreshAccount();
            })
          }
        >
          Hesap haklarını yenile
        </Button>
        <Text style={styles.body}>
          Gösterilen tutarlar örnektir; ödeme alınmaz. Gerçek fiyat ve onay
          Google Play ürünleri bağlandığında gösterilir. Web ve Android aynı
          cüzdanı kullanır.
        </Text>
      </View>
    );
  else if (page === "vip")
    body = (
      <View style={{ gap: 24 }}>
        <LinearGradient
          colors={["#5c253f", "#2d1742", "#100b18"]}
          style={{ padding: 28, borderRadius: 28, gap: 17, overflow: "hidden" }}
        >
          <View
            style={{
              position: "absolute",
              right: -15,
              top: -10,
              opacity: 0.25,
            }}
          >
            <RewardArt size={210} />
          </View>
          <Text
            style={{
              color: colors.orange,
              fontSize: 11,
              fontWeight: "900",
              letterSpacing: 3,
            }}
          >
            DRABORNSERIES VIP
          </Text>
          <Text
            style={{
              color: "#fff",
              fontSize: 38,
              lineHeight: 42,
              fontWeight: "900",
              letterSpacing: -1.8,
              maxWidth: 350,
            }}
          >
            Her hikâyenin{`\n`}ayrıcalıklı tarafı.
          </Text>
          <Text
            style={{
              color: "#e2cddd",
              maxWidth: 330,
              fontSize: 14,
              lineHeight: 22,
            }}
          >
            Bir bölüm daha demenin en güzel hâli.
          </Text>
          <Chip
            active
            label={
              store.vip ? "VIP ÜYELİĞİN AKTİF" : "HAFTALIK · AYLIK · YILLIK"
            }
          />
          {store.vipEnd && (
            <Text style={styles.body}>
              Bitiş: {new Date(store.vipEnd).toLocaleDateString("tr-TR")}
            </Text>
          )}
        </LinearGradient>
        {planCards}
        <Button
          icon="diamond"
          onPress={() => currentPlan && setCheckout(currentPlan)}
          style={{ alignSelf: "stretch" }}
        >
          Seçili paketi incele
        </Button>
        <Text style={styles.h2}>VIP dünyanda neler var?</Text>
        <View style={panel}>
          {[
            ["play-circle-outline", "VIP içerik koleksiyonları"],
            ["eye-off-outline", "Reklamsız izleme deneyimi"],
            ["flash-outline", "Uygun içeriklerde erken erişim"],
            ["ribbon-outline", "VIP profil rozeti"],
            ["phone-portrait-outline", "Android ve web senkronizasyonu"],
          ].map(([icon, title]) => (
            <View key={title} style={[styles.row, { paddingVertical: 12 }]}>
              <Icon name={icon as any} color={colors.orange} />
              <Text style={{ color: "#eddee8", fontSize: 14, flex: 1 }}>
                {title}
              </Text>
              <Icon name="checkmark" color={colors.mint} size={18} />
            </View>
          ))}
        </View>
        <Text style={[styles.body, { fontSize: 12 }]}>
          Satın alma açıldığında dönem, fiyat ve otomatik yenileme şartları
          Google Play onay ekranında gösterilir. Coin ile açılan her bölüm VIP
          kapsamına otomatik olarak girmez.
        </Text>
      </View>
    );
  else if (page === "wallet")
    body = (
      <View style={{ gap: 24 }}>
        <Text style={styles.h1}>Cüzdanım</Text>
        <LinearGradient
          colors={["#321d40", "#1e132b"]}
          style={[panel, { alignItems: "center", padding: 30 }]}
        >
          <RewardArt size={165} />
          <Text style={styles.body}>Kullanılabilir BornCoins</Text>
          <Text
            style={{
              color: "#fff",
              fontSize: 58,
              fontWeight: "900",
              letterSpacing: -3,
            }}
          >
            {store.balance}
          </Text>
          <Button
            icon="add"
            onPress={() => go("store")}
            style={{ alignSelf: "stretch" }}
          >
            BornCoins yükle
          </Button>
        </LinearGradient>
        <View style={panel}>
          <Text style={styles.h3}>Promosyon kodun var mı?</Text>
          <View style={[styles.row, { alignItems: "stretch" }]}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="Örn. DBS2026"
                value={promo}
                onChangeText={setPromo}
                autoCapitalize="characters"
              />
            </View>
            <Button
              onPress={() =>
                needLogin(async () => {
                  await rpc("dbs_redeem_promo", { code: promo });
                  await store.refreshAccount();
                  setPromo("");
                })
              }
            >
              Kullan
            </Button>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            DBS2026 → bir defaya mahsus 30 BornCoins
          </Text>
        </View>
        <View style={[panel, styles.row]}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={styles.h3}>Sonraki bölümü otomatik aç</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
              Coin gerektiren bölümün fiyatını bakiyenden kullanır. Dilediğinde
              kapatabilirsin.
            </Text>
          </View>
          <Switch
            value={store.profile?.preferences?.auto_unlock === true}
            trackColor={{ true: colors.pink }}
            onValueChange={(value) =>
              needLogin(async () => {
                await requireData(
                  db
                    .from("dbs_profiles")
                    .update({
                      preferences: {
                        ...store.profile?.preferences,
                        auto_unlock: value,
                      },
                    })
                    .eq("user_id", store.session!.user.id),
                );
                await store.refreshAccount();
              })
            }
          />
        </View>
        <Text style={styles.h2}>İşlem geçmişi</Text>
        <View style={styles.wrap}>
          {[
            ["all", "Tümü"],
            ["earned", "Kazanılan"],
            ["spent", "Harcanan"],
          ].map(([v, title]) => (
            <Chip
              key={v}
              label={title}
              active={filter === v}
              onPress={() => setFilter(v)}
            />
          ))}
        </View>
        {store.transactions
          .filter(
            (tx) =>
              filter === "all" ||
              (filter === "earned" ? tx.amount > 0 : tx.amount < 0),
          )
          .map((tx) => (
            <View key={tx.id} style={[panel, styles.row, { padding: 16 }]}>
              <Icon
                name={
                  tx.amount > 0 ? "add-circle-outline" : "play-circle-outline"
                }
                color={tx.amount > 0 ? colors.mint : colors.pink}
                size={27}
              />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.label}>
                  {tx.description || "BornCoins işlemi"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {new Date(tx.created_at).toLocaleString("tr-TR")}
                </Text>
              </View>
              <Text
                style={{
                  fontWeight: "900",
                  fontSize: 19,
                  color: tx.amount > 0 ? colors.mint : "#fff",
                }}
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </Text>
            </View>
          ))}
        {!store.transactions.length && (
          <Text style={styles.body}>
            Henüz bir işlem yok. Günlük ödülünle başlayabilirsin.
          </Text>
        )}
      </View>
    );
  else if (page === "rewards")
    body = (
      <View style={{ gap: 23 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={[styles.h1, { fontSize: 34 }]}>Ödüller</Text>
            <Text style={[styles.body, { marginTop: 8 }]}>
              Her gün, hikâyene küçük bir bonus.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="VIP planları"
            onPress={() => go("vip")}
          >
            <Icon name="diamond" color={colors.orange} size={30} />
          </Pressable>
        </View>
        <LinearGradient
          colors={["#3c1b36", "#21162b"]}
          style={[panel, { padding: 23, overflow: "hidden" }]}
        >
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View>
              <Text style={{ color: "#dcc7df", fontSize: 13 }}>
                BornCoins bakiyen
              </Text>
              <View style={[styles.row, { marginTop: 10 }]}>
                <Icon name="dbs-coin" color={colors.orange} size={27} />
                <Text
                  style={{ color: "#fff", fontSize: 38, fontWeight: "900" }}
                >
                  {store.balance}
                </Text>
              </View>
            </View>
            <RewardArt size={130} />
          </View>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Text style={styles.h3}>Günlük giriş</Text>
            <Text
              style={{ color: colors.orange, fontWeight: "800", fontSize: 12 }}
            >
              {store.streak.days} günlük seri 🔥
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {rewardDays.map((amount, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  backgroundColor:
                    i === store.streak.days % 7 ? "#ba316c" : "#ffffff09",
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                  gap: 9,
                  borderWidth: 1,
                  borderColor:
                    i === store.streak.days % 7 ? "#ff6eaa" : "#ffffff08",
                }}
              >
                <Text style={{ color: "#cdbace", fontSize: 9 }}>
                  {i + 1}. Gün
                </Text>
                <Icon
                  name={i === 6 ? "gift" : "dbs-coin"}
                  color={colors.orange}
                  size={22}
                />
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}
                >
                  +{amount}
                </Text>
              </View>
            ))}
          </View>
          <Button
            icon="gift"
            onPress={() =>
              needLogin(async () => {
                const data = await rpc<{ coins: number }>("dbs_claim_daily");
                await store.refreshAccount();
                setReward(data.coins);
              })
            }
            style={{ alignSelf: "stretch" }}
          >
            Günlük ödülünü al
          </Button>
        </LinearGradient>
        <Text style={styles.h2}>BornCoins kazan</Text>
        <View style={panel}>
          {tasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.row,
                {
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderColor: "#ffffff09",
                },
              ]}
            >
              <View
                style={{
                  width: 43,
                  height: 43,
                  borderRadius: 15,
                  backgroundColor: "#f23d8719",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    task.id === "welcome"
                      ? "gift-outline"
                      : task.id === "favorite"
                        ? "heart-outline"
                        : "person-circle-outline"
                  }
                  color={colors.pink}
                  size={25}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.label}>{task.name}</Text>
                <Text
                  style={{
                    color: colors.orange,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  +{task.data?.coins || 0} BornCoins
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  {task.description}
                </Text>
              </View>
              <Button
                small
                secondary
                disabled={claims.includes(task.id)}
                onPress={() => needLogin(() => claim(task.id))}
              >
                {claims.includes(task.id) ? "Alındı" : "Ödülü al"}
              </Button>
            </View>
          ))}
          <View style={[styles.row, { paddingTop: 20 }]}>
            <Icon name="play-circle" color={colors.orange} size={30} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.label}>Reklam izle, bonus kazan</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Google Play sürümünde açılacak
              </Text>
            </View>
            <Chip label="Yakında" />
          </View>
        </View>
        <Pressable onPress={() => go("wallet")}>
          <Text
            style={{
              color: colors.purple,
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Promosyon kodunu kullan →
          </Text>
        </Pressable>
        {vipBanner}
      </View>
    );
  else
    body = (
      <View style={{ gap: 23 }}>
        <View style={[styles.row, { justifyContent: "flex-end" }]}>
          <Pressable
            accessibilityLabel="Bildirimler"
            onPress={() => go("notifications")}
          >
            <Icon name="notifications-outline" size={25} />
          </Pressable>
          <Pressable
            accessibilityLabel="Ayarlar"
            onPress={() => go(logged ? "settings" : "auth")}
          >
            <Icon name="settings-outline" size={25} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => go(logged ? "settings" : "auth")}
          style={[styles.row, { gap: 18, paddingVertical: 8 }]}
        >
          <LinearGradient
            colors={["#f64092", "#7c4bed"]}
            style={{ width: 76, height: 76, borderRadius: 27, padding: 3 }}
          >
            {store.profile?.avatar_url ? (
              <Image
                source={{ uri: store.profile.avatar_url }}
                style={{ width: 70, height: 70, borderRadius: 24 }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#271b37",
                  borderRadius: 24,
                }}
              >
                <Icon name="person" color="#c8a5f2" size={37} />
              </View>
            )}
          </LinearGradient>
          <View style={{ flex: 1, gap: 7 }}>
            <Text
              numberOfLines={1}
              style={{ color: "#fff", fontSize: 25, fontWeight: "900" }}
            >
              {logged
                ? store.profile?.username || "DraBorn izleyicisi"
                : "Giriş yap"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {logged
                ? "ID " + store.session!.user.id.slice(0, 8).toUpperCase()
                : "Hikâyen tüm cihazlarında seninle"}
            </Text>
            {store.vip && (
              <Text
                style={{
                  color: colors.orange,
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                ✦ DRABORNSERIES VIP
              </Text>
            )}
          </View>
          <Icon name="chevron-forward" />
        </Pressable>
        {!logged && (
          <Pressable
            onPress={() => go("auth")}
            style={{
              backgroundColor: "#512038",
              borderRadius: 13,
              padding: 13,
            }}
          >
            <Text
              style={{
                color: "#ff9ec7",
                fontSize: 13,
                textAlign: "center",
                fontWeight: "800",
              }}
            >
              Giriş yap, +80 BornCoins karşılama ödülünü al
            </Text>
          </Pressable>
        )}
        {vipBanner}
        <View style={{ flexDirection: "row", gap: 11 }}>
          {[
            ["dbs-coin", String(store.balance), "BornCoins", "wallet"],
            [
              "bookmark",
              String(store.favorites.length),
              "Listemdeki dizi",
              "library",
            ],
            ["flame", String(store.streak.days), "Günlük seri", "rewards"],
          ].map(([icon, value, label, target]) => (
            <Pressable
              key={target}
              onPress={() => go(target as Page)}
              style={[
                panel,
                { flex: 1, padding: 16, alignItems: "center", gap: 8 },
              ]}
            >
              <Icon name={icon as any} color={colors.orange} size={25} />
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 24 }}>
                {value}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  textAlign: "center",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[panel, { paddingVertical: 3 }]}>
          <Row
            icon="bag-handle-outline"
            title="DraBornSeries Mağazası"
            value="Yeni"
            onPress={() => go("store")}
            color={colors.pink}
          />
          <Row
            icon="wallet-outline"
            title="Cüzdanım"
            value={String(store.balance)}
            onPress={() => go("wallet")}
            color={colors.orange}
          />
          <Row
            icon="gift-outline"
            title="Ödül kazan"
            value="BornCoins"
            onPress={() => go("rewards")}
            color={colors.orange}
          />
          <Row
            icon="time-outline"
            title="İzleme geçmişim"
            onPress={onHistory}
          />
          <Row
            icon="heart-outline"
            title="Koleksiyonum"
            onPress={() => go("library")}
          />
          {store.isAdmin && (
            <Row
              icon="shield-checkmark-outline"
              title="DraBornSeries Stüdyo"
              value="Yönetici"
              onPress={() => go("admin")}
              color={colors.mint}
            />
          )}
        </View>
        <View style={[panel, { paddingVertical: 3 }]}>
          <Row
            icon="language-outline"
            title="Dil"
            value={store.language === "tr" ? "Türkçe" : "English"}
            onPress={() =>
              store.setLanguage(store.language === "tr" ? "en" : "tr")
            }
          />
          <Row
            icon="help-circle-outline"
            title="Yardım ve geri bildirim"
            onPress={() => go("help")}
          />
          <Row
            icon="settings-outline"
            title="Hesap ayarları"
            onPress={() => go(logged ? "settings" : "auth")}
          />
        </View>
      </View>
    );
  return (
    <>
      <View style={{ maxWidth: 850, width: "100%", alignSelf: "center" }}>
        {body}
      </View>
      <Modal
        visible={checkout !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckout(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000b5",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 540,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 28,
              paddingBottom: 40,
              backgroundColor: "#1c1129",
              borderWidth: 1,
              borderColor: "#623750",
              gap: 18,
            }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={styles.h2}>
                {checkout?.kind === "vip"
                  ? checkout.title
                  : `${checkout?.coins} BornCoins`}
              </Text>
              <Pressable
                accessibilityLabel="Kapat"
                onPress={() => setCheckout(null)}
              >
                <Icon name="close-circle" size={30} />
              </Pressable>
            </View>
            <Text style={styles.body}>
              {checkout?.kind === "vip"
                ? "Seçtiğin VIP paketi aynı hesabınla Android ve webde geçerli olacak."
                : "BornCoins ile uygun bölümleri kalıcı olarak hesabına açabilirsin."}
            </Text>
            {checkout && <Text style={[styles.h2, { color: colors.orange }]}>{examplePrice(checkout.id)}</Text>}
            <View style={[panel, { borderColor: "#a94a78" }]}>
              <Text
                style={{ color: "#ffb7d2", fontSize: 15, fontWeight: "800" }}
              >
                Mağaza satışı henüz açılmadı
              </Text>
              <Text style={styles.body}>
                {Platform.OS === "web"
                  ? "Satın alma, Google Play sürümünden yapılacak."
                  : "Expo Go içinde gerçek ödeme alınamaz."}{" "}
                Bu tutar yalnızca örnektir. Gerçek fiyat ve ödeme onayı Google
                Play bağlantısıyla gösterilecek.
              </Text>
            </View>
            <Button
              onPress={() => {
                setCheckout(null);
                go("rewards");
              }}
              icon="gift"
            >
              Şimdi ücretsiz BornCoins kazan
            </Button>
            {checkout?.kind === "vip" && store.vip && (
              <Button
                secondary
                onPress={() =>
                  Linking.openURL(
                    "https://play.google.com/store/account/subscriptions",
                  )
                }
              >
                Google Play aboneliklerim
              </Button>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={reward !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReward(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000ca",
            alignItems: "center",
            justifyContent: "center",
            padding: 26,
          }}
        >
          <LinearGradient
            colors={["#382047", "#150c22"]}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: 25,
              borderRadius: 30,
              borderWidth: 1,
              borderColor: "#e959a390",
              alignItems: "center",
              gap: 15,
            }}
          >
            <Text style={{ fontSize: 25, color: "#ffdfa2", fontWeight: "900" }}>
              Hikâyenin bonusu geldi!
            </Text>
            <RewardArt size={230} />
            <Text
              style={{
                color: colors.pink,
                fontSize: 56,
                fontWeight: "900",
                letterSpacing: -2,
              }}
            >
              +{reward}
            </Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
              BornCoins
            </Text>
            <Text style={[styles.body, { textAlign: "center" }]}>
              Ödülün hesabına eklendi.{`\n`}Bir sonraki hikâyede görüşürüz.
            </Text>
            <Button
              onPress={() => setReward(null)}
              style={{ alignSelf: "stretch" }}
            >
              Harika!
            </Button>
          </LinearGradient>
        </View>
      </Modal>
    </>
  );
}
