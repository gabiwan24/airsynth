import { test } from "node:test";
import assert from "node:assert/strict";
import { openness, assignHands } from "../src/gesture.js";
import { hand } from "./hand.mjs";

test("openness: fist → all 0, flat hand → all 1", () => {
  assert.deepEqual([...openness(hand([0, 0, 0, 0, 0]))], [0, 0, 0, 0, 0]);
  assert.deepEqual([...openness(hand([1, 1, 1, 1, 1]))], [1, 1, 1, 1, 1]);
});

test("openness is continuous and per finger", () => {
  const o = openness(hand([0, 1, 0.5, 0, 1]));
  assert.equal(o[0], 0);
  assert.equal(o[1], 1);
  assert.ok(o[2] > 0.3 && o[2] < 0.7, `half-bent middle finger → ${o[2]}`);
  assert.equal(o[3], 0);
  assert.equal(o[4], 1);
});

test("openness reuses the output buffer (no allocation per frame)", () => {
  const buf = new Float32Array(5);
  assert.equal(openness(hand(), buf), buf);
});

test("assignHands: smaller raw x = player's right hand (picture is mirrored)", () => {
  const a = { landmarks: hand(undefined, 0.3) }, b = { landmarks: hand(undefined, 0.7) };
  assert.deepEqual(assignHands([b, a]), { right: a, left: b });
  assert.deepEqual(assignHands([a]), { right: a, left: null });
  assert.deepEqual(assignHands([b]), { right: null, left: b });
  assert.deepEqual(assignHands([]), { right: null, left: null });
});
