// The glowing vertex POINT FIELD — a small luminous dot at every block corner,
// the language of a 3D engine's vertices. Instanced for perf; one shared
// material whose emissive gently pulses ("scanning / alive"). Pulse pauses for
// reduced-motion (and naturally when the frameloop is paused offscreen).
import { useRef } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from './config';

interface VertexDotsProps {
  points: Vec3[];
  color: string;
  bloom: boolean;
  pulse: boolean;
}

export function VertexDots({ points, color, bloom, pulse }: VertexDotsProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const base = bloom ? 1.45 : 1.0;

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = pulse
      ? base + Math.sin(state.clock.elapsedTime * 2.2) * 0.35
      : base;
  });

  return (
    <Instances limit={points.length} range={points.length} frustumCulled={false}>
      <sphereGeometry args={[0.013, 8, 8]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={new THREE.Color(color)}
        emissiveIntensity={base}
        toneMapped={false}
        transparent
        opacity={0.95}
        metalness={0}
        roughness={0.4}
      />
      {points.map((p, i) => (
        <Instance key={i} position={p} />
      ))}
    </Instances>
  );
}
