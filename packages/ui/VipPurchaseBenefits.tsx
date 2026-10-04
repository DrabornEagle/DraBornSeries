import React from "react";
import { Text, View } from "react-native";
import { Icon } from "./theme";

const benefits: { icon: React.ComponentProps<typeof Icon>["name"]; title: string; detail: string; color: string }[] = [
  { icon: "videocam-outline", title: "1080p / 4K", detail: "FULL HD · ULTRA HD", color: "#8ddff5" },
  { icon: "infinite", title: "Sınırsız İzleme", detail: "VIP diziler ve bölümler", color: "#d5abff" },
  { icon: "shield-checkmark-outline", title: "Reklamsız", detail: "Kesintisiz VIP deneyimi", color: "#ffb992" },
  { icon: "sync-outline", title: "Android + Web", detail: "Aynı hesap, aynı VIP", color: "#8ee6d1" },
];

export default function VipPurchaseBenefits() {
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {benefits.map(item => <View key={item.title} style={{ width: "48%", flexGrow: 1, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: item.color + "35", backgroundColor: "#17132390", gap: 9 }}>
        <Icon name={item.icon} size={25} color={item.color} />
        <Text style={{ color: "#fff7ff", fontSize: 15, fontWeight: "900" }}>{item.title}</Text>
        <Text style={{ color: item.color, fontSize: 10, fontWeight: "700", lineHeight: 16 }}>{item.detail}</Text>
      </View>)}
    </View>
    <Text style={{ color: "#bdafcd", fontSize: 11, lineHeight: 17 }}>Görüntü kalitesi içeriğin, cihazının ve bağlantının desteklediği çözünürlüğe bağlıdır.</Text>
  </View>;
}
