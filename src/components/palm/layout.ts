// Deterministic procedural layout for the voxel palm.
// Both PalmTree (rendering) and Hotspots (anchor positions) consume this single
// source of truth, so the glowing dots sit exactly on the geometry.

import * as THREE from 'three';
import type { Vec3, AnchorKind } from './config';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Trunk -----------------------------------------------------------------
// Slim and tall with only a subtle arc — svelte and premium, not a stiff pole
// and not a banana (per direction).
export const TRUNK_SEGMENTS = 7;
const SEG_H = 0.52;
const R_BOTTOM = 0.16;
const R_TOP = 0.072;
const ARC = 0.42; // total horizontal lean accumulated over the full height
export const TRUNK_HEIGHT = TRUNK_SEGMENTS * SEG_H;

/** Centerline x at a normalized height t (0 base .. 1 top). Gentle quadratic arc. */
export function trunkX(t: number): number {
  return ARC * t * t;
}

/** Point on the trunk centerline at normalized height t. */
export function trunkPoint(t: number): Vec3 {
  return [trunkX(t), t * TRUNK_HEIGHT, 0];
}

export interface TrunkSegment {
  position: Vec3;
  rotationZ: number;
  radiusBottom: number;
  radiusTop: number;
  height: number;
}

export function buildTrunk(): TrunkSegment[] {
  const segs: TrunkSegment[] = [];
  for (let i = 0; i < TRUNK_SEGMENTS; i++) {
    const tMid = (i + 0.5) / TRUNK_SEGMENTS;
    const y = i * SEG_H + SEG_H / 2;
    // tangent of x(t) wrt world-y for a subtle lean of each block along the arc.
    const dxdt = 2 * ARC * tMid;
    const dxdy = dxdt / TRUNK_HEIGHT;
    segs.push({
      position: [trunkX(tMid), y, 0],
      rotationZ: -Math.atan(dxdy),
      radiusBottom: lerp(R_BOTTOM, R_TOP, i / TRUNK_SEGMENTS),
      radiusTop: lerp(R_BOTTOM, R_TOP, (i + 1) / TRUNK_SEGMENTS),
      height: SEG_H + 0.012, // tiny overlap so segments read as one trunk
    });
  }
  return segs;
}

// Crown sits at the very top of the trunk arc.
export const CROWN: Vec3 = trunkPoint(1);
// Apex dot floats just above the crown nut.
export const CROWN_APEX: Vec3 = [CROWN[0], CROWN[1] + 0.22, CROWN[2]];
// Fronds spring from just below the apex.
const FROND_ORIGIN: Vec3 = [CROWN[0], CROWN[1] + 0.06, CROWN[2]];

// ---- Fronds ----------------------------------------------------------------
const LEAFLETS = 6;
const BASE_LEN = 0.44;
const TAPER = 0.85;
const DROOP_START = -0.24; // start angle slightly upward (negative = up)
const DROOP_STEP = 0.2; // each leaflet bends progressively downward

export interface Leaflet {
  position: Vec3; // local to the frond group
  rotationZ: number;
  size: Vec3; // box args [length, thickness, width]
}

export interface Frond {
  index: number;
  angle: number; // Y rotation of the whole frond group
  tier: number; // 0|1 color tier
  leaflets: Leaflet[];
  tipLocal: Vec3; // tip in frond-local space
}

/** Build one frond in local space (extends along +X, droops in -Y). */
function buildFrond(index: number, count: number): Frond {
  const angle = (index / count) * Math.PI * 2;
  // Subtle deterministic variation so fronds don't look stamped.
  const lenScale = index % 2 === 0 ? 1.0 : 0.92;
  const droopBias = index % 2 === 0 ? 0 : 0.03;

  const leaflets: Leaflet[] = [];
  const p = new THREE.Vector3(0, 0, 0);
  let theta = DROOP_START;
  for (let k = 0; k < LEAFLETS; k++) {
    theta += DROOP_STEP + droopBias;
    const len = BASE_LEN * lenScale * Math.pow(TAPER, k);
    const dir = new THREE.Vector3(Math.cos(theta), -Math.sin(theta), 0);
    const center = p.clone().addScaledVector(dir, len / 2);
    const width = lerp(0.24, 0.045, k / (LEAFLETS - 1));
    leaflets.push({
      position: [center.x, center.y, center.z],
      rotationZ: -theta,
      size: [len, 0.055, width],
    });
    p.addScaledVector(dir, len);
  }
  return {
    index,
    angle,
    tier: index % 2,
    leaflets,
    tipLocal: [p.x, p.y, p.z],
  };
}

export function buildFronds(count: number): Frond[] {
  return Array.from({ length: count }, (_, i) => buildFrond(i, count));
}

export const FROND_GROUP_POSITION: Vec3 = FROND_ORIGIN;

/** World-space tip of a given frond (used for hotspot anchors). */
export function frondTipWorld(frond: Frond): Vec3 {
  const v = new THREE.Vector3(...frond.tipLocal);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), frond.angle);
  v.add(new THREE.Vector3(...FROND_ORIGIN));
  return [v.x, v.y, v.z];
}

/** Resolve any hotspot anchor descriptor to a world position. */
export function resolveAnchor(anchor: AnchorKind, fronds: Frond[]): Vec3 {
  switch (anchor.type) {
    case 'crown':
      return CROWN_APEX;
    case 'trunk': {
      // Sit the dot proud on the FRONT surface of the trunk, not on the
      // centerline (where it would be buried inside the cylinder).
      const p = trunkPoint(anchor.t);
      const radius = lerp(R_BOTTOM, R_TOP, anchor.t);
      return [p[0], p[1], p[2] + radius + 0.03];
    }
    case 'frondTip':
      return frondTipWorld(fronds[anchor.frond % fronds.length]);
  }
}
