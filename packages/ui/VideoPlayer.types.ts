import type { Playback } from "../types";
export interface VideoProps {
  source: Playback;
  title?: string;
  initialTime: number;
  portrait: boolean;
  showRotateHint?: boolean;
  onProgress: (seconds: number) => void;
  onEnd: () => void;
}
