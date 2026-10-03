import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import ts from "typescript";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Run the real hook's account refresh with deterministic network replies.
// Effects and native modules are stubbed; wallet/VIP state and refs persist
// between renders, so this checks the actual purchase callback path.
function fixture(walletReplies: Promise<{ balance: number }>[]) {
  const states: unknown[] = [], refs: { current: any }[] = [];
  let stateIndex = 0, refIndex = 0, walletCalls = 0;
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
    useEffect() {},
  };
  const db = {
    from(table: string) {
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain,
        gt: () => chain, order: () => chain,
        single: () => {
          assert.equal(table, "dbs_borncoins_wallet");
          return walletReplies[walletCalls++];
        },
        limit: () => Promise.resolve([]),
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
    require(name: string) {
      if (name === "react") return react;
      if (name === "react-native") return { Platform: { OS: "android" }, AppState: { currentState: "active" } };
      if (name === "./client") return { db, requireData: (query: unknown) => query, rpc: async () => true };
      if (name === "./avatar") return { restoreProfilePhoto: async () => {} };
      if (name === "./progress") return { flushProgress: async () => {} };
      if (name === "@react-native-async-storage/async-storage") return {};
      throw Error("Unexpected store import: " + name);
    },
  });
  return {
    render() { stateIndex = 0; refIndex = 0; return exports.useStore(); },
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
