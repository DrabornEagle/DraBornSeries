import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { pickStudioImage, pickStudioVideo, studioVideoStatus } from "../../packages/api/studio-media";
import { readableError } from "../../packages/shared/domain";
import { Button, colors, styles } from "../../packages/ui/theme";
export default function StudioMediaPicker({ kind, value, episodeId, onValue, onReady }: {
  kind: "image" | "trailer" | "episode"; value?: string; episodeId?: string;
  onValue: (value: string) => void; onReady?: (ready: boolean) => void;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  const [pendingUID, setPendingUID] = useState("");
  const callbacks = useRef({ onValue, onReady }); callbacks.current = { onValue, onReady };
  useEffect(() => {
    if (!pendingUID) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const state = await studioVideoStatus(pendingUID);
        if (!live) return;
        if (state.error || state.status === "error") { setFailed(true); setMessage("Video işlenemedi. Başka bir dosya seçebilirsin."); setPendingUID(""); return; }
        if (state.ready) {
          callbacks.current.onReady?.(true);
          setMessage(kind === "episode" && state.bound ? "Video hazır ve bölüme otomatik bağlandı. UID kaydedildi." : "Video oynatmaya hazır.");
          setPendingUID(""); return;
        }
      } catch { /* Temporary connection errors are retried without deleting the upload. */ }
      if (live) timer = setTimeout(() => void check(), 5000);
    };
    void check();
    return () => { live = false; clearTimeout(timer); };
  }, [pendingUID, kind]);
  const pick = async () => {
    if (busy) return; setBusy(true); setMessage(""); setFailed(false);
    try {
      if (kind === "image") { const url = await pickStudioImage(); if (url) { onValue(url); setMessage("Görsel yüklendi. Değişiklikleri kaydederek diziye ekle."); } }
      else {
        if (kind === "episode" && !episodeId) throw Error("Önce bu videonun ait olduğu bölümü seç.");
        const grant = await pickStudioVideo(kind, episodeId, (percent) => setMessage(`Video yükleniyor · %${percent}`));
        if (grant) { onValue(kind === "episode" ? grant.uid : grant.publicURL || ""); onReady?.(false);
          setPendingUID(grant.uid);
          setMessage("Video yüklendi. İşleme tamamlanınca bölüme otomatik bağlanacak."); }
      }
    } catch (error) { setFailed(true); setMessage(readableError(error)); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 9 }}>
    {kind === "image" && !!value && <Image source={{ uri: value }} style={{ width: 80, height: 108, borderRadius: 12 }} resizeMode="cover" />}
    <View style={styles.wrap}>
      <Button secondary small disabled={busy} icon={kind === "image" ? "image-outline" : "cloud-upload-outline"} onPress={() => void pick()}>
        {busy ? "Yükleniyor…" : kind === "image" ? "Cihazdan görsel seç" : kind === "trailer" ? "Cihazdan fragman seç" : "Cihazdan bölüm videosu seç"}
      </Button>
      {kind === "episode" && value && <Button small secondary icon="refresh" disabled={busy} onPress={async () => {
        setBusy(true); setFailed(false);
        try { const state = await studioVideoStatus(value); onReady?.(state.ready); setMessage(state.ready ? state.bound ? "Video hazır ve bölüme bağlandı." : "Video oynatmaya hazır. Kaydederek bölüme bağla." : "Video işleniyor. Durumu otomatik takip ediliyor."); if (!state.ready) setPendingUID(value); }
        catch (error) { setFailed(true); setMessage(readableError(error)); } finally { setBusy(false); }
      }}>Hazır durumunu kontrol et</Button>}
      {busy && <ActivityIndicator color={colors.pink} />}
    </View>
    {!!message && <Text style={[styles.body, { fontSize: 12, color: failed ? colors.orange : colors.muted }]}>{message}</Text>}
    {kind !== "image" && <Text style={[styles.body, { fontSize: 12 }]}>Videonu seç; yükleme, işleme ve bölüm bağlantısı otomatik ilerler. Büyük dosyalar da desteklenir.</Text>}
  </View>;
}
