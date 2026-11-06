import { test } from "node:test";
import assert from "node:assert/strict";
import { GROOVES, SCALES, hit, openHat, synthDegree, scaleNote, stepDuration, noteName } from "../src/sequencer.js";

test("every groove lane has exactly 16 steps of known symbols", () => {
  for (const g of GROOVES) {
    for (const lane of ["kick", "snare", "hat"]) {
      assert.equal(g[lane].length, 16, `${g.name}.${lane}`);
      assert.match(g[lane], /^[Xxo.]+$/);
    }
    assert.equal(g.synth.length, 16, `${g.name}.synth`);
    assert.match(g.synth, /^[0-9.]+$/);
    assert.ok(hit(g.kick, 0) > 0, `${g.name} starts with a kick`);
  }
  assert.equal(GROOVES[2].name, "House"); // level hands = middle cell
});

test("lane readers", () => {
  assert.equal(hit("X.x.o...........", 0), 1);
  assert.equal(hit("X.x.o...........", 2), 0.7);
  assert.equal(hit("X.x.o...........", 1), 0);
  assert.equal(openHat("..o.............", 18), true); // wraps at 16
  assert.equal(synthDegree("0.3.............", 2), 3);
  assert.equal(synthDegree("0.3.............", 1), null);
});

test("scaleNote: A minor pentatonic from A2, wraps into the next octave", () => {
  assert.equal(noteName(scaleNote(9, "minpenta", 0)), "A2");
  assert.equal(noteName(scaleNote(9, "minpenta", 1)), "C3");
  assert.equal(noteName(scaleNote(9, "minpenta", 5)), "A3");
  assert.equal(scaleNote(0, "dorian", 7), scaleNote(0, "dorian", 0) + 12);
  for (const s of Object.keys(SCALES)) assert.ok(scaleNote(11, s, 7 + 9) <= 96, s);
});

test("swing keeps the tempo: a pair of 16ths always lasts one 8th", () => {
  for (const swing of [0, 0.2, 0.33]) {
    const pair = stepDuration(120, 0, swing) + stepDuration(120, 1, swing);
    assert.ok(Math.abs(pair - 0.25) < 1e-9, `swing ${swing}: ${pair}`);
  }
  assert.ok(stepDuration(120, 0, 0.3) > stepDuration(120, 1, 0.3));
});
