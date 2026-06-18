// One voxel shape = three layers: a soft flat-shaded face, a thin edge line,
// and (separately, in PalmTree) selective glowing dots. (CLAUDE.md three-layer look.)
import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from './config';

interface VoxelMeshProps {
  kind: 'box' | 'cylinder';
  /** box: [w,h,d] ; cylinder: [radiusTop, radiusBottom, height] */
  args: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  color: string;
  edgeColor: string;
  /** cylinders use few radial segments for the faceted voxel look */
  radialSegments?: number;
}

export function VoxelMesh({
  kind,
  args,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  edgeColor,
  radialSegments = 6,
}: VoxelMeshProps) {
  const geometry = useMemo(() => {
    const geo =
      kind === 'box'
        ? new THREE.BoxGeometry(args[0], args[1], args[2])
        : new THREE.CylinderGeometry(args[0], args[1], args[2], radialSegments);
    return geo;
  }, [kind, args[0], args[1], args[2], radialSegments]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        flatShading: true,
        metalness: 0,
        roughness: 0.82,
      }),
    [color],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      castShadow
    >
      {/* Thin darker-tint edge lines, lifted slightly so they read crisply. */}
      <Edges threshold={15} scale={1.015} color={edgeColor} />
    </mesh>
  );
}
