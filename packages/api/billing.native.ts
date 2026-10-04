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
import { activeMemberships, type VipMembership } from "../shared/vip";
import type { Purchase } from "expo-iap";

type Outcome = { state: "verified" | "pending" | "inactive" | "error" | "ignored"; entitled?: boolean; status?: string; expiresAt?: string; message?: string };
type Summary = { verifiedCount: number; pendingCount: number; failedCount: number; inactiveCount: number; message?: string };
const journal = new PurchaseJournal(AsyncStorage);
export function useBilling(user: string | undefined, onVerified: () => Promise<void>): Billing {
  const supported = Platform.OS === "android" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  const { catalog, refresh: refreshCatalog } = usePlayCatalog(!supported);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(supported ? "Google Play ürünleri yükleniyor…" : "Satın alımlar Google Play Android uygulamasında tamamlanır. Expo Go’da ödeme alınmaz.");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const sdk = useRef<typeof import("expo-iap") | null>(null);
  const verified = useRef(onVerified), currentUser = useRef(user), locked = useRef(false), restoreBusy = useRef(false);
  const requested = useRef<{ account: string; id: string } | null>(null);
  const manualFlight = useRef<Promise<void> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const restoreRef = useRef<() => Promise<Summary>>(async () => { throw Error("PLAY_CONNECTION_FAILED"); });
  const processRef = useRef<(purchase: RecoverablePurchase | Purchase, notify?: boolean, force?: boolean) => Promise<Outcome>>(async () => ({ state: "ignored" }));
  verified.current = onVerified; currentUser.current = user;
  const clearNotice = useCallback(() => setNotice(null), []);
  const refresh = useCallback(() => supported ? refreshRef.current() : refreshCatalog(), [supported, refreshCatalog]);
  useEffect(() => { setNotice(null); requested.current = null; manualFlight.current = null; locked.current = false; restoreBusy.current = false; setBusy(false); setRestoring(false); }, [user]);
  useEffect(() => {
    if (!supported) return;
    let live = true, initialized = false, lastFetched = 0, complete = false;
    let loading: Promise<void> | undefined, recovery: Promise<Summary> | undefined;
    let recoveryAccount: string | undefined;
    let update: { remove: () => void } | undefined, failure: { remove: () => void } | undefined;
    let module: typeof import("expo-iap") | undefined;
    const processing = new Map<string, Promise<Outcome>>(), completed = new Map<string, { at: number; outcome: Outcome }>(), delivered = new Set<string>();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const updateBusy = () => { if (live) setBusy(locked.current || restoreBusy.current || processing.size > 0); };
    const publish = (result: PurchaseNotice) => {
      if (!live || delivered.has(result.id)) return;
      delivered.add(result.id); setNotice(result); setMessage(result.message);
    };
    const process = (purchase: RecoverablePurchase | Purchase, notify = false, force = false): Promise<Outcome> => {
      const account = currentUser.current, token = purchase.purchaseToken;
      if (!live || !account || !token || !isPlayProduct(purchase.productId)) return Promise.resolve({ state: "ignored" });
      const key = account + ":" + token, previous = completed.get(key), coin = isCoinProduct(purchase.productId);
      if (processing.has(key)) return processing.get(key)!;
      if (previous && (coin || (!force && Date.now() - previous.at < 60000))) return Promise.resolve(previous.outcome);
      const sameAccount = () => live && currentUser.current === account;
      const task = (async (): Promise<Outcome> => {
        try {
          await journal.remember(account, { productId: purchase.productId, purchaseToken: token, purchaseState: purchase.purchaseState });
          if (!sameAccount()) return { state: "ignored" };
          if (purchase.purchaseState === "pending") {
            const detail = "Ödemen Google Play onayını bekliyor. Bekleyen ödeme için yeniden ödeme yapmana gerek yok.";
            if (notify) publish({ id: key + ":pending", productId: purchase.productId, status: "pending", message: detail });
            return { state: "pending" };
          }
          const response = await db.functions.invoke("dbs-play-verify", { body: { productId: purchase.productId, purchaseToken: token } });
          let data = response.data;
          if (response.error) {
            let body: any = {};
            if ("context" in response.error && response.error.context instanceof Response) body = await response.error.context.json().catch(() => ({}));
            // Accept a verified lifecycle body from pre-v0.7.7 servers too.
            if (body.verified) data = body;
            else {
              const code = body.error || "VERIFICATION_FAILED", detail = verificationMessage(code);
              if (["PURCHASE_CANCELLED", "PURCHASE_REFUNDED"].includes(code)) {
                await journal.forget(account, token);
                if (sameAccount()) await verified.current().catch(() => {});
              }
              if (sameAccount() && notify) publish({ id: key + ":" + code, productId: purchase.productId, status: "error", message: detail });
              return { state: "error", message: detail };
            }
          }
          if (!sameAccount()) return { state: "ignored" };
          if (data?.status === "pending") {
            if (notify) publish({ id: key + ":pending", productId: purchase.productId, status: "pending", message: "Ödemen Google Play onayını bekliyor. Yeniden ödeme yapmana gerek yok." });
            return { state: "pending" };
          }
          if (!data?.verified) throw Error("VERIFICATION_FAILED");
          const inactive = !coin && !data.entitled;
          let finished = coin ? data.consumed : data.acknowledged || ["expired", "revoked"].includes(data.status);
          // Only a verified, atomically granted purchase can be finished by the client.
          if (!finished && !inactive && "id" in purchase && module) {
            try { await module.finishTransaction({ purchase: purchase as Purchase, isConsumable: coin }); finished = true; } catch {}
          }
          let refreshed = false;
          if (sameAccount()) { try { await verified.current(); refreshed = true; } catch {} }
          if (!sameAccount()) return { state: "ignored" };
          const outcome: Outcome = { state: inactive ? "inactive" : "verified", entitled: data.entitled, status: data.status, expiresAt: data.expiresAt };
          if (notify) publish({ id: key + ":" + (inactive ? data.status : "success"), productId: purchase.productId, status: inactive ? "info" : "success",
            coins: coin ? Number(data.coins) : undefined, balance: Number.isFinite(data.balance) ? data.balance : undefined,
            orderId: data.orderId || null, restored: data.duplicate, expiresAt: data.expiresAt, entitled: data.entitled, isTest: data.isTest, autoRenew: data.autoRenew,
            message: coin ? "BornCoins hesabına yüklendi. Aynı hesabınla Android ve webde kullanabilirsin."
              : data.entitled ? "VIP üyeliğin aktif. Ayrıcalıkların Android ve webde seninle." : "Google Play abonelik durumun güncellendi. Bu abonelik artık VIP erişimi sağlamıyor." });
          if (finished && refreshed) { completed.set(key, { at: Date.now(), outcome }); await journal.forget(account, token); }
          if (!refreshed) return { state: "error", message: "Satın alımın doğrulandı ancak hesap bilgisi yenilenemedi. Yeniden ödeme yapmadan tekrar geri yükleyebilirsin." };
          return outcome;
        } catch {
          const detail = verificationMessage("VERIFICATION_FAILED");
          if (sameAccount() && notify) publish({ id: key + ":network", productId: purchase.productId, status: "error", message: detail });
          return { state: "error", message: detail };
        } finally {
          processing.delete(key);
          if (requested.current?.account === account && requested.current.id === purchase.productId) { requested.current = null; locked.current = false; }
          updateBusy();
        }
      })();
      processing.set(key, task); updateBusy(); return task;
    };
    processRef.current = process;
    const recover = (force = false): Promise<Summary> => {
      if (!live || !initialized || !module || !currentUser.current) return Promise.resolve({ verifiedCount: 0, pendingCount: 0, failedCount: 0, inactiveCount: 0 });
      const account = currentUser.current;
      if (recovery) return recoveryAccount === account ? recovery : recovery.catch(() => undefined).then(() => recover(force));
      recoveryAccount = account;
      recovery = (async () => {
        // Merge store and journal receipts by token. Consumed coins are already in the server wallet.
        const owned = await module!.getAvailablePurchases();
        const receipts = new Map<string, RecoverablePurchase | Purchase>();
        for (const item of await journal.list(account)) receipts.set(item.purchaseToken, { ...item, purchaseState: "unknown" });
        for (const item of owned) if (item.purchaseToken && isPlayProduct(item.productId)) receipts.set(item.purchaseToken, item);
        const summary: Summary = { verifiedCount: 0, pendingCount: 0, failedCount: 0, inactiveCount: 0 };
        for (const item of receipts.values()) {
          if (!live || currentUser.current !== account) break;
          const result = await process(item, false, force);
          if (result.state === "verified") summary.verifiedCount++;
          if (result.state === "pending") summary.pendingCount++;
          if (result.state === "inactive") summary.inactiveCount++;
          if (result.state === "error") { summary.failedCount++; summary.message ||= result.message; }
        }
        return summary;
      })().finally(() => { recovery = undefined; recoveryAccount = undefined; updateBusy(); });
      return recovery;
    };
    const initialize = (recoverOwned = false, force = false): Promise<void> => {
      const load = () => {
        if (loading) return loading;
        if (!live || (initialized && !force && Date.now() - lastFetched < 20000)) return Promise.resolve();
        loading = (async () => {
          try {
            module ||= await import("expo-iap"); if (!live) return; sdk.current = module;
            if (!update) update = module.purchaseUpdatedListener(purchase => void process(purchase, true));
            if (!failure) failure = module.purchaseErrorListener(error => {
              if (!live) return;
              const productId = requested.current?.id || "";
              requested.current = null; locked.current = false; updateBusy();
              const cancelled = error.code === module!.ErrorCode.UserCancelled, owned = error.code === module!.ErrorCode.AlreadyOwned;
              const detail = cancelled ? "Satın alma iptal edildi." : owned ? "Bu ürün Google Play hesabında zaten mevcut. Yeniden ödeme yapmadan satın alımlarını geri yükleyebilirsin." : "Google Play işlemi tamamlanamadı. Satın alımlarını kontrol edip tekrar doğrulayabilirsin.";
              setMessage(detail);
              if (!cancelled) setNotice({ id: "play-error:" + Date.now(), kind: owned ? "owned" : "purchase", status: owned ? "info" : "error", productId, message: detail });
            });
            if (!initialized) initialized = await module.initConnection();
            if (!initialized) throw Error("PLAY_CONNECTION_FAILED");
            const rows = await fetchPlayProducts(request => module!.fetchProducts(request));
            if (!live) return;
            const available = Object.fromEntries(rows.map(product => [product.id, playProductPrice(product)]));
            complete = Object.keys(available).length === Object.keys(playPlans).length + playCoins.length;
            setPrices(available); setReady(Object.keys(available).length > 0); lastFetched = Date.now();
            if (!locked.current && !restoreBusy.current) setMessage(complete ? "Fiyatlar Google Play’den alındı. Ödeme Google Play onayıyla tamamlanır."
              : Object.keys(available).length ? "Bazı paketlerin Google Play fiyatı henüz alınamadı. Fiyatları yeniden yükleyebilirsin." : "Google Play ürünleri henüz alınamadı. Fiyatları yeniden yükleyebilirsin.");
          } catch {
            initialized = false;
            if (live) { setReady(false); setMessage("Google Play mağazasına bağlanılamadı. Bağlantını kontrol edip fiyatları yeniden yükle."); }
          }
        })().finally(() => { loading = undefined; });
        return loading;
      };
      return load().then(async () => { if (recoverOwned && !locked.current && !restoreBusy.current) await recover().catch(() => {}); });
    };
    restoreRef.current = async () => {
      for (const key of delivered) if (!key.endsWith(":success")) delivered.delete(key);
      await initialize();
      if (!initialized || !live) throw Error("PLAY_CONNECTION_FAILED");
      return recover(true);
    };
    refreshRef.current = () => initialize(true);
    void initialize(true);
    for (const delay of [4000, 15000]) timers.push(setTimeout(() => { if (!complete && AppState.currentState === "active" && !locked.current && !restoreBusy.current) void initialize(true, true); }, delay));
    const resume = AppState.addEventListener("change", state => { if (state === "active" && !locked.current && !restoreBusy.current) void initialize(true); });
    const timer = setInterval(() => { if (AppState.currentState === "active" && !locked.current && !restoreBusy.current) void initialize(true, true); }, 300000);
    return () => {
      live = false; clearInterval(timer); timers.forEach(clearTimeout); update?.remove(); failure?.remove(); resume.remove();
      refreshRef.current = async () => {}; restoreRef.current = async () => { throw Error("PLAY_CONNECTION_FAILED"); };
      processRef.current = async () => ({ state: "ignored" }); sdk.current = null; void module?.endConnection().catch(() => {});
    };
  }, [supported]);
  useEffect(() => { if (user) void refreshRef.current().catch(() => {}); }, [user]);
  const ownedNotice = (id: string, expiresAt?: string) => {
    const detail = "Bu paket zaten mevcut veya Google Play’de tamamlanmayı bekleyen bir abonelik işlemin var. Yeniden ödeme yapmadan mevcut üyeliğini yönetebilirsin. Aktif planından farklı bir pakete mağazadan geçebilirsin.";
    setMessage(detail); setNotice({ id: "owned:" + Date.now(), kind: "owned", status: "info", productId: id, expiresAt, message: detail });
  };
  const buy = async (id: string) => {
    const module = sdk.current, accountUser = currentUser.current;
    if (!accountUser || locked.current || restoreBusy.current || !isPlayProduct(id)) return;
    if (!module) { setNotice({ id: "connection:" + Date.now(), status: "error", started: false, productId: id, message: "Google Play bağlantısı henüz hazır değil. Fiyatları yeniden yükleyip tekrar dene." }); return; }
    locked.current = true; setBusy(true); setNotice(null);
    let started = false;
    try {
      let replacement: { productId: string; purchaseToken: string } | undefined;
      const account = await api<{ accountId: string; configured: boolean; error?: string; activeVip: VipMembership[]; subscriptions?: VipMembership[] }>("billing-account");
      if (currentUser.current !== accountUser) return;
      if (!isCoinProduct(id)) {
        const activeVip = activeMemberships(account.activeVip || []);
        const blocked = (account.subscriptions || []).find(item => ["pending", "paused", "on_hold"].includes(item.status));
        const samePlan = activeVip.find(item => item.product_id === id || item.provider !== "google_play");
        if (samePlan || blocked) { ownedNotice(id, (samePlan || blocked)?.expires_at); await verified.current().catch(() => {}); return; }
        // Check Play too: app state can lag behind a pending purchase or another device.
        for (const item of (await module.getAvailablePurchases()).filter(item => Object.hasOwn(playPlans, item.productId))) {
          if (currentUser.current !== accountUser) return;
          const result = await processRef.current(item, false, true);
          if (result.state === "error" || result.state === "ignored") throw Error("OWNERSHIP_CHECK_FAILED");
          if (result.state === "pending" || ["paused", "on_hold"].includes(result.status || "") || (result.entitled && item.productId === id)) { ownedNotice(id, result.expiresAt); return; }
          if (result.entitled) {
            if (!item.purchaseToken || replacement) throw Error("OWNERSHIP_CHECK_FAILED");
            replacement = { productId: item.productId, purchaseToken: item.purchaseToken };
          }
        }
        // A plan change must use the verified original token, including when
        // the subscription was purchased on another device.
        if (activeVip.length && !replacement) throw Error("OWNERSHIP_CHECK_FAILED");
        const latest = await api<{ activeVip: VipMembership[]; subscriptions?: VipMembership[] }>("billing-account");
        if (currentUser.current !== accountUser) return;
        if ((latest.subscriptions || []).some(item => ["pending", "paused", "on_hold"].includes(item.status))) { ownedNotice(id); return; }
        const current = activeMemberships(latest.activeVip || []);
        if (current.some(item => item.product_id === id || item.provider !== "google_play")) { ownedNotice(id, current[0]?.expires_at); return; }
        if (current.some(item => item.product_id !== replacement?.productId) || (!replacement && current.length)) throw Error("OWNERSHIP_CHECK_FAILED");
      }
      if (!account.configured) throw Error(account.error || "BILLING_NOT_CONFIGURED");
      const fetched = await module.fetchProducts({ skus: [id], type: isCoinProduct(id) ? "in-app" : "subs" });
      const product = fetched?.find(item => item.id === id), price = product && playProductPrice(product);
      if (!product || !price || currentUser.current !== accountUser) throw Error("PRODUCT_UNAVAILABLE");
      setPrices(prior => ({ ...prior, [id]: price }));
      const offer = regularPlayOffer(product);
      if (!isCoinProduct(id) && !offer?.offerTokenAndroid) throw Error("PRODUCT_UNAVAILABLE");
      requested.current = { account: accountUser, id }; started = true;
      if (isCoinProduct(id)) await module.requestPurchase({ type: "in-app", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, ...(offer?.offerTokenAndroid ? { offerToken: offer.offerTokenAndroid } : {}) } } });
      else await module.requestPurchase({ type: "subs", request: { google: { skus: [id], obfuscatedAccountId: account.accountId, subscriptionOffers: [{ sku: id, offerToken: offer!.offerTokenAndroid! }],
        ...(replacement ? { purchaseToken: replacement.purchaseToken, subscriptionProductReplacementParams: { oldProductId: replacement.productId, replacementMode: "with-time-proration" as const } } : {}) } } });
    } catch (error) {
      started = false;
      if (currentUser.current !== accountUser) return;
      const playCode = (error as { code?: string }).code;
      if (playCode === module.ErrorCode.AlreadyOwned) ownedNotice(id);
      else if (playCode !== module.ErrorCode.UserCancelled) {
        const code = (error as Error).message;
        const detail = code === "PRODUCT_UNAVAILABLE" ? "Bu paketin Google Play fiyatı henüz alınamadı. Fiyatları yeniden yükleyip tekrar dene."
          : code === "OWNERSHIP_CHECK_FAILED" ? "Mevcut aboneliğin kontrol edilemedi. Yeniden ödeme yapmadan satın alımlarını geri yükleyip tekrar dene."
          : ["PLAY_VERIFICATION_PERMISSION", "BILLING_NOT_CONFIGURED"].includes(code) ? "Google Play ödeme bağlantısı şu anda hazır değil. Ödeme başlatılmadı; daha sonra tekrar deneyebilirsin." : "Google Play ödemesi başlatılamadı. Bağlantını kontrol edip tekrar dene.";
        setMessage(detail); setNotice({ id: "launch:" + Date.now(), productId: id, status: "error", started: false, message: detail });
      }
    } finally { if (!started && currentUser.current === accountUser) { requested.current = null; locked.current = false; setBusy(restoreBusy.current); } }
  };
  const restore = () => {
    if (manualFlight.current) return manualFlight.current;
    const account = currentUser.current;
    if (!account || locked.current) return Promise.resolve();
    restoreBusy.current = true; setRestoring(true); setBusy(true);
    setNotice({ id: "restore:start:" + Date.now(), kind: "restore", status: "pending", productId: "", message: "Google Play satın alımların kontrol ediliyor, cüzdanın ve VIP üyeliğin yenileniyor…" });
    const flight = Promise.resolve().then(async () => {
      try {
        const summary = supported ? await restoreRef.current() : { verifiedCount: 0, pendingCount: 0, failedCount: 0, inactiveCount: 0 };
        if (currentUser.current !== account) return;
        await verified.current();
        if (currentUser.current !== account) return;
        const detail = summary.failedCount ? (summary.message || "Bazı satın alımlar henüz doğrulanamadı. Yeniden ödeme yapmadan tekrar geri yükleyebilirsin.")
          : summary.pendingCount ? "Bekleyen ödemen Google Play onayını bekliyor. Onaylandığında hesabına yansıyacak; yeniden ödeme yapmana gerek yok."
          : summary.verifiedCount ? "Satın alımların doğrulandı. Cüzdanın ve VIP hakların Android ve webde güncel. Aynı ödeme ikinci kez BornCoins üretmez."
          : summary.inactiveCount ? "Süresi dolan aboneliklerin güncellendi. Cüzdanın ve mevcut VIP hakların sunucudan yenilendi."
          : supported ? "Google Play’de geri yüklenecek satın alım bulunamadı. Mevcut cüzdanın ve VIP hakların yenilendi; daha önce yüklenen BornCoins bakiyende kalır."
          : "Cüzdanın ve VIP üyeliğin sunucudan yenilendi. Google Play makbuzlarını geri yüklemek için Android uygulamasını kullanabilirsin.";
        setMessage(detail); setNotice({ id: "restore:done:" + Date.now(), kind: "restore", productId: "", status: summary.failedCount ? "error" : summary.pendingCount ? "pending" : summary.verifiedCount ? "success" : "info", ...summary, restored: true, message: detail });
      } catch {
        if (currentUser.current === account) {
          const detail = "Satın alımların geri yüklenemedi. Google Play bağlantını kontrol edip yeniden dene. Yeniden ödeme yapmana gerek yok.";
          setMessage(detail); setNotice({ id: "restore:error:" + Date.now(), kind: "restore", status: "error", productId: "", message: detail });
        }
      } finally {
        if (currentUser.current === account) { restoreBusy.current = false; setRestoring(false); setBusy(false); }
        if (manualFlight.current === flight) manualFlight.current = null;
      }
    });
    manualFlight.current = flight; return flight;
  };
  return { ready, busy, restoring, message, prices: supported ? prices : catalog?.prices || {}, available: supported ? Object.keys(prices) : catalog?.available || [], notice, clearNotice, buy, refresh, restore };
}
