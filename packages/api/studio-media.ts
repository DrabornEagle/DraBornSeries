import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api, db } from "./client";
export async function pickStudioImage() {
  const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1920) context.resize(asset.width >= asset.height ? { width: 1920 } : { height: 1920 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
  if (!image.base64) throw Error("Görsel hazırlanamadı. Başka bir dosya seç.");
  const binary = atob(image.base64), bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length > 8 * 1024 * 1024) throw Error("Görsel en fazla 8 MB olmalı.");
  const { data } = await db.auth.getUser();
  if (!data.user) throw Error("AUTH_REQUIRED");
  const filename = `${data.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await db.storage.from("dbs_series_artwork").upload(filename, bytes.buffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return db.storage.from("dbs_series_artwork").getPublicUrl(filename).data.publicUrl;
}
export async function pickStudioVideo(purpose: "episode" | "trailer", episodeId?: string) {
  // Request credentials only after a file is selected. The account API key stays on the server.
  const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsEditing: false });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (asset.fileSize && asset.fileSize >= 200 * 1024 * 1024) throw Error("Bu yükleyici 200 MB altındaki videolar içindir. Daha büyük dosyaları Cloudflare panelinden yükle ve Stream UID ile bağla.");
  const grant = await api<{ uid: string; uploadURL: string; publicURL?: string }>("admin-upload-video", {
    purpose, episode: episodeId, name: (asset.fileName || "DraBornSeries video").slice(0, 150),
  });
  const form = new FormData();
  if (Platform.OS === "web") {
    const file = await (await fetch(asset.uri)).blob();
    if (file.size >= 200 * 1024 * 1024) throw Error("Video 200 MB altı olmalı. Büyük dosyalar için Cloudflare panelini kullan.");
    form.append("file", file, asset.fileName || "video.mp4");
  } else {
    form.append("file", { uri: asset.uri, name: asset.fileName || "video.mp4", type: asset.mimeType || "video/mp4" } as unknown as Blob);
  }
  const response = await fetch(grant.uploadURL, { method: "POST", body: form });
  if (!response.ok) throw Error("Video yüklenemedi. Bağlantını kontrol ederek dosyayı yeniden seç.");
  return grant;
}
export async function studioVideoStatus(uid: string) {
  return api<{ ready: boolean; duration: number; publicURL?: string }>("admin-video-status", { uid });
}
