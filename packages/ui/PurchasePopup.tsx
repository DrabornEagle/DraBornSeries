import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Modal, Platform, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { PurchaseNotice } from "../api/billing-types";
import { Button, Icon, styles } from "./theme";

export default function PurchasePopup({ notice, onClose, onWallet, onRetry }: { notice: PurchaseNotice | null; onClose: () => void; onWallet: () => void; onRetry: () => void }) {
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
  const success = notice.status === "success", pending = notice.status === "pending", coin = !!notice.coins;
  return <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#07030ee8", padding: 22, alignItems: "center", justifyContent: "center" }}>
      <ScrollView style={{ width: "100%", maxWidth: 440, maxHeight: "95%", flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ width: "100%", maxWidth: 440, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
        <LinearGradient colors={success ? ["#412445", "#21132f", "#120c20"] : ["#31223b", "#16101f"]}
          style={{ padding: 26, borderRadius: 30, borderWidth: 1, borderColor: success ? "#ffc07185" : "#aa82d175", gap: 20, alignItems: "center" }}>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: success ? "#ffa65720" : "#aa82d120", alignItems: "center", justifyContent: "center" }}>
            <Icon name={success ? coin ? "dbs-coin" : "diamond" : pending ? "time-outline" : "refresh-circle-outline"} size={48} color="#ffcc86" />
          </View>
          <Text accessibilityRole="header" style={{ color: "#fff", fontWeight: "900", fontSize: 26, textAlign: "center" }}>{success ? notice.restored ? "Satın alımın doğrulandı" : "Ödeme tamamlandı" : pending ? "Ödeme onay bekliyor" : notice.started === false ? "Ödeme başlatılamadı" : "Satın alımını doğrulayalım"}</Text>
          {success && coin && <View style={{ alignItems: "center", gap: 6 }}><Text style={{ color: "#ffd49b", fontSize: 48, fontWeight: "900" }}>{notice.restored ? "" : "+"}{notice.coins?.toLocaleString("tr-TR")}</Text><Text style={{ color: "#fff1d8", fontWeight: "800", fontSize: 18 }}>BornCoins{notice.restored ? " paketi" : " yüklendi"}</Text></View>}
          <Text accessibilityLiveRegion="polite" style={[styles.body, { textAlign: "center", color: "#e1d2ed", fontSize: 15, lineHeight: 23 }]}>{notice.message}</Text>
          {success && Number.isFinite(notice.balance) && <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#ffc47614", width: "100%", alignItems: "center", gap: 5 }}><Text style={{ color: "#cbb9d6", fontSize: 14 }}>Güncel cüzdanın</Text><Text style={{ color: "#ffe6b6", fontWeight: "900", fontSize: 24 }}>{notice.balance?.toLocaleString("tr-TR")} BornCoins</Text></View>}
          {success && notice.orderId && <Text selectable style={{ color: "#b19bc0", fontSize: 12, textAlign: "center" }}>Sipariş: {notice.orderId}</Text>}
          <Button icon={success ? "checkmark-circle-outline" : "refresh"} onPress={success ? coin ? onWallet : onClose : onRetry} style={{ alignSelf: "stretch" }}>{success ? coin ? "Cüzdanımı aç" : "Harika!" : notice.started === false ? "Tekrar dene" : "Tekrar doğrula"}</Button>
          {(!success || coin) && <Button secondary small onPress={onClose} style={{ alignSelf: "stretch" }}>Kapat</Button>}
        </LinearGradient>
      </Animated.View>
      </ScrollView>
    </View>
  </Modal>;
}
