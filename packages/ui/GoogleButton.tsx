import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "./theme";

export default function GoogleButton({ onPress }: { onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ]));
    animation.start(); return () => animation.stop();
  }, [motion, reduced]);
  return <Pressable accessibilityRole="button" accessibilityLabel="Google ile devam et" onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 19, overflow: "hidden", opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
    <LinearGradient colors={["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#4285F4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 2 }}>
      <View style={{ backgroundColor: "#f7f9ff", minHeight: 60, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, overflow: "hidden" }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", inset: 0, opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.18] }) }}>
          <LinearGradient colors={["#4285F4", "#EA4335", "#FBBC05", "#34A853"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
        </Animated.View>
        <Icon name="logo-google" size={27} color="#4285F4" />
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#202737" }}>
          <Text style={{ color: "#4285F4" }}>G</Text><Text style={{ color: "#EA4335" }}>o</Text><Text style={{ color: "#B67E00" }}>o</Text><Text style={{ color: "#4285F4" }}>g</Text><Text style={{ color: "#18833C" }}>l</Text><Text style={{ color: "#EA4335" }}>e</Text> ile devam et
        </Text>
      </View>
    </LinearGradient>
  </Pressable>;
}
