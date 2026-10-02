import "react-native-url-polyfill/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { config } from "../shared/config";
export const db = createClient(config.supabaseUrl, config.publishableKey, {
  db: { schema: "drabornseries" },
  auth: {
    storage: AsyncStorage,
    storageKey: "dbs-auth-session",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    flowType: "pkce",
  },
});
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) =>
    state === "active" ? db.auth.startAutoRefresh() : db.auth.stopAutoRefresh(),
  );
export async function deviceId() {
  let id = await AsyncStorage.getItem("dbs-device-id");
  if (!id) {
    id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem("dbs-device-id", id);
  }
  return id;
}
export async function rpc<T = any>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function api<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
  sessionOverride?: Session | null,
) {
  const session = sessionOverride === undefined ? (await db.auth.getSession()).data.session : sessionOverride;
  const result = await fetch(`${config.supabaseUrl}/functions/v1/dbs-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.publishableKey,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || "İstek tamamlanamadı.");
  return data as T;
}
export async function requireData<T = any>(
  request: PromiseLike<{ data: any; error: any }>,
) {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data as T;
}
