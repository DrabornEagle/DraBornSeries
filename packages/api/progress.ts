import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, deviceId, rpc } from "./client";
type Pending = { episode: string; seconds: number; observed_at: string };
let queue: Promise<void> = Promise.resolve();
function serialized<T>(work: () => Promise<T>) {
  const result = queue.catch(() => {}).then(work);
  queue = result.then(() => {}, () => {});
  return result;
}
async function flushFor(userId: string) {
  const key = `dbs-progress-${userId}`;
  const pending: Record<string, Pending> = JSON.parse(
    (await AsyncStorage.getItem(key)) || "{}",
  );
  for (const [episode, entry] of Object.entries(pending)) {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (session?.user.id !== userId) break;
    try {
      await rpc("dbs_save_progress", { ...entry, device: await deviceId() });
      delete pending[episode];
    } catch {
      break;
    }
  }
  await AsyncStorage.setItem(key, JSON.stringify(pending));
  return Object.keys(pending).length === 0;
}
export function saveProgress(episode: string, seconds: number) {
  const observed_at = new Date().toISOString();
  const currentSession = db.auth.getSession();
  return serialized(async () => {
    const {
      data: { session },
    } = await currentSession;
    if (!session) return false;
    const key = `dbs-progress-${session.user.id}`;
    const pending: Record<string, Pending> = JSON.parse(
      (await AsyncStorage.getItem(key)) || "{}",
    );
    pending[episode] = { episode, seconds, observed_at };
    await AsyncStorage.setItem(key, JSON.stringify(pending));
    return flushFor(session.user.id);
  });
}
export function flushProgress() {
  return serialized(async () => {
    const {
      data: { session },
    } = await db.auth.getSession();
    if (session) await flushFor(session.user.id);
  });
}
