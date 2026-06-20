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
