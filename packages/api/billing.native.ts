import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api, db } from "./client";
import { isCoinProduct, isPlayProduct, playCoins, playPlans, type Billing, type PurchaseNotice } from "./billing-types";
import { usePlayCatalog } from "./play-catalog";
import { playProductPrice, regularPlayOffer } from "../shared/play-offers";
import { fetchPlayProducts } from "../shared/play-products";
import { PurchaseJournal, type RecoverablePurchase } from "../shared/purchase-journal";
import { verificationMessage } from "../shared/purchase-result";
import type { Purchase } from "expo-iap";

const journal = new PurchaseJournal(AsyncStorage);
export function useBilling(user: string | undefined, onVerified: () => Promise<void>): Billing {
  const supported = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const { catalog, refresh: refreshCatalog } = usePlayCatalog(!supported);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(supported ? "Google Play ürünleri yükleniyor…" : "Satın alımlar Google Play Android uygulamasında tamamlanır. Expo Go’da ödeme alınmaz.");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const sdk = useRef<typeof import("expo-iap") | null>(null);
  const verified = useRef(onVerified), currentUser = useRef(user), locked = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {}), restoreRef = useRef<() => Promise<void>>(async () => {});
  verified.current = onVerified; currentUser.current = user;
  const clearNotice = useCallback(() => setNotice(null), []);
  const refresh = useCallback(() => supported ? refreshRef.current() : refreshCatalog(), [supported, refreshCatalog]);
  useEffect(() => { setNotice(null); locked.current = false; setBusy(false); }, [user]);
  useEffect(() => {
    if (!supported) return;
    let live = true, initialized = false, lastFetched = 0, complete = false;
    let loading: Promise<void> | undefined, restoring: Promise<void> | undefined;
    let update: { remove: () => void } | undefined, failure: { remove: () => void } | undefined;
    let module: typeof import("expo-iap") | undefined;
    const processing = new Set<string>(), completed = new Map<string, number>(), delivered = new Set<string>();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const publish = (result: PurchaseNotice) => {
      if (!live || delivered.has(result.id)) return;
      delivered.add(result.id); setNotice(result); setMessage(result.message);
    };
    const process = async (purchase: RecoverablePurchase | Purchase, restored = false) => {
      const account = currentUser.current, token = purchase.purchaseToken;
      if (!live || !account || !token || !isPlayProduct(purchase.productId)) return;
      const key = account + ":" + token;
      if (processing.has(key) || (completed.has(key) && (isCoinProduct(purchase.productId) || Date.now() - completed.get(key)! < 60000))) return;
      processing.add(key); setBusy(true);
      try {
        await journal.remember(account, { productId: purchase.productId, purchaseToken: token, purchaseState: purchase.purchaseState }).catch(() => {});
        if (purchase.purchaseState === "pending") {
          publish({ id: key + ":pending", productId: purchase.productId, status: "pending", message: "Ödemen Google Play onayını bekliyor. Onay geldikten sonra hesabına yansıyacak." });
          return;
        }
        const { data, error } = await db.functions.invoke("dbs-play-verify", { body: { productId: purchase.productId, purchaseToken: token } });
        if (error) {
          let code = "VERIFICATION_FAILED";
          if ("context" in error && error.context instanceof Response) {
            const response = await error.context.json().catch(() => ({})); code = response.error || code;
          }
          if (["PURCHASE_CANCELLED", "PURCHASE_REFUNDED"].includes(code)) await journal.forget(account, token).catch(() => {});
          if (live && currentUser.current === account) publish({ id: key + ":" + code, productId: purchase.productId, status: "error", message: verificationMessage(code) });
          return;
        }
        if (data?.status === "pending") {
          if (currentUser.current === account) publish({ id: key + ":pending", productId: purchase.productId, status: "pending", message: "Ödemen Google Play onayını bekliyor. Bekleyen ödeme için yeniden ödeme yapmana gerek yok." });
          return;
        }
        if (!data?.verified) throw Error("VERIFICATION_FAILED");
        let finished = isCoinProduct(purchase.productId) ? data.consumed : data.acknowledged;
        // A client may finish only AFTER the backend has validated and atomically granted the purchase.
        if (!finished && "id" in purchase && module) {
          try { await module.finishTransaction({ purchase: purchase as Purchase, isConsumable: isCoinProduct(purchase.productId) }); finished = true; } catch {}
        }
        if (live && currentUser.current === account) {
          let refreshed = false;
          try { await verified.current(); refreshed = true; } catch {}
          const coin = isCoinProduct(purchase.productId);
          publish({ id: key + ":success", productId: purchase.productId, status: "success", coins: coin ? Number(data.coins) : undefined,
            balance: Number.isFinite(data.balance) ? data.balance : undefined, orderId: data.orderId || null, restored: restored || data.duplicate,
            message: coin ? "BornCoins hesabına yüklendi. Aynı hesabınla Android ve webde kullanabilirsin."
              : data.entitled ? "VIP üyeliğin aktif. Aynı hesabınla Android ve webde kullanabilirsin." : "Google Play abonelik durumun güncellendi." });
          if (finished && refreshed) { completed.set(key, Date.now()); await journal.forget(account, token).catch(() => {}); }
        }
      } catch {
        if (live && currentUser.current === account) publish({ id: key + ":network", productId: purchase.productId, status: "error", message: verificationMessage("VERIFICATION_FAILED") });
      } finally {
        processing.delete(key); locked.current = false;
        if (live) setBusy(processing.size > 0);
      }
    };
    const restore = () => {
      if (!live || !initialized || !module || !currentUser.current) return Promise.resolve();
      if (restoring) return restoring;
      const account = currentUser.current;
      restoring = (async () => {
        // Store-owned receipts include old v0.7.5 payments that never reached the ledger.
        try { for (const purchase of await module!.getAvailablePurchases()) await process(purchase, true); } catch {}
        for (const purchase of await journal.list(account)) {
          if (!live || currentUser.current !== account) break;
          await process({ ...purchase, purchaseState: "unknown" }, true);
        }
      })().finally(() => { restoring = undefined; });
      return restoring;
    };
    restoreRef.current = async () => {
      for (const key of delivered) if (!key.endsWith(":success")) delivered.delete(key);
      await restore();
    };
    const initialize = (recover = false, force = false): Promise<void> => {
      const load = () => {
        if (loading) return loading;
        if (!live || (initialized && !force && Date.now() - lastFetched < 20000)) return Promise.resolve();
        loading = (async () => {
          try {
            module ||= await import("expo-iap"); if (!live) return; sdk.current = module;
            if (!update) update = module.purchaseUpdatedListener(purchase => void process(purchase));
            if (!failure) failure = module.purchaseErrorListener(error => {
              if (!live) return; locked.current = false; setBusy(false);
              const cancelled = error.code === module!.ErrorCode.UserCancelled;
              setMessage(cancelled ? "Satın alma iptal edildi." : "Google Play işlemi tamamlanamadı. Daha sonra tekrar deneyebilirsin.");
              if (!cancelled) setNotice({ id: "play-error:" + Date.now(), status: "error", productId: "", message: "Google Play işlemi tamamlanamadı. Satın alımlarını kontrol edip tekrar doğrulayabilirsin." });
            });
            if (!initialized) initialized = await module.initConnection();
            if (!initialized) throw Error("PLAY_CONNECTION_FAILED");
            const rows = await fetchPlayProducts(request => module!.fetchProducts(request));
            if (!live) return;
            const available = Object.fromEntries(rows.map(product => [product.id, playProductPrice(product)]));
            complete = Object.keys(available).length === Object.keys(playPlans).length + playCoins.length;
            setPrices(available); setReady(Object.keys(available).length > 0); lastFetched = Date.now();
            if (!locked.current) setMessage(Object.keys(available).length === Object.keys(playPlans).length + playCoins.length
              ? "Fiyatlar Google Play’den alındı. Ödeme Google Play onayıyla tamamlanır."
              : Object.keys(available).length ? "Bazı paketlerin Google Play fiyatı henüz alınamadı. Fiyatları yeniden yükleyebilirsin."
                : "Google Play ürünleri henüz alınamadı. Fiyatları yeniden yükleyebilirsin.");
          } catch {
            initialized = false;
            if (live) { setReady(false); setMessage("Google Play mağazasına bağlanılamadı. Bağlantını kontrol edip fiyatları yeniden yükle."); }
          }
        })().finally(() => { loading = undefined; });
        return loading;
      };
      return load().then(async () => { if (recover) await restore(); });
    };
    refreshRef.current = () => initialize(true);
    void initialize(true);
    // Bounded recovery for Play Store startup and recently activated products.
    for (const delay of [4000, 15000]) timers.push(setTimeout(() => { if (!complete && AppState.currentState === "active") void initialize(true, true); }, delay));
    const resume = AppState.addEventListener("change", state => { if (state === "active") void initialize(true); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void initialize(true, true); }, 300000);
    return () => {
      live = false; clearInterval(timer); timers.forEach(clearTimeout); update?.remove(); failure?.remove(); resume.remove();
      refreshRef.current = async () => {}; restoreRef.current = async () => {};
      sdk.current = null; void module?.endConnection().catch(() => {});
    };
  }, [supported]);
  useEffect(() => { if (user) void restoreRef.current().catch(() => {}); }, [user]);
  const buy = async (id: string) => {
    const module = sdk.current, accountUser = currentUser.current;
    if (!accountUser || !module || locked.current || !isPlayProduct(id)) return;
    locked.current = true; setBusy(true); setNotice(null);
    let started = false;
    try {
      const account = await api<{ accountId: string; configured: boolean; error?: string }>("billing-account");
      if (!account.configured) throw Error(account.error || "BILLING_NOT_CONFIGURED");
      const fetched = await module.fetchProducts({ skus: [id], type: isCoinProduct(id) ? "in-app" : "subs" });
      const product = fetched?.find(item => item.id === id), price = product && playProductPrice(product);
      if (!product || !price || currentUser.current !== accountUser) throw Error("PRODUCT_UNAVAILABLE");
      setPrices(prior => ({ ...prior, [id]: price }));
      const offer = regularPlayOffer(product);
      if (isCoinProduct(id)) {
        started = true;
        await module.requestPurchase({ type: "in-app", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, ...(offer?.offerTokenAndroid ? { offerToken: offer.offerTokenAndroid } : {}) } } });
      } else {
        const owned = await module.getAvailablePurchases();
        if (owned.some(item => Object.hasOwn(playPlans, item.productId))) { setMessage("Mevcut VIP aboneliğini Google Play Abonelikler sayfasından yönetebilirsin."); return; }
        if (!offer?.offerTokenAndroid) throw Error("PRODUCT_UNAVAILABLE");
        started = true;
        await module.requestPurchase({ type: "subs", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, subscriptionOffers: [{ sku: id, offerToken: offer.offerTokenAndroid }] } } });
      }
    } catch (error) {
      started = false;
      if ((error as { code?: string }).code !== module.ErrorCode.UserCancelled) {
        const code = (error as Error).message;
        const detail = code === "PRODUCT_UNAVAILABLE" ? "Bu paketin Google Play fiyatı henüz alınamadı. Fiyatları yeniden yükleyip tekrar dene."
          : ["PLAY_VERIFICATION_PERMISSION", "BILLING_NOT_CONFIGURED"].includes(code) ? "Google Play ödeme bağlantısı şu anda hazır değil. Ödeme başlatılmadı; daha sonra tekrar deneyebilirsin." : "Google Play ödemesi başlatılamadı. Bağlantını kontrol edip tekrar dene.";
        setMessage(detail); setNotice({ id: "launch:" + Date.now(), productId: id, status: "error", started: false, message: detail });
      }
    } finally { if (!started) { locked.current = false; setBusy(false); } }
  };
  return { ready, busy, message, prices: supported ? prices : catalog?.prices || {}, available: supported ? Object.keys(prices) : catalog?.available || [],
    notice, clearNotice, buy, refresh, restore: async () => { await restoreRef.current(); await verified.current(); } };
}
