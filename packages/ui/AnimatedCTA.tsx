import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Icon } from "./theme";

type Props = React.ComponentProps<typeof Button> & { active?: boolean };
export default function AnimatedCTA({ children, onPress, icon, disabled = false, active = true, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true, reduced = true;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
    ]));
    const update = () => {
      loop.stop(); pulse.setValue(0);
      if (live && active && !disabled && !reduced && AppState.currentState === "active") loop.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { reduced = value; update(); });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { reduced = value; update(); });
    const state = AppState.addEventListener("change", update);
    return () => { live = false; loop.stop(); motion.remove(); state.remove(); };
  }, [pulse, active, disabled]);
  return <Animated.View style={[{ alignSelf: "stretch", transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) }] }, style]}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <LinearGradient colors={["#f740a0", "#af38d2", "#6948e8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ minHeight: 64, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden", borderWidth: 1, borderColor: "#ffc48780" }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "#ffffff", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }) }} />
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#ffffff20", alignItems: "center", justifyContent: "center" }}><Icon name={icon || "diamond"} size={24} color="#ffe7b9" /></View>
        <Text style={{ color: "white", fontSize: 16, fontWeight: "900", flex: 1, lineHeight: 22 }}>{children}</Text>
        <Icon name="sparkles" color="#ffe7b9" size={23} />
      </LinearGradient>
    </Pressable>
  </Animated.View>;
}
