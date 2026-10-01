import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api, db } from "./client";
import { playPlans, type Billing } from "./billing-types";
import type { ProductOrSubscription, ProductSubscription, Purchase } from "expo-iap";

export function useBilling(user: string | undefined, onVerified: () => Promise<void>): Billing {
  const supported = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(supported ? "Google Play ürünleri yükleniyor…" : "Google Play ödemeleri özel Android derlemesinde çalışır. Expo Go’da ödeme alınmaz."), [prices, setPrices] = useState<Record<string, string>>({});
  const sdk = useRef<typeof import("expo-iap") | null>(null), products = useRef<ProductOrSubscription[]>([]), verified = useRef(onVerified), currentUser = useRef(user);
  verified.current = onVerified; currentUser.current = user;
  useEffect(() => {
    if (!supported || !user) { setReady(false); setPrices({}); products.current = []; if (supported) setMessage("Abonelik satın almak için hesabına giriş yap."); return; }
    let live = true, update: { remove: () => void } | undefined, failure: { remove: () => void } | undefined;
    const processing = new Set<string>();
    const process = async (purchase: Purchase) => {
      if (!live || currentUser.current !== user || !Object.hasOwn(playPlans, purchase.productId)) return;
      if (purchase.purchaseState === "pending") { setBusy(false); setMessage("Ödeme Google Play onayını bekliyor. Onaylandığında VIP üyeliğin açılacak."); return; }
      if (!purchase.purchaseToken || processing.has(purchase.purchaseToken)) return;
      processing.add(purchase.purchaseToken); setBusy(true);
      try {
        const { data, error } = await db.functions.invoke("dbs-play-verify", { body: { productId: purchase.productId, purchaseToken: purchase.purchaseToken } });
        if (error) {
          let code = "Satın alma doğrulanamadı. Satın alımlarını geri yükleyerek tekrar deneyebilirsin.";
          if ("context" in error && error.context instanceof Response) { const body = await error.context.json().catch(() => ({})); if (body.error === "BILLING_NOT_CONFIGURED") code = "Google Play hesap bağlantısı tamamlandığında satın alımın doğrulanacak. Yeniden ödeme başlatma; satın alımlarını geri yükle."; }
          throw Error(code);
        }
        if (data?.status === "pending") { setMessage("Ödeme onay bekliyor."); return; }
        if (!data?.verified) throw Error("Ödeme henüz doğrulanmadı.");
        // Entitlement and acknowledgement are committed on the server first.
        await sdk.current?.finishTransaction({ purchase, isConsumable: false });
        await verified.current(); if (live) setMessage(data.entitled ? "VIP üyeliğin doğrulandı. Android ve webde kullanabilirsin." : "Google Play abonelik durumun güncellendi.");
      } catch (error) { if (live) setMessage((error as Error).message); }
      finally { processing.delete(purchase.purchaseToken); if (live) setBusy(false); }
    };
    const restore = async () => { for (const purchase of await sdk.current!.getAvailablePurchases()) await process(purchase); };
    let initialized = false, initializing = false;
    const initialize = async () => {
      if (initializing || !live) return;
      initializing = true;
      try {
        const module = await import("expo-iap"); if (!live) return; sdk.current = module;
        if (!initialized) update = module.purchaseUpdatedListener(purchase => void process(purchase));
        if (!initialized) failure = module.purchaseErrorListener(error => { if (!live) return; setBusy(false); setMessage(error.code === module.ErrorCode.UserCancelled ? "Satın alma iptal edildi." : "Google Play satın alımı tamamlanamadı. Daha sonra tekrar deneyebilirsin."); });
        if (!initialized && !(await module.initConnection()) || !live) return;
        initialized = true;
        const loaded = await module.fetchProducts({ skus: Object.keys(playPlans), type: "subs" });
        if (!live) return; products.current = loaded || [];
        const available = Object.fromEntries(products.current.map(product => {
          const plan = playPlans[product.id as keyof typeof playPlans];
          const offer = (product as ProductSubscription).subscriptionOffers?.find(item => item.basePlanIdAndroid === plan && !item.id && item.offerTokenAndroid) || (product as ProductSubscription).subscriptionOffers?.find(item => !item.id && item.offerTokenAndroid);
          return [product.id, offer?.pricingPhasesAndroid?.pricingPhaseList.at(-1)?.formattedPrice || offer?.displayPrice || product.displayPrice];
        }));
        setPrices(available); setReady(products.current.length > 0); setMessage(products.current.length ? "Fiyatlar Google Play’den alındı. Ödeme Google Play onayıyla tamamlanır." : "VIP ürünleri Play Console’da etkinleştirildiğinde fiyatlar burada görünecek.");
        await restore();
      } catch { if (live) { setReady(false); setMessage("Google Play mağazasına bağlanılamadı. Uygulamayı Google Play test kanalından kurup tekrar dene."); } }
      finally { initializing = false; }
    };
    void initialize();
    const resume = AppState.addEventListener("change", state => { if (state === "active") void initialize(); });
    const retryProducts = setInterval(() => { if (AppState.currentState === "active" && !products.current.length) void initialize(); }, 60000);
    return () => { clearInterval(retryProducts); live = false; update?.remove(); failure?.remove(); resume.remove(); void sdk.current?.endConnection().catch(() => {}); sdk.current = null; };
  }, [supported, user]);
  const restore = async () => {
    if (!sdk.current || !user) return;
    setBusy(true);
    try {
      for (const purchase of await sdk.current.getAvailablePurchases()) {
        if (!Object.hasOwn(playPlans, purchase.productId) || !purchase.purchaseToken || purchase.purchaseState === "pending") continue;
        const { data, error } = await db.functions.invoke("dbs-play-verify", { body: { productId: purchase.productId, purchaseToken: purchase.purchaseToken } });
        if (error || !data?.verified) throw Error("Satın alımların doğrulanamadı. Hesap bağlantısını kontrol edip tekrar dene.");
        await sdk.current.finishTransaction({ purchase, isConsumable: false });
      }
      await verified.current(); setMessage("Google Play satın alımları ve hesap hakların yenilendi.");
    } finally { setBusy(false); }
  };
  const buy = async (id: string) => {
    if (!ready || !user || !sdk.current || busy) return;
    const product = products.current.find(item => item.id === id) as ProductSubscription | undefined;
    const offer = product?.subscriptionOffers?.find(item => item.basePlanIdAndroid === playPlans[id as keyof typeof playPlans] && !item.id && item.offerTokenAndroid) || product?.subscriptionOffers?.find(item => !item.id && item.offerTokenAndroid);
    if (!offer?.offerTokenAndroid) { setMessage("Bu VIP planı Google Play’de henüz satışa hazır değil."); return; }
    const owned = await sdk.current.getAvailablePurchases();
    if (owned.some(item => Object.hasOwn(playPlans, item.productId) && item.purchaseState !== "pending")) {
      setMessage("Mevcut VIP aboneliğini Google Play Abonelikler sayfasından yönetebilirsin. Yeni bir abonelik başlatılmadı.");
      return;
    }
    const account = await api<{ accountId: string; configured: boolean }>("billing-account");
    if (!account.configured) { setMessage("Google Play hesap bağlantısı tamamlandığında abonelik satın alımı açılır."); return; }
    setBusy(true);
    try { await sdk.current.requestPurchase({ type: "subs", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, subscriptionOffers: [{ sku: id, offerToken: offer.offerTokenAndroid }] } } }); }
    catch (error) { setBusy(false); if ((error as { code?: string }).code !== sdk.current.ErrorCode.UserCancelled) throw error; }
  };
  return { ready, busy, message, prices, buy, restore };
}
