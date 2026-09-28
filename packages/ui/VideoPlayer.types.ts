import type { Playback } from "../types";
export interface VideoProps {
  source: Playback;
  initialTime: number;
  portrait: boolean;
  onProgress: (seconds: number) => void;
  onEnd: () => void;
}
