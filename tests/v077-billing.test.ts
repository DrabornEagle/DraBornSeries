import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import ts from "typescript";
import * as types from "../packages/api/billing-types";
import * as offers from "../packages/shared/play-offers";
import * as products from "../packages/shared/play-products";
import * as journal from "../packages/shared/purchase-journal";
import * as messages from "../packages/shared/purchase-result";
import * as vip from "../packages/shared/vip";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const membership = { product_id: "dbs_vip_weekly", provider: "google_play", status: "active", starts_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), auto_renew: true };
const receipt = (productId: string, token = productId, state = "purchased") => ({ id: token, productId, purchaseToken: token, purchaseState: state });

// Execute the production native hook. Only the React host, store SDK and network are replaced.
function fixture() {
  const states: any[] = [], refs: any[] = [], effects: { deps: unknown[]; cleanup?: () => void }[] = [], pendingEffects: (() => void)[] = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, user = "owner", verifiedCalls = 0;
  const notices: any[] = [], events: string[] = [];
  const settings = { activeVip: [] as vip.VipMembership[], owned: [] as ReturnType<typeof receipt>[], ownedError: false,
    connection: true, verify: async (_body: any): Promise<any> => ({ data: { verified: true, consumed: true, acknowledged: true, entitled: true, status: "active", coins: 50, balance: 130, expiresAt: membership.expires_at }, error: null }),
    account: async (): Promise<any> => ({ accountId: "owner-hash", configured: true, activeVip: settings.activeVip }),
    onVerified: async () => {}, request: async (_request: any) => {},
  };
  const react = {
    useState(initial: any) {
      const index = stateIndex++; if (!(index in states)) states[index] = initial;
      return [states[index], (value: any) => { states[index] = typeof value === "function" ? value(states[index]) : value; if (states[index]?.status && states[index]?.id) notices.push(states[index]); }];
    },
    useRef(initial: any) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback(callback: any) { return callback; },
    useEffect(callback: () => any, deps: unknown[]) {
      const index = effectIndex++, old = effects[index];
      if (old && old.deps.length === deps.length && old.deps.every((value, position) => Object.is(value, deps[position]))) return;
      pendingEffects.push(() => { old?.cleanup?.(); effects[index] = { deps, cleanup: callback() }; });
    },
  };
  const storage = new Map<string, string>();
  const sdk: any = {
    ErrorCode: { UserCancelled: "user-cancelled", AlreadyOwned: "already-owned" },
    initConnection: async () => settings.connection, endConnection: async () => {},
    purchaseUpdatedListener(callback: any) { sdk.updated = callback; return { remove() {} }; },
    purchaseErrorListener(callback: any) { sdk.failed = callback; return { remove() {} }; },
    fetchProducts: async ({ skus }: any) => skus.map((id: string) => ({ id, type: types.isCoinProduct(id) ? "in-app" : "subs", displayPrice: "₺71,99", subscriptionOffers: [{ id: (types.playPlans as any)[id], basePlanIdAndroid: (types.playPlans as any)[id], offerTokenAndroid: "offer-" + id, pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: "₺71,99" }] } }] })),
    getAvailablePurchases: async () => { events.push("owned-query"); if (settings.ownedError) throw Error("Store disconnected"); return settings.owned; },
    requestPurchase: async (request: any) => { events.push("purchase:" + request.request.google.skus[0]); return settings.request(request); },
    finishTransaction: async () => { events.push("finish"); },
  };
  const deps: Record<string, any> = {
    react, "react-native": { Platform: { OS: "android" }, AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) } },
    "expo-constants": { default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" } },
    "@react-native-async-storage/async-storage": { default: { getItem: async (key: string) => storage.get(key) || null, setItem: async (key: string, value: string) => { storage.set(key, value); } } },
    "./client": { api: async () => settings.account(), db: { functions: { invoke: async (_name: string, { body }: any) => { events.push("verify:" + body.purchaseToken); return settings.verify(body); } } } },
    "./billing-types": types, "./play-catalog": { usePlayCatalog: () => ({ catalog: null, refresh: async () => {} }) },
    "../shared/play-offers": offers, "../shared/play-products": products, "../shared/purchase-journal": journal, "../shared/purchase-result": messages, "../shared/vip": vip, "expo-iap": sdk,
  };
  const code = ts.transpileModule(readFileSync(new URL("../packages/api/billing.native.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  runInNewContext(code, { exports, Response, Date, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, require(name: string) { assert.ok(name in deps, name); return deps[name]; } });
  return {
    settings, sdk, storage, notices, events,
    render() {
      stateIndex = refIndex = effectIndex = 0;
      const result = exports.useBilling(user, async () => { events.push("refresh"); verifiedCalls++; await settings.onVerified(); });
      pendingEffects.splice(0).forEach(effect => effect()); return result;
    },
    account(value: string) { user = value; },
    get verifiedCalls() { return verifiedCalls; },
    async mount() { this.render(); await this.render().refresh(); return this.render(); },
    async flush() { for (let index = 0; index < 40; index++) await Promise.resolve(); return this.render(); },
  };
}

test("an active VIP returned by the server blocks every second plan with a visible owned notice", async () => {
  const app = fixture(); await app.mount(); app.settings.activeVip = [membership];
  await app.render().buy("dbs_vip_yearly");
  const billing = app.render();
  assert.equal(billing.notice.kind, "owned"); assert.equal(billing.notice.status, "info");
  assert.equal(billing.notice.expiresAt, membership.expires_at); assert.equal(billing.busy, false);
  assert.equal(app.events.filter(event => event.startsWith("purchase:")).length, 0);
});

test("Play ownership blocks duplicate VIP while local/server state is still catching up", async () => {
  const app = fixture(); await app.mount(); app.settings.owned = [receipt("dbs_vip_weekly")];
  await app.render().buy("dbs_vip_monthly");
  assert.equal(app.render().notice.kind, "owned");
  assert.ok(app.events.includes("verify:dbs_vip_weekly"));
  assert.equal(app.events.filter(event => event.startsWith("purchase:")).length, 0);
});

test("a pending VIP never starts another charge or acknowledges unpaid access", async () => {
  const app = fixture(); await app.mount(); app.settings.owned = [receipt("dbs_vip_weekly", "pending", "pending")];
  await app.render().buy("dbs_vip_weekly");
  assert.equal(app.render().notice.kind, "owned");
  assert.equal(app.events.filter(event => event.startsWith("purchase:") || event === "finish").length, 0);
});

test("an expired server VIP does not create a lifetime purchase ban, while rapid taps start only one charge", async () => {
  const app = fixture(); await app.mount();
  app.settings.activeVip = [{ ...membership, expires_at: new Date(Date.now() - 1000).toISOString() }];
  const gate = deferred<any>(); app.settings.request = () => gate.promise;
  const first = app.render().buy("dbs_vip_weekly"), second = app.render().buy("dbs_vip_weekly");
  await app.flush(); gate.resolve(undefined); await Promise.all([first, second]);
  assert.equal(app.events.filter(event => event.startsWith("purchase:")).length, 1);
  app.sdk.failed({ code: app.sdk.ErrorCode.UserCancelled }); assert.equal(app.render().busy, false);
});

test("manual restore immediately shows progress and an explicit empty-store result", async () => {
  const app = fixture(); await app.mount();
  const restore = app.render().restore();
  assert.equal(app.render().restoring, true); assert.equal(app.render().notice.status, "pending");
  await restore;
  assert.equal(app.render().restoring, false); assert.equal(app.render().busy, false);
  assert.equal(app.render().notice.kind, "restore"); assert.equal(app.render().notice.status, "info");
  assert.match(app.render().notice.message, /bulunamadı/);
});

test("a Play restore query failure produces a visible retry result instead of silently succeeding", async () => {
  const app = fixture(); await app.mount(); app.settings.ownedError = true;
  await app.render().restore();
  assert.equal(app.render().notice.status, "error"); assert.equal(app.render().notice.kind, "restore");
  assert.equal(app.render().restoring, false); assert.match(app.render().notice.message, /yeniden dene/);
});

test("manual restore deduplicates store/journal receipts and returns one summary without extra credit", async () => {
  const app = fixture(); await app.mount();
  app.settings.owned = [receipt("dbs_coins_50", "coin"), receipt("dbs_vip_weekly", "vip")];
  app.storage.set("dbs-play-unfinished:owner", JSON.stringify([receipt("dbs_coins_50", "coin")]));
  const first = app.render().restore(), second = app.render().restore();
  assert.equal(first, second); await first;
  assert.equal(app.render().notice.verifiedCount, 2); assert.equal(app.render().notice.status, "success");
  assert.equal(app.events.filter(event => event === "verify:coin").length, 1);
  assert.equal(app.notices.filter(notice => notice.kind !== "restore").length, 0);
  await app.render().restore();
  assert.equal(app.events.filter(event => event === "verify:coin").length, 1);
  assert.equal(app.events.filter(event => event === "verify:vip").length, 2);
});

test("automatic recovery and foreground refresh never present recurring purchase-success popups", async () => {
  const app = fixture(); app.settings.owned = [receipt("dbs_vip_weekly")]; await app.mount();
  await app.render().refresh(); await app.render().refresh();
  assert.equal(app.render().notice, null); assert.equal(app.notices.length, 0);
  assert.equal(app.events.filter(event => event === "verify:dbs_vip_weekly").length, 1);
});

test("a fresh consumable finishes only after secure verification and can be bought again with a new token", async () => {
  const app = fixture(); await app.mount();
  app.settings.verify = async () => ({ data: { verified: true, consumed: false, coins: 50, balance: 180 }, error: null });
  await app.render().buy("dbs_coins_50");
  app.sdk.updated(receipt("dbs_coins_50", "new-coin")); await app.flush();
  assert.equal(app.render().notice.status, "success"); assert.equal(app.render().busy, false);
  assert.ok(app.events.indexOf("verify:new-coin") < app.events.indexOf("finish"));
  await app.render().buy("dbs_coins_50");
  assert.equal(app.events.filter(event => event === "purchase:dbs_coins_50").length, 2);
});

test("a verified expired lifecycle response refreshes access, including an older HTTP 409 response", async () => {
  const app = fixture(); await app.mount();
  app.settings.verify = async () => ({ data: null, error: { context: new Response(JSON.stringify({ verified: true, entitled: false, status: "expired", acknowledged: true }), { status: 409 }) } });
  app.sdk.updated(receipt("dbs_vip_weekly", "expired")); await app.flush();
  assert.equal(app.render().notice.status, "info"); assert.equal(app.render().notice.entitled, false);
  assert.equal(app.verifiedCalls, 1); assert.equal(app.events.filter(event => event === "finish").length, 0);
});

test("an account switch during verification cannot finish or publish the previous user's purchase", async () => {
  const app = fixture(); await app.mount(); const gate = deferred<any>(); app.settings.verify = () => gate.promise;
  app.sdk.updated(receipt("dbs_coins_50", "previous-owner")); await app.flush();
  app.account("other-owner"); app.render();
  gate.resolve({ data: { verified: true, consumed: false, coins: 50, balance: 180 }, error: null }); await app.flush();
  assert.equal(app.render().notice, null); assert.equal(app.verifiedCalls, 0);
  assert.equal(app.events.filter(event => event === "finish").length, 0);
});

test("VIP countdown distinguishes live cancellation, exact expiration and short test periods", () => {
  const now = Date.now();
  assert.equal(vip.activeMemberships([{ ...membership, status: "cancelled", expires_at: new Date(now + 300000).toISOString() }], now).length, 1);
  assert.equal(vip.activeMemberships([{ ...membership, status: "active", expires_at: new Date(now).toISOString() }], now).length, 0);
  assert.equal(vip.vipCountdown(new Date(now + 5 * 60000).toISOString(), now).daysLabel, "1 günden az");
  assert.equal(vip.vipCountdown(new Date(now + 5 * 60000).toISOString(), now).detail, "5 dakika kaldı");
  assert.equal(vip.vipCountdown("invalid", now).active, false);
});
