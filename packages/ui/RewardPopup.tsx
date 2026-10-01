import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Modal, Platform, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Icon, styles } from "./theme";
export type PromoReward = { coins: number; vip_days: number; vip_until?: string | null };
export default function RewardPopup({ reward, onClose }: { reward: PromoReward | null; onClose: () => void }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    if (reward) void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      Animated.spring(entrance, { toValue: 1, friction: 8, tension: 55, useNativeDriver: Platform.OS !== "web", ...(reduced ? { overshootClamping: true, tension: 1000 } : {}) }).start();
    });
  }, [reward, entrance]);
  return <Modal visible={!!reward} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#06030ce6", padding: 24, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: "100%", maxWidth: 440, opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
        <LinearGradient colors={["#492149", "#241536", "#130d22"]} style={{ padding: 28, borderRadius: 30, borderWidth: 1, borderColor: "#ffb77d80", gap: 20, alignItems: "center" }}>
          <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: "#ffcb7920", alignItems: "center", justifyContent: "center" }}><Icon name="gift" color="#ffd58c" size={48} /></View>
          <Text accessibilityRole="header" style={{ color: "white", fontWeight: "900", fontSize: 30 }}>Tebrikler!</Text>
          <Text style={[styles.body, { textAlign: "center", color: "#e5d1ed" }]}>Promosyon ödülün hesabına eklendi.</Text>
          {!!reward?.coins && <View style={{ width: "100%", padding: 18, borderRadius: 18, backgroundColor: "#ffa64a17", flexDirection: "row", alignItems: "center", gap: 14 }}><Icon name="dbs-coin" color="#ffc56f" size={32} /><Text style={{ fontWeight: "900", color: "#ffe2ab", fontSize: 24 }}>+{reward.coins} BornCoins</Text></View>}
          {!!reward?.vip_days && <View style={{ width: "100%", padding: 18, borderRadius: 18, backgroundColor: "#b883ff20", gap: 10 }}><View style={styles.row}><Icon name="diamond" color="#ffd58c" size={30} /><Text style={{ fontWeight: "900", color: "#ffe2ab", fontSize: 24 }}>+{reward.vip_days} gün VIP</Text></View>{!!reward.vip_until && <Text style={{ color: "#d8c6ee", fontSize: 14 }}>VIP bitişi: {new Date(reward.vip_until).toLocaleDateString("tr-TR")}</Text>}</View>}
          <Button icon="checkmark-circle-outline" onPress={onClose} style={{ alignSelf: "stretch" }}>Harika!</Button>
        </LinearGradient>
      </Animated.View>
    </View>
  </Modal>;
}
