# Status
_Updated: 2026-11-06_

## Now
v1 built and verified with simulated hands. Waiting for a real webcam test by the user.

## Works
- Index fingertips → tempo (80–160), root (8 scale steps, hysteresis), groove (Halftime/Breakbeat/House/Garage/Techno by tilt), swing (hands right of centre)
- 8 finger modulators (openness 0..1, smoothed): Drive, Filter, Resonance, Decay | Reverb, Wobble, Width, Echo
- Synth: 2 detuned oscillators + sub, lowpass with envelope + tempo-synced wobble, tanh drive, kick sidechain pump; 4 sounds (Saw/Square/Acid/Soft)
- Drums: synthesized kick/snare/hat on a 60 ms look-ahead scheduler (step timing measured exact)
- Key, scale (minor/major penta, dorian, phrygian), smoothing, drums on/off by click; Space = start/stop
- Unit tests: `npm test`

## Next
1. Live webcam test; tune `OPEN` (gesture.js) and `BEAT` ranges (mapping.js) to real hands
2. Optional: record/loop, MIDI out

## Known issues
- Camera does not work in the Claude browser pane – test in Chrome/Edge
- Audio output latency is device-bound (74 ms measured in the pane)
- Design audit dark R9 on active segment is a false positive (marker under text not seen by audit)
