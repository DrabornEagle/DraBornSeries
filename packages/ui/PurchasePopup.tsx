import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Modal, Platform, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { PurchaseNotice } from "../api/billing-types";
import { Button, Icon, styles } from "./theme";
import AnimatedCTA from "./AnimatedCTA";
import VipStatus from "./VipStatus";
import { isCoinProduct } from "../api/billing-types";

export default function PurchasePopup({ notice, busy = false, onClose, onWallet, onVip, onManage, onRetry }: { notice: PurchaseNotice | null; busy?: boolean; onClose: () => void; onWallet: () => void; onVip: () => void; onManage: () => void; onRetry: () => void }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    entrance.setValue(0);
    if (notice) void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!live) return;
      if (reduced) entrance.setValue(1);
      else Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 145, mass: 0.8, useNativeDriver: Platform.OS !== "web" }).start();
    });
    return () => { live = false; entrance.stopAnimation(); };
  }, [notice, entrance]);
  if (!notice) return null;
  const success = notice.status === "success", pending = notice.status === "pending", coin = !!notice.coins || isCoinProduct(notice.productId);
  const restore = notice.kind === "restore", owned = notice.kind === "owned", info = notice.status === "info";
  const title = owned ? coin ? "Satın alımın zaten mevcut" : "VIP üyeliğin zaten mevcut"
    : restore ? busy ? "Satın alımların aranıyor" : notice.status === "error" ? "Geri yüklemeyi tamamlayalım" : pending ? "Ödemen onay bekliyor" : success ? "Satın alımların geri yüklendi" : "Hesabın güncellendi"
    : success ? coin ? "BornCoins hesabında!" : notice.restored ? "VIP üyeliğin doğrulandı" : "VIP dünyana hoş geldin"
    : pending ? "Ödeme onay bekliyor" : info ? "Üyelik durumun güncellendi" : notice.started === false ? "Ödeme başlatılamadı" : "Satın alımını doğrulayalım";
  return <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#07030ee8", padding: 22, alignItems: "center", justifyContent: "center" }}>
      <ScrollView style={{ width: "100%", maxWidth: 440, maxHeight: "95%", flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ width: "100%", maxWidth: 440, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <LinearGradient colors={owned || success ? ["#573044", "#302044", "#122432"] : restore ? ["#243a4d", "#282044", "#151023"] : ["#41213f", "#22182e", "#12101d"]}
          style={{ padding: 26, borderRadius: 30, borderWidth: 1, borderColor: owned || success ? "#ffc07185" : "#aa82d175", gap: 20, alignItems: "center" }}>
          <Text style={{ color: "#ffd9a2", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{restore ? "HESABIN TÜM CİHAZLARINDA SENİNLE" : "DRABORNSERIES · SANA ÖZEL"}</Text>
          <LinearGradient colors={["#ffc876", "#ff7fba", "#a97bf3"]} style={{ width: 90, height: 90, borderRadius: 30, alignItems: "center", justifyContent: "center" }}>
            {busy ? <ActivityIndicator size="large" color="#251434" /> : <Icon name={owned ? "shield-checkmark" : success ? coin ? "dbs-coin" : restore ? "checkmark-circle" : "diamond" : pending ? "time-outline" : info ? "sync" : "refresh-circle-outline"} size={49} color="#321b3b" />}
          </LinearGradient>
          <Text accessibilityRole="header" style={{ color: "#fff", fontWeight: "900", fontSize: 27, textAlign: "center" }}>{title}</Text>
          {success && coin && !restore && <View style={{ alignItems: "center", gap: 6 }}><Text style={{ color: "#ffd49b", fontSize: 48, fontWeight: "900" }}>{notice.restored ? "" : "+"}{notice.coins?.toLocaleString("tr-TR")}</Text><Text style={{ color: "#fff1d8", fontWeight: "800", fontSize: 18 }}>BornCoins{notice.restored ? " paketi" : " yüklendi"}</Text></View>}
          <Text accessibilityLiveRegion="polite" style={[styles.body, { textAlign: "center", color: "#e1d2ed", fontSize: 15, lineHeight: 23 }]}>{notice.message}</Text>
          {!coin && notice.expiresAt && <VipStatus expiresAt={notice.expiresAt} active={owned || !!notice.entitled} />}
          {restore && !busy && notice.verifiedCount !== undefined && <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>{[["Doğrulanan", notice.verifiedCount, "#ffd69b"], ["Bekleyen", notice.pendingCount || 0, "#d9b1ff"], ["Kontrol", notice.failedCount || 0, "#8de7d7"]].map(([label, value, color]) => <View key={String(label)} style={{ flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: String(color) + "15", alignItems: "center", gap: 5 }}><Text style={{ color: String(color), fontSize: 25, fontWeight: "900" }}>{value}</Text><Text style={{ color: "#d7c9e3", fontSize: 10, fontWeight: "700" }}>{label}</Text></View>)}</View>}
          {success && Number.isFinite(notice.balance) && <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#ffc47614", width: "100%", alignItems: "center", gap: 5 }}><Text style={{ color: "#cbb9d6", fontSize: 14 }}>Güncel cüzdanın</Text><Text style={{ color: "#ffe6b6", fontWeight: "900", fontSize: 24 }}>{notice.balance?.toLocaleString("tr-TR")} BornCoins</Text></View>}
          {success && notice.orderId && <Text selectable style={{ color: "#b19bc0", fontSize: 12, textAlign: "center" }}>Sipariş: {notice.orderId}</Text>}
          {!busy && <AnimatedCTA active={!busy} icon={owned ? "shield-checkmark-outline" : success || info ? "checkmark-circle-outline" : "refresh"}
            onPress={owned ? coin ? onRetry : onManage : success || info ? restore ? onClose : coin ? onWallet : onVip : onRetry}>
            {owned ? coin ? "Satın alımlarımı geri yükle" : "Mevcut aboneliğimi yönet" : success || info ? restore ? "Tamam, hesabım güncel" : coin ? "Cüzdanımı aç" : "VIP dünyamı aç" : notice.started === false ? "Tekrar dene" : "Tekrar doğrula"}
          </AnimatedCTA>}
          {owned && !coin && <Button secondary small onPress={onVip} style={{ alignSelf: "stretch" }}>VIP üyeliğimi gör</Button>}
          {(!restore || busy || notice.status === "error" || pending) && <Button secondary small onPress={onClose} style={{ alignSelf: "stretch" }}>{busy ? "Arka planda devam et" : "Kapat"}</Button>}
        </LinearGradient>
      </Animated.View>
      </ScrollView>
    </View>
  </Modal>;
}
