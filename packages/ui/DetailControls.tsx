import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, Icon } from "./theme";

type IconName = React.ComponentProps<typeof Icon>["name"];
export function InfoBadge({ label, icon, color = colors.purple }: { label: string; icon: IconName; color?: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 13, borderWidth: 1, borderColor: color + "40", backgroundColor: color + "12" }}>
    <Icon name={icon} color={color} size={15} />
    <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
  </View>;
}

export function DetailAction({ label, icon, onPress, color = colors.purple, primary = false }: {
  label: string; icon: IconName; onPress: () => void; color?: string; primary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => ({ flexGrow: primary ? 0 : 1, opacity: pressed ? 0.75 : 1, borderRadius: 17, overflow: "hidden",
      borderWidth: 1, borderColor: primary ? "#fa7cba70" : color + "50" })}>
    <LinearGradient colors={primary ? ["#f03ba0", "#ab43d7"] : [color + "26", "#191121f5"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ minHeight: primary ? 58 : 49, paddingHorizontal: 17, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }}>
      <Icon name={icon} color={primary ? "#fff" : color} size={primary ? 22 : 19} />
      <Text style={{ color: primary ? "#fff" : "#f4eafa", fontSize: primary ? 15 : 13, fontWeight: "800", flexShrink: 1 }}>{label}</Text>
    </LinearGradient>
  </Pressable>;
}

export function DetailTabs({ items, value, onChange }: {
  items: { key: string; label: string; icon: IconName; color: string }[]; value: string; onChange: (key: string) => void;
}) {
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 5, padding: 6, backgroundColor: "#181020",
    borderWidth: 1, borderColor: "#9b66c830", borderRadius: 20 }}>
    {items.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label}
      accessibilityState={{ selected: value === item.key }} onPress={() => onChange(item.key)}
      style={{ flex: 1, overflow: "hidden", borderRadius: 15 }}>
      <LinearGradient colors={value === item.key ? [item.color + "38", item.color + "18"] : ["transparent", "transparent"]}
        style={{ minHeight: 62, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, paddingVertical: 10,
          borderWidth: 1, borderColor: value === item.key ? item.color + "70" : "transparent", borderRadius: 15 }}>
        <Icon name={item.icon} color={value === item.key ? item.color : colors.muted} size={18} />
        <Text style={{ color: value === item.key ? "#fff" : colors.muted, fontSize: 12, fontWeight: "800" }}>{item.label}</Text>
      </LinearGradient>
    </Pressable>)}
  </View>;
}
