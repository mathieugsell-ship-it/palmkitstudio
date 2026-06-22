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
import { ISLAND_OFFSET } from './config';
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
export const R = 1.35; // island base radius — kept small so the LEFT + FRONT
//                        sit back near original and the boat floats free, water
//                        all around it (v26/v27 spread left and crept the boat)
const SAND_THK = 0.34;
const DOME = 0.28; // how much the sand top drops from centre to rim (rounded mound)
// Asymmetric growth: the base disc stays small all round (boat floats on open
// water; palm keeps ~1.3 of sand on the front + sides), and a focused BULGE
// pushes the extra land straight into the DEPTH — world ~240°, the camera's view
// axis, which projects directly BEHIND the palm toward the horizon (the empty
// water back there). A tight cos⁶ falloff keeps it off the left and the boat
// (whose hull sweeps the front-left, θ≈70–145°). So the island gains size in
// depth, not on the left, with the palm still roughly centred (front ~1.5, back
// ~3.2). The outer WATER edge is decoupled (waterLayout keeps its own fixed
// island reference), so the island eats into the empty water behind without
// moving the sea's outline / back arc / perspective.
const BULGE = 1.9; // extra reach into the depth (behind the palm)
const BULGE_DIR = (240 * Math.PI) / 180; // view-axis depth, straight behind the palm
// Back-LEFT corner fill (v29): a SEPARATE, angularly-windowed bump that adds sand
// only in the back-left, where the sea sat empty between the depth lobe and the
// left. It's a raised cosine that is exactly ZERO outside [DIR2±W], so it cannot
// touch the depth lobe (240°), the boat (θ≤166°), the front, the right or the
// pitons — those stay byte-for-byte identical to v28.
const BULGE2 = 1.3; // back-left corner reach
const BULGE2_DIR = (202 * Math.PI) / 180; // back-left (between the left and the depth lobe)
const BULGE2_W = (30 * Math.PI) / 180; // half-window; bump is zero beyond this
// Lobed, slightly-irregular outline so the rim reads organic, not circular.
// Exported so the water grid can exclude land cells and meet the shore exactly.
export const outlineR = (theta: number) => {
  const lobes = 0.11 * Math.sin(3 * theta + 0.6) + 0.06 * Math.sin(5 * theta + 1.3);
  const wobble = 1 + 0.08 * Math.sin(4 * theta + 0.9);
  // One-sided smooth depth bulge (tight cos⁶ falloff so it concentrates straight
  // back into the depth and never reaches the left or the boat).
  const dth = Math.atan2(Math.sin(theta - BULGE_DIR), Math.cos(theta - BULGE_DIR));
  const bulge = BULGE * Math.pow(Math.max(0, Math.cos(dth)), 6) * wobble;
  // Back-left corner: localized raised-cosine bump, zero outside its window.
  const a2 = Math.atan2(Math.sin(theta - BULGE2_DIR), Math.cos(theta - BULGE2_DIR));
  const bulge2 =
    Math.abs(a2) < BULGE2_W ? BULGE2 * 0.5 * (1 + Math.cos((Math.PI * a2) / BULGE2_W)) * wobble : 0;
  return R * (1 + lobes) + bulge + bulge2;
};

export function buildIsland(config: PalmConfig): IslandModel {
  const c = config.colors;
  const blocks: IslandBlock[] = [];
  // Cover the full reach (base disc + the deepest bulge); cells beyond the
  // local outline are skipped below.
  const N = Math.ceil((R * 1.25 + Math.max(BULGE, BULGE2)) / CELL);
  let n = 0;

  for (let ix = -N; ix <= N; ix++) {
    for (let iz = -N; iz <= N; iz++) {
      const x = ix * CELL;
      const z = iz * CELL;
      const d = Math.hypot(x, z);
      const theta = Math.atan2(z, x);
      const rim = outlineR(theta);
      if (d > rim) continue;
      // World position = local (outline test stays local) + the island pushback.
      const X = x + ISLAND_OFFSET[0];
      const Z = z + ISLAND_OFFSET[1];
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
        position: [X, topY - SAND_THK / 2, Z],
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
          position: [X, yb - ly.h / 2, Z],
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
