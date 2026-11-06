import { test } from "node:test";
import assert from "node:assert/strict";
import { beatControls, bpmOf, swingOf, Quantizer, Smoother, soundParams, MODS, BEAT } from "../src/mapping.js";

const tip = (x, y) => ({ x, y, z: 0 });

test("tip distance → tempo: close = slow, wide = fast", () => {
  const close = beatControls(tip(0.45, 0.5), tip(0.55, 0.5));
  const wide = beatControls(tip(0.2, 0.5), tip(0.8, 0.5));
  assert.equal(bpmOf(close.speed), BEAT.bpm[0]);
  assert.equal(bpmOf(wide.speed), BEAT.bpm[1]);
  assert.ok(bpmOf(beatControls(tip(0.35, 0.5), tip(0.65, 0.5)).speed) > 100);
});

test("level hands → tilt 0.5; right hand lower → tilt > 0.5", () => {
  assert.equal(beatControls(tip(0.3, 0.5), tip(0.7, 0.5)).tilt, 0.5);
  assert.ok(beatControls(tip(0.3, 0.75), tip(0.7, 0.35)).tilt > 0.9); // right (small raw x) low
  assert.ok(beatControls(tip(0.3, 0.35), tip(0.7, 0.75)).tilt < 0.1);
});

test("height: hands up → high root; side: hands on screen right → swing", () => {
  assert.equal(beatControls(tip(0.3, 0.9), tip(0.7, 0.9)).height, 0);
  assert.equal(beatControls(tip(0.3, 0.2), tip(0.7, 0.2)).height, 1);
  // mirrored picture: small raw x = right side of the screen
  assert.equal(beatControls(tip(0.1, 0.5), tip(0.3, 0.5)).side, 1);
  assert.equal(beatControls(tip(0.7, 0.5), tip(0.9, 0.5)).side, 0);
  assert.equal(beatControls(tip(0.4, 0.5), tip(0.6, 0.5)).side, 0); // centred hands = straight
  assert.equal(swingOf(0), 0);
  assert.ok(swingOf(1) <= 0.34);
});

test("Quantizer holds the cell near a border, switches when clearly past it", () => {
  const q = new Quantizer(5, 0.3);
  assert.equal(q.push(0.5), 2);
  assert.equal(q.push(0.61), 2); // 3.05 cells: past the border, inside the margin
  assert.equal(q.push(0.59), 2);
  assert.equal(q.push(0.67), 3); // 3.35 cells: past border + margin
  assert.equal(q.push(0.55), 3); // back to 2.75: still held
  assert.equal(q.push(0.5), 2); // 2.5 = 0.5 cell below the border → beyond margin 0.3
  assert.equal(q.push(0.4), 2);
  assert.equal(new Quantizer(5).push(1), 4);
  assert.equal(new Quantizer(5).push(-1), 0);
});

test("Smoother converges and alpha 1 is transparent", () => {
  const s = new Smoother(0.5);
  s.push(0);
  assert.equal(s.push(1), 0.5);
  assert.equal(new Smoother(1).push(7), 7);
});

test("soundParams cover sensible ranges at both ends", () => {
  const zero = Object.fromEntries(MODS.map((m) => [m.id, 0]));
  const one = Object.fromEntries(MODS.map((m) => [m.id, 1]));
  const lo = soundParams(zero), hi = soundParams(one);
  assert.ok(Math.abs(lo.cutoffHz - 300) < 1 && Math.abs(hi.cutoffHz - 8000) < 1);
  assert.ok(lo.q < 1 && hi.q > 15);
  assert.equal(lo.drive, 1);
  assert.equal(lo.reverb, 0);
  assert.equal(lo.echo, 0);
  assert.equal(lo.wobbleCents, 0);
  assert.ok(hi.decayTc > lo.decayTc);
});

test("8 modulators, 4 per hand, never the index finger (it sets the beat)", () => {
  assert.equal(MODS.length, 8);
  assert.equal(MODS.filter((m) => m.hand === "right").length, 4);
  assert.ok(MODS.every((m) => m.finger !== 1));
  assert.equal(new Set(MODS.map((m) => `${m.hand}${m.finger}`)).size, 8);
});
