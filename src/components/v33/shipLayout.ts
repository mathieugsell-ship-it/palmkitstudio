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

// ---- placement (tunable) — clearly back-LEFT on the far water, under the sun,
// long axis TANGENT to the horizon arc so the whole (now smaller) hull stays on
// the water (verified numerically); its back/left end sits ~under the sun and it
// extends rightward. Modest size via per-axis scales. CX/CZ on the water; YAW
// aligns the long axis with the horizon; WL is the shared waterline.
const CX = -5.63;
const CZ = -5.25;
const WL = -0.42; // waterline (see waterLayout)
const YAW = (47 * Math.PI) / 180; // long axis tangent to the horizon arc (at ~ang223)
// Modest distant ship, but with REAL vertical presence: shrink length + beam
// (SX/SZ) more than height (SY) so the stacked superstructure reads as a cruise
// liner, not a flat platform. Tuned so the funnel tops sit ~y0.94 (just below the
// sun at y1.0) and the hull drafts ~0.12 below the waterline.
const SX = 0.7; // length
const SY = 0.8; // height (tall enough that the stacked decks + funnels read)
const SZ = 0.66; // beam

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

  // ---- hull: long segmented body with a DARK base band (waterline) under a
  // cream upper hull. Segments taper toward a raked bow (+x); stern (-x) squared.
  const hullSegs: Array<{ x: number; len: number; beam: number }> = [
    { x: -2.0, len: 0.55, beam: 0.66 }, // stern
    { x: -1.45, len: 0.7, beam: 0.86 },
    { x: -0.75, len: 0.85, beam: 0.9 },
    { x: 0.05, len: 0.85, beam: 0.9 },
    { x: 0.85, len: 0.8, beam: 0.84 },
    { x: 1.55, len: 0.6, beam: 0.62 },
    { x: 2.1, len: 0.45, beam: 0.38 }, // bow taper
  ];
  for (const s of hullSegs) {
    add(s.x, -0.025, 0, s.len + 0.006, 0.25, s.beam + 0.006, c.shipWaterline); // dark base band (y −0.15..0.10)
    add(s.x, 0.25, 0, s.len, 0.3, s.beam, c.shipHull); // cream upper hull (y 0.10..0.40)
  }
  // Raked bow cap: lifted + forward to suggest the rising prow.
  add(2.4, 0.18, 0, 0.32, 0.46, 0.3, c.shipHull);
  // Thin dark window band capping the hull (reads as a row of portholes/deck).
  add(-0.1, 0.4, 0, 3.7, 0.07, 0.84, c.shipDeckLine);

  // ---- superstructure: THREE clearly stepped tiers, each markedly shorter AND
  // narrower going up — this stacked pyramid is what reads as a cruise liner.
  add(-0.15, 0.57, 0, 3.4, 0.34, 0.70, c.shipHull); // tier 1 (y 0.40..0.74)
  add(-0.1, 0.74, 0, 3.46, 0.06, 0.72, c.shipDeckLine); // window band on tier 1
  add(-0.2, 0.89, 0, 2.3, 0.30, 0.54, c.shipHullHi); // tier 2 (y 0.74..1.04)
  add(-0.25, 1.17, 0, 1.2, 0.26, 0.40, c.shipHullHi); // tier 3 / bridge (y 1.04..1.30)

  // ---- two prominent funnels (warm coral) on the rear-centre, with dark caps --
  for (const fx of [-0.55, 0.05]) {
    add(fx, 1.46, 0, 0.32, 0.34, 0.3, c.shipFunnel); // funnel body (y 1.30..1.63)
    add(fx, 1.66, 0, 0.36, 0.08, 0.34, c.shipFunnelDark); // dark cap rim
  }

  return { blocks };
}
