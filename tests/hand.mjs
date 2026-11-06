// Synthetic MediaPipe hand for tests: palm along +y from the wrist, each finger straight or curled.
// open: [thumb, index, middle, ring, pinky] 0 = curled … 1 = straight.
export function hand(open = [1, 1, 1, 1, 1], x = 0.5) {
  const p = Array.from({ length: 21 }, () => ({ x, y: 0, z: 0 }));
  p[0] = { x, y: 0, z: 0 }; // wrist
  const mcpX = [-0.02, -0.03, -0.01, 0.01, 0.03]; // thumb mcp, then index…pinky mcp
  // thumb: cmc 1, mcp 2, ip 3, tip 4 – spread away from the pinky side when open
  p[1] = { x: x - 0.02, y: 0.02, z: 0 };
  p[2] = { x: x - 0.035, y: 0.04, z: 0 };
  // tucked: tip rests over the palm near the pinky side; open: spread far out
  const tipX = x - 0.145 * open[0];
  p[3] = { x: (p[2].x + tipX) / 2, y: 0.05, z: 0 };
  p[4] = { x: tipX, y: 0.07 - 0.01 * open[0], z: 0 };
  for (let f = 0; f < 4; f++) {
    const base = 5 + f * 4, mx = x + mcpX[f + 1];
    p[base] = { x: mx, y: 0.09, z: 0 }; // mcp: palm length 0.09
    const len = 0.08; // mcp → tip when straight
    // curled finger folds back towards the wrist
    const reach = 0.09 + len * (open[f + 1] * 1.0) - (1 - open[f + 1]) * 0.01;
    p[base + 1] = { x: mx, y: 0.09 + (reach - 0.09) * 0.4, z: 0 };
    p[base + 2] = { x: mx, y: 0.09 + (reach - 0.09) * 0.7, z: 0 };
    p[base + 3] = { x: mx, y: reach, z: 0 };
  }
  p[17].x = x + 0.03; // pinky mcp
  return p;
}
