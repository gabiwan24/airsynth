# Gates: Air Synth v1

OWNS: **

Scope: Static web app: both index fingertips set the beat (distance → tempo, height → root note, tilt → groove, midpoint → swing), the other 8 fingers continuously modulate the synth sound; scaffold, docs, start.bat, pushed to gabiwan24/airsynth with GitHub Pages.

- [x] G1: Gesture mapping, quantizer hysteresis, groove patterns and finger curl pass their unit tests
  CHECK: node --test tests/mapping.test.mjs tests/sequencer.test.mjs tests/gesture.test.mjs
  EXPECT: # fail 0
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Gabriel Weiss\Documents\Claude_Vibecoding\airsynth; path=1766bf1cac83/47 entries; output=# todo 0 | # duration_ms 148.2388

- [x] G2: find-port.ps1 prints a free port from 8100
  CHECK: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/find-port.ps1 8100
  EXPECT: 81
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Gabriel Weiss\Documents\Claude_Vibecoding\airsynth; path=1766bf1cac83/47 entries; output=8100

- [x] G3: Page served on localhost loads without console errors; MediaPipe HandLandmarker initialises
  EVIDENCE: Browser pane http://localhost:8100: console shows only MediaPipe GL info logs ("Graph successfully started running"), no errors; camera NotAllowedError on Start is the expected pane block and is shown as a hint

- [x] G4: Simulated hand landmarks drive the engine: tempo, root, groove and all 8 modulation targets change on the live AudioContext, and the transport plays steps
  EVIDENCE: __as.feed with tests/hand.mjs hands: pointing pose close/low → bpm 80, root 0, cutoff 200 Hz (min since raised to 300 Hz, unit-tested), q 0.7, drive 1, reverb/echo/wobble/detune 0; wide/high/tilted/all open → bpm 125, root 7, groove 3 (Garage), swing 0.33, cutoff 8000, q 17.7, drive 12, decayTc 0.54, reverb 0.75, wobble 3000 c, detune 28 c, echo 0.6; filter.frequency.value followed (8000). ctx running, output RMS 0.22–0.27; 16th spacing measured 93.7 ms vs expected 93.8 ms @160 BPM; step cell lights

- [x] G5: Design audit (audit.js runAudit) reports zero violations in light and dark
  EVIDENCE: runAudit("body"): light 0; dark 1 = R9 "1.6:button" on the active .seg – known false positive (audit ignores .sel-marker under the text); measured marker rgb(251,255,0) under text rgb(0,0,0) = 19.4:1. Earlier R4 (.meter i 120ms) fixed with var(--dur-fast)

- [ ] G6: GitHub Pages for gabiwan24/airsynth is built from main
  CHECK: gh api repos/gabiwan24/airsynth/pages --jq .status
  EXPECT: built
  EVIDENCE: pending

- [ ] G7: Real webcam: index fingers set the beat, other fingers audibly modulate
  EVIDENCE: pending

ABANDON: G7 The agent browser pane blocks camera capture (NotAllowedError), so live hands cannot be exercised here. Handoff: user tests in Chrome/Edge; tune OPEN in src/gesture.js and BEAT in src/mapping.js to real hands.
