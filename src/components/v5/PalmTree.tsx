// The exported procedural palm group — three addressable layers:
//   FACES  (solid translucent blocks)  → VoxelMesh
//   EDGES  (glowing wireframe)          → VoxelMesh's <Edges>
//   POINTS (stable vertex field)        → VertexDots
// Service hotspots are intentionally removed for now (added at the very end).
// The block `order` is the future build-anim hook.
import { useMemo } from 'react';
import { VoxelMesh } from './VoxelMesh';
import { VertexDots } from './VertexDots';
import { buildPalm } from './layout';
import type { PalmConfig } from './config';

interface PalmTreeProps {
  config: PalmConfig;
  /** Selective bloom on (desktop) → push emissive >1; off → gentler emissive. */
  bloom: boolean;
  /** Idle pulse of the vertex field (off for reduced-motion). */
  pulse: boolean;
}

export function PalmTree({ config, bloom, pulse }: PalmTreeProps) {
  const { colors } = config;
  // Built ONCE (memoized): geometry + the deduplicated vertex field. These dots
  // live inside the rotating palm group, so they rotate WITH the model and are
  // never recomputed per frame — the count/positions are fully static.
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

      {/* Stable glowing POINT field — one dot per real, deduplicated vertex. */}
      <VertexDots points={model.vertices} color={colors.vertex} bloom={bloom} pulse={pulse} />
    </group>
  );
}
