// Procedural translucent voxel WATER around the island — SCENERY STEP 2.
//
// Reuses the island's grid + lobed outline (imported) so water meets the shore
// exactly. Fills cells OUTSIDE the island, out to a compact lobed water radius:
//   • the first ring hugging the island → WET-SAND fringe blocks (additive;
//     the validated island blocks are untouched)
//   • beyond that → thin translucent water blocks: bright SHALLOW near the
//     shore, BODY mid, DEEP toward the outer rim.
//
// Static for now. Each block carries its own height/level so a gentle voxel
// ripple can later offset water-block Y without touching this structure.

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';
import { CELL, outlineR } from './islandLayout';

export interface WaterBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
  /** true = wet-sand fringe (opaque-ish land), false = translucent water. */
  fringe: boolean;
}

export interface WaterModel {
  blocks: WaterBlock[];
}

const NO_ROT: [number, number, number, number] = [0, 0, 0, 1];

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.02, sA = 0.06, lA = 0.06): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
const edgeOf = (hex: string, k = 0.72) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

// ---- levels (relative to the island: dry rim sand top ≈ -0.28) -------------
const WATER_TOP = -0.42; // water surface sits just below the sand rim
const WATER_THK = 0.42; // flatter slab — reads as a water surface, not glass walls
const FRINGE_TOP = -0.3; // wet sand bridges sand → water
const FRINGE_THK = 0.36;
// Outer water edge anchored to the ISLAND outline + a guaranteed minimum
// margin, so the ring follows the lobed island evenly all the way around (no
// thin spots / gaps). A gentle extra wobble keeps the sea edge organic.
const RING_MIN = 2.9; // water margin beyond the shore — wide enough to keep the
//                       larger foreground longtail fully on the water (+ karst
//                       rocks to come). Tune down to shrink the sea.
const RING_VAR = 0.24; // gentle outer irregularity
const waterOuter = (theta: number) =>
  outlineR(theta) + RING_MIN + RING_VAR * (0.5 + 0.5 * Math.sin(2 * theta + 0.4));
// Bound for the grid loop: max island outline + max ring margin.
const GRID_BOUND = 1.6 + RING_MIN + RING_VAR;

export function buildWater(config: PalmConfig): WaterModel {
  const c = config.colors;
  const blocks: WaterBlock[] = [];
  const M = Math.ceil((GRID_BOUND * 1.1) / CELL);
  let n = 0;

  for (let ix = -M; ix <= M; ix++) {
    for (let iz = -M; iz <= M; iz++) {
      const x = ix * CELL;
      const z = iz * CELL;
      const d = Math.hypot(x, z);
      const theta = Math.atan2(z, x);
      const land = outlineR(theta);
      if (d <= land) continue; // island cell — skip (island handles it)
      if (d > waterOuter(theta)) continue; // beyond the sea edge
      const edgeDist = d - land; // distance out from the shore
      const seed = ix * 53 + iz * 29 + 500;

      if (edgeDist < CELL * 0.95) {
        // Wet-sand fringe hugging the shore.
        const col = jitter(c.wetSand, seed, 0.015, 0.05, 0.05);
        blocks.push({
          id: `fringe-${n}`,
          size: [CELL + 0.012, FRINGE_THK, CELL + 0.012],
          position: [x, FRINGE_TOP - FRINGE_THK / 2, z],
          quaternion: NO_ROT,
          color: col,
          edgeColor: edgeOf(col, 0.62),
          fringe: true,
        });
      } else {
        // Translucent water: shallow near shore → body → deep outward.
        const base =
          edgeDist < CELL * 1.9 ? c.waterShallow : edgeDist < CELL * 3.3 ? c.waterBody : c.waterDeep;
        const col = jitter(base, seed);
        blocks.push({
          id: `water-${n}`,
          size: [CELL + 0.01, WATER_THK, CELL + 0.01],
          position: [x, WATER_TOP - WATER_THK / 2, z],
          quaternion: NO_ROT,
          color: col,
          edgeColor: edgeOf(col, 0.9), // very subtle, low-contrast water edges
          fringe: false,
        });
      }
      n++;
    }
  }

  // ---- far receding sea -----------------------------------------------------
  // Extend the water BACK (toward the distant pitons on the horizon) beyond the
  // foreground ring, with cells + band shrinking with distance → a voxel
  // perspective recede, so the distant pitons emerge from the sea instead of
  // floating. The foreground ring above is untouched; we only add cells that lie
  // beyond it. A gentle drift toward -x follows the view axis toward the pitons.
  const FAR_Z0 = -3.2; // begin behind the islet
  const FAR_Z1 = -9.3; // just past the pitons (base z ~ -8.5)
  let z = FAR_Z0;
  let nf = 0;
  while (z > FAR_Z1) {
    const tFar = (FAR_Z0 - z) / (FAR_Z0 - FAR_Z1); // 0 (near) .. 1 (horizon)
    const cell = 0.58 - 0.22 * tFar; // cells shrink with distance (0.58 → 0.36)
    const halfW = 3.8 - 1.9 * tFar; // band narrows toward the horizon
    const cxx = -1.0 * tFar; // drift toward the pitons / view axis
    const thk = 0.3 - 0.12 * tFar; // thinner far slabs
    const zc = z - cell / 2;
    for (let x = cxx - halfW; x <= cxx + halfW + 1e-6; x += cell) {
      const d = Math.hypot(x, zc);
      const theta = Math.atan2(zc, x);
      if (d <= outlineR(theta)) continue; // never over the island
      if (d <= waterOuter(theta)) continue; // already covered by the foreground ring
      const seed = Math.round(x * 50 + zc * 30) + 7000 + nf;
      // Deep water fading paler toward the hazy horizon (atmospheric distance).
      let col = jitter(c.waterDeep, seed);
      col = `#${new THREE.Color(col).lerp(new THREE.Color(c.skyTop), Math.min(1, tFar) * 0.5).getHexString()}`;
      blocks.push({
        id: `farwater-${nf}`,
        size: [cell + 0.012, thk, cell + 0.012],
        position: [x, WATER_TOP - thk / 2, zc],
        quaternion: NO_ROT,
        color: col,
        edgeColor: edgeOf(col, 0.9),
        fringe: false,
      });
      nf++;
    }
    z -= cell;
  }

  return { blocks };
}
