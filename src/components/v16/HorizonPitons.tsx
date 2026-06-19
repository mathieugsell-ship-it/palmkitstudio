// HorizonPitons — the distant, hazy karst stacks rendered as a static backdrop
// (v16). Flat UNLIT materials (MeshBasic) in a pale cool grey at LOW opacity give
// the atmospheric-perspective read: lost shading detail + the dawn showing
// through = far away. Kept OUTSIDE the rotation group so it stays a fixed
// horizon. One shared unit-box geometry (scaled per block) + one edges geometry
// → cheap; everything is memoized and disposed on unmount.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildHorizonPitons } from './horizonLayout';
import type { PalmConfig } from './config';

export function HorizonPitons({ config }: { config: PalmConfig }) {
  const blocks = useMemo(() => buildHorizonPitons(), []);
  const c = config.colors;

  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(unitBox, 15), [unitBox]);
  const rockMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c.horizonRock),
        transparent: true,
        opacity: c.horizonRockOpacity,
        depthWrite: false,
      }),
    [c.horizonRock, c.horizonRockOpacity],
  );
  const greenMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c.horizonCrown),
        transparent: true,
        opacity: c.horizonCrownOpacity,
        depthWrite: false,
      }),
    [c.horizonCrown, c.horizonCrownOpacity],
  );
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(c.horizonEdge),
        transparent: true,
        opacity: c.horizonEdgeOpacity,
        depthWrite: false,
        toneMapped: false,
      }),
    [c.horizonEdge, c.horizonEdgeOpacity],
  );

  useEffect(
    () => () => {
      unitBox.dispose();
      unitEdges.dispose();
      rockMat.dispose();
      greenMat.dispose();
      edgeMat.dispose();
    },
    [unitBox, unitEdges, rockMat, greenMat, edgeMat],
  );

  return (
    <group renderOrder={-1}>
      {blocks.map((b, i) => (
        <mesh
          key={i}
          geometry={unitBox}
          material={b.kind === 'crown' ? greenMat : rockMat}
          position={b.position}
          scale={b.size}
          renderOrder={-1}
        >
          <lineSegments geometry={unitEdges} material={edgeMat} renderOrder={-1} />
        </mesh>
      ))}
    </group>
  );
}
