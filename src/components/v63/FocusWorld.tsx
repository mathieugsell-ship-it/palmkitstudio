// FocusWorld — v63 themed "world" that GROWS around a focused object.
//
// Reusable per object: given the focused object's pivot (AABB centre), base Y,
// radius, the live glide vector + focus-ease refs and the focus scale, plus a
// THEME, it grows a little ecosystem around that object while it is focused and
// recedes it on Back. For the PALM the theme is a LUSH voxel JUNGLE composed in
// depth layers (à la a real jungle photo, but blocky):
//   - BACK: several tall slim voxel palms + tall plants frame the focused palm,
//     rendered hazier/lighter (atmospheric depth) — the misty background.
//   - MID: broad-leaf plants + ferns, a little hazed.
//   - FRONT: lush undergrowth — big leafy bushes + ferns, brightest greens.
// Plants sprout from the ground (scale-from-base, eased pop) with a fast-then-
// slow staggered pacing: the framing palms + foreground bushes pop first (wow),
// then the jungle keeps filling in slowly while you read. The focused palm stays
// the hero in front (tall palms go to the sides/back, never front-centre).
//
// Cheap by design: 3 small POOLS of pre-merged plant geometries (built once;
// per-layer haze baked into vertex colours), instantiated as N capped meshes
// that SHARE one face material + 3 edge materials (one per layer). ONE delta-
// time useFrame drives growth + sway + the glide/scale follow and early-outs
// (group hidden, no work) whenever nothing is focused. Disposed on unmount.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface FocusWorldProps {
  center: THREE.Vector3;
  baseY: number;
  radius: number;
  scale: number;
  glideRef: React.RefObject<THREE.Vector3>;
  easeRef: React.RefObject<number>;
  reducedMotion: boolean;
  count?: number; // plant cap (desktop ~46, phone ~24)
  theme?: 'jungle';
  seed?: number;
}

type Box = { p: [number, number, number]; s: [number, number, number]; rx?: number; ry?: number; rz?: number; c: string };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GREENS = ['#55AA66', '#3E8B51', '#4E9A6B', '#6FBF88', '#357A52', '#2F6B45', '#69B86F'];
const pickGreen = (r: () => number) => GREENS[Math.floor(r() * GREENS.length)];
const MIST = new THREE.Color('#cfe0d6'); // pale misty green the back layers fade toward

// ---- voxel jungle archetypes (base at y=0, growing UP) ---------------------
// A tall slim palm with a broad, 2-segment drooping frond crown (framing piece).
function tallPalm(r: () => number): Box[] {
  const boxes: Box[] = [];
  const brown = r() < 0.5 ? '#6E4A22' : '#7E5A2A';
  const H = 2.6 + r() * 1.7;
  const seg = Math.max(6, Math.round(H / 0.34));
  let cx = 0, cz = 0; const lean = (r() - 0.5) * 0.6, leanZ = (r() - 0.5) * 0.5;
  for (let k = 0; k < seg; k++) { const y = 0.17 + 0.34 * k; const w = 0.12 - 0.045 * (k / seg); cx += lean / seg; cz += leanZ / seg; boxes.push({ p: [cx, y, cz], s: [w, 0.34, w], c: brown }); }
  const top = 0.17 + 0.34 * (seg - 1) + 0.12;
  const fr = 7 + Math.floor(r() * 3);
  for (let f = 0; f < fr; f++) {
    const a = (f / fr) * Math.PI * 2 + r() * 0.3; const L = 0.95 + r() * 0.45; const droop = (f % 2 ? 0.2 : -0.12);
    boxes.push({ p: [cx + Math.cos(a) * 0.18, top, cz + Math.sin(a) * 0.18], s: [L, 0.07, 0.22], ry: a, rz: droop, c: pickGreen(r) });
    boxes.push({ p: [cx + Math.cos(a) * (0.18 + L * 0.52), top - 0.14, cz + Math.sin(a) * (0.18 + L * 0.52)], s: [L * 0.7, 0.06, 0.18], ry: a, rz: droop - 0.4, c: pickGreen(r) });
  }
  return boxes;
}
// Lush undergrowth: a wide dense mound of broad leaves.
function bigBush(r: () => number): Box[] {
  const boxes: Box[] = [];
  const n = 11 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2; const rr = r() * 0.46; const y = 0.08 + r() * 0.52;
    boxes.push({ p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: [0.44 + r() * 0.22, 0.08, 0.34 + r() * 0.2], ry: a, rz: -0.1 - r() * 0.5, rx: (r() - 0.5) * 0.3, c: pickGreen(r) });
  }
  return boxes;
}
// Broad-leaf plant: stems with big leaves + a crown leaf.
function leafPlant(r: () => number): Box[] {
  const boxes: Box[] = [];
  const brown = '#6E5A3A'; const n = 3 + Math.floor(r() * 2); const baseH = 0.55 + r() * 0.7;
  for (let l = 0; l < n; l++) {
    const a = (l / n) * Math.PI * 2 + r() * 0.5;
    boxes.push({ p: [Math.cos(a) * 0.05, baseH * 0.5, Math.sin(a) * 0.05], s: [0.06, baseH, 0.06], ry: a, c: brown });
    boxes.push({ p: [Math.cos(a) * 0.3, baseH * 0.95, Math.sin(a) * 0.3], s: [0.52, 0.06, 0.36], ry: a, rz: -0.25, c: pickGreen(r) });
  }
  boxes.push({ p: [0, baseH + 0.05, 0], s: [0.36, 0.06, 0.32], c: pickGreen(r) });
  return boxes;
}
// Fern: broad arching 2-segment fronds radiating from the base.
function fern(r: () => number): Box[] {
  const boxes: Box[] = [];
  const n = 6 + Math.floor(r() * 3);
  for (let b = 0; b < n; b++) {
    const a = (b / n) * Math.PI * 2 + r() * 0.3;
    boxes.push({ p: [Math.cos(a) * 0.16, 0.2, Math.sin(a) * 0.16], s: [0.55, 0.05, 0.15], ry: a, rz: -0.65, c: pickGreen(r) });
    boxes.push({ p: [Math.cos(a) * 0.44, 0.34, Math.sin(a) * 0.44], s: [0.42, 0.045, 0.12], ry: a, rz: -1.0, c: pickGreen(r) });
  }
  return boxes;
}
// Tall thin reed/grass cluster (filler verticality).
function reed(r: () => number): Box[] {
  const boxes: Box[] = [];
  const g = pickGreen(r); const n = 5 + Math.floor(r() * 4);
  for (let b = 0; b < n; b++) {
    const a = r() * Math.PI * 2; const rr = r() * 0.13; const hh = 0.7 + r() * 0.7;
    boxes.push({ p: [Math.cos(a) * rr, hh / 2, Math.sin(a) * rr], s: [0.05, hh, 0.05], rz: (r() - 0.5) * 0.4, rx: (r() - 0.5) * 0.4, c: g });
    boxes.push({ p: [Math.cos(a) * rr, hh * 0.88, Math.sin(a) * rr], s: [0.18, 0.05, 0.06], ry: a, rz: -0.3, c: g });
  }
  return boxes;
}

type Arch = (r: () => number) => Box[];
// archetype mix per depth layer (0 = front/bright, 1 = mid, 2 = back/hazy)
const LAYER_ARCH: Arch[][] = [
  [bigBush, bigBush, fern, leafPlant, fern], // FRONT undergrowth
  [leafPlant, fern, tallPalm, reed, leafPlant], // MID
  [tallPalm, tallPalm, leafPlant, reed], // BACK framing palms
];
const LAYER_HAZE = [0.05, 0.28, 0.52];
const EDGE_COL = ['#1f4a2a', '#46654e', '#84998b']; // per-layer edge tint (back = hazy)

// merge a plant's boxes → one face geo (haze-baked vertex colours) + one edge geo
function buildPlant(boxes: Box[], hazeK: number): { face: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
  const faceParts: THREE.BufferGeometry[] = [];
  const edgeParts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]);
    e.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0);
    m.compose(new THREE.Vector3(b.p[0], b.p[1], b.p[2]), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    col.set(b.c).lerp(MIST, hazeK); // atmospheric haze toward the misty back
    const n = g.attributes.position.count;
    const ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    faceParts.push(g);
    edgeParts.push(new THREE.EdgesGeometry(g, 15));
  }
  const face = mergeGeometries(faceParts, false) ?? new THREE.BufferGeometry();
  const edge = mergeGeometries(edgeParts, false) ?? new THREE.BufferGeometry();
  faceParts.forEach((p) => p.dispose());
  edgeParts.forEach((p) => p.dispose());
  return { face, edge };
}

const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const grow = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : easeOutBack(u));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function FocusWorld({ center, baseY, radius, scale, glideRef, easeRef, reducedMotion, count = 46, seed = 1337 }: FocusWorldProps) {
  const group = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const growT = useRef(0);

  // shared materials: ONE face material (haze lives in the vertex colours) + one
  // edge material per depth layer (back edges hazier).
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, roughness: 0.82, transparent: true, opacity: 0 }), []);
  const edgeMats = useMemo(() => EDGE_COL.map((c) => new THREE.LineBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0, toneMapped: false })), []);

  // 3 layered POOLS of pre-merged plant geometries (built once).
  const pools = useMemo(() => {
    const r = mulberry32(seed);
    return LAYER_ARCH.map((arch, layer) => {
      const entries: { face: THREE.BufferGeometry; edge: THREE.BufferGeometry }[] = [];
      const n = layer === 0 ? 8 : 7;
      for (let i = 0; i < n; i++) entries.push(buildPlant(arch[Math.floor(r() * arch.length)](r), LAYER_HAZE[layer]));
      return entries;
    });
  }, [seed]);

  // per-plant placement + fast-then-slow staggered growth schedule.
  const plants = useMemo(() => {
    const r = mulberry32(seed * 7 + 11);
    const N = Math.max(6, count);
    const SPREAD = 7.5; // seconds the jungle keeps filling in
    // camera-front direction in the XZ ground plane (so we can keep tall stuff to
    // the sides/back and undergrowth to the front, and never bury the palm).
    const frontA = Math.atan2(0.8, 0.5);
    const awayA = frontA + Math.PI;
    const specs = [] as {
      layer: number; pool: number; pos: [number, number, number]; yaw: number; target: number;
      growDur: number; swayPhase: number; swayAmp: number; swaySpeed: number; prom: number; delay: number;
    }[];
    for (let i = 0; i < N; i++) {
      const roll = r();
      const layer = roll < 0.34 ? 0 : roll < 0.66 ? 1 : 2; // ~front / mid / back
      let a: number, rr: number, prom: number, target: number;
      if (layer === 2) { // BACK: tall framing palms, to the sides + behind
        a = awayA + (r() - 0.5) * 4.0; rr = lerp(radius * 1.1, radius * 2.1, Math.sqrt(r()));
        target = 0.85 + r() * 0.3; prom = 2 + r() * 0.3;
      } else if (layer === 1) { // MID: anywhere around, medium
        a = r() * Math.PI * 2; rr = lerp(radius * 0.8, radius * 1.6, Math.sqrt(r()));
        target = 0.8 + r() * 0.3; prom = 1 + r() * 0.4;
      } else { // FRONT: lush undergrowth, biased toward the camera (foreground)
        a = frontA + (r() - 0.5) * 3.4; rr = lerp(radius * 0.5, radius * 1.35, Math.sqrt(r()));
        target = 0.75 + r() * 0.35; prom = 1.4 + r() * 0.4;
      }
      specs.push({
        layer, pool: Math.floor(r() * pools[layer].length),
        pos: [Math.cos(a) * rr, 0, Math.sin(a) * rr], yaw: r() * Math.PI * 2, target,
        growDur: 0.6 + r() * 0.35, swayPhase: r() * Math.PI * 2,
        swayAmp: 0.018 + r() * 0.03, swaySpeed: 0.5 + r() * 0.45, prom, delay: 0,
      });
    }
    // pacing order: prominent framing palms + foreground bushes grow FIRST (fast
    // wow), then the rest fill in (slow). delay grows fast-then-slow with rank.
    const order = specs.map((_, i) => i).sort((x, y) => specs[y].prom - specs[x].prom || r() - 0.5);
    order.forEach((idx, rank) => { specs[idx].delay = SPREAD * Math.pow(rank / N, 1.95) + r() * 0.2; });
    return specs;
  }, [seed, count, radius, pools]);

  useEffect(
    () => () => {
      pools.forEach((layer) => layer.forEach((p) => { p.face.dispose(); p.edge.dispose(); }));
      faceMat.dispose();
      edgeMats.forEach((m) => m.dispose());
    },
    [pools, faceMat, edgeMats],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const ease = easeRef.current ?? 0;
    if (ease < 0.002) { if (g.visible) g.visible = false; growT.current = 0; return; }
    g.visible = true;

    // follow the focused object to its (glided, scaled) showroom slot
    const glide = glideRef.current;
    g.scale.setScalar(scale);
    g.position.set(
      center.x + (glide?.x ?? 0) * ease,
      center.y + scale * (baseY - center.y) + (glide?.y ?? 0) * ease,
      center.z + (glide?.z ?? 0) * ease,
    );

    // growth clock: only advances once the palm has settled into focus
    if (ease > 0.55 && !reducedMotion) growT.current += delta;
    const gt = reducedMotion ? 9999 : growT.current;

    const o = Math.min(1, ease);
    faceMat.opacity = o;
    for (const m of edgeMats) m.opacity = o * 0.85;

    const t = state.clock.elapsedTime;
    for (let i = 0; i < plants.length; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const p = plants[i];
      const gf = grow((gt - p.delay) / p.growDur);
      const vs = p.target * gf * ease;
      mesh.scale.setScalar(Math.max(vs, 0.0001));
      const sway = reducedMotion ? 0 : p.swayAmp * Math.sin(t * p.swaySpeed + p.swayPhase) * gf;
      mesh.rotation.set(0, p.yaw, sway);
    }
  });

  return (
    <group ref={group} visible={false}>
      {plants.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          geometry={pools[p.layer][p.pool].face}
          material={faceMat}
          position={p.pos}
          raycast={() => null}
        >
          <lineSegments geometry={pools[p.layer][p.pool].edge} material={edgeMats[p.layer]} raycast={() => null} />
        </mesh>
      ))}
    </group>
  );
}
