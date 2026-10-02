import type { Playback } from "../types";
export interface VideoProps {
  source: Playback;
  title?: string;
  onRefreshSource?: () => Promise<Playback>;
  initialTime: number;
  portrait: boolean;
  onProgress: (seconds: number) => void;
  onEnd: () => void;
}
