// FocusWorld — v64 themed "world" that GROWS around a focused object.
//
// Reusable per object: given the focused object's pivot (AABB centre), base Y,
// radius, the live glide vector + focus-ease refs, the focus scale and — the key
// change in v64 — the focused object's OWN voxel model as a template, it grows a
// coherent little ecosystem around that object while focused and recedes on Back.
//
// For the PALM the jungle is built from the SAME hero palm model: smaller,
// slimmer copies of the real palm (its clean structured trunk + fronds) at
// varied heights/depths/rotations and green shades frame the hero, so everything
// looks coherent — no invented messy plants. A few simple, clean voxel broad-leaf
// plants form the undergrowth. Composed in 3 depth layers with atmospheric haze
// (back hazier/lighter), and grown with a fast-then-slow staggered pop. The hero
// palm stays clearly in front (jungle palms go to the sides/back).
//
// Cheap: a handful of pre-merged geometries (the palm template re-merged a few
// times per layer with haze + green variation, plus a couple of clean broad-leaf
// shapes) built once and instantiated as N capped meshes that SHARE one face +
// 3 edge materials. ONE delta-time useFrame drives growth + sway + follow and
// early-outs when nothing is focused. Disposed on unmount.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface TemplateBox { p: [number, number, number]; s: [number, number, number]; q: [number, number, number, number]; c: string; foliage: boolean }

export interface FocusWorldProps {
  center: THREE.Vector3;
  baseY: number;
  radius: number;
  height: number;
  scale: number;
  glideRef: React.RefObject<THREE.Vector3>;
  easeRef: React.RefObject<number>;
  reducedMotion: boolean;
  palmTemplate: TemplateBox[]; // the hero palm model (local, base at origin)
  count?: number; // plant cap (desktop ~38, phone ~18)
  theme?: 'jungle';
  seed?: number;
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIST = new THREE.Color('#cfe0d6'); // pale misty green the back layers fade toward
const LAYER_HAZE = [0.06, 0.3, 0.55];
const EDGE_COL = ['#234d2c', '#46654e', '#84998b']; // per-layer edge tint (back = hazy)
const GREENS = ['#55AA66', '#3E8B51', '#4E9A6B', '#6FBF88', '#357A52', '#69B86F'];

const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const grow = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : easeOutBack(u));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Geo = { face: THREE.BufferGeometry; edge: THREE.BufferGeometry };

// build a jungle palm geo from the hero palm template: haze toward mist by layer
// + nudge the foliage green per variant (richness), keep the trunk colour.
function buildPalmGeo(template: TemplateBox[], hazeK: number, hueShift: number, lightShift: number): Geo {
  const faceParts: THREE.BufferGeometry[] = [];
  const edgeParts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (const b of template) {
    const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]);
    m.compose(new THREE.Vector3(b.p[0], b.p[1], b.p[2]), q.set(b.q[0], b.q[1], b.q[2], b.q[3]), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    col.set(b.c);
    if (b.foliage) col.offsetHSL(hueShift, 0, lightShift);
    col.lerp(MIST, hazeK);
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

// a single CLEAN voxel broad-leaf plant: a short stem + an even rosette of big
// flat leaves (neat + readable — the undergrowth, not a random heap).
function buildBroadleaf(r: () => number, hazeK: number): Geo {
  const faceParts: THREE.BufferGeometry[] = [];
  const edgeParts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const green = GREENS[Math.floor(r() * GREENS.length)];
  const n = 5 + Math.floor(r() * 2); // 5–6 leaves
  const stemH = 0.16 + r() * 0.12;
  const leafL = 0.5 + r() * 0.18;
  const a0 = r() * Math.PI * 2;
  const boxes: { p: [number, number, number]; s: [number, number, number]; rx?: number; ry?: number; rz?: number; c: string }[] = [];
  boxes.push({ p: [0, stemH * 0.5, 0], s: [0.07, stemH, 0.07], c: '#6E5A3A' });
  for (let l = 0; l < n; l++) {
    const a = a0 + (l / n) * Math.PI * 2; // EVEN spacing → clean
    boxes.push({ p: [Math.cos(a) * leafL * 0.5, stemH + 0.04, Math.sin(a) * leafL * 0.5], s: [leafL, 0.06, leafL * 0.62], ry: a, rz: -0.34, c: green });
  }
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]);
    e.set(b.rx ?? 0, b.ry ?? 0, b.rz ?? 0);
    m.compose(new THREE.Vector3(b.p[0], b.p[1], b.p[2]), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    col.set(b.c).lerp(MIST, hazeK);
    const cn = g.attributes.position.count;
    const ca = new Float32Array(cn * 3);
    for (let i = 0; i < cn; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
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

export function FocusWorld({ center, baseY, radius, height, scale, glideRef, easeRef, reducedMotion, palmTemplate, count = 38, seed = 1337 }: FocusWorldProps) {
  const group = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const growT = useRef(0);

  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, roughness: 0.82, transparent: true, opacity: 0 }), []);
  const edgeMats = useMemo(() => EDGE_COL.map((c) => new THREE.LineBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 0, toneMapped: false })), []);

  // pools: palm variants per depth layer (from the hero template) + clean
  // broad-leaf variants for the undergrowth (front/mid).
  const pools = useMemo(() => {
    const r = mulberry32(seed);
    const palm = LAYER_HAZE.map((hz) => Array.from({ length: 4 }, () => buildPalmGeo(palmTemplate, hz, (r() - 0.45) * 0.12, (r() - 0.4) * 0.16)));
    const broad = [LAYER_HAZE[0], LAYER_HAZE[1]].map((hz) => Array.from({ length: 3 }, () => buildBroadleaf(r, hz)));
    return { palm, broad };
  }, [seed, palmTemplate]);

  // placement + fast-then-slow staggered growth schedule.
  const plants = useMemo(() => {
    const r = mulberry32(seed * 7 + 11);
    const N = Math.max(6, count);
    const SPREAD = 7.5;
    const frontA = Math.atan2(0.8, 0.5);
    const awayA = frontA + Math.PI;
    type P = { kind: 'palm' | 'broad'; layer: number; pool: number; pos: [number, number, number]; yaw: number; tx: number; ty: number; growDur: number; swayPhase: number; swayAmp: number; swaySpeed: number; prom: number; delay: number };
    const specs: P[] = [];
    for (let i = 0; i < N; i++) {
      const roll = r();
      const layer = roll < 0.34 ? 0 : roll < 0.66 ? 1 : 2; // front / mid / back
      const broad = layer < 2 && r() < 0.3; // some undergrowth in front/mid
      let a: number, rr: number, prom: number, ty: number, slim: number;
      if (layer === 2) { a = awayA + (r() - 0.5) * 4.0; rr = lerp(radius * 1.15, radius * 2.2, Math.sqrt(r())); ty = 0.5 + r() * 0.26; prom = 2 + r() * 0.3; slim = 0.8 + r() * 0.12; }
      else if (layer === 1) { a = r() * Math.PI * 2; rr = lerp(radius * 0.85, radius * 1.7, Math.sqrt(r())); ty = 0.36 + r() * 0.16; prom = 1 + r() * 0.4; slim = 0.82 + r() * 0.12; }
      else { a = frontA + (r() - 0.5) * 3.4; rr = lerp(radius * 0.55, radius * 1.4, Math.sqrt(r())); ty = 0.28 + r() * 0.14; prom = 1.4 + r() * 0.4; slim = 0.84 + r() * 0.12; }
      if (broad) { ty = (0.9 + r() * 0.5); slim = 1; prom = layer === 0 ? 1.5 : 1.1; } // undergrowth: low + readable
      specs.push({
        kind: broad ? 'broad' : 'palm', layer,
        pool: broad ? Math.floor(r() * pools.broad[layer].length) : Math.floor(r() * pools.palm[layer].length),
        pos: [Math.cos(a) * rr, 0, Math.sin(a) * rr], yaw: r() * Math.PI * 2,
        tx: ty * slim, ty,
        growDur: 0.6 + r() * 0.35, swayPhase: r() * Math.PI * 2, swayAmp: 0.016 + r() * 0.028, swaySpeed: 0.5 + r() * 0.45, prom, delay: 0,
      });
    }
    const order = specs.map((_, i) => i).sort((x, y) => specs[y].prom - specs[x].prom || r() - 0.5);
    order.forEach((idx, rank) => { specs[idx].delay = SPREAD * Math.pow(rank / N, 1.95) + r() * 0.2; });
    return specs;
  }, [seed, count, radius, height, pools]);

  useEffect(
    () => () => {
      pools.palm.forEach((layer) => layer.forEach((p) => { p.face.dispose(); p.edge.dispose(); }));
      pools.broad.forEach((layer) => layer.forEach((p) => { p.face.dispose(); p.edge.dispose(); }));
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

    const glide = glideRef.current;
    g.scale.setScalar(scale);
    g.position.set(
      center.x + (glide?.x ?? 0) * ease,
      center.y + scale * (baseY - center.y) + (glide?.y ?? 0) * ease,
      center.z + (glide?.z ?? 0) * ease,
    );

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
      const e2 = gf * ease;
      mesh.scale.set(Math.max(p.tx * e2, 0.0001), Math.max(p.ty * e2, 0.0001), Math.max(p.tx * e2, 0.0001));
      const sway = reducedMotion ? 0 : p.swayAmp * Math.sin(t * p.swaySpeed + p.swayPhase) * gf;
      mesh.rotation.set(0, p.yaw, sway);
    }
  });

  return (
    <group ref={group} visible={false}>
      {plants.map((p, i) => {
        const geo = p.kind === 'palm' ? pools.palm[p.layer][p.pool] : pools.broad[p.layer][p.pool];
        return (
          <mesh
            key={i}
            ref={(el) => { meshRefs.current[i] = el; }}
            geometry={geo.face}
            material={faceMat}
            position={p.pos}
            raycast={() => null}
          >
            <lineSegments geometry={geo.edge} material={edgeMats[p.layer]} raycast={() => null} />
          </mesh>
        );
      })}
    </group>
  );
}
