import type { VideoPlayer, VideoSource, VideoTrack, VideoPlayerStatus, VideoPlayerEvents } from "expo-video";
import { isBrowserR2Source, scriptData } from "./browser-video";

export type Engine = Pick<VideoPlayer, "status" | "duration" | "playing" | "currentTime" | "muted" | "loop" | "maxResolution" | "availableVideoTracks" | "availableAudioTracks" | "availableSubtitleTracks" | "subtitleTrack" | "audioTrack" | "play" | "pause" | "replaceAsync" | "addListener">;

// A small bridge lets the existing controls, caption timing, progress and retries
// work identically with Media3 or Chromium. No remote page or JS is loaded.
export class BrowserPlayer implements Engine {
  status: VideoPlayerStatus = "loading";
  duration = 0;
  playing = false;
  wanted = false;
  maxResolution: VideoPlayer["maxResolution"] = null;
  availableVideoTracks: VideoTrack[] = [];
  availableAudioTracks: VideoPlayer["availableAudioTracks"] = [];
  availableSubtitleTracks: VideoPlayer["availableSubtitleTracks"] = [];
  subtitleTrack: VideoPlayer["subtitleTrack"] = null;
  audioTrack: VideoPlayer["audioTrack"] = null;
  private time = 0;
  private silent: boolean;
  private looping: boolean;
  private view?: { id: string; run: (script: string) => void };
  private listeners = new Map<keyof VideoPlayerEvents, Set<(event?: unknown) => void>>();
  constructor(public url: string, loop: boolean, muted: boolean) { this.looping = loop; this.silent = muted; }
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = Math.max(0, value); this.command({ type: "seek", time: this.time }); }
  get muted() { return this.silent; }
  set muted(value: boolean) { this.silent = value; this.command({ type: "mute", muted: value }); }
  get loop() { return this.looping; }
  set loop(value: boolean) { this.looping = value; this.command({ type: "loop", loop: value }); }
  play() { this.wanted = true; this.command({ type: "play" }); }
  pause() { this.wanted = false; this.command({ type: "pause" }); }
  async replaceAsync(source: VideoSource) {
    const url = typeof source === "string" ? source : source && typeof source === "object" ? source.uri : "";
    if (!url || !isBrowserR2Source(url)) throw Error("INVALID_R2_MEDIA");
    this.url = url; this.status = "loading"; this.playing = false; this.duration = 0; this.availableVideoTracks = [];
    this.emit("statusChange", { status: this.status }); this.command({ type: "load", url });
  }
  addListener<K extends keyof VideoPlayerEvents>(name: K, listener: VideoPlayerEvents[K]) {
    const listeners = this.listeners.get(name) || new Set();
    const callback = listener as (event?: unknown) => void;
    listeners.add(callback); this.listeners.set(name, listeners);
    return { remove: () => { listeners.delete(callback); } };
  }
  private emit(name: keyof VideoPlayerEvents, event?: unknown) { this.listeners.get(name)?.forEach((listener) => listener(event)); }
  command(data: Record<string, unknown>) { this.view?.run(`window.dbsVideoCommand?.(${scriptData(data)});true;`); }
  attach(id: string, run: (script: string) => void) { this.view = { id, run }; }
  detach(id: string) { if (this.view?.id === id) this.view = undefined; }
  fail(code: string) { this.status = "error"; this.playing = false; this.emit("statusChange", { status: this.status, error: { message: "R2_" + code } }); }
  message(raw: string, frame: () => void) {
    if (raw.length > 4096) return;
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { return; }
    if (data?.id !== this.view?.id) return;
    switch (data.type) {
      case "attached":
        this.muted = this.silent; this.loop = this.looping; this.currentTime = this.time;
        if (this.wanted) this.play(); else this.pause(); break;
      case "metadata": {
        const duration = Number(data.duration), width = Number(data.width), height = Number(data.height);
        if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) return;
        this.duration = duration;
        this.availableVideoTracks = [{ id: "original", url: null, size: { width, height }, mimeType: null, isSupported: true, bitrate: null, averageBitrate: null, peakBitrate: null, frameRate: null, videoRange: "sdr" }];
        this.emit("sourceLoad"); break;
      }
      case "status":
        if (data.status !== "loading" && data.status !== "readyToPlay") return;
        this.status = data.status; this.emit("statusChange", { status: this.status }); break;
      case "playing":
        this.playing = data.playing === true; this.emit("playingChange", { isPlaying: this.playing }); break;
      case "time":
        if (!Number.isFinite(data.time) || Number(data.time) < 0) return;
        this.time = Number(data.time); this.emit("timeUpdate", { currentTime: this.time }); break;
      case "frame": frame(); break;
      case "ended": this.playing = false; this.emit("playToEnd"); break;
      case "error": this.fail(/^(NETWORK|DECODE|FORMAT|ABORTED|AUTOPLAY|UNKNOWN)$/.test(String(data.code)) ? String(data.code) : "UNKNOWN"); break;
    }
  }
}

