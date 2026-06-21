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

// ---- placement (tunable) — back-left on the far water, long axis TANGENT to the
// horizon arc so the whole hull stays on the water (verified numerically), low
// and just below the sun. CX/CZ on the water; YAW aligns the long axis with the
// horizon; WL is the shared waterline.
const CX = -5.03;
const CZ = -6.22;
const WL = -0.42; // waterline (see waterLayout)
const YAW = (39 * Math.PI) / 180; // long axis tangent to the horizon arc
const SCALE = 1.0; // world units used directly below

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
    const v = new THREE.Vector3(x * SCALE, y * SCALE, z * SCALE).applyQuaternion(yaw);
    return [v.x + CX, v.y + WL, v.z + CZ];
  };

  let n = 0;
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, base: string) => {
    const col = jitter(base, n * 7 + 5);
    blocks.push({
      id: `ship-${n++}`,
      size: [sx * SCALE, sy * SCALE, sz * SCALE],
      position: place(x, y, z),
      quaternion: [yaw.x, yaw.y, yaw.z, yaw.w],
      color: col,
      edgeColor: edgeOf(col),
    });
  };

  // ---- hull: segmented long body, beam 0.9, top deck at y≈0.34 ---------------
  // Segments along the length; the bow (+x) tapers narrower and the stern (-x)
  // is squared off. A darker waterline stripe runs along the bottom.
  const hullSegs: Array<{ x: number; len: number; beam: number }> = [
    { x: -2.15, len: 0.5, beam: 0.78 }, // stern
    { x: -1.6, len: 0.7, beam: 0.9 },
    { x: -0.85, len: 0.8, beam: 0.92 },
    { x: -0.0, len: 0.8, beam: 0.92 },
    { x: 0.8, len: 0.8, beam: 0.88 },
    { x: 1.55, len: 0.6, beam: 0.74 },
    { x: 2.15, len: 0.5, beam: 0.5 }, // bow taper
  ];
  for (const s of hullSegs) {
    add(s.x, 0.1, 0, s.len, 0.5, s.beam, c.shipHull); // hull body (white)
    add(s.x, -0.12, 0, s.len + 0.005, 0.2, s.beam + 0.006, c.shipWaterline); // dark waterline stripe
  }
  // Raked bow cap: a small block lifted + forward to suggest the rising prow.
  add(2.5, 0.18, 0, 0.34, 0.42, 0.34, c.shipHull);

  // ---- superstructure: two stepped deck tiers, each shorter + a touch lighter
  // Deck 1 (long, widest), with a thin window/detail band.
  add(-0.1, 0.49, 0, 3.4, 0.3, 0.78, c.shipHull);
  add(-0.1, 0.45, 0, 3.46, 0.08, 0.8, c.shipDeckLine); // window band under deck 1
  // Deck 2 (shorter, lighter), with a small forward bridge.
  add(-0.2, 0.77, 0, 2.2, 0.26, 0.64, c.shipHullHi);
  add(0.85, 0.74, 0, 0.5, 0.2, 0.5, c.shipHullHi); // bridge, toward the bow

  // ---- two small funnels (warm coral accent) on the rear-centre of deck 2 ----
  for (const fx of [-0.65, -0.05]) {
    add(fx, 1.04, 0, 0.34, 0.3, 0.34, c.shipFunnel); // funnel body
    add(fx, 1.21, 0, 0.36, 0.06, 0.36, c.shipFunnelDark); // dark cap rim
  }

  return { blocks };
}
