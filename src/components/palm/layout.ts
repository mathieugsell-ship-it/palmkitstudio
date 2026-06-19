// Deterministic procedural layout for the "high-tech blueprint" voxel palm.
//
// buildPalm() returns three ADDRESSABLE LAYERS from one source of truth:
//   • blocks   — solid volumes (trunk segments + bark rings, crown cluster,
//                fronds, coconuts), world-baked transforms, per-block colors
//   • vertices — the glowing point field (block corners, deduped + capped)
//   • anchors  — the 6 hotspot positions, snapped onto real vertices
//
// Variety is deterministic (seeded) so the still render reads "crafted, not
// generic": per-block HSL jitter + slight size/length/angle irregularity.
//
// FUTURE BUILD-ANIM HOOK: every block carries `order` (bottom→top→outward); a
// later timeline can stagger points→edges→faces / block-by-block assembly off
// that index with no rewrite. Nothing animates yet.

import * as THREE from 'three';
import type { Vec3, AnchorKind, PalmConfig } from './config';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Stable pseudo-random in [0,1) from an integer seed (no global state).
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// Tasteful per-block color vibration around a base hex.
function jitter(hex: string, seed: number, hA = 0.03, sA = 0.1, lA = 0.12): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 13) - 0.5) * sA, (rand(seed + 27) - 0.5) * lA);
  return `#${c.getHexString()}`;
}

export type BlockLayer = 'trunk' | 'crown' | 'frond' | 'coconut';

export interface Block {
  id: string;
  layer: BlockLayer;
  order: number;
  position: Vec3;
  quaternion: [number, number, number, number];
  size: Vec3;
  color: string;
}

export interface PalmModel {
  blocks: Block[];
  vertices: Vec3[];
  anchorsById: Record<string, Vec3>;
  height: number;
}

// ---- trunk: tall segments + thin wider bark rings -------------------------
const TRUNK_SEGMENTS = 6;
const SEG_H = 0.34;
const RING_H = 0.05;
const W_BOTTOM = 0.6;
const W_TOP = 0.34;
const trunkX = (y: number) => 0.02 * y * y; // gentle, stable arc

const VERTEX_CAP = 220;

const noRot: [number, number, number, number] = [0, 0, 0, 1];

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

  // ---- trunk ---------------------------------------------------------------
  let y = 0;
  let seed = 1;
  for (let s = 0; s < TRUNK_SEGMENTS; s++) {
    const tt = s / (TRUNK_SEGMENTS - 1);
    const wBase = lerp(W_BOTTOM, W_TOP, s / TRUNK_SEGMENTS);
    const brown = jitter(lerp(0, 1, tt) > 0.5 ? colors.trunkTop : colors.trunkBottom, seed, 0.02, 0.12, 0.12);

    // tall segment (slight width + lateral irregularity)
    const w = wBase * (1 + (rand(seed) - 0.5) * 0.1);
    const cy = y + SEG_H / 2;
    const dx = (rand(seed + 5) - 0.5) * 0.03;
    blocks.push({ id: `trunk-${s}`, layer: 'trunk', order: order++, position: [trunkX(cy) + dx, cy, 0], quaternion: noRot, size: [w, SEG_H + 0.01, w], color: brown });
    y += SEG_H;
    seed += 1;

    // bark ring between segments — thin, subtle banding (built/textured read)
    if (s < TRUNK_SEGMENTS - 1) {
      const wr = wBase * 1.05;
      const ry = y + RING_H / 2;
      blocks.push({ id: `ring-${s}`, layer: 'trunk', order: order++, position: [trunkX(ry), ry, 0], quaternion: noRot, size: [wr, RING_H, wr], color: jitter(colors.trunkBottom, seed + 40, 0.02, 0.1, 0.1) });
      y += RING_H;
      seed += 1;
    }
  }
  const topY = y;
  const crownX = trunkX(topY);

  // ---- crown bud cluster (fuller, irregular) ------------------------------
  const crownCenter: Vec3 = [crownX, topY + 0.2, 0];
  const crownGreen = colors.frondGreens[2];
  blocks.push({ id: 'crown-0', layer: 'crown', order: order++, position: crownCenter, quaternion: noRot, size: [0.42, 0.4, 0.42], color: jitter(crownGreen, 200) });
  blocks.push({ id: 'crown-1', layer: 'crown', order: order++, position: [crownX - 0.14, topY + 0.34, 0.1], quaternion: noRot, size: [0.24, 0.24, 0.24], color: jitter(crownGreen, 201) });
  blocks.push({ id: 'crown-2', layer: 'crown', order: order++, position: [crownX + 0.12, topY + 0.3, -0.12], quaternion: noRot, size: [0.22, 0.22, 0.22], color: jitter(crownGreen, 202) });

  // ---- coconuts (subtle character) ----------------------------------------
  const nutY = topY + 0.02;
  for (let n = 0; n < 2; n++) {
    const a = n === 0 ? 0.7 : -1.9;
    const r = 0.26;
    blocks.push({ id: `coconut-${n}`, layer: 'coconut', order: order++, position: [crownX + Math.cos(a) * r, nutY, Math.sin(a) * r], quaternion: noRot, size: [0.16, 0.15, 0.16], color: jitter(colors.coconut, 300 + n, 0.02, 0.1, 0.08) });
  }

  // ---- fronds (10), each 4 smaller stepped leaflets, irregular ------------
  const frondOrigin = new THREE.Vector3(crownX, topY + 0.06, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const LEAFLETS = 4;
  const frondTips: Vec3[] = [];

  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2 + (rand(f + 70) - 0.5) * 0.12; // angular jitter
    const lenScale = 1 + (rand(f + 80) - 0.5) * 0.22; // length irregularity
    const droopStep = 0.22 + (rand(f + 90) - 0.5) * 0.08;
    const baseGreen = colors.frondGreens[f % colors.frondGreens.length];
    const groupQuat = new THREE.Quaternion().setFromAxisAngle(Y, angle);
    const groupMat = new THREE.Matrix4().compose(frondOrigin, groupQuat, new THREE.Vector3(1, 1, 1));

    const p = new THREE.Vector3(0, 0, 0);
    let theta = -0.2;
    for (let k = 0; k < LEAFLETS; k++) {
      theta += droopStep;
      const len = 0.46 * lenScale * Math.pow(0.85, k);
      const dir = new THREE.Vector3(Math.cos(theta), -Math.sin(theta), 0);
      const center = p.clone().addScaledVector(dir, len / 2);
      const width = lerp(0.36, 0.07, k / (LEAFLETS - 1));

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
        size: [len, 0.095, width],
        color: jitter(baseGreen, f * 11 + k * 3),
      });
      p.addScaledVector(dir, len);
    }
    const tip = p.clone().applyQuaternion(groupQuat).add(frondOrigin);
    frondTips.push([tip.x, tip.y, tip.z]);
  }

  // ---- hotspot anchors (snapped onto real vertices) -----------------------
  const crownApex: Vec3 = [crownX, crownCenter[1] + 0.2, 0];
  const resolve = (a: AnchorKind): Vec3 => {
    switch (a.type) {
      case 'crown':
        return crownApex;
      case 'frondTip':
        return frondTips[a.frond % frondTips.length];
      case 'trunk': {
        const w = lerp(W_BOTTOM, W_TOP, a.t);
        const ty = a.t * topY;
        return [trunkX(ty) + w / 2, ty, w / 2];
      }
    }
  };
  const anchorsById: Record<string, Vec3> = {};
  for (const h of config.hotspots) anchorsById[h.id] = resolve(h.anchor);

  // ---- vertex field (corners, deduped, hotspots removed, capped) ----------
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
  let vertices = verts;
  if (verts.length > VERTEX_CAP) {
    const stride = verts.length / VERTEX_CAP;
    vertices = Array.from({ length: VERTEX_CAP }, (_, i) => verts[Math.floor(i * stride)]);
  }

  return { blocks, vertices, anchorsById, height: crownCenter[1] + 0.6 };
}
