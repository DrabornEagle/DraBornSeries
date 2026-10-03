import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "./client";
import type { PlayCatalog } from "./billing-types";
let cache: { value: PlayCatalog; until: number } | undefined;
let pending: Promise<PlayCatalog> | undefined;
export function loadPlayCatalog() {
  if (cache && cache.until > Date.now()) return Promise.resolve(cache.value);
  if (pending) return pending;
  pending = api<PlayCatalog>("billing-catalog", {}, null).then(value => {
    cache = { value, until: Date.now() + (value.available.length ? 60000 : 30000) };
    return value;
  }).finally(() => { pending = undefined; });
  return pending;
}
export function usePlayCatalog(enabled = true) {
  const [catalog, setCatalog] = useState<PlayCatalog>();
  const refresh = useCallback(async () => { setCatalog(await loadPlayCatalog()); }, []);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const refresh = () => { void loadPlayCatalog().then(value => { if (live) setCatalog(value); }).catch(() => {}); };
    refresh();
    const resume = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") refresh(); }, 300000);
    return () => { live = false; clearInterval(timer); resume.remove(); };
  }, [enabled]);
  return { catalog, refresh };
}
