import { useEffect, useRef, useState } from "react";
import { createVideoPlayer, type VideoPlayer } from "expo-video";
import { nativeVideoSource, safeVideoError } from "../shared/native-video-source";
import { OwnedVideoPlayer } from "../shared/owned-video-player";

type Handle = { id: number; url: string; owner: OwnedVideoPlayer<VideoPlayer> };
let nextId = 0;
/** Allocate after commit; Fast Refresh never reuses a released native object. */
export function usePlaybackEngine(url: string, loop = false, muted = false, interval = 0.5) {
  const [handle, setHandle] = useState<Handle>();
  const options = useRef({ loop, muted, interval });
  options.current = { loop, muted, interval };
  useEffect(() => {
    if (!url) return;
    const player = createVideoPlayer(null), setup = options.current;
    player.loop = setup.loop; player.muted = setup.muted; player.timeUpdateEventInterval = setup.interval;
    player.bufferOptions = { preferredForwardBufferDuration: 10, minBufferForPlayback: 0.75 };
    const owner = new OwnedVideoPlayer(player);
    setHandle({ id: ++nextId, url, owner });
    void owner.replace(nativeVideoSource(url)).catch(error => {
      if (!owner.closed) console.warn("DraBornSeries: source load error", safeVideoError(error));
    });
    return () => owner.close();
  }, [url]);
  useEffect(() => {
    if (!handle || handle.owner.closed) return;
    handle.owner.player.loop = loop; handle.owner.player.muted = muted;
    handle.owner.player.timeUpdateEventInterval = interval;
  }, [handle, loop, muted, interval]);
  return handle && handle.url === url && !handle.owner.closed ? handle : undefined;
}
