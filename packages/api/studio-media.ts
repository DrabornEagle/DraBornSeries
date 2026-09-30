import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api, db } from "./client";
import { uploadTus } from "../shared/tus-upload";
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
export async function pickStudioVideo(purpose: "episode" | "trailer", episodeId?: string, onProgress?: (percent: number) => void) {
  // Request credentials only after a file is selected. The account API key stays on the server.
  const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsEditing: false });
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  const webFile = Platform.OS === "web" ? (asset.file || await (await fetch(asset.uri)).blob()) : null;
  const nativeFile = Platform.OS !== "web" ? new (await import("expo-file-system")).File(asset.uri) : null;
  const size = webFile?.size || nativeFile?.size;
  if (!size) throw Error("Video dosyası okunamadı. Cihazındaki başka bir dosyayı seç.");
  const grant = await api<{ uid: string; uploadURL: string; publicURL?: string; protocol: "tus" }>("admin-upload-video", {
    purpose, episode: episodeId, name: (asset.fileName || "DraBornSeries video").slice(0, 150),
    protocol: "tus", size,
  });
  const handle = nativeFile?.open();
  try {
    await uploadTus(grant.uploadURL, size, async (start, end) => {
      if (webFile) return webFile.slice(start, end).arrayBuffer();
      if (!handle) throw Error("STREAM_UPLOAD_READ_FAILED");
      handle.offset = start;
      return new Uint8Array(await handle.readBytes(end - start)).buffer;
    }, onProgress);
  } finally { handle?.close(); }
  // The signed webhook and status polling also reconcile a completed upload.
  // A temporary API disconnect after all bytes arrived must not lose the UID.
  await api("admin-video-uploaded", { uid: grant.uid }).catch(() => {});
  return grant;
}
export async function studioVideoStatus(uid: string) {
  return api<{ ready: boolean; bound: boolean; duration: number; status?: string; error?: string; publicURL?: string }>("admin-video-status", { uid });
}
