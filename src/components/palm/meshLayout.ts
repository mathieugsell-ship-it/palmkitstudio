// Variant B — procedural LOW-POLY TRIANGULATED palm.
//
// Builds an organic-ish palm (bent tapered trunk + faceted crown bud + drooping
// frond ribbons) as a coarse triangle mesh. Returns:
//   • parts — each a BufferGeometry + world transform + colors (for <Wireframe>)
//   • nodes — deduped world-space vertices (for the glowing node dots)
//
// FUTURE HOOKS: parts/nodes are addressable layers; a later build-anim can
// stagger vertices→edges→faces, and nodes can host hotspot labels. Not now.

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
  frondFill: string;
  frondStroke: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- trunk: tapered cylinder with a gentle lean ---------------------------
const TRUNK_H = 3.0;
const TRUNK_BEND = 0.34;
const R_BOTTOM = 0.16;
const R_TOP = 0.075;

function buildTrunkGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(R_TOP, R_BOTTOM, TRUNK_H, 6, 5, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + TRUNK_H / 2) / TRUNK_H; // 0 base .. 1 top
    pos.setX(i, pos.getX(i) + TRUNK_BEND * t * t); // smooth quadratic arc
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Trunk top (after bend) — where the crown + fronds attach.
const CROWN_POS: Vec3 = [TRUNK_BEND, TRUNK_H, 0];

// ---- frond: a drooping, tapering triangle ribbon --------------------------
const FROND_SEGS = 4;
const FROND_LEN = 1.5;
const FROND_W_START = 0.44;
const FROND_W_END = 0.0; // pointed tip → a single clean node, not a double dot
const FROND_DROOP = 0.62; // downward sag over the length

function buildFrondGeometry(lenScale: number): THREE.BufferGeometry {
  const verts: number[] = [];
  const idx: number[] = [];
  const len = FROND_LEN * lenScale;
  for (let i = 0; i <= FROND_SEGS; i++) {
    const u = i / FROND_SEGS;
    const x = u * len;
    const y = -FROND_DROOP * u * u; // sag downward toward the tip
    const w = lerp(FROND_W_START, FROND_W_END, u) / 2;
    verts.push(x, y, w, x, y, -w); // two edge vertices per cross-section
  }
  for (let i = 0; i < FROND_SEGS; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // strip quad → 2 triangles
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ---- crown bud: a small faceted icosahedron -------------------------------
function buildCrownGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.18, 0);
}

// Unique world vertices of a geometry under a transform (rounded dedupe).
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
  const noRot: [number, number, number, number] = [0, 0, 0, 1];

  // Trunk (centered geometry → lift so its base sits at y=0).
  const trunkGeo = buildTrunkGeometry();
  const trunkPos: Vec3 = [0, TRUNK_H / 2, 0];
  parts.push({ id: 'trunk', geometry: trunkGeo, position: trunkPos, quaternion: noRot, fill: colors.trunkFill, stroke: colors.trunkStroke });
  collectNodes(trunkGeo, trunkPos, new THREE.Quaternion(), seen, nodes);

  // Crown bud.
  const crownGeo = buildCrownGeometry();
  parts.push({ id: 'crown', geometry: crownGeo, position: CROWN_POS, quaternion: noRot, fill: colors.frondFill, stroke: colors.frondStroke });
  collectNodes(crownGeo, CROWN_POS, new THREE.Quaternion(), seen, nodes);

  // Fronds — radial, each drooping outward/down from just below the crown.
  const frondOrigin: Vec3 = [CROWN_POS[0], CROWN_POS[1] - 0.04, CROWN_POS[2]];
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    const lenScale = f % 2 === 0 ? 1 : 0.86;
    const pitch = -0.12; // slight base droop below horizontal
    const quat = new THREE.Quaternion()
      .setFromAxisAngle(Y, angle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch));
    const geo = buildFrondGeometry(lenScale);
    parts.push({ id: `frond-${f}`, geometry: geo, position: frondOrigin, quaternion: [quat.x, quat.y, quat.z, quat.w], fill: colors.frondFill, stroke: colors.frondStroke });
    collectNodes(geo, frondOrigin, quat, seen, nodes);
  }

  return { parts, nodes, height: TRUNK_H + 0.6 };
}
