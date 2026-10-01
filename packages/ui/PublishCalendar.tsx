import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { calendarDays, localPublishTime, monthNames, publishTimeLabel } from "../shared/calendar";
import { Button, colors, Field, Icon, styles } from "./theme";
export default function PublishCalendar({ label, value, onChange, optional = false }: { label: string; value?: string; onChange: (value: string) => void; optional?: boolean }) {
  const [open, setOpen] = useState(false), [date, setDate] = useState(new Date()), [hour, setHour] = useState("21"), [minute, setMinute] = useState("00"), [error, setError] = useState("");
  const show = () => {
    const chosen = value && !Number.isNaN(Date.parse(value)) ? new Date(value) : new Date();
    setDate(chosen); setHour(String(chosen.getHours()).padStart(2, "0")); setMinute(String(chosen.getMinutes()).padStart(2, "0")); setError(""); setOpen(true);
  };
  const move = (amount: number) => setDate(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  return <View style={{ gap: 9 }}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label + ": " + publishTimeLabel(value)} onPress={show} style={[styles.row, { padding: 17, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }]}>
      <Icon name="calendar-outline" color={colors.pink} /><Text style={[styles.body, { flex: 1, color: value ? colors.text : colors.muted }]}>{publishTimeLabel(value)}</Text><Icon name="chevron-down" color={colors.purple} />
    </Pressable>
    <View style={styles.wrap}><Button secondary small onPress={() => onChange(new Date().toISOString())}>Şimdi</Button>{optional && !!value && <Button secondary small onPress={() => onChange("")}>Tarihi kaldır</Button>}</View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "#000b", padding: 18, justifyContent: "center", alignItems: "center" }}>
        <ScrollView style={{ width: "100%", maxWidth: 440, maxHeight: "90%" }} contentContainerStyle={[styles.card, { padding: 22, gap: 18, borderColor: "#f143a170" }]}>
          <View style={[styles.row, { justifyContent: "space-between" }]}><Text style={styles.h2}>Yayın takvimi</Text><Button small secondary icon="close" onPress={() => setOpen(false)}>Kapat</Button></View>
          <View style={[styles.row, { justifyContent: "space-between" }]}><Button small secondary icon="chevron-back" onPress={() => move(-1)}>Önceki</Button><Text accessibilityLiveRegion="polite" style={[styles.label, { flex: 1, textAlign: "center" }]}>{monthNames[date.getMonth()]} {date.getFullYear()}</Text><Button small secondary icon="chevron-forward" onPress={() => move(1)}>Sonraki</Button></View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"].map(day => <Text key={day} style={{ color: colors.muted, width: "14.28%", textAlign: "center", paddingBottom: 10 }}>{day}</Text>)}
            {calendarDays(date.getFullYear(), date.getMonth()).map((day, i) => <Pressable key={i} disabled={day === null} accessibilityRole="button" accessibilityLabel={day ? `${day} ${monthNames[date.getMonth()]}` : undefined} accessibilityState={{ selected: day === date.getDate() }} onPress={() => day && setDate(new Date(date.getFullYear(), date.getMonth(), day))} style={{ width: "14.28%", height: 43, padding: 3 }}><View style={{ flex: 1, borderRadius: 11, backgroundColor: day === date.getDate() ? colors.pink : "transparent", justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.text, fontWeight: "700" }}>{day}</Text></View></Pressable>)}
          </View>
          <View style={styles.row}><View style={{ flex: 1 }}><Field label="Saat" value={hour} onChangeText={setHour} keyboardType="numeric" maxLength={2} /></View><View style={{ flex: 1 }}><Field label="Dakika" value={minute} onChangeText={setMinute} keyboardType="numeric" maxLength={2} /></View></View>
          <Text style={[styles.body, { fontSize: 12 }]}>Saat dilimi: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Seçtiğin saat tüm cihazlarda aynı anda yayına alınır.</Text>
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.orange }}>{error}</Text>}
          <Button icon="checkmark" onPress={() => { try { onChange(localPublishTime(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)); setOpen(false); } catch (err) { setError((err as Error).message); } }}>Tarihi seç</Button>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
