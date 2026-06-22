// Stylized voxel CRUISE SHIP / passenger ferry — SCENERY (v31). A big Andaman
// tourist liner far back on the horizon, back-left, low and just below the sun:
// a long horizontal hull with a raked bow, a dark waterline stripe, two stacked
// (stepped) deck tiers and a pair of small funnels. Clearly reads as a LARGE
// ship vs the small longtail in the foreground, but distant — so it gets a touch
// of atmospheric fade (lower face opacity, set via config.shipOpacity) while the
// thin white settle edges + dark waterline keep it legible (NOT washed out).
//
// Same voxel language as the rest (thin white edges + translucent faces applied
// downstream by SceneBuild). NO glowing vertex nodes (reserved for the palm) —
// excluded from the construction-point field in sceneBuild. Static. Sits on the
// far water with a sliver of water behind it (the horizon). Maps to GROWTH (a
// big ship bringing waves of visitors = growth), to be made clickable later.

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface ShipBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
}

export interface ShipModel {
  blocks: ShipBlock[];
}

// ---- placement (tunable) — v40 composition: moved to the SCREEN-RIGHT horizon
// (world is near the view axis; the front-right camera projects it to the right
// of the palm) to balance the pitons+sun on the left. Long axis TANGENT to the
// horizon arc so the whole hull stays on the far water (verified). CX/CZ on the
// water; YAW aligns the long axis with the horizon; WL is the shared waterline.
const CX = -1.97;
const CZ = -7.34;
const WL = -0.42; // waterline (see waterLayout)
const YAW = (15 * Math.PI) / 180; // long axis tangent to the horizon arc (at ~ang255)
// Rigid-body anchor for the very subtle idle motion (v38): the distant liner
// barely bobs (+ a tiny roll) about its centre at the waterline; SHIP_YAW gives
// the hull's longitudinal axis so the slight roll is along the hull. (Geometry
// unchanged.)
export const SHIP_PIVOT: Vec3 = [CX, WL, CZ];
export const SHIP_YAW = YAW;
// Modest distant ship, but with REAL vertical presence (v44): the old version
// read as a flat platform, so the superstructure is taller + more distinctly
// stepped and the height scale (SY) is kept high relative to length/beam (SX/SZ)
// so the stacked decks clearly read as a cruise liner. Funnel tops ~y1.1 world.
const SX = 0.66; // length
const SY = 0.74; // height (kept tall so the stacked decks + funnels read, not flat)
const SZ = 0.62; // beam

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.01, sA = 0.04, lA = 0.045): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
const edgeOf = (hex: string, k = 0.62) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

export function buildShip(config: PalmConfig): ShipModel {
  const c = config.colors;
  const blocks: ShipBlock[] = [];
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW);

  // local (x = length, y = up from waterline, z = beam) → world (yaw + translate)
  const place = (x: number, y: number, z: number): Vec3 => {
    const v = new THREE.Vector3(x * SX, y * SY, z * SZ).applyQuaternion(yaw);
    return [v.x + CX, v.y + WL, v.z + CZ];
  };

  let n = 0;
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, base: string) => {
    const col = jitter(base, n * 7 + 5);
    blocks.push({
      id: `ship-${n++}`,
      size: [sx * SX, sy * SY, sz * SZ],
      position: place(x, y, z),
      quaternion: [yaw.x, yaw.y, yaw.z, yaw.w],
      color: col,
      edgeColor: edgeOf(col),
    });
  };

  // ---- hull: long segmented body with a clearly DARK base band (waterline)
  // under a taller cream upper hull. Segments taper toward a raked bow (+x).
  const hullSegs: Array<{ x: number; len: number; beam: number }> = [
    { x: -2.0, len: 0.55, beam: 0.62 }, // stern
    { x: -1.45, len: 0.7, beam: 0.84 },
    { x: -0.75, len: 0.85, beam: 0.9 },
    { x: 0.05, len: 0.85, beam: 0.9 },
    { x: 0.85, len: 0.8, beam: 0.84 },
    { x: 1.55, len: 0.6, beam: 0.62 },
    { x: 2.1, len: 0.45, beam: 0.4 }, // bow taper
  ];
  for (const s of hullSegs) {
    add(s.x, -0.03, 0, s.len + 0.006, 0.3, s.beam + 0.006, c.shipWaterline); // dark base band (y −0.18..0.12)
    add(s.x, 0.3, 0, s.len, 0.36, s.beam, c.shipHull); // cream upper hull (y 0.12..0.48)
  }
  // Raked bow cap: lifted + forward to suggest the rising prow.
  add(2.4, 0.24, 0, 0.32, 0.52, 0.32, c.shipHull);
  // Thin dark window band capping the hull (reads as a row of portholes/deck).
  add(-0.1, 0.48, 0, 3.7, 0.07, 0.86, c.shipDeckLine);

  // ---- superstructure: THREE clearly stepped tiers, each markedly SHORTER AND
  // NARROWER going up, each tier tall enough to read — this stacked pyramid is
  // what makes it a cruise liner instead of a flat platform.
  add(-0.15, 0.7, 0, 3.2, 0.44, 0.64, c.shipHull); // tier 1 (y 0.48..0.92)
  add(-0.1, 0.92, 0, 3.26, 0.06, 0.66, c.shipDeckLine); // window band on tier 1
  add(-0.2, 1.11, 0, 2.1, 0.38, 0.48, c.shipHullHi); // tier 2 (y 0.92..1.30)
  add(-0.15, 1.28, 0, 2.16, 0.06, 0.5, c.shipDeckLine); // window band on tier 2
  add(-0.25, 1.46, 0, 1.1, 0.32, 0.36, c.shipHullHi); // tier 3 / bridge (y 1.30..1.62)

  // ---- two prominent funnels (warm coral) on the rear-centre, with dark caps --
  for (const fx of [-0.5, 0.1]) {
    add(fx, 1.86, 0, 0.34, 0.48, 0.32, c.shipFunnel); // tall funnel body (y 1.62..2.10)
    add(fx, 2.12, 0, 0.38, 0.08, 0.36, c.shipFunnelDark); // dark cap rim
  }

  return { blocks };
}
