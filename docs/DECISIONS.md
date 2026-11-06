# Decisions
<!-- one line each: YYYY-MM-DD – decision – why. Append only. -->
2026-11-06 – Vanilla JS + static server, tracker/design system reused from finger-piano – same latency-first stack, nothing to build.
2026-11-06 – Index fingertips own the beat (distance → tempo, height → root, tilt → groove, midpoint → swing); other 8 fingers are continuous modulators – user spec; continuous openness instead of on/off makes fingers feel like knobs.
2026-11-06 – Right hand = tone (drive, filter, resonance, decay), left hand = motion/space (reverb, wobble, width, echo) – one hand shapes the sound, the other places it.
2026-11-06 – Root and groove quantized with hysteresis (30 % of a cell), tempo/swing smoothed – a resting hand must not flicker between notes or patterns.
2026-11-06 – Permanent mono synth voice + look-ahead scheduler (60 ms) on the audio clock – fingers act within one audio block, beat stays sample-accurate.
2026-11-06 – Filter envelope and wobble go to BiquadFilter.detune (cents) – multiplicative on top of the finger cutoff, never negative Hz.
2026-11-06 – Canvas drawn mirrored in JS instead of CSS – fingertip labels must stay readable.
2026-11-06 – Hands centred = straight timing, swing only towards the right – default should groove straight.
