// Distant HORIZON karst pitons (v16). Real Phang Nga limestone stacks are far
// bigger than a palm, so they live FAR BACK on the horizon — large in world,
// small + hazy on screen — adding depth without dwarfing the foreground islet.
//
// This builds the block geometry only (positions/sizes); the hazy "atmospheric"
// look (pale, translucent, low-contrast, faded into the dawn) is applied by the
// HorizonPitons component's flat materials. NOT part of the foreground build
// pipeline (no white settle edges, no glowing nodes). Static backdrop.
//
// Positions were chosen so all three stay framed on desktop AND the pulled-back
// mobile camera (verified by projecting them through the camera). Tunable here.

export interface HorizonBlock {
  position: [number, number, number];
  size: [number, number, number];
  kind: 'rock' | 'crown';
}

interface Spec {
  cx: number;
  cz: number;
  yb: number; // base (bottom) y, around the distant sea/horizon line
  h: number; // world height (big — but far away)
  topW: number; // max width (bulky karst, wider near the top)
  levels: number;
  seed: number;
  driftX: number;
  driftZ: number;
}

// Isolated stack on the left + a cluster of two on the right → framed like a bay.
const PITONS: Spec[] = [
  { cx: -14.5, cz: -16.8, yb: -1.2, h: 4.3, topW: 4.0, levels: 6, seed: 3, driftX: 0.4, driftZ: 0.2 },
  { cx: -12.0, cz: -23.1, yb: -1.2, h: 5.4, topW: 5.0, levels: 7, seed: 9, driftX: -0.5, driftZ: 0.3 },
  { cx: -7.8, cz: -18.7, yb: -1.2, h: 3.6, topW: 3.0, levels: 5, seed: 21, driftX: 0.3, driftZ: -0.2 },
];

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

function buildOne(P: Spec, out: HorizonBlock[]) {
  const segH = P.h / P.levels;
  const baseW = P.topW * 0.5; // narrow eroded base
  for (let i = 0; i < P.levels; i++) {
    const t = i / (P.levels - 1); // 0 base .. 1 top
    const bulge = t < 0.72 ? smooth(t / 0.72) : 1 - 0.35 * ((t - 0.72) / 0.28);
    const w = baseW + (P.topW - baseW) * bulge;
    const y = P.yb + i * segH + segH / 2;
    const px = P.cx + P.driftX * t + (rand(P.seed + i) - 0.5) * w * 0.18;
    const pz = P.cz + P.driftZ * t + (rand(P.seed + i + 50) - 0.5) * w * 0.18;
    const sx = w * (1 + (rand(P.seed + i + 7) - 0.5) * 0.14);
    const sz = w * (1 + (rand(P.seed + i + 13) - 0.5) * 0.14);
    out.push({ position: [px, y, pz], size: [sx, segH * 1.04, sz], kind: 'rock' });
    // jagged side ledge for an irregular karst silhouette
    if (i >= 1 && i < P.levels - 1 && rand(P.seed + i + 99) > 0.45) {
      const side = rand(P.seed + i + 5) > 0.5 ? 1 : -1;
      const lw = w * 0.55;
      out.push({
        position: [px + side * w * 0.5, y + segH * 0.1, pz + (rand(P.seed + i + 8) - 0.5) * w * 0.3],
        size: [lw, segH * 0.85, lw],
        kind: 'rock',
      });
    }
  }
  // muted green crown (a few small blocks)
  const topY = P.yb + P.h;
  const cn = P.levels >= 6 ? 4 : 3;
  for (let k = 0; k < cn; k++) {
    const gw = P.topW * (0.18 + rand(P.seed + k + 200) * 0.12);
    out.push({
      position: [
        P.cx + P.driftX + (rand(P.seed + k + 30) - 0.5) * P.topW * 0.55,
        topY + gw * 0.3,
        P.cz + P.driftZ + (rand(P.seed + k + 40) - 0.5) * P.topW * 0.55,
      ],
      size: [gw, gw * 0.7, gw],
      kind: 'crown',
    });
  }
}

export function buildHorizonPitons(): HorizonBlock[] {
  const out: HorizonBlock[] = [];
  for (const p of PITONS) buildOne(p, out);
  return out;
}
