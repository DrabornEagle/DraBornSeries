import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api } from "./client";
import type { AdResult } from "./ads-types";
export const adAvailable = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
export const adPlatformMessage = "AdMob test reklamları özel Android derlemesinde çalışır. Expo Go bu reklam SDK’sını içermez.";
export const adTestMode = Constants.expoConfig?.extra?.admobTestMode !== false;
let showing = false;
const testBuild = () => adTestMode;
export async function showRewardedAd(user: string, episode?: string): Promise<AdResult> {
  if (!adAvailable) throw Error(adPlatformMessage);
  if (showing) throw Error("Bir reklam zaten açık.");
  showing = true;
  try {
    const module = await import("react-native-google-mobile-ads");
    const settings: { mode: string; rewardedUnit?: string } = testBuild() ? { mode: "test" } : await api("ads-config");
    const test = testBuild() || settings.mode !== "production";
    if (!test) {
      try { await module.AdsConsent.gatherConsent(); } catch { /* Previous valid consent may still allow ads. */ }
      if (!(await module.AdsConsent.getConsentInfo()).canRequestAds) throw Error("Reklam gizlilik tercihlerini tamamlayıp tekrar dene.");
    }
    await module.default().setRequestConfiguration({ maxAdContentRating: module.MaxAdContentRating.T });
    await module.default().initialize();
    const ticket = test ? null : await api<{ id: string }>("ad-ticket", { ...(episode ? { episode } : {}) });
    const ad = module.RewardedAd.createForAdRequest(test ? module.TestIds.REWARDED : settings.rewardedUnit!, {
      requestNonPersonalizedAdsOnly: true,
      ...(ticket ? { serverSideVerificationOptions: { userId: user, customData: ticket.id } } : {}),
    });
    const earned = await new Promise<boolean>((resolve, reject) => {
      let granted = false, done = false;
      const subscriptions: (() => void)[] = [];
      const finish = (error?: Error) => { if (done) return; done = true; clearTimeout(timer); subscriptions.forEach(remove => remove()); ad.destroy(); if (error) reject(error); else resolve(granted); };
      const timer = setTimeout(() => finish(Error("Reklam şu anda yüklenemedi. Daha sonra tekrar dene.")), 45000);
      subscriptions.push(ad.addAdEventListener(module.RewardedAdEventType.LOADED, () => { clearTimeout(timer); if (test) console.info("DraBornSeries: AdMob test ad loaded"); void ad.show().catch(error => finish(error)); }));
      subscriptions.push(ad.addAdEventListener(module.RewardedAdEventType.EARNED_REWARD, () => { granted = true; }));
      subscriptions.push(ad.addAdEventListener(module.AdEventType.CLOSED, () => finish()));
      subscriptions.push(ad.addAdEventListener(module.AdEventType.ERROR, () => finish(Error("Reklam gösterilemedi. Daha sonra tekrar dene."))));
      subscriptions.push(ad.addAdEventListener(module.AdEventType.OPENED, () => { if (test) console.info("DraBornSeries: AdMob test ad opened"); }));
      ad.load();
    });
    if (test || !earned || !ticket) return { mode: test ? "test" : "production", earned };
    // Client reward callbacks never credit the wallet. Only Google's signed SSV does.
    for (let attempt = 0; attempt < 15; attempt++) {
      const result = await api<{ status: string; coins?: number; unlocked?: boolean }>("ad-status", { id: ticket.id });
      if (result.status === "completed") return { mode: "production", earned: true, coins: result.coins, unlocked: result.unlocked };
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw Error("Reklam tamamlandı; ödül doğrulanınca hesabına eklenecek. Tekrar reklam izlemen gerekmez.");
  } finally { showing = false; }
}
export async function adPrivacyOptions() {
  if (!adAvailable || testBuild()) return false;
  const module = await import("react-native-google-mobile-ads");
  if ((await module.AdsConsent.getConsentInfo()).privacyOptionsRequirementStatus === module.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) await module.AdsConsent.showPrivacyOptionsForm();
  return true;
}
