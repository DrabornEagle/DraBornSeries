import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "./theme";

const benefits: { icon: React.ComponentProps<typeof Icon>["name"]; title: string; detail: string; color: string; badges: string[] }[] = [
  { icon: "videocam", title: "1080p / 4K", detail: "İçeriğin desteklediği Full HD ve Ultra HD kalitesinde izle.", color: "#8ddff5", badges: ["FULL HD", "ULTRA HD"] },
  { icon: "infinite", title: "Sınırsız İzleme", detail: "VIP kapsamındaki dizileri ve bölümleri dilediğin kadar izle.", color: "#d5abff", badges: ["SINIRSIZ HİKÂYE"] },
  { icon: "shield-checkmark", title: "Reklamsız", detail: "VIP içeriklerini reklamsız, kesintisiz izle.", color: "#ffb992", badges: ["KESİNTİSİZ KEYİF"] },
];

export default function VipPurchaseBenefits() {
  return <View style={{ gap: 11 }}>
    {benefits.map(item => <LinearGradient key={item.title} colors={[item.color + "24", "#1c172d"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 17, borderRadius: 23, borderWidth: 1, borderColor: item.color + "45" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 13 }}>
        <LinearGradient colors={[item.color, item.color + "99"]} style={{ width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
          <Icon name={item.icon} size={27} color="#2d233e" />
        </LinearGradient>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ color: "#fff8ff", fontSize: 17, fontWeight: "900", lineHeight: 23 }}>{item.title}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {item.badges.map(badge => <Text key={badge} style={{ color: item.color, backgroundColor: item.color + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 }}>{badge}</Text>)}
          </View>
          <Text style={{ color: "#d4c5df", fontSize: 12, lineHeight: 19 }}>{item.detail}</Text>
        </View>
      </View>
    </LinearGradient>)}
  </View>;
}
