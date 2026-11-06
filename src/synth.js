// Synth + drum machine on raw Web Audio, built for low latency:
// - the synth voice runs permanently (oscillators never stop); a note is a frequency + envelope change
// - finger modulations are AudioParam targets on always-on nodes, so they act within one audio block
// - the beat runs on a short look-ahead scheduler against the audio clock (sample-accurate, no drift)
// - no DynamicsCompressorNode (fixed look-ahead delay); a tanh WaveShaper limits instead
import { GROOVES, hit, openHat, synthDegree, scaleNote, midiHz, stepDuration } from "./sequencer.js";
import { soundParams } from "./mapping.js";

const LOOKAHEAD = 0.06; // s of audio scheduled ahead; also the worst-case delay of a tempo/groove change
const TICK_MS = 15;
const PARAM_TC = 0.02; // finger → sound smoothing (s); short enough to feel direct, long enough not to zipper

/** Sound presets: oscillator shape, sub level, filter envelope depth (cents), glide (s). */
export const SOUNDS = {
  saw: { label: "Saw", wave: "sawtooth", sub: 0.5, envCents: 2400, glide: 0.01 },
  square: { label: "Square", wave: "square", sub: 0.3, envCents: 2000, glide: 0.01 },
  acid: { label: "Acid", wave: "sawtooth", sub: 0, envCents: 4200, glide: 0.045 },
  soft: { label: "Soft", wave: "triangle", sub: 0.6, envCents: 1200, glide: 0.02 },
};

function tanhCurve(k, size = 2048) {
  const c = new Float32Array(size), norm = Math.tanh(k);
  for (let i = 0; i < size; i++) c[i] = Math.tanh(((i / (size - 1)) * 2 - 1) * k) / norm;
  return c;
}

function impulse(ctx, seconds = 2.4, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function noise(ctx, seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class Synth {
  constructor() {
    // latencyHint 0 = smallest buffer the device allows
    const ctx = (this.ctx = new AudioContext({ latencyHint: 0 }));
    this.noiseBuf = noise(ctx);

    // ---- master: sum → tanh limiter → mute → out
    this.sum = new GainNode(ctx, { gain: 0.5 }); // keeps peaks below 1: a WaveShaper hard-clips input beyond ±1
    this.out = new GainNode(ctx, { gain: 1 });
    this.sum.connect(new WaveShaperNode(ctx, { curve: tanhCurve(1.3) })).connect(this.out).connect(ctx.destination);

    // ---- space: tempo-synced echo + reverb, fed by sends
    this.echo = new DelayNode(ctx, { delayTime: 0.375, maxDelayTime: 2 });
    const fb = new GainNode(ctx, { gain: 0.42 });
    const echoTone = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 1400, Q: 0.5 });
    this.echo.connect(echoTone).connect(fb).connect(this.echo);
    echoTone.connect(this.sum);
    this.verb = new ConvolverNode(ctx, { buffer: impulse(ctx) });
    this.verb.connect(this.sum);

    // ---- synth voice: 2 detuned oscillators (panned) + sub → filter → amp → drive → duck
    this.oscA = new OscillatorNode(ctx, { type: "sawtooth" });
    this.oscB = new OscillatorNode(ctx, { type: "sawtooth" });
    this.sub = new OscillatorNode(ctx, { type: "square" });
    this.panA = new StereoPannerNode(ctx, { pan: 0 });
    this.panB = new StereoPannerNode(ctx, { pan: 0 });
    this.subGain = new GainNode(ctx, { gain: 0.5 });
    this.filter = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 800, Q: 1 });
    const oscMix = new GainNode(ctx, { gain: 0.32 });
    this.oscA.connect(this.panA).connect(oscMix);
    this.oscB.connect(this.panB).connect(oscMix);
    this.sub.connect(this.subGain).connect(oscMix);
    oscMix.connect(this.filter);
    this.amp = new GainNode(ctx, { gain: 0 });
    this.preDrive = new GainNode(ctx, { gain: 1 });
    this.postDrive = new GainNode(ctx, { gain: 1 });
    this.duck = new GainNode(ctx, { gain: 1 });
    this.filter.connect(this.amp).connect(this.preDrive)
      .connect(new WaveShaperNode(ctx, { curve: tanhCurve(1), oversample: "2x" }))
      .connect(this.postDrive).connect(this.duck).connect(this.sum);
    this.echoSend = new GainNode(ctx, { gain: 0 });
    this.verbSend = new GainNode(ctx, { gain: 0 });
    this.duck.connect(this.echoSend).connect(this.echo);
    this.duck.connect(this.verbSend).connect(this.verb);

    // filter.detune (cents) = envelope + wobble LFO on top of the finger-set cutoff: multiplicative, never negative Hz
    this.env = new ConstantSourceNode(ctx, { offset: 0 });
    this.envDepth = new GainNode(ctx, { gain: 2400 });
    this.env.connect(this.envDepth).connect(this.filter.detune);
    this.lfo = new OscillatorNode(ctx, { type: "sine", frequency: 4 });
    this.lfoDepth = new GainNode(ctx, { gain: 0 });
    this.lfo.connect(this.lfoDepth).connect(this.filter.detune);

    // ---- drums: own bus, a little reverb, not touched by the synth filter
    this.drums = new GainNode(ctx, { gain: 0.9 });
    this.drums.connect(this.sum);
    this.drums.connect(new GainNode(ctx, { gain: 0.06 })).connect(this.verb);

    for (const n of [this.oscA, this.oscB, this.sub, this.env, this.lfo]) n.start();

    // ---- state
    this.key = 9; this.scale = "minpenta"; this.groove = 2; this.root = 0;
    this.bpm = 120; this.swing = 0; this.drumsOn = true;
    this.playing = false; this.step = 0; this.nextTime = 0; this.timer = null;
    this.sound = SOUNDS.saw; this.p = soundParams({ drive: 0, cutoff: 0.5, reso: 0.2, decay: 0.3, reverb: 0.2, wobble: 0, detune: 0.3, echo: 0.1 });
    this.onStep = null; // (step, time) – UI hook, called from the scheduler
    this.setSound("saw");
    this.setMods(null);
  }

  // ---------- continuous controls (fingers) ----------
  /** m: { drive, cutoff, reso, decay, reverb, wobble, detune, echo } each 0..1, or null to keep the current sound. */
  setMods(m) {
    if (m) this.p = soundParams(m);
    const p = this.p, t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(p.cutoffHz, t, PARAM_TC);
    this.filter.Q.setTargetAtTime(p.q, t, PARAM_TC);
    this.preDrive.gain.setTargetAtTime(p.drive, t, PARAM_TC);
    this.postDrive.gain.setTargetAtTime(1 / Math.sqrt(p.drive), t, PARAM_TC); // keep loudness roughly level
    this.verbSend.gain.setTargetAtTime(p.reverb, t, PARAM_TC);
    this.echoSend.gain.setTargetAtTime(p.echo, t, PARAM_TC);
    this.lfoDepth.gain.setTargetAtTime(p.wobbleCents, t, PARAM_TC);
    this.oscA.detune.setTargetAtTime(-p.detuneCents, t, PARAM_TC);
    this.oscB.detune.setTargetAtTime(p.detuneCents, t, PARAM_TC);
    this.panA.pan.setTargetAtTime(-p.width, t, PARAM_TC);
    this.panB.pan.setTargetAtTime(p.width, t, PARAM_TC);
  }

  // ---------- beat controls (index fingers) ----------
  setBeat({ bpm, root, groove, swing }) {
    if (bpm !== undefined && bpm !== this.bpm) {
      this.bpm = bpm;
      const t = this.ctx.currentTime, beat = 60 / bpm;
      this.echo.delayTime.setTargetAtTime(beat * 0.75, t, 0.05); // dotted 8th
      this.lfo.frequency.setTargetAtTime(2 / beat, t, 0.05); // wobble in 8ths
    }
    if (root !== undefined) this.root = root;
    if (groove !== undefined) this.groove = groove;
    if (swing !== undefined) this.swing = swing;
  }

  setSound(name) {
    const s = (this.sound = SOUNDS[name]);
    this.oscA.type = s.wave; this.oscB.type = s.wave;
    this.subGain.gain.setTargetAtTime(s.sub, this.ctx.currentTime, 0.02);
    this.envDepth.gain.setTargetAtTime(s.envCents, this.ctx.currentTime, 0.02);
  }

  setKey(pc) { this.key = pc; }
  setScale(name) { this.scale = name; }
  setDrums(on) { this.drumsOn = on; }
  setMuted(muted) { this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.005); }

  // ---------- transport ----------
  start() {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.02;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.03);
  }

  schedule() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.nextTime < horizon) {
      this.playStep(this.step, this.nextTime);
      this.onStep?.(this.step, this.nextTime);
      this.nextTime += stepDuration(this.bpm, this.step, this.swing);
      this.step = (this.step + 1) % 16;
    }
  }

  playStep(step, t) {
    const g = GROOVES[this.groove];
    if (this.drumsOn) {
      const k = hit(g.kick, step), s = hit(g.snare, step), h = hit(g.hat, step);
      if (k) this.kick(t, k);
      if (s) this.snare(t, s);
      if (h) this.hat(t, h, openHat(g.hat, step));
    }
    const deg = synthDegree(g.synth, step);
    if (deg !== null) this.note(scaleNote(this.key, this.scale, this.root + deg), t);
    else if (synthDegree(g.synth, (step + 15) % 16) !== null) this.release(t); // rest after a note
  }

  note(midi, t) {
    const p = this.p, hz = midiHz(midi), glide = this.sound.glide;
    for (const o of [this.oscA, this.oscB]) o.frequency.setTargetAtTime(hz, t, glide);
    this.sub.frequency.setTargetAtTime(hz / 2, t, glide);
    const a = this.amp.gain;
    a.cancelScheduledValues(t);
    a.setTargetAtTime(1, t, 0.002);
    a.setTargetAtTime(p.sustain, t + 0.008, p.decayTc);
    const e = this.env.offset;
    e.cancelScheduledValues(t);
    e.setValueAtTime(1, t);
    e.setTargetAtTime(p.sustain * 0.5, t, p.decayTc * 0.8);
  }

  release(t) {
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.025);
  }

  kick(t, vel) {
    const ctx = this.ctx;
    const o = new OscillatorNode(ctx, { type: "sine", frequency: 160 });
    const g = new GainNode(ctx, { gain: 0 });
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.01, 0.09);
    o.connect(g).connect(this.drums);
    o.start(t); o.stop(t + 0.6);
    // sidechain pump: the synth ducks under the kick, a classic that keeps the low end clean
    this.duck.gain.setTargetAtTime(0.45, t, 0.004);
    this.duck.gain.setTargetAtTime(1, t + 0.03, 0.07);
  }

  snare(t, vel) {
    const ctx = this.ctx;
    const n = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuf });
    const bp = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 1900, Q: 0.7 });
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(vel * 0.55, t);
    g.gain.setTargetAtTime(0, t + 0.005, 0.05);
    n.connect(bp).connect(g).connect(this.drums);
    n.start(t, Math.random() * 0.5); n.stop(t + 0.35);
    const body = new OscillatorNode(ctx, { type: "triangle", frequency: 190 });
    const bg = new GainNode(ctx, { gain: 0 });
    bg.gain.setValueAtTime(vel * 0.4, t);
    bg.gain.setTargetAtTime(0, t, 0.03);
    body.connect(bg).connect(this.drums);
    body.start(t); body.stop(t + 0.2);
  }

  hat(t, vel, open) {
    const ctx = this.ctx;
    const n = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuf });
    const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 7500 });
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(vel * 0.22, t);
    g.gain.setTargetAtTime(0, t + 0.002, open ? 0.07 : 0.014);
    n.connect(hp).connect(g).connect(this.drums);
    n.start(t, Math.random() * 0.5); n.stop(t + (open ? 0.5 : 0.12));
  }

  latencyMs() { return ((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000; }
}
