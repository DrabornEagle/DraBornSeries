import React, { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { vipCountdown, vipPlanLabel, type VipMembership } from "../shared/vip";
import { Icon, styles } from "./theme";

export default function VipStatus({ membership, expiresAt, active = true }: { membership?: VipMembership | null; expiresAt?: string | null; active?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => { if (AppState.currentState === "active") setNow(Date.now()); };
    update(); const timer = setInterval(update, 30000), listener = AppState.addEventListener("change", update);
    return () => { clearInterval(timer); listener.remove(); };
  }, [expiresAt, membership?.expires_at]);
  const end = membership?.expires_at || expiresAt, countdown = vipCountdown(end, now);
  const entitled = active && countdown.active;
  return <LinearGradient colors={["#462239", "#282046", "#142a35"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    style={{ borderRadius: 24, padding: 20, gap: 17, borderWidth: 1, borderColor: "#ffd29550", width: "100%", overflow: "hidden" }}>
    <View style={[styles.row, { gap: 10, flexWrap: "wrap" }]}>
      <View style={{ backgroundColor: "#ffc78020", borderRadius: 13, padding: 9 }}><Icon name="diamond" size={24} color="#ffd295" /></View>
      <View style={{ flex: 1, minWidth: 130, gap: 4 }}><Text style={{ color: "#fff3d8", fontSize: 18, fontWeight: "900" }}>{vipPlanLabel(membership?.product_id, membership?.provider)}</Text>
        <Text style={{ color: entitled ? "#8eebd5" : "#dccbe6", fontSize: 12, fontWeight: "700" }}>{entitled ? "Ayrıcalıkların aktif" : "Üyelik durumun"}</Text></View>
      <Icon name={entitled ? "checkmark-circle" : "time-outline"} color={entitled ? "#8eebd5" : "#ffd295"} size={25} />
    </View>
    {membership?.is_test && <View style={{ backgroundColor: "#ffc78015", padding: 11, borderRadius: 12, gap: 5 }}>
      <Text style={{ color: "#ffd295", fontSize: 11, fontWeight: "900" }}>GOOGLE PLAY TEST ABONELİĞİ</Text>
      <Text style={{ color: "#decfe5", fontSize: 12, lineHeight: 18 }}>Testte haftalık ve aylık paketler yaklaşık 5 dakikada, yıllık paket 30 dakikada yenilenir. Aşağıdaki süre bu test dönemine aittir.</Text>
    </View>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <View style={{ flex: 1, minWidth: 125, padding: 14, borderRadius: 17, backgroundColor: "#ffcd8414", gap: 6 }}>
        <Text style={{ color: "#efcda8", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>KALAN SÜRE</Text>
        <Text accessibilityLiveRegion="polite" style={{ color: "#ffe6b0", fontSize: 21, fontWeight: "900" }}>{countdown.daysLabel}</Text>
        <Text style={{ color: "#d2bdd5", fontSize: 12 }}>{countdown.detail}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 125, padding: 14, borderRadius: 17, backgroundColor: "#98e8da10", gap: 6 }}>
        <Text style={{ color: "#a9dcd6", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{membership?.auto_renew ? "YENİLEME TARİHİ" : "BİTİŞ TARİHİ"}</Text>
        <Text style={{ color: "#f2fffb", fontSize: 17, fontWeight: "900" }}>{end ? new Date(end).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) : "Güncelleniyor"}</Text>
        {end && <Text style={{ color: "#c1d7de", fontSize: 12 }}>{new Date(end).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Text>}
      </View>
    </View>
    <View style={[styles.row, { gap: 8, alignItems: "flex-start" }]}>
      <Icon name={membership?.auto_renew ? "sync-outline" : "information-circle-outline"} color="#d9a8ff" size={17} />
      <Text style={{ flex: 1, color: "#ddcfe8", fontSize: 12, lineHeight: 18 }}>{membership?.provider === "google_play"
        ? membership.auto_renew ? "Google Play otomatik yenilemesi açık. Tarih, mevcut ödenmiş dönemin sonudur." : "Otomatik yenileme kapalı. VIP erişimin bitiş tarihine kadar devam eder."
        : "VIP erişimin aynı hesabınla Android ve webde geçerli."}</Text>
    </View>
  </LinearGradient>;
}
