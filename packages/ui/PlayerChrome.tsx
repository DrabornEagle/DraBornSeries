import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatTime } from "../shared/domain";
import { colors, Icon } from "./theme";
export type QualityChoice = { key: string; label: string };
type Props = {
  title?: string; time: number; duration: number; playing: boolean; muted: boolean; loading: boolean;
  quality: string; choices: QualityChoice[]; fullscreen: boolean; error?: string;
  onPlay: () => void; onSeek: (time: number) => void; onMute: () => void;
  onQuality: (key: string) => void; onFullscreen: () => void; onRetry: () => void;
  audio?: QualityChoice[]; onAudio?: (key: string) => void;
  onPiP?: () => void; subtitles?: QualityChoice[]; onSubtitle?: (key: string) => void;
};
export default function PlayerChrome(props: Props) {
  const [visible, setVisible] = useState(true), [settings, setSettings] = useState(false), [barWidth, setBarWidth] = useState(1);
  const [touch, setTouch] = useState(0);
  const wake = () => { setVisible(true); setTouch((value) => value + 1); };
  useEffect(() => {
    if (!props.playing || settings || props.loading || props.error) return;
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [props.playing, settings, props.loading, props.error, touch]);
  const control = (name: React.ComponentProps<typeof Icon>["name"], label: string, action: () => void, size = 23) =>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { wake(); action(); }}
      style={({ pressed }) => ({ minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color="white" />
    </Pressable>;
  const seek = (time: number) => { if (!Number.isFinite(time)) return; wake(); props.onSeek(Math.max(0, Math.min(props.duration || Infinity, time))); };
  return <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
    <Pressable accessibilityLabel="Oynatıcı kontrollerini göster veya gizle" onPress={() => { if (visible && !settings) setVisible(false); else wake(); }} style={{ position: "absolute", inset: 0 }} />
    {(visible || !props.playing || props.loading || !!props.error) && <>
      <LinearGradient pointerEvents="none" colors={["#05020da6", "transparent", "transparent", "#05020df2"]}
        locations={[0, 0.25, 0.6, 1]} style={{ position: "absolute", inset: 0 }} />
      <View pointerEvents="box-none" style={{ position: "absolute", top: props.fullscreen ? 30 : 10, left: 14, right: 12, flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: "#ed85c0", fontSize: 9, letterSpacing: 2, fontWeight: "900" }}>DRABORNSERIES</Text>
          <Text numberOfLines={2} style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{props.title || "Şimdi izleniyor"}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Video kalitesi ve altyazı" onPress={() => { wake(); setSettings(!settings); }}
          style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 10, borderRadius: 20, backgroundColor: "#201329ba", borderWidth: 1, borderColor: "#b97ab340" }}>
          <Icon name="settings-outline" size={18} /><Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{props.quality}</Text>
        </Pressable>
        {props.fullscreen && control("close", "Tam ekrandan çık", props.onFullscreen)}
      </View>
      {!settings && !props.error && <View pointerEvents="box-none" style={{ position: "absolute", top: "43%", left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 25 }}>
        {control("play-back", "10 saniye geri", () => seek(props.time - 10), 26)}
        <Pressable accessibilityRole="button" accessibilityLabel={props.playing ? "Duraklat" : "Oynat"} onPress={() => { wake(); props.onPlay(); }}
          style={{ width: 68, height: 68, borderRadius: 34, overflow: "hidden" }}>
          <LinearGradient colors={["#ff429cd9", "#944ee7d9"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {props.loading ? <ActivityIndicator color="white" /> : <Icon name={props.playing ? "pause" : "play"} size={34} color="white" />}
          </LinearGradient>
        </Pressable>
        {control("play-forward", "10 saniye ileri", () => seek(props.time + 10), 26)}
      </View>}
      {!!props.error && <View style={{ position: "absolute", top: "35%", left: 25, right: 25, alignItems: "center", gap: 15 }}>
        <Icon name="cloud-offline-outline" color={colors.pink} size={34} /><Text style={{ color: "white", textAlign: "center", fontSize: 13 }}>{props.error}</Text>
        <Pressable accessibilityRole="button" onPress={props.onRetry} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.pink }}><Text style={{ color: "white", fontWeight: "800" }}>Tekrar dene</Text></Pressable>
      </View>}
      <View style={{ position: "absolute", bottom: props.fullscreen ? 26 : 8, left: 15, right: 15, gap: 3 }}>
        <Pressable accessibilityRole="adjustable" accessibilityLabel="İzleme ilerlemesi" accessibilityValue={{ min: 0, max: Math.round(props.duration || 1), now: Math.round(props.time), text: formatTime(props.time) }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => seek(props.time + (event.nativeEvent.actionName === "increment" ? 10 : -10))}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          onPress={(event) => {
            const pointer = event.nativeEvent as unknown as { locationX?: number; clientX?: number };
            const target = event.currentTarget as unknown as { getBoundingClientRect?: () => { left: number; width: number } };
            const bounds = target.getBoundingClientRect?.();
            // Native presses expose locationX; web mouse clicks expose clientX.
            const x = Number.isFinite(pointer.locationX) ? pointer.locationX!
              : bounds && Number.isFinite(pointer.clientX) ? pointer.clientX! - bounds.left : NaN;
            const width = bounds?.width || barWidth;
            if (width > 0 && props.duration > 0) seek(x / width * props.duration);
          }}
          style={{ height: 28, justifyContent: "center" }}>
          <View pointerEvents="none" style={{ height: 3, borderRadius: 3, backgroundColor: "#ffffff45" }}>
            <View style={{ height: 3, borderRadius: 3, backgroundColor: colors.pink, width: `${Math.min(100, Math.max(0, props.time / (props.duration || 1) * 100))}%` }} />
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{formatTime(props.time)} <Text style={{ color: "#ffffff99" }}> / {formatTime(props.duration)}</Text></Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {control(props.muted ? "volume-mute-outline" : "volume-high-outline", props.muted ? "Sesi aç" : "Sessize al", props.onMute, 21)}
            {props.onPiP && control("browsers-outline", "Küçük pencerede izle", props.onPiP, 20)}
            {control(props.fullscreen ? "contract-outline" : "expand-outline", props.fullscreen ? "Tam ekrandan çık" : "Tam ekran", props.onFullscreen, 22)}
          </View>
        </View>
      </View>
    </>}
    {settings && <View style={{ position: "absolute", right: 12, top: props.fullscreen ? 92 : 70, width: 224, maxHeight: "65%", borderRadius: 18,
      borderWidth: 1, borderColor: "#ce77b850", backgroundColor: "#190e29f7", padding: 15, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: "white", fontWeight: "800" }}>Görüntü kalitesi</Text>
        {control("close", "Kalite menüsünü kapat", () => setSettings(false), 18)}</View>
      <ScrollView contentContainerStyle={{ gap: 5 }}>
        {props.choices.map((item) => <Pressable key={item.key} accessibilityRole="button" onPress={() => { wake(); props.onQuality(item.key); setSettings(false); }}
          style={{ padding: 12, borderRadius: 10, backgroundColor: props.quality === item.label ? "#6c265f" : "#ffffff07", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "white", fontSize: 12 }}>{item.label}</Text>{props.quality === item.label && <Icon name="checkmark" color={colors.pink} size={16} />}
        </Pressable>)}
        {!!props.audio?.length && <Text style={{ color: "#c5b5cd", fontSize: 12, marginTop: 12 }}>Ses dili</Text>}
        {props.audio?.map((item) => <Pressable key={item.key} onPress={() => { props.onAudio?.(item.key); setSettings(false); }} style={{ padding: 12 }}>
          <Text style={{ color: "white", fontSize: 12 }}>{item.label}</Text></Pressable>)}
        {!!props.subtitles?.length && <Text style={{ color: "#c5b5cd", fontSize: 12, marginTop: 12 }}>Altyazı</Text>}
        {props.subtitles?.map((item) => <Pressable key={item.key} onPress={() => { props.onSubtitle?.(item.key); setSettings(false); }} style={{ padding: 12 }}>
          <Text style={{ color: "white", fontSize: 12 }}>{item.label}</Text></Pressable>)}
      </ScrollView>
    </View>}
  </View>;
}
