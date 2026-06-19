// Translucent voxel water + wet-sand fringe around the island. Water is lighter
// (more transparent) than the land with subtle non-blooming edges; the wet-sand
// fringe is rendered solid-ish like the land. No glowing nodes on the water.
import { useMemo } from 'react';
import { VoxelMesh } from './VoxelMesh';
import { buildWater } from './waterLayout';
import type { PalmConfig } from './config';

export function WaterBase({ config }: { config: PalmConfig }) {
  const water = useMemo(() => buildWater(config), [config]);

  return (
    <group>
      {water.blocks.map((b) => (
        <VoxelMesh
          key={b.id}
          size={b.size}
          position={b.position}
          quaternion={b.quaternion}
          color={b.color}
          edgeColor={b.edgeColor}
          edgeBoost={1.0} // crisp but non-blooming → stays calm
          opacity={b.fringe ? config.baseOpacity : config.waterOpacity}
        />
      ))}
    </group>
  );
}
