// PalmTreeHero — the single React island for STEP 1.
// One Canvas: white scene, soft layered light, baked contact shadow, selective
// bloom on the glowing dots, slow delta-based idle rotation, and the full
// accessibility/performance contract from CLAUDE.md.
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PalmTree } from './PalmTree';
import { Hotspots } from './Hotspots';
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

  const [activeId, setActiveId] = useState<string | null>(null);

  // Selective bloom only on capable desktop; emissive-only fallback otherwise.
  const bloomEnabled = !reducedMotion && !noHover;
  // Rotation runs only when visible and motion is allowed.
  const rotate = visible && !reducedMotion;
  const frameloop: 'always' | 'demand' = reducedMotion || !visible ? 'demand' : 'always';

  // Touch / no-hover: auto-cycle the hotspots one at a time.
  useEffect(() => {
    if (!noHover || reducedMotion || !visible) return;
    const ids = config.hotspots.map((h) => h.id);
    let i = 0;
    setActiveId(ids[0]);
    const t = setInterval(() => {
      i = (i + 1) % ids.length;
      setActiveId(ids[i]);
    }, 2400);
    return () => clearInterval(t);
  }, [noHover, reducedMotion, visible, config.hotspots]);

  return (
    <div ref={wrapRef} className="h-full w-full bg-white">
      <Canvas
        flat
        shadows={false}
        dpr={[1, 2]}
        frameloop={frameloop}
        camera={{ position: [3.5, 2.5, 5.7], fov: 34 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#FFFFFF', 1);
          camera.lookAt(0.1, 1.55, 0); // aim at the palm's mid-height, not the base
        }}
        fallback={<NoWebGL config={config} />}
      >
        <DemandInvalidate trigger={activeId} />

        {/* Soft, layered light — low ambient + soft key + dim fill. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 8, 5]} intensity={0.7} />
        <directionalLight position={[-5, 3, -3]} intensity={0.2} />

        <IdleRotation enabled={rotate}>
          <PalmTree
            config={config}
            activeId={activeId}
            onHover={setActiveId}
            bloom={bloomEnabled}
            pulse={rotate}
          />
          <Hotspots
            config={config}
            activeId={activeId}
            onHover={setActiveId}
            showAll={reducedMotion}
          />
        </IdleRotation>

        {/* Subtle baked contact shadow on the white ground. */}
        <ContactShadows
          position={[0, 0, 0]}
          scale={6}
          far={4}
          blur={2.6}
          opacity={0.32}
          frames={1}
          color="#3a342b"
          resolution={512}
        />

        {/* Selective bloom: only the >1 emissive dots glow; white stays white. */}
        {bloomEnabled && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={1.02}
              luminanceSmoothing={0}
              mipmapBlur
              intensity={0.55}
              radius={0.2}
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
