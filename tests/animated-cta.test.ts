import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

const productionAnimated = createRequire(import.meta.url)("react-native-web/dist/cjs/vendor/react-native/Animated/AnimatedImplementation.js");

// Execute the shared production component with a controlled native lifecycle.
function fixture() {
  const refs: any[] = [], effects: { deps: unknown[]; cleanup?: () => void }[] = [];
  const motionListeners = new Set<(value: boolean) => void>(), stateListeners = new Set<() => void>();
  const loops: { running: boolean; start: () => void; stop: () => void }[] = [], queries: ((value: boolean) => void)[] = [];
  const resets: number[] = [];
  let refIndex = 0, effectIndex = 0;
  const host = {
    ...React,
    useRef(initial: any) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useEffect(callback: () => any, deps: unknown[]) {
      const index = effectIndex++, old = effects[index];
      if (old && old.deps.every((value, position) => Object.is(value, deps[position]))) return;
      old?.cleanup?.(); effects[index] = { deps, cleanup: callback() };
    },
  };
  const appState = { currentState: "active", addEventListener(_event: string, callback: () => void) { stateListeners.add(callback); return { remove: () => stateListeners.delete(callback) }; } };
  const native = {
    View: "View", Text: "Text", Pressable: "Pressable", Platform: { OS: "android" }, AppState: appState,
    Easing: { inOut: (value: any) => value, quad: {} },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => new Promise<boolean>(resolve => queries.push(resolve)),
      addEventListener(_event: string, callback: (value: boolean) => void) { motionListeners.add(callback); return { remove: () => motionListeners.delete(callback) }; },
    },
    Animated: {
      View: "AnimatedView",
      Value: class { setValue(value: number) { resets.push(value); } interpolate(options: any) { return options; } },
      timing: () => ({}),
      sequence() {
        const animation = { running: false, start() { this.running = true; }, stop() { this.running = false; }, reset() {}, _isUsingNativeDriver: () => false };
        loops.push(animation); return animation;
      },
      loop: productionAnimated.loop,
    },
  };
  const dependencies: Record<string, any> = { react: host, "react-native": native, "expo-linear-gradient": { LinearGradient: "Gradient" }, "./theme": { Icon: "Icon" } };
  const code = ts.transpileModule(readFileSync(new URL("../packages/ui/AnimatedCTA.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports: any = {};
  runInNewContext(code, { exports, require(name: string) { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return {
    render(props: { active?: boolean; disabled?: boolean } = {}) {
      refIndex = effectIndex = 0; return exports.default({ children: "Ödülü al", small: true, onPress() {}, ...props });
    },
    async answerMotion(value: boolean) { queries.splice(0).forEach(resolve => resolve(value)); await Promise.resolve(); },
    motion(value: boolean) { motionListeners.forEach(callback => callback(value)); },
    foreground(value: boolean) { appState.currentState = value ? "active" : "background"; stateListeners.forEach(callback => callback()); },
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
    get running() { return loops.filter(loop => loop.running).length; },
    get listeners() { return motionListeners.size + stateListeners.size; },
    resets,
  };
}

test("CTA animation stops when its page closes and resumes only when reopened", async () => {
  const app = fixture(); app.render({ active: true }); await app.answerMotion(false);
  assert.equal(app.running, 1);
  app.render({ active: false }); await app.answerMotion(false);
  assert.equal(app.running, 0);
  app.render({ active: true }); await app.answerMotion(false);
  assert.equal(app.running, 1);
  app.unmount(); assert.equal(app.running, 0); assert.equal(app.listeners, 0);
});

test("backgrounding and reduced motion pause the CTA without reviving a closed page", async () => {
  const app = fixture(); app.render(); await app.answerMotion(false);
  app.foreground(false); assert.equal(app.running, 0);
  app.foreground(true); assert.equal(app.running, 1);
  app.motion(true); assert.equal(app.running, 0);
  app.motion(false); assert.equal(app.running, 1);
  app.render({ active: false }); await app.answerMotion(false);
  app.foreground(false); app.foreground(true); app.motion(false); assert.equal(app.running, 0);
  app.unmount();
});

test("a disabled CTA and an unmounted pending motion query leave no animation or listeners", async () => {
  const app = fixture(); app.render({ disabled: true }); await app.answerMotion(false);
  assert.equal(app.running, 0);
  app.render({ disabled: false }); app.unmount();
  const resetsBeforeAnswer = app.resets.length;
  await app.answerMotion(false);
  assert.equal(app.running, 0); assert.equal(app.listeners, 0); assert.equal(app.resets.length, resetsBeforeAnswer);
});
