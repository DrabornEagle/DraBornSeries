import { useEffect, useState } from "react";
import { db } from "./client";
import { loadPlaybackSource } from "./playback";
import type { Playback } from "../types";
export function usePreviewSource(episode: string | undefined, active: boolean, retry = 0) {
  const [source, setSource] = useState<Playback>();
  const [account, setAccount] = useState<string>();
  useEffect(() => {
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => setAccount(session?.user.id || "guest"));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let live = true;
    setSource(undefined);
    if (!episode || !active) return;
    loadPlaybackSource(episode, retry > 0)
      .then((value) => {
        if (live) setSource(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [episode, active, retry, account]);
  return source;
}

export function usePreview(episode: string | undefined, active: boolean, retry = 0) {
  return usePreviewSource(episode, active, retry)?.url || "";
}
