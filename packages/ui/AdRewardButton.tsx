import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import type { Store } from "../api/store";
import { adAvailable, adTestMode, adPlatformMessage, showRewardedAd } from "../api/ads";
import { Button, styles } from "./theme";
export default function AdRewardButton({ store, run, onLogin, episode, onReward, onDone }: { store: Store; run: (fn: () => Promise<unknown>, success?: string) => Promise<void>; onLogin: () => void; episode?: string; onReward?: (coins: number) => void; onDone?: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  if (Platform.OS !== "android") return null;
  return <View style={{ gap: 8, width: "100%", maxWidth: 420 }}><Button icon="play-circle-outline" disabled={busy || !adAvailable} onPress={() => {
    if (!store.session && !adTestMode) { onLogin(); return; }
    void run(async () => {
      setBusy(true); setMessage("");
      try {
        const result = await showRewardedAd(store.session?.user.id || "test-device", episode);
        if (result.mode === "test") setMessage(result.earned ? "Test reklamı tamamlandı. Örnek reklamlarda bakiyen ve bölüm erişimin değişmez." : "Test reklamı kapatıldı.");
        else if (result.earned) { await store.refreshAccount(); if (result.coins) onReward?.(result.coins); onDone?.(); setMessage(result.unlocked ? "Bölümün açıldı." : "Ödülün hesabına eklendi."); }
        else setMessage("Reklam tamamlanmadığı için ödül verilmedi.");
      } finally { setBusy(false); }
    });
  }}>{busy ? "Reklam yükleniyor…" : "Reklamı izle"}</Button><Text accessibilityLiveRegion="polite" style={[styles.body, { fontSize: 11, lineHeight: 17 }]}>{message || (!adAvailable ? adPlatformMessage : "Şimdilik AdMob örnek reklamları gösterilir.")}</Text></View>;
}
