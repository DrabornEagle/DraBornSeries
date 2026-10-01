import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, type ScrollViewProps, Text, View } from "react-native";
import { colors, Icon } from "./theme";

/** Native RefreshControl plus a touch gesture for RN Web's nested scroll element. */
export default forwardRef<React.ElementRef<typeof ScrollView>, ScrollViewProps & { onRefresh: () => Promise<void>; refreshEnabled?: boolean }>(function RefreshScrollView({ onRefresh, refreshEnabled = true, children, ...props }, forwarded) {
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null), pending = useRef(false), refresh = useRef(onRefresh), enabled = useRef(refreshEnabled);
  const [refreshing, setRefreshing] = useState(false), [pull, setPull] = useState(0);
  refresh.current = onRefresh; enabled.current = refreshEnabled;
  useImperativeHandle(forwarded, () => scroll.current!, []);
  const run = useCallback(async () => {
    if (pending.current || !enabled.current) return;
    pending.current = true; setRefreshing(true); setPull(0);
    try { await refresh.current(); } finally { pending.current = false; setRefreshing(false); }
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = (scroll.current as unknown as { getScrollableNode: () => HTMLElement })?.getScrollableNode();
    if (!node) return;
    let start: { x: number; y: number } | null = null, distance = 0;
    const begin = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!enabled.current || pending.current || node.scrollTop > 1 || event.touches.length !== 1 || target?.closest("input,textarea,video,[role=slider],[role=adjustable],[data-no-refresh]")) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY }; distance = 0;
    };
    const move = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1 || node.scrollTop > 1) { start = null; setPull(0); return; }
      const dy = event.touches[0].clientY - start.y, dx = Math.abs(event.touches[0].clientX - start.x);
      if (dy < -8 || dx > Math.max(20, dy)) { start = null; distance = 0; setPull(0); return; }
      if (dy <= 12) return;
      if (event.cancelable) event.preventDefault();
      distance = Math.min(95, dy * 0.5); setPull(distance);
    };
    const end = () => { const activate = !!start && distance >= 65; start = null; distance = 0; setPull(0); if (activate) void run(); };
    const cancel = () => { start = null; distance = 0; setPull(0); };
    node.addEventListener("touchstart", begin, { passive: true }); node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end); node.addEventListener("touchcancel", cancel);
    return () => { node.removeEventListener("touchstart", begin); node.removeEventListener("touchmove", move); node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", cancel); };
  }, [run]);
  return <View style={{ flex: 1, overflow: "hidden" }}>
    {Platform.OS === "web" && (pull > 0 || refreshing) && <View accessibilityLiveRegion="polite" style={{ height: refreshing ? 52 : pull, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#251830" }}>
      {refreshing ? <ActivityIndicator color={colors.pink} /> : <Icon name={pull >= 65 ? "refresh" : "arrow-down"} color={colors.pink} size={20} />}<Text style={{ color: colors.text, fontSize: 12 }}>{refreshing ? "Yenileniyor…" : pull >= 65 ? "Yenilemek için bırak" : "Yenilemek için aşağı çek"}</Text>
    </View>}
    <ScrollView {...props} ref={scroll} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} enabled={refreshEnabled} onRefresh={() => void run()} tintColor={colors.pink} colors={[colors.pink, colors.purple]} />}>
      {children}
    </ScrollView>
  </View>;
});
