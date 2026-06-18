// Variant B island — a clean LOW-POLY TRIANGULATED "tech blueprint" palm on a
// LIGHT background. The triangle wireframe is the hero graphic (drei
// <Wireframe>): crisp green strokes + faint translucent fill, with deep-teal
// node dots at the vertices. No neon/bloom — restrained and precise on light.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Wireframe, Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { buildMeshPalm, type MeshColors, type Vec3 } from './meshLayout';
import { useMediaQuery, useVisible } from './useViewport';

// Blueprint palette — greens for the form, deep teal for the nodes. Kept here
// (not in the voxel config) so Variant B is self-contained.
const MESH_COLORS: MeshColors = {
  trunkFill: '#8AA678',
  trunkStroke: '#2C4A30',
  frondFill: '#6FB890',
  frondStroke: '#1F6643',
};
const NODE_COLOR = '#15A89A'; // saturated teal — reads on light, unlike #5FE3D6
const BG = '#EEF2F1'; // very light cool grey

// ---- in-canvas helpers -----------------------------------------------------
function IdleRotation({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && ref.current) ref.current.rotation.y += delta * 0.16;
  });
  return <group ref={ref}>{children}</group>;
}

function DemandInvalidate({ trigger }: { trigger: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [trigger, invalidate]);
  return null;
}

function Nodes({ points, pulse }: { points: Vec3[]; pulse: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (!matRef.current) return;
    // Restrained opacity pulse — crisp dots, no halo.
    matRef.current.opacity = pulse ? 0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.15 : 0.95;
  });
  return (
    <Instances limit={points.length} range={points.length} frustumCulled={false}>
      <sphereGeometry args={[0.028, 10, 10]} />
      <meshBasicMaterial ref={matRef} color={NODE_COLOR} transparent opacity={0.95} toneMapped={false} />
      {points.map((p, i) => (
        <Instance key={i} position={p} />
      ))}
    </Instances>
  );
}

function NoWebGL() {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: BG }}>
      <p className="text-sm font-medium text-neutral-600">Palmkit Studio — blueprint palm</p>
    </div>
  );
}

export default function PalmTreeMesh({ frondCount = 8 }: { frondCount?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const visible = useVisible(wrapRef);

  const model = useMemo(() => buildMeshPalm(frondCount, MESH_COLORS), [frondCount]);
  // Dispose geometries on unmount / rebuild.
  useEffect(() => () => model.parts.forEach((p) => p.geometry.dispose()), [model]);

  const rotate = visible && !reducedMotion;
  const frameloop: 'always' | 'demand' = reducedMotion || !visible ? 'demand' : 'always';

  return (
    <div ref={wrapRef} className="h-full w-full" style={{ background: BG }}>
      <Canvas
        flat
        shadows={false}
        dpr={[1, 2]}
        frameloop={frameloop}
        camera={{ position: [3.4, 2.4, 5.4], fov: 32 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(BG, 1);
          camera.lookAt(0.15, 1.7, 0);
        }}
        fallback={<NoWebGL />}
      >
        <DemandInvalidate trigger={reducedMotion} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 5]} intensity={0.5} />

        <IdleRotation enabled={rotate}>
          {/* Triangulated parts: wireframe + faint translucent fill. */}
          {model.parts.map((part) => (
            <group key={part.id} position={part.position} quaternion={part.quaternion}>
              <Wireframe
                geometry={part.geometry}
                simplify={false}
                stroke={part.stroke}
                thickness={0.09}
                strokeOpacity={1}
                backfaceStroke={part.stroke}
                fill={part.fill}
                fillOpacity={0.15}
                fillMix={1}
              />
            </group>
          ))}

          {/* Deep-teal node dots at every vertex. */}
          <Nodes points={model.nodes} pulse={rotate} />
        </IdleRotation>

        {/* Very soft contact shadow to ground the floating mesh. */}
        <ContactShadows position={[0, 0, 0]} scale={5} far={4} blur={3} opacity={0.16} frames={1} color="#3A4A45" resolution={512} />
      </Canvas>
    </div>
  );
}
