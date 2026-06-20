// Voxel SUN on the horizon (scenery, v26). A REAL 3D voxel object — a chunky
// ball of full-depth cubes with lit faces (MeshStandard + flatShading, so it
// catches the dawn light and shows facet relief like the palm/rocks), the same
// thin settle edges, and a warm golden albedo + gentle emissive so it reads as a
// glowing sun that belongs to the same world (not a flat sprite). It builds in
// with the scene (edges trace → faces fill, blocks grow centre→out). Sits low,
// center-left, far back. Static once built. No glowing teal nodes. Maps to Growth.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PalmConfig } from './config';

// Placement (tunable): low on the horizon, center-left, far back behind the sea.
const SUN_POS: [number, number, number] = [-10, 0.8, -11];
const SUN_R = 1.5; // world radius — modest
const CELL = 0.6; // chunky voxel cell (real cube, full depth)

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

export function VoxelSun({ config, reducedMotion }: { config: PalmConfig; reducedMotion: boolean }) {
  const c = config.colors;
  const duration = config.build.duration;
  const FACE_OPACITY = 0.96;
  const EDGE_OPACITY = 0.6;

  // Voxel ball: filled cubes within the radius (a real 3-D sphere of blocks).
  // tier 0 = brighter core, tier 1 = warmer rim; o01 = reveal order (centre→out).
  const cells = useMemo(() => {
    const out: { pos: [number, number, number]; tier: number; o01: number }[] = [];
    const m = Math.ceil(SUN_R / CELL);
    for (let i = -m; i <= m; i++)
      for (let j = -m; j <= m; j++)
        for (let k = -m; k <= m; k++) {
          const u = i * CELL;
          const v = j * CELL;
          const w = k * CELL;
          const r = Math.hypot(u, v, w);
          if (r > SUN_R) continue;
          out.push({ pos: [u, v, w], tier: r < SUN_R * 0.52 ? 0 : 1, o01: r / SUN_R });
        }
    return out;
  }, []);

  const cubeGeo = useMemo(() => new THREE.BoxGeometry(CELL * 0.97, CELL * 0.97, CELL * 0.97), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(cubeGeo, 15), [cubeGeo]);
  const faceMats = useMemo(
    () =>
      [
        { col: c.sunCore, emi: 0.5 },
        { col: c.sunMid, emi: 0.36 },
      ].map(
        (t) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(t.col),
            emissive: new THREE.Color(t.col),
            emissiveIntensity: t.emi, // gentle self-glow on top of the lighting
            flatShading: true,
            metalness: 0,
            roughness: 0.7,
            transparent: true,
            opacity: reducedMotion ? FACE_OPACITY : 0,
            depthWrite: false,
          }),
      ),
    [c.sunCore, c.sunMid, reducedMotion],
  );
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(c.edgeFinal), // same thin settle edges as the scene
        toneMapped: false,
        transparent: true,
        opacity: reducedMotion ? EDGE_OPACITY : 0,
      }),
    [c.edgeFinal, reducedMotion],
  );

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const elapsed = useRef(reducedMotion ? duration : 0);
  const builtRef = useRef(reducedMotion);

  useEffect(
    () => () => {
      cubeGeo.dispose();
      edgeGeo.dispose();
      faceMats.forEach((m) => m.dispose());
      edgeMat.dispose();
    },
    [cubeGeo, edgeGeo, faceMats, edgeMat],
  );

  useLayoutEffect(() => {
    for (const mesh of meshRefs.current) mesh?.scale.setScalar(reducedMotion ? 1 : 0.0001);
  }, [reducedMotion, cells]);

  useFrame((_, delta) => {
    if (builtRef.current) return;
    elapsed.current += delta;
    const p = Math.min(elapsed.current / duration, 1);
    const win = 0.16;
    // Edges trace in first, then the faces fill (echoing the scene's build).
    edgeMat.opacity = smooth((p - 0.42) / 0.2) * EDGE_OPACITY;
    const fo = smooth((p - 0.52) / 0.26) * FACE_OPACITY;
    faceMats.forEach((m) => (m.opacity = fo));
    for (let i = 0; i < cells.length; i++) {
      const s = smooth((p - (0.45 + 0.3 * cells[i].o01)) / win); // grow centre→out
      meshRefs.current[i]?.scale.setScalar(Math.max(s, 0.0001));
    }
    if (p >= 1) {
      for (const mesh of meshRefs.current) mesh?.scale.setScalar(1);
      faceMats.forEach((m) => (m.opacity = FACE_OPACITY));
      edgeMat.opacity = EDGE_OPACITY;
      builtRef.current = true;
    }
  });

  return (
    <group position={SUN_POS}>
      {cells.map((cell, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          geometry={cubeGeo}
          material={faceMats[cell.tier]}
          position={cell.pos}
          scale={0.0001}
        >
          <lineSegments geometry={edgeGeo} material={edgeMat} />
        </mesh>
      ))}
    </group>
  );
}
