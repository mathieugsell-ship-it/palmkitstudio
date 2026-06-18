// Variant B — DENSE, VOLUMETRIC low-poly triangulated palm.
//
// A full, figurative palm wrapped in a fine triangle mesh: a stout triangulated
// trunk, a faceted crown bud, and broad VOLUMETRIC frond tubes (diamond
// cross-section swept along a drooping centerline, capped both ends) layered in
// two tiers to form a substantial crown. Returns addressable parts + deduped
// world-space vertices (nodes). Faces are filled translucently by <Wireframe>.

import * as THREE from 'three';

export type Vec3 = [number, number, number];

export interface MeshPart {
  id: string;
  geometry: THREE.BufferGeometry;
  position: Vec3;
  quaternion: [number, number, number, number];
  fill: string;
  stroke: string;
}

export interface MeshPalm {
  parts: MeshPart[];
  nodes: Vec3[];
  height: number;
}

export interface MeshColors {
  trunkFill: string;
  trunkStroke: string;
  crownFill: string;
  frondFills: string[]; // varied greens across frond layers
  frondStroke: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- trunk: stout, tapered, well-triangulated -----------------------------
const TRUNK_H = 2.2;
const TRUNK_BEND = 0.22;
const R_BOTTOM = 0.34;
const R_TOP = 0.17;

function buildTrunkGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(R_TOP, R_BOTTOM, TRUNK_H, 8, 7, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + TRUNK_H / 2) / TRUNK_H;
    pos.setX(i, pos.getX(i) + TRUNK_BEND * t * t);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const CROWN_POS: Vec3 = [TRUNK_BEND, TRUNK_H, 0];

// ---- frond: a broad, flat, VOLUMETRIC leaf (lens section, capped) ---------
const FROND_STATIONS = 6;
const FROND_W = 0.5; // half-width at base (broad, leaf-like)
const FROND_T = 0.05; // half-thickness (flat but with real volume)

interface FrondSpec {
  len: number;
  droop: number;
  rise: number; // arches up near the base before drooping (palm frond curve)
}

function buildFrondGeometry({ len, droop, rise }: FrondSpec): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];

  // Ring vertices: 4 per station (up, right, down, left). Broad most of the
  // length, tapering to a tip; arches up then sags down.
  for (let i = 0; i < FROND_STATIONS; i++) {
    const u = i / (FROND_STATIONS - 1);
    const cx = u * len;
    const cy = rise * u - droop * u * u; // up near base, droop toward tip
    const w = lerp(FROND_W, 0.04, u * u); // stays broad, tapers near the tip
    const t = lerp(FROND_T, 0.015, u);
    verts.push(cx, cy + t, 0); // up
    verts.push(cx, cy, w); // right
    verts.push(cx, cy - t, 0); // down
    verts.push(cx, cy, -w); // left
  }
  const baseCenter = FROND_STATIONS * 4;
  verts.push(0, 0, 0);
  const tip = baseCenter + 1;
  verts.push(len * 1.03, rise * 1.03 - droop * 1.06, 0); // pointed tip

  const ring = (r: number, k: number) => r * 4 + (k % 4);

  // Base cap.
  for (let k = 0; k < 4; k++) idx.push(baseCenter, ring(0, k + 1), ring(0, k));
  // Body quads → triangles.
  for (let r = 0; r < FROND_STATIONS - 1; r++) {
    for (let k = 0; k < 4; k++) {
      const a = ring(r, k);
      const b = ring(r, k + 1);
      const c = ring(r + 1, k + 1);
      const d = ring(r + 1, k);
      idx.push(a, b, d, b, c, d);
    }
  }
  // Tip cap.
  const last = FROND_STATIONS - 1;
  for (let k = 0; k < 4; k++) idx.push(ring(last, k), ring(last, k + 1), tip);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildCrownGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.3, 1);
}

function collectNodes(
  geo: THREE.BufferGeometry,
  pos: Vec3,
  quat: THREE.Quaternion,
  seen: Set<string>,
  out: Vec3[],
) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const offset = new THREE.Vector3(...pos);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyQuaternion(quat).add(offset);
    const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([v.x, v.y, v.z]);
  }
}

export function buildMeshPalm(frondCount: number, colors: MeshColors): MeshPalm {
  const parts: MeshPart[] = [];
  const nodes: Vec3[] = [];
  const seen = new Set<string>();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const noRot: [number, number, number, number] = [0, 0, 0, 1];

  const trunkGeo = buildTrunkGeometry();
  const trunkPos: Vec3 = [0, TRUNK_H / 2, 0];
  parts.push({ id: 'trunk', geometry: trunkGeo, position: trunkPos, quaternion: noRot, fill: colors.trunkFill, stroke: colors.trunkStroke });
  collectNodes(trunkGeo, trunkPos, new THREE.Quaternion(), seen, nodes);

  const crownGeo = buildCrownGeometry();
  parts.push({ id: 'crown', geometry: crownGeo, position: CROWN_POS, quaternion: noRot, fill: colors.crownFill, stroke: colors.frondStroke });
  collectNodes(crownGeo, CROWN_POS, new THREE.Quaternion(), seen, nodes);

  // Two tiers: upper (shorter, more upright) + lower (longer, drooping) → a
  // full overlapping crown mass.
  const frondOrigin: Vec3 = [CROWN_POS[0], CROWN_POS[1] - 0.02, CROWN_POS[2]];
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2 + (f % 2 === 0 ? 0 : Math.PI / frondCount);
    const upper = f % 2 === 0;
    const pitch = upper ? 0.02 : -0.32;
    const spec: FrondSpec = upper
      ? { len: 1.05, droop: 0.34, rise: 0.22 }
      : { len: 1.4, droop: 0.78, rise: 0.28 };
    const quat = new THREE.Quaternion()
      .setFromAxisAngle(Y, angle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, pitch));
    const geo = buildFrondGeometry(spec);
    const fill = colors.frondFills[f % colors.frondFills.length];
    parts.push({ id: `frond-${f}`, geometry: geo, position: frondOrigin, quaternion: [quat.x, quat.y, quat.z, quat.w], fill, stroke: colors.frondStroke });
    collectNodes(geo, frondOrigin, quat, seen, nodes);
  }

  return { parts, nodes, height: TRUNK_H + 0.7 };
}
