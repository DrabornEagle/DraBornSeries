import React from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Store } from "../api/store";
import { Button, Icon, styles } from "./theme";
import VipStatus from "./VipStatus";
import AnimatedCTA from "./AnimatedCTA";

export default function VipPopup({ visible, store, alreadyOwned = false, onClose, onStore }: { visible: boolean; store: Store; alreadyOwned?: boolean; onClose: () => void; onStore: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1, padding: 18, backgroundColor: "#080512e8", justifyContent: "center", alignItems: "center" }}>
      <ScrollView style={{ width: "100%", maxWidth: 470, flexGrow: 0, maxHeight: "93%" }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#42243f", "#241632", "#100c1d"]} style={{ padding: 24, gap: 20, borderRadius: 30, borderWidth: 1, borderColor: "#ffd18b75" }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={{ color: "#ffce8b", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>SENİN VIP DÜNYAN</Text><Pressable accessibilityRole="button" accessibilityLabel="VIP bilgisini kapat" onPress={onClose} hitSlop={10}><Icon name="close-circle" size={29} /></Pressable></View>
          <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: "#fff", fontWeight: "900", fontSize: 28 }}>{store.vip ? alreadyOwned ? "VIP üyeliğin zaten aktif" : "Ayrıcalıkların seninle" : "VIP üyeliğin sona erdi"}</Text><Text style={{ color: "#dcc9e2", fontSize: 14, lineHeight: 21 }}>{store.vip ? alreadyOwned ? "Aynı paketi tekrar almana gerek yok. Farklı bir pakete geçmek için mağazadan yeni planını seçebilirsin." : "Paketin, kalan süren ve üyelik detayların burada." : "Güncel paketleri mağazada keşfedebilirsin."}</Text></View>
          <VipStatus membership={store.vipMemberships[0]} expiresAt={store.vipEnd} active={store.vip} />
          <View testID="vip-membership-features" style={{ flexDirection: "row", gap: 5 }}>{[["play-circle-outline", "VIP içerikler"], ["ribbon-outline", "VIP rozeti"], ["sync-outline", "Android + Web"]].map(([icon, label]) => <View key={label} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff08", paddingVertical: 11, paddingHorizontal: 3, borderRadius: 12, gap: 3 }}><Icon name={icon as any} color="#d4a7ff" size={13} /><Text numberOfLines={1} style={{ color: "#ebdcf9", fontSize: 10, fontWeight: "700" }}>{label}</Text></View>)}</View>
          <AnimatedCTA active={visible} onPress={onStore} icon="bag-handle-outline">Mağazayı keşfet</AnimatedCTA>
          {store.vipMemberships.some(item => item.provider === "google_play") && <Button secondary small style={{ alignSelf: "stretch" }} icon="open-outline" onPress={() => void Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.draborneagle.drabornseries")}>Google Play aboneliğimi yönet</Button>}
        </LinearGradient>
      </ScrollView>
    </View>
  </Modal>;
}
