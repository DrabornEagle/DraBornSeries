import type { AdResult } from "./ads-types";
export const adAvailable = false;
export const adTestMode = false;
export const adPlatformMessage = "Bu platformda reklam gösterilmez.";
export async function showRewardedAd(_user: string, _episode?: string): Promise<AdResult> { throw Error(adPlatformMessage); }
export async function adPrivacyOptions() { return false; }
