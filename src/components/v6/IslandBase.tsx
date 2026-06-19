// The rounded voxel beach islet under the palm. Same voxel treatment as the
// tree (solid-yet-translucent faces + crisp <Edges>), but more recessed (lower
// opacity, natural darker edges, NON-blooming) and with NO glowing nodes — the
// island is plainer land so the palm stays the focal "tech" object.
import { useMemo } from 'react';
import { VoxelMesh } from './VoxelMesh';
import { buildIsland } from './islandLayout';
import type { PalmConfig } from './config';

export function IslandBase({ config }: { config: PalmConfig }) {
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
          edgeColor={b.edgeColor}
          edgeBoost={1.0} // crisp but non-blooming → recedes behind the palm
          opacity={config.baseOpacity}
        />
      ))}
    </group>
  );
}
