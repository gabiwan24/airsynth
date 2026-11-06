// Pure hand geometry: MediaPipe landmarks → continuous finger openness and hand roles. No DOM, testable in Node.

// Landmark indices (MediaPipe hand model)
export const WRIST = 0, THUMB_MCP = 2, THUMB_TIP = 4, INDEX_TIP = 8, PINKY_MCP = 17;
export const TIPS = [4, 8, 12, 16, 20]; // thumb, index, middle, ring, pinky
const FINGERS = [[5, 8], [9, 12], [13, 16], [17, 20]]; // [mcp, tip] for index … pinky

// Scale-free ratios on 3D world landmarks (independent of hand size and distance to the camera).
// Finger: |wrist→tip| / |wrist→mcp|: fist ≈ 0.8–1.1, straight ≈ 1.8–2.0.
// Thumb: |thumbTip→pinkyMcp| / |thumbMcp→pinkyMcp|: tucked ≈ 0.6–1.0, spread ≈ 1.5+.
// [ratio that counts as fully closed, ratio that counts as fully open]
export const OPEN = { finger: [1.1, 1.8], thumb: [1.0, 1.5] };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const unit = (r, [lo, hi]) => Math.min(1, Math.max(0, (r - lo) / (hi - lo)));

/** Openness 0 (curled) … 1 (stretched) of [thumb, index, middle, ring, pinky], written into `out`. */
export function openness(world, out = new Float32Array(5)) {
  out[0] = unit(dist(world[THUMB_TIP], world[PINKY_MCP]) / dist(world[THUMB_MCP], world[PINKY_MCP]), OPEN.thumb);
  for (let i = 0; i < 4; i++) {
    const [mcp, tip] = FINGERS[i];
    out[i + 1] = unit(dist(world[WRIST], world[tip]) / dist(world[WRIST], world[mcp]), OPEN.finger);
  }
  return out;
}

/**
 * Which detected hand is the player's right / left one. Raw camera frames are unmirrored, so the
 * player's right hand has the smaller x. Position is used instead of MediaPipe's handedness label,
 * which depends on mirroring and flips. One hand alone: decided by the image half it is in.
 * hands: [{ landmarks, world }] → { right, left } (either may be null)
 */
export function assignHands(hands) {
  if (hands.length === 0) return { right: null, left: null };
  if (hands.length === 1) return hands[0].landmarks[WRIST].x < 0.5 ? { right: hands[0], left: null } : { right: null, left: hands[0] };
  const [a, b] = hands[0].landmarks[WRIST].x <= hands[1].landmarks[WRIST].x ? [hands[0], hands[1]] : [hands[1], hands[0]];
  return { right: a, left: b };
}
