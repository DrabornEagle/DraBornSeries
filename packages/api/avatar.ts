import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import { db, requireData } from "./client";
export type ProfilePhoto = { uri: string; base64: string };
const pendingKey = "dbs-pending-profile-photo";
export async function pickProfilePhoto(): Promise<ProfilePhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  const size = Math.min(asset.width, asset.height);
  context.crop({ originX: Math.floor((asset.width - size) / 2), originY: Math.floor((asset.height - size) / 2), width: size, height: size });
  context.resize({ width: 512, height: 512 });
  const rendered = await context.renderAsync();
  const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!photo.base64) throw Error("Fotoğraf hazırlanamadı. Başka bir görsel seç.");
  return { uri: photo.uri, base64: photo.base64 };
}
export async function uploadProfilePhoto(userId: string, photo: ProfilePhoto) {
  const binary = atob(photo.base64);
  if (binary.length > 2 * 1024 * 1024) throw Error("Fotoğraf en fazla 2 MB olmalı.");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const path = `${userId}/avatar.jpg`;
  const { error } = await db.storage.from("dbs_series_avatars").upload(path, bytes.buffer, {
    contentType: "image/jpeg", upsert: true, cacheControl: "60",
  });
  if (error) throw error;
  return db.storage.from("dbs_series_avatars").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
}
export async function stageProfilePhoto(email: string, photo: ProfilePhoto | null) {
  if (photo) await AsyncStorage.setItem(pendingKey, JSON.stringify({ email: email.trim().toLowerCase(), photo }));
  else await AsyncStorage.removeItem(pendingKey);
}
let restoring: Promise<void> | null = null;
export async function restoreProfilePhoto(user: User) {
  if (restoring) return restoring;
  restoring = (async () => {
    const saved = await AsyncStorage.getItem(pendingKey);
    if (!saved) return;
    const pending = JSON.parse(saved);
    if (pending.email !== user.email?.toLowerCase()) return;
    const avatar = await uploadProfilePhoto(user.id, pending.photo);
    await requireData(db.from("dbs_profiles").update({ avatar_url: avatar }).eq("user_id", user.id));
    await AsyncStorage.removeItem(pendingKey);
  })();
  try { await restoring; } finally { restoring = null; }
}
