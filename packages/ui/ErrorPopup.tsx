import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Icon, colors, styles } from "./theme";
import { readableError } from "../shared/domain";

export default function ErrorPopup({ error, onClose, onRetry, busy = false }: {
  error: string; onClose: () => void; onRetry?: () => void; busy?: boolean;
}) {
  const connection = /fetch|network|bağlantı|offline|internet|timeout/i.test(error);
  return <Modal transparent visible={!!error} animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#03020bd6" }}>
      <Pressable accessibilityLabel="Pencereyi kapat" onPress={onClose} style={{ position: "absolute", inset: 0 }} />
      <LinearGradient colors={["#2d183a", "#140f21"]} style={[styles.card, { width: "100%", maxWidth: 430, alignSelf: "center", padding: 28, borderColor: "#b265a260", gap: 18 }]}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={{ backgroundColor: "#ed419f22", padding: 14, borderRadius: 20 }}>
            <Icon name={connection ? "cloud-offline-outline" : "shield-checkmark-outline"} color={colors.pink} size={28} />
          </View>
          <Pressable accessibilityLabel="Kapat" onPress={onClose} hitSlop={12}><Icon name="close" color={colors.muted} /></Pressable>
        </View>
        <Text style={styles.h2}>{connection ? "Bağlantıyı yeniden kuralım" : "Hesabını kontrol edelim"}</Text>
        <Text style={styles.body}>{readableError(error)}</Text>
        {onRetry && <Button icon="refresh" disabled={busy} onPress={onRetry}>{busy ? "Bağlanıyor…" : "Tekrar dene"}</Button>}
        <Button secondary onPress={onClose}>Kapat</Button>
      </LinearGradient>
    </View>
  </Modal>;
}
