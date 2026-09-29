import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { Button } from "./theme";
export default function AnimatedCTA(props: React.ComponentProps<typeof Button>) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => { if (mounted && !reduced) loop.start(); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => {
      if (reduced) { loop.stop(); pulse.setValue(0); } else loop.start();
    });
    return () => { mounted = false; loop.stop(); subscription.remove(); };
  }, [pulse]);
  return <Animated.View style={{ alignSelf: "stretch", transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.016] }) }] }}>
    <Button {...props} style={[{ alignSelf: "stretch" }, props.style]} />
  </Animated.View>;
}
