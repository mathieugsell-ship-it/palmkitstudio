// Full-scene wireframe build + white settle (STEP 6).
//
// Every block (island/palm/water) is a raw <mesh> + child <lineSegments> with
// materials OWNED here (so opacity/colour can be driven imperatively without
// re-creating geometry). All construction points are one instanced mesh. ONE
// useFrame orchestrates the whole timeline:
//   1) points scale-in, then glowing-blue edges trace (cascade island→palm→water,
//      bottom-to-top)  2) translucent faces fade in  3) a TOP→BOTTOM sweep lerps
//      each edge from over-driven blue (blooms = thick) to thin cool-white
//      (≤1 = no bloom = thin), and dissolves the island/water scaffold points
//   4) rest: palm nodes pulse, water ripples, idle rotation eases in (in hero).
// Reduced-motion → render the final settled scene immediately.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { buildScene } from './sceneBuild';
import { BOAT_PIVOT, BOAT_YAW } from './boatLayout';
import { SHIP_PIVOT, SHIP_YAW } from './shipLayout';
import { FROND_ORIGIN } from './layout';
import type { PalmConfig } from './config';

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Props {
  config: PalmConfig;
  bloom: boolean;
  pulse: boolean; // applied only after the build (visible && !reduced-motion)
  animate: boolean; // water ripple (visible && !reduced-motion)
  reducedMotion: boolean;
  gate?: 'hold' | 'build' | 'instant'; // HERO intro control (v47): hold invisible → play → done
  noHover?: boolean; // v53: touch device (no hover) → no pointer cursor; labels carry the signal
  labels?: Record<string, string>; // v53: group → service name (EN default, i18n-driven)
  onHit?: (service: string) => void; // tap detection (part A: just identify, no focus yet)
  onBuildComplete?: () => void;
}

// The 4 clickable service objects (decor — island/water — is excluded, never glows).
// group → { service name (EN fallback), i18n key }
const CLICKABLE: Record<string, { service: string; key: string }> = {
  palm: { service: 'Websites', key: 'websites' },
  boat: { service: 'AI Automation', key: 'ai' },
  piton: { service: 'Local SEO', key: 'seo' },
  ship: { service: 'Growth', key: 'growth' },
};
// Explicit 3D anchor point ON each object for its label pin (v54). The earlier
// AABB-derived anchors were wrong — the boat's long propeller shaft skewed its
// box back-left (label landed near the pitons), and the palm anchor sat above
// the crown off-screen. These are hand-placed on the visible object.
const ANCHOR: Record<string, [number, number, number]> = {
  palm: [-0.69, 2.5, -1.1], // upper trunk / base of the crown
  boat: [-0.3, 0.55, 2.3], // just above the longtail hull (foreground)
  piton: [-6.5, 1.7, -4.3], // on the main karst column
  ship: [-1.97, 0.95, -7.34], // on the cruise-ship superstructure
};
// v55: 2D pixel offset of the PILL from the anchor dot, so the label sits OUT in
// the empty sky/space, joined back to its object by a longer connector line.
// Palm/pitons/ship push UP into the sky; the foreground boat pushes DOWN into the
// open water. Small horizontal bias keeps the edge labels (pitons/ship) on-screen.
const LABEL_OFFSET: Record<string, [number, number]> = {
  palm: [0, -82],
  piton: [14, -78],
  ship: [-10, -80],
  boat: [-16, 70],
};

export function SceneBuild({ config, bloom, pulse, animate, reducedMotion, gate = 'build', noHover = false, labels, onHit, onBuildComplete }: Props) {
  const scene = useMemo(() => buildScene(config), [config]);
  const B = config.build;
  const edgeBuildBoost = bloom ? B.edgeBuildBoost : 1.0;
  const emissiveBase = bloom ? 2.1 : 1.1;
  const emissiveAmp = bloom ? 0.18 : 0.08;

  const edgeBuildObj = useMemo(
    () => new THREE.Color(config.colors.edgeBuild).multiplyScalar(edgeBuildBoost),
    [config.colors.edgeBuild, edgeBuildBoost],
  );
  const edgeFinalObj = useMemo(() => new THREE.Color(config.colors.edgeFinal), [config.colors.edgeFinal]);
  const edgeWaterObj = useMemo(() => new THREE.Color(config.colors.edgeWater), [config.colors.edgeWater]);
  // Per-block RESTING edge target (v45): water edges recede (water-tinted + very
  // low opacity) so the turquoise reads instead of a white grid; solids keep a
  // softened-but-visible cool-white edge. Used by the settle target + at rest.
  const edgeRest = useMemo(
    () =>
      scene.blocks.map((b) =>
        b.group === 'water'
          ? { op: B.waterEdgeOpacity, col: edgeWaterObj }
          : { op: B.finalEdgeOpacity, col: edgeFinalObj },
      ),
    [scene, B.waterEdgeOpacity, B.finalEdgeOpacity, edgeWaterObj, edgeFinalObj],
  );

  // ---- geometry + materials, created ONCE -----------------------------------
  const faceGeoms = useMemo(
    () => scene.blocks.map((b) => new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2])),
    [scene],
  );
  const edgeGeoms = useMemo(() => faceGeoms.map((g) => new THREE.EdgesGeometry(g, 15)), [faceGeoms]);
  const faceMats = useMemo(
    () =>
      scene.blocks.map(
        (b) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(b.color),
            flatShading: true,
            metalness: 0,
            roughness: 0.85,
            transparent: true,
            opacity: reducedMotion ? b.finalOpacity : 0,
            depthWrite: false,
          }),
      ),
    [scene, reducedMotion],
  );
  const edgeMats = useMemo(
    () =>
      scene.blocks.map(
        (_b, i) =>
          new THREE.LineBasicMaterial({
            color: (reducedMotion ? edgeRest[i].col : edgeBuildObj).clone(),
            toneMapped: false,
            transparent: true,
            opacity: reducedMotion ? edgeRest[i].op : 0,
          }),
      ),
    [scene, reducedMotion, edgeBuildObj, edgeRest],
  );
  const pointGeo = useMemo(() => new THREE.SphereGeometry(0.015, 8, 8), []);
  const pointMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.colors.vertex),
        emissive: new THREE.Color(config.colors.vertex),
        emissiveIntensity: emissiveBase,
        toneMapped: false,
        transparent: true,
        opacity: 0.95,
        metalness: 0,
        roughness: 0.4,
      }),
    [config.colors.vertex, emissiveBase],
  );

  useEffect(
    () => () => {
      faceGeoms.forEach((g) => g.dispose());
      edgeGeoms.forEach((g) => g.dispose());
      faceMats.forEach((m) => m.dispose());
      edgeMats.forEach((m) => m.dispose());
      pointGeo.dispose();
      pointMat.dispose();
    },
    [faceGeoms, edgeGeoms, faceMats, edgeMats, pointGeo, pointMat],
  );

  // Precomputed per-element start times.
  const timing = useMemo(() => {
    const blocks = scene.blocks.map((b) => ({
      edgeStart: B.edgStart + (B.edgEnd - B.edgStart) * b.o,
      faceStart: B.facStart + (B.facEnd - B.facStart) * b.o,
      settleStart: B.setStart + (B.setEnd - B.setStart) * (1 - b.hGlobal),
    }));
    const points = scene.points.map((pt) => ({
      ptStart: B.ptsStart + (B.ptsEnd - B.ptsStart) * pt.o,
      settleStart: B.setStart + (B.setEnd - B.setStart) * (1 - pt.hGlobal),
    }));
    return { blocks, points };
  }, [scene, B]);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pointsRef = useRef<THREE.InstancedMesh>(null);
  const builtRef = useRef(reducedMotion);
  const elapsedRef = useRef(reducedMotion ? B.duration : 0);
  const waterIdx = useMemo(
    () => scene.blocks.map((b, i) => (b.ripple ? i : -1)).filter((i) => i >= 0),
    [scene],
  );
  // Boat rigid-body rig: pivot at the waterline + the hull's longitudinal (Lhat)
  // and lateral (Hhat) world axes, so pitch/roll rock the boat along its own hull
  // rather than the world axes. Plus each boat block's base transform.
  const boatRig = useMemo(() => {
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), BOAT_YAW);
    return {
      pivot: new THREE.Vector3(BOAT_PIVOT[0], BOAT_PIVOT[1], BOAT_PIVOT[2]),
      Lhat: new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ), // along the hull (length)
      Hhat: new THREE.Vector3(0, 0, 1).applyQuaternion(yawQ), // across the hull (beam)
    };
  }, []);
  const boatData = useMemo(
    () =>
      scene.blocks
        .map((b, i) => ({ b, i }))
        .filter((x) => x.b.group === 'boat')
        .map((x) => ({
          i: x.i,
          basePos: new THREE.Vector3(x.b.position[0], x.b.position[1], x.b.position[2]),
          baseQuat: new THREE.Quaternion(x.b.quaternion[0], x.b.quaternion[1], x.b.quaternion[2], x.b.quaternion[3]),
        })),
    [scene],
  );
  const boatScratch = useMemo(
    () => ({ q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), r: new THREE.Quaternion(), v: new THREE.Vector3() }),
    [],
  );
  // Distant cruise-ship rig: pivot at the waterline + the hull's longitudinal
  // axis (for the tiny roll). Only a bob + roll — no pitch. Plus base transforms.
  const shipRig = useMemo(() => {
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SHIP_YAW);
    return {
      pivot: new THREE.Vector3(SHIP_PIVOT[0], SHIP_PIVOT[1], SHIP_PIVOT[2]),
      Lhat: new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ), // along the hull (roll axis)
    };
  }, []);
  const shipData = useMemo(
    () =>
      scene.blocks
        .map((b, i) => ({ b, i }))
        .filter((x) => x.b.group === 'ship')
        .map((x) => ({
          i: x.i,
          basePos: new THREE.Vector3(x.b.position[0], x.b.position[1], x.b.position[2]),
          baseQuat: new THREE.Quaternion(x.b.quaternion[0], x.b.quaternion[1], x.b.quaternion[2], x.b.quaternion[3]),
        })),
    [scene],
  );
  const shipScratch = useMemo(
    () => ({ r: new THREE.Quaternion(), v: new THREE.Vector3() }),
    [],
  );
  // Frond breeze rig: group each frond's blocks (id `…frond-{f}-{k}`), with the
  // frond's lateral horizontal axis (for the vertical tip nod) and a per-frond
  // phase. All fronds rotate about the shared crown origin; trunk/crown excluded.
  const frondOrigin = useMemo(
    () => new THREE.Vector3(FROND_ORIGIN[0], FROND_ORIGIN[1], FROND_ORIGIN[2]),
    [],
  );
  const frondData = useMemo(() => {
    const groups = new Map<number, { i: number; basePos: THREE.Vector3; baseQuat: THREE.Quaternion }[]>();
    scene.blocks.forEach((b, i) => {
      if (b.group !== 'palm') return;
      const m = /frond-(\d+)-\d+/.exec(b.id);
      if (!m) return;
      const f = parseInt(m[1], 10);
      if (!groups.has(f)) groups.set(f, []);
      groups.get(f)!.push({
        i,
        basePos: new THREE.Vector3(b.position[0], b.position[1], b.position[2]),
        baseQuat: new THREE.Quaternion(b.quaternion[0], b.quaternion[1], b.quaternion[2], b.quaternion[3]),
      });
    });
    const fc = Math.max(config.frondCount, 1);
    return Array.from(groups.entries()).map(([f, blks]) => {
      const angle = (f / fc) * Math.PI * 2;
      return {
        blocks: blks,
        lat: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), // tip nod axis (horizontal, ⟂ frond)
        phase: f * config.frondMotion.phaseStep,
      };
    });
  }, [scene, config.frondCount, config.frondMotion.phaseStep]);
  const frondScratch = useMemo(
    () => ({ q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), r: new THREE.Quaternion(), v: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0) }),
    [],
  );

  // ---- v52: clickable objects (glow + generous hitboxes) -------------------
  // Per clickable group: its block indices (to drive the teal edge glow) and a
  // padded AABB hitbox (centre + size) for easy tapping. Padding is larger for
  // the small/distant pitons + ship.
  const PAD: Record<string, number> = { palm: 0.5, boat: 0.6, piton: 0.9, ship: 0.9 };
  const clickables = useMemo(() => {
    const acc: Record<string, { idx: number[]; min: number[]; max: number[] }> = {};
    scene.blocks.forEach((b, i) => {
      if (!CLICKABLE[b.group]) return;
      const a = (acc[b.group] ??= { idx: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      a.idx.push(i);
      for (let k = 0; k < 3; k++) {
        a.min[k] = Math.min(a.min[k], b.position[k] - b.size[k] / 2);
        a.max[k] = Math.max(a.max[k], b.position[k] + b.size[k] / 2);
      }
    });
    return Object.entries(acc).map(([group, a]) => {
      const pad = PAD[group] ?? 0.6;
      const center: [number, number, number] = [
        (a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, (a.min[2] + a.max[2]) / 2,
      ];
      const size: [number, number, number] = [
        a.max[0] - a.min[0] + 2 * pad, a.max[1] - a.min[1] + 2 * pad, a.max[2] - a.min[2] + 2 * pad,
      ];
      const anchor: [number, number, number] = ANCHOR[group] ?? [center[0], a.max[1] + 0.3, center[2]];
      return { group, service: CLICKABLE[group].service, key: CLICKABLE[group].key, idx: a.idx, center, size, anchor };
    });
  }, [scene]);
  const tealGlow = useMemo(() => new THREE.Color(config.colors.vertex), [config.colors.vertex]); // #5FE3D6
  // mutable per-object interaction state (refs so the render loop reads them cheaply)
  const hoverRef = useRef<Record<string, boolean>>({});
  const glowRef = useRef<Record<string, number>>({}); // eased glow level
  const flashRef = useRef<Record<string, number>>({}); // decaying tap-flash boost
  // React state drives the label badge look (rest vs active). Refs drive the glow.
  const [hovered, setHovered] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);
  // The label [data-i18n] spans mount with the canvas (after the page's initial
  // applyLang ran) — ask the page switcher to re-apply the active language.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('pk-relabel')), 0);
    return () => clearTimeout(id);
  }, []);

  // Shared interaction handlers (used by both the hitbox mesh and the label pill).
  const setHover = (group: string, on: boolean) => {
    hoverRef.current[group] = on;
    setHovered((prev) => (on ? group : prev === group ? null : prev));
    if (!noHover) document.body.style.cursor = on ? 'pointer' : '';
  };
  const activate = (group: string, service: string) => {
    if (!builtRef.current) return; // ignore during the intro/build
    flashRef.current[group] = 1.0;
    setTapped(group);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapped((t) => (t === group ? null : t)), 1100);
    onHit?.(service);
    // eslint-disable-next-line no-console
    console.log('[palmkit] hit:', group, '→', service);
  };

  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color() }),
    [],
  );

  useLayoutEffect(() => {
    const im = pointsRef.current;
    if (!im) return;
    for (let i = 0; i < scene.points.length; i++) {
      const pt = scene.points[i];
      const s0 = reducedMotion ? (pt.keepAtRest ? 1 : 0.0001) : 0.0001;
      scratch.p.set(pt.position[0], pt.position[1], pt.position[2]);
      scratch.s.setScalar(s0);
      scratch.m.compose(scratch.p, scratch.q, scratch.s);
      im.setMatrixAt(i, scratch.m);
    }
    im.instanceMatrix.needsUpdate = true;
  }, [scene, reducedMotion, scratch]);

  useFrame((state, delta) => {
    // ---- build phase (skipped once built / reduced-motion) ----------------
    // Jump the whole scene to its final settled state at once (skip / instant).
    const finalize = () => {
      for (let j = 0; j < scene.blocks.length; j++) {
        faceMats[j].opacity = scene.blocks[j].finalOpacity;
        edgeMats[j].opacity = edgeRest[j].op;
        edgeMats[j].color.copy(edgeRest[j].col);
        meshRefs.current[j]?.scale.setScalar(1);
      }
      const imf = pointsRef.current;
      if (imf) {
        for (let i = 0; i < scene.points.length; i++) {
          const pt = scene.points[i];
          scratch.p.set(pt.position[0], pt.position[1], pt.position[2]);
          scratch.s.setScalar(pt.keepAtRest ? 1 : 0.0001);
          scratch.m.compose(scratch.p, scratch.q, scratch.s);
          imf.setMatrixAt(i, scratch.m);
        }
        imf.instanceMatrix.needsUpdate = true;
      }
      builtRef.current = true;
      onBuildComplete?.();
    };

    if (!builtRef.current && !reducedMotion) {
      // HERO intro gate (v47): 'hold' keeps the scene invisible (faces/edges
      // start at opacity 0) until the intro releases it; 'instant' jumps to built
      // (skip / return visit); 'build' plays the cinematic assembly.
      if (gate === 'hold') {
        // do nothing — the world stays unbuilt/invisible behind the intro text
      } else if (gate === 'instant') {
        finalize();
      } else {
      elapsedRef.current += delta;
      const p = Math.min(elapsedRef.current / B.duration, 1);
      const win = B.revealWin;
      const fwin = B.faceWin;
      const swin = B.setWin;

      for (let j = 0; j < scene.blocks.length; j++) {
        const tb = timing.blocks[j];
        const blk = scene.blocks[j];
        const ea = smooth((p - tb.edgeStart) / win);
        const fa = smooth((p - tb.faceStart) / fwin);
        const st = smooth((p - tb.settleStart) / swin);
        faceMats[j].opacity = fa * blk.finalOpacity;
        edgeMats[j].opacity = ea * lerp(0.95, edgeRest[j].op, st); // settle toward the per-group rest opacity
        scratch.c.copy(edgeBuildObj).lerp(edgeRest[j].col, st); // …and per-group rest tint (water-teal / cool-white)
        edgeMats[j].color.copy(scratch.c);
        meshRefs.current[j]?.scale.setScalar(0.94 + 0.06 * ea); // edges fade + grow
      }

      const im = pointsRef.current;
      if (im) {
        for (let i = 0; i < scene.points.length; i++) {
          const tp = timing.points[i];
          const pt = scene.points[i];
          const pa = smooth((p - tp.ptStart) / win);
          const so = smooth((p - tp.settleStart) / swin);
          const sc = pa * (pt.keepAtRest ? 1 : 1 - so); // scaffold points dissolve at rest
          scratch.p.set(pt.position[0], pt.position[1], pt.position[2]);
          scratch.s.setScalar(Math.max(sc, 0.0001));
          scratch.m.compose(scratch.p, scratch.q, scratch.s);
          im.setMatrixAt(i, scratch.m);
        }
        im.instanceMatrix.needsUpdate = true;
      }

      if (p >= 1) finalize();
      }
    }

    // ---- water ripple (every frame while animating) -----------------------
    if (animate && !reducedMotion) {
      const t = state.clock.elapsedTime;
      const amp = config.rippleAmp;
      const sp = config.rippleSpeed;
      for (const i of waterIdx) {
        const mesh = meshRefs.current[i];
        if (mesh) mesh.position.y = scene.blocks[i].baseY + amp * Math.sin(t * sp + scene.blocks[i].ripplePhase);
      }
    }

    // ---- gentle boat idle (rigid pitch/roll/bob, only after build) ---------
    // Same `animate` gate as the ripple, so it pauses offscreen. Uses the shared
    // clock (framerate-independent). Rocks the whole boat about the waterline
    // pivot along its own hull axes — calm, slow, sine-looped.
    if (builtRef.current && animate && !reducedMotion && boatData.length) {
      const t = state.clock.elapsedTime;
      const M = config.boatMotion;
      const pitch = M.pitchAmp * Math.sin(t * M.pitchSpeed + M.pitchPhase);
      const roll = M.rollAmp * Math.sin(t * M.rollSpeed + M.rollPhase);
      const bob = M.bobAmp * Math.sin(t * M.bobSpeed + M.bobPhase);
      boatScratch.q1.setFromAxisAngle(boatRig.Hhat, pitch); // pitch about the beam axis
      boatScratch.q2.setFromAxisAngle(boatRig.Lhat, roll); // roll about the hull axis
      boatScratch.r.copy(boatScratch.q1).multiply(boatScratch.q2);
      for (const bd of boatData) {
        const mesh = meshRefs.current[bd.i];
        if (!mesh) continue;
        boatScratch.v.copy(bd.basePos).sub(boatRig.pivot).applyQuaternion(boatScratch.r).add(boatRig.pivot);
        boatScratch.v.y += bob;
        mesh.position.copy(boatScratch.v);
        mesh.quaternion.copy(boatScratch.r).multiply(bd.baseQuat);
      }
    }

    // ---- barely-there cruise-ship idle (slow bob + tiny roll, NO pitch) ----
    // Far, big liner → minimal motion (distant motion looks exaggerated). On a
    // slower, different phase than the boat so they aren't in sync. Same gate.
    if (builtRef.current && animate && !reducedMotion && shipData.length) {
      const t = state.clock.elapsedTime;
      const S = config.shipMotion;
      const roll = S.rollAmp * Math.sin(t * S.rollSpeed + S.rollPhase);
      const bob = S.bobAmp * Math.sin(t * S.bobSpeed + S.bobPhase);
      shipScratch.r.setFromAxisAngle(shipRig.Lhat, roll); // tiny roll about the hull axis
      for (const sd of shipData) {
        const mesh = meshRefs.current[sd.i];
        if (!mesh) continue;
        shipScratch.v.copy(sd.basePos).sub(shipRig.pivot).applyQuaternion(shipScratch.r).add(shipRig.pivot);
        shipScratch.v.y += bob;
        mesh.position.copy(shipScratch.v);
        mesh.quaternion.copy(shipScratch.r).multiply(sd.baseQuat);
      }
    }

    // ---- gentle frond breeze (per-frond sway/nod, only after build) --------
    // Each frond rotates about the shared crown origin: a small horizontal fan
    // sway + a small vertical tip nod, offset per frond so the wind ripples
    // through. Trunk/crown untouched. Same `animate` gate (pauses offscreen).
    if (builtRef.current && animate && !reducedMotion && frondData.length) {
      const t = state.clock.elapsedTime;
      const F = config.frondMotion;
      for (const fd of frondData) {
        const sway = F.swayAmp * Math.sin(t * F.swaySpeed + fd.phase);
        const nod = F.nodAmp * Math.sin(t * F.nodSpeed + fd.phase + 0.7);
        frondScratch.q1.setFromAxisAngle(frondScratch.Y, sway); // horizontal fan sway
        frondScratch.q2.setFromAxisAngle(fd.lat, nod); // vertical tip nod
        frondScratch.r.copy(frondScratch.q1).multiply(frondScratch.q2);
        for (const bl of fd.blocks) {
          const mesh = meshRefs.current[bl.i];
          if (!mesh) continue;
          frondScratch.v.copy(bl.basePos).sub(frondOrigin).applyQuaternion(frondScratch.r).add(frondOrigin);
          mesh.position.copy(frondScratch.v);
          mesh.quaternion.copy(frondScratch.r).multiply(bl.baseQuat);
        }
      }
    }

    // ---- v53: teal hover/tap glow on the 4 objects (no breathing anymore) ----
    // The labels carry the "clickable" signal now; the glow is just confirmation:
    // 0 at rest, eased bright on hover (desktop), plus a quick decaying flash on
    // tap. High glow overdrives edge luminance >1 so the selective bloom catches
    // it on desktop. Decor edges are never touched.
    if (builtRef.current && !reducedMotion) {
      for (const c of clickables) {
        const target = hoverRef.current[c.group] ? 0.95 : 0.0; // no rest glow
        const g0 = glowRef.current[c.group] ?? 0;
        const base = g0 + (target - g0) * Math.min(1, delta * 9); // ease
        glowRef.current[c.group] = base;
        let fl = flashRef.current[c.group] ?? 0;
        if (fl > 0) fl = Math.max(0, fl - delta * 2.4); // decaying tap flash
        flashRef.current[c.group] = fl;
        const glow = base + fl; // can exceed 1 (flash / hover) → bloom on desktop
        const mix = Math.min(glow, 1);
        const op = lerp(edgeRest[c.idx[0]].op, 0.95, mix);
        for (const j of c.idx) {
          scratch.c.copy(edgeRest[j].col).lerp(tealGlow, mix);
          if (glow > 1) scratch.c.multiplyScalar(glow); // overdrive → bloom
          edgeMats[j].color.copy(scratch.c);
          edgeMats[j].opacity = op;
        }
      }
    }

    // ---- palm node pulse (only after build; scaffold points already gone) -
    pointMat.emissiveIntensity =
      builtRef.current && pulse ? emissiveBase + Math.sin(state.clock.elapsedTime * 2.2) * emissiveAmp : emissiveBase;
  });

  return (
    <group>
      {scene.blocks.map((b, j) => (
        <mesh
          key={b.id}
          ref={(el) => {
            meshRefs.current[j] = el;
          }}
          geometry={faceGeoms[j]}
          material={faceMats[j]}
          position={b.position}
          quaternion={b.quaternion}
        >
          <lineSegments geometry={edgeGeoms[j]} material={edgeMats[j]} />
        </mesh>
      ))}
      <instancedMesh ref={pointsRef} args={[pointGeo, pointMat, scene.points.length]} frustumCulled={false} />

      {/* generous invisible hitboxes — one per clickable object. R3F raycasts
          these for hover (desktop) + tap (mobile). No focus yet. */}
      {clickables.map((c) => (
        <mesh
          key={`hit-${c.group}`}
          position={c.center}
          onPointerOver={(e) => { e.stopPropagation(); if (!reducedMotion) setHover(c.group, true); }}
          onPointerOut={(e) => { e.stopPropagation(); setHover(c.group, false); }}
          onPointerDown={(e) => { e.stopPropagation(); activate(c.group, c.service); }}
        >
          <boxGeometry args={c.size} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* v55: always-visible service label pins (drei Html, screen-space). The
          dot stays on the object's 3D anchor; the pill is offset into the empty
          space (LABEL_OFFSET), joined by a longer connector line. Discreet at
          rest, intensifies on hover/tap; the pill is clickable (= tap object). */}
      {clickables.map((c) => {
        const active = hovered === c.group || tapped === c.group;
        const [dx, dy] = LABEL_OFFSET[c.group] ?? [0, -78];
        const len = Math.hypot(dx, dy);
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        const pinStyle = { '--dx': `${dx}px`, '--dy': `${dy}px`, '--len': `${len}px`, '--ang': `${ang}deg` } as unknown as CSSProperties;
        return (
          <Html key={`lbl-${c.group}`} position={c.anchor} occlude={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`svc-pin${active ? ' is-active' : ''}`} style={pinStyle}>
              <span className="svc-connector" />
              <span className="svc-anchor-dot" />
              <button
                type="button"
                className="svc-pill"
                onPointerOver={() => { if (!reducedMotion) setHover(c.group, true); }}
                onPointerOut={() => setHover(c.group, false)}
                onPointerDown={(e) => { e.preventDefault(); activate(c.group, c.service); }}
              >
                <span className="svc-name" data-i18n={`services.${c.key}.name`}>{labels?.[c.group] ?? c.service}</span>
              </button>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
