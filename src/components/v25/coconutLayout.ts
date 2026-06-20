// Voxel COCONUTS nestled under the palm crown (scenery). A small bunch of nuts
// hanging JUST BELOW the crown on the camera-facing front, clearly OUT from the
// trunk (not buried in the trunk/foliage) so they read as a little cluster of
// coconuts. Each is a main cube + an occasional small second block / pale tan
// patch (irregular, rounded-ish). Same voxel language as the rest (thin white
// settle edges + translucent faces applied downstream by SceneBuild). NO glowing
// nodes (reserved for the palm). They rotate with the scene. Maps to E-commerce.

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

// Explicit world positions (the crown centre is ~(0.12, 3.66, 0); the trunk top
// block spans x[-0.07,0.26] z[±0.16] up to y 3.51). These hang just below the
// crown (y 3.1–3.3) on the +x/+z front (toward the camera), clearly outside the
// trunk so they're visible as a bunch.
const NUTS = [
  { x: 0.42, y: 3.3, z: 0.18, s: 0.24, two: true, tan: false },
  { x: 0.3, y: 3.22, z: 0.36, s: 0.27, two: false, tan: true },
  { x: 0.15, y: 3.16, z: 0.41, s: 0.23, two: false, tan: false },
  { x: 0.45, y: 3.16, z: 0.05, s: 0.24, two: true, tan: false },
  { x: 0.24, y: 3.08, z: 0.27, s: 0.21, two: false, tan: true },
];

export function buildCoconuts(config: PalmConfig): CoconutModel {
  const c = config.colors;
  const blocks: CoconutBlock[] = [];
  let n = 0;
  for (const nut of NUTS) {
    const base = jitter(c.coconut, n * 7 + 3);
    // Main nut — a slightly irregular cube (rounded-ish in voxel terms).
    blocks.push({
      id: `coco-${n++}`,
      size: [nut.s, nut.s * 0.92, nut.s * 1.05],
      position: [nut.x, nut.y, nut.z],
      quaternion: NO_ROT,
      color: base,
      edgeColor: edgeOf(base),
    });
    if (nut.two) {
      const s2 = nut.s * 0.6;
      const col2 = jitter(c.coconutDark, n * 7 + 5);
      blocks.push({
        id: `coco-${n++}`,
        size: [s2, s2, s2],
        position: [nut.x - 0.06 + (rand(n) - 0.5) * 0.06, nut.y - nut.s * 0.5, nut.z - 0.04 + (rand(n + 3) - 0.5) * 0.06],
        quaternion: NO_ROT,
        color: col2,
        edgeColor: edgeOf(col2),
      });
    }
    if (nut.tan) {
      const st = nut.s * 0.4;
      const colt = jitter(c.coconutTan, n * 7 + 9, 0.02, 0.05, 0.05);
      // Pale patch on the camera-facing (+x/+z) face of the nut.
      blocks.push({
        id: `coco-${n++}`,
        size: [st, st, st],
        position: [nut.x + nut.s * 0.42, nut.y + nut.s * 0.12, nut.z + nut.s * 0.42],
        quaternion: NO_ROT,
        color: colt,
        edgeColor: edgeOf(colt),
      });
    }
  }
  return { blocks };
}
