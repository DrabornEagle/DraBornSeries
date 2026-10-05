import React, { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, colors } from "./theme";

type Action = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Icon>["name"];
  color?: string;
  disabled?: boolean;
};

export default function ActionRow({ actions, testID }: { actions: Action[]; testID?: string }) {
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const available = measuredWidth || Math.min(width - 80, 700);
  const characters = actions.reduce((sum, action) => sum + action.label.length, 0);
  const showIcons = available > (characters > 40 ? 420 : 290);
  const iconSpace = showIcons ? actions.filter(action => action.icon).length * 22 : 0;
  const fontSize = Math.max(8.5, Math.min(12, (available - actions.length * 12 - (actions.length - 1) * 6 - iconSpace) / (characters * 0.55)));
  return <View testID={testID} onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}
    style={{ flexDirection: "row", alignItems: "stretch", gap: 6, width: "100%" }}>
    {actions.map(action => {
      const color = action.color || colors.purple;
      return <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
        accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled} onPress={action.onPress}
        style={({ pressed }) => ({ flex: action.label.length + 4 + (showIcons && action.icon ? 4 : 0), minWidth: 0, opacity: action.disabled ? 0.4 : pressed ? 0.75 : 1 })}>
        <LinearGradient colors={[color + "24", color + "0c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ minHeight: 44, paddingHorizontal: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: color + "45", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {showIcons && action.icon && <Icon name={action.icon} size={16} color={color} />}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
            style={{ color: "#faf5ff", fontSize, fontWeight: "700", flexShrink: 1 }}>{action.label}</Text>
        </LinearGradient>
      </Pressable>;
    })}
  </View>;
}

export function AccentButton({ children, onPress, icon, gradient = ["#ed479e", "#a442d7", "#6451dc"], small = false, testID }: {
  children: string;
  onPress: () => void;
  icon: React.ComponentProps<typeof Icon>["name"];
  gradient?: [string, string, string];
  small?: boolean;
  testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={children} testID={testID} onPress={onPress}
    style={({ pressed }) => ({ alignSelf: "stretch", opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ minHeight: small ? 48 : 54, padding: small ? 10 : 12, borderRadius: 16, borderWidth: 1, borderColor: "#ffffff40", flexDirection: "row", alignItems: "center", gap: small ? 8 : 12 }}>
      <View style={{ width: small ? 28 : 32, height: small ? 28 : 32, borderRadius: 10, backgroundColor: "#ffffff20", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={small ? 18 : 21} /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, color: "#fff", fontSize: small ? 12 : 14, fontWeight: "800" }}>{children}</Text>
    </LinearGradient>
  </Pressable>;
}
