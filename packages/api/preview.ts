import { useEffect, useState } from "react";
import { api } from "./client";
import type { Playback } from "../types";
const cache = new Map<string, { source: Playback; until: number }>();
export function usePreviewSource(episode: string | undefined, active: boolean) {
  const [source, setSource] = useState<Playback>();
  useEffect(() => {
    let live = true;
    setSource(undefined);
    if (!episode || !active) return;
    const cached = cache.get(episode);
    if (cached && cached.until > Date.now()) {
      setSource(cached.source);
      return;
    }
    api<Playback>("playback", { episode })
      .then((value) => {
        cache.set(episode, { source: value, until: Date.now() + 240000 });
        if (live) setSource(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [episode, active]);
  return source;
}

export function usePreview(episode: string | undefined, active: boolean) {
  return usePreviewSource(episode, active)?.url || "";
}
