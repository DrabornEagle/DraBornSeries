import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import ts from "typescript";
import * as vip from "../packages/shared/vip";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Run the real hook's account refresh with deterministic network replies.
// Effects and native modules are stubbed; wallet/VIP state and refs persist
// between renders, so this checks the actual purchase callback path.
function fixture(walletReplies: Promise<{ balance: number }>[], memberships: vip.VipMembership[] = [], runExpiry = false) {
  const states: unknown[] = [], refs: { current: any }[] = [];
  let stateIndex = 0, refIndex = 0, walletCalls = 0;
  let clock = Date.now(), offline = false;
  const effects: (() => void)[] = [], timers: { callback: () => void; at: number }[] = [];
  class FixtureDate extends Date {
    constructor(value?: string | number) { super(value === undefined ? clock : value); }
    static now() { return clock; }
  }
  const react = {
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value: any) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial: unknown) {
      const index = refIndex++;
      return refs[index] ||= { current: index === 0 ? "owner" : initial };
    },
    useCallback(callback: unknown) { return callback; },
    useEffect(callback: () => void, deps: unknown[]) { if (runExpiry && deps.length === 3 && typeof deps[0] === "boolean") effects.push(callback); },
  };
  const db = {
    from(table: string) {
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain,
        gt: () => chain, order: () => chain,
        single: () => {
          assert.equal(table, "dbs_borncoins_wallet");
          walletCalls++;
          return offline ? Promise.reject(Error("offline")) : walletReplies[walletCalls - 1];
        },
        limit: () => offline ? Promise.reject(Error("offline")) : Promise.resolve(table === "dbs_vip_subscriptions" ? memberships : []),
      };
      return chain;
    },
  };
  const code = ts.transpileModule(readFileSync(new URL("../packages/api/store.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  runInNewContext(code, {
    exports,
    Date: FixtureDate,
    setTimeout(callback: () => void, delay: number) { timers.push({ callback, at: clock + delay }); return timers.length; },
    clearTimeout() {},
    require(name: string) {
      if (name === "react") return react;
      if (name === "react-native") return { Platform: { OS: "android" }, AppState: { currentState: "active" } };
      if (name === "./client") return { db, requireData: (query: unknown) => query, rpc: async () => { if (offline) throw Error("offline"); return true; } };
      if (name === "../shared/vip") return vip;
      if (name === "./avatar") return { restoreProfilePhoto: async () => {} };
      if (name === "./progress") return { flushProgress: async () => {} };
      if (name === "@react-native-async-storage/async-storage") return {};
      throw Error("Unexpected store import: " + name);
    },
  });
  return {
    render() { stateIndex = 0; refIndex = 0; const result = exports.useStore(); effects.splice(0).forEach(effect => effect()); return result; },
    goOffline() { offline = true; },
    advanceTo(time: number) { clock = time; timers.splice(0).filter(timer => timer.at <= clock).forEach(timer => timer.callback()); },
    account(value: string) { refs[0].current = value; },
    get walletCalls() { return walletCalls; },
  };
}

test("a confirmed purchase refreshes the wallet after an older network request fails", async () => {
  const older = deferred<{ balance: number }>(), fresh = deferred<{ balance: number }>();
  const app = fixture([older.promise, fresh.promise]), store = app.render();
  const background = store.refreshEntitlements();
  const backgroundFailure = assert.rejects(background, /Hesap bilgisi/);
  const afterPurchase = store.refreshEntitlements(true);
  older.reject(Error("network interrupted"));
  await backgroundFailure;
  fresh.resolve({ balance: 137 });
  await afterPurchase;
  assert.equal(app.walletCalls, 2);
  assert.equal(app.render().balance, 137);
  assert.equal(app.render().vip, true);
});

test("VIP access disappears at its known deadline even when entitlement refresh is offline", async () => {
  const expires = Date.now() + 5000;
  const memberships = [{ product_id: "dbs_vip_weekly", provider: "google_play", status: "active", starts_at: new Date().toISOString(), expires_at: new Date(expires).toISOString(), auto_renew: false }];
  const app = fixture([Promise.resolve({ balance: 87 })], memberships, true);
  await app.render().refreshEntitlements();
  assert.equal(app.render().vip, true); assert.equal(app.render().vipMemberships[0].product_id, "dbs_vip_weekly");
  app.goOffline(); app.advanceTo(expires + 25);
  for (let index = 0; index < 10; index++) await Promise.resolve();
  assert.equal(app.render().vip, false); assert.equal(app.render().vipEnd, null);
  assert.equal(app.render().vipMemberships.length, 0); assert.equal(app.render().balance, 87);
});

test("ordinary foreground and realtime refreshes share one successful request", async () => {
  const wallet = deferred<{ balance: number }>(), app = fixture([wallet.promise]), store = app.render();
  const first = store.refreshEntitlements(), second = store.refreshEntitlements();
  wallet.resolve({ balance: 87 });
  await Promise.all([first, second]);
  assert.equal(app.walletCalls, 1);
  assert.equal(app.render().balance, 87);
});

test("a purchase refresh waiting on an old account cannot publish into a newly signed-in account", async () => {
  const wallet = deferred<{ balance: number }>(), app = fixture([wallet.promise]), store = app.render();
  const background = store.refreshEntitlements(), afterPurchase = store.refreshEntitlements(true);
  app.account("different-owner");
  wallet.resolve({ balance: 137 });
  await Promise.all([background, afterPurchase]);
  assert.equal(app.walletCalls, 1);
  assert.equal(app.render().balance, 0);
  assert.equal(app.render().vip, false);
});
