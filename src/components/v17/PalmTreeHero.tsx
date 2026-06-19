// PalmTreeHero — the single React island for STEP 1.
// One Canvas: white scene, soft layered light, baked contact shadow, selective
// bloom on the glowing dots, slow delta-based idle rotation, and the full
// accessibility/performance contract from CLAUDE.md.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SceneBuild } from './SceneBuild';
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
// Idle Y-rotation that EASES IN (0→full) once enabled, so the hand-off from the
// build animation has no velocity jump.
function IdleRotation({
  enabled,
  easeIn,
  children,
}: {
  enabled: boolean;
  easeIn: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const ramp = useRef(0);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ramp.current = enabled ? Math.min(ramp.current + delta / Math.max(easeIn, 0.001), 1) : 0;
    const s = ramp.current * ramp.current * (3 - 2 * ramp.current); // smoothstep
    ref.current.rotation.y += delta * 0.18 * s; // framerate-independent
  });
  return <group ref={ref}>{children}</group>;
}

// Dawn backdrop rendered INSIDE the scene as `scene.background`, so the
// validated sunrise gradient is part of the render and ALWAYS sits behind
// everything. Unlike a DOM layer behind a transparent canvas, the translucent
// faces fading in during the build can't wash it out. Same colors + placement
// as before: a vertical sky wash + an elliptical sun-halo low-left, drawn to a
// canvas texture and re-drawn on resize so it stays screen-fixed (never rotates).
function DawnBackground({ colors }: { colors: PalmConfig['colors'] }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(document.createElement('canvas'));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useLayoutEffect(() => {
    const w = Math.max(2, Math.round(size.width));
    const h = Math.max(2, Math.round(size.height));
    const canvas = texture.image as HTMLCanvasElement;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rgba = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    // Sky: near-white top, gentle warm wash toward the bottom (linear 180deg).
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, colors.skyTop);
    sky.addColorStop(0.5, colors.skyTop);
    sky.addColorStop(1, colors.skyWarm);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Sun halo: warm core low-left (20%/88%), elliptical (60%×52%), easing to
    // transparent peach by 60% — no hard disc. Scale the context to get the
    // ellipse from a unit-circle radial gradient.
    ctx.save();
    ctx.translate(0.2 * w, 0.88 * h);
    ctx.scale(0.6 * w, 0.52 * h);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    halo.addColorStop(0, colors.haloCore);
    halo.addColorStop(0.26, rgba(colors.haloMid, 0.55));
    halo.addColorStop(0.6, rgba(colors.haloMid, 0));
    halo.addColorStop(1, rgba(colors.haloMid, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
    ctx.restore();

    texture.needsUpdate = true;
    scene.background = texture;
    invalidate(); // repaint in demand frameloop
  }, [scene, invalidate, size.width, size.height, texture, colors]);

  useEffect(
    () => () => {
      if (scene.background === texture) scene.background = null;
      texture.dispose();
    },
    [scene, texture],
  );

  return null;
}

/** In demand frameloop, request a render when interaction state changes. */
function DemandInvalidate({ trigger }: { trigger: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [trigger, invalidate]);
  return null;
}

// Responsive fit: DESKTOP keeps the exact validated v9 framing; narrower screens
// pull the camera back (and lower the look-at) so the WHOLE diorama — island,
// palm and boat — fits comfortably with no overflow. Only the camera changes;
// the scene itself is untouched.
function CameraRig({ phone, tablet }: { phone: boolean; tablet: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const f = phone ? 1.75 : tablet ? 1.42 : 1.0; // pull-back (wider sea → more)
    camera.position.set(5.9 * f, 3.9 * f, 9.3 * f);
    camera.lookAt(0.1, phone ? 0.5 : tablet ? 0.8 : 1.05, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [phone, tablet, camera, invalidate]);
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
  const phone = useMediaQuery('(max-width: 640px)'); // strong pull-back
  const tablet = useMediaQuery('(max-width: 1024px)'); // moderate pull-back
  const visible = useVisible(wrapRef);

  // Selective bloom only on capable desktop; emissive-only fallback otherwise.
  const bloomEnabled = !reducedMotion && !noHover;
  // Live motion (ripple + node pulse) runs whenever visible & motion allowed.
  const motion = visible && !reducedMotion;
  // Idle scene rotation is gated SEPARATELY by config (paused now; see config).
  const rotate = motion && config.idleRotation;
  const frameloop: 'always' | 'demand' = reducedMotion || !visible ? 'demand' : 'always';

  // Palm "construction" build: plays once on load, THEN the scene eases into
  // its idle rotation. Reduced-motion starts already built (no assembly).
  const [built, setBuilt] = useState(reducedMotion);
  const handleBuilt = useCallback(() => setBuilt(true), []);

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
        {/* Responsive mobile fit (desktop unchanged). */}
        <CameraRig phone={phone} tablet={tablet} />

        {/* Sunrise gradient as the rendered scene background (sits behind all
            geometry — translucent build faces can't veil it). */}
        <DawnBackground colors={config.colors} />

        {/* Dawn lighting: soft neutral fill + a WARM raking key from the sun
            side (low-left), so the palm gets a warm lit side and belongs to the
            sunrise. Ambient/fill keep the shadow side gentle. */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={0.5} />
        <directionalLight position={[-5.5, 2.2, 3.8]} intensity={0.7} color={config.colors.warmKey} />
        <directionalLight position={[-5, 3, -3]} intensity={0.16} />

        {/* Whole island→palm→water world builds itself, then settles to white
            edges. Rotation is held during the build and eased in afterwards. */}
        <IdleRotation enabled={built && rotate} easeIn={config.build.rotateEaseIn}>
          <SceneBuild
            config={config}
            bloom={bloomEnabled}
            pulse={motion}
            animate={motion}
            reducedMotion={reducedMotion}
            onBuildComplete={handleBuilt}
          />
        </IdleRotation>

        {/* Soft contact shadow, centered under the ~circular island. Held until
            the build settles so it bakes the final full-opacity scene ONCE —
            this keeps it stable and prevents the jump at the rotation hand-off.
            It sits OUTSIDE IdleRotation, so it never spins with the world. */}
        {built && (
          <ContactShadows
            position={[0, -0.02, 0]}
            scale={6}
            far={4}
            blur={2.8}
            opacity={0.28}
            frames={1}
            color="#4a3f33"
            resolution={512}
          />
        )}

        {/* Selective bloom: only the >1 emissive edges/dots glow. A TIGHT radius
            keeps the construction glow hugging the wireframe instead of spreading
            a wide white halo across the transparent canvas (which veiled the dawn
            gradient mid-build). White (≤1) stays crisp. */}
        {bloomEnabled && (
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={0.7} radius={0.12} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
