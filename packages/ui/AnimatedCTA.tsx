import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Icon } from "./theme";

type Props = React.ComponentProps<typeof Button> & { active?: boolean; testID?: string };
export default function AnimatedCTA({ children, onPress, icon, disabled = false, active = true, small = false, style, testID }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true, reduced = true;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
    ]));
    const update = () => {
      if (!live) return;
      loop.stop(); pulse.setValue(0);
      if (active && !disabled && !reduced && AppState.currentState === "active") loop.start();
    };
    if (Platform.OS === "web") {
      // RNW keys accessibility subscriptions by callback text; separate buttons
      // can otherwise remove each other's motion listeners when a page closes.
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const motionChanged = () => { reduced = media.matches; update(); };
      media.addEventListener("change", motionChanged);
      document.addEventListener("visibilitychange", update);
      motionChanged();
      return () => {
        live = false; loop.stop();
        media.removeEventListener("change", motionChanged);
        document.removeEventListener("visibilitychange", update);
      };
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { reduced = value; update(); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { reduced = value; update(); });
    const state = AppState.addEventListener("change", update);
    return () => { live = false; loop.stop(); motion.remove(); state.remove(); };
  }, [pulse, active, disabled]);
  return <Animated.View testID={testID} style={[{ alignSelf: small ? "flex-start" : "stretch", transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, small ? 1.035 : 1.012] }) }] }, style]}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <LinearGradient colors={["#f740a0", "#af38d2", "#6948e8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ minHeight: small ? 44 : 64, borderRadius: small ? 16 : 22, padding: small ? 10 : 16, paddingHorizontal: small ? 14 : 16, flexDirection: "row", alignItems: "center", gap: small ? 8 : 14, overflow: "hidden", borderWidth: 1, borderColor: "#ffc48780" }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "#ffffff", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }) }} />
        <Animated.View style={{ width: small ? 24 : 36, height: small ? 24 : 36, borderRadius: small ? 8 : 12, backgroundColor: "#ffffff20", alignItems: "center", justifyContent: "center", transform: [{ rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: small ? ["-7deg", "7deg"] : ["0deg", "0deg"] }) }] }}><Icon name={icon || "diamond"} size={small ? 18 : 24} color="#ffe7b9" /></Animated.View>
        <Text style={{ color: "white", fontSize: small ? 12 : 16, fontWeight: "900", flex: small ? undefined : 1, lineHeight: small ? 18 : 22 }}>{children}</Text>
        {!small && <Icon name="sparkles" color="#ffe7b9" size={23} />}
      </LinearGradient>
    </Pressable>
  </Animated.View>;
}
