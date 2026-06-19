// SceneCanvas — the full-bleed 3D scene (STEP 8). Canvas-only: the validated
// world (build → dawn → white settle → ripple → rotation) plus the 6 interactive
// service-map nodes. All UI/state lives in HeroExperience; this component just
// renders the scene from props and reports node hover/click/close back up.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { SceneBuild } from './SceneBuild';
import { type PalmConfig } from './config';

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

// Idle Y-rotation that EASES IN (0→full) once enabled (no velocity jump). When
// disabled (build still running, or a service is open) it eases back to a stop.
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
    const step = delta / Math.max(easeIn, 0.001);
    ramp.current = enabled
      ? Math.min(ramp.current + step, 1)
      : Math.max(ramp.current - step, 0); // ease the spin back to rest when paused
    const s = ramp.current * ramp.current * (3 - 2 * ramp.current); // smoothstep
    ref.current.rotation.y += delta * 0.18 * s; // framerate-independent
  });
  return <group ref={ref}>{children}</group>;
}

// Dawn backdrop rendered INSIDE the scene as `scene.background`, so the sunrise
// gradient is part of the render and always sits behind everything (translucent
// build faces can't veil it). Re-drawn on resize so it stays screen-fixed.
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
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, colors.skyTop);
    sky.addColorStop(0.5, colors.skyTop);
    sky.addColorStop(1, colors.skyWarm);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
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
    invalidate();
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

// Responsive framing for the full-bleed hero — only the CAMERA changes (scene
// internals untouched): desktop = validated framing; mobile = pulled back and
// look-at raised so the palm drops lower/smaller, clearing room for the text.
function CameraRig({ mobile }: { mobile: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (mobile) {
      camera.position.set(4.7, 4.7, 11.4);
      camera.lookAt(0.1, 2.5, 0);
    } else {
      camera.position.set(5.9, 3.9, 9.3);
      camera.lookAt(0.1, 1.05, 0);
    }
    camera.updateProjectionMatrix();
    invalidate();
  }, [mobile, camera, invalidate]);
  return null;
}

// WebGL-unavailable fallback (the DOM services list still works above this).
function NoWebGL() {
  return <div className="h-full w-full" />;
}

interface Props {
  config: PalmConfig;
  reducedMotion: boolean;
  noHover: boolean;
  mobile: boolean;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  // STEP 9: DOM connector line + hover label projection (desktop enhancement).
  connectorRef?: React.RefObject<SVGLineElement | null>;
  labelRef?: React.RefObject<HTMLDivElement | null>;
  panelAnchorRef?: React.MutableRefObject<{ x: number; y: number } | null>;
}

export default function SceneCanvas({
  config,
  reducedMotion,
  noHover,
  mobile,
  selected,
  hovered,
  onSelect,
  onHover,
  connectorRef,
  labelRef,
  panelAnchorRef,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const visible = useVisible(wrapRef);

  const bloomEnabled = !reducedMotion && !noHover;
  // Idle rotation runs only when visible, motion is allowed, AND no service is
  // open (the palm holds still so the lit branch is easy to read).
  const rotate = visible && !reducedMotion && selected === null;
  const pulse = visible && !reducedMotion; // node pulsing (overview)
  const frameloop: 'always' | 'demand' = reducedMotion || !visible ? 'demand' : 'always';

  const [built, setBuilt] = useState(reducedMotion);
  const handleBuilt = () => setBuilt(true);

  // Drag-guard for "click empty space to close": only close on a genuine click
  // (pointer barely moved), never while dragging/looking around the scene.
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const dawnBg = useMemo(() => {
    const c = config.colors;
    const rgba = (hex: string, a: number) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    return [
      `radial-gradient(60% 52% at 20% 88%, ${c.haloCore} 0%, ${rgba(c.haloMid, 0.55)} 26%, ${rgba(c.haloMid, 0)} 60%)`,
      `linear-gradient(180deg, ${c.skyTop} 0%, ${c.skyTop} 50%, ${c.skyWarm} 100%)`,
    ].join(', ');
  }, [config.colors]);

  return (
    <div
      ref={wrapRef}
      className="h-full w-full"
      style={{ background: dawnBg }}
      onPointerDown={(e) => {
        downRef.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas
        flat
        shadows={false}
        dpr={[1, 2]}
        frameloop={frameloop}
        camera={{ position: [5.9, 3.9, 9.3], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 0);
        }}
        onPointerMissed={(e) => {
          // Empty-space click → close. Ignore drags (moved > 6px) so just
          // looking around never dismisses an open service.
          if (selected === null) return;
          const d = downRef.current;
          if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) onSelect(null);
        }}
        fallback={<NoWebGL />}
      >
        <DemandInvalidate trigger={reducedMotion} />
        <DemandInvalidate trigger={selected} />
        <DemandInvalidate trigger={hovered} />

        <CameraRig mobile={mobile} />
        <DawnBackground colors={config.colors} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 5]} intensity={0.5} />
        <directionalLight position={[-5.5, 2.2, 3.8]} intensity={0.7} color={config.colors.warmKey} />
        <directionalLight position={[-5, 3, -3]} intensity={0.16} />

        <IdleRotation enabled={built && rotate} easeIn={config.build.rotateEaseIn}>
          <SceneBuild
            config={config}
            bloom={bloomEnabled}
            pulse={pulse}
            animate={visible && !reducedMotion}
            reducedMotion={reducedMotion}
            onBuildComplete={handleBuilt}
            selected={selected}
            hovered={hovered}
            onSelect={onSelect}
            onHover={onHover}
            desktop={!mobile}
            connectorRef={connectorRef}
            labelRef={labelRef}
            panelAnchorRef={panelAnchorRef}
          />
        </IdleRotation>

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

        {bloomEnabled && (
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={0.7} radius={0.12} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
