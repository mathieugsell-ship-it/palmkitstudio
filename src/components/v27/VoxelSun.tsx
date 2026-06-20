// The SUN (scenery, v26). Deliberately NOT a voxel: a sun is light, not matter,
// so blocks never read (flat → candy, solid → a cube). Instead it's the one
// luminous element in the voxel world — a soft, round glowing disc: a warm
// golden core easing out into a gentle halo, billboarded low on the LEFT
// horizon behind the scene. That light-vs-blocks contrast is the point; it
// reads instantly as a sun and anchors the warm side of the dawn. It fades in
// with the build, then holds. Modest, tasteful, no harsh neon. Maps to Growth.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PalmConfig } from './config';

// Placement (tunable): low on the horizon, well to the LEFT (clear of the palm
// fronds), far back behind the sea.
const SUN_POS: [number, number, number] = [-13, 1.0, -11];
const PLANE = 5.4; // billboard size — the glow halo reaches the plane edge (transparent)

const smooth = (x: number) => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

export function VoxelSun({ config, reducedMotion }: { config: PalmConfig; reducedMotion: boolean }) {
  const c = config.colors;
  const duration = config.build.duration;
  const { camera } = useThree();

  // Soft radial sun: a defined warm core disc easing out into a transparent
  // halo. One smooth gradient — no blocks, no internal pattern, no hard rim.
  const texture = useMemo(() => {
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    const core = new THREE.Color(c.sunCore);
    const mid = new THREE.Color(c.sunMid);
    const halo = new THREE.Color(c.sunHalo);
    const rgba = (col: THREE.Color, a: number) =>
      `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
    // Solid-ish core out to ~0.32, soft disc edge, then a long gentle halo tail.
    g.addColorStop(0.0, rgba(core, 1.0));
    g.addColorStop(0.26, rgba(core, 0.97));
    g.addColorStop(0.36, rgba(mid, 0.78)); // disc shoulder
    g.addColorStop(0.46, rgba(mid, 0.34)); // soft outer edge of the disc
    g.addColorStop(0.66, rgba(halo, 0.12)); // halo
    g.addColorStop(0.85, rgba(halo, 0.03));
    g.addColorStop(1.0, rgba(halo, 0.0)); // fully transparent at the plane edge
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [c.sunCore, c.sunMid, c.sunHalo]);

  const geo = useMemo(() => new THREE.PlaneGeometry(PLANE, PLANE), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false, // stays luminous (it's the light, not a lit surface)
        opacity: reducedMotion ? 1 : 0,
      }),
    [texture, reducedMotion],
  );

  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(reducedMotion ? duration : 0);
  const builtRef = useRef(reducedMotion);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      texture.dispose();
    },
    [geo, mat, texture],
  );

  useFrame((_, delta) => {
    // Always billboard toward the camera so the disc stays perfectly round.
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion);
    if (builtRef.current) return;
    elapsed.current += delta;
    const p = Math.min(elapsed.current / duration, 1);
    // Glow swells in gently with the world, a touch after the edges start.
    mat.opacity = smooth((p - 0.4) / 0.34);
    if (p >= 1) {
      mat.opacity = 1;
      builtRef.current = true;
    }
  });

  return <mesh ref={meshRef} geometry={geo} material={mat} position={SUN_POS} />;
}
