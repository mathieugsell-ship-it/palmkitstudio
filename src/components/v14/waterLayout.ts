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

  return { blocks };
}
