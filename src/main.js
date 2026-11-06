import { openness, assignHands, TIPS, INDEX_TIP } from "./gesture.js";
import { beatControls, bpmOf, swingOf, Quantizer, Smoother, MODS, BEAT } from "./mapping.js";
import { GROOVES, NOTE_NAMES, scaleNote, noteName } from "./sequencer.js";
import { Synth } from "./synth.js";
import { slideMarker } from "./motion.js";

const $ = (id) => document.getElementById(id);
const settings = { key: 9, scale: "minpenta", sound: "saw", smooth: 0.5, drums: true };

let synth = null;

// ---------- gesture state (reused every frame, no allocation in the hot path) ----------
const openR = new Float32Array(5), openL = new Float32Array(5);
const mods = Object.fromEntries(MODS.map((m) => [m.id, 0]));
Object.assign(mods, { cutoff: 0.5, reso: 0.2, decay: 0.3, reverb: 0.2, detune: 0.3, echo: 0.1 }); // starting sound
const modSmooth = MODS.map(() => new Smoother(settings.smooth));
const speedSmooth = new Smoother(settings.smooth * 0.5), sideSmooth = new Smoother(settings.smooth * 0.5);
const rootQ = new Quantizer(BEAT.rootCells), grooveQ = new Quantizer(GROOVES.length);
const beat = { bpm: 120, root: 0, groove: 2, swing: 0 };
let beatLive = false;

function onResult(result, detectMs) {
  const hands = result.landmarks.map((landmarks, i) => ({ landmarks, world: result.worldLandmarks[i] }));
  const { right, left } = assignHands(hands);
  if (right) openness(right.world, openR);
  if (left) openness(left.world, openL);
  MODS.forEach((m, i) => {
    const hand = m.hand === "right" ? right : left;
    if (hand) mods[m.id] = modSmooth[i].push((m.hand === "right" ? openR : openL)[m.finger]);
  });
  if (right || left) synth?.setMods(mods);

  beatLive = !!(right && left);
  if (beatLive) {
    const c = beatControls(right.landmarks[INDEX_TIP], left.landmarks[INDEX_TIP], canvas.width / canvas.height);
    beat.bpm = bpmOf(speedSmooth.push(c.speed));
    beat.root = rootQ.push(c.height);
    beat.groove = grooveQ.push(c.tilt);
    beat.swing = swingOf(sideSmooth.push(c.side));
    synth?.setBeat(beat);
  }
  draw(right, left);
  hud(detectMs);
}

// ---------- overlay (drawn mirrored in JS, so text stays readable) ----------
const canvas = $("overlay");
const ctx2d = canvas.getContext("2d");
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
let accent = "#fbff00", scaleLow = "#2f6bff", font = "Inter, sans-serif";
const X = (p) => (1 - p.x) * canvas.width, Y = (p) => p.y * canvas.height;

function drawHand(lm, hand) {
  ctx2d.strokeStyle = "rgba(255,255,255,0.9)";
  ctx2d.lineWidth = 3;
  ctx2d.beginPath();
  for (const [a, b] of BONES) { ctx2d.moveTo(X(lm[a]), Y(lm[a])); ctx2d.lineTo(X(lm[b]), Y(lm[b])); }
  ctx2d.stroke();
  // modulator rings: a 270° arc per finger shows its value, label above
  ctx2d.font = `500 11px ${font}`;
  ctx2d.textAlign = "center";
  ctx2d.textBaseline = "middle";
  for (const m of MODS) {
    if (m.hand !== hand) continue;
    const t = TIPS[m.finger], tip = lm[t], x = X(tip), y = Y(tip), v = mods[m.id];
    ctx2d.lineWidth = 4;
    ctx2d.strokeStyle = "rgba(255,255,255,0.25)";
    ctx2d.beginPath(); ctx2d.arc(x, y, 13, 0.75 * Math.PI, 2.25 * Math.PI); ctx2d.stroke();
    ctx2d.strokeStyle = v > 0.02 ? accent : scaleLow;
    ctx2d.beginPath(); ctx2d.arc(x, y, 13, 0.75 * Math.PI, (0.75 + 1.5 * Math.max(0.02, v)) * Math.PI); ctx2d.stroke();
    if (v < 0.15) continue; // curled fingers bunch up; only open (= active) fingers get a label
    // place the label beyond the tip along the finger, so neighbouring labels fan out like the fingers
    const dx = x - X(lm[t - 1]), dy = y - Y(lm[t - 1]), len = Math.hypot(dx, dy) || 1;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillText(m.label, x + (dx / len) * 30, y + (dy / len) * 30);
  }
}

function draw(right, left) {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  if (right) drawHand(right.landmarks, "right");
  if (left) drawHand(left.landmarks, "left");
  if (!(right && left)) return;
  const a = right.landmarks[INDEX_TIP], b = left.landmarks[INDEX_TIP];
  ctx2d.strokeStyle = accent;
  ctx2d.lineWidth = 4;
  ctx2d.beginPath(); ctx2d.moveTo(X(a), Y(a)); ctx2d.lineTo(X(b), Y(b)); ctx2d.stroke();
  ctx2d.fillStyle = accent;
  for (const p of [a, b]) { ctx2d.beginPath(); ctx2d.arc(X(p), Y(p), 9, 0, 2 * Math.PI); ctx2d.fill(); }
  ctx2d.font = `500 16px ${font}`;
  ctx2d.textAlign = "center";
  ctx2d.fillText(`${beat.bpm} BPM`, (X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2 - 16);
}

// ---------- HUD + panel values (max 4×/s, DOM writes only on change) ----------
let frames = 0, detectSum = 0, lastHud = 0;
const shown = {};
const put = (id, text) => { if (shown[id] !== text) { shown[id] = text; $(id).textContent = text; } };
function hud(detectMs) {
  frames++; detectSum += detectMs;
  const now = performance.now();
  if (now - lastHud < 250) return;
  if (lastHud) {
    put("hud-fps", `${Math.round((frames * 1000) / (now - lastHud))} fps`);
    put("hud-detect", `${(detectSum / frames).toFixed(1)} ms`);
  }
  frames = 0; detectSum = 0; lastHud = now;
  showValues();
}

const rootLabel = () => noteName(scaleNote(settings.key, settings.scale, beat.root));
function showValues() {
  put("bpm", String(beat.bpm));
  put("v-bpm", `${beat.bpm} BPM`);
  put("root-name", rootLabel());
  put("v-root", rootLabel());
  put("groove-name", GROOVES[beat.groove].name);
  put("v-groove", GROOVES[beat.groove].name);
  const sw = `${Math.round(beat.swing * 100)} %`;
  put("swing-val", `Swing ${sw}`);
  put("v-swing", sw);
  $("stage-hint").classList.toggle("gone", beatLive);
  for (const m of MODS) {
    const v = Math.round(mods[m.id] * 100);
    if (shown[m.id] === v) continue;
    shown[m.id] = v;
    meters[m.id].style.transform = `scaleX(${v / 100})`;
  }
}

// ---------- step indicator, in sync with what you hear ----------
const stepEls = [];
let lastStepEl = null;
function onStep(step, time) {
  // the scheduler runs ~60 ms ahead; light the cell when the step actually sounds
  const delay = Math.max(0, (time - synth.ctx.currentTime - synth.ctx.outputLatency) * 1000);
  setTimeout(() => {
    lastStepEl?.classList.remove("on");
    lastStepEl = stepEls[step];
    lastStepEl.classList.add("on");
  }, delay);
}

// ---------- audio + camera start ----------
function ensureSynth() {
  if (synth) return synth;
  synth = new Synth();
  synth.setKey(settings.key);
  synth.setScale(settings.scale);
  synth.setSound(settings.sound);
  synth.setDrums(settings.drums);
  synth.setMods(mods);
  synth.setBeat(beat);
  synth.onStep = onStep;
  const showLatency = () => put("hud-audio", `${synth.latencyMs().toFixed(1)} ms`);
  showLatency();
  setInterval(showLatency, 1000);
  return synth;
}

function setPlaying(on) {
  if (on) ensureSynth().start(); else synth?.stop();
  const b = $("transport");
  b.textContent = on ? "Läuft" : "Gestoppt";
  b.classList.toggle("stopped", !on);
  b.classList.toggle("live", on);
  if (!on) { lastStepEl?.classList.remove("on"); lastStepEl = null; }
}

function setStatus(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("live", !error && text === "Live");
  $("status").classList.toggle("error", error);
}

async function start() {
  const btn = $("start-btn");
  btn.disabled = true;
  btn.dataset.loading = "";
  ensureSynth();
  setPlaying(true);
  setStatus("Lädt");
  try {
    const { startCamera, runLoop, warmUp } = await trackerModule;
    const [{ landmarker, delegate }, cam] = await Promise.all([landmarkerReady, startCamera($("video"))]);
    warmUp(landmarker);
    canvas.width = cam.width || $("video").videoWidth;
    canvas.height = cam.height || $("video").videoHeight;
    runLoop($("video"), landmarker, onResult);
    setStatus("Live");
    $("start").classList.add("gone");
    console.info(`Hand tracking on ${delegate}, camera ${canvas.width}×${canvas.height} @ ${cam.frameRate} fps`);
  } catch (err) {
    console.error(err);
    const msg = err?.name === "NotAllowedError" ? "Kamerazugriff wurde abgelehnt. Bitte in der Adressleiste erlauben. Der Beat läuft trotzdem."
      : err?.name === "NotFoundError" ? "Keine Kamera gefunden. Der Beat läuft mit festen Werten, Leertaste = Start / Stopp."
      : `Start fehlgeschlagen: ${err?.message || err}`;
    $("start-hint").textContent = msg;
    $("start-hint").classList.add("error");
    setStatus("Fehler", true);
    btn.disabled = false;
    delete btn.dataset.loading;
  }
}

// ---------- Space: start / stop the beat ----------
addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault(); // no page scroll, no click on a focused button
  if (!e.repeat) setPlaying(!synth?.playing);
});
addEventListener("keyup", (e) => { if (e.code === "Space") e.preventDefault(); });

// ---------- panel ----------
const meters = {};
function buildMods() {
  for (const hand of ["right", "left"]) {
    $(`mods-${hand}`).replaceChildren(...MODS.filter((m) => m.hand === hand).map((m) => {
      const row = document.createElement("div");
      row.innerHTML = `<div class="row"><span></span><span></span></div><div class="meter" data-scale><i></i></div>`;
      row.querySelector(".row span:first-child").textContent = m.label;
      row.querySelector(".row span:last-child").textContent = m.fingerLabel;
      meters[m.id] = row.querySelector(".meter i");
      return row;
    }));
  }
}

function initKeys() {
  const box = $("keys");
  box.replaceChildren(...NOTE_NAMES.map((name, pc) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.textContent = name;
    b.addEventListener("click", () => {
      settings.key = pc;
      synth?.setKey(pc);
      for (const x of box.children) x.setAttribute("aria-checked", String(x === b));
      showValues();
    });
    b.setAttribute("aria-checked", String(pc === settings.key));
    return b;
  }));
}

function initSegs() {
  for (const seg of document.querySelectorAll(".seg[data-setting]")) {
    const key = seg.dataset.setting;
    const marker = seg.querySelector(".sel-marker");
    const select = (btn, animate) => {
      for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-checked", String(b === btn));
      slideMarker(seg, marker, btn, { animate, bleed: 1 });
    };
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      select(btn, true);
      const raw = btn.dataset.value;
      if (key === "smooth") {
        settings.smooth = +raw;
        modSmooth.forEach((s) => (s.alpha = +raw));
        speedSmooth.alpha = sideSmooth.alpha = +raw * 0.5; // tempo and swing calmer than the sound
      } else settings[key] = raw;
      if (key === "scale") { synth?.setScale(raw); showValues(); }
      if (key === "sound") synth?.setSound(raw);
    });
    select(seg.querySelector(`button[data-value="${settings[key]}"]`), false);
    new ResizeObserver(() => select(seg.querySelector('[aria-checked="true"]'), false)).observe(seg);
  }
}

$("drums").addEventListener("change", (e) => { settings.drums = e.target.checked; synth?.setDrums(settings.drums); });
$("start-btn").addEventListener("click", start);

// Download MediaPipe + model right away, so Start only has to open the camera.
const trackerModule = import("./tracker.js");
const landmarkerReady = trackerModule.then((m) => m.loadLandmarker());
landmarkerReady.catch(() => {}); // surfaced in start()

const css = getComputedStyle(document.documentElement);
accent = css.getPropertyValue("--accent").trim() || accent;
scaleLow = css.getPropertyValue("--scale-low").trim() || scaleLow;
font = css.getPropertyValue("--font-sans").trim() || font;
$("steps").replaceChildren(...Array.from({ length: 16 }, () => { const li = document.createElement("li"); stepEls.push(li); return li; }));
buildMods();
initKeys();
initSegs();
showValues();

// debug handle: feed synthetic landmarks for verification without a camera
window.__as = { settings, beat, mods, get synth() { return synth; }, feed: onResult, setPlaying };
