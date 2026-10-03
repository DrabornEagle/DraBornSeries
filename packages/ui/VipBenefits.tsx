import React from "react";
import { Platform, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, styles } from "./theme";

export default function VipBenefits({ compact = false }: { compact?: boolean }) {
  const benefits: { icon: React.ComponentProps<typeof Icon>["name"]; title: string; detail: string; color: string; tag: string }[] = [
    { icon: "play-circle", title: "VIP içerik koleksiyonları", detail: "VIP kapsamındaki dizileri ve bölümleri sınırsız izle.", color: "#ffaf70", tag: "KEŞFET" },
    ...(Platform.OS === "android" ? [{ icon: "eye-off" as const, title: "Reklamsız izleme", detail: "VIP hesabında hikâyene kesintisiz devam et.", color: "#ff83bd", tag: "KESİNTİSİZ" }] : []),
    { icon: "flash", title: "Erken erişim", detail: "Erken erişime açılan uygun içeriklere ulaş.", color: "#d2a0ff", tag: "ÖNCELİK" },
    { icon: "ribbon", title: "Sana özel VIP rozeti", detail: "Profilinde ayrıcalığını göster, üyeliğini tek dokunuşla gör.", color: "#ffd385", tag: "AYRICALIK" },
    { icon: "sync", title: "Android + Web", detail: "Aynı hesap, aynı VIP. Hikâyen cihazların arasında seninle.", color: "#83e7d4", tag: "SENKRON" },
  ];
  return <View style={{ gap: compact ? 9 : 12 }}>{benefits.map(item => <LinearGradient key={item.title} colors={[item.color + "1b", "#1b1428"]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: compact ? 14 : 19, borderRadius: 21, gap: 11, borderWidth: 1, borderColor: item.color + "35" }}>
    <View style={[styles.row, { alignItems: "flex-start", gap: 12 }]}>
      <View style={{ width: compact ? 38 : 47, height: compact ? 38 : 47, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: item.color + "23" }}><Icon name={item.icon} color={item.color} size={compact ? 23 : 27} /></View>
      <View style={{ flex: 1, gap: 5 }}><Text style={{ color: "#fff6ff", fontWeight: "900", fontSize: compact ? 14 : 17 }}>{item.title}</Text>
        <Text style={{ color: "#c4b6d1", fontSize: compact ? 12 : 13, lineHeight: 19 }}>{item.detail}</Text></View>
      {!compact && <Icon name="checkmark-circle" color={item.color} size={19} />}
    </View>
    {!compact && <Text style={{ color: item.color, fontWeight: "900", fontSize: 9, letterSpacing: 1.7, marginLeft: 59 }}>{item.tag}</Text>}
  </LinearGradient>)}</View>;
}
