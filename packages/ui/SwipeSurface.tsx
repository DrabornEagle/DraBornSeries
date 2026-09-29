import React, { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Platform, View, type ViewStyle } from "react-native";
import { swipeStep } from "../shared/gestures";

// A gesture chooses a direction once. There is no native scroll momentum to skip items.
export default function SwipeSurface({ children, axis, extent, onStep, style, label }: {
  children: React.ReactNode; axis: "horizontal" | "vertical"; extent: number;
  onStep: (step: number) => void; style?: ViewStyle; label: string;
}) {
  const move = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const surface = useRef<React.ElementRef<typeof View>>(null);
  const latest = useRef({ extent, onStep });
  latest.current = { extent, onStep };
  const locked = useRef(false), wheelSum = useRef(0), wheelUsed = useRef(false);
  const horizontal = axis === "horizontal";
  const advance = useRef((step: number) => {
    if (!step || locked.current) return;
    locked.current = true;
    Animated.parallel([
      Animated.timing(move, { toValue: -step * 24, duration: 110, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(opacity, { toValue: 0.5, duration: 110, useNativeDriver: Platform.OS !== "web" }),
    ]).start(() => {
      latest.current.onStep(step);
      move.setValue(step * 18);
      Animated.parallel([
        Animated.timing(move, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== "web" }),
      ]).start(() => { locked.current = false; });
    });
  }).current;
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      const distance = horizontal ? gesture.dx : gesture.dy;
      const other = horizontal ? gesture.dy : gesture.dx;
      return !locked.current && Math.abs(distance) > 12 && Math.abs(distance) > Math.abs(other) * 1.2;
    },
    onPanResponderMove: (_, gesture) => move.setValue(Math.max(-45, Math.min(45, (horizontal ? gesture.dx : gesture.dy) * 0.25))),
    onPanResponderRelease: (_, gesture) => {
      const step = swipeStep(horizontal ? gesture.dx : gesture.dy, horizontal ? gesture.vx : gesture.vy, latest.current.extent);
      if (step) advance(step);
      else Animated.spring(move, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start();
    },
    onPanResponderTerminate: () => move.setValue(0),
    onPanResponderTerminationRequest: () => false,
  }), [horizontal, advance, move]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = surface.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    let idle: ReturnType<typeof setTimeout>;
    const wheel = (event: WheelEvent) => {
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta || (horizontal && Math.abs(event.deltaY) > Math.abs(delta))) return;
      event.preventDefault();
      clearTimeout(idle);
      idle = setTimeout(() => { wheelSum.current = 0; wheelUsed.current = false; }, 240);
      if (wheelUsed.current) return;
      wheelSum.current += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? latest.current.extent : 1);
      if (Math.abs(wheelSum.current) >= 45) {
        wheelUsed.current = true;
        advance(Math.sign(wheelSum.current));
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.target !== node || event.repeat) return;
      const step = event.key === (horizontal ? "ArrowRight" : "ArrowDown") ? 1
        : event.key === (horizontal ? "ArrowLeft" : "ArrowUp") ? -1 : 0;
      if (step) { event.preventDefault(); advance(step); }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("keydown", key);
    return () => { clearTimeout(idle); node.removeEventListener("wheel", wheel); node.removeEventListener("keydown", key); };
  }, [horizontal, advance]);
  return <View ref={surface} {...responder.panHandlers} accessibilityLabel={label}
    tabIndex={Platform.OS === "web" ? 0 : undefined}
    accessibilityActions={[{ name: "increment", label: "Sonraki" }, { name: "decrement", label: "Önceki" }]}
    onAccessibilityAction={(event) => advance(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    style={[style, Platform.OS === "web" ? { touchAction: horizontal ? "pan-y" : "none" } as ViewStyle : undefined]}>
    <Animated.View style={{ flex: horizontal ? undefined : 1, opacity, transform: [horizontal ? { translateX: move } : { translateY: move }] }}>{children}</Animated.View>
  </View>;
}
