import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  Text,
  View,
  Linking,
} from "react-native";
import RewardPopup, { type PromoReward } from "../../packages/ui/RewardPopup";
import AnimatedCTA from "../../packages/ui/AnimatedCTA";
import VipStatus from "../../packages/ui/VipStatus";
import VipPopup from "../../packages/ui/VipPopup";
import VipBenefits from "../../packages/ui/VipBenefits";
import VipPurchaseBenefits from "../../packages/ui/VipPurchaseBenefits";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import type { Billing } from "../../packages/api/billing-types";
import { adTestMode } from "../../packages/api/ads";
import AdRewardButton from "../../packages/ui/AdRewardButton";
import ActionRow from "../../packages/ui/ActionRow";
import { config } from "../../packages/shared/config";
type Props = {
  billing: Billing;
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
export default function Commerce({ billing, page, store, go, run, onHistory }: Props) {
  const insets = useSafeAreaInsets();
  const { refresh } = billing;
  const accountUser = store.session?.user.id;
  const [products, setProducts] = useState<Product[]>([]),
    [selected, setSelected] = useState("monthly"),
    [checkout, setCheckout] = useState<Product | null>(null),
    [checkoutVisible, setCheckoutVisible] = useState(false),
    [ownedVisible, setOwnedVisible] = useState(false),
    [reward, setReward] = useState<number | null>(null),
    [promoReward, setPromoReward] = useState<PromoReward | null>(null),
    [filter, setFilter] = useState("all"),
    [visibleTransactionCount, setVisibleTransactionCount] = useState(5),
    [promo, setPromo] = useState(""),
    [tasks, setTasks] = useState<any[]>([]),
    [claims, setClaims] = useState<string[]>([]);
  const openCheckout = (product: Product) => {
    if (product.kind === "vip" && store.vip && (store.vipMemberships.some(item => item.product_id === product.id) || !store.vipMemberships.some(item => item.provider === "google_play"))) { setOwnedVisible(true); void store.refreshEntitlements().catch(() => {}); return; }
    setCheckout(product); setCheckoutVisible(true); void billing.refresh().catch(() => {});
  };
  useEffect(() => { if (billing.notice) setCheckoutVisible(false); }, [billing.notice]);
  useEffect(() => {
    requireData(
      db.from("dbs_google_play_products").select("*").order("sort_order"),
    )
      .then(setProducts)
      .catch(() => {});
    requireData(db.from("dbs_tasks").select("*").eq("active", true))
      .then(setTasks)
      .catch(() => {});
    if (accountUser)
      requireData(
        db
          .from("dbs_user_tasks")
          .select("tasks_id,claimed_at")
          .not("claimed_at", "is", null),
      )
        .then((rows) => setClaims(rows.map((r: any) => r.tasks_id)))
        .catch(() => {});
    else setClaims([]);
  }, [accountUser]);
  useEffect(() => {
    if (["store", "vip", "wallet"].includes(page)) void refresh().catch(() => {});
  }, [page, refresh]);
  useEffect(() => { setVisibleTransactionCount(5); }, [accountUser, page, filter]);
  const filteredTransactions = store.transactions.filter(tx => filter === "all" || (filter === "earned" ? tx.amount > 0 : tx.amount < 0));
  const logged = !!store.session,
    coins = products.filter((p) => p.kind === "coins"),
    plans = products.filter((p) => p.kind === "vip"),
    currentPlan = plans.find((p) => p.billing_period === selected);
  const selectedOwned = !!currentPlan && store.vipMemberships.some(item => item.product_id === currentPlan.id);
  const changingPlan = checkout?.kind === "vip" && store.vipMemberships.some(item => item.provider === "google_play" && item.product_id !== checkout.id);
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
            ...(Platform.OS === "android" ? [["eye-off-outline", "Reklamsız"]] : [["ribbon-outline", "VIP rozeti"]]),
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
  const managePlay = <Button secondary small icon="open-outline" onPress={() => void Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.draborneagle.drabornseries")}>Google Play aboneliklerimi yönet</Button>;
  const billingTools = (testID: string) => <ActionRow testID={testID} actions={[
    { label: "Google Play fiyatlarını yenile", icon: "reload", color: colors.mint, disabled: billing.busy, onPress: () => void refresh() },
    { label: billing.restoring ? "Geri yükleniyor…" : "Satın alımlarımı geri yükle", icon: "refresh", color: colors.purple, disabled: billing.busy, onPress: () => void needLogin(() => billing.restore()) },
  ]} />;
  const planCards = (
    <View style={{ gap: 12 }}>
      {periods.map(([id, title, length], i) => {
        const product = plans.find((p) => p.billing_period === id);
        const active = selected === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
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
                <Text style={{ color: "#ffe0b3", fontSize: billing.prices[product?.id || "dbs_vip_" + id] ? 24 : 14, fontWeight: "900" }}>
                  {billing.prices[product?.id || "dbs_vip_" + id] || "Fiyat yükleniyor…"}
                </Text>
                <Text
                  style={{
                    color: colors.orange,
                    fontWeight: "900",
                    fontSize: 19,
                  }}
                >
                  VIP
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
                accessibilityLabel={`${p.coins} BornCoins paketi, ${billing.prices[p.id] || "fiyat yükleniyor"}`}
                onPress={() => openCheckout(p)}
                style={{ width: "47.8%", flexGrow: 1, minWidth: 135 }}
              >
                <LinearGradient
                  colors={
                    i === 2 ? ["#5b2e43", "#27172f"] : ["#302040", "#161021"]
                  }
                  style={{
                    padding: 17,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: i === 2 ? colors.orange : "#392841",
                    minHeight: 205,
                    overflow: "hidden",
                    gap: 8,
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
                        fontSize: 12,
                        fontWeight: "900",
                        borderTopRightRadius: 22,
                        borderBottomLeftRadius: 10,
                      }}
                    >
                      +{p.bonus_coins} BONUS
                    </Text>
                  )}
                  <View style={[styles.row, { gap: 8, marginTop: 23, flexWrap: "wrap" }]}>
                    <Icon name="dbs-coin" color="#ffba72" size={30} />
                    <Text
                      style={{ color: "#fff4da", fontSize: 34, fontWeight: "900", letterSpacing: -0.8 }}
                    >
                      {p.coins - (p.bonus_coins || 0)}
                    </Text>
                  </View>
                  <Text style={{ color: "#cbb6dd", fontSize: 13, fontWeight: "700" }}>BornCoins</Text>
                  <View style={{ marginTop: "auto", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#ffffff16", gap: 6 }}>
                    {billing.prices[p.id] ? <Text style={{ color: "#ffd295", fontSize: 24, fontWeight: "900" }}>{billing.prices[p.id]}</Text>
                      : <View style={[styles.row, { gap: 7 }]}><ActivityIndicator size="small" color="#ffb67b" /><Text style={{ color: "#cbb6dd", fontSize: 13, flex: 1 }}>Fiyat yükleniyor…</Text></View>}
                    <Text style={{ color: "#ac95bc", fontSize: 12 }}>Tek seferlik ödeme</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.h2}>Sınırsız hikâyelere bir adım</Text>
        {planCards}
        <AnimatedCTA active={page === "store" && !checkoutVisible && !billing.notice} onPress={() => go("vip")} icon="diamond">
          VIP avantajlarını keşfet
        </AnimatedCTA>
        {billingTools("store-billing-tools")}
        {managePlay}
        <Text style={styles.body}>
          {billing.message}
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
        </LinearGradient>
        {store.vip && <VipStatus membership={store.vipMemberships[0]} expiresAt={store.vipEnd} />}
        {planCards}
        <AnimatedCTA
          active={page === "vip" && !checkoutVisible && !billing.notice}
          icon="diamond"
          onPress={() => currentPlan && openCheckout(currentPlan)}
          style={{ alignSelf: "stretch" }}
        >
          {selectedOwned ? "Aktif VIP üyeliğimi gör" : store.vip ? "Seçili pakete geç" : "Seçili paketi incele"}
        </AnimatedCTA>
        {billingTools("vip-billing-tools")}
        <Text style={styles.h2}>VIP dünyanda neler var?</Text>
        <Text style={{ color: "#cbb7d8", fontSize: 14, lineHeight: 22, marginTop: -12 }}>Her cihazında seninle olan ayrıcalıklarını keşfet.</Text>
        <VipBenefits />
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
        <LinearGradient colors={["#254044", "#29203f", "#171222"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, borderRadius: 26, borderWidth: 1, borderColor: "#9ce9d535", gap: 18 }}>
          <View style={styles.row}>
            <LinearGradient colors={["#9ce9d5", "#7c79e8"]} style={{ width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><Icon name="ticket" color="#182438" size={29} /></LinearGradient>
            <View style={{ flex: 1, gap: 6 }}><Text style={{ color: "#a6eada", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>SANA ÖZEL HEDİYELER</Text><Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>Promosyon kodunu kullan</Text></View>
          </View>
          <Field label="Promosyon kodu" placeholder="Örn. DBS2026" value={promo} onChangeText={setPromo} autoCapitalize="characters" autoCorrect={false} maxLength={64} />
          <Button icon="sparkles" disabled={!promo.trim()} onPress={() => needLogin(async () => {
            const prize = await rpc<PromoReward>("dbs_redeem_reward", { code: promo.trim() });
            setPromoReward(prize); await store.refreshAccount(); setPromo("");
          })}>Kodu uygula</Button>
          <Text style={{ color: "#c2d0de", fontSize: 14, lineHeight: 21 }}>Koduna tanımlı BornCoins ve VIP günleri hesabına eklenir. Her kod bir kez kullanılabilir.</Text>
        </LinearGradient>
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
        {filteredTransactions
          .slice(0, visibleTransactionCount)
          .map((tx) => (
            <View testID="transaction-row" key={tx.id} style={[panel, styles.row, { padding: 16 }]}>
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
        {filteredTransactions.length > visibleTransactionCount && <Button testID="transaction-more" secondary small icon="chevron-down"
          onPress={() => setVisibleTransactionCount(count => count + 5)}>Daha Fazla</Button>}
        {!filteredTransactions.length && (
          <Text style={styles.body}>
            {store.transactions.length ? "Bu filtrede henüz bir işlem yok." : "Henüz bir işlem yok. Günlük ödülünle başlayabilirsin."}
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
            testID="daily-reward-claim"
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
        <LinearGradient colors={["#613048", "#35234d", "#17323c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 23, borderRadius: 25, borderWidth: 1, borderColor: "#ffb88b50", gap: 14 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={{ color: "#ffd595", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>HİKÂYENE BONUS EKLE</Text><Icon name="sparkles" size={27} color="#ffd595" /></View>
          <Text style={{ color: "#fff", fontSize: 25, lineHeight: 31, fontWeight: "900" }}>Küçük adımlar,{`\n`}yeni hikâyeler.</Text>
          <Text style={{ color: "#e8d3e8", fontSize: 14, lineHeight: 21 }}>Görevleri tamamla, ödülünü al. Kazandığın BornCoins tüm cihazlarında seninle.</Text>
          <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={{ color: "#b8efdd", fontSize: 12, fontWeight: "800" }}>{tasks.filter(task => claims.includes(task.id)).length} / {tasks.length} görev tamamlandı</Text><Icon name="dbs-coin" color="#ffd18f" size={21} /></View>
          <View style={{ height: 6, borderRadius: 9, backgroundColor: "#ffffff15", overflow: "hidden" }}><LinearGradient colors={["#ff8bb9", "#ffc576", "#8be9d6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, width: `${tasks.filter(task => claims.includes(task.id)).length / Math.max(1, tasks.length) * 100}%` }} /></View>
        </LinearGradient>
        <View style={{ gap: 13 }}>
          {tasks.map((task, index) => {
            const claimed = claims.includes(task.id), accent = ["#ffc47f", "#ff89bc", "#aaadff"][index % 3];
            return <LinearGradient key={task.id} colors={claimed ? ["#193938", "#191a2c"] : [accent + "24", "#1a1427"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, borderRadius: 24, gap: 15, borderWidth: 1, borderColor: claimed ? "#83e6cd40" : accent + "45" }}>
              <View style={[styles.row, { alignItems: "flex-start", gap: 13 }]}>
                <LinearGradient colors={claimed ? ["#8ae7cf", "#69bfc9"] : [accent, "#be7bed"]} style={{ width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={claimed ? "checkmark" : task.id === "welcome" ? "gift" : task.id === "favorite" ? "heart" : "person-circle"} color="#2e203e" size={29} />
                </LinearGradient>
                <View style={{ flex: 1, gap: 7 }}><Text style={{ color: "#fff", fontSize: 17, lineHeight: 23, fontWeight: "900" }}>{task.name}</Text><Text style={{ color: "#c8bad4", fontSize: 13, lineHeight: 20 }}>{task.description}</Text></View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <View style={[styles.row, { backgroundColor: accent + "15", padding: 10, borderRadius: 14, gap: 7 }]}><Icon name="dbs-coin" color={accent} size={20} /><Text style={{ color: accent, fontSize: 16, fontWeight: "900" }}>+{task.data?.coins || 0}</Text><Text style={{ color: "#d9cce4", fontSize: 12, fontWeight: "700" }}>BornCoins</Text></View>
                {claimed
                  ? <Button small secondary icon="checkmark-circle" disabled onPress={() => {}}>Ödül alındı</Button>
                  : <Button small testID={`reward-claim-${task.id}`} icon="gift-outline" onPress={() => needLogin(() => claim(task.id))}>Ödülü al</Button>}
              </View>
            </LinearGradient>;
          })}
        </View>
        {Platform.OS === "android" && <LinearGradient colors={["#793047", "#412251", "#201732"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 24, borderRadius: 26, gap: 18, borderWidth: 1, borderColor: "#ffb27a45" }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <LinearGradient colors={["#ffc16c", "#ff639f"]} style={{ width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" }}><Icon name="play" size={30} color="#382039" /></LinearGradient>
            <Text style={{ color: "#ffe0ae", fontSize: 10, fontWeight: "900", letterSpacing: 1.3, backgroundColor: "#ffffff12", borderRadius: 20, padding: 10 }}>{adTestMode ? "TEST REKLAMI" : "BORNCOINS BONUSU"}</Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 23, fontWeight: "900" }}>Reklam izle, bonus kazan</Text>
          <Text style={{ color: "#f0d2e2", fontSize: 14, lineHeight: 21 }}>{adTestMode ? "Örnek reklamı izle ve deneyimi keşfet. Test reklamları BornCoins veya bölüm erişimi vermez." : "Reklamı tamamla, hikâyene yeni bir bonus ekle."}</Text>
          <AdRewardButton store={store} run={run} onLogin={() => go("auth")} onReward={setReward} />
        </LinearGradient>}
        <Pressable accessibilityRole="button" onPress={() => go("wallet")}>
          <LinearGradient colors={["#403758", "#243c44", "#172329"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22, borderRadius: 24, borderWidth: 1, borderColor: "#a7e9da30", flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "#9ce9d520", alignItems: "center", justifyContent: "center" }}><Icon name="ticket-outline" color="#9ce9d5" size={27} /></View>
            <View style={{ flex: 1, gap: 6 }}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Promosyon kodunu kullan</Text><Text style={{ color: "#c4d1df", fontSize: 14 }}>Kodunu gir, hediyelerini keşfet.</Text></View>
            <Icon name="arrow-forward" color="#9ce9d5" />
          </LinearGradient>
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
          <Row icon="help-buoy-outline" title="Destek" onPress={() => go("help")} color={colors.mint} />
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
        visible={checkoutVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setCheckoutVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000b5",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <ScrollView style={{ width: "100%", maxWidth: 540, maxHeight: "92%" }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 14) + 16 }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={checkout?.kind === "vip" ? ["#4c2440", "#2c1d40", "#15152b"] : ["#472b3c", "#2c1a3c", "#121426"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: "100%",
              maxWidth: 540,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 28,
              paddingBottom: 40,
              backgroundColor: "#1c1129",
              borderWidth: 1,
              borderColor: "#ffc58d70",
              gap: 18,
            }}
          >
            <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={{ color: "#ffcf96", fontWeight: "900", fontSize: 10, letterSpacing: 2 }}>DRABORNSERIES · {checkout?.kind === "vip" ? "VIP AYRICALIKLARI" : "BORNCOINS"}</Text><Icon name="sparkles" color="#ffd08a" size={24} /></View>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={[styles.h2, { flex: 1 }]}>
                {checkout?.kind === "vip"
                  ? checkout.title
                  : `${checkout?.coins} BornCoins`}
              </Text>
              <Pressable
                accessibilityLabel="Kapat"
                onPress={() => setCheckoutVisible(false)}
              >
                <Icon name="close-circle" size={30} />
              </Pressable>
            </View>
            <Text style={styles.body}>
              {checkout?.kind === "vip"
                ? changingPlan ? "Yeni planın mevcut Google Play aboneliğinin yerini alır. Android ve webde aynı hesabınla devam edersin." : "Seçtiğin VIP paketi Android ve webde aynı hesabınla geçerli."
                : "BornCoins ile uygun bölümleri kalıcı olarak hesabına açabilirsin."}
            </Text>
            {checkout && <LinearGradient colors={["#ffbd7025", "#e376c515", "#9576e51a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 21, borderRadius: 22, gap: 10, borderWidth: 1, borderColor: "#ffd09b45" }}>
              <View style={styles.row}><Icon name={checkout.kind === "vip" ? "diamond" : "dbs-coin"} color="#ffd38b" size={31} /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: "#ffd499", fontSize: 31, fontWeight: "900" }}>{billing.prices[checkout.id] || "Fiyat yükleniyor…"}</Text><Text style={{ color: "#dfc9e3", fontSize: 12 }}>{checkout.kind === "vip" ? `${periods.find(period => period[0] === checkout.billing_period)?.[1] || "VIP"} · Otomatik yenilenen abonelik` : "Tek seferlik ödeme"}</Text></View></View>
              {!!checkout.bonus_coins && <Text style={{ color: "#ff9acb", fontWeight: "800", fontSize: 13 }}>+{checkout.bonus_coins} bonus BornCoins dahil</Text>}
            </LinearGradient>}
            {checkout?.kind === "vip" && <VipPurchaseBenefits />}
            {changingPlan && <View style={{ borderRadius: 14, padding: 13, backgroundColor: "#89e4cb12", gap: 5 }}><Text style={{ color: "#94ebd6", fontWeight: "800", fontSize: 13 }}>Paket değişikliği</Text><Text style={{ color: "#d1c5df", fontSize: 12, lineHeight: 18 }}>Mevcut döneminin kalan değeri Google Play tarafından yeni planına aktarılır. Yeni ücret ve yenileme tarihi onay ekranında gösterilir.</Text></View>}
            <View style={[panel, { borderColor: "#9a73df65", backgroundColor: "#171a2c", padding: 18, gap: 11 }]}>
              <View style={styles.row}><Icon name="shield-checkmark" color="#89e4cb" size={23} />
              <Text
                style={{ color: "#ffb7d2", fontSize: 15, fontWeight: "800" }}
              >
                {checkout?.kind === "vip" ? "Google Play aboneliği" : "BornCoins paketi"}
              </Text>
              </View>
              <Text style={[styles.body, { color: "#ccc0da", fontSize: 12, lineHeight: 20 }]}>
                {checkout?.kind === "coins" ? "Tek seferlik ödeme. Paket ve bonus BornCoins aynı hesabınla Android ve webde kullanılabilir. " + billing.message : billing.message}
                {checkout?.kind === "vip" && " Abonelik otomatik yenilenir. Bir sonraki yenilemeyi Google Play aboneliklerinden iptal edebilirsin. Ücret ve dönem Google Play onay ekranında gösterilir."}
              </Text>
            </View>
            <AnimatedCTA
              active={checkoutVisible && !billing.notice}
              onPress={() => {
                if (Platform.OS === "web") { void run(() => Linking.openURL(config.playStoreUrl)); }
                else if (checkout?.kind === "vip" && store.vipMemberships.some(item => item.product_id === checkout.id)) { setCheckoutVisible(false); setOwnedVisible(true); }
                else if (checkout) void needLogin(() => billing.buy(checkout.id));
              }}
              disabled={Platform.OS === "web" ? !checkout?.active : !billing.ready || billing.busy || !checkout?.active || !billing.available.includes(checkout.id)}
              icon="card-outline"
              style={{ alignSelf: "stretch" }}
            >
              {billing.busy ? "Google Play işlemi sürüyor…" : checkout?.kind === "coins" ? "Google Play ile Ödeme Yap" : "Google Play ile Abone Ol"}
            </AnimatedCTA>
            {billingTools("checkout-tools")}
            {Platform.OS !== "android" && <Text style={styles.body}>Ödemeyi Android uygulamasında tamamlayabilirsin.</Text>}
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
          </LinearGradient>
          </ScrollView>
        </View>
      </Modal>
      <VipPopup visible={ownedVisible} alreadyOwned store={store} onClose={() => setOwnedVisible(false)} onStore={() => { setOwnedVisible(false); go("store"); }} />
      <RewardPopup reward={promoReward} onClose={() => setPromoReward(null)} />
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
