import type { Playback } from "../types";

/** Short-lived, memory-only signed sources. Account changes discard pending work. */
export class PlaybackCache {
  private epoch = 0;
  private entries = new Map<string, { value: Playback; until: number }>();
  private flights = new Map<string, Promise<Playback>>();
  constructor(private now = Date.now) {}
  clear() { this.epoch++; this.entries.clear(); this.flights.clear(); }
  async load(scope: string, episode: string, fetchSource: () => Promise<Playback>, refresh = false): Promise<Playback> {
    const key = scope + ":" + episode, cached = this.entries.get(key);
    if (!refresh && cached && cached.until > this.now()) return cached.value;
    if (!refresh && this.flights.has(key)) return this.flights.get(key)!;
    const epoch = this.epoch;
    const flight = fetchSource().then((value) => {
      if (this.epoch !== epoch) throw Error("PLAYBACK_ACCOUNT_CHANGED");
      if (this.flights.get(key) === flight) {
        const expiry = value.expires_at ? Date.parse(value.expires_at) - 30000 : Infinity;
        const until = Math.min(this.now() + 90000, Number.isFinite(expiry) ? expiry : this.now() + 90000);
        this.entries.delete(key); this.entries.set(key, { value, until });
        while (this.entries.size > 24) this.entries.delete(this.entries.keys().next().value!);
      }
      return value;
    }).finally(() => { if (this.flights.get(key) === flight) this.flights.delete(key); });
    this.flights.set(key, flight);
    return flight;
  }
}
