import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
export const colors = {
  bg: "#09080f",
  panel: "#14111e",
  panel2: "#1e172a",
  line: "#302539",
  text: "#faf5ff",
  muted: "#a59aad",
  pink: "#f143a1",
  purple: "#a58aff",
  orange: "#ff9c61",
  mint: "#73e1cd",
};
export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  h1: {
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  h2: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  h3: { color: colors.text, fontSize: 17, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 22,
    gap: 14,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    padding: 15,
    borderRadius: 12,
    fontSize: 15,
    minHeight: 50,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    color: colors.pink,
  },
  section: { gap: 18, marginBottom: 36 },
});
export function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"] | "dbs-coin";
  size?: number;
  color?: string;
}) {
  if (name === "dbs-coin")
    return (
      <View
        accessibilityLabel="BornCoins"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1.5, size / 14),
          borderColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color,
            fontSize: size * 0.58,
            fontWeight: "900",
            lineHeight: size * 0.7,
          }}
        >
          B
        </Text>
      </View>
    );
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  small = false,
  style,
  testID,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          secondary ? [colors.panel2, colors.panel2] : [colors.pink, "#ac40d9"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: small ? 14 : 23,
          paddingVertical: small ? 10 : 15,
          borderRadius: small ? 10 : 14,
          borderWidth: secondary ? 1 : 0,
          borderColor: colors.line,
          flexDirection: "row",
          gap: 9,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon && <Icon name={icon} size={small ? 16 : 19} />}
        <Text
          style={{
            color: "#fff",
            fontSize: small ? 12 : 14,
            fontWeight: "800",
          }}
        >
          {children}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
export function Chip({
  label,
  active = false,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 30,
        backgroundColor: active ? "#f143a122" : colors.panel,
        borderWidth: 1,
        borderColor: active ? colors.pink : colors.line,
      }}
    >
      <Text
        style={{
          color: color || (active ? colors.pink : colors.muted),
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label?: string }) {
  return (
    <View style={{ gap: 8, flexGrow: 1 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="#6f667c"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}
export function Empty({
  title,
  detail,
  icon = "sparkles-outline",
  children,
}: {
  title: string;
  detail?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  children?: ReactNode;
}) {
  return (
    <View style={{ padding: 34, alignItems: "center", gap: 16 }}>
      <View
        style={{
          backgroundColor: colors.panel2,
          padding: 22,
          borderRadius: 30,
        }}
      >
        <Icon name={icon} size={30} color={colors.purple} />
      </View>
      <Text style={[styles.h3, { textAlign: "center" }]}>{title}</Text>
      {detail && (
        <Text style={[styles.body, { textAlign: "center", maxWidth: 480 }]}>
          {detail}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 70, alignItems: "center", gap: 18 }}>
      <ActivityIndicator color={colors.pink} />
      <Text style={styles.body}>DraBornSeries</Text>
    </View>
  );
}
