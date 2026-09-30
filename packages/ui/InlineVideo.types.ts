export type InlineVideoProps = {
  url: string;
  active: boolean;
  muted?: boolean;
  poster?: string | null;
  preview?: boolean;
  startFromMiddle?: boolean;
  subtitles?: import("../types").Playback["subtitles"];
  onTime?: (seconds: number) => void;
  onReady?: () => void;
  onError?: () => void;
  onAutoplayBlocked?: () => void;
};
