import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "./theme";

/** One hint per device. Rotating never replaces the video or resets its time. */
export default function RotateHint({ fullscreen, landscapeVideo, landscapeScreen }: {
  fullscreen: boolean; landscapeVideo: boolean; landscapeScreen: boolean;
}) {
  const [visible, setVisible] = useState(false), [reduced, setReduced] = useState(false);
  const attempted = useRef(false), rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!fullscreen || landscapeScreen) { setVisible(false); return; }
    if (!landscapeVideo || attempted.current) return;
    attempted.current = true;
    let live = true;
    const key = "dbs-landscape-hint-v05";
    AsyncStorage.getItem(key).then(async (seen) => {
      if (seen || !live) return;
      await AsyncStorage.setItem(key, "shown");
      if (live) setVisible(true);
    }).catch(() => { if (live) setVisible(true); });
    return () => { live = false; };
  }, [fullscreen, landscapeVideo, landscapeScreen]);
  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => setVisible(false), 6000);
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(rotation, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(rotation, { toValue: 0, duration: 650, useNativeDriver: true }),
      Animated.delay(450),
    ]), { iterations: 2 });
    if (!reduced) animation.start();
    return () => { clearTimeout(timeout); animation.stop(); };
  }, [visible, reduced, rotation]);
  if (!visible) return null;
  return <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
    <View style={{ alignItems: "center", gap: 18, padding: 26, borderRadius: 24, backgroundColor: "#170f25ed", borderWidth: 1, borderColor: "#ba8cff80", maxWidth: 300 }}>
      <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-90deg"] }) }] }}>
        <Icon name="phone-portrait-outline" size={48} color="#e1c1ff" />
      </Animated.View>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }}>Cihazını yana çevir</Text>
      <Text style={{ color: "#d7c8e5", fontSize: 14, textAlign: "center", lineHeight: 21 }}>Yatay video ekranına sığar. İzlemeye kaldığın yerden devam edersin.</Text>
    </View>
  </View>;
}
