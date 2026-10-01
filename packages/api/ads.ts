import type { AdResult } from "./ads-types";
export const adAvailable = false;
export const adPlatformMessage = "AdMob reklamlarını Android uygulamasında izleyebilirsin. Web hesabındaki ödüller aynı cüzdanla eşitlenir.";
export async function showRewardedAd(_user: string, _episode?: string): Promise<AdResult> { throw Error(adPlatformMessage); }
export async function adPrivacyOptions() { return false; }
