// The exported procedural palm group: trunk + crown + fronds + the selective
// glowing hotspot dots. Cleanly exportable for later reuse across the site.
import { useMemo, type ThreeEvent } from 'react';
import * as THREE from 'three';
import { VoxelMesh } from './VoxelMesh';
import {
  buildTrunk,
  buildFronds,
  CROWN,
  CROWN_APEX,
  FROND_GROUP_POSITION,
  resolveAnchor,
  type Frond,
} from './layout';
import type { PalmConfig, Vec3 } from './config';

interface PalmTreeProps {
  config: PalmConfig;
  activeId: string | null;
  onHover: (id: string | null) => void;
  /** Higher emissive when selective bloom is on; gentler emissive-only otherwise. */
  bloom: boolean;
}

function Frond({ frond, colors }: { frond: Frond; colors: PalmConfig['colors'] }) {
  const color = colors.frond[frond.tier];
  return (
    <group position={FROND_GROUP_POSITION} rotation={[0, frond.angle, 0]}>
      {frond.leaflets.map((leaf, k) => (
        <VoxelMesh
          key={k}
          kind="box"
          args={leaf.size}
          position={leaf.position}
          rotation={[0, 0, leaf.rotationZ]}
          color={color}
          edgeColor={colors.frondEdge}
        />
      ))}
    </group>
  );
}

interface DotProps {
  id: string;
  position: Vec3;
  color: string;
  active: boolean;
  bloom: boolean;
  onHover: (id: string | null) => void;
}

function HotspotDot({ id, position, color, active, bloom, onHover }: DotProps) {
  // Emissive lifted >1 with toneMapped=false so selective bloom (threshold 1)
  // catches it without blowing out the white background.
  const base = bloom ? 2.2 : 1.05;
  const intensity = active ? base * 1.7 : base;
  const scale = active ? 1.6 : 1;

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
      <sphereGeometry args={[0.046, 16, 16]} />
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

export function PalmTree({ config, activeId, onHover, bloom }: PalmTreeProps) {
  const { colors } = config;
  const trunk = useMemo(() => buildTrunk(), []);
  const fronds = useMemo(() => buildFronds(config.frondCount), [config.frondCount]);

  const anchors = useMemo(
    () =>
      config.hotspots.map((h) => ({
        id: h.id,
        position: resolveAnchor(h.anchor, fronds),
      })),
    [config.hotspots, fronds],
  );

  return (
    <group>
      {/* Trunk — stacked tapered, faceted cylinder segments along a gentle arc. */}
      {trunk.map((seg, i) => (
        <VoxelMesh
          key={`t${i}`}
          kind="cylinder"
          args={[seg.radiusTop, seg.radiusBottom, seg.height]}
          position={seg.position}
          rotation={[0, 0, seg.rotationZ]}
          color={i / trunk.length > 0.5 ? colors.trunkTop : colors.trunkBottom}
          edgeColor={colors.trunkEdge}
        />
      ))}

      {/* Crown nut — a small faceted block tying the fronds to the trunk top. */}
      <VoxelMesh
        kind="cylinder"
        args={[0.12, 0.14, 0.22]}
        position={[CROWN[0], CROWN[1] + 0.05, CROWN[2]]}
        color={colors.trunkTop}
        edgeColor={colors.trunkEdge}
        radialSegments={6}
      />

      {/* Fronds radiating from the crown. */}
      {fronds.map((f) => (
        <Frond key={f.index} frond={f} colors={colors} />
      ))}

      {/* Selective glowing hotspot dots (the only emissive points). */}
      {anchors.map((a) => (
        <HotspotDot
          key={a.id}
          id={a.id}
          position={a.position}
          color={colors.dot}
          active={activeId === a.id}
          bloom={bloom}
          onHover={onHover}
        />
      ))}
    </group>
  );
}

export { CROWN_APEX };
