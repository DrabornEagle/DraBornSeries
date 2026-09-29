import test from "node:test";
import assert from "node:assert/strict";
import { adjacentIndex, swipeStep } from "../packages/shared/gestures";
import { compactCount, readableError } from "../packages/shared/domain";
test("a long or fast swipe advances exactly one episode", () => {
  assert.equal(adjacentIndex(2, swipeStep(-1500, -4, 700), 8), 3);
  assert.equal(adjacentIndex(2, swipeStep(1500, 4, 700), 8), 1);
  assert.equal(swipeStep(-8, -0.1, 700), 0);
  assert.equal(swipeStep(-23, -0.8, 700), 1);
});
test("feed boundaries and backwards hero swipes stay in range", () => {
  assert.equal(adjacentIndex(0, -1, 5), 0);
  assert.equal(adjacentIndex(4, 1, 5), 4);
  assert.equal(adjacentIndex(0, -1, 5, true), 4);
  assert.equal(adjacentIndex(0, -1, 0, true), 0);
});
test("connection popup and empty counters do not expose raw errors or invented values", () => {
  assert.doesNotMatch(readableError("TypeError: Failed to fetch"), /TypeError|fetch/);
  assert.equal(compactCount(0), "0");
  assert.equal(compactCount(1520), "1.5 B");
  assert.equal(compactCount(NaN), "0");
});
