import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, deviceId, rpc } from "./client";
type Pending = { episode: string; seconds: number; observed_at: string };
let queue: Promise<void> = Promise.resolve();
export function saveProgress(episode: string, seconds: number) {
  queue = queue
    .catch(() => {})
    .then(async () => {
      const {
        data: { session },
      } = await db.auth.getSession();
      if (!session) return;
      const key = `dbs-progress-${session.user.id}`;
      const pending: Record<string, Pending> = JSON.parse(
        (await AsyncStorage.getItem(key)) || "{}",
      );
      pending[episode] = {
        episode,
        seconds,
        observed_at: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(pending));
      await flushProgress();
    });
  return queue;
}
export async function flushProgress() {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) return;
  const key = `dbs-progress-${session.user.id}`;
  const pending: Record<string, Pending> = JSON.parse(
    (await AsyncStorage.getItem(key)) || "{}",
  );
  for (const [episode, entry] of Object.entries(pending)) {
    try {
      await rpc("dbs_save_progress", { ...entry, device: await deviceId() });
      delete pending[episode];
    } catch {
      break;
    }
  }
  await AsyncStorage.setItem(key, JSON.stringify(pending));
}
