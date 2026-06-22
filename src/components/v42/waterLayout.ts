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
import { ISLAND_OFFSET } from './config';
import type { Vec3, PalmConfig } from './config';
import { outlineR } from './islandLayout';

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
// The outer sea edge is anchored to a FIXED island reference (the islet's
// ORIGINAL outline), NOT the live island outlineR — so growing the island (it
// now bulges back-left into the empty water) eats into the sea WITHOUT moving
// the sea's outer shape / back arc / perspective. Land exclusion + the wet-sand
// fringe below still use the live (enlarged) outlineR, so the shoreline hugs the
// new, bigger island.
const islandRef = (theta: number) =>
  1.36 * (1 + 0.11 * Math.sin(3 * theta + 0.6) + 0.06 * Math.sin(5 * theta + 1.3));
const waterOuter = (theta: number) =>
  islandRef(theta) + RING_MIN + RING_VAR * (0.5 + 0.5 * Math.sin(2 * theta + 0.4));

export function buildWater(config: PalmConfig): WaterModel {
  const c = config.colors;
  const blocks: WaterBlock[] = [];
  let n = 0;
  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Whole-sea DEPTH axis: +Z is near (toward the camera), −Z is far (horizon).
  // Re-tiled as depth-rows so the cells SHRINK + tighten with distance
  // (perspective) and DARKEN + saturate with depth — kept exactly from v22.
  const Z_FRONT = 4.7; // a touch beyond the front sea edge
  const Z_BACK = -9.3; // just past the pitons (base z ~ -8.5)
  // BACK SHAPE: the back edge is a circular ARC of radius R_BACK. The bulge is
  // centred on the CAMERA'S VIEW AXIS (not world −Z) so the rounded back reads
  // SYMMETRIC on screen — left and right curve evenly. (A world-symmetric bulge
  // looks right-heavy because the camera views from the front-right.) backFactor
  // = a cell's alignment with the view axis: 0 across the whole front, rising to
  // 1 straight back. With the z<0 clip below, nothing is ever added in front.
  const R_BACK = 10.2;
  const FHX = -0.529; // camera horizontal forward (toward the scene), normalised
  const FHZ = -0.848;
  const backOuter = (theta: number) => {
    const dd = FHX * Math.cos(theta) + FHZ * Math.sin(theta); // alignment w/ view axis
    const back = Math.pow(Math.max(0, dd), 2); // concentrate into a clean back arc
    return waterOuter(theta) + (R_BACK - waterOuter(theta)) * back;
  };
  // PERSPECTIVE: cell size shrinks from near (front) to far (back).
  const cellAt = (z: number) => 0.24 + 0.42 * clamp01((z - Z_BACK) / (Z_FRONT - Z_BACK));

  let z = Z_FRONT;
  while (z > Z_BACK) {
    const cell = cellAt(z);
    const zc = z - cell / 2;
    const dDepth = clamp01((Z_FRONT - zc) / (Z_FRONT - Z_BACK)); // 0 near .. 1 far
    for (let x = -7.5; x <= 7.5 + 1e-6; x += cell) {
      const xc = x;
      const d = Math.hypot(xc, zc);
      const theta = Math.atan2(zc, xc);
      // Land test uses the island's OFFSET centre (v41 pushback); the sea OUTER
      // edge (ring + back arc) stays anchored to the origin so its shape/extent
      // don't move — the island just recedes within the unchanged sea.
      const lx = xc - ISLAND_OFFSET[0];
      const lz = zc - ISLAND_OFFSET[1];
      const dLand = Math.hypot(lx, lz);
      const land = outlineR(Math.atan2(lz, lx));
      if (dLand <= land) continue; // island — skip
      const inRing = d <= waterOuter(theta);
      // Beyond the ring: only the rounded BACK arc — and only behind the islet
      // (zc < 0), so the front is never touched.
      const inBack = !inRing && zc < 0 && d <= backOuter(theta);
      if (!inRing && !inBack) continue;

      const edgeDist = dLand - land; // distance out from the (offset) shore
      const seed = Math.round(xc * 53 + zc * 29) + 500 + n;

      if (inRing && edgeDist < 0.48) {
        // Wet-sand fringe hugging the shore (near the islet; little depth shift).
        const col = jitter(c.wetSand, seed, 0.015, 0.05, 0.05);
        blocks.push({
          id: `fringe-${n}`,
          size: [cell + 0.012, FRINGE_THK, cell + 0.012],
          position: [xc, FRINGE_TOP - FRINGE_THK / 2, zc],
          quaternion: NO_ROT,
          color: col,
          edgeColor: edgeOf(col, 0.62),
          fringe: true,
        });
      } else {
        // Base shallow→body→deep (radial), THEN darken + saturate with DEPTH so
        // near water reads lighter/brighter and far water reads deeper/darker.
        const base = edgeDist < 0.95 ? c.waterShallow : edgeDist < 1.7 ? c.waterBody : c.waterDeep;
        const col3 = new THREE.Color(base);
        col3.offsetHSL(
          (rand(seed) - 0.5) * 0.02,
          lerp(-0.02, 0.16, dDepth) + (rand(seed + 9) - 0.5) * 0.04, // more saturated far
          lerp(0.06, -0.2, dDepth) + (rand(seed + 21) - 0.5) * 0.04, // darker far
        );
        const col = `#${col3.getHexString()}`;
        const thk = lerp(WATER_THK, 0.2, dDepth); // thinner + tighter far
        blocks.push({
          id: `water-${n}`,
          size: [cell + 0.01, thk, cell + 0.01],
          position: [xc, WATER_TOP - thk / 2, zc],
          quaternion: NO_ROT,
          color: col,
          edgeColor: edgeOf(col, 0.9),
          fringe: false,
        });
      }
      n++;
    }
    z -= cell;
  }

  return { blocks };
}
