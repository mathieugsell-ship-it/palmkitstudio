// Stylized voxel KARST PITONS — SCENERY (v15). The iconic Phang Nga / Phuket
// limestone stacks: tall, roughly vertical voxel columns with a NARROW eroded
// base at the waterline that BULGES WIDER toward the top (the distinctive karst
// silhouette), jagged stepped sides (per-level jitter + side "ledge" blocks), a
// slight lean, and a few small green crown blocks for life. Two of them — a
// taller main + a smaller neighbour — rising from the open water on the right,
// balancing the boat on the front-left.
//
// Same voxel language as the rest (thin white settle edges + translucent faces
// are applied downstream by SceneBuild). NO glowing vertex nodes (reserved for
// the palm) — excluded from the construction-point field in sceneBuild. Static.
// Maps to the Local SEO service (to be made clickable later).

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface PitonBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
}

export interface PitonModel {
  blocks: PitonBlock[];
}

const NO_ROT: [number, number, number, number] = [0, 0, 0, 1];
const WATER_Y = -0.42; // waterline (see waterLayout)

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.015, sA = 0.05, lA = 0.06): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
const edgeOf = (hex: string, k = 0.6) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;
const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

interface PitonSpec {
  cx: number;
  cz: number;
  levels: number;
  segH: number;
  baseW: number; // narrow eroded base
  topW: number; // bulged top
  rootDepth: number; // how far the base sinks below the waterline
  driftX: number; // lean across height (top vs base)
  driftZ: number;
  seed: number;
}

// ---- placement (tunable) — pushed deep along the VIEW AXIS (true depth behind
// the islet), not sideways: far back toward the horizon, only slightly right of
// the palm, so they read as small distant rocks on the horizon yet stay fully in
// frame and centred-right. ONLY cx/cz changed; size/shape/colours/solidity are
// identical to v15/v17.
const MAIN: PitonSpec = {
  cx: -1.2, cz: -8.6, levels: 7, segH: 0.42, baseW: 0.5, topW: 1.12,
  rootDepth: 0.32, driftX: -0.2, driftZ: 0.1, seed: 11,
};
const SMALL: PitonSpec = {
  cx: 0.2, cz: -8.3, levels: 4, segH: 0.4, baseW: 0.34, topW: 0.72,
  rootDepth: 0.28, driftX: 0.15, driftZ: -0.1, seed: 37,
};

function buildOne(P: PitonSpec, c: PalmConfig['colors'], out: PitonBlock[], pre: string) {
  let n = 0;
  for (let i = 0; i < P.levels; i++) {
    const t = i / (P.levels - 1); // 0 base .. 1 top
    // Karst width profile: narrow base → bulge wide by ~0.75h → slight crown taper.
    const bulge = t < 0.75 ? smooth(t / 0.75) : 1 - 0.4 * ((t - 0.75) / 0.25);
    const w = P.baseW + (P.topW - P.baseW) * bulge;
    const y = WATER_Y - P.rootDepth + i * P.segH + P.segH / 2;
    const px = P.cx + P.driftX * t + (rand(P.seed + i) - 0.5) * 0.16;
    const pz = P.cz + P.driftZ * t + (rand(P.seed + i + 50) - 0.5) * 0.16;
    const sx = w * (1 + (rand(P.seed + i + 7) - 0.5) * 0.12);
    const sz = w * (1 + (rand(P.seed + i + 13) - 0.5) * 0.12);
    const base = t < 0.33 ? c.pitonLo : t < 0.7 ? c.pitonMid : c.pitonHi;
    const col = jitter(base, P.seed + i * 3);
    out.push({ id: `${pre}-${n++}`, size: [sx, P.segH + 0.04, sz], position: [px, y, pz], quaternion: NO_ROT, color: col, edgeColor: edgeOf(col) });
    // Jagged side ledge on some upper-mid levels (asymmetric, characterful).
    if (i >= 2 && i < P.levels - 1 && rand(P.seed + i + 99) > 0.5) {
      const side = rand(P.seed + i + 5) > 0.5 ? 1 : -1;
      const lw = w * 0.5;
      const lcol = jitter(base, P.seed + i * 3 + 1);
      out.push({
        id: `${pre}-l${n++}`,
        size: [lw, P.segH * 0.8, lw],
        position: [px + side * w * 0.55, y + P.segH * 0.1, pz + (rand(P.seed + i + 8) - 0.5) * w * 0.4],
        quaternion: NO_ROT,
        color: lcol,
        edgeColor: edgeOf(lcol),
      });
    }
  }
  // Green crown — a few small blocks for life (muted frond greens).
  const topY = WATER_Y - P.rootDepth + P.levels * P.segH;
  const greens = c.pitonCrown;
  const cn = P.levels >= 6 ? 4 : 3;
  for (let k = 0; k < cn; k++) {
    const gw = 0.22 + rand(P.seed + k + 200) * 0.14;
    const gx = P.cx + P.driftX + (rand(P.seed + k + 30) - 0.5) * P.topW * 0.6;
    const gz = P.cz + P.driftZ + (rand(P.seed + k + 40) - 0.5) * P.topW * 0.6;
    const gy = topY + gw * 0.4;
    const gcol = jitter(greens[k % 2], P.seed + k + 300, 0.02, 0.06, 0.06);
    out.push({ id: `${pre}-g${k}`, size: [gw, gw * 0.8, gw], position: [gx, gy, gz], quaternion: NO_ROT, color: gcol, edgeColor: edgeOf(gcol) });
  }
}

export function buildPitons(config: PalmConfig): PitonModel {
  const blocks: PitonBlock[] = [];
  buildOne(MAIN, config.colors, blocks, 'pitonA');
  buildOne(SMALL, config.colors, blocks, 'pitonB');
  return { blocks };
}
