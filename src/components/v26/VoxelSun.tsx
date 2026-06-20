// Voxel SUN on the horizon (scenery, v26). A chunky billboarded voxel disc that
// reads as a soft, warm rising sun low on the left/center-left — balancing the
// pitons on the back-right and anchoring the dawn light. Flat UNLIT warm faces
// (it's a light source) + thin warm edges (voxel style) + a faint soft halo;
// luminous but not a harsh neon disc. Sits far back behind the scene, billboarded
// to face the camera so it stays round. Static; no glowing nodes. Maps to Growth.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PalmConfig } from './config';

// Placement (tunable): low on the horizon, center-left, far back behind the sea.
const SUN_POS: [number, number, number] = [-10, 0.6, -11];
const SUN_R = 1.85; // world radius — big enough to read, still modest
const CELL = 0.46; // chunky voxel cell

export function VoxelSun({ config }: { config: PalmConfig }) {
  const c = config.colors;
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  // Blocky disc cells (in the billboard's local u,v plane), tiered by radius.
  const cells = useMemo(() => {
    const out: { pos: [number, number, number]; tier: number }[] = [];
    const m = Math.ceil(SUN_R / CELL);
    for (let i = -m; i <= m; i++)
      for (let j = -m; j <= m; j++) {
        const u = i * CELL;
        const v = j * CELL;
        const r = Math.hypot(u, v);
        if (r > SUN_R - CELL * 0.25) continue; // blocky circle edge
        const t = r / SUN_R;
        out.push({ pos: [u, v, 0], tier: t < 0.34 ? 0 : t < 0.7 ? 1 : 2 });
      }
    return out;
  }, []);

  const cubeGeo = useMemo(() => new THREE.BoxGeometry(CELL * 0.98, CELL * 0.98, CELL * 0.5), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(cubeGeo, 15), [cubeGeo]);
  const mats = useMemo(
    () =>
      [c.sunCore, c.sunMid, c.sunEdge].map(
        (hex) =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(hex),
            toneMapped: false,
            transparent: true,
            opacity: 0.96,
            side: THREE.DoubleSide,
          }),
      ),
    [c.sunCore, c.sunMid, c.sunEdge],
  );
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(c.sunEdgeLine),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    [c.sunEdgeLine],
  );
  const haloGeo = useMemo(() => new THREE.CircleGeometry(SUN_R * 1.6, 40), []);
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c.sunHalo),
        toneMapped: false,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [c.sunHalo],
  );

  useEffect(
    () => () => {
      cubeGeo.dispose();
      edgeGeo.dispose();
      mats.forEach((m) => m.dispose());
      edgeMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
    },
    [cubeGeo, edgeGeo, mats, edgeMat, haloGeo, haloMat],
  );

  // Billboard: face the camera each frame (also handles the mobile CameraRig).
  useFrame(() => {
    if (groupRef.current) groupRef.current.lookAt(camera.position);
  });

  return (
    <group ref={groupRef} position={SUN_POS} renderOrder={-2}>
      {/* soft halo, just behind the disc */}
      <mesh geometry={haloGeo} material={haloMat} position={[0, 0, 0.25]} renderOrder={-3} />
      {cells.map((cell, i) => (
        <mesh key={i} geometry={cubeGeo} material={mats[cell.tier]} position={cell.pos} renderOrder={-2}>
          <lineSegments geometry={edgeGeo} material={edgeMat} />
        </mesh>
      ))}
    </group>
  );
}
