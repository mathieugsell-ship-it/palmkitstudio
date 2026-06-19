// The palm — with the "construction" build-in animation (STEP 5).
//
// Three ADDRESSABLE LAYERS assemble on one normalized 0→1 timeline:
//   POINTS  → instanced vertex dots, per-instance SCALE pop-in
//   EDGES   → per-block wireframe, opacity fade + a small block "grow" (snap)
//   FACES   → per-block translucent face, opacity fade-in (fills in last)
// Each element's start time = phaseBase[layer] + heightStagger·h (bottom→top),
// revealed over a smooth window. One useFrame drives the whole thing; geometry
// and materials are created ONCE (no per-frame recreation). The END STATE is
// identical to the validated palm. Reduced-motion → render finished instantly.
//
// (VertexDots.tsx is kept in this folder for the service-hotspot points we'll
// add at the very end; the build uses its own instanced layer here.)
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildPalm } from './layout';
import type { PalmConfig } from './config';

interface PalmTreeProps {
  config: PalmConfig;
  bloom: boolean;
  /** Allowed pulse (visible && !reduced-motion) — applied only AFTER the build. */
  pulse: boolean;
  reducedMotion: boolean;
  onBuildComplete?: () => void;
}

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

export function PalmTree({ config, bloom, pulse, reducedMotion, onBuildComplete }: PalmTreeProps) {
  const { colors } = config;
  const model = useMemo(() => buildPalm(config), [config]);
  const edgeBoost = bloom ? 2.5 : 1.0;
  const emissiveBase = bloom ? 2.1 : 1.1;
  const emissiveAmp = bloom ? 0.18 : 0.08;

  // Top of the palm → normalizes the bottom-to-top height stagger.
  const palmTop = useMemo(() => {
    let m = 0.001;
    for (const b of model.blocks) m = Math.max(m, b.position[1] + b.size[1] / 2);
    for (const v of model.vertices) m = Math.max(m, v[1]);
    return m;
  }, [model]);

  // Per-element start times (precomputed once).
  const timing = useMemo(() => {
    const b = config.build;
    const so = (h: number, base: number) => base + b.heightStagger * Math.min(Math.max(h, 0), 1);
    return {
      faceStart: model.blocks.map((bl) => so(bl.position[1] / palmTop, b.facesAt)),
      edgeStart: model.blocks.map((bl) => so(bl.position[1] / palmTop, b.edgesAt)),
      pointStart: model.vertices.map((v) => so(v[1] / palmTop, 0)),
    };
  }, [model, palmTop, config.build]);

  // ---- geometry + materials, created ONCE; opacity driven imperatively so
  // React re-renders never reset the animated values. -----------------------
  const initFace = reducedMotion ? config.faceOpacity : 0;
  const initEdge = reducedMotion ? 0.95 : 0;

  const faceGeoms = useMemo(
    () => model.blocks.map((b) => new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2])),
    [model],
  );
  const edgeGeoms = useMemo(() => faceGeoms.map((g) => new THREE.EdgesGeometry(g, 15)), [faceGeoms]);
  const faceMats = useMemo(
    () =>
      model.blocks.map(
        (b) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(b.color),
            flatShading: true,
            metalness: 0,
            roughness: 0.85,
            transparent: true,
            opacity: initFace,
            depthWrite: false,
          }),
      ),
    [model, initFace],
  );
  const edgeColor = useMemo(
    () => new THREE.Color(colors.edge).multiplyScalar(edgeBoost),
    [colors.edge, edgeBoost],
  );
  const edgeMats = useMemo(
    () =>
      model.blocks.map(
        () => new THREE.LineBasicMaterial({ color: edgeColor, toneMapped: false, transparent: true, opacity: initEdge }),
      ),
    [model, edgeColor, initEdge],
  );
  const pointGeo = useMemo(() => new THREE.SphereGeometry(0.015, 8, 8), []);
  const pointMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.vertex),
        emissive: new THREE.Color(colors.vertex),
        emissiveIntensity: emissiveBase,
        toneMapped: false,
        transparent: true,
        opacity: 0.95,
        metalness: 0,
        roughness: 0.4,
      }),
    [colors.vertex, emissiveBase],
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

  // ---- refs + build state --------------------------------------------------
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pointsRef = useRef<THREE.InstancedMesh>(null);
  const builtRef = useRef(reducedMotion); // reduced-motion → already "built"
  const elapsedRef = useRef(reducedMotion ? config.build.duration : 0);
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }),
    [],
  );

  // Initialise point instances: scale 0 while building (1 if reduced-motion).
  useLayoutEffect(() => {
    const im = pointsRef.current;
    if (!im) return;
    const s0 = reducedMotion ? 1 : 0.0001;
    for (let i = 0; i < model.vertices.length; i++) {
      scratch.p.set(model.vertices[i][0], model.vertices[i][1], model.vertices[i][2]);
      scratch.s.setScalar(s0);
      scratch.m.compose(scratch.p, scratch.q, scratch.s);
      im.setMatrixAt(i, scratch.m);
    }
    im.instanceMatrix.needsUpdate = true;
  }, [model, reducedMotion, scratch]);

  useFrame((state, delta) => {
    const b = config.build;

    // ---- build phase (skipped entirely once built / reduced-motion) -------
    if (!builtRef.current && !reducedMotion) {
      elapsedRef.current += delta;
      const p = Math.min(elapsedRef.current / b.duration, 1);
      const win = b.revealWin;

      for (let j = 0; j < model.blocks.length; j++) {
        const ea = smooth((p - timing.edgeStart[j]) / win);
        const fa = smooth((p - timing.faceStart[j]) / win);
        faceMats[j].opacity = fa * config.faceOpacity;
        edgeMats[j].opacity = ea * 0.95;
        meshRefs.current[j]?.scale.setScalar(0.94 + 0.06 * ea); // edges fade + grow
      }

      const im = pointsRef.current;
      if (im) {
        for (let i = 0; i < model.vertices.length; i++) {
          const a = smooth((p - timing.pointStart[i]) / win);
          scratch.p.set(model.vertices[i][0], model.vertices[i][1], model.vertices[i][2]);
          scratch.s.setScalar(Math.max(a, 0.0001));
          scratch.m.compose(scratch.p, scratch.q, scratch.s);
          im.setMatrixAt(i, scratch.m);
        }
        im.instanceMatrix.needsUpdate = true;
      }

      if (p >= 1) {
        // Snap to exact final state, then hand off to idle.
        for (let j = 0; j < model.blocks.length; j++) {
          faceMats[j].opacity = config.faceOpacity;
          edgeMats[j].opacity = 0.95;
          meshRefs.current[j]?.scale.setScalar(1);
        }
        if (im) {
          for (let i = 0; i < model.vertices.length; i++) {
            scratch.p.set(model.vertices[i][0], model.vertices[i][1], model.vertices[i][2]);
            scratch.s.setScalar(1);
            scratch.m.compose(scratch.p, scratch.q, scratch.s);
            im.setMatrixAt(i, scratch.m);
          }
          im.instanceMatrix.needsUpdate = true;
        }
        builtRef.current = true;
        onBuildComplete?.();
      }
    }

    // ---- ongoing point pulse (cheap; only after build) --------------------
    pointMat.emissiveIntensity =
      builtRef.current && pulse ? emissiveBase + Math.sin(state.clock.elapsedTime * 2.2) * emissiveAmp : emissiveBase;
  });

  return (
    <group>
      {model.blocks.map((b, j) => (
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
      <instancedMesh ref={pointsRef} args={[pointGeo, pointMat, model.vertices.length]} frustumCulled={false} />
    </group>
  );
}
