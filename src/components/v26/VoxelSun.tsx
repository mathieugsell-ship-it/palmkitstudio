// Voxel SUN on the horizon (scenery, v26). A clean, solid filled blocky DISC
// that reads as a soft warm sun — no internal cross/grid pattern: one instanced
// mesh, smooth warm gradient (brighter core → peach edge), a few short ray
// blocks around the rim, and a faint soft halo. Flat UNLIT (it's a light source)
// so it glows softly against the dawn without harsh bloom. Billboarded to face
// the camera (stays round, re-faces under the mobile CameraRig). It BUILDS IN
// with the scene — its blocks assemble from points outward over the build
// window — instead of popping in pre-made. Static once built. Maps to Growth.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PalmConfig } from './config';

// Placement (tunable): low on the horizon, center-left, far back behind the sea.
const SUN_POS: [number, number, number] = [-10, 0.6, -11];
const SUN_R = 1.85; // world radius — big enough to read, still modest
const CELL = 0.46; // chunky voxel cell

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

export function VoxelSun({ config, reducedMotion }: { config: PalmConfig; reducedMotion: boolean }) {
  const c = config.colors;
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  const duration = config.build.duration;

  // Blocks: the filled disc + a few short rim rays. Each gets a smooth warm
  // colour (no hard tiers → no cross) and a staggered reveal (centre → out).
  const cells = useMemo(() => {
    const core = new THREE.Color(c.sunCore);
    const mid = new THREE.Color(c.sunMid);
    const edge = new THREE.Color(c.sunEdge);
    const out: { u: number; v: number; color: THREE.Color; reveal: number }[] = [];
    const m = Math.ceil(SUN_R / CELL);
    for (let i = -m; i <= m; i++)
      for (let j = -m; j <= m; j++) {
        const u = i * CELL;
        const v = j * CELL;
        const r = Math.hypot(u, v);
        if (r > SUN_R - CELL * 0.25) continue; // blocky circle
        const t = r / SUN_R;
        const col = core.clone().lerp(mid, smooth(t)); // smooth, brighter core
        out.push({ u, v, color: col, reveal: 0.45 + 0.4 * t });
      }
    // short rim rays (8 directions)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rr = SUN_R + CELL * 0.55;
      out.push({ u: rr * Math.cos(a), v: rr * Math.sin(a), color: edge.clone(), reveal: 0.86 });
    }
    return out;
  }, [c.sunCore, c.sunMid, c.sunEdge]);

  const count = cells.length;
  const cubeGeo = useMemo(() => new THREE.BoxGeometry(CELL * 0.99, CELL * 0.99, CELL * 0.5), []);
  const cubeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    [],
  );
  const haloGeo = useMemo(() => new THREE.CircleGeometry(SUN_R * 1.6, 40), []);
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c.sunHalo),
        toneMapped: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [c.sunHalo],
  );

  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }),
    [],
  );
  const elapsed = useRef(reducedMotion ? duration : 0);
  const builtRef = useRef(reducedMotion);

  // Colours once; initial matrices (full if reduced-motion, else collapsed).
  useLayoutEffect(() => {
    const im = meshRef.current;
    if (!im) return;
    for (let i = 0; i < count; i++) im.setColorAt(i, cells[i].color);
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    const full = reducedMotion;
    for (let i = 0; i < count; i++) {
      scratch.p.set(cells[i].u, cells[i].v, 0);
      scratch.s.setScalar(full ? 1 : 0.0001);
      scratch.m.compose(scratch.p, scratch.q, scratch.s);
      im.setMatrixAt(i, scratch.m);
    }
    im.instanceMatrix.needsUpdate = true;
    haloMat.opacity = full ? 0.14 : 0;
  }, [cells, count, reducedMotion, scratch, haloMat]);

  useEffect(
    () => () => {
      cubeGeo.dispose();
      cubeMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
    },
    [cubeGeo, cubeMat, haloGeo, haloMat],
  );

  useFrame((_, delta) => {
    // Billboard: always face the camera (round, re-faces under CameraRig).
    if (groupRef.current) groupRef.current.lookAt(camera.position);

    if (builtRef.current) return;
    const im = meshRef.current;
    if (!im) return;
    elapsed.current += delta;
    const p = Math.min(elapsed.current / duration, 1);
    const win = 0.16;
    for (let i = 0; i < count; i++) {
      const s = smooth((p - cells[i].reveal) / win); // grows from a point → full
      scratch.p.set(cells[i].u, cells[i].v, 0);
      scratch.s.setScalar(Math.max(s, 0.0001));
      scratch.m.compose(scratch.p, scratch.q, scratch.s);
      im.setMatrixAt(i, scratch.m);
    }
    im.instanceMatrix.needsUpdate = true;
    haloMat.opacity = 0.14 * smooth((p - 0.55) / 0.3);
    if (p >= 1) {
      for (let i = 0; i < count; i++) {
        scratch.p.set(cells[i].u, cells[i].v, 0);
        scratch.s.setScalar(1);
        scratch.m.compose(scratch.p, scratch.q, scratch.s);
        im.setMatrixAt(i, scratch.m);
      }
      im.instanceMatrix.needsUpdate = true;
      haloMat.opacity = 0.14;
      builtRef.current = true;
    }
  });

  return (
    <group ref={groupRef} position={SUN_POS} renderOrder={-2}>
      <mesh ref={haloRef} geometry={haloGeo} material={haloMat} position={[0, 0, 0.25]} renderOrder={-3} />
      <instancedMesh ref={meshRef} args={[cubeGeo, cubeMat, count]} renderOrder={-2} frustumCulled={false} />
    </group>
  );
}
