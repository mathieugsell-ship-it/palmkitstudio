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
  // STEP 7 hybrid hero: the service↔node link.
  activeId?: string | null; // which service node is illuminated (coral)
  onNodeEnter?: (id: string) => void; // hover a palm node → highlight its service
  onNodeLeave?: (id: string) => void;
}

export function SceneBuild({
  config,
  bloom,
  pulse,
  animate,
  reducedMotion,
  onBuildComplete,
  activeId = null,
  onNodeEnter,
  onNodeLeave,
}: Props) {
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

  // ---- service highlight nodes (STEP 7) -------------------------------------
  // A coral glow marker at each reserved anchor, HIDDEN at rest (opacity/scale 0)
  // so the validated scene is unchanged, lit only when its service is active.
  // An invisible hit-sphere per anchor lets hovering a palm node light its
  // service in the list (reverse direction).
  const anchorGeo = useMemo(() => new THREE.SphereGeometry(0.07, 14, 14), []);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(0.22, 10, 10), []);
  const hitMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const anchorMats = useMemo(
    () =>
      scene.anchors.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(config.colors.hotspot),
            emissive: new THREE.Color(config.colors.hotspot),
            emissiveIntensity: 0,
            toneMapped: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            metalness: 0,
            roughness: 0.4,
          }),
      ),
    [scene, config.colors.hotspot],
  );
  const anchorRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(
    () => () => {
      faceGeoms.forEach((g) => g.dispose());
      edgeGeoms.forEach((g) => g.dispose());
      faceMats.forEach((m) => m.dispose());
      edgeMats.forEach((m) => m.dispose());
      pointGeo.dispose();
      pointMat.dispose();
      anchorGeo.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      anchorMats.forEach((m) => m.dispose());
    },
    [faceGeoms, edgeGeoms, faceMats, edgeMats, pointGeo, pointMat, anchorGeo, hitGeo, hitMat, anchorMats],
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

    // ---- service highlight nodes: ease the active one in (coral glow) -------
    const k = reducedMotion ? 1 : 1 - Math.pow(0.0015, delta); // frame-rate independent
    const onEmis = bloom ? 3.4 : 1.7; // >1 → blooms on desktop
    const wob = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06; // gentle live pulse
    for (let i = 0; i < scene.anchors.length; i++) {
      const mesh = anchorRefs.current[i];
      if (!mesh) continue;
      const on = scene.anchors[i].id === activeId;
      const mat = anchorMats[i];
      mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, on ? 1 : 0.0001, k));
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, on ? 1 : 0, k);
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, on ? onEmis * wob : 0, k);
    }
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

      {/* Service highlight nodes: invisible hit-sphere (hover → light the list)
          + coral glow marker (hidden at rest, lit when its service is active). */}
      {scene.anchors.map((a, i) => (
        <group key={a.id} position={a.position}>
          <mesh
            geometry={hitGeo}
            material={hitMat}
            onPointerOver={(e) => {
              e.stopPropagation();
              onNodeEnter?.(a.id);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              onNodeLeave?.(a.id);
            }}
          />
          <mesh
            ref={(el) => {
              anchorRefs.current[i] = el;
            }}
            geometry={anchorGeo}
            material={anchorMats[i]}
            scale={0.0001}
            raycast={() => null}
          />
        </group>
      ))}
    </group>
  );
}
