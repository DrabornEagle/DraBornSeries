import React, { useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../packages/api/client";
import { r2Key, r2MediaUrl } from "../../packages/shared/r2";
import { readableError } from "../../packages/shared/domain";
import { Button, Field, colors, styles } from "../../packages/ui/theme";
import InlineVideo from "../../packages/ui/InlineVideo";

export default function R2MediaPicker({ value, onValue, trailer = false }: { value?: string; onValue: (value: string) => void; trailer?: boolean }) {
  const [input, setInput] = useState(value || ""), [preview, setPreview] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <View style={{ gap: 12 }}>
    <Field label="R2 dosya yolu veya video bağlantısı" value={input} onChangeText={setInput} placeholder="Dizi Adı/Bolum-01.mp4" autoCapitalize="none" />
    <Button secondary small icon="play-circle-outline" disabled={busy} onPress={async () => {
      setBusy(true); setMessage("");
      try {
        const key = r2Key(input);
        const result = await api<{ url: string }>("admin-r2-probe", { key });
        onValue(trailer ? r2MediaUrl(key) : key); setPreview(result.url); setMessage("Video bulundu. Kaydederek bağlayabilirsin.");
      } catch (error) { setMessage(readableError(error)); } finally { setBusy(false); }
    }}>{busy ? "Kontrol ediliyor…" : "Videoyu doğrula ve seç"}</Button>
    {!!message && <Text style={[styles.body, { color: colors.mint }]}>{message}</Text>}
    {!!preview && <View style={{ height: 220, borderRadius: 18, overflow: "hidden", backgroundColor: "#050309" }}>
      <InlineVideo url={preview} active muted preview={false} />
    </View>}
  </View>;
}
