// Stylized voxel LONGTAIL BOAT — SCENERY (v14).
//
// Built from the reference SILHOUETTE only (not the photo): a long slim wooden
// hull, a tall pointed prow that curves upward, a dark engine at the stern with
// a long propeller shaft angling back-and-down into the water, and tiny
// red/blue/pale ribbons wrapped near the prow top. Rendered as blocks in the
// SAME voxel language as the island/palm (thin edges + translucent faces are
// applied downstream by SceneBuild). NO glowing vertex nodes (reserved for the
// palm) — the boat is excluded from the construction-point field in sceneBuild.
//
// Discreet by design: it floats on the water beside the island, off to one
// side/front, small enough that the palm stays the hero. Static for now, but
// each block keeps its world position so it can gently bob with the ripple
// later (give the group a 'boat' ripple flag then).

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface BoatBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
}

export interface BoatModel {
  blocks: BoatBlock[];
}

// ---- placement (tunable) ---------------------------------------------------
// Foreground water off the island's front-left, resting on the water surface
// (waterline ≈ -0.42, see waterLayout). Yaw turns the long profile to the view
// AND keeps it roughly tangential to the shore, so the long shaft + bow stay
// inside the water ring (don't poke past the sea edge). Scaled down so it reads
// as a discreet detail, not a co-star.
const CX = -1.2;
const CY = -0.42; // waterline
const CZ = 1.2;
const PHI = -0.785; // yaw about Y (radians) — ~tangential to the shore
const SCALE = 0.82; // overall size (discreet)

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.012, sA = 0.05, lA = 0.05): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
const edgeOf = (hex: string, k = 0.6) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

export function buildBoat(config: PalmConfig): BoatModel {
  const c = config.colors;
  const blocks: BoatBlock[] = [];
  const YAXIS = new THREE.Vector3(0, 1, 0);
  const ZAXIS = new THREE.Vector3(0, 0, 1);
  const yaw = new THREE.Quaternion().setFromAxisAngle(YAXIS, PHI);

  const place = (x: number, y: number, z: number): Vec3 => {
    const v = new THREE.Vector3(x, y, z).applyQuaternion(yaw);
    return [v.x + CX, v.y + CY, v.z + CZ];
  };
  const qof = (localQ?: THREE.Quaternion): [number, number, number, number] => {
    const q = localQ ? yaw.clone().multiply(localQ) : yaw.clone();
    return [q.x, q.y, q.z, q.w];
  };

  let n = 0;
  const add = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    base: string,
    localQ?: THREE.Quaternion,
  ) => {
    const col = jitter(base, n * 7 + 13);
    blocks.push({
      id: `boat-${n}`,
      size: [sx * SCALE, sy * SCALE, sz * SCALE],
      position: place(x * SCALE, y * SCALE, z * SCALE),
      quaternion: qof(localQ),
      color: col,
      edgeColor: edgeOf(col),
    });
    n++;
  };

  // ---- hull (slim, tapered; widest amidships, narrowing to bow/stern) ------
  add(-0.6, 0.02, 0, 0.2, 0.2, 0.16, c.boatHullDark);
  add(-0.4, 0.02, 0, 0.22, 0.2, 0.22, c.boatHull);
  add(-0.18, 0.02, 0, 0.26, 0.2, 0.26, c.boatHull);
  add(0.06, 0.02, 0, 0.26, 0.2, 0.25, c.boatHull);
  add(0.3, 0.04, 0, 0.24, 0.2, 0.2, c.boatHull);
  add(0.5, 0.08, 0, 0.2, 0.2, 0.15, c.boatHullDark);
  // gunwale / deck rim plank (a touch lighter, runs along the top amidships)
  add(-0.16, 0.14, 0, 0.74, 0.05, 0.27, c.boatTrim);

  // ---- prow: steps up and forward, narrowing to a point --------------------
  add(0.62, 0.18, 0, 0.18, 0.22, 0.12, c.boatHull);
  add(0.7, 0.32, 0, 0.16, 0.2, 0.1, c.boatHull);
  add(0.76, 0.46, 0, 0.13, 0.18, 0.08, c.boatHullDark);
  add(0.8, 0.58, 0, 0.1, 0.16, 0.06, c.boatHullDark);

  // ---- stern transom + engine ---------------------------------------------
  add(-0.66, 0.14, 0, 0.12, 0.18, 0.14, c.boatHullDark);
  add(-0.8, 0.22, 0, 0.18, 0.18, 0.18, c.boatEngine);

  // ---- long propeller shaft (angled back + down) + small prop --------------
  const E = new THREE.Vector3(-0.86, 0.16, 0);
  const P = new THREE.Vector3(-1.5, -0.26, 0);
  const ang = Math.atan2(P.y - E.y, P.x - E.x);
  const len = Math.hypot(P.x - E.x, P.y - E.y);
  const shaftQ = new THREE.Quaternion().setFromAxisAngle(ZAXIS, ang);
  add((E.x + P.x) / 2, (E.y + P.y) / 2, 0, len + 0.02, 0.05, 0.05, c.boatEngine, shaftQ);
  add(P.x, P.y, 0, 0.07, 0.14, 0.04, c.boatEngine);

  // ---- tiny ribbons / flag at the prow top (authentic colour, discreet) ----
  add(0.74, 0.5, 0.02, 0.08, 0.09, 0.11, c.ribbonRed);
  add(0.77, 0.59, 0, 0.06, 0.08, 0.1, c.ribbonBlue);
  add(0.8, 0.67, 0, 0.03, 0.1, 0.07, c.ribbonPale);

  return { blocks };
}
