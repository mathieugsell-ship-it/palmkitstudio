// PalmTreeHero — the single React island for STEP 1.
// One Canvas: white scene, soft layered light, baked contact shadow, selective
// bloom on the glowing dots, slow delta-based idle rotation, and the full
// accessibility/performance contract from CLAUDE.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PalmTree } from './PalmTree';
import { IslandBase } from './IslandBase';
import { WaterBase } from './WaterBase';
import { DEFAULT_CONFIG, type PalmConfig } from './config';

// ---- small media hooks -----------------------------------------------------
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** True while the canvas is on-screen and the tab is visible. */
function useVisible(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = true;
    const sync = () => setVisible(onScreen && !document.hidden);
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        sync();
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ref]);
  return visible;
}

// ---- in-canvas helpers -----------------------------------------------------
function IdleRotation({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && ref.current) ref.current.rotation.y += delta * 0.18; // framerate-independent
  });
  return <group ref={ref}>{children}</group>;
}

/** In demand frameloop, request a render when interaction state changes. */
function DemandInvalidate({ trigger }: { trigger: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [trigger, invalidate]);
  return null;
}

// ---- WebGL-unavailable fallback -------------------------------------------
function NoWebGL({ config }: { config: PalmConfig }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-700">Palmkit Studio</p>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {config.hotspots.map((h) => (
            <li key={h.id}>{h.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---- main island -----------------------------------------------------------
export default function PalmTreeHero({ config = DEFAULT_CONFIG }: { config?: PalmConfig }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const noHover = useMediaQuery('(hover: none)');
  const visible = useVisible(wrapRef);

  // Selective bloom only on capable desktop; emissive-only fallback otherwise.
  const bloomEnabled = !reducedMotion && !noHover;
  // Rotation runs only when visible and motion is allowed.
  const rotate = visible && !reducedMotion;
  const frameloop: 'always' | 'demand' = reducedMotion || !visible ? 'demand' : 'always';

  // Soft sunrise backdrop — a DOM gradient BEHIND the transparent canvas, so it
  // never rotates with the scene and stays cheap: near-white sky warming to
  // peach at the bottom + a diffuse sun-halo glow low on one side.
  const dawnBg = useMemo(() => {
    const c = config.colors;
    const rgba = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    return [
      // Sun halo: warm core low-left, easing to transparent peach (no hard disc).
      `radial-gradient(60% 52% at 20% 88%, ${c.haloCore} 0%, ${rgba(c.haloMid, 0.55)} 26%, ${rgba(c.haloMid, 0)} 60%)`,
      // Sky: near-white top, gentle warm wash toward the bottom.
      `linear-gradient(180deg, ${c.skyTop} 0%, ${c.skyTop} 50%, ${c.skyWarm} 100%)`,
    ].join(', ');
  }, [config.colors]);

  return (
    <div ref={wrapRef} className="h-full w-full" style={{ background: dawnBg }}>
      <Canvas
        flat
        shadows={false}
        dpr={[1, 2]}
        frameloop={frameloop}
        camera={{ position: [5.9, 3.9, 9.3], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#000000', 0); // transparent → the dawn gradient shows through
          camera.lookAt(0.1, 1.05, 0); // frame palm + island + surrounding water
        }}
        fallback={<NoWebGL config={config} />}
      >
        <DemandInvalidate trigger={reducedMotion} />

        {/* Dawn lighting: soft neutral fill + a WARM raking key from the sun
            side (low-left), so the palm gets a warm lit side and belongs to the
            sunrise. Ambient/fill keep the shadow side gentle. */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={0.5} />
        <directionalLight position={[-5.5, 2.2, 3.8]} intensity={0.7} color={config.colors.warmKey} />
        <directionalLight position={[-5, 3, -3]} intensity={0.16} />

        {/* Whole scene (palm + island + water) rotates together. */}
        <IdleRotation enabled={rotate}>
          <PalmTree config={config} bloom={bloomEnabled} pulse={rotate} />
          <IslandBase config={config} />
          {/* Ripple animates only when motion is allowed + on-screen. */}
          <WaterBase config={config} animate={rotate} />
        </IdleRotation>

        {/* Soft contact shadow, nudged toward the shadow side (away from the
            low-left sun) so it reads consistently with the warm key. */}
        <ContactShadows
          position={[0.35, 0, -0.15]}
          scale={6}
          far={4}
          blur={2.8}
          opacity={0.28}
          frames={1}
          color="#4a3f33"
          resolution={512}
        />

        {/* Selective bloom: only the >1 emissive dots glow; white stays white. */}
        {bloomEnabled && (
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={0.85} radius={0.26} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
