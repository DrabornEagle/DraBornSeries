import type { VideoSource } from "expo-video";

type Player = { replaceAsync(source: VideoSource): Promise<void>; pause(): void; release(): void };
type Timer = ReturnType<typeof setTimeout>;
/** Keep a native player alive until its views detach and all source loads settle. */
export class OwnedVideoPlayer<T extends Player> {
  closed = false;
  private pending = 0;
  private released = false;
  private timer?: Timer;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly player: T, private defer = (fn: () => void) => setTimeout(fn, 250)) {}
  replace(source: VideoSource): Promise<void> {
    if (this.closed) return Promise.reject(Error("PLAYER_CLOSED"));
    this.pending++;
    const task = this.queue.then(() => {
      if (this.closed) throw Error("PLAYER_CLOSED");
      return this.player.replaceAsync(source);
    });
    this.queue = task.catch(() => {});
    return task.then(() => this.finished(), error => { this.finished(); throw error; });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    // Stop audio/decoding as soon as the screen leaves, while retaining the
    // safe delayed native release for any source load still in flight.
    try { this.player.pause(); } catch {}
    this.disposeWhenReady();
  }
  private finished() { this.pending--; this.disposeWhenReady(); }
  private disposeWhenReady() {
    if (!this.closed || this.pending || this.released || this.timer) return;
    this.timer = this.defer(() => {
      if (this.pending || this.released) return;
      this.released = true;
      try { this.player.pause(); } finally { this.player.release(); }
    });
  }
}
