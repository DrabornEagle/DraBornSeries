import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api, db } from "./client";
import { isCoinProduct, isPlayProduct, playCoins, playPlans, type Billing } from "./billing-types";
import { usePlayCatalog } from "./play-catalog";
import { playProductPrice, regularPlayOffer } from "../shared/play-offers";
import type { ProductOrSubscription, Purchase } from "expo-iap";

export function useBilling(user: string | undefined, onVerified: () => Promise<void>): Billing {
  const supported = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const { catalog, refresh: refreshCatalog } = usePlayCatalog(!supported);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(supported ? "Google Play ürünleri yükleniyor…" : "Satın alımlar Google Play Android uygulamasında tamamlanır. Expo Go’da ödeme alınmaz.");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const sdk = useRef<typeof import("expo-iap") | null>(null), products = useRef<ProductOrSubscription[]>([]);
  const verified = useRef(onVerified), currentUser = useRef(user), locked = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {}), restoreRef = useRef<() => Promise<void>>(async () => {});
  verified.current = onVerified; currentUser.current = user;
  const refresh = useCallback(() => supported ? refreshRef.current() : refreshCatalog(), [supported, refreshCatalog]);
  useEffect(() => {
    if (!supported) return;
    let live = true, initialized = false, initializing = false;
    let update: { remove: () => void } | undefined, failure: { remove: () => void } | undefined;
    let module: typeof import("expo-iap") | undefined;
    const processing = new Set<string>();
    const process = async (purchase: Purchase) => {
      const account = currentUser.current;
      if (!live || !account || !isPlayProduct(purchase.productId)) return;
      if (purchase.purchaseState === "pending") { setBusy(false); locked.current = false; setMessage("Ödeme Google Play onayını bekliyor. Onaylandıktan sonra hesabına yansıyacak."); return; }
      if (!purchase.purchaseToken || processing.has(purchase.purchaseToken)) return;
      processing.add(purchase.purchaseToken); setBusy(true);
      try {
        const { data, error } = await db.functions.invoke("dbs-play-verify", { body: { productId: purchase.productId, purchaseToken: purchase.purchaseToken } });
        if (error) {
          let detail = "Satın alma doğrulanamadı. Yeniden ödeme başlatmadan satın alımlarını geri yükle.";
          if ("context" in error && error.context instanceof Response) {
            const body = await error.context.json().catch(() => ({}));
            if (body.error === "BILLING_NOT_CONFIGURED") detail = "Google Play hesap bağlantısı tamamlandığında satın alımın doğrulanacak. Satın alımlarını geri yükle.";
            if (body.error === "PURCHASE_ACCOUNT_MISMATCH") detail = "Bu satın alımın yapıldığı DraBornSeries hesabıyla giriş yap.";
          }
          throw Error(detail);
        }
        if (data?.status === "pending") { setMessage("Ödeme onay bekliyor."); return; }
        if (!data?.verified) throw Error("Ödeme henüz doğrulanmadı. Satın alımlarını geri yükle.");
        // The server credits once and consumes coin receipts. Never consume an unverified payment.
        if (live && currentUser.current === account) {
          await verified.current();
          setMessage(isCoinProduct(purchase.productId)
            ? data.consumed ? "BornCoins hesabına yüklendi. Android ve webde kullanabilirsin." : "BornCoins hesabına yüklendi; Google Play işlemi onaylanıyor. Satın alımlarını geri yükle."
            : data.entitled ? "VIP üyeliğin doğrulandı. Android ve webde kullanabilirsin." : "Google Play abonelik durumun güncellendi.");
        }
      } catch (error) { if (live && currentUser.current === account) setMessage((error as Error).message); }
      finally { processing.delete(purchase.purchaseToken); locked.current = false; if (live) setBusy(processing.size > 0); }
    };
    const restore = async () => {
      if (!live || !initialized || !module || !currentUser.current) return;
      const owned = await module.getAvailablePurchases();
      for (const purchase of owned) await process(purchase);
    };
    restoreRef.current = restore;
    const initialize = async (recover = false) => {
      if (initializing || !live) return;
      initializing = true;
      try {
        module ||= await import("expo-iap"); if (!live) return; sdk.current = module;
        if (!update) update = module.purchaseUpdatedListener(purchase => void process(purchase));
        if (!failure) failure = module.purchaseErrorListener(error => {
          if (!live) return; locked.current = false; setBusy(false);
          setMessage(error.code === module!.ErrorCode.UserCancelled ? "Satın alma iptal edildi." : "Google Play işlemi tamamlanamadı. Daha sonra tekrar deneyebilirsin.");
        });
        if (!initialized) initialized = await module.initConnection();
        if (!live) return;
        if (!initialized) throw Error("PLAY_CONNECTION_FAILED");
        const fetched = await Promise.allSettled([
          module.fetchProducts({ skus: Object.keys(playPlans), type: "subs" }),
          module.fetchProducts({ skus: [...playCoins], type: "in-app" }),
        ]);
        if (!live) return;
        products.current = fetched.flatMap(result => result.status === "fulfilled" ? result.value || [] : []);
        const available = Object.fromEntries(products.current.filter(product => isPlayProduct(product.id)).map(product => [product.id, playProductPrice(product)]).filter(([, price]) => !!price));
        setPrices(available); setReady(Object.keys(available).length > 0);
        setMessage(Object.keys(available).length ? "Fiyatlar Google Play’den alındı. Ödeme Google Play onayıyla tamamlanır." : "Ürün fiyatları henüz alınamadı. Google Play test kanalından kurup mağazayı tekrar aç.");
        if (recover) await restore();
      } catch { initialized = false; if (live) { setReady(false); setPrices({}); products.current = []; setMessage("Google Play mağazasına bağlanılamadı. Test kanalından kurup tekrar dene."); } }
      finally { initializing = false; }
    };
    refreshRef.current = () => initialize();
    void initialize(true);
    const resume = AppState.addEventListener("change", state => { if (state === "active") void initialize(true); });
    // Refresh prices even when all products are already available; no per-minute empty-store polling.
    const timer = setInterval(() => { if (AppState.currentState === "active") void initialize(); }, 300000);
    return () => {
      live = false; clearInterval(timer); update?.remove(); failure?.remove(); resume.remove();
      refreshRef.current = async () => {}; restoreRef.current = async () => {};
      sdk.current = null; void module?.endConnection().catch(() => {});
    };
  }, [supported]);
  useEffect(() => { if (user) void restoreRef.current().catch(() => {}); }, [user]);
  const buy = async (id: string) => {
    const module = sdk.current, accountUser = currentUser.current;
    if (!ready || !accountUser || !module || locked.current || !isPlayProduct(id)) return;
    locked.current = true; setBusy(true);
    let started = false;
    try {
      const account = await api<{ accountId: string; configured: boolean }>("billing-account");
      if (!account.configured) { setMessage("Google Play hesap bağlantısı tamamlandığında satın alma açılır."); return; }
      // ProductDetails and offer tokens must be fresh when launching Google's payment sheet.
      const fetched = await module.fetchProducts({ skus: [id], type: isCoinProduct(id) ? "in-app" : "subs" });
      const product = fetched?.find(item => item.id === id), price = product && playProductPrice(product);
      if (!product || !price || currentUser.current !== accountUser) { setMessage("Bu ürün Google Play’de henüz satışa hazır değil."); return; }
      setPrices(prior => ({ ...prior, [id]: price }));
      const offer = regularPlayOffer(product);
      if (isCoinProduct(id)) {
        started = true;
        await module.requestPurchase({ type: "in-app", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, ...(offer?.offerTokenAndroid ? { offerToken: offer.offerTokenAndroid } : {}) } } });
      } else {
        const owned = await module.getAvailablePurchases();
        if (owned.some(item => Object.hasOwn(playPlans, item.productId))) { setMessage("Mevcut VIP aboneliğini Google Play Abonelikler sayfasından yönetebilirsin."); return; }
        if (!offer?.offerTokenAndroid) { setMessage("Bu VIP temel planı satışa hazır değil."); return; }
        started = true;
        await module.requestPurchase({ type: "subs", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, subscriptionOffers: [{ sku: id, offerToken: offer.offerTokenAndroid }] } } });
      }
    } catch (error) {
      started = false;
      if ((error as { code?: string }).code !== module.ErrorCode.UserCancelled) setMessage("Google Play işlemi başlatılamadı. Mağazayı tekrar açıp dene.");
    } finally { if (!started) { locked.current = false; setBusy(false); } }
  };
  return { ready, busy, message, prices: supported ? prices : catalog?.prices || {}, available: supported ? Object.keys(prices) : catalog?.available || [], buy,
    refresh, restore: async () => { await restoreRef.current(); await verified.current(); } };
}
