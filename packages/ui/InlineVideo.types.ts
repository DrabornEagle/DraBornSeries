export type InlineVideoProps = {
  url: string;
  active: boolean;
  muted?: boolean;
  poster?: string | null;
  preview?: boolean;
  onTime?: (seconds: number) => void;
  onReady?: () => void;
  onError?: () => void;
};
