// One solid block of the palm = a SINGLE mixed treatment:
//   • a flat-shaded, sober-colored, semi-transparent FACE (solid yet see-through)
//   • a luminous glowing WIREFRAME edge (over-driven so selective bloom lights it)
// The vertex points are a separate instanced layer (VertexDots).
import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from './config';

interface VoxelMeshProps {
  size: Vec3;
  position: Vec3;
  quaternion: [number, number, number, number];
  color: string;
  edgeColor: string;
  /** Multiplier pushing edge color >1 so it blooms (under flat tone mapping). */
  edgeBoost: number;
  opacity: number;
}

export function VoxelMesh({
  size,
  position,
  quaternion,
  color,
  edgeColor,
  edgeBoost,
  opacity,
}: VoxelMeshProps) {
  const geometry = useMemo(() => new THREE.BoxGeometry(size[0], size[1], size[2]), [size[0], size[1], size[2]]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        flatShading: true,
        metalness: 0,
        roughness: 0.85,
        transparent: true,
        opacity,
        // See-through: don't occlude the glowing edges/points behind the form,
        // but keep it reading as a solid (color + light still land on faces).
        depthWrite: false,
      }),
    [color, opacity],
  );

  // Over-driven edge color: value can exceed 1, so under <Canvas flat> (no tone
  // mapping) it passes Bloom's luminanceThreshold={1} and glows. White bg = 1.0
  // stays below threshold → never blooms.
  const edge = useMemo(
    () => new THREE.Color(edgeColor).multiplyScalar(edgeBoost),
    [edgeColor, edgeBoost],
  );

  return (
    <mesh geometry={geometry} material={material} position={position} quaternion={quaternion}>
      <Edges threshold={15}>
        <lineBasicMaterial color={edge} toneMapped={false} transparent opacity={0.95} />
      </Edges>
    </mesh>
  );
}
