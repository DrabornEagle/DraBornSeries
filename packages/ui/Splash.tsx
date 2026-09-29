import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Text,
  View,
  AccessibilityInfo,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "./theme";
export default function Splash({ ready }: { ready: boolean }) {
  const [minimum, setMinimum] = useState(false),
    [timeout, setTimedOut] = useState(false),
    [done, setDone] = useState(false),
    [reduced, setReduced] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current,
    opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const timer = setTimeout(() => setMinimum(true), 1700);
    const limit = setTimeout(() => setTimedOut(true), 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(limit);
    };
  }, []);
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);
  useEffect(() => {
    if ((ready || timeout) && minimum)
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduced ? 0 : 420,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => setDone(true));
  }, [ready, timeout, minimum, opacity, reduced]);
  if (done) return null;
  return (
    <Animated.View
      accessibilityLabel="DraBornSeries açılıyor"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        opacity,
        backgroundColor: "#08060f",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient
        colors={["#35142a", "#100a1c", "#08060f"]}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        style={{
          position: "absolute",
          width: 350,
          height: 350,
          borderWidth: 1,
          borderColor: "#e92d8730",
          borderRadius: 175,
          transform: [{ rotate: "-25deg" }],
        }}
      />
      <Animated.View
        style={{
          width: 180,
          height: 180,
          borderRadius: 60,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ed388515",
          borderWidth: 1,
          borderColor: "#e651ad60",
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1.06],
              }),
            },
          ],
        }}
      >
        <Image
          source={require("../../assets/icons/icon.png")}
          style={{ width: 132, height: 132, borderRadius: 36 }}
        />
      </Animated.View>
      <Text
        style={{
          color: "#fff",
          fontSize: 33,
          fontWeight: "900",
          marginTop: 32,
          letterSpacing: -1.5,
        }}
      >
        DraBorn<Text style={{ color: colors.pink }}>Series</Text>
      </Text>
      <Text
        style={{
          color: "#d6bedc",
          fontSize: 10,
          letterSpacing: 4.5,
          marginTop: 12,
        }}
      >
        KÜÇÜK BÖLÜMLER. BÜYÜK HİKÂYELER.
      </Text>
      <View
        style={{
          width: 140,
          height: 3,
          backgroundColor: "#ffffff10",
          marginTop: 45,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            height: 3,
            width: 65,
            backgroundColor: colors.pink,
            transform: [
              {
                translateX: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 75],
                }),
              },
            ],
          }}
        />
      </View>
      <Text style={{ color: "#95899e", marginTop: 18, fontSize: 12 }}>
        {ready ? "Perde açılıyor…" : "Hikâyeler yükleniyor…"}
      </Text>
      <Text
        style={{
          position: "absolute",
          bottom: 40,
          color: "#756480",
          fontSize: 10,
          letterSpacing: 3,
        }}
      >
        A DRABORNEAGLE EXPERIENCE
      </Text>
    </Animated.View>
  );
}
