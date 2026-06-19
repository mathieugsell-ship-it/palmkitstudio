// Procedural voxel island/beach base — SCENERY STEP 1.
//
// A small, low floating chunk of Phuket the palm plants into. Same voxel
// treatment as the palm (solid-yet-translucent faces + crisp edges), but more
// transparent/recessed so the palm stays the hero. Built as a few stacked,
// slightly-irregular blocks:
//   • dry-sand top slab   — palm sits on it (top at y≈0)
//   • damp shoreline rim  — wider + lower; its exposed rim is where WATER will
//                           meet the island in the next step
//   • floating underside  — two tapering chunks for the "floating land" look
//
// Returns blocks + a deduplicated vertex set (for optional subtle base nodes).
// Structured so water can meet the damp rim cleanly next.

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface IslandBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  /** Per-block translucency: the sand surface reads solid; the floating
   *  underside stays ghostly so it recedes (premium diorama hierarchy). */
  opacity: number;
}

export interface IslandModel {
  blocks: IslandBlock[];
  vertices: Vec3[];
  /** Top of the dry sand (where the palm is planted) and the rim height. */
  topY: number;
  rimY: number;
}

const NO_ROT: [number, number, number, number] = [0, 0, 0, 1];

function boxCorners(size: Vec3, pos: Vec3): Vec3[] {
  const [w, h, d] = size;
  const out: Vec3[] = [];
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5])
        out.push([pos[0] + sx * w, pos[1] + sy * h, pos[2] + sz * d]);
  return out;
}

export function buildIsland(config: PalmConfig): IslandModel {
  const c = config.colors;

  // Slightly irregular (non-square, small offsets) so it doesn't read as a
  // perfect cube. Dry-sand top face sits at y = 0 (palm base plants here).
  const op = config.baseOpacity;
  const blocks: IslandBlock[] = [
    // Dry sand — the beach the palm stands on (reads as solid sand).
    { id: 'sand-dry', size: [2.3, 0.28, 2.05], position: [0.06, -0.14, -0.02], quaternion: NO_ROT, color: c.sandDry, opacity: op },
    // Damp shoreline rim — wider + a touch lower so its rim is exposed around
    // the dry sand; this is the edge water will meet next step.
    { id: 'sand-rim', size: [2.85, 0.17, 2.6], position: [0, -0.22, 0.04], quaternion: NO_ROT, color: c.sandDamp, opacity: op * 0.95 },
    // Floating underside — one shallow tapering chunk (ghostly, recedes).
    { id: 'sand-under', size: [2.0, 0.3, 1.8], position: [-0.02, -0.45, 0.0], quaternion: NO_ROT, color: c.sandUnder, opacity: op * 0.6 },
    // Floating tip — small, keeps the "floating land" read without a plinth.
    { id: 'sand-tip', size: [1.05, 0.26, 0.95], position: [0.03, -0.71, 0.02], quaternion: NO_ROT, color: c.sandUnderDeep, opacity: op * 0.52 },
  ];

  // Deduplicated corner set (tolerance merge), same approach as the palm so the
  // optional base nodes are stable and sit exactly on real corners.
  const TOL = 0.07;
  const tol2 = TOL * TOL;
  const vertices: Vec3[] = [];
  for (const b of blocks) {
    for (const corner of boxCorners(b.size, b.position)) {
      let dup = false;
      for (const m of vertices) {
        const dx = corner[0] - m[0];
        const dy = corner[1] - m[1];
        const dz = corner[2] - m[2];
        if (dx * dx + dy * dy + dz * dz < tol2) {
          dup = true;
          break;
        }
      }
      if (!dup) vertices.push(corner);
    }
  }

  return { blocks, vertices, topY: 0, rimY: -0.16 };
}
