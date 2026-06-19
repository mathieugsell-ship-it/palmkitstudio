// Unified build model for the WHOLE scene (STEP 6). Combines the palm, island
// and water block sets into one flat list, each block + construction-point
// tagged with the scalars the single build timeline needs:
//   • group        — island / palm / water (cascade order)
//   • o            — construction-order position on the 0→1 timeline
//                    (groupBase + groupSpan · staggerT)
//   • staggerT     — along the group's build axis: y (bottom-to-top) for
//                    island & palm; radial distance for water (washes outward)
//   • hGlobal      — global normalized height (for the top→bottom settle sweep)
//   • finalOpacity — the validated resting translucency for that block
//   • ripple       — water (non-fringe) blocks bob; ripplePhase precomputed
// Construction points = palm vertex field (kept at rest) + island/water block
// corners (deduped, faded out at rest).
import * as THREE from 'three';
import { buildPalm } from './layout';
import { buildIsland } from './islandLayout';
import { buildWater } from './waterLayout';
import { buildBoat } from './boatLayout';
import { buildPitons } from './pitonLayout';
import type { PalmConfig, Vec3 } from './config';

export type SceneGroup = 'island' | 'palm' | 'water' | 'boat' | 'piton';

export interface SceneBlock {
  id: string;
  group: SceneGroup;
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  finalOpacity: number;
  o: number;
  hGlobal: number;
  ripple: boolean;
  ripplePhase: number;
  baseY: number;
}

export interface ScenePoint {
  position: Vec3;
  group: SceneGroup;
  keepAtRest: boolean;
  o: number;
  hGlobal: number;
}

export interface SceneModel {
  blocks: SceneBlock[];
  points: ScenePoint[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function cornersOf(size: Vec3, pos: Vec3, quat: [number, number, number, number]): Vec3[] {
  const q = new THREE.Quaternion(quat[0], quat[1], quat[2], quat[3]);
  const base = new THREE.Vector3(pos[0], pos[1], pos[2]);
  const out: Vec3[] = [];
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        const v = new THREE.Vector3(sx * size[0], sy * size[1], sz * size[2]).applyQuaternion(q).add(base);
        out.push([v.x, v.y, v.z]);
      }
  return out;
}

function dedupe(corners: Vec3[], tol: number, cap: number): Vec3[] {
  const out: Vec3[] = [];
  const t2 = tol * tol;
  for (const c of corners) {
    let dup = false;
    for (const m of out) {
      const dx = c[0] - m[0];
      const dy = c[1] - m[1];
      const dz = c[2] - m[2];
      if (dx * dx + dy * dy + dz * dz < t2) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(c);
  }
  if (out.length > cap) {
    const stride = out.length / cap;
    return Array.from({ length: cap }, (_, i) => out[Math.floor(i * stride)]);
  }
  return out;
}

export function buildScene(config: PalmConfig): SceneModel {
  const B = config.build;
  const palm = buildPalm(config);
  const island = buildIsland(config);
  const water = buildWater(config);
  const boat = buildBoat(config);
  const pitons = buildPitons(config);

  const yRange = (ys: number[]) => {
    let a = Infinity;
    let b = -Infinity;
    for (const y of ys) {
      if (y < a) a = y;
      if (y > b) b = y;
    }
    return [a, b] as const;
  };
  const palmY = yRange(palm.blocks.map((b) => b.position[1]));
  const islY = yRange(island.blocks.map((b) => b.position[1]));
  let waterMaxR = 0.001;
  for (const b of water.blocks) waterMaxR = Math.max(waterMaxR, Math.hypot(b.position[0], b.position[2]));

  // Global y extents (block tops/bottoms) for the settle sweep.
  let gMin = Infinity;
  let gMax = -Infinity;
  const acc = (y: number) => {
    if (y < gMin) gMin = y;
    if (y > gMax) gMax = y;
  };
  for (const set of [palm.blocks, island.blocks, water.blocks, boat.blocks, pitons.blocks])
    for (const b of set) {
      acc(b.position[1] - b.size[1] / 2);
      acc(b.position[1] + b.size[1] / 2);
    }
  const hG = (y: number) => clamp01((y - gMin) / Math.max(gMax - gMin, 1e-3));

  const boatY = yRange(boat.blocks.map((b) => b.position[1]));
  const pitY = yRange(pitons.blocks.map((b) => b.position[1]));
  const stPit = (y: number) => clamp01((y - pitY[0]) / Math.max(pitY[1] - pitY[0], 1e-3));
  const stPalm = (y: number) => clamp01((y - palmY[0]) / Math.max(palmY[1] - palmY[0], 1e-3));
  const stIsl = (y: number) => clamp01((y - islY[0]) / Math.max(islY[1] - islY[0], 1e-3));
  const stWat = (x: number, z: number) => clamp01(Math.hypot(x, z) / waterMaxR);
  const stBoat = (y: number) => clamp01((y - boatY[0]) / Math.max(boatY[1] - boatY[0], 1e-3));

  const oOf = (group: SceneGroup, st: number) => {
    const base =
      group === 'island' ? B.islandBase
      : group === 'palm' ? B.palmBase
      : group === 'water' ? B.waterBase
      : group === 'piton' ? B.pitonBase
      : B.boatBase;
    const span =
      group === 'island' ? B.islandSpan
      : group === 'palm' ? B.palmSpan
      : group === 'water' ? B.waterSpan
      : group === 'piton' ? B.pitonSpan
      : B.boatSpan;
    return clamp01(base + span * st);
  };

  const blocks: SceneBlock[] = [];
  for (const b of palm.blocks)
    blocks.push({
      id: `p-${b.id}`,
      group: 'palm',
      size: b.size,
      position: b.position,
      quaternion: b.quaternion,
      color: b.color,
      finalOpacity: config.faceOpacity,
      o: oOf('palm', stPalm(b.position[1])),
      hGlobal: hG(b.position[1]),
      ripple: false,
      ripplePhase: 0,
      baseY: b.position[1],
    });
  for (const b of island.blocks)
    blocks.push({
      id: `i-${b.id}`,
      group: 'island',
      size: b.size,
      position: b.position,
      quaternion: b.quaternion,
      color: b.color,
      finalOpacity: config.baseOpacity,
      o: oOf('island', stIsl(b.position[1])),
      hGlobal: hG(b.position[1]),
      ripple: false,
      ripplePhase: 0,
      baseY: b.position[1],
    });
  for (const b of water.blocks)
    blocks.push({
      id: `w-${b.id}`,
      group: 'water',
      size: b.size,
      position: b.position,
      quaternion: b.quaternion,
      color: b.color,
      finalOpacity: b.fringe ? config.baseOpacity : config.waterOpacity,
      o: oOf('water', stWat(b.position[0], b.position[2])),
      hGlobal: hG(b.position[1]),
      ripple: !b.fringe,
      ripplePhase: (b.position[0] + b.position[2]) * config.rippleK,
      baseY: b.position[1],
    });
  // Longtail boat — solid wood, same voxel treatment; NO construction points
  // (the glowing field is reserved for the palm). Static for now (ripple:false);
  // baseY is kept so it can bob with the water later.
  for (const b of boat.blocks)
    blocks.push({
      id: `b-${b.id}`,
      group: 'boat',
      size: b.size,
      position: b.position,
      quaternion: b.quaternion,
      color: b.color,
      finalOpacity: config.faceOpacity,
      o: oOf('boat', stBoat(b.position[1])),
      hGlobal: hG(b.position[1]),
      ripple: false,
      ripplePhase: 0,
      baseY: b.position[1],
    });
  // Karst pitons — solid rock, same voxel treatment; NO construction points
  // (the glowing field is reserved for the palm). Static; build bottom-to-top.
  for (const b of pitons.blocks)
    blocks.push({
      id: `k-${b.id}`,
      group: 'piton',
      size: b.size,
      position: b.position,
      quaternion: b.quaternion,
      color: b.color,
      finalOpacity: config.baseOpacity,
      o: oOf('piton', stPit(b.position[1])),
      hGlobal: hG(b.position[1]),
      ripple: false,
      ripplePhase: 0,
      baseY: b.position[1],
    });

  const points: ScenePoint[] = [];
  for (const v of palm.vertices)
    points.push({ position: v, group: 'palm', keepAtRest: true, o: oOf('palm', stPalm(v[1])), hGlobal: hG(v[1]) });
  if (B.constructionPointsAll) {
    const islPts = dedupe(island.blocks.flatMap((b) => cornersOf(b.size, b.position, b.quaternion)), 0.07, 170);
    for (const v of islPts)
      points.push({ position: v, group: 'island', keepAtRest: false, o: oOf('island', stIsl(v[1])), hGlobal: hG(v[1]) });
    const watPts = dedupe(water.blocks.flatMap((b) => cornersOf(b.size, b.position, b.quaternion)), 0.07, 150);
    for (const v of watPts)
      points.push({ position: v, group: 'water', keepAtRest: false, o: oOf('water', stWat(v[0], v[2])), hGlobal: hG(v[1]) });
  }

  return { blocks, points };
}
