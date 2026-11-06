// Pure music data + timing: scales, 16-step grooves, note and swing math. No DOM, no audio, testable in Node.

export const SCALES = {
  minpenta: { label: "Moll-Penta", steps: [0, 3, 5, 7, 10] },
  majpenta: { label: "Dur-Penta", steps: [0, 2, 4, 7, 9] },
  dorian: { label: "Dorisch", steps: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { label: "Phrygisch", steps: [0, 1, 3, 5, 7, 8, 10] },
};

/**
 * Grooves, ordered by hand tilt from left to right (House in the middle = level hands).
 * Drums: X = accent, x = normal, o = soft (hat: open), . = rest.
 * Synth: digit = scale degree above the current root (wraps into the next octave), . = rest.
 */
export const GROOVES = [
  { name: "Halftime", kick: "X......x..X.....", snare: "........X.......", hat: "x.x.x.x.x.x.x.xo", synth: "0......0..2....." },
  { name: "Breakbeat", kick: "X.x.......xX....", snare: "....X..o.o..X..o", hat: "x.x.x.x.x.x.x.x.", synth: "0.0.......3.0..." },
  { name: "House", kick: "X...X...X...X...", snare: "....X.......X...", hat: "..o...o...o...o.", synth: "..0...0...3...0." },
  { name: "Garage", kick: "X......x..X.....", snare: "....X.......X...", hat: "x.xxx.x.x.xxx.x.", synth: "0..0..2...0..4.." },
  { name: "Techno", kick: "X...X...X...X...", snare: "............X...", hat: "x.xxx.xxx.xxx.xx", synth: ".000.000.000.002" },
];

const VEL = { X: 1, x: 0.7, o: 0.4 };
/** Velocity 0..1 of a drum lane at a step (0 = rest). */
export const hit = (lane, step) => VEL[lane[step % 16]] ?? 0;
/** Open hi-hat at this step? */
export const openHat = (lane, step) => lane[step % 16] === "o";
/** Scale degree of the synth at this step, or null for a rest. */
export const synthDegree = (lane, step) => {
  const c = lane[step % 16];
  return c >= "0" && c <= "9" ? +c : null;
};

export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
export const BASE_OCTAVE_MIDI = 36; // C2: the tonic sits in C2…B2 (A → A2 = 45)

/** MIDI note of scale index `idx` (0 = tonic, may exceed the scale length → next octaves). */
export function scaleNote(keyPc, scale, idx) {
  const s = SCALES[scale].steps;
  return BASE_OCTAVE_MIDI + keyPc + s[idx % s.length] + 12 * Math.floor(idx / s.length);
}

export const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);
export const noteName = (n) => NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);

/**
 * Duration of a 16th step in seconds. Swing 0..0.5 lengthens the on-beat 16th and shortens the
 * off-beat one by the same amount, so pairs of 16ths keep the tempo.
 */
export function stepDuration(bpm, step, swing = 0) {
  const sixteenth = 60 / bpm / 4;
  return sixteenth * (step % 2 === 0 ? 1 + swing : 1 - swing);
}
