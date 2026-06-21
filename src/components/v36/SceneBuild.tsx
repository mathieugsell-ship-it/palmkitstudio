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
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildScene } from './sceneBuild';
import { BOAT_PIVOT, BOAT_YAW } from './boatLayout';
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
  onBuildComplete?: () => void;
}

export function SceneBuild({ config, bloom, pulse, animate, reducedMotion, onBuildComplete }: Props) {
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
        () =>
          new THREE.LineBasicMaterial({
            color: (reducedMotion ? edgeFinalObj : edgeBuildObj).clone(),
            toneMapped: false,
            transparent: true,
            opacity: reducedMotion ? B.finalEdgeOpacity : 0,
          }),
      ),
    [scene, reducedMotion, edgeBuildObj, edgeFinalObj, B.finalEdgeOpacity],
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
    if (!builtRef.current && !reducedMotion) {
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
        edgeMats[j].opacity = ea * lerp(0.95, B.finalEdgeOpacity, st);
        scratch.c.copy(edgeBuildObj).lerp(edgeFinalObj, st);
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

      if (p >= 1) {
        for (let j = 0; j < scene.blocks.length; j++) {
          faceMats[j].opacity = scene.blocks[j].finalOpacity;
          edgeMats[j].opacity = B.finalEdgeOpacity;
          edgeMats[j].color.copy(edgeFinalObj);
          meshRefs.current[j]?.scale.setScalar(1);
        }
        if (im) {
          for (let i = 0; i < scene.points.length; i++) {
            const pt = scene.points[i];
            scratch.p.set(pt.position[0], pt.position[1], pt.position[2]);
            scratch.s.setScalar(pt.keepAtRest ? 1 : 0.0001);
            scratch.m.compose(scratch.p, scratch.q, scratch.s);
            im.setMatrixAt(i, scratch.m);
          }
          im.instanceMatrix.needsUpdate = true;
        }
        builtRef.current = true;
        onBuildComplete?.();
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
    </group>
  );
}
