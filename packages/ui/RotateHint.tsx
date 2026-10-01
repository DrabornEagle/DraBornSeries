import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import { Icon } from "./theme";

/** A fresh hint on every fullscreen entry for a landscape episode. */
export default function RotateHint({ fullscreen, presentationOpen = false, landscapeVideo, landscapeScreen }: {
  fullscreen: boolean; presentationOpen?: boolean; landscapeVideo: boolean; landscapeScreen: boolean;
}) {
  const [visible, setVisible] = useState(false), [reduced, setReduced] = useState(false);
  const previousFullscreen = useRef(false), previousPresentation = useRef(false), previousVideo = useRef(false);
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const entered = fullscreen && !previousFullscreen.current;
    const opened = presentationOpen && !previousPresentation.current;
    const loaded = landscapeVideo && !previousVideo.current;
    previousFullscreen.current = fullscreen;
    previousPresentation.current = presentationOpen;
    previousVideo.current = landscapeVideo;
    if ((!fullscreen && !presentationOpen) || !landscapeVideo || landscapeScreen) setVisible(false);
    else if (entered || opened || loaded) setVisible(true);
  }, [fullscreen, presentationOpen, landscapeVideo, landscapeScreen]);
  useEffect(() => {
    if (!visible) return;
    rotation.setValue(0);
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
