export type Language = "tr" | "en";
export type Page =
  | "home"
  | "feed"
  | "store"
  | "browse"
  | "search"
  | "library"
  | "wallet"
  | "vip"
  | "rewards"
  | "profile"
  | "settings"
  | "notifications"
  | "auth"
  | "detail"
  | "player"
  | "admin"
  | "help";
export interface Series {
  id: string;
  slug: string;
  title: string;
  title_en?: string;
  alternative_title?: string;
  description: string;
  description_en?: string;
  short_description: string;
  poster_url: string | null;
  banner_url: string | null;
  trailer_url?: string | null;
  genres: string[];
  tags: string[];
  cast_names: string[];
  director?: string;
  country: string;
  production_year: number;
  age_rating: string;
  language: string;
  is_demo: boolean;
  is_vip: boolean;
  status: string;
  accent: string;
  total_episodes: number;
  total_seasons: number;
  average_duration: number;
  view_count: number;
  like_count: number;
  rating: number;
  featured_order: number | null;
  license?: string;
  created_at: string;
}
export interface Episode {
  id: string;
  series_id: string;
  number: number;
  title: string;
  description: string;
  duration_seconds: number;
  thumbnail_url: string | null;
  orientation: "portrait" | "landscape";
  access_type: "free" | "coins" | "vip" | "ad" | "vip_or_coins" | "promotion";
  coin_price: number;
  vip_included: boolean;
  status: string;
  publish_at: string;
}
export interface Progress {
  episode_id: string;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  updated_at: string;
  device_id?: string;
}
export interface Profile {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  language: Language;
  preferences: Record<string, unknown>;
  created_at: string;
}
export interface Playback {
  url: string;
  expires_at?: string;
  provider: "demo" | "cloudflare";
  subtitles: { language: string; label: string; url: string }[];
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  read_at?: string;
  created_at: string;
}
export interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  kind: string;
  description: string;
  created_at: string;
}
