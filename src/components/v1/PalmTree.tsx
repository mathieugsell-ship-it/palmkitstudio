// The exported procedural palm group — three addressable layers:
//   FACES  (solid translucent blocks)  → VoxelMesh
//   EDGES  (glowing wireframe)          → VoxelMesh's <Edges>
//   POINTS (vertex field + hotspots)    → VertexDots + HotspotDot
// Cleanly exportable for reuse. The block `order` is the future build-anim hook.
import { useMemo, type ThreeEvent } from 'react';
import * as THREE from 'three';
import { VoxelMesh } from './VoxelMesh';
import { VertexDots } from './VertexDots';
import { buildPalm } from './layout';
import type { PalmConfig, Vec3 } from './config';

interface PalmTreeProps {
  config: PalmConfig;
  activeId: string | null;
  onHover: (id: string | null) => void;
  /** Selective bloom on (desktop) → push emissive >1; off → gentler emissive. */
  bloom: boolean;
  /** Idle pulse of the vertex field (off for reduced-motion). */
  pulse: boolean;
}

interface DotProps {
  id: string;
  position: Vec3;
  color: string;
  active: boolean;
  bloom: boolean;
  onHover: (id: string | null) => void;
}

// Hotspot dots are a DISTINCT subset of the vertex field: coral, larger,
// brighter, interactive — so the 6 services stay identifiable.
function HotspotDot({ id, position, color, active, bloom, onHover }: DotProps) {
  const base = bloom ? 2.6 : 1.3;
  const intensity = active ? base * 1.6 : base;
  const scale = active ? 1.7 : 1.1;

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(id);
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  return (
    <mesh position={position} scale={scale} onPointerOver={over} onPointerOut={out}>
      <sphereGeometry args={[0.055, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={new THREE.Color(color)}
        emissiveIntensity={intensity}
        toneMapped={false}
        roughness={0.4}
        metalness={0}
      />
    </mesh>
  );
}

export function PalmTree({ config, activeId, onHover, bloom, pulse }: PalmTreeProps) {
  const { colors } = config;
  const model = useMemo(() => buildPalm(config), [config]);
  const edgeBoost = bloom ? 2.5 : 1.0;

  return (
    <group>
      {/* FACES + glowing EDGES, one block at a time. */}
      {model.blocks.map((b) => (
        <VoxelMesh
          key={b.id}
          size={b.size}
          position={b.position}
          quaternion={b.quaternion}
          color={b.color}
          edgeColor={colors.edge}
          edgeBoost={edgeBoost}
          opacity={config.faceOpacity}
        />
      ))}

      {/* Full glowing POINT field at every vertex. */}
      <VertexDots points={model.vertices} color={colors.vertex} bloom={bloom} pulse={pulse} />

      {/* The 6 hotspot anchors — distinct coral dots, a subset of the field. */}
      {config.hotspots.map((h) => (
        <HotspotDot
          key={h.id}
          id={h.id}
          position={model.anchorsById[h.id]}
          color={colors.hotspot}
          active={activeId === h.id}
          bloom={bloom}
          onHover={onHover}
        />
      ))}
    </group>
  );
}
