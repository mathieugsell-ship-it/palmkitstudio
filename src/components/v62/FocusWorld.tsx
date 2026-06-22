// FocusWorld — v62 themed "world" that GROWS around a focused object.
//
// Reusable per object: give it the focused object's pivot (AABB centre), base Y,
// radius, the live glide vector + focus-ease refs and the focus scale, plus a
// THEME, and it grows a little ecosystem around that object while it is in focus
// and recedes it on Back. For the PALM the theme is a lush voxel JUNGLE: small
// palms, ferns, broad-leaf plants, grasses and saplings sprout from the ground
// and scale up into place with a fast-then-slow staggered pacing, then sway
// gently. Later: boat→AI, pitons→SEO, ship→Growth get their own themes.
//
// Cheap by design: a small POOL of pre-merged plant geometries (built once),
// instantiated as N capped meshes that SHARE one face + one edge material; one
// delta-time useFrame drives growth + sway + the glide/scale follow, and early-
// outs (group hidden, no work) whenever nothing is focused. Disposed on unmount.
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
  count?: number; // plant cap (desktop ~22, phone ~12)
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

const GREENS = ['#55AA66', '#3E8B51', '#4E9A6B', '#6FBF88', '#357A52', '#2F6B45'];
const pickGreen = (r: () => number) => GREENS[Math.floor(r() * GREENS.length)];

// ---- voxel plant archetypes (base at y=0, growing UP) ----------------------
function smallPalm(r: () => number): Box[] {
  const boxes: Box[] = [];
  const brown = r() < 0.5 ? '#815326' : '#8A5A2B';
  let cx = 0;
  for (let k = 0; k < 3; k++) { const y = 0.16 + 0.32 * k; const w = 0.12 - 0.018 * k; cx += 0.03; boxes.push({ p: [cx, y, 0], s: [w, 0.34, w], c: brown }); }
  const top = 0.16 + 0.32 * 2 + 0.14;
  const fr = 4 + Math.floor(r() * 2);
  for (let f = 0; f < fr; f++) { const a = (f / fr) * Math.PI * 2 + r() * 0.3; boxes.push({ p: [cx + Math.cos(a) * 0.16, top, Math.sin(a) * 0.16], s: [0.46, 0.06, 0.12], ry: a, rz: -0.35, c: pickGreen(r) }); }
  return boxes;
}
function fern(r: () => number): Box[] {
  const boxes: Box[] = [];
  const n = 5 + Math.floor(r() * 2);
  for (let b = 0; b < n; b++) { const a = (b / n) * Math.PI * 2 + r() * 0.4; boxes.push({ p: [Math.cos(a) * 0.14, 0.15, Math.sin(a) * 0.14], s: [0.36, 0.05, 0.085], ry: a, rz: -0.85, c: pickGreen(r) }); }
  boxes.push({ p: [0, 0.05, 0], s: [0.09, 0.09, 0.09], c: '#3E8B51' });
  return boxes;
}
function broadleaf(r: () => number): Box[] {
  const boxes: Box[] = [];
  const n = 3;
  for (let l = 0; l < n; l++) { const a = (l / n) * Math.PI * 2 + r() * 0.5; boxes.push({ p: [Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05], s: [0.05, 0.26, 0.05], ry: a, c: '#6E5A3A' }); boxes.push({ p: [Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.22], s: [0.34, 0.05, 0.26], ry: a, rz: -0.3, c: pickGreen(r) }); }
  return boxes;
}
function grass(r: () => number): Box[] {
  const boxes: Box[] = [];
  const g = pickGreen(r);
  const n = 6 + Math.floor(r() * 3);
  for (let b = 0; b < n; b++) { const a = r() * Math.PI * 2; const rr = r() * 0.1; const hh = 0.4 + r() * 0.35; boxes.push({ p: [Math.cos(a) * rr, hh / 2, Math.sin(a) * rr], s: [0.045, hh, 0.045], rz: (r() - 0.5) * 0.5, rx: (r() - 0.5) * 0.5, c: g }); }
  return boxes;
}
function sapling(r: () => number): Box[] {
  const boxes: Box[] = [];
  const hh = 0.6 + r() * 0.3;
  boxes.push({ p: [0, hh / 2, 0], s: [0.06, hh, 0.06], c: '#7A6038' });
  for (let l = 0; l < 3; l++) { const a = (l / 3) * Math.PI * 2 + r() * 0.5; boxes.push({ p: [Math.cos(a) * 0.1, hh * 0.8, Math.sin(a) * 0.1], s: [0.22, 0.05, 0.08], ry: a, rz: -0.4, c: pickGreen(r) }); }
  return boxes;
}
const ARCHETYPES = [smallPalm, fern, broadleaf, grass, sapling, fern, grass];

// merge a plant's boxes → one face geo (baked vertex colours) + one edge geo
function buildPlant(boxes: Box[]): { face: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
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
    col.set(b.c);
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

export function FocusWorld({ center, baseY, radius, scale, glideRef, easeRef, reducedMotion, count = 22, seed = 1337 }: FocusWorldProps) {
  const group = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const growT = useRef(0);

  // shared materials for ALL plants (cheap) — variety comes from vertex colours.
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, roughness: 0.85, transparent: true, opacity: 0 }), []);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#234d2c'), transparent: true, opacity: 0, toneMapped: false }), []);

  // small POOL of pre-merged plant geometries, instantiated many times.
  const pool = useMemo(() => {
    const r = mulberry32(seed);
    const out: { face: THREE.BufferGeometry; edge: THREE.BufferGeometry }[] = [];
    for (let i = 0; i < 10; i++) out.push(buildPlant(ARCHETYPES[Math.floor(r() * ARCHETYPES.length)](r)));
    return out;
  }, [seed]);

  // per-plant placement + fast-then-slow staggered growth schedule.
  const plants = useMemo(() => {
    const r = mulberry32(seed * 7 + 11);
    const N = Math.max(4, count);
    const SPREAD = 6.5; // seconds over which the jungle keeps filling in
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const arr = [];
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      const rr = lerp(radius * 0.45, radius * 1.65, Math.sqrt(r()));
      const front = Math.cos(a) * 0.5 + Math.sin(a) * 0.8; // toward camera ⇒ keep short (don't bury the palm)
      arr.push({
        pool: Math.floor(r() * 10),
        pos: [Math.cos(a) * rr, 0, Math.sin(a) * rr] as [number, number, number],
        yaw: r() * Math.PI * 2,
        target: (0.7 + r() * 0.7) * (front > 0.35 ? 0.55 : 1),
        delay: SPREAD * Math.pow(i / N, 1.9) + r() * 0.25, // first few pop fast, then slows
        growDur: 0.6 + r() * 0.3,
        swayPhase: r() * Math.PI * 2,
        swayAmp: 0.02 + r() * 0.03,
        swaySpeed: 0.5 + r() * 0.45,
      });
    }
    return arr;
  }, [seed, count, radius]);

  useEffect(
    () => () => {
      pool.forEach((p) => { p.face.dispose(); p.edge.dispose(); });
      faceMat.dispose();
      edgeMat.dispose();
    },
    [pool, faceMat, edgeMat],
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

    faceMat.opacity = Math.min(1, ease);
    edgeMat.opacity = Math.min(1, ease) * 0.85;

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
          geometry={pool[p.pool].face}
          material={faceMat}
          position={p.pos}
          raycast={() => null}
        >
          <lineSegments geometry={pool[p.pool].edge} material={edgeMat} raycast={() => null} />
        </mesh>
      ))}
    </group>
  );
}
