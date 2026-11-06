// Pure gesture → sound mapping. Both index fingertips set the beat, the other 8 fingers modulate the synth.
// No DOM, testable in Node. All ranges live here; tune here.

/** Ranges of the beat controls (index fingertips, normalized image coordinates). */
export const BEAT = {
  dist: [0.1, 0.6], // tip-to-tip distance as fraction of frame width → tempo
  bpm: [80, 160],
  tilt: 40, // ± degrees of the tip-to-tip line → groove (5 cells)
  height: [0.8, 0.25], // mean tip y (bottom → top) → root note
  rootCells: 8, // root walks 8 scale steps (pentatonic: 1.6 octaves)
  mid: [0.5, 0.8], // midpoint x on screen: centre/left = straight, towards the right edge → swing
  swing: 0.33, // max swing (0.33 ≈ triplet feel)
};

/**
 * The 8 modulators. hand: "right" | "left", finger: 0 thumb, 2 middle, 3 ring, 4 pinky.
 * Right hand shapes the tone, left hand adds motion and space. 0 = finger curled, 1 = stretched.
 */
export const MODS = [
  { id: "drive", hand: "right", finger: 0, label: "Drive", fingerLabel: "Daumen" },
  { id: "cutoff", hand: "right", finger: 2, label: "Filter", fingerLabel: "Mittelfinger" },
  { id: "reso", hand: "right", finger: 3, label: "Resonanz", fingerLabel: "Ringfinger" },
  { id: "decay", hand: "right", finger: 4, label: "Ausklang", fingerLabel: "kleiner Finger" },
  { id: "reverb", hand: "left", finger: 0, label: "Hall", fingerLabel: "Daumen" },
  { id: "wobble", hand: "left", finger: 2, label: "Wobble", fingerLabel: "Mittelfinger" },
  { id: "detune", hand: "left", finger: 3, label: "Breite", fingerLabel: "Ringfinger" },
  { id: "echo", hand: "left", finger: 4, label: "Echo", fingerLabel: "kleiner Finger" },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const norm = (v, [a, b]) => clamp01((v - a) / (b - a));

/**
 * Raw beat controls from the two index fingertips (normalized, unmirrored camera coordinates).
 * aspect = frame width / height, so distance and angle are measured in square pixels.
 * Returns 0..1 values: speed, tilt (0.5 = level), height, side (on-screen midpoint, left → right).
 */
export function beatControls(rightTip, leftTip, aspect = 4 / 3) {
  const dx = (leftTip.x - rightTip.x) * aspect; // player's left hand has the larger raw x
  const dy = leftTip.y - rightTip.y;
  const d = Math.hypot(dx, dy) / aspect; // fraction of frame width
  // positive when the right hand is lower (turning a steering wheel clockwise)
  const deg = (Math.atan2(-dy, Math.abs(dx)) * 180) / Math.PI;
  const midScreenX = 1 - (leftTip.x + rightTip.x) / 2; // the picture is shown mirrored
  return {
    speed: norm(d, BEAT.dist),
    tilt: clamp01(0.5 + deg / (2 * BEAT.tilt)),
    height: norm((leftTip.y + rightTip.y) / 2, BEAT.height),
    side: norm(midScreenX, BEAT.mid),
  };
}

export const bpmOf = (speed) => Math.round(BEAT.bpm[0] + speed * (BEAT.bpm[1] - BEAT.bpm[0]));
export const swingOf = (side) => side * BEAT.swing;

/**
 * Maps a 0..1 value onto `cells` discrete steps with hysteresis: the current cell is kept until the
 * value is `margin` (fraction of a cell) past its border, so a hand resting on a border does not flicker.
 */
export class Quantizer {
  constructor(cells, margin = 0.3) { this.cells = cells; this.margin = margin; this.value = null; }
  push(v) {
    const x = clamp01(v) * this.cells;
    const raw = Math.min(this.cells - 1, Math.floor(x));
    if (this.value === null) return (this.value = raw);
    const lo = this.value - this.margin, hi = this.value + 1 + this.margin;
    if (x < lo || x > hi) this.value = raw;
    return this.value;
  }
}

/** One-pole smoothing per camera frame. alpha 1 = no smoothing. */
export class Smoother {
  constructor(alpha = 0.5) { this.alpha = alpha; this.value = null; }
  push(v) { return (this.value = this.value === null ? v : this.value + this.alpha * (v - this.value)); }
}

/**
 * Sound parameters from the 0..1 modulator values. Exponential where the ear is logarithmic
 * (cutoff, drive), so equal finger travel sounds like an equal change.
 */
export function soundParams(m) {
  return {
    cutoffHz: 300 * (8000 / 300) ** m.cutoff, // 300 Hz (still audible in the pointing pose) … 8 kHz
    q: 0.7 + 17 * m.reso ** 1.5, // 0.7 … 17.7, most of the range near the top
    drive: 1 + 11 * m.drive ** 2, // pre-gain into tanh 1 … 12
    decayTc: 0.04 + 0.5 * m.decay, // amp/filter envelope time constant (s): pluck … pad
    sustain: 0.6 * m.decay, // level held until the next rest
    reverb: 0.75 * m.reverb,
    wobbleCents: 3000 * m.wobble, // tempo-synced LFO depth on the filter
    detuneCents: 28 * m.detune, // ± detune of the two saws, also widens the stereo image
    width: 0.9 * m.detune,
    echo: 0.6 * m.echo,
  };
}
