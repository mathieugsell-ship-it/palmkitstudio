// Procedural ROUNDED voxel islet — SCENERY STEP 1 (redo).
//
// A small organic beach island the palm plants into: a grid of voxel columns
// over a disc with an IRREGULAR, lobed outline and a gentle DOME on top. Each
// column = a sand block on top + earth/rock blocks below that TAPER INWARD as
// they go down (deeper, slightly-smaller blocks only nearer the centre), giving
// a rounded, solid underside with real depth — a grounded little chunk of land,
// not a floating slab. No glowing nodes (those are reserved for the palm).
//
// Structured so water can meet the rim cleanly in the next step.

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface IslandBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
}

export interface IslandModel {
  blocks: IslandBlock[];
  radius: number;
}

const NO_ROT: [number, number, number, number] = [0, 0, 0, 1];

// Deterministic pseudo-random for subtle per-block variety.
const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.015, sA = 0.05, lA = 0.05): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
// Crisp natural edge = a darker tint of the block's own colour (NOT tech-teal).
function edgeOf(hex: string): string {
  return `#${new THREE.Color(hex).multiplyScalar(0.6).getHexString()}`;
}

// ---- island form ----------------------------------------------------------
export const CELL = 0.5; // voxel footprint (shared with the water grid)
export const R = 1.4; // island base radius — near-original, so the front/boat
//                       sector floats free again (v26's 1.6 crept under the boat)
const SAND_THK = 0.34;
const DOME = 0.28; // how much the sand top drops from centre to rim (rounded mound)
// Asymmetric growth: the base disc stays small (front/boat sector ≈ original, so
// the boat floats on open water), and a focused BULGE pushes the extra land into
// the empty BACK-LEFT — world ~195° (−x, leaning back), which the front-right
// camera projects to the upper-left. A tight cos⁴ falloff keeps the bulge clear
// of the boat, whose hull sweeps the front-left sector (θ≈70–145°). The outer
// WATER edge is decoupled (waterLayout keeps its own fixed island reference), so
// the island eats into the empty water without moving the sea's outline.
const BULGE = 2.0; // extra reach into the back-left
const BULGE_DIR = (195 * Math.PI) / 180; // back-left, behind the boat
// Lobed, slightly-irregular outline so the rim reads organic, not circular.
// Exported so the water grid can exclude land cells and meet the shore exactly.
export const outlineR = (theta: number) => {
  const lobes = 0.11 * Math.sin(3 * theta + 0.6) + 0.06 * Math.sin(5 * theta + 1.3);
  // One-sided smooth bulge (tight cos⁴ falloff so it concentrates in the
  // back-left and never reaches the boat), with a little extra wobble so the
  // extended side stays organic rather than a clean circular arc.
  const dth = Math.atan2(Math.sin(theta - BULGE_DIR), Math.cos(theta - BULGE_DIR));
  const bulge = BULGE * Math.pow(Math.max(0, Math.cos(dth)), 4) * (1 + 0.08 * Math.sin(4 * theta + 0.9));
  return R * (1 + lobes) + bulge;
};

export function buildIsland(config: PalmConfig): IslandModel {
  const c = config.colors;
  const blocks: IslandBlock[] = [];
  // Cover the full reach (base disc + the back-left bulge); cells beyond the
  // local outline are skipped below.
  const N = Math.ceil((R * 1.25 + BULGE) / CELL);
  let n = 0;

  for (let ix = -N; ix <= N; ix++) {
    for (let iz = -N; iz <= N; iz++) {
      const x = ix * CELL;
      const z = iz * CELL;
      const d = Math.hypot(x, z);
      const theta = Math.atan2(z, x);
      const rim = outlineR(theta);
      if (d > rim) continue;
      // Normalize by the LOCAL rim so the dome + underside taper scale to the
      // bigger, bulged island (centre stays high → palm still plants at y≈0).
      const nd = Math.min(d / rim, 1);
      const seed = ix * 73 + iz * 31 + 100;

      // Domed mound + a touch of stepped irregularity on the top.
      const topY = -DOME * nd * nd + (rand(seed) - 0.5) * 0.07;

      // Sand block (top). Highlight near the domed centre, darker at the rim.
      const sandBase = nd < 0.32 ? c.sandHi : nd > 0.78 ? c.sandLo : c.sandMain;
      const sandColor = jitter(sandBase, seed);
      blocks.push({
        id: `sand-${n}`,
        size: [CELL + 0.012, SAND_THK, CELL + 0.012],
        position: [x, topY - SAND_THK / 2, z],
        quaternion: NO_ROT,
        color: sandColor,
        edgeColor: edgeOf(sandColor),
      });

      // Earth/rock underside — tapers inward: more layers + smaller footprint
      // toward the centre → rounded solid bottom (not a slab).
      let yb = topY - SAND_THK;
      const layers: Array<{ h: number; scale: number; base: string }> = [];
      if (nd < 0.94) layers.push({ h: 0.34, scale: 1.0, base: c.earth1 });
      if (nd < 0.64) layers.push({ h: 0.34, scale: 0.9, base: c.earth2 });
      if (nd < 0.36) layers.push({ h: 0.32, scale: 0.78, base: c.earth3 });
      layers.forEach((ly, k) => {
        const w = CELL * ly.scale + 0.012;
        const col = jitter(ly.base, seed + (k + 1) * 17);
        blocks.push({
          id: `earth-${n}-${k}`,
          size: [w, ly.h + 0.012, w],
          position: [x, yb - ly.h / 2, z],
          quaternion: NO_ROT,
          color: col,
          edgeColor: edgeOf(col),
        });
        yb -= ly.h;
      });
      n++;
    }
  }

  return { blocks, radius: R };
}
