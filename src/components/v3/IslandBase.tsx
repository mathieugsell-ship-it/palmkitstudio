// The voxel island/beach base under the palm. Same constructed-model treatment
// as the tree (VoxelMesh faces + crisp <Edges>) but MORE transparent and with
// non-blooming edges, so it recedes and the palm stays the hero. Optional small
// subtle teal nodes echo the palm's vertex language.
import { useMemo } from 'react';
import { VoxelMesh } from './VoxelMesh';
import { VertexDots } from './VertexDots';
import { buildIsland } from './islandLayout';
import type { PalmConfig } from './config';

interface IslandBaseProps {
  config: PalmConfig;
  bloom: boolean;
  pulse: boolean;
}

export function IslandBase({ config, bloom, pulse }: IslandBaseProps) {
  const { colors } = config;
  const island = useMemo(() => buildIsland(config), [config]);

  return (
    <group>
      {island.blocks.map((b) => (
        <VoxelMesh
          key={b.id}
          size={b.size}
          position={b.position}
          quaternion={b.quaternion}
          color={b.color}
          edgeColor={colors.edge}
          // Crisp but NON-blooming edges (boost 1.0) → the base recedes while
          // the palm's edges glow.
          edgeBoost={1.0}
          opacity={b.opacity}
        />
      ))}

      {config.baseNodes && (
        // bloom=false on purpose: crisp, subtle base nodes that DON'T bloom, so
        // their glow-haze can't grey out the sand. Keeps the base recessive.
        <VertexDots points={island.vertices} color={colors.vertex} bloom={false} pulse={pulse} radius={0.011} />
      )}
    </group>
  );
}
