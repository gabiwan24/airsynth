# Air Synth
Web app: a synth + drum machine played with both hands in front of the webcam.
Both index fingertips set the beat, the other 8 fingers modulate the sound.

## Run
- Start: `start.bat` (free port from 8100, `scripts/serve.py` = static server with `Cache-Control: no-store`)
- Deploy: push to `main` → GitHub Pages https://gabiwan24.github.io/airsynth/
- Test: `npm test` (node:test, pure logic only: `src/gesture.js`, `src/mapping.js`, `src/sequencer.js`)
- Build: none – plain ES modules, no bundler

## Stack
Vanilla JS (ES modules), MediaPipe Tasks Vision 1.1.1 `HandLandmarker` (CDN, GPU delegate), raw Web Audio API.

## Mapping (all ranges in `src/mapping.js`)
- Index tips: distance → tempo 80–160 BPM, height → root (8 scale steps), tilt → groove (5), midpoint right of centre → swing
- Right hand: thumb Drive, middle Filter, ring Resonance, pinky Decay (pluck → pad)
- Left hand: thumb Reverb, middle Wobble (tempo-synced filter LFO), ring Width (detune + stereo), pinky Echo (dotted 8th)
- Finger openness thresholds: `OPEN` in `src/gesture.js`

## Conventions
- Latency first: synth oscillators run permanently; fingers only move AudioParams (`setTargetAtTime`, tc 20 ms).
- Beat = look-ahead scheduler (60 ms) on the audio clock; tempo/groove changes land on the next 16th.
- `gesture.js` / `mapping.js` / `sequencer.js` stay DOM-free so Node tests can import them.
- DOM writes only on change, HUD/panel max 4×/s; live values are drawn on the canvas.
- UI follows the global `design-system` skill (tokens.css / components.css / motion.js copied from it).

## Gotchas
- Camera needs a secure context: serve on `localhost`/`127.0.0.1`, not a LAN IP.
- Raw camera frames are unmirrored: the player's right hand has the smaller x. Video is CSS-mirrored; the canvas is NOT – it is drawn mirrored in JS (`X()` in main.js) so labels stay readable.
- WaveShaper hard-clips input beyond ±1: keep the master `sum` gain low (0.5), the tanh curve does the rest.
- No `DynamicsCompressorNode` (fixed look-ahead delay).
- Debug without camera: `window.__as.feed({landmarks, worldLandmarks})`; `tests/hand.mjs` builds synthetic hands.
