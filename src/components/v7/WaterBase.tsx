// Translucent voxel water + wet-sand fringe around the island, now with a
// gentle RIPPLE: each water block bobs vertically on a smooth travelling wave
// (y = baseY + amp·sin(t·speed + (x+z)·k)). Cheap — per-block phase/baseY are
// precomputed once and we only mutate group.position.y in one useFrame; no
// geometry/material is recreated. The wet-sand fringe stays static; only the
// water moves. Frozen flat for reduced-motion; paused offscreen via frameloop.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoxelMesh } from './VoxelMesh';
import { buildWater } from './waterLayout';
import type { PalmConfig } from './config';

export function WaterBase({ config, animate }: { config: PalmConfig; animate: boolean }) {
  const groupsRef = useRef<(THREE.Group | null)[]>([]);

  // Built once; precompute per-block wave phase + base height.
  const sim = useMemo(() => {
    const { blocks } = buildWater(config);
    const k = config.rippleK;
    const phase = blocks.map((b) => (b.position[0] + b.position[2]) * k);
    const baseY = blocks.map((b) => b.position[1]);
    return { blocks, phase, baseY };
  }, [config]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { blocks, phase, baseY } = sim;
    const amp = config.rippleAmp;
    const speed = config.rippleSpeed;
    for (let i = 0; i < blocks.length; i++) {
      const g = groupsRef.current[i];
      if (!g) continue;
      // Water bobs; the wet-sand fringe stays flat. Reduced-motion / paused →
      // hold flat at baseY.
      g.position.y =
        animate && !blocks[i].fringe ? baseY[i] + amp * Math.sin(t * speed + phase[i]) : baseY[i];
    }
  });

  return (
    <group>
      {sim.blocks.map((b, i) => (
        <group
          key={b.id}
          position={b.position}
          ref={(el) => {
            groupsRef.current[i] = el;
          }}
        >
          <VoxelMesh
            size={b.size}
            position={[0, 0, 0]}
            quaternion={b.quaternion}
            color={b.color}
            edgeColor={b.edgeColor}
            edgeBoost={1.0}
            opacity={b.fringe ? config.baseOpacity : config.waterOpacity}
          />
        </group>
      ))}
    </group>
  );
}
