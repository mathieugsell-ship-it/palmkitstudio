// Deterministic procedural layout for the "high-tech blueprint" palm.
//
// buildPalm() returns three ADDRESSABLE LAYERS from one source of truth:
//   • blocks   — solid volumes (trunk / crown / fronds), world-baked transforms
//   • vertices — the glowing point field (every block corner, deduped + capped)
//   • anchors  — the 6 hotspot positions, snapped onto real vertices
//
// FUTURE BUILD-ANIM HOOK: every block carries `order` (a stable 0..1-able build
// index, bottom→top→outward). A later "construction" timeline can map a global
// progress value onto block.order / vertex order to stagger points→edges→faces
// appearing, without touching geometry. Nothing here animates yet.

import * as THREE from 'three';
import type { Vec3, AnchorKind, PalmConfig } from './config';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type BlockLayer = 'trunk' | 'crown' | 'frond';

export interface Block {
  id: string;
  layer: BlockLayer;
  order: number; // build sequence index (stable; bottom→top→outward)
  position: Vec3; // world
  quaternion: [number, number, number, number]; // world
  size: Vec3; // box dimensions [w, h, d]
  color: string;
}

export interface PalmModel {
  blocks: Block[];
  vertices: Vec3[]; // full glowing point field (hotspot vertices excluded)
  anchorsById: Record<string, Vec3>;
  height: number;
}

// ---- chunky, solid dimensions ---------------------------------------------
const TRUNK_BLOCKS = 5;
const SEG_H = 0.7;
const W_BOTTOM = 0.6; // much thicker than before (was ~0.32 dia)
const W_TOP = 0.3;
const ARC = 0.12; // only a very slight lean — stable, not falling
const TRUNK_HEIGHT = TRUNK_BLOCKS * SEG_H;

const CROWN_SIZE: Vec3 = [0.44, 0.42, 0.44];
const CROWN_CENTER_Y = TRUNK_HEIGHT + 0.16;

const LEAFLETS = 3; // fewer, bigger
const FROND_BASE_LEN = 0.6;
const FROND_TAPER = 0.8;
const FROND_THICK = 0.13; // chunky, not wispy
const FROND_W_START = 0.5;
const FROND_W_END = 0.18;
const FROND_DROOP_START = -0.16;
const FROND_DROOP_STEP = 0.36;

const VERTEX_CAP = 170;

function trunkX(t: number): number {
  return ARC * t * t;
}

// Local box corners scaled by size, then transformed by (pos, quat).
function boxCorners(size: Vec3, pos: THREE.Vector3, quat: THREE.Quaternion): Vec3[] {
  const [w, h, d] = size;
  const out: Vec3[] = [];
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        const v = new THREE.Vector3(sx * w, sy * h, sz * d).applyQuaternion(quat).add(pos);
        out.push([v.x, v.y, v.z]);
      }
  return out;
}

export function buildPalm(config: PalmConfig): PalmModel {
  const { colors, frondCount } = config;
  const blocks: Block[] = [];
  let order = 0;

  // ---- trunk (bottom → top) ------------------------------------------------
  for (let i = 0; i < TRUNK_BLOCKS; i++) {
    const tMid = (i + 0.5) / TRUNK_BLOCKS;
    const y = i * SEG_H + SEG_H / 2;
    const w = lerp(W_BOTTOM, W_TOP, tMid);
    const dxdy = (2 * ARC * tMid) / TRUNK_HEIGHT;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.atan(dxdy)));
    blocks.push({
      id: `trunk-${i}`,
      layer: 'trunk',
      order: order++,
      position: [trunkX(tMid), y, 0],
      quaternion: [quat.x, quat.y, quat.z, quat.w],
      size: [w, SEG_H + 0.02, w],
      color: tMid > 0.5 ? colors.trunkTop : colors.trunkBottom,
    });
  }

  const crownX = trunkX(1);
  const crownPos = new THREE.Vector3(crownX, CROWN_CENTER_Y, 0);
  blocks.push({
    id: 'crown',
    layer: 'crown',
    order: order++,
    position: [crownPos.x, crownPos.y, crownPos.z],
    quaternion: [0, 0, 0, 1],
    size: CROWN_SIZE,
    color: colors.trunkTop,
  });

  // ---- fronds (radial, each base → tip) -----------------------------------
  const frondOrigin = new THREE.Vector3(crownX, CROWN_CENTER_Y + 0.02, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const frondTips: Vec3[] = [];

  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    const lenScale = f % 2 === 0 ? 1 : 0.9;
    const groupQuat = new THREE.Quaternion().setFromAxisAngle(Y, angle);
    const groupMat = new THREE.Matrix4().compose(frondOrigin, groupQuat, new THREE.Vector3(1, 1, 1));

    const p = new THREE.Vector3(0, 0, 0);
    let theta = FROND_DROOP_START;
    for (let k = 0; k < LEAFLETS; k++) {
      theta += FROND_DROOP_STEP;
      const len = FROND_BASE_LEN * lenScale * Math.pow(FROND_TAPER, k);
      const dir = new THREE.Vector3(Math.cos(theta), -Math.sin(theta), 0);
      const center = p.clone().addScaledVector(dir, len / 2);
      const width = lerp(FROND_W_START, FROND_W_END, k / (LEAFLETS - 1));

      const localMat = new THREE.Matrix4().compose(
        center,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -theta)),
        new THREE.Vector3(1, 1, 1),
      );
      const worldMat = groupMat.clone().multiply(localMat);
      const wPos = new THREE.Vector3();
      const wQuat = new THREE.Quaternion();
      const wScale = new THREE.Vector3();
      worldMat.decompose(wPos, wQuat, wScale);

      blocks.push({
        id: `frond-${f}-${k}`,
        layer: 'frond',
        order: order++,
        position: [wPos.x, wPos.y, wPos.z],
        quaternion: [wQuat.x, wQuat.y, wQuat.z, wQuat.w],
        size: [len, FROND_THICK, width],
        color: colors.frond[f % 2],
      });

      p.addScaledVector(dir, len);
    }
    // World tip of this frond (for hotspot anchoring).
    const tip = p.clone().applyQuaternion(groupQuat).add(frondOrigin);
    frondTips.push([tip.x, tip.y, tip.z]);
  }

  // ---- hotspot anchors (snapped onto real vertices) -----------------------
  const crownApex: Vec3 = [crownX, CROWN_CENTER_Y + CROWN_SIZE[1] / 2, 0];
  const resolve = (a: AnchorKind): Vec3 => {
    switch (a.type) {
      case 'crown':
        return crownApex;
      case 'frondTip':
        return frondTips[a.frond % frondTips.length];
      case 'trunk': {
        const w = lerp(W_BOTTOM, W_TOP, a.t);
        return [trunkX(a.t) + w / 2, a.t * TRUNK_HEIGHT, w / 2]; // a front corner edge
      }
    }
  };
  const anchorsById: Record<string, Vec3> = {};
  for (const h of config.hotspots) anchorsById[h.id] = resolve(h.anchor);

  // ---- vertex field (all corners, deduped, hotspots removed, capped) ------
  const seen = new Set<string>();
  const key = (v: Vec3) => `${v[0].toFixed(2)},${v[1].toFixed(2)},${v[2].toFixed(2)}`;
  const anchorKeys = new Set(Object.values(anchorsById).map(key));
  const verts: Vec3[] = [];
  for (const b of blocks) {
    const pos = new THREE.Vector3(...b.position);
    const quat = new THREE.Quaternion(...b.quaternion);
    for (const c of boxCorners(b.size, pos, quat)) {
      const k = key(c);
      if (seen.has(k) || anchorKeys.has(k)) continue;
      seen.add(k);
      verts.push(c);
    }
  }
  // Cap for perf: keep an even spread by striding if we overshoot.
  let vertices = verts;
  if (verts.length > VERTEX_CAP) {
    const stride = verts.length / VERTEX_CAP;
    vertices = Array.from({ length: VERTEX_CAP }, (_, i) => verts[Math.floor(i * stride)]);
  }

  return { blocks, vertices, anchorsById, height: CROWN_CENTER_Y + 0.5 };
}
