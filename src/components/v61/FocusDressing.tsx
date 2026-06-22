// FocusDressing — v61 premium "showroom" dressing for a FOCUSED object.
//
// Renders only while an object is in focus (driven by easeRef) and fades in/out
// with the focus transition. It is GENERIC: give it the focused object's pivot
// (its AABB centre), its base Y + radius/height, the live glide vector + ease
// refs and the focus scale, and it presents that object on a soft glowing base
// with a gentle warm halo and fine golden particles drifting slowly around it.
//
// Cheap by design: a couple of additive radial-gradient planes + one small
// THREE.Points field (≤ cap), all updated in ONE delta-time useFrame that early-
// outs (group hidden, no work) whenever the object is not in focus.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface FocusDressingProps {
  center: THREE.Vector3; // pivot (object AABB centre) at REST
  baseY: number; // object's base (AABB min Y) at REST
  radius: number; // object half-width (for disc + particle spread)
  height: number; // object height (for particle column)
  scale: number; // focus upscale (dressing scales with the object)
  glideRef: React.RefObject<THREE.Vector3>; // live world glide to the focus slot
  easeRef: React.RefObject<number>; // 0→1 focus amount
  colors: { haloCore: string; haloMid: string; sunHalo: string };
  reducedMotion: boolean;
  count?: number; // particle cap (default 48; halved on phones by the caller)
}

// Small soft radial sprite/halo texture (white core → transparent), tinted per use.
function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function FocusDressing({ center, baseY, radius, height, scale, glideRef, easeRef, colors, reducedMotion, count = 48 }: FocusDressingProps) {
  const group = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const discMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const pedMat = useRef<THREE.MeshStandardMaterial>(null);
  const pedEdgeMat = useRef<THREE.LineBasicMaterial>(null);
  const ptsMat = useRef<THREE.PointsMaterial>(null);
  const camera = useThree((s) => s.camera);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const haloY = height * 0.52; // back-halo height (about the crown)

  // ---- textures (warm dawn palette), created once --------------------------
  const discTex = useMemo(
    () => radialTexture([[0, 'rgba(255,244,224,0.95)'], [0.45, 'rgba(255,220,166,0.5)'], [1, 'rgba(255,220,166,0)']]),
    [],
  );
  const haloTex = useMemo(
    () => radialTexture([[0, 'rgba(255,236,206,0.85)'], [0.5, 'rgba(255,210,150,0.28)'], [1, 'rgba(255,210,150,0)']]),
    [],
  );
  const dotTex = useMemo(
    () => radialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,236,200,0.7)'], [1, 'rgba(255,236,200,0)']]),
    [],
  );

  // ---- particle field: base positions + per-dot drift params ---------------
  const particles = useMemo(() => {
    const n = Math.max(8, count);
    const base = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const sway = new Float32Array(n);
    const rise = new Float32Array(n);
    const R = radius * 1.05;
    const H = height * 1.04;
    for (let i = 0; i < n; i++) {
      // ring-biased so dust hugs the silhouette, not a dense cylinder core
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.35 + 0.65 * Math.sqrt(Math.random()));
      base[i * 3] = Math.cos(a) * r;
      base[i * 3 + 1] = Math.random() * H; // start height (also the wrap span)
      base[i * 3 + 2] = Math.sin(a) * r;
      phase[i] = Math.random() * Math.PI * 2;
      sway[i] = 0.06 + Math.random() * 0.12; // horizontal sway amplitude
      rise[i] = 0.05 + Math.random() * 0.07; // slow upward drift speed
    }
    return { n, base, phase, sway, rise, H };
  }, [count, radius, height]);

  const ptsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(particles.base.slice(), 3));
    return g;
  }, [particles]);

  // ---- low voxel pedestal geometry (one slim slab, on-style) ---------------
  const pedSize = useMemo<[number, number, number]>(() => [radius * 1.5, 0.18, radius * 1.5], [radius]);
  const pedGeo = useMemo(() => new THREE.BoxGeometry(pedSize[0], pedSize[1], pedSize[2]), [pedSize]);
  const pedEdge = useMemo(() => new THREE.EdgesGeometry(pedGeo, 15), [pedGeo]);

  useEffect(
    () => () => {
      discTex.dispose(); haloTex.dispose(); dotTex.dispose();
      ptsGeo.dispose(); pedGeo.dispose(); pedEdge.dispose();
    },
    [discTex, haloTex, dotTex, ptsGeo, pedGeo, pedEdge],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const ease = easeRef.current ?? 0;
    if (ease < 0.002) { if (g.visible) g.visible = false; return; } // paused when not in focus
    g.visible = true;

    // follow the focused object to its (glided, scaled) showroom slot
    const glide = glideRef.current;
    g.scale.setScalar(scale);
    g.position.set(
      center.x + (glide?.x ?? 0) * ease,
      center.y + scale * (baseY - center.y) + (glide?.y ?? 0) * ease,
      center.z + (glide?.z ?? 0) * ease,
    );

    // fade everything with the focus amount (kept subtle/premium)
    if (discMat.current) discMat.current.opacity = 0.62 * ease;
    if (haloMat.current) haloMat.current.opacity = 0.3 * ease;
    if (pedMat.current) pedMat.current.opacity = 0.9 * ease;
    if (pedEdgeMat.current) pedEdgeMat.current.opacity = 0.5 * ease;
    if (ptsMat.current) ptsMat.current.opacity = 0.6 * ease;

    // back halo: billboard it AND push it just behind the object centre, so the
    // transparency sort draws it under the palm (a soft glow around the silhouette).
    if (haloRef.current) {
      const dir = tmp.set(g.position.x, g.position.y + scale * haloY, g.position.z).sub(camera.position);
      if (dir.lengthSq() > 1e-6) dir.normalize();
      const push = radius * 1.4;
      haloRef.current.position.set((dir.x * push) / scale, haloY + (dir.y * push) / scale, (dir.z * push) / scale);
      haloRef.current.quaternion.copy(camera.quaternion);
    }

    // drift the dust: gentle horizontal sway + slow wrapping upward rise
    const t = state.clock.elapsedTime;
    const attr = ptsGeo.getAttribute('position') as THREE.BufferAttribute;
    const { n, base, phase, sway, rise, H } = particles;
    for (let i = 0; i < n; i++) {
      const ph = phase[i];
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      if (reducedMotion) {
        attr.setXYZ(i, bx, by, bz);
      } else {
        const yr = (by + t * rise[i]) % H; // wrap within the column → endless gentle rise
        attr.setXYZ(i, bx + Math.sin(t * 0.5 + ph) * sway[i], yr, bz + Math.cos(t * 0.42 + ph) * sway[i]);
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <group ref={group} visible={false}>
      {/* soft glowing disc on the ground (the base/halo the object stands on).
          Normal blending (not additive) so the warm pool reads on the near-white
          dawn background instead of washing out. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} raycast={() => null}>
        <planeGeometry args={[radius * 3.4, radius * 3.4]} />
        <meshBasicMaterial ref={discMat} map={discTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* low voxel pedestal — slim, on-style, presents the object on something */}
      <mesh geometry={pedGeo} position={[0, -pedSize[1] / 2, 0]} raycast={() => null}>
        <meshStandardMaterial ref={pedMat} color={'#cdbfa6'} flatShading metalness={0} roughness={0.9} transparent opacity={0} depthWrite={false} />
        <lineSegments geometry={pedEdge}>
          <lineBasicMaterial ref={pedEdgeMat} color={'#8d8068'} transparent opacity={0} toneMapped={false} />
        </lineSegments>
      </mesh>

      {/* soft warm back halo (billboard) — adds depth behind the object */}
      <mesh ref={haloRef} position={[0, haloY, 0]} raycast={() => null}>
        <planeGeometry args={[radius * 4.6, height * 1.5]} />
        <meshBasicMaterial ref={haloMat} map={haloTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* fine golden dust drifting in the light (normal blend → visible on white) */}
      <points geometry={ptsGeo} raycast={() => null}>
        <pointsMaterial ref={ptsMat} map={dotTex} color={colors.sunHalo} size={0.075} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}
