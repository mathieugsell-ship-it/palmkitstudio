// Voxel COCONUTS nestled under the palm crown (scenery). A small cluster of
// 3–5 nuts bunched where the fronds meet the trunk top — each a main cube plus
// an occasional smaller block / pale "patch" for an irregular, rounded-ish read.
// Same voxel language as the rest (thin white settle edges + translucent faces
// are applied downstream by SceneBuild). NO glowing nodes (reserved for the
// palm). They rotate with the scene; static otherwise. Maps to E-commerce.

import * as THREE from 'three';
import type { Vec3, PalmConfig } from './config';

export interface CoconutBlock {
  id: string;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
}

export interface CoconutModel {
  blocks: CoconutBlock[];
}

const NO_ROT: [number, number, number, number] = [0, 0, 0, 1];
// Crown anchor (from layout.ts): crownX = trunkX(1) = ARC; CROWN_CENTER_Y =
// TRUNK_HEIGHT (5 * 0.7 = 3.5) + 0.16. Coconuts nestle just BELOW the crown
// centre, hugging the trunk top where the fronds spring.
const CROWN_X = 0.12;
const CROWN_Y = 3.66;

const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 47.3) * 43758.5453;
  return x - Math.floor(x);
};
function jitter(hex: string, seed: number, hA = 0.02, sA = 0.06, lA = 0.06): string {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand(seed) - 0.5) * hA, (rand(seed + 9) - 0.5) * sA, (rand(seed + 21) - 0.5) * lA);
  return `#${c.getHexString()}`;
}
const edgeOf = (hex: string, k = 0.6) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

// Cluster bunched around the trunk top (angle around the trunk, radius, height,
// base size; some get a second small block, some a pale tan patch). Grouped
// naturally — varied angles/heights, not a line.
const NUTS = [
  { a: 0.6, r: 0.19, y: 3.42, s: 0.17, two: true, tan: false },
  { a: 2.3, r: 0.21, y: 3.34, s: 0.18, two: false, tan: true },
  { a: 3.8, r: 0.18, y: 3.46, s: 0.15, two: false, tan: false },
  { a: 5.2, r: 0.2, y: 3.3, s: 0.16, two: true, tan: false },
];

export function buildCoconuts(config: PalmConfig): CoconutModel {
  const c = config.colors;
  const blocks: CoconutBlock[] = [];
  let n = 0;
  for (const nut of NUTS) {
    const x = CROWN_X + nut.r * Math.cos(nut.a);
    const z = nut.r * Math.sin(nut.a);
    const base = jitter(c.coconut, n * 7 + 3);
    // Main nut — a slightly irregular cube (rounded-ish in voxel terms).
    blocks.push({
      id: `coco-${n++}`,
      size: [nut.s, nut.s * 0.92, nut.s * 1.04],
      position: [x, nut.y, z],
      quaternion: NO_ROT,
      color: base,
      edgeColor: edgeOf(base),
    });
    if (nut.two) {
      const s2 = nut.s * 0.62;
      const col2 = jitter(c.coconutDark, n * 7 + 5);
      blocks.push({
        id: `coco-${n++}`,
        size: [s2, s2, s2],
        position: [x + (rand(n) - 0.5) * 0.1, nut.y - nut.s * 0.5, z + (rand(n + 3) - 0.5) * 0.1],
        quaternion: NO_ROT,
        color: col2,
        edgeColor: edgeOf(col2),
      });
    }
    if (nut.tan) {
      const st = nut.s * 0.42;
      const colt = jitter(c.coconutTan, n * 7 + 9, 0.02, 0.05, 0.05);
      blocks.push({
        id: `coco-${n++}`,
        size: [st, st, st],
        position: [x + nut.s * 0.4 * Math.cos(nut.a), nut.y + nut.s * 0.15, z + nut.s * 0.4 * Math.sin(nut.a)],
        quaternion: NO_ROT,
        color: colt,
        edgeColor: edgeOf(colt),
      });
    }
  }
  return { blocks };
}
