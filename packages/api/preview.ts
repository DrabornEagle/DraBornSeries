import { useEffect, useState } from "react";
import { api } from "./client";
import type { Playback } from "../types";
const cache = new Map<string, { url: string; until: number }>();
export function usePreview(episode: string | undefined, active: boolean) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    setUrl("");
    if (!episode || !active) return;
    const cached = cache.get(episode);
    if (cached && cached.until > Date.now()) {
      setUrl(cached.url);
      return;
    }
    api<Playback>("playback", { episode })
      .then((value) => {
        cache.set(episode, { url: value.url, until: Date.now() + 240000 });
        if (live) setUrl(value.url);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [episode, active]);
  return url;
}
